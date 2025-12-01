import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url)
        const search = searchParams.get('search')
        const category = searchParams.get('category')
        const page = parseInt(searchParams.get('page') || '1')
        const limit = parseInt(searchParams.get('limit') || '50')
        const offset = (page - 1) * limit

        let query = supabase
            .from('medicines')
            .select(`
        *,
        medicine_categories(
          id,
          name
        )
      `)
            .eq('is_active', true)

        // Add search filter (case insensitive)
        if (search) {
            const searchTerm = search.trim().toLowerCase()
            query = query.or(`name.ilike.%${searchTerm}%,generic_name.ilike.%${searchTerm}%,manufacturer.ilike.%${searchTerm}%`)
        }

        // Add category filter
        if (category) {
            query = query.eq('category_id', category)
        }

        const { data: medicines, error } = await query
            .order('name', { ascending: true })
            .range(offset, offset + limit - 1)

        if (error) {
            console.error('Medicines fetch error:', error)
            return NextResponse.json(
                { error: 'Failed to fetch medicines' },
                { status: 500 }
            )
        }

        return NextResponse.json(medicines || [])
    } catch (error) {
        console.error('API error:', error)
        return NextResponse.json(
            { error: 'Failed to fetch medicines' },
            { status: 500 }
        )
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()

        // Validate required fields
        if (!body.name || !body.manufacturer) {
            return NextResponse.json(
                { error: 'Name and manufacturer are required' },
                { status: 400 }
            )
        }

        // Create new medicine
        const { data: medicine, error } = await supabase
            .from('medicines')
            .insert({
                name: body.name,
                generic_name: body.generic_name || body.name,
                brand_name: body.brand_name,
                manufacturer: body.manufacturer,
                category_id: body.category_id,
                composition: body.composition,
                strength: body.strength,
                dosage_form: body.dosage_form,
                pack_size: body.pack_size,
                unit_type: body.unit_type || 'strips',
                hsn_code: body.hsn_code,
                prescription_required: body.prescription_required || false,
                storage_conditions: body.storage_conditions,
                is_active: true
            })
            .select(`
        *,
        medicine_categories(
          id,
          name
        )
      `)
            .single()

        if (error) {
            console.error('Medicine creation error:', error)
            return NextResponse.json(
                { error: 'Failed to create medicine' },
                { status: 500 }
            )
        }

        return NextResponse.json(medicine, { status: 201 })
    } catch (error) {
        console.error('API error:', error)
        return NextResponse.json(
            { error: 'Failed to create medicine' },
            { status: 500 }
        )
    }
} 