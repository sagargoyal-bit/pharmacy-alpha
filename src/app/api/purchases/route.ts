import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// Helper function to check if a medicine is still referenced in any table
async function checkMedicineReferences(supabaseClient: any, medicine_id: string): Promise<boolean> {
    try {
        // Check purchase_items table
        const { data: purchaseItems, error: purchaseError } = await supabaseClient
            .from('purchase_items')
            .select('id')
            .eq('medicine_id', medicine_id)
            .limit(1)

        if (purchaseError) {
            console.error('Error checking purchase_items references:', purchaseError)
            return true // Assume referenced if error
        }

        if (purchaseItems && purchaseItems.length > 0) {
            return true // Still referenced in purchase_items
        }

        // Check current_inventory table
        const { data: inventoryItems, error: inventoryError } = await supabaseClient
            .from('current_inventory')
            .select('id')
            .eq('medicine_id', medicine_id)
            .limit(1)

        if (inventoryError) {
            console.error('Error checking current_inventory references:', inventoryError)
            return true // Assume referenced if error
        }

        if (inventoryItems && inventoryItems.length > 0) {
            return true // Still referenced in current_inventory
        }

        // Check stock_transactions table
        const { data: transactionItems, error: transactionError } = await supabaseClient
            .from('stock_transactions')
            .select('id')
            .eq('medicine_id', medicine_id)
            .limit(1)

        if (transactionError) {
            console.error('Error checking stock_transactions references:', transactionError)
            return true // Assume referenced if error
        }

        if (transactionItems && transactionItems.length > 0) {
            return true // Still referenced in stock_transactions
        }

        // expiry_alerts table removed - no longer needed for reference checking

        // No references found - safe to delete
        return false

    } catch (error) {
        console.error('Error checking medicine references:', error)
        return true // Assume referenced if any error occurs
    }
}

// Helper function to cascade deletes to related tables
async function cascadeDeleteFromRelatedTables(
    supabaseClient: any,
    itemToDelete: any
) {
    const { medicine_id, batch_number, expiry_date } = itemToDelete

    try {
        // Delete from current_inventory table
        const { error: inventoryDeleteError } = await supabaseClient
            .from('current_inventory')
            .delete()
            .eq('medicine_id', medicine_id)
            .eq('batch_number', batch_number)
            .eq('expiry_date', expiry_date)

        if (inventoryDeleteError) {
            console.error('Current inventory cascade delete error:', inventoryDeleteError)
        }

        // Delete from stock_transactions table
        const { error: transactionDeleteError } = await supabaseClient
            .from('stock_transactions')
            .delete()
            .eq('medicine_id', medicine_id)
            .eq('batch_number', batch_number)
            .eq('expiry_date', expiry_date)

        if (transactionDeleteError) {
            console.error('Stock transactions cascade delete error:', transactionDeleteError)
        }

        // expiry_alerts table removed - cascade delete no longer needed

        // Check if this medicine is still referenced anywhere else
        const isStillReferenced = await checkMedicineReferences(supabaseClient, medicine_id)


        if (!isStillReferenced) {
            // Safe to delete the medicine record as no other records reference it
            const { error: medicineDeleteError } = await supabaseClient
                .from('medicines')
                .delete()
                .eq('id', medicine_id)

            if (medicineDeleteError) {
                console.error('Medicine delete error:', medicineDeleteError)
            }
        }

    } catch (error) {
        console.error('❌ Error during cascade deletion:', error)
        throw error
    }
}

