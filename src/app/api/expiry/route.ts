import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/auth/supabase-server'

export async function GET(request: NextRequest) {
    try {
        // Get authenticated user and supabase client
        const { user, supabase } = await getAuthenticatedUser(request)
        
        const { searchParams } = new URL(request.url)
        const type = searchParams.get('type') // 'stats' for statistics endpoint
        const days = parseInt(searchParams.get('days') || '90')
        const status = searchParams.get('status') // 'expired', 'critical', 'warning', 'alert'
        const medicineName = searchParams.get('medicine_name')
        const batchNumber = searchParams.get('batch_number')
        const supplierName = searchParams.get('supplier_name')
        const startDate = searchParams.get('start_date') // Date range start
        const endDate = searchParams.get('end_date') // Date range end
        const page = parseInt(searchParams.get('page') || '1')
        const limit = parseInt(searchParams.get('limit') || '50')
        const offset = (page - 1) * limit

        // Get user's pharmacy ID
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

        // If requesting stats, calculate expiry statistics
        if (type === 'stats') {
            const today = new Date()
            const oneWeekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)
            const in30Days = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000)
            const in90Days = new Date(today.getTime() + 90 * 24 * 60 * 60 * 1000)

            // Get expired items in the last week
            const { data: expiredThisWeek } = await supabase
                .from('current_inventory')
                .select('*')
                .eq('pharmacy_id', userPharmacy.pharmacy_id)
                .eq('is_active', true)
                .gt('current_stock', 0)
                .gte('expiry_date', oneWeekAgo.toISOString().split('T')[0])
                .lt('expiry_date', today.toISOString().split('T')[0])

            // Get items expiring in next 30 days
            const { data: expiringIn30 } = await supabase
                .from('current_inventory')
                .select('*')
                .eq('pharmacy_id', userPharmacy.pharmacy_id)
                .eq('is_active', true)
                .gt('current_stock', 0)
                .gte('expiry_date', today.toISOString().split('T')[0])
                .lte('expiry_date', in30Days.toISOString().split('T')[0])

            // Get items expiring in next 90 days
            const { data: expiringIn90 } = await supabase
                .from('current_inventory')
                .select('*')
                .eq('pharmacy_id', userPharmacy.pharmacy_id)
                .eq('is_active', true)
                .gt('current_stock', 0)
                .gte('expiry_date', today.toISOString().split('T')[0])
                .lte('expiry_date', in90Days.toISOString().split('T')[0])

            // Calculate value at risk (total value of items expiring in next 90 days)
            const valueAtRisk = expiringIn90?.reduce((total, item) => {
                const itemValue = (item.current_stock || 0) * (item.last_purchase_rate || 0)
                return total + itemValue
            }, 0) || 0

            // Get recent expiring items for the "Expiring Soon" section
            const { data: recentExpiriesData } = await supabase
                .from('current_inventory')
                .select(`
                    *,
                    medicines!inner(name)
                `)
                .eq('pharmacy_id', userPharmacy.pharmacy_id)
                .eq('is_active', true)
                .gt('current_stock', 0)
                .gte('expiry_date', today.toISOString().split('T')[0])
                .order('expiry_date', { ascending: true })
                .limit(10)

            // Transform recent expiries data (without supplier info for stats)
            const recentExpiries = recentExpiriesData?.map(item => {
                const today = new Date()
                const expiryDate = new Date(item.expiry_date)
                const timeDiff = expiryDate.getTime() - today.getTime()
                const daysToExpiry = Math.ceil(timeDiff / (1000 * 3600 * 24))

                return {
                    id: item.id,
                    medicine_name: item.medicines?.name || 'Unknown',
                    batch_number: item.batch_number,
                    expiry_date: item.expiry_date,
                    current_stock: item.current_stock || 0,
                    days_to_expiry: daysToExpiry,
                    supplier_name: 'Unknown', // Simplified for stats
                    mrp: item.current_mrp || 0
                }
            }) || []

            console.log('📊 Expiry stats:', {
                expiredThisWeek: expiredThisWeek?.length || 0,
                expiringIn30Days: expiringIn30?.length || 0,
                expiringIn90Days: expiringIn90?.length || 0,
                valueAtRisk: valueAtRisk,
                recentExpiriesCount: recentExpiries?.length || 0
            })

            return NextResponse.json({
                expiredThisWeek: expiredThisWeek?.length || 0,
                expiringIn30Days: expiringIn30?.length || 0,
                expiringIn90Days: expiringIn90?.length || 0,
                valueAtRisk: valueAtRisk,
                recentExpiries: recentExpiries || []
            })
        }

        // Original functionality for getting expiry alerts
        // Default to next 90 days if no date filters are provided
        const defaultLimit = 10
        const actualLimit = Math.min(limit, 50) // Cap at 50 for performance

        let query = supabase
            .from('current_inventory')
            .select(`
                *,
                medicines!inner(name)
            `)
            .eq('pharmacy_id', userPharmacy.pharmacy_id)
            .eq('is_active', true)
            .gt('current_stock', 0)

        // Add status filter based on expiry dates
        if (status) {
            const today = new Date()
            const todayStr = today.toISOString().split('T')[0]

            switch (status.toUpperCase()) {
                case 'EXPIRED':
                    query = query.lte('expiry_date', todayStr)
                    break
                case 'CRITICAL':
                    const critical = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000)
                    query = query.gt('expiry_date', todayStr).lte('expiry_date', critical.toISOString().split('T')[0])
                    break
                case 'WARNING':
                    const warning30 = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000)
                    const warning60 = new Date(today.getTime() + 60 * 24 * 60 * 60 * 1000)
                    query = query.gt('expiry_date', warning30.toISOString().split('T')[0]).lte('expiry_date', warning60.toISOString().split('T')[0])
                    break
                case 'ALERT':
                    const alert60 = new Date(today.getTime() + 60 * 24 * 60 * 60 * 1000)
                    const alert90 = new Date(today.getTime() + 90 * 24 * 60 * 60 * 1000)
                    query = query.gt('expiry_date', alert60.toISOString().split('T')[0]).lte('expiry_date', alert90.toISOString().split('T')[0])
                    break
            }
        }

        // Add medicine name filter (partial match)
        if (medicineName) {
            query = query.ilike('medicines.name', `%${medicineName}%`)
        }

        // Add batch number filter (partial match)
        if (batchNumber) {
            query = query.ilike('batch_number', `%${batchNumber}%`)
        }

        // Add specific expiry date filter (overrides default 90 days)
        if (startDate && endDate) {
            query = query.gte('expiry_date', startDate)
            query = query.lte('expiry_date', endDate)
        } else if (startDate) {
            query = query.gte('expiry_date', startDate)
        } else if (endDate) {
            query = query.lte('expiry_date', endDate)
        }

        // Add days filter - only if no specific filters are provided and days param is explicitly sent
        const hasSpecificFilters = !!(medicineName || batchNumber || supplierName || startDate || endDate || status)
        const daysParam = searchParams.get('days') // Check if days was explicitly provided

        if (!hasSpecificFilters && daysParam) {
            const today = new Date()
            const futureDate = new Date()
            futureDate.setDate(futureDate.getDate() + days)

            // Apply date range based on days parameter (only for initial load)
            query = query.gte('expiry_date', today.toISOString().split('T')[0])
            query = query.lte('expiry_date', futureDate.toISOString().split('T')[0])
        }

        // Always use provided pagination parameters
        const finalLimit = Math.min(limit, 50) // Cap at 50 for performance
        const finalOffset = offset

        // Get all data without pagination first
        const { data: inventoryData, error } = await query
            .order('expiry_date', { ascending: true })

        if (error) {
            console.error('Expiry alerts fetch error:', error)
            return NextResponse.json(
                { error: 'Failed to fetch expiry alerts' },
                { status: 500 }
            )
        }

        // Get supplier information for all inventory items
        const supplierMap = new Map()

        if (inventoryData && inventoryData.length > 0) {
            // Create exact matching conditions for each inventory item
            const conditions = inventoryData.map(item => ({
                medicine_id: item.medicine_id,
                batch_number: item.batch_number,
                expiry_date: item.expiry_date
            }))

            // Fetch purchase items that exactly match our inventory conditions
            for (const condition of conditions) {
                const { data: matchingPurchaseItems, error: purchaseError } = await supabase
                    .from('purchase_items')
                    .select(`
                        medicine_id,
                        batch_number,
                        expiry_date,
                        purchases!inner(
                            supplier_id,
                            suppliers!inner(name)
                        )
                    `)
                    .eq('medicine_id', condition.medicine_id)
                    .eq('batch_number', condition.batch_number)
                    .eq('expiry_date', condition.expiry_date)
                    .order('created_at', { ascending: false })
                    .limit(1)

                if (purchaseError) {
                    continue
                }

                const key = `${condition.medicine_id}-${condition.batch_number}-${condition.expiry_date}`

                if (matchingPurchaseItems && matchingPurchaseItems.length > 0) {
                    const purchaseItem = matchingPurchaseItems[0]
                    // Handle array structure correctly
                    const purchase = Array.isArray(purchaseItem.purchases) ? purchaseItem.purchases[0] : purchaseItem.purchases
                    const supplier = Array.isArray(purchase?.suppliers) ? purchase.suppliers[0] : purchase?.suppliers

                    if (supplier?.name) {
                        supplierMap.set(key, supplier.name)
                    }
                }
            }


        }

        // Transform the data to match the expected format and apply supplier filter
        const transformedData = inventoryData
            ?.map(item => {
                // Calculate days to expiry
                const today = new Date()
                const expiryDate = new Date(item.expiry_date)
                const timeDiff = expiryDate.getTime() - today.getTime()
                const daysToExpiry = Math.ceil(timeDiff / (1000 * 3600 * 24))

                // Calculate status
                let status = 'NORMAL'
                if (daysToExpiry <= 0) status = 'EXPIRED'
                else if (daysToExpiry <= 30) status = 'CRITICAL'
                else if (daysToExpiry <= 60) status = 'WARNING'
                else if (daysToExpiry <= 90) status = 'ALERT'

                // Get supplier name from our supplier map
                const key = `${item.medicine_id}-${item.batch_number}-${item.expiry_date}`
                const supplierName = supplierMap.get(key) || 'Unknown'

                return {
                    id: item.id,
                    medicine_name: item.medicines?.name || 'Unknown',
                    batch_number: item.batch_number,
                    expiry_date: item.expiry_date,
                    current_stock: item.current_stock || 0,
                    days_to_expiry: daysToExpiry,
                    estimated_loss: (item.current_stock || 0) * (item.last_purchase_rate || 0),
                    expiry_status: status,
                    supplier_name: supplierName,
                    mrp: item.current_mrp || 0,
                    quantity: item.current_stock || 0
                }
            }) || []

        // Get total count before applying supplier filter
        const totalBeforeSupplierFilter = transformedData.length

        // Apply supplier name filter (if any)
        const finalData = transformedData?.filter(item => {
            if (supplierName) {
                return item.supplier_name.toLowerCase().includes(supplierName.toLowerCase())
            }
            return true
        }) || []

        // Since supplier filter is applied after database query, we need to recalculate pagination
        const paginatedData = finalData.slice(finalOffset, finalOffset + finalLimit)
        const totalCount = finalData.length

        // Calculate Value at Risk for ALL filtered results (not just current page)
        const totalValueAtRisk = finalData.reduce((total, item) => {
            return total + (item.estimated_loss || 0)
        }, 0)

        console.log('📋 Expiry alerts:', {
            totalFound: totalCount,
            currentPage: page,
            itemsPerPage: finalLimit,
            totalValueAtRisk: totalValueAtRisk,
            filters: { medicineName, batchNumber, supplierName, startDate, endDate, days },
            sampleSuppliers: paginatedData.slice(0, 3).map(item => item.supplier_name)
        })

        return NextResponse.json({
            data: paginatedData,
            total: totalCount,
            page: page,
            limit: finalLimit,
            totalPages: Math.ceil(totalCount / finalLimit),
            totalValueAtRisk: totalValueAtRisk
        })
    } catch (error) {
        console.error('API error:', error)
        
        // Handle authentication errors
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