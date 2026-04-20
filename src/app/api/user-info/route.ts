import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/auth/supabase-server'

export async function GET(request: NextRequest) {
    try {
        const { user: authUser, supabase } = await getAuthenticatedUser(request)

        // Run user and user_pharmacies queries in parallel (both use authUser.id)
        const [userResult, userPharmacyResult] = await Promise.all([
            supabase
                .from('users')
                .select('id, email, full_name, phone, role, is_active, created_at, updated_at')
                .eq('id', authUser.id)
                .single(),
            supabase
                .from('user_pharmacies')
                .select('role, is_active, pharmacy_id, created_at')
                .eq('user_id', authUser.id)
                .eq('is_active', true)
                .limit(1)
                .single(),
        ])

        if (userResult.error || !userResult.data) {
            return NextResponse.json(
                { error: 'User not found' },
                { status: 404 }
            )
        }

        if (userPharmacyResult.error || !userPharmacyResult.data) {
            return NextResponse.json(
                { error: 'Pharmacy association not found' },
                { status: 404 }
            )
        }

        const user = userResult.data
        const userPharmacy = userPharmacyResult.data

        // Run pharmacy details + all 3 count queries in parallel
        const [pharmacyResult, medicinesCount, suppliersCount, purchasesCount] = await Promise.all([
            supabase
                .from('pharmacies')
                .select('id, name, license_number, gst_number, address, city, state, pincode, phone, email, owner_id, is_active, created_at, updated_at, last_cleanup_date')
                .eq('id', userPharmacy.pharmacy_id)
                .single(),
            supabase
                .from('medicines')
                .select('id', { count: 'exact', head: true }),
            supabase
                .from('suppliers')
                .select('id', { count: 'exact', head: true })
                .eq('pharmacy_id', userPharmacy.pharmacy_id),
            supabase
                .from('purchases')
                .select('id', { count: 'exact', head: true })
                .eq('pharmacy_id', userPharmacy.pharmacy_id),
        ])

        if (pharmacyResult.error || !pharmacyResult.data) {
            return NextResponse.json(
                { error: 'Pharmacy not found' },
                { status: 404 }
            )
        }

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
                ...pharmacyResult.data,
                statistics: {
                    total_medicines: medicinesCount.count || 0,
                    total_suppliers: suppliersCount.count || 0,
                    total_purchases: purchasesCount.count || 0
                }
            }
        })

    } catch (error) {
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
