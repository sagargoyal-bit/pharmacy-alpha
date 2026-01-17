#!/usr/bin/env ts-node
/**
 * Expired Medicine Cleanup Cron Job
 * 
 * This script deletes expired medicine purchase history and stock transactions
 * that are 2+ years old. It should run annually on January 1st at 12:00 PM.
 * 
 * Usage:
 *   npm run dev              # Run in production mode
 *   npm run dry-run          # Preview deletions without committing
 *   DRY_RUN=true npm run dev # Alternative dry-run method
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import { cleanupExpiredMedicines, calculateCutoffDate, formatDate } from '../src/lib/cron/cleanup-logic'

// Load environment variables
dotenv.config()

// Configuration
const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const DRY_RUN = process.env.DRY_RUN === 'true'
const VERBOSE = process.env.VERBOSE === 'true' || true

// Validation
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('❌ Error: Missing required environment variables')
    console.error('Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY')
    process.exit(1)
}

// Create Supabase client with service role key (bypasses RLS)
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

/**
 * Log with timestamp
 */
function log(message: string, level: 'info' | 'success' | 'warning' | 'error' = 'info') {
    const timestamp = new Date().toISOString()
    const prefix = {
        info: 'ℹ️',
        success: '✅',
        warning: '⚠️',
        error: '❌'
    }[level]
    
    console.log(`[${timestamp}] ${prefix} ${message}`)
}


/**
 * Main cleanup function wrapper for CLI
 */
async function runCleanupJob(): Promise<void> {
    const startTime = Date.now()
    
    log('========================================')
    log('Expired Medicine Cleanup Job Started')
    log('========================================')
    log(`Mode: ${DRY_RUN ? 'DRY RUN (Preview Only)' : 'PRODUCTION (Will Delete Data)'}`)
    
    // Calculate cutoff date
    const cutoffDate = calculateCutoffDate()
    log(`Cutoff Date: ${formatDate(cutoffDate)}`)
    log(`Deleting medicines expired before: ${formatDate(cutoffDate)}`)
    
    try {
        if (DRY_RUN) {
            log('=== DRY RUN MODE - No data will be deleted ===', 'warning')
            log('\nTo perform actual deletion, run without DRY_RUN flag', 'warning')
        }
        
        // Call the shared cleanup function
        const result = await cleanupExpiredMedicines(supabase)
        
        if (!result.success) {
            log('Cleanup job failed', 'error')
            log(`Error: ${result.error}`, 'error')
            throw new Error(result.error)
        }
        
        // Display results
        log(`\n${result.message}`)
        log(`Batches processed: ${result.batchesProcessed}`)
        
        // Summary
        log('\n========================================')
        log('Cleanup Completed Successfully', 'success')
        log('========================================')
        log(`Deletion Summary:`)
        log(`  Current Inventory: ${result.stats.current_inventory}`)
        log(`  Stock Transactions: ${result.stats.stock_transactions}`)
        log(`  Purchase Items: ${result.stats.purchase_items}`)
        log(`  Orphaned Purchases: ${result.stats.purchases}`)
        
        const duration = ((Date.now() - startTime) / 1000).toFixed(2)
        log(`\nTotal execution time: ${duration} seconds`)
        
    } catch (error) {
        log('Cleanup job failed', 'error')
        if (error instanceof Error) {
            log(`Error: ${error.message}`, 'error')
        }
        throw error
    }
}

// Run the cleanup job
if (require.main === module) {
    runCleanupJob()
        .then(() => {
            log('Job completed', 'success')
            process.exit(0)
        })
        .catch((error) => {
            log('Job failed with error', 'error')
            console.error(error)
            process.exit(1)
        })
}
