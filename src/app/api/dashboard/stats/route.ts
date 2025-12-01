import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET() {
    try {
        console.log('Fetching dashboard stats...')
        
        // Get the first pharmacy (assuming single pharmacy setup for now)
        const { data: pharmacy, error: pharmacyError } = await supabase
            .from('pharmacies')
            .select('id, name')
            .limit(1)
            .single()

        console.log('Pharmacy query result:', { pharmacy, pharmacyError })

        if (pharmacyError || !pharmacy) {
            console.warn('No pharmacy found or error:', pharmacyError)
            
            // Return zero stats but with debug info
            return NextResponse.json({
                total_medicines: 0,
                total_medicines_change: 0,
                total_medicines_trend: 'neutral',
                todays_purchases: 0,
                todays_purchases_change: 0,
                todays_purchases_trend: 'neutral',
                expiring_soon: 0,
                expiring_soon_change: 0,
                expiring_soon_trend: 'neutral',
                stock_value: 0,
                stock_value_change: 0,
                stock_value_trend: 'neutral',
                recent_activity: [],
                debug: {
                    pharmacy_error: pharmacyError?.message || 'No pharmacy found',
                    timestamp: new Date().toISOString()
                }
            })
        }

        console.log('Found pharmacy:', pharmacy.name, 'ID:', pharmacy.id)

        // Get current date and calculate comparison dates
        const today = new Date()
        const todayStr = today.toISOString().split('T')[0]
        const yesterday = new Date(today)
        yesterday.setDate(yesterday.getDate() - 1)
        const yesterdayStr = yesterday.toISOString().split('T')[0]
        
        const lastMonth = new Date(today)
        lastMonth.setMonth(lastMonth.getMonth() - 1)
        const lastMonthStr = lastMonth.toISOString().split('T')[0]
        
        const thirtyDaysAgo = new Date(today)
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
        const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split('T')[0]

        // 1. TOTAL MEDICINES - Current vs Last Month
        const { data: currentMedicines, error: medicinesError } = await supabase
            .from('current_inventory')
            .select('medicine_id', { count: 'exact' })
            .eq('pharmacy_id', pharmacy.id)
            .gt('current_stock', 0)

        const { data: lastMonthMedicines, error: lastMonthMedicinesError } = await supabase
            .from('stock_transactions')
            .select('medicine_id', { count: 'exact' })
            .eq('pharmacy_id', pharmacy.id)
            .gte('created_at', lastMonthStr)
            .lt('created_at', todayStr)

        const currentMedicinesCount = currentMedicines?.length || 0
        const lastMonthMedicinesCount = lastMonthMedicines?.length || 0
        const medicinesChange = lastMonthMedicinesCount > 0 
            ? ((currentMedicinesCount - lastMonthMedicinesCount) / lastMonthMedicinesCount * 100)
            : 0
        const medicinesTrend = medicinesChange > 0 ? 'up' : medicinesChange < 0 ? 'down' : 'neutral'

        console.log('Medicines count query:', { 
            current: currentMedicinesCount, 
            lastMonth: lastMonthMedicinesCount,
            change: medicinesChange,
            error: medicinesError 
        })

        // 2. TODAY'S PURCHASES - Today vs Yesterday
        const { data: todaysPurchases, error: purchasesError } = await supabase
            .from('purchases')
            .select('total_amount')
            .eq('pharmacy_id', pharmacy.id)
            .eq('purchase_date', todayStr)

        const { data: yesterdaysPurchases, error: yesterdaysPurchasesError } = await supabase
            .from('purchases')
            .select('total_amount')
            .eq('pharmacy_id', pharmacy.id)
            .eq('purchase_date', yesterdayStr)

        const todaysPurchasesTotal = todaysPurchases?.reduce((sum: number, p: any) => sum + (p.total_amount || 0), 0) || 0
        const yesterdaysPurchasesTotal = yesterdaysPurchases?.reduce((sum: number, p: any) => sum + (p.total_amount || 0), 0) || 0
        
        const purchasesChange = yesterdaysPurchasesTotal > 0 
            ? ((todaysPurchasesTotal - yesterdaysPurchasesTotal) / yesterdaysPurchasesTotal * 100)
            : todaysPurchasesTotal > 0 ? 100 : 0
        const purchasesTrend = purchasesChange > 0 ? 'up' : purchasesChange < 0 ? 'down' : 'neutral'

        console.log('Purchases query:', { 
            today: todaysPurchasesTotal, 
            yesterday: yesterdaysPurchasesTotal,
            change: purchasesChange,
            error: purchasesError 
        })

        // 3. EXPIRING SOON - Current vs 30 days ago
        const thirtyDaysFromNow = new Date()
        thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30)
        const expiryDate = thirtyDaysFromNow.toISOString().split('T')[0]

        const { count: currentExpiringCount, error: expiryError } = await supabase
            .from('current_inventory')
            .select('*', { count: 'exact' })
            .eq('pharmacy_id', pharmacy.id)
            .lte('expiry_date', expiryDate)
            .gt('current_stock', 0)

        // Get historical expiry count from 30 days ago
        const { data: historicalInventory, error: historicalExpiryError } = await supabase
            .from('stock_transactions')
            .select('medicine_id, expiry_date', { count: 'exact' })
            .eq('pharmacy_id', pharmacy.id)
            .eq('transaction_date', thirtyDaysAgoStr)
            .lte('expiry_date', expiryDate)

        const historicalExpiringCount = historicalInventory?.length || 0
        const currentExpiringCountSafe = currentExpiringCount || 0
        const expiryChange = historicalExpiringCount > 0 
            ? ((currentExpiringCountSafe - historicalExpiringCount) / historicalExpiringCount * 100)
            : currentExpiringCountSafe > 0 ? 100 : 0
        const expiryTrend = expiryChange > 0 ? 'up' : expiryChange < 0 ? 'down' : 'neutral'

        console.log('Expiring medicines query:', { 
            current: currentExpiringCountSafe, 
            historical: historicalExpiringCount,
            change: expiryChange,
            error: expiryError 
        })

        // 4. STOCK VALUE - Current vs Last Month
        const { data: currentStockValue, error: stockError } = await supabase
            .from('current_inventory')
            .select('current_stock, last_purchase_rate')
            .eq('pharmacy_id', pharmacy.id)
            .gt('current_stock', 0)

        const currentTotalStockValue = currentStockValue?.reduce((sum: number, item: any) => {
            return sum + (item.current_stock * (item.last_purchase_rate || 0))
        }, 0) || 0

        // Calculate last month's stock value from historical data
        const { data: lastMonthStockData, error: lastMonthStockError } = await supabase
            .from('stock_transactions')
            .select('quantity_in, rate')
            .eq('pharmacy_id', pharmacy.id)
            .gte('created_at', lastMonthStr)
            .lt('created_at', todayStr)

        const lastMonthStockValue = lastMonthStockData?.reduce((sum: number, item: any) => {
            return sum + ((item.quantity_in || 0) * (item.rate || 0))
        }, 0) || 0

        const stockValueChange = lastMonthStockValue > 0 
            ? ((currentTotalStockValue - lastMonthStockValue) / lastMonthStockValue * 100)
            : currentTotalStockValue > 0 ? 100 : 0
        const stockValueTrend = stockValueChange > 0 ? 'up' : stockValueChange < 0 ? 'down' : 'neutral'

        console.log('Stock value query:', { 
            current: currentTotalStockValue, 
            lastMonth: lastMonthStockValue,
            change: stockValueChange,
            error: stockError 
        })

        // Get recent activity
        const recentActivity: Array<{
            id: string
            action: string
            time: string
            type: 'purchase' | 'inventory'
        }> = []

        // Recent purchases
        const { data: recentPurchases, error: recentPurchasesError } = await supabase
            .from('purchases')
            .select(`
                id,
                invoice_number,
                created_at,
                suppliers!inner(name),
                purchase_items!inner(
                    quantity,
                    medicines!inner(name)
                )
            `)
            .eq('pharmacy_id', pharmacy.id)
            .order('created_at', { ascending: false })
            .limit(3)

        console.log('Recent purchases query:', { data: recentPurchases?.length, error: recentPurchasesError })

        recentPurchases?.forEach((purchase: any) => {
            const itemsCount = purchase.purchase_items?.reduce((sum: number, item: any) => sum + item.quantity, 0) || 0
            const firstMedicine = purchase.purchase_items?.[0]?.medicines?.name || 'items'

            recentActivity.push({
                id: `purchase-${purchase.id}`,
                action: `${firstMedicine} purchased (${itemsCount} units) from ${purchase.suppliers?.name || 'Unknown Supplier'}`,
                time: getRelativeTime(purchase.created_at),
                type: 'purchase'
            })
        })

        // Recent stock transactions
        const { data: recentTransactions, error: transactionsError } = await supabase
            .from('stock_transactions')
            .select(`
                id,
                transaction_type,
                quantity_in,
                created_at,
                medicines!inner(name)
            `)
            .eq('pharmacy_id', pharmacy.id)
            .order('created_at', { ascending: false })
            .limit(2)

        console.log('Recent transactions query:', { data: recentTransactions?.length, error: transactionsError })

        recentTransactions?.forEach((transaction: any) => {
            recentActivity.push({
                id: `transaction-${transaction.id}`,
                action: `${transaction.medicines?.name} stock ${transaction.transaction_type} (${transaction.quantity_in} units)`,
                time: getRelativeTime(transaction.created_at),
                type: 'inventory'
            })
        })

        // Sort activity by time and limit to 5
        recentActivity.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())

        const stats = {
            total_medicines: currentMedicinesCount,
            total_medicines_change: Math.round(medicinesChange * 100) / 100,
            total_medicines_trend: medicinesTrend,
            todays_purchases: Math.round(todaysPurchasesTotal),
            todays_purchases_change: Math.round(purchasesChange * 100) / 100,
            todays_purchases_trend: purchasesTrend,
            expiring_soon: currentExpiringCountSafe,
            expiring_soon_change: Math.round(expiryChange * 100) / 100,
            expiring_soon_trend: expiryTrend,
            stock_value: Math.round(currentTotalStockValue),
            stock_value_change: Math.round(stockValueChange * 100) / 100,
            stock_value_trend: stockValueTrend,
            recent_activity: recentActivity.slice(0, 5),
            debug: {
                pharmacy: pharmacy.name,
                comparison_dates: {
                    today: todayStr,
                    yesterday: yesterdayStr,
                    last_month: lastMonthStr,
                    thirty_days_ago: thirtyDaysAgoStr
                },
                queries: {
                    medicines: { success: !medicinesError, error: medicinesError?.message },
                    purchases: { success: !purchasesError, error: purchasesError?.message },
                    expiry: { success: !expiryError, error: expiryError?.message },
                    stock: { success: !stockError, error: stockError?.message }
                },
                timestamp: new Date().toISOString()
            }
        }

        console.log('Final stats:', stats)

        return NextResponse.json(stats)
    } catch (error) {
        console.error('Dashboard stats error:', error)
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        const errorName = error instanceof Error ? error.name : 'UnknownError'
        
        return NextResponse.json(
            { 
                error: 'Failed to fetch dashboard stats',
                message: errorMessage,
                debug: {
                    error_type: errorName,
                    timestamp: new Date().toISOString()
                }
            },
            { status: 500 }
        )
    }
}

// Helper function to get relative time
function getRelativeTime(dateString: string): string {
    const date = new Date(dateString)
    const now = new Date()
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60))

    if (diffInMinutes < 1) return 'Just now'
    if (diffInMinutes < 60) return `${diffInMinutes} minute${diffInMinutes > 1 ? 's' : ''} ago`

    const diffInHours = Math.floor(diffInMinutes / 60)
    if (diffInHours < 24) return `${diffInHours} hour${diffInHours > 1 ? 's' : ''} ago`

    const diffInDays = Math.floor(diffInHours / 24)
    return `${diffInDays} day${diffInDays > 1 ? 's' : ''} ago`
} 