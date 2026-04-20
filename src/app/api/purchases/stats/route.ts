import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/auth/supabase-server'

export async function GET(request: NextRequest) {
    try {
        const { user, supabase } = await getAuthenticatedUser(request)
        
        const { data: userPharmacy } = await supabase
            .from('user_pharmacies')
            .select('pharmacy_id')
            .eq('user_id', user.id)
            .eq('is_active', true)
            .single()

        if (!userPharmacy) {
            return NextResponse.json({
                todaysPurchases: 0,
                thisMonth: 0,
                totalEntries: 0,
                differentSuppliers: 0,
                recentPurchases: []
            })
        }

        const pharmacyId = userPharmacy.pharmacy_id
        const today = new Date().toISOString().split('T')[0]
        const startOfMonth = new Date()
        startOfMonth.setDate(1)
        const startOfMonthString = startOfMonth.toISOString().split('T')[0]

        // Run all queries in parallel
        const [
            todaysPurchasesResult,
            thisMonthPurchasesResult,
            allPurchasesResult,
            recentPurchasesResult,
        ] = await Promise.all([
            // Today's purchases
            supabase
                .from('purchases')
                .select('total_amount, purchase_items(id)')
                .eq('pharmacy_id', pharmacyId)
                .eq('purchase_date', today),

            // This month's purchases
            supabase
                .from('purchases')
                .select('total_amount, purchase_items(id)')
                .eq('pharmacy_id', pharmacyId)
                .gte('purchase_date', startOfMonthString),

            // All purchases (for total entries + unique suppliers count - combined into one query)
            supabase
                .from('purchases')
                .select('id, supplier_id, purchase_items(id)')
                .eq('pharmacy_id', pharmacyId),

            // Recent purchases with details
            supabase
                .from('purchases')
                .select(`
                    id,
                    purchase_date,
                    total_amount,
                    suppliers(name),
                    purchase_items(
                        quantity,
                        free_quantity,
                        mrp,
                        purchase_rate,
                        medicines(name)
                    )
                `)
                .eq('pharmacy_id', pharmacyId)
                .order('created_at', { ascending: false })
                .limit(10),
        ])

        // Process today's purchases
        const todaysPurchasesTotal = todaysPurchasesResult.data
            ?.filter((p: any) => p.purchase_items && p.purchase_items.length > 0)
            ?.reduce((sum: number, p: any) => sum + (p.total_amount || 0), 0) || 0

        // Process this month's purchases
        const thisMonthTotal = thisMonthPurchasesResult.data
            ?.filter((p: any) => p.purchase_items && p.purchase_items.length > 0)
            ?.reduce((sum: number, p: any) => sum + (p.total_amount || 0), 0) || 0

        // Process total entries + unique suppliers from the single combined query
        const purchasesWithItems = allPurchasesResult.data
            ?.filter((p: any) => p.purchase_items && p.purchase_items.length > 0) || []

        const totalEntries = purchasesWithItems.length

        const uniqueSuppliers = new Set(
            purchasesWithItems.map((p: any) => p.supplier_id)
        ).size

        // Process recent purchases
        const formattedRecentPurchases = recentPurchasesResult.data
            ?.filter((purchase: any) => purchase.purchase_items && purchase.purchase_items.length > 0)
            ?.map((purchase: any) => {
                const firstItem = purchase.purchase_items?.[0]
                const totalQuantity = purchase.purchase_items?.reduce((sum: number, item: any) => sum + item.quantity, 0) || 0

                return {
                    id: purchase.id,
                    medicine_name: firstItem?.medicines?.name || 'Multiple Items',
                    supplier: purchase.suppliers?.name || 'Unknown',
                    quantity: totalQuantity,
                    Free: firstItem?.free_quantity || 0,
                    rate: firstItem?.purchase_rate || 0,
                    mrp: firstItem?.mrp || 0,
                    total: purchase.total_amount || 0,
                    purchase_date: purchase.purchase_date,
                    items_count: purchase.purchase_items?.length || 0
                }
            }) || []

        return NextResponse.json({
            todaysPurchases: todaysPurchasesTotal,
            thisMonth: thisMonthTotal,
            totalEntries: totalEntries,
            differentSuppliers: uniqueSuppliers,
            recentPurchases: formattedRecentPurchases
        })

    } catch (error) {
        console.error('Purchases stats error:', error)
        
        if (error instanceof Error && error.message.includes('Authentication')) {
            return NextResponse.json(
                { error: 'Authentication required' },
                { status: 401 }
            )
        }
        
        return NextResponse.json({
            error: 'Failed to fetch purchases stats',
            details: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 })
    }
}
