/**
 * Shared cleanup logic for expired medicines
 * Used by both the cron job and the API route
 */

import { SupabaseClient } from '@supabase/supabase-js'

export interface ExpiredBatch {
    medicine_id: string
    batch_number: string
    expiry_date: string
    medicine_name?: string
    purchase_id: string
}

export interface DeletionStats {
    current_inventory: number
    stock_transactions: number
    purchase_items: number
    purchases: number
}

export interface CleanupResult {
    success: boolean
    message: string
    cutoffDate: string
    batchesProcessed: number
    stats: DeletionStats
    error?: string
}

/**
 * Calculate the cutoff date (N years before current year's January 1st)
 * Default is 2 years if not specified in environment
 */
export function calculateCutoffDate(): Date {
    const retentionYears = parseInt(process.env.CLEANUP_RETENTION_YEARS || '4', 10)
    const currentYear = new Date().getFullYear()
    const cutoffYear = currentYear - retentionYears
    return new Date(cutoffYear, 0, 1) // January 1st, N years ago
}

/**
 * Format date for display
 */
export function formatDate(date: Date): string {
    return date.toISOString().split('T')[0]
}

/**
 * Fetch all expired purchase items that are 2+ years old
 */
async function fetchExpiredBatches(supabase: SupabaseClient, cutoffDate: Date): Promise<ExpiredBatch[]> {
    const { data, error } = await supabase
        .from('purchase_items')
        .select(`
            medicine_id,
            batch_number,
            expiry_date,
            purchase_id,
            medicines:medicine_id (
                name
            )
        `)
        .lt('expiry_date', formatDate(cutoffDate))
        .order('expiry_date', { ascending: true })
    
    if (error) {
        throw new Error(`Error fetching expired batches: ${error.message}`)
    }
    
    const batches: ExpiredBatch[] = (data || []).map((item: any) => ({
        medicine_id: item.medicine_id,
        batch_number: item.batch_number,
        expiry_date: item.expiry_date,
        purchase_id: item.purchase_id,
        medicine_name: item.medicines?.name || 'Unknown'
    }))
    
    return batches
}

/**
 * Delete records from current_inventory table
 */
async function deleteCurrentInventory(supabase: SupabaseClient, batch: ExpiredBatch): Promise<number> {
    const { count, error } = await supabase
        .from('current_inventory')
        .delete({ count: 'exact' })
        .eq('medicine_id', batch.medicine_id)
        .eq('batch_number', batch.batch_number)
        .eq('expiry_date', batch.expiry_date)
    
    if (error) {
        // If table doesn't exist, skip it gracefully
        if (error.code === 'PGRST205' || error.message.includes('Could not find the table')) {
            return 0
        }
        throw new Error(`Error deleting current_inventory: ${error.message}`)
    }
    
    return count || 0
}

/**
 * Delete records from stock_transactions table
 */
async function deleteStockTransactions(supabase: SupabaseClient, batch: ExpiredBatch): Promise<number> {
    const { count, error } = await supabase
        .from('stock_transactions')
        .delete({ count: 'exact' })
        .eq('medicine_id', batch.medicine_id)
        .eq('batch_number', batch.batch_number)
        .eq('expiry_date', batch.expiry_date)
    
    if (error) {
        // If table doesn't exist, skip it gracefully
        if (error.code === 'PGRST205' || error.message.includes('Could not find the table')) {
            return 0
        }
        throw new Error(`Error deleting stock_transactions: ${error.message}`)
    }
    
    return count || 0
}

/**
 * Delete records from purchase_items table
 */
async function deletePurchaseItems(supabase: SupabaseClient, batch: ExpiredBatch): Promise<number> {
    const { count, error } = await supabase
        .from('purchase_items')
        .delete({ count: 'exact' })
        .eq('medicine_id', batch.medicine_id)
        .eq('batch_number', batch.batch_number)
        .eq('expiry_date', batch.expiry_date)
    
    if (error) {
        throw new Error(`Error deleting purchase_items: ${error.message}`)
    }
    
    return count || 0
}

/**
 * Check if a purchase has any remaining items
 */
async function hasRemainingPurchaseItems(supabase: SupabaseClient, purchaseId: string): Promise<boolean> {
    const { count, error } = await supabase
        .from('purchase_items')
        .select('id', { count: 'exact', head: true })
        .eq('purchase_id', purchaseId)
    
    if (error) {
        throw new Error(`Error checking remaining purchase items: ${error.message}`)
    }
    
    return (count || 0) > 0
}

