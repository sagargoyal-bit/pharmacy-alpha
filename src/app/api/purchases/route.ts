import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { getAuthenticatedUser } from '@/lib/auth/supabase-server'

function convertFreeToInteger(freeValue: any): number {
    if (!freeValue) return 0
    if (typeof freeValue === 'number') return Math.floor(freeValue)
    if (typeof freeValue === 'string') {
        const numericValue = freeValue.replace(/[^\d.]/g, '')
        const parsed = parseFloat(numericValue)
        return isNaN(parsed) ? 0 : Math.floor(parsed)
    }
    return 0
}

async function checkMedicineReferences(supabaseClient: any, medicine_id: string): Promise<boolean> {
    try {
        const [purchaseResult, inventoryResult, transactionResult] = await Promise.all([
            supabaseClient.from('purchase_items').select('id').eq('medicine_id', medicine_id).limit(1),
            supabaseClient.from('current_inventory').select('id').eq('medicine_id', medicine_id).limit(1),
            supabaseClient.from('stock_transactions').select('id').eq('medicine_id', medicine_id).limit(1),
        ])

        if (purchaseResult.error || inventoryResult.error || transactionResult.error) {
            return true
        }

        return (
            (purchaseResult.data?.length || 0) > 0 ||
            (inventoryResult.data?.length || 0) > 0 ||
            (transactionResult.data?.length || 0) > 0
        )
    } catch {
        return true
    }
}

async function cascadeDeleteFromRelatedTables(
    supabaseClient: any,
    itemToDelete: any
) {
    const { medicine_id, batch_number, expiry_date } = itemToDelete

    // Run both deletes in parallel
    await Promise.all([
        supabaseClient
            .from('current_inventory')
            .delete()
            .eq('medicine_id', medicine_id)
            .eq('batch_number', batch_number)
            .eq('expiry_date', expiry_date),
        supabaseClient
            .from('stock_transactions')
            .delete()
            .eq('medicine_id', medicine_id)
            .eq('batch_number', batch_number)
            .eq('expiry_date', expiry_date),
    ])

    const isStillReferenced = await checkMedicineReferences(supabaseClient, medicine_id)

    if (!isStillReferenced) {
        await supabaseClient
            .from('medicines')
            .delete()
            .eq('id', medicine_id)
    }
}

async function cascadeUpdatesToRelatedTables(
    supabaseClient: any,
    currentItem: any,
    updateFields: any,
    updatedPurchaseItem: any
) {
    const { medicine_id, batch_number: oldBatchNumber, expiry_date: oldExpiryDate } = currentItem
    const newBatchNumber = updateFields.batch_number ?? oldBatchNumber
    const newExpiryDate = updateFields.expiry_date ?? oldExpiryDate

    const inventoryUpdateFields: any = {}
    let shouldUpdateInventory = false
    if (updateFields.batch_number) { inventoryUpdateFields.batch_number = newBatchNumber; shouldUpdateInventory = true }
    if (updateFields.expiry_date) { inventoryUpdateFields.expiry_date = newExpiryDate; shouldUpdateInventory = true }
    if (updateFields.quantity) { inventoryUpdateFields.current_stock = updateFields.quantity; shouldUpdateInventory = true }
    if (updateFields.purchase_rate) { inventoryUpdateFields.last_purchase_rate = updateFields.purchase_rate; shouldUpdateInventory = true }
    if (updateFields.mrp) { inventoryUpdateFields.current_mrp = updateFields.mrp; shouldUpdateInventory = true }

    const transactionUpdateFields: any = {}
    let shouldUpdateTransactions = false
    if (updateFields.batch_number) { transactionUpdateFields.batch_number = newBatchNumber; shouldUpdateTransactions = true }
    if (updateFields.expiry_date) { transactionUpdateFields.expiry_date = newExpiryDate; shouldUpdateTransactions = true }
    if (updateFields.quantity) { transactionUpdateFields.quantity_in = updateFields.quantity; shouldUpdateTransactions = true }
    if (updateFields.purchase_rate) { transactionUpdateFields.rate = updateFields.purchase_rate; shouldUpdateTransactions = true }
    if (updateFields.quantity || updateFields.purchase_rate) {
        const quantity = updateFields.quantity || currentItem.quantity
        const rate = updateFields.purchase_rate || currentItem.purchase_rate
        transactionUpdateFields.amount = quantity * rate
        shouldUpdateTransactions = true
    }

    // Run inventory + transaction updates in parallel
    const parallelOps: Promise<any>[] = []
    if (shouldUpdateInventory) {
        parallelOps.push(
            supabaseClient
                .from('current_inventory')
                .update(inventoryUpdateFields)
                .eq('medicine_id', medicine_id)
                .eq('batch_number', oldBatchNumber)
                .eq('expiry_date', oldExpiryDate)
        )
    }
    if (shouldUpdateTransactions) {
        parallelOps.push(
            supabaseClient
                .from('stock_transactions')
                .update(transactionUpdateFields)
                .eq('medicine_id', medicine_id)
                .eq('batch_number', oldBatchNumber)
                .eq('expiry_date', oldExpiryDate)
        )
    }
    if (parallelOps.length > 0) {
        await Promise.all(parallelOps)
    }

    if (updateFields.quantity || updateFields.purchase_rate || updateFields.mrp) {
        const purchaseId = updatedPurchaseItem.purchase_id

        const { data: allItems, error: itemsError } = await supabaseClient
            .from('purchase_items')
            .select('quantity, purchase_rate, gross_amount, net_amount')
            .eq('purchase_id', purchaseId)

        if (!itemsError && allItems) {
            const newTotalAmount = allItems.reduce((total: number, item: any) => {
                return total + (item.net_amount || (item.quantity * item.purchase_rate))
            }, 0)

            await supabaseClient
                .from('purchases')
                .update({ total_amount: newTotalAmount })
                .eq('id', purchaseId)
        }
    }
}

