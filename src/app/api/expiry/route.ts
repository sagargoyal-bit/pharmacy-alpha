import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/auth/supabase-server'

export async function GET(request: NextRequest) {
    try {
        const { user, supabase } = await getAuthenticatedUser(request)
        
        const { searchParams } = new URL(request.url)
        const type = searchParams.get('type')
        const days = parseInt(searchParams.get('days') || '90')
        const status = searchParams.get('status')
        const medicineName = searchParams.get('medicine_name')
        const batchNumber = searchParams.get('batch_number')
        const supplierName = searchParams.get('supplier_name')
        const startDate = searchParams.get('start_date')
        const endDate = searchParams.get('end_date')
        const page = parseInt(searchParams.get('page') || '1')
        const limit = parseInt(searchParams.get('limit') || '50')
        const offset = (page - 1) * limit

        const { data: userPharmacy } = await supabase
            .from('user_pharmacies')
            .select('pharmacy_id')
            .eq('user_id', user.id)
            .eq('is_active', true)
            .single()

        if (!userPharmacy) {
            return NextResponse.json(type === 'stats' ? {
                expiredThisWeek: 0,
                expiringIn30Days: 0,
                expiringIn90Days: 0,
                valueAtRisk: 0,
                recentExpiries: []
            } : [])
        }

        const pharmacyId = userPharmacy.pharmacy_id

        if (type === 'stats') {
            const today = new Date()
            const todayStr = today.toISOString().split('T')[0]
            const oneWeekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)
            const in30Days = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000)
            const in90Days = new Date(today.getTime() + 90 * 24 * 60 * 60 * 1000)

            // Run all stats queries in parallel
            // Fetch 90-day range and derive 30-day count from it (superset optimization)
            const [expiredThisWeekResult, expiringIn90Result, recentExpiriesResult] = await Promise.all([
                // Expired items in last week (count only)
                supabase
                    .from('current_inventory')
                    .select('id', { count: 'exact', head: true })
                    .eq('pharmacy_id', pharmacyId)
                    .eq('is_active', true)
                    .gt('current_stock', 0)
                    .gte('expiry_date', oneWeekAgo.toISOString().split('T')[0])
                    .lt('expiry_date', todayStr),

                // Items expiring in next 90 days (need stock + rate for value calculation, and expiry_date for 30-day filter)
                supabase
                    .from('current_inventory')
                    .select('expiry_date, current_stock, last_purchase_rate')
                    .eq('pharmacy_id', pharmacyId)
                    .eq('is_active', true)
                    .gt('current_stock', 0)
                    .gte('expiry_date', todayStr)
                    .lte('expiry_date', in90Days.toISOString().split('T')[0]),

                // Recent expiring items for display
                supabase
                    .from('current_inventory')
                    .select(`
                        id, expiry_date, batch_number, current_stock, current_mrp,
                        medicines!inner(name)
                    `)
                    .eq('pharmacy_id', pharmacyId)
                    .eq('is_active', true)
                    .gt('current_stock', 0)
                    .gte('expiry_date', todayStr)
                    .order('expiry_date', { ascending: true })
                    .limit(10),
            ])

            const expiringIn90Data = expiringIn90Result.data || []
            const in30DaysStr = in30Days.toISOString().split('T')[0]

            // Derive 30-day count from the 90-day superset
            const expiringIn30Count = expiringIn90Data.filter(
                item => item.expiry_date <= in30DaysStr
            ).length

            const valueAtRisk = expiringIn90Data.reduce((total, item) => {
                return total + ((item.current_stock || 0) * (item.last_purchase_rate || 0))
            }, 0)

            const recentExpiries = recentExpiriesResult.data?.map(item => {
                const nowMs = Date.now()
                const expiryMs = new Date(item.expiry_date).getTime()
                const daysToExpiry = Math.ceil((expiryMs - nowMs) / (1000 * 3600 * 24))

                return {
                    id: item.id,
                    medicine_name: (item.medicines as any)?.name || 'Unknown',
                    batch_number: item.batch_number,
                    expiry_date: item.expiry_date,
                    current_stock: item.current_stock || 0,
                    days_to_expiry: daysToExpiry,
                    supplier_name: 'Unknown',
                    mrp: item.current_mrp || 0
                }
            }) || []

            return NextResponse.json({
                expiredThisWeek: expiredThisWeekResult.count || 0,
                expiringIn30Days: expiringIn30Count,
                expiringIn90Days: expiringIn90Data.length,
                valueAtRisk: valueAtRisk,
                recentExpiries: recentExpiries
            })
        }

        // --- List path (non-stats) ---

        const finalLimit = Math.min(limit, 50)
        const finalOffset = offset

        let query = supabase
            .from('current_inventory')
            .select(`
                id, medicine_id, batch_number, expiry_date, current_stock, last_purchase_rate, current_mrp,
                medicines!inner(name)
            `)
            .eq('pharmacy_id', pharmacyId)
            .eq('is_active', true)
            .gt('current_stock', 0)

        if (status) {
            const today = new Date()
            const todayStr = today.toISOString().split('T')[0]

            switch (status.toUpperCase()) {
                case 'EXPIRED':
                    query = query.lte('expiry_date', todayStr)
                    break
                case 'CRITICAL': {
                    const critical = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000)
                    query = query.gt('expiry_date', todayStr).lte('expiry_date', critical.toISOString().split('T')[0])
                    break
                }
                case 'WARNING': {
                    const warning30 = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000)
                    const warning60 = new Date(today.getTime() + 60 * 24 * 60 * 60 * 1000)
                    query = query.gt('expiry_date', warning30.toISOString().split('T')[0]).lte('expiry_date', warning60.toISOString().split('T')[0])
                    break
                }
                case 'ALERT': {
                    const alert60 = new Date(today.getTime() + 60 * 24 * 60 * 60 * 1000)
                    const alert90 = new Date(today.getTime() + 90 * 24 * 60 * 60 * 1000)
                    query = query.gt('expiry_date', alert60.toISOString().split('T')[0]).lte('expiry_date', alert90.toISOString().split('T')[0])
                    break
                }
            }
        }

        if (medicineName) {
            query = query.ilike('medicines.name', `%${medicineName}%`)
        }

        if (batchNumber) {
            query = query.ilike('batch_number', `%${batchNumber}%`)
        }

        if (startDate && endDate) {
            query = query.gte('expiry_date', startDate).lte('expiry_date', endDate)
        } else if (startDate) {
            query = query.gte('expiry_date', startDate)
        } else if (endDate) {
            query = query.lte('expiry_date', endDate)
        }

        const hasSpecificFilters = !!(medicineName || batchNumber || supplierName || startDate || endDate || status)
        const daysParam = searchParams.get('days')

        if (!hasSpecificFilters && daysParam) {
            const today = new Date()
            const futureDate = new Date()
            futureDate.setDate(futureDate.getDate() + days)
            query = query.gte('expiry_date', today.toISOString().split('T')[0])
            query = query.lte('expiry_date', futureDate.toISOString().split('T')[0])
        }

        // When supplierName filter is absent, paginate at DB level for efficiency.
        // When present, we must fetch all rows to do post-query supplier filtering.
        const needsPostQueryFilter = !!supplierName

        let inventoryData: any[] | null = null
        let totalCountFromDB = 0

        if (needsPostQueryFilter) {
            const { data, error } = await query
                .order('expiry_date', { ascending: true })

            if (error) {
                return NextResponse.json(
                    { error: 'Failed to fetch expiry alerts' },
                    { status: 500 }
                )
            }
            inventoryData = data
        } else {
            const { data, error } = await query
                .order('expiry_date', { ascending: true })
                .range(finalOffset, finalOffset + finalLimit - 1)
            
            if (error) {
                return NextResponse.json(
                    { error: 'Failed to fetch expiry alerts' },
                    { status: 500 }
                )
            }
            inventoryData = data

            // Get total count separately for pagination metadata
            const countQuery = supabase
                .from('current_inventory')
                .select('id', { count: 'exact', head: true })
                .eq('pharmacy_id', pharmacyId)
                .eq('is_active', true)
                .gt('current_stock', 0)
            
            const { count } = await countQuery
            totalCountFromDB = count || data?.length || 0
        }

        // Batch supplier lookup
        const supplierMap = new Map<string, string>()

        if (inventoryData && inventoryData.length > 0) {
            const medicineIds = [...new Set(inventoryData.map(item => item.medicine_id))]

            const { data: purchaseItemsData } = await supabase
                .from('purchase_items')
                .select(`
                    medicine_id,
                    batch_number,
                    expiry_date,
                    purchases!inner(
                        suppliers!inner(name)
                    )
                `)
                .in('medicine_id', medicineIds)

            if (purchaseItemsData) {
                for (const purchaseItem of purchaseItemsData) {
                    const key = `${purchaseItem.medicine_id}-${purchaseItem.batch_number}-${purchaseItem.expiry_date}`
                    if (!supplierMap.has(key)) {
                        const purchase = Array.isArray(purchaseItem.purchases) ? purchaseItem.purchases[0] : purchaseItem.purchases
                        const supplier = Array.isArray((purchase as any)?.suppliers) ? (purchase as any).suppliers[0] : (purchase as any)?.suppliers
                        if (supplier?.name) {
                            supplierMap.set(key, supplier.name)
                        }
                    }
                }
            }
        }

        const nowMs = Date.now()
        const transformedData = inventoryData
            ?.map(item => {
                const expiryMs = new Date(item.expiry_date).getTime()
                const daysToExpiry = Math.ceil((expiryMs - nowMs) / (1000 * 3600 * 24))

                let itemStatus = 'NORMAL'
                if (daysToExpiry <= 0) itemStatus = 'EXPIRED'
                else if (daysToExpiry <= 30) itemStatus = 'CRITICAL'
                else if (daysToExpiry <= 60) itemStatus = 'WARNING'
                else if (daysToExpiry <= 90) itemStatus = 'ALERT'

                const key = `${item.medicine_id}-${item.batch_number}-${item.expiry_date}`
                const itemSupplierName = supplierMap.get(key) || 'Unknown'

                return {
                    id: item.id,
                    medicine_name: (item.medicines as any)?.name || 'Unknown',
                    batch_number: item.batch_number,
                    expiry_date: item.expiry_date,
                    current_stock: item.current_stock || 0,
                    days_to_expiry: daysToExpiry,
                    estimated_loss: (item.current_stock || 0) * (item.last_purchase_rate || 0),
                    expiry_status: itemStatus,
                    supplier_name: itemSupplierName,
                    mrp: item.current_mrp || 0,
                    quantity: item.current_stock || 0
                }
            }) || []

        if (needsPostQueryFilter) {
            const filteredData = transformedData.filter(item =>
                item.supplier_name.toLowerCase().includes(supplierName!.toLowerCase())
            )

            const paginatedData = filteredData.slice(finalOffset, finalOffset + finalLimit)
            const totalCount = filteredData.length
            const totalValueAtRisk = filteredData.reduce((total, item) => total + (item.estimated_loss || 0), 0)

            return NextResponse.json({
                data: paginatedData,
                total: totalCount,
                page: page,
                limit: finalLimit,
                totalPages: Math.ceil(totalCount / finalLimit),
                totalValueAtRisk: totalValueAtRisk
            })
        }

        // DB-paginated path: data is already the correct page
        const totalValueAtRisk = transformedData.reduce((total, item) => total + (item.estimated_loss || 0), 0)

        return NextResponse.json({
            data: transformedData,
            total: totalCountFromDB || transformedData.length,
            page: page,
            limit: finalLimit,
            totalPages: Math.ceil((totalCountFromDB || transformedData.length) / finalLimit),
            totalValueAtRisk: totalValueAtRisk
        })
    } catch (error) {
        if (error instanceof Error && error.message.includes('Authentication')) {
            return NextResponse.json(
                { error: 'Authentication required' },
                { status: 401 }
            )
        }
        
        return NextResponse.json(
            { error: 'Failed to fetch expiry data' },
            { status: 500 }
        )
    }
}
