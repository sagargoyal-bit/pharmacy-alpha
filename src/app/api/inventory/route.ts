import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/auth/supabase-server'

export async function GET(request: NextRequest) {
    try {
        // Get authenticated user and supabase client
        const { user, supabase } = await getAuthenticatedUser(request)
        
        const { searchParams } = new URL(request.url)
        const lowStock = searchParams.get('lowStock') === 'true'
        const search = searchParams.get('search')
        const page = parseInt(searchParams.get('page') || '1')
        const limit = parseInt(searchParams.get('limit') || '50')
        const offset = (page - 1) * limit

        // Use the view for current stock summary - RLS will filter to user's pharmacy
        let query = supabase
            .from('view_current_stock_summary')
            .select('*')

        // Add search filter
        if (search) {
            query = query.or(`medicine_name.ilike.%${search}%,generic_name.ilike.%${search}%,manufacturer.ilike.%${search}%`)
        }

        // Add low stock filter
        if (lowStock) {
            query = query.lte('total_stock', 20) // Assuming 20 as low stock threshold
        }

        const { data: inventory, error } = await query
            .order('medicine_name', { ascending: true })
            .range(offset, offset + limit - 1)

        if (error) {
            console.error('Inventory fetch error:', error)
            return NextResponse.json(
                { error: 'Failed to fetch inventory' },
                { status: 500 }
            )
        }

        return NextResponse.json(inventory || [])
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
            { error: 'Failed to fetch inventory' },
            { status: 500 }
        )
    }
} 