// Helper function to cascade updates to related tables
async function cascadeUpdatesToRelatedTables(
    supabaseClient: any,
    currentItem: any,
    updateFields: any,
    updatedPurchaseItem: any
) {
    const { medicine_id, batch_number: oldBatchNumber, expiry_date: oldExpiryDate } = currentItem
    const newBatchNumber = updateFields.batch_number ?? oldBatchNumber
    const newExpiryDate = updateFields.expiry_date ?? oldExpiryDate

    try {
        // 1. Update current_inventory table (all fields)
        const inventoryUpdateFields: any = {}
        let shouldUpdateInventory = false

        if (updateFields.batch_number) {
            inventoryUpdateFields.batch_number = newBatchNumber
            shouldUpdateInventory = true
        }
        if (updateFields.expiry_date) {
            inventoryUpdateFields.expiry_date = newExpiryDate
            shouldUpdateInventory = true
        }
        if (updateFields.quantity) {
            inventoryUpdateFields.current_stock = updateFields.quantity
            shouldUpdateInventory = true
        }
        if (updateFields.purchase_rate) {
            inventoryUpdateFields.last_purchase_rate = updateFields.purchase_rate
            shouldUpdateInventory = true
        }
        if (updateFields.mrp) {
            inventoryUpdateFields.current_mrp = updateFields.mrp
            shouldUpdateInventory = true
        }

        if (shouldUpdateInventory) {
            const { error: inventoryError } = await supabaseClient
                .from('current_inventory')
                .update(inventoryUpdateFields)
                .eq('medicine_id', medicine_id)
                .eq('batch_number', oldBatchNumber)
                .eq('expiry_date', oldExpiryDate)

            if (inventoryError) {
                console.error('Current inventory cascade update error:', inventoryError)
            }
        }

        // 2. Update stock_transactions table (all fields)
        const transactionUpdateFields: any = {}
        let shouldUpdateTransactions = false

        if (updateFields.batch_number) {
            transactionUpdateFields.batch_number = newBatchNumber
            shouldUpdateTransactions = true
        }
        if (updateFields.expiry_date) {
            transactionUpdateFields.expiry_date = newExpiryDate
            shouldUpdateTransactions = true
        }
        if (updateFields.quantity) {
            transactionUpdateFields.quantity_in = updateFields.quantity
            shouldUpdateTransactions = true
        }
        if (updateFields.purchase_rate) {
            transactionUpdateFields.rate = updateFields.purchase_rate
            shouldUpdateTransactions = true
        }
        if (updateFields.quantity || updateFields.purchase_rate) {
            const quantity = updateFields.quantity || currentItem.quantity
            const rate = updateFields.purchase_rate || currentItem.purchase_rate
            transactionUpdateFields.amount = quantity * rate
            shouldUpdateTransactions = true
        }

        if (shouldUpdateTransactions) {
            const { error: transactionError } = await supabaseClient
                .from('stock_transactions')
                .update(transactionUpdateFields)
                .eq('medicine_id', medicine_id)
                .eq('batch_number', oldBatchNumber)
                .eq('expiry_date', oldExpiryDate)

            if (transactionError) {
                console.error('Stock transactions cascade update error:', transactionError)
            }
        }

        // 3. expiry_alerts table removed - updates no longer needed

        // 4. Recalculate and update parent purchase total_amount if financial fields changed
        if (updateFields.quantity || updateFields.purchase_rate || updateFields.mrp) {
            const purchaseId = updatedPurchaseItem.purchase_id

            // Get all purchase items for this purchase to recalculate total
            const { data: allItems, error: itemsError } = await supabaseClient
                .from('purchase_items')
                .select('quantity, purchase_rate, gross_amount, net_amount')
                .eq('purchase_id', purchaseId)

            if (!itemsError && allItems) {
                // Recalculate total amount
                const newTotalAmount = allItems.reduce((total: number, item: any) => {
                    const itemAmount = item.net_amount || (item.quantity * item.purchase_rate)
                    return total + itemAmount
                }, 0)

                // Update the parent purchase total_amount
                const { error: updateTotalError } = await supabaseClient
                    .from('purchases')
                    .update({ total_amount: newTotalAmount })
                    .eq('id', purchaseId)

                if (updateTotalError) {
                    console.error('Purchase total update error:', updateTotalError)
                }
            }
        }

    } catch (error) {
        console.error('❌ Error during cascade updates:', error)
        throw error
    }
}

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url)
        const page = parseInt(searchParams.get('page') || '1')
        const limit = parseInt(searchParams.get('limit') || '10')
        const offset = (page - 1) * limit

        // Get filter parameters
        const medicineName = searchParams.get('medicine_name')
        const supplierName = searchParams.get('supplier_name')
        const batchNumber = searchParams.get('batch_number')
        const purchaseDate = searchParams.get('date')

        // Build the base query
        let query = supabase
            .from('purchases')
            .select(`
        *,
        suppliers(
          id,
          name,
          contact_person,
          phone,
          email
        ),
        users(
          id,
          email,
          full_name
        ),
        purchase_items(
          id,
          medicine_id,
          batch_number,
          expiry_date,
          quantity,
          weight,
          free_quantity,
          total_quantity,
          mrp,
          purchase_rate,
          gross_amount,
          discount_amount,
          tax_amount,
          net_amount,
          medicines(
            id,
            name,
            generic_name,
            manufacturer,
            strength,
            unit_type
          )
        )
      `)

        // Apply filters
        if (purchaseDate) {
            query = query.eq('purchase_date', purchaseDate)
        }

        // Fetch purchases with filters
        const { data: purchases, error } = await query
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1)

        if (error) {
            console.error('Supabase error:', error)
            return NextResponse.json(
                { error: 'Failed to fetch purchases' },
                { status: 500 }
            )
        }

        // If we have medicine name, batch number, or supplier name filters, we need to filter the results
        // since these are in the related tables
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
                    purchase.suppliers?.name?.toLowerCase().includes(supplierName.toLowerCase())

                return medicineMatch && batchMatch && supplierMatch
            })
        }

        // Transform the data to flatten purchase items for easier display
        const transformedPurchases = filteredPurchases.flatMap(purchase => {
            // Skip purchases that have no items - don't show empty rows
            if (!purchase.purchase_items || purchase.purchase_items.length === 0) {
                return []
            }

            return purchase.purchase_items.map((item: any) => ({
                id: `${purchase.id}-${item.id}`,
                purchase_id: purchase.id,
                purchase_item_id: item.id,
                medicine_name: item.medicines?.name || 'Unknown Medicine',
                generic_name: item.medicines?.generic_name || '',
                supplier_name: purchase.suppliers?.name || 'Unknown',
                batch_number: item.batch_number || '',
                quantity: item.quantity || 0,
                weight: item.weight || null,
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

        console.log('🔍 Purchase search results:', {
            filters: { medicineName, supplierName, batchNumber, purchaseDate },
            resultCount: transformedPurchases.length
        })

        return NextResponse.json(transformedPurchases)
    } catch (error) {
        console.error('API error:', error)
        return NextResponse.json(
            { error: 'Failed to fetch purchases' },
            { status: 500 }
        )
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()

        // Validate the request body
        if (!body.supplier_name || !body.items?.length) {
            return NextResponse.json(
                { error: 'Missing required fields: supplier_name and items are required' },
                { status: 400 }
            )
        }

        // Get the current user (you might need to implement auth middleware)
        // For now, we'll use the first user or require user_id in the request
        const { data: users } = await supabase
            .from('users')
            .select('id')
            .limit(1)
        console.log("user", users)
        console.log("data", body)

        if (!users || users.length === 0) {
            return NextResponse.json(
                { error: 'No users found. Please create a user first.' },
                { status: 400 }
            )
        }

        // Get the pharmacy (assuming single pharmacy for now)
        const { data: pharmacies } = await supabase
            .from('pharmacies')
            .select('id')
            .limit(1)

        if (!pharmacies || pharmacies.length === 0) {
            return NextResponse.json(
                { error: 'No pharmacy found. Please create a pharmacy first.' },
                { status: 400 }
            )
        }

        // Find or create supplier
        let supplierId;
        const { data: existingSupplier } = await supabase
            .from('suppliers')
            .select('id')
            .eq('name', body.supplier_name)
            .eq('pharmacy_id', pharmacies[0].id)
            .single()

        if (existingSupplier) {
            supplierId = existingSupplier.id
        } else {
            // Create new supplier
            const { data: newSupplier, error: supplierError } = await supabase
                .from('suppliers')
                .insert({
                    pharmacy_id: pharmacies[0].id,
                    name: body.supplier_name,
                    contact_person: 'Auto-created',
                    is_active: true
                })
                .select('id')
                .single()

            if (supplierError) {
                console.error('Supplier creation error:', supplierError)
                return NextResponse.json(
                    { error: 'Failed to create supplier' },
                    { status: 500 }
                )
            }
            supplierId = newSupplier.id
        }

        // Calculate total amount
        const totalAmount = body.items.reduce((sum: number, item: any) => {
            return sum + (parseFloat(item.amount) || 0)
        }, 0)

        // Ensure date is properly formatted
        const purchaseDate = body.date || new Date().toISOString().split('T')[0]

        console.log('Purchase data being inserted:', {
            pharmacy_id: pharmacies[0].id,
            supplier_id: supplierId,
            user_id: users[0].id,
            invoice_number: body.invoice_number,
            invoice_date: purchaseDate,
            purchase_date: purchaseDate,
            total_amount: totalAmount,
            status: 'received'
        })

        // Generate unique invoice number if needed
        let invoiceNumber = body.invoice_number || `INV-${Date.now()}`
        
        // Check if invoice number already exists for this pharmacy and supplier
        const { data: existingPurchase } = await supabase
            .from('purchases')
            .select('id')
            .eq('pharmacy_id', pharmacies[0].id)
            .eq('supplier_id', supplierId)
            .eq('invoice_number', invoiceNumber)
            .single()
        
        // If invoice number exists, generate a unique one
        if (existingPurchase) {
            const timestamp = Date.now()
            const randomSuffix = Math.floor(Math.random() * 1000).toString().padStart(3, '0')
            invoiceNumber = body.invoice_number ? 
                `${body.invoice_number}-${timestamp}` : 
                `INV-${timestamp}-${randomSuffix}`
        }

        // Create purchase record
        const { data: purchase, error: purchaseError } = await supabase
            .from('purchases')
            .insert({
                pharmacy_id: pharmacies[0].id,
                supplier_id: supplierId,
                user_id: users[0].id,
                invoice_number: invoiceNumber,
                invoice_date: purchaseDate,
                purchase_date: purchaseDate,
                total_amount: totalAmount,
                status: 'received'
            })
            .select()
            .single()

        if (purchaseError) {
            console.error('Purchase creation error:', purchaseError)
            return NextResponse.json(
                { error: 'Failed to create purchase' },
                { status: 500 }
            )
        }

        // Create purchase items
        const purchaseItems: object[] = []
        console.log('🔄 Processing', body.items.length, 'items...')

        for (let i = 0; i < body.items.length; i++) {
            const item = body.items[i]
            console.log(`\n📦 Processing item ${i + 1}:`, item)

            // Find or create medicine
            let medicineId;
            console.log('🔍 Looking for medicine:', item.medicine_name)

            const { data: existingMedicine, error: medicineSearchError } = await supabase
                .from('medicines')
                .select('id')
                .eq('name', item.medicine_name)
                .single()

            if (medicineSearchError) {
                console.log('⚠️ Medicine search error:', medicineSearchError.message)
            }

            if (existingMedicine) {
                console.log('✅ Found existing medicine:', existingMedicine.id)
                medicineId = existingMedicine.id
            } else {
                console.log('🆕 Creating new medicine:', item.medicine_name)

                // Create new medicine
                const { data: newMedicine, error: medicineError } = await supabase
                    .from('medicines')
                    .insert({
                        name: item.medicine_name,
                        generic_name: item.medicine_name,
                        manufacturer: 'Unknown',
                        unit_type: 'strips',
                        is_active: true
                    })
                    .select('id')
                    .single()

                if (medicineError) {
                    console.error('❌ Medicine creation error:', medicineError)
                    console.log('⏭️ Skipping item due to medicine creation failure')
                    continue // Skip this item if medicine creation fails
                } else {
                    console.log('✅ Created new medicine:', newMedicine.id)
                    medicineId = newMedicine.id
                }
            }

            // Format expiry date - handle both YYYY-MM and YYYY-MM-DD formats
            let formattedExpiryDate = item.expiry_date
            if (item.expiry_date && item.expiry_date.match(/^\d{4}-\d{2}$/)) {
                // If format is YYYY-MM, convert to last day of that month
                const [year, month] = item.expiry_date.split('-')
                const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate()
                formattedExpiryDate = `${year}-${month}-${lastDay.toString().padStart(2, '0')}`
                console.log(`📅 Converted expiry date from ${item.expiry_date} to ${formattedExpiryDate}`)
            }

            // Prepare purchase item data
            const purchaseItemData = {
                purchase_id: purchase.id,
                medicine_id: medicineId,
                batch_number: item.batch_number || 'AUTO-' + Date.now(),
                expiry_date: formattedExpiryDate,
                quantity: parseInt(item.quantity) || 0,
                weight: item.weight ? parseFloat(item.weight) : null,
                free_quantity: 0,
                mrp: parseFloat(item.mrp) || 0,
                purchase_rate: parseFloat(item.rate) || 0,
                discount_percentage: 0,
                tax_percentage: 0
            }

            console.log('💾 Inserting purchase item:', purchaseItemData)

            // Create purchase item
            const { data: purchaseItem, error: itemError } = await supabase
                .from('purchase_items')
                .insert(purchaseItemData)
                .select()
                .single()

            if (itemError) {
                console.error('❌ Purchase item creation error:', itemError)
                console.log('📋 Failed item data:', purchaseItemData)
            } else {
                console.log('✅ Purchase item created successfully:', purchaseItem.id)
                purchaseItems.push(purchaseItem)
            }
        }

        console.log('📊 Summary: Created', purchaseItems.length, 'out of', body.items.length, 'items')

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
        console.error('API error:', error)
        return NextResponse.json(
            { error: 'Failed to create purchase' },
            { status: 500 }
        )
    }
}

export async function PUT(request: NextRequest) {
    try {
        const body = await request.json()
        const { purchase_item_id, ...updateData } = body

        if (!purchase_item_id) {
            return NextResponse.json(
                { error: 'Purchase item ID is required' },
                { status: 400 }
            )
        }

        // STEP 1: Get current purchase_item data BEFORE any updates (for cascading changes)
        const { data: currentItem, error: fetchError } = await supabase
            .from('purchase_items')
            .select(`
                medicine_id,
                batch_number,
                expiry_date,
                quantity,
                total_quantity,
                purchase_rate,
                mrp
            `)
            .eq('id', purchase_item_id)
            .single()

        if (fetchError || !currentItem) {
            return NextResponse.json(
                { error: 'Purchase item not found' },
                { status: 404 }
            )
        }



        // STEP 2: Handle medicine name change (update medicine record directly)
        if (updateData.medicine_name) {
            const { error: medicineUpdateError } = await supabase
                .from('medicines')
                .update({
                    name: updateData.medicine_name,
                    generic_name: updateData.medicine_name,
                    updated_at: new Date().toISOString()
                })
                .eq('id', currentItem.medicine_id)

            if (medicineUpdateError) {
                console.error('Medicine update error:', medicineUpdateError)
                return NextResponse.json(
                    { error: 'Failed to update medicine name' },
                    { status: 500 }
                )
            }


        }

        // STEP 3: Prepare purchase_items update fields with financial calculations
        const updateFields: any = {}
        if (updateData.quantity) updateFields.quantity = parseInt(updateData.quantity)
        if (updateData.weight !== undefined) updateFields.weight = updateData.weight ? parseFloat(updateData.weight) : null
        if (updateData.purchase_rate) updateFields.purchase_rate = parseFloat(updateData.purchase_rate)
        if (updateData.mrp) updateFields.mrp = parseFloat(updateData.mrp)
        if (updateData.batch_number !== undefined) updateFields.batch_number = updateData.batch_number
        if (updateData.expiry_date) updateFields.expiry_date = updateData.expiry_date

        // Note: Financial calculations (gross_amount, net_amount, etc.) are automatically
        // handled by database triggers when quantity or purchase_rate changes

        // STEP 4: Update purchase_items table and cascade to related tables
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
                console.error('Purchase item update error:', error)
                return NextResponse.json(
                    { error: 'Failed to update purchase item' },
                    { status: 500 }
                )
            }

            // STEP 5: CASCADE UPDATES TO RELATED TABLES
            await cascadeUpdatesToRelatedTables(
                supabase,
                currentItem,
                updateFields,
                updatedItem
            )
        } else {
            // Just fetch the current data with updated medicine info
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
            console.error('Update error:', error)
            return NextResponse.json(
                { error: 'Failed to update purchase item' },
                { status: 500 }
            )
        }

        // Get the purchase_id to recalculate total
        const purchaseId = (updatedItem.purchases as any)?.id

        if (purchaseId) {
            // Get all purchase items for this purchase to recalculate total
            const { data: allItems, error: itemsError } = await supabase
                .from('purchase_items')
                .select(`
                    quantity,
                    purchase_rate,
                    gross_amount,
                    net_amount
                `)
                .eq('purchase_id', purchaseId)

            if (itemsError) {
                console.error('Error fetching items for total calculation:', itemsError)
            } else {
                // Recalculate total amount
                const newTotalAmount = allItems?.reduce((total, item) => {
                    // Use net_amount if available, otherwise calculate from quantity * rate
                    const itemAmount = item.net_amount || (item.quantity * item.purchase_rate)
                    return total + itemAmount
                }, 0) || 0

                // Update the purchase total_amount
                const { error: updateTotalError } = await supabase
                    .from('purchases')
                    .update({ total_amount: newTotalAmount })
                    .eq('id', purchaseId)

                if (updateTotalError) {
                    console.error('Error updating purchase total:', updateTotalError)
                } else {
                    console.log('✅ Purchase item updated and total recalculated:', purchase_item_id, 'New total:', newTotalAmount)
                }
            }
        }

        return NextResponse.json(updatedItem)

    } catch (error) {
        console.error('API error:', error)
        return NextResponse.json(
            { error: 'Failed to update purchase item' },
            { status: 500 }
        )
    }
}

export async function DELETE(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url)
        const purchase_item_id = searchParams.get('purchase_item_id')

        if (!purchase_item_id) {
            return NextResponse.json(
                { error: 'Purchase item ID is required' },
                { status: 400 }
            )
        }

        // STEP 1: Get complete purchase_item details before deleting (for cascading deletes)
        const { data: itemToDelete, error: fetchError } = await supabase
            .from('purchase_items')
            .select(`
                id,
                purchase_id,
                medicine_id,
                batch_number,
                expiry_date,
                quantity,
                purchase_rate
            `)
            .eq('id', purchase_item_id)
            .single()

        if (fetchError || !itemToDelete) {
            console.error('Fetch error:', fetchError)
            return NextResponse.json(
                { error: 'Purchase item not found' },
                { status: 404 }
            )
        }

        const purchaseId = itemToDelete.purchase_id

        // STEP 2: Delete from purchase_items table FIRST
        const { error: deleteError } = await supabase
            .from('purchase_items')
            .delete()
            .eq('id', purchase_item_id)

        if (deleteError) {
            console.error('Delete error:', deleteError)
            return NextResponse.json(
                { error: 'Failed to delete purchase item' },
                { status: 500 }
            )
        }

        // STEP 3: CASCADE DELETE from all related tables AFTER purchase_items deletion
        await cascadeDeleteFromRelatedTables(supabase, itemToDelete)

        // Get remaining purchase items for this purchase
        const { data: remainingItems, error: remainingError } = await supabase
            .from('purchase_items')
            .select(`
                quantity,
                purchase_rate,
                gross_amount,
                net_amount
            `)
            .eq('purchase_id', purchaseId)

        if (remainingError) {
            console.error('Error fetching remaining items:', remainingError)
            return NextResponse.json(
                { error: 'Failed to update purchase total' },
                { status: 500 }
            )
        }

        if (!remainingItems || remainingItems.length === 0) {
            // No items left, delete the entire purchase
            const { error: deletePurchaseError } = await supabase
                .from('purchases')
                .delete()
                .eq('id', purchaseId)

            if (deletePurchaseError) {
                console.error('Error deleting purchase:', deletePurchaseError)
                return NextResponse.json(
                    { error: 'Failed to delete empty purchase' },
                    { status: 500 }
                )
            }

            console.log('Purchase item deleted and empty purchase removed:', purchase_item_id)
        } else {
            // Recalculate total amount from remaining items
            const newTotalAmount = remainingItems.reduce((total, item) => {
                // Use net_amount if available, otherwise calculate from quantity * rate
                const itemAmount = item.net_amount || (item.quantity * item.purchase_rate)
                return total + itemAmount
            }, 0)

            // Update the purchase total_amount
            const { error: updateError } = await supabase
                .from('purchases')
                .update({ total_amount: newTotalAmount })
                .eq('id', purchaseId)

            if (updateError) {
                console.error('Error updating purchase total:', updateError)
                return NextResponse.json(
                    { error: 'Failed to update purchase total' },
                    { status: 500 }
                )
            }

            console.log('Purchase item deleted and total updated:', purchase_item_id, 'New total:', newTotalAmount)
        }

        return NextResponse.json({ success: true })

    } catch (error) {
        console.error('API error:', error)
        return NextResponse.json(
            { error: 'Failed to delete purchase item' },
            { status: 500 }
        )
    }
} 