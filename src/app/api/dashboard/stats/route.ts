import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/auth/supabase-server'

export async function GET(request: NextRequest) {
    try {
        const { user, supabase } = await getAuthenticatedUser(request)
        
        const { data: userPharmacy, error: pharmacyError } = await supabase
            .from('user_pharmacies')
            .select('pharmacy_id')
            .eq('user_id', user.id)
            .eq('is_active', true)
            .single()

        if (pharmacyError || !userPharmacy) {
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
            })
        }

        const pharmacyId = userPharmacy.pharmacy_id

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

        const thirtyDaysFromNow = new Date()
        thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30)
        const expiryDateStr = thirtyDaysFromNow.toISOString().split('T')[0]

        const [
            currentMedicinesResult,
            todaysPurchasesResult,
            yesterdaysPurchasesResult,
            currentExpiringResult,
            historicalExpiryResult,
            currentStockResult,
            // Combines old "lastMonthMedicines" + "lastMonthStockData" into one query
            lastMonthTransactionsResult,
            recentPurchasesResult,
            recentTransactionsResult,
        ] = await Promise.all([
            // 1. Current medicines count (count only, no rows transferred)
            supabase
                .from('current_inventory')
                .select('id', { count: 'exact', head: true })
                .eq('pharmacy_id', pharmacyId)
                .gt('current_stock', 0),

            // 2. Today's purchases totals
            supabase
                .from('purchases')
                .select('total_amount')
                .eq('pharmacy_id', pharmacyId)
                .eq('purchase_date', todayStr),

            // 3. Yesterday's purchases totals
            supabase
                .from('purchases')
                .select('total_amount')
                .eq('pharmacy_id', pharmacyId)
                .eq('purchase_date', yesterdayStr),

            // 4. Expiring soon count (count only)
            supabase
                .from('current_inventory')
                .select('id', { count: 'exact', head: true })
                .eq('pharmacy_id', pharmacyId)
                .lte('expiry_date', expiryDateStr)
                .gt('current_stock', 0),

            // 5. Historical expiry count (count only)
            supabase
                .from('stock_transactions')
                .select('id', { count: 'exact', head: true })
                .eq('pharmacy_id', pharmacyId)
                .eq('transaction_date', thirtyDaysAgoStr)
                .lte('expiry_date', expiryDateStr),

            // 6. Current stock value (need rows to sum)
            supabase
                .from('current_inventory')
                .select('current_stock, last_purchase_rate')
                .eq('pharmacy_id', pharmacyId)
                .gt('current_stock', 0),

            // 7. Last month transactions (merged: medicine count + stock value from same date range)
            supabase
                .from('stock_transactions')
                .select('medicine_id, quantity_in, rate')
                .eq('pharmacy_id', pharmacyId)
                .gte('created_at', lastMonthStr)
                .lt('created_at', todayStr),

            // 8. Recent purchases for activity feed
            supabase
                .from('purchases')
                .select(`
                    id, created_at,
                    suppliers!inner(name),
                    purchase_items!inner(quantity, medicines!inner(name))
                `)
                .eq('pharmacy_id', pharmacyId)
                .order('created_at', { ascending: false })
                .limit(3),

            // 9. Recent stock transactions for activity feed
            supabase
                .from('stock_transactions')
                .select('id, transaction_type, quantity_in, created_at, medicines!inner(name)')
                .eq('pharmacy_id', pharmacyId)
                .order('created_at', { ascending: false })
                .limit(2),
        ])

        // 1. Total medicines
        const currentMedicinesCount = currentMedicinesResult.count || 0
        const lastMonthTxns = lastMonthTransactionsResult.data || []
        const lastMonthMedicinesCount = lastMonthTxns.length
        const medicinesChange = lastMonthMedicinesCount > 0 
            ? ((currentMedicinesCount - lastMonthMedicinesCount) / lastMonthMedicinesCount * 100)
            : 0

        // 2. Today's purchases
        const todaysPurchasesTotal = todaysPurchasesResult.data?.reduce((s: number, p: any) => s + (p.total_amount || 0), 0) || 0
        const yesterdaysPurchasesTotal = yesterdaysPurchasesResult.data?.reduce((s: number, p: any) => s + (p.total_amount || 0), 0) || 0
        const purchasesChange = yesterdaysPurchasesTotal > 0 
            ? ((todaysPurchasesTotal - yesterdaysPurchasesTotal) / yesterdaysPurchasesTotal * 100)
            : todaysPurchasesTotal > 0 ? 100 : 0

        // 3. Expiring soon
        const currentExpiringCount = currentExpiringResult.count || 0
        const historicalExpiringCount = historicalExpiryResult.count || 0
        const expiryChange = historicalExpiringCount > 0 
            ? ((currentExpiringCount - historicalExpiringCount) / historicalExpiringCount * 100)
            : currentExpiringCount > 0 ? 100 : 0

        // 4. Stock value (current from inventory rows, last month from the merged transactions query)
        const currentStockValue = currentStockResult.data?.reduce((s: number, i: any) => s + (i.current_stock * (i.last_purchase_rate || 0)), 0) || 0
        const lastMonthStockValue = lastMonthTxns.reduce((s: number, i: any) => s + ((i.quantity_in || 0) * (i.rate || 0)), 0)
        const stockChange = lastMonthStockValue > 0 
            ? ((currentStockValue - lastMonthStockValue) / lastMonthStockValue * 100)
            : currentStockValue > 0 ? 100 : 0

        // Helper to compute trend string
        const trend = (change: number) => change > 0 ? 'up' : change < 0 ? 'down' : 'neutral'

        // 5. Recent activity
        const recentActivity: Array<{ id: string; action: string; time: string; type: 'purchase' | 'inventory' }> = []

        recentPurchasesResult.data?.forEach((p: any) => {
            const qty = p.purchase_items?.reduce((s: number, i: any) => s + i.quantity, 0) || 0
            const med = p.purchase_items?.[0]?.medicines?.name || 'items'
            recentActivity.push({
                id: `purchase-${p.id}`,
                action: `${med} purchased (${qty} units) from ${p.suppliers?.name || 'Unknown Supplier'}`,
                time: getRelativeTime(p.created_at),
                type: 'purchase'
            })
        })

        recentTransactionsResult.data?.forEach((t: any) => {
            recentActivity.push({
                id: `transaction-${t.id}`,
                action: `${t.medicines?.name} stock ${t.transaction_type} (${t.quantity_in} units)`,
                time: getRelativeTime(t.created_at),
                type: 'inventory'
            })
        })

        recentActivity.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())

        return NextResponse.json({
            total_medicines: currentMedicinesCount,
            total_medicines_change: Math.round(medicinesChange * 100) / 100,
            total_medicines_trend: trend(medicinesChange),
            todays_purchases: Math.round(todaysPurchasesTotal),
            todays_purchases_change: Math.round(purchasesChange * 100) / 100,
            todays_purchases_trend: trend(purchasesChange),
            expiring_soon: currentExpiringCount,
            expiring_soon_change: Math.round(expiryChange * 100) / 100,
            expiring_soon_trend: trend(expiryChange),
            stock_value: Math.round(currentStockValue),
            stock_value_change: Math.round(stockChange * 100) / 100,
            stock_value_trend: trend(stockChange),
            recent_activity: recentActivity.slice(0, 5),
        })
    } catch (error) {
        console.error('Dashboard stats error:', error)
        
        if (error instanceof Error && error.message.includes('Authentication')) {
            return NextResponse.json(
                { error: 'Authentication required' },
                { status: 401 }
            )
        }
        
        return NextResponse.json(
            { error: 'Failed to fetch dashboard stats' },
            { status: 500 }
        )
    }
}

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
