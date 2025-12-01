import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url)
        const search = searchParams.get('search')
        const limit = parseInt(searchParams.get('limit') || '20')

        // Get the first pharmacy
        const { data: pharmacy } = await supabase
            .from('pharmacies')
            .select('id')
            .limit(1)
            .single()

        if (!pharmacy) {
            return NextResponse.json([])
        }

        // Query purchase_items for unique batch numbers
        let query = supabase
            .from('purchase_items')
            .select(`
                batch_number,
                expiry_date,
                medicines(
                    name,
                    generic_name
                ),
                purchases!inner(
                    pharmacy_id
                )
            `)
            .eq('purchases.pharmacy_id', pharmacy.id)

        // Add search filter if provided (case insensitive)
        if (search && search.trim()) {
            query = query.ilike('batch_number', `%${search.trim().toLowerCase()}%`)
        }

        const { data: batchData, error } = await query
            .order('batch_number', { ascending: true })
            .limit(limit * 2) // Get more to account for duplicates

        if (error) {
            console.error('Batch numbers fetch error:', error)
            return NextResponse.json(
                { error: 'Failed to fetch batch numbers' },
                { status: 500 }
            )
        }

        // Extract unique batch numbers with additional info
        const uniqueBatches = new Map<string, any>()
        
        batchData?.forEach(item => {
            if (item.batch_number && !uniqueBatches.has(item.batch_number)) {
                uniqueBatches.set(item.batch_number, {
                    batch_number: item.batch_number,
                    expiry_date: item.expiry_date,
                    medicine_name: item.medicines?.name,
                    medicine_generic: item.medicines?.generic_name
                })
            }
        })

        // Convert to array and limit results
        const result = Array.from(uniqueBatches.values()).slice(0, limit)

        console.log(`🔍 Batch numbers search results:`, {
            searchQuery: search,
            resultCount: result.length,
            sampleBatches: result.slice(0, 3).map(b => b.batch_number)
        })

        return NextResponse.json(result)
    } catch (error) {
        console.error('API error:', error)
        return NextResponse.json(
            { error: 'Failed to fetch batch numbers' },
            { status: 500 }
        )
    }
}
