import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url)
        const search = searchParams.get('search')
        const page = parseInt(searchParams.get('page') || '1')
        const limit = parseInt(searchParams.get('limit') || '50')
        const offset = (page - 1) * limit

        // Get the first pharmacy
        const { data: pharmacy } = await supabase
            .from('pharmacies')
            .select('id')
            .limit(1)
            .single()

        if (!pharmacy) {
            return NextResponse.json([])
        }

        let query = supabase
            .from('suppliers')
            .select('*')
            .eq('pharmacy_id', pharmacy.id)
            .eq('is_active', true)

        // Add search filter (case insensitive)
        if (search) {
            const searchTerm = search.trim().toLowerCase()
            query = query.or(`name.ilike.%${searchTerm}%,contact_person.ilike.%${searchTerm}%,city.ilike.%${searchTerm}%`)
        }

        const { data: suppliers, error } = await query
            .order('name', { ascending: true })
            .range(offset, offset + limit - 1)

        if (error) {
            console.error('Suppliers fetch error:', error)
            return NextResponse.json(
                { error: 'Failed to fetch suppliers' },
                { status: 500 }
            )
        }

        return NextResponse.json(suppliers || [])
    } catch (error) {
        console.error('API error:', error)
        return NextResponse.json(
            { error: 'Failed to fetch suppliers' },
            { status: 500 }
        )
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()

        // Get the first pharmacy
        const { data: pharmacy } = await supabase
            .from('pharmacies')
            .select('id')
            .limit(1)
            .single()

        if (!pharmacy) {
            return NextResponse.json(
                { error: 'No pharmacy found' },
                { status: 400 }
            )
        }

        // Validate required fields
        if (!body.name) {
            return NextResponse.json(
                { error: 'Supplier name is required' },
                { status: 400 }
            )
        }

        // Create new supplier
        const { data: supplier, error } = await supabase
            .from('suppliers')
            .insert({
                pharmacy_id: pharmacy.id,
                name: body.name,
                contact_person: body.contact_person,
                phone: body.phone,
                email: body.email,
                address: body.address,
                city: body.city,
                state: body.state,
                pincode: body.pincode,
                gst_number: body.gst_number,
                drug_license_number: body.drug_license_number,
                credit_days: body.credit_days || 0,
                credit_limit: body.credit_limit || 0,
                is_active: true
            })
            .select()
            .single()

        if (error) {
            console.error('Supplier creation error:', error)
            return NextResponse.json(
                { error: 'Failed to create supplier' },
                { status: 500 }
            )
        }

        return NextResponse.json(supplier, { status: 201 })
    } catch (error) {
        console.error('API error:', error)
        return NextResponse.json(
            { error: 'Failed to create supplier' },
            { status: 500 }
        )
    }
}

export async function PUT(request: NextRequest) {
    try {
        const body = await request.json()
        const { supplier_id, new_name } = body

        if (!supplier_id || !new_name) {
            return NextResponse.json(
                { error: 'Supplier ID and new name are required' },
                { status: 400 }
            )
        }

        // Get the first pharmacy
        const { data: pharmacy } = await supabase
            .from('pharmacies')
            .select('id')
            .limit(1)
            .single()

        if (!pharmacy) {
            return NextResponse.json(
                { error: 'No pharmacy found' },
                { status: 400 }
            )
        }

        // Check if supplier exists and belongs to this pharmacy
        const { data: existingSupplier, error: supplierError } = await supabase
            .from('suppliers')
            .select('id, name')
            .eq('id', supplier_id)
            .eq('pharmacy_id', pharmacy.id)
            .single()

        if (supplierError || !existingSupplier) {
            return NextResponse.json(
                { error: 'Supplier not found' },
                { status: 404 }
            )
        }

        const oldName = existingSupplier.name

        // Update the supplier name
        const { data: updatedSupplier, error: updateError } = await supabase
            .from('suppliers')
            .update({ name: new_name })
            .eq('id', supplier_id)
            .select()
            .single()

        if (updateError) {
            console.error('Supplier update error:', updateError)
            return NextResponse.json(
                { error: 'Failed to update supplier' },
                { status: 500 }
            )
        }

        console.log(`✅ Supplier updated: "${oldName}" → "${new_name}"`)

        return NextResponse.json({
            supplier: updatedSupplier,
            message: `Supplier name updated from "${oldName}" to "${new_name}"`
        })

    } catch (error) {
        console.error('API error:', error)
        return NextResponse.json(
            { error: 'Failed to update supplier' },
            { status: 500 }
        )
    }
} 