export async function GET(request: NextRequest) {
    try {
        const { user, supabase } = await getAuthenticatedUser(request)
        
        const { searchParams } = new URL(request.url)
        const page = parseInt(searchParams.get('page') || '1')
        const limit = parseInt(searchParams.get('limit') || '10')
        const offset = (page - 1) * limit

        const medicineName = searchParams.get('medicine_name')
        const supplierName = searchParams.get('supplier_name')
        const batchNumber = searchParams.get('batch_number')
        const purchaseDate = searchParams.get('date')
        const purchaseId = searchParams.get('purchase_id')

        let query = supabase
            .from('purchases')
            .select(`
                id,
                purchase_date,
                invoice_number,
                total_amount,
                created_at,
                suppliers(name),
                purchase_items(
                    id,
                    batch_number,
                    expiry_date,
                    quantity,
                    free_quantity,
                    mrp,
                    purchase_rate,
                    medicines(name, generic_name, manufacturer, strength, unit_type)
                )
            `)

        if (purchaseId) {
            query = query.eq('id', purchaseId)
        }
        if (purchaseDate) {
            query = query.eq('purchase_date', purchaseDate)
        }

        const { data: purchases, error } = await query
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1)

        if (error) {
            return NextResponse.json(
                { error: 'Failed to fetch purchases' },
                { status: 500 }
            )
        }

        let filteredPurchases = purchases || []

        if (medicineName || batchNumber || supplierName) {
            filteredPurchases = filteredPurchases.filter(purchase => {
                const medicineMatch = !medicineName ||
                    purchase.purchase_items?.some((item: any) =>
                        item.medicines?.name?.toLowerCase().includes(medicineName.toLowerCase()) ||
                        item.medicines?.generic_name?.toLowerCase().includes(medicineName.toLowerCase())
                    )

                const batchMatch = !batchNumber ||
                    purchase.purchase_items?.some((item: any) =>
                        item.batch_number?.toLowerCase().includes(batchNumber.toLowerCase())
                    )

                const supplierMatch = !supplierName ||
                    (purchase.suppliers as any)?.name?.toLowerCase().includes(supplierName.toLowerCase())

                return medicineMatch && batchMatch && supplierMatch
            })
        }

        const transformedPurchases = filteredPurchases.flatMap(purchase => {
            if (!purchase.purchase_items || purchase.purchase_items.length === 0) {
                return []
            }

            return purchase.purchase_items.map((item: any) => ({
                id: `${purchase.id}-${item.id}`,
                purchase_id: purchase.id,
                purchase_item_id: item.id,
                medicine_name: item.medicines?.name || 'Unknown Medicine',
                generic_name: item.medicines?.generic_name || '',
                supplier_name: (purchase.suppliers as any)?.name || 'Unknown',
                batch_number: item.batch_number || '',
                quantity: item.quantity || 0,
                Free: item.free_quantity || 0,
                purchase_rate: item.purchase_rate || 0,
                mrp: item.mrp || 0,
                expiry_date: item.expiry_date,
                purchase_date: purchase.purchase_date,
                invoice_number: purchase.invoice_number,
                total_amount: purchase.total_amount,
                manufacturer: item.medicines?.manufacturer || '',
                strength: item.medicines?.strength || '',
                unit_type: item.medicines?.unit_type || ''
            }))
        })

        return NextResponse.json(transformedPurchases)
    } catch (error) {
        if (error instanceof Error && error.message.includes('Authentication')) {
            return NextResponse.json(
                { error: 'Authentication required' },
                { status: 401 }
            )
        }
        
        return NextResponse.json(
            { error: 'Failed to fetch purchases' },
            { status: 500 }
        )
    }
}

