import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/auth/supabase-server'

export async function GET(request: NextRequest) {
    try {
        // Get authenticated user and supabase client
        const { user: authUser, supabase } = await getAuthenticatedUser(request)

        // Get the user details from the users table
        const { data: user, error: userError } = await supabase
            .from('users')
            .select(`
                id,
                email,
                full_name,
                phone,
                role,
                is_active,
                created_at,
                updated_at
            `)
            .eq('id', authUser.id)
            .single()

        if (userError || !user) {
            console.error('User fetch error:', userError)
            return NextResponse.json(
                { error: 'User not found' },
                { status: 404 }
            )
        }

        // Get the pharmacy associated with this user
        const { data: userPharmacy, error: userPharmacyError } = await supabase
            .from('user_pharmacies')
            .select(`
                role,
                is_active,
                pharmacy_id,
                created_at
            `)
            .eq('user_id', user.id)
            .eq('is_active', true)
            .limit(1)
            .single()

        if (userPharmacyError || !userPharmacy) {
            console.error('User-pharmacy relationship error:', userPharmacyError)
            return NextResponse.json(
                { error: 'Pharmacy association not found' },
                { status: 404 }
            )
        }

        // Get the pharmacy details
        const { data: pharmacy, error: pharmacyError } = await supabase
            .from('pharmacies')
            .select(`
                id,
                name,
                license_number,
                gst_number,
                address,
                city,
                state,
                pincode,
                phone,
                email,
                owner_id,
                is_active,
                created_at,
                updated_at,
                last_cleanup_date
            `)
            .eq('id', userPharmacy.pharmacy_id)
            .single()

        if (pharmacyError || !pharmacy) {
            console.error('Pharmacy fetch error:', pharmacyError)
            return NextResponse.json(
                { error: 'Pharmacy not found' },
                { status: 404 }
            )
        }

        // Get some basic statistics
        const [
            { count: totalMedicines },
            { count: totalSuppliers },
            { count: totalPurchases }
        ] = await Promise.all([
            supabase
                .from('medicines')
                .select('*', { count: 'exact', head: true }),
            supabase
                .from('suppliers')
                .select('*', { count: 'exact', head: true })
                .eq('pharmacy_id', pharmacy.id),
            supabase
                .from('purchases')
                .select('*', { count: 'exact', head: true })
                .eq('pharmacy_id', pharmacy.id)
        ])

        // Calculate user tenure
        const userCreatedDate = new Date(user.created_at)
        const now = new Date()
        const tenureInDays = Math.floor((now.getTime() - userCreatedDate.getTime()) / (1000 * 60 * 60 * 24))

        return NextResponse.json({
            user: {
                ...user,
                tenure_days: tenureInDays,
                pharmacy_role: userPharmacy.role
            },
            pharmacy: {
                ...pharmacy,
                statistics: {
                    total_medicines: totalMedicines || 0,
                    total_suppliers: totalSuppliers || 0,
                    total_purchases: totalPurchases || 0
                }
            }
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
            { error: 'Failed to fetch user information' },
            { status: 500 }
        )
    }
}
