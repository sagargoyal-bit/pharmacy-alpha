import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET() {
    try {
        // Get the first user (in a real app, this would be based on authentication)
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
            .limit(1)
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
                updated_at
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
        return NextResponse.json(
            { error: 'Failed to fetch user information' },
            { status: 500 }
        )
    }
}