export async function POST(request: NextRequest) {
    try {
        const { user, supabase } = await getAuthenticatedUser(request)
        
        const body = await request.json()

        if (!body.supplier_name || !body.items?.length) {
            return NextResponse.json(
                { error: 'Missing required fields: supplier_name and items are required' },
                { status: 400 }
            )
        }

        const { data: userPharmacy } = await supabase
            .from('user_pharmacies')
            .select('pharmacy_id')
            .eq('user_id', user.id)
            .eq('is_active', true)
            .single()

        if (!userPharmacy) {
            return NextResponse.json(
                { error: 'No pharmacy found for user. Please contact administrator.' },
                { status: 400 }
            )
        }

        // Find or create supplier
        let supplierId;
        const { data: existingSupplier } = await supabase
            .from('suppliers')
            .select('id')
            .eq('name', body.supplier_name)
            .eq('pharmacy_id', userPharmacy.pharmacy_id)
            .single()

        if (existingSupplier) {
            supplierId = existingSupplier.id
        } else {
            const { data: newSupplier, error: supplierError } = await supabase
                .from('suppliers')
                .insert({
                    pharmacy_id: userPharmacy.pharmacy_id,
                    name: body.supplier_name,
                    contact_person: 'Auto-created',
                    is_active: true
                })
                .select('id')
                .single()

            if (supplierError) {
                return NextResponse.json(
                    { error: 'Failed to create supplier' },
                    { status: 500 }
                )
            }
            supplierId = newSupplier.id
        }

        const totalAmount = body.items.reduce((sum: number, item: any) => {
            return sum + (parseFloat(item.amount) || 0)
        }, 0)

        const purchaseDate = body.date || new Date().toISOString().split('T')[0]

        let invoiceNumber = body.invoice_number || `INV-${Date.now()}`
        
        const { data: existingPurchase } = await supabase
            .from('purchases')
            .select('id')
            .eq('pharmacy_id', userPharmacy.pharmacy_id)
            .eq('supplier_id', supplierId)
            .eq('invoice_number', invoiceNumber)
            .single()
        
        if (existingPurchase) {
            const timestamp = Date.now()
            const randomSuffix = Math.floor(Math.random() * 1000).toString().padStart(3, '0')
            invoiceNumber = body.invoice_number ? 
                `${body.invoice_number}-${timestamp}` : 
                `INV-${timestamp}-${randomSuffix}`
        }

        const { data: purchase, error: purchaseError } = await supabase
            .from('purchases')
            .insert({
                pharmacy_id: userPharmacy.pharmacy_id,
                supplier_id: supplierId,
                user_id: user.id,
                invoice_number: invoiceNumber,
                invoice_date: purchaseDate,
                purchase_date: purchaseDate,
                total_amount: totalAmount,
                status: 'received'
            })
            .select()
            .single()

        if (purchaseError) {
            return NextResponse.json(
                { error: 'Failed to create purchase' },
                { status: 500 }
            )
        }

        // Batch-fetch all existing medicines by name in a single query
        const uniqueMedicineNames: string[] = [...new Set<string>(body.items.map((item: any) => item.medicine_name))]
        const { data: existingMedicines } = await supabase
            .from('medicines')
            .select('id, name')
            .in('name', uniqueMedicineNames)

        const medicineMap = new Map<string, string>()
        existingMedicines?.forEach((med: any) => medicineMap.set(med.name, med.id))

        const newMedicineNames = uniqueMedicineNames.filter(name => !medicineMap.has(name))
        if (newMedicineNames.length > 0) {
            const newMedicineRows = newMedicineNames.map(name => ({
                name,
                generic_name: name,
                manufacturer: 'Unknown',
                unit_type: 'strips',
                is_active: true
            }))

            const { data: createdMedicines, error: createMedError } = await supabase
                .from('medicines')
                .insert(newMedicineRows)
                .select('id, name')

            if (!createMedError && createdMedicines) {
                createdMedicines.forEach((med: any) => medicineMap.set(med.name, med.id))
            }
        }

        // Build all purchase items and batch-insert them
        const purchaseItemRows: any[] = []
        for (const item of body.items) {
            const medicineId = medicineMap.get(item.medicine_name)
            if (!medicineId) continue

            let formattedExpiryDate = item.expiry_date
            if (item.expiry_date && item.expiry_date.match(/^\d{4}-\d{2}$/)) {
                const [year, month] = item.expiry_date.split('-')
                const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate()
                formattedExpiryDate = `${year}-${month}-${lastDay.toString().padStart(2, '0')}`
            }

            purchaseItemRows.push({
                purchase_id: purchase.id,
                medicine_id: medicineId,
                batch_number: item.batch_number || 'AUTO-' + Date.now(),
                expiry_date: formattedExpiryDate,
                quantity: parseInt(item.quantity) || 0,
                free_quantity: convertFreeToInteger(item.Free),
                mrp: parseFloat(item.mrp) || 0,
                purchase_rate: parseFloat(item.rate) || 0,
                discount_percentage: 0,
                tax_percentage: 0
            })
        }

        if (purchaseItemRows.length > 0) {
            await supabase
                .from('purchase_items')
                .insert(purchaseItemRows)
        }

        // Fetch the complete purchase with all relations
        const { data: completePurchase } = await supabase
            .from('purchases')
            .select(`
                *,
                suppliers(name),
                purchase_items(
                    *,
                    medicines(name, generic_name, manufacturer)
                )
            `)
            .eq('id', purchase.id)
            .single()

        return NextResponse.json(completePurchase, { status: 201 })
    } catch (error) {
        if (error instanceof Error && error.message.includes('Authentication')) {
            return NextResponse.json(
                { error: 'Authentication required' },
                { status: 401 }
            )
        }
        
        return NextResponse.json(
            { error: 'Failed to create purchase' },
            { status: 500 }
        )
    }
}

