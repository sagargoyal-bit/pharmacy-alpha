import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/auth/supabase-server'

export async function GET(request: NextRequest) {
    try {
        const { user, supabase } = await getAuthenticatedUser(request)

        const { searchParams } = new URL(request.url)
        const search = searchParams.get('search')
        const limit = parseInt(searchParams.get('limit') || '20')

        const { data: userPharmacy } = await supabase
            .from('user_pharmacies')
            .select('pharmacy_id')
            .eq('user_id', user.id)
            .eq('is_active', true)
            .single()

        if (!userPharmacy) {
            return NextResponse.json([])
        }

        let query = supabase
            .from('purchase_items')
            .select(`
                batch_number,
                expiry_date,
                medicines(name),
                purchases!inner(pharmacy_id)
            `)
            .eq('purchases.pharmacy_id', userPharmacy.pharmacy_id)

        if (search && search.trim()) {
            query = query.ilike('batch_number', `%${search.trim().toLowerCase()}%`)
        }

        const { data: batchData, error } = await query
            .order('batch_number', { ascending: true })
            .limit(limit * 2)

        if (error) {
            return NextResponse.json(
                { error: 'Failed to fetch batch numbers' },
                { status: 500 }
            )
        }

        const uniqueBatches = new Map<string, any>()
        
        batchData?.forEach(item => {
            if (item.batch_number && !uniqueBatches.has(item.batch_number)) {
                uniqueBatches.set(item.batch_number, {
                    batch_number: item.batch_number,
                    expiry_date: item.expiry_date,
                    medicine_name: (item.medicines as any)?.name
                })
            }
        })

        const result = Array.from(uniqueBatches.values()).slice(0, limit)

        return NextResponse.json(result)
    } catch (error) {
        if (error instanceof Error && error.message.includes('Authentication')) {
            return NextResponse.json(
                { error: 'Authentication required' },
                { status: 401 }
            )
        }

        return NextResponse.json(
            { error: 'Failed to fetch batch numbers' },
            { status: 500 }
        )
    }
}