/**
 * Delete orphaned purchase records (purchases with no items)
 */
async function deleteOrphanedPurchase(supabase: SupabaseClient, purchaseId: string): Promise<boolean> {
    const hasItems = await hasRemainingPurchaseItems(supabase, purchaseId)
    
    if (!hasItems) {
        const { error } = await supabase
            .from('purchases')
            .delete()
            .eq('id', purchaseId)
        
        if (error) {
            throw new Error(`Error deleting orphaned purchase: ${error.message}`)
        }
        
        return true
    }
    
    return false
}

/**
 * Updates the last_cleanup_date for the specified pharmacy or all pharmacies
 * @param supabase - Supabase client
 * @param pharmacyId - Optional pharmacy ID. If provided, only updates that pharmacy. If not, updates all.
 */
async function updateLastCleanupDate(supabase: SupabaseClient, pharmacyId?: string): Promise<void> {
    let query = supabase
        .from('pharmacies')
        .update({ last_cleanup_date: new Date().toISOString() })
    
    // If pharmacyId is provided, only update that pharmacy
    if (pharmacyId) {
        query = query.eq('id', pharmacyId)
    } else {
        // Otherwise update all pharmacies (for cron job)
        query = query.neq('id', '00000000-0000-0000-0000-000000000000')
    }
    
    const { error } = await query
    
    if (error) {
        // Log error but don't throw - cleanup was successful even if date update fails
        console.error('Error updating last cleanup date:', error.message)
    }
}

/**
 * Process a single expired batch deletion
 */
async function processBatchDeletion(
    supabase: SupabaseClient,
    batch: ExpiredBatch,
    stats: DeletionStats
): Promise<void> {
    // Step 1: Delete current inventory
    const inventoryDeleted = await deleteCurrentInventory(supabase, batch)
    stats.current_inventory += inventoryDeleted
    
    // Step 2: Delete stock transactions
    const transactionsDeleted = await deleteStockTransactions(supabase, batch)
    stats.stock_transactions += transactionsDeleted
    
    // Step 3: Delete purchase item
    const itemsDeleted = await deletePurchaseItems(supabase, batch)
    stats.purchase_items += itemsDeleted
    
    // Step 4: Check and delete orphaned purchase if needed
    const purchaseDeleted = await deleteOrphanedPurchase(supabase, batch.purchase_id)
    if (purchaseDeleted) {
        stats.purchases += 1
    }
}

/**
 * Main cleanup function - can be called from anywhere
 * @param supabase - Supabase client (should use service role key)
 * @param pharmacyId - Optional pharmacy ID. If provided, only cleans up data for that pharmacy.
 * @returns CleanupResult with statistics
 */
export async function cleanupExpiredMedicines(supabase: SupabaseClient, pharmacyId?: string): Promise<CleanupResult> {
    try {
        // Calculate cutoff date
        const cutoffDate = calculateCutoffDate()
        
        // Fetch expired batches
        const expiredBatches = await fetchExpiredBatches(supabase, cutoffDate)
        
        if (expiredBatches.length === 0) {
            // Update last cleanup date even if nothing was deleted
            await updateLastCleanupDate(supabase, pharmacyId)
            
            return {
                success: true,
                message: 'No expired medicine batches found to delete',
                cutoffDate: formatDate(cutoffDate),
                batchesProcessed: 0,
                stats: {
                    current_inventory: 0,
                    stock_transactions: 0,
                    purchase_items: 0,
                    purchases: 0
                }
            }
        }
        
        // Perform deletions
        const stats: DeletionStats = {
            current_inventory: 0,
            stock_transactions: 0,
            purchase_items: 0,
            purchases: 0
        }
        
        for (const batch of expiredBatches) {
            await processBatchDeletion(supabase, batch, stats)
        }
        
        // Update last cleanup date after successful cleanup
        await updateLastCleanupDate(supabase, pharmacyId)
        
        return {
            success: true,
            message: 'Cleanup completed successfully',
            cutoffDate: formatDate(cutoffDate),
            batchesProcessed: expiredBatches.length,
            stats
        }
        
    } catch (error) {
        return {
            success: false,
            message: 'Cleanup failed',
            cutoffDate: formatDate(calculateCutoffDate()),
            batchesProcessed: 0,
            stats: {
                current_inventory: 0,
                stock_transactions: 0,
                purchase_items: 0,
                purchases: 0
            },
            error: error instanceof Error ? error.message : 'An error occurred during cleanup'
        }
    }
}