export async function PUT(request: NextRequest) {
    try {
        const { user, supabase } = await getAuthenticatedUser(request)
        
        const body = await request.json()
        const { purchase_item_id, ...updateData } = body

        if (!purchase_item_id) {
            return NextResponse.json(
                { error: 'Purchase item ID is required' },
                { status: 400 }
            )
        }

        const { data: currentItem, error: fetchError } = await supabase
            .from('purchase_items')
            .select('medicine_id, batch_number, expiry_date, quantity, total_quantity, purchase_rate, mrp')
            .eq('id', purchase_item_id)
            .single()

        if (fetchError || !currentItem) {
            return NextResponse.json(
                { error: 'Purchase item not found' },
                { status: 404 }
            )
        }

        const updateFields: any = {}
        if (updateData.quantity) updateFields.quantity = parseInt(updateData.quantity)
        if (updateData.Free !== undefined) updateFields.free_quantity = convertFreeToInteger(updateData.Free)
        if (updateData.purchase_rate) updateFields.purchase_rate = parseFloat(updateData.purchase_rate)
        if (updateData.mrp) updateFields.mrp = parseFloat(updateData.mrp)
        if (updateData.batch_number !== undefined) updateFields.batch_number = updateData.batch_number
        if (updateData.expiry_date) updateFields.expiry_date = updateData.expiry_date

        if (updateData.medicine_name) {
            const { data: existingMedicine } = await supabase
                .from('medicines')
                .select('id')
                .eq('name', updateData.medicine_name)
                .single()

            let newMedicineId;

            if (existingMedicine) {
                newMedicineId = existingMedicine.id
            } else {
                const { data: newMedicine, error: medicineError } = await supabase
                    .from('medicines')
                    .insert({
                        name: updateData.medicine_name,
                        generic_name: updateData.medicine_name,
                        manufacturer: 'Unknown',
                        unit_type: 'strips',
                        is_active: true
                    })
                    .select('id')
                    .single()

                if (medicineError) {
                    return NextResponse.json(
                        { error: 'Failed to create medicine' },
                        { status: 500 }
                    )
                }
                newMedicineId = newMedicine.id
            }

            const batchNumber = updateFields.batch_number !== undefined ? updateFields.batch_number : currentItem.batch_number
            const expiryDate = updateFields.expiry_date !== undefined ? updateFields.expiry_date : currentItem.expiry_date

            if (newMedicineId !== currentItem.medicine_id) {
                const { data: conflictingItem } = await supabase
                    .from('purchase_items')
                    .select('id')
                    .eq('medicine_id', newMedicineId)
                    .eq('batch_number', batchNumber)
                    .eq('expiry_date', expiryDate)
                    .neq('id', purchase_item_id)
                    .single()

                if (conflictingItem) {
                    return NextResponse.json(
                        { 
                            error: 'Cannot update: A purchase item with this medicine name, batch number, and expiry date already exists. Please use a different batch number or expiry date.',
                            code: 'DUPLICATE_ENTRY'
                        },
                        { status: 409 }
                    )
                }
            }

            updateFields.medicine_id = newMedicineId
        }

        let updatedItem: any = null
        let error: any = null

        if (Object.keys(updateFields).length > 0) {
            const result = await supabase
                .from('purchase_items')
                .update(updateFields)
                .eq('id', purchase_item_id)
                .select(`
                    *,
                    medicines(name, generic_name),
                    purchases(
                        id,
                        purchase_date,
                        invoice_number,
                        suppliers(name)
                    )
                `)
                .single()
            updatedItem = result.data
            error = result.error

            if (error) {
                return NextResponse.json(
                    { error: 'Failed to update purchase item' },
                    { status: 500 }
                )
            }

            await cascadeUpdatesToRelatedTables(
                supabase,
                currentItem,
                updateFields,
                updatedItem
            )
        } else {
            const result = await supabase
                .from('purchase_items')
                .select(`
                    *,
                    medicines(name, generic_name),
                    purchases(
                        id,
                        purchase_date,
                        invoice_number,
                        suppliers(name)
                    )
                `)
                .eq('id', purchase_item_id)
                .single()
            updatedItem = result.data
            error = result.error
        }

        if (error) {
            return NextResponse.json(
                { error: 'Failed to update purchase item' },
                { status: 500 }
            )
        }

        const purchaseId = (updatedItem.purchases as any)?.id

        if (purchaseId) {
            const { data: allItems, error: itemsError } = await supabase
                .from('purchase_items')
                .select('quantity, purchase_rate, gross_amount, net_amount')
                .eq('purchase_id', purchaseId)

            if (!itemsError && allItems) {
                const newTotalAmount = allItems.reduce((total, item) => {
                    return total + (item.net_amount || (item.quantity * item.purchase_rate))
                }, 0)

                await supabase
                    .from('purchases')
                    .update({ total_amount: newTotalAmount })
                    .eq('id', purchaseId)
            }
        }

        return NextResponse.json(updatedItem)

    } catch (error) {
        if (error instanceof Error && error.message.includes('Authentication')) {
            return NextResponse.json(
                { error: 'Authentication required' },
                { status: 401 }
            )
        }
        
        return NextResponse.json(
            { error: 'Failed to update purchase item' },
            { status: 500 }
        )
    }
}

export async function DELETE(request: NextRequest) {
    try {
        const { user, supabase } = await getAuthenticatedUser(request)
        
        const { searchParams } = new URL(request.url)
        const purchase_item_id = searchParams.get('purchase_item_id')
        const purchase_item_ids = searchParams.get('purchase_item_ids')

        if (purchase_item_ids) {
            const idsArray = purchase_item_ids.split(',').filter(id => id.trim())
            
            if (idsArray.length === 0) {
                return NextResponse.json(
                    { error: 'No valid purchase item IDs provided' },
                    { status: 400 }
                )
            }

            const deletedItems: string[] = []
            const failedItems: { id: string; error: string }[] = []

            for (const itemId of idsArray) {
                try {
                    const { data: itemToDelete, error: fetchError } = await supabase
                        .from('purchase_items')
                        .select('id, purchase_id, medicine_id, batch_number, expiry_date, quantity, purchase_rate')
                        .eq('id', itemId.trim())
                        .single()

                    if (fetchError || !itemToDelete) {
                        failedItems.push({ id: itemId, error: 'Item not found' })
                        continue
                    }

                    const purchaseId = itemToDelete.purchase_id

                    const { error: deleteError } = await supabase
                        .from('purchase_items')
                        .delete()
                        .eq('id', itemId.trim())

                    if (deleteError) {
                        failedItems.push({ id: itemId, error: deleteError.message })
                        continue
                    }

                    await cascadeDeleteFromRelatedTables(supabase, itemToDelete)

                    const { data: remainingItems } = await supabase
                        .from('purchase_items')
                        .select('quantity, purchase_rate, gross_amount, net_amount')
                        .eq('purchase_id', purchaseId)

                    if (!remainingItems || remainingItems.length === 0) {
                        await supabase.from('purchases').delete().eq('id', purchaseId)
                    } else {
                        const newTotal = remainingItems.reduce((sum, item) => sum + (item.net_amount || item.gross_amount || 0), 0)
                        await supabase
                            .from('purchases')
                            .update({ total_amount: newTotal })
                            .eq('id', purchaseId)
                    }

                    deletedItems.push(itemId)
                } catch (error) {
                    failedItems.push({ 
                        id: itemId, 
                        error: error instanceof Error ? error.message : 'Unknown error' 
                    })
                }
            }

            return NextResponse.json({
                success: true,
                deleted: deletedItems.length,
                failed: failedItems.length,
                deletedItems,
                failedItems: failedItems.length > 0 ? failedItems : undefined
            })
        }

        if (!purchase_item_id) {
            return NextResponse.json(
                { error: 'Purchase item ID is required' },
                { status: 400 }
            )
        }

        const { data: itemToDelete, error: fetchError } = await supabase
            .from('purchase_items')
            .select('id, purchase_id, medicine_id, batch_number, expiry_date, quantity, purchase_rate')
            .eq('id', purchase_item_id)
            .single()

        if (fetchError || !itemToDelete) {
            return NextResponse.json(
                { error: 'Purchase item not found' },
                { status: 404 }
            )
        }

        const purchaseId = itemToDelete.purchase_id

        const { error: deleteError } = await supabase
            .from('purchase_items')
            .delete()
            .eq('id', purchase_item_id)

        if (deleteError) {
            return NextResponse.json(
                { error: 'Failed to delete purchase item' },
                { status: 500 }
            )
        }

        await cascadeDeleteFromRelatedTables(supabase, itemToDelete)

        const { data: remainingItems, error: remainingError } = await supabase
            .from('purchase_items')
            .select('quantity, purchase_rate, gross_amount, net_amount')
            .eq('purchase_id', purchaseId)

        if (remainingError) {
            return NextResponse.json(
                { error: 'Failed to update purchase total' },
                { status: 500 }
            )
        }

        if (!remainingItems || remainingItems.length === 0) {
            const { error: deletePurchaseError } = await supabase
                .from('purchases')
                .delete()
                .eq('id', purchaseId)

            if (deletePurchaseError) {
                return NextResponse.json(
                    { error: 'Failed to delete empty purchase' },
                    { status: 500 }
                )
            }
        } else {
            const newTotalAmount = remainingItems.reduce((total, item) => {
                return total + (item.net_amount || (item.quantity * item.purchase_rate))
            }, 0)

            const { error: updateError } = await supabase
                .from('purchases')
                .update({ total_amount: newTotalAmount })
                .eq('id', purchaseId)

            if (updateError) {
                return NextResponse.json(
                    { error: 'Failed to update purchase total' },
                    { status: 500 }
                )
            }
        }

        return NextResponse.json({ success: true })

    } catch (error) {
        if (error instanceof Error && error.message.includes('Authentication')) {
            return NextResponse.json(
                { error: 'Authentication required' },
                { status: 401 }
            )
        }
        
        return NextResponse.json(
            { error: 'Failed to delete purchase item' },
            { status: 500 }
        )
    }
}
