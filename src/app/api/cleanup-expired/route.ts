import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { cleanupExpiredMedicines } from '@/lib/cron/cleanup-logic'

// Use service role key for admin operations (bypasses RLS)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing Supabase environment variables')
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
})

export async function POST(request: NextRequest) {
    try {
        // Verify authentication - either from user or Vercel Cron
        const authorization = request.headers.get('authorization')
        const isVercelCron = request.headers.get('user-agent')?.includes('vercel-cron')
        
        // Allow if either authenticated user OR Vercel Cron
        if (!authorization && !isVercelCron) {
            return NextResponse.json(
                { error: 'Authentication required' },
                { status: 401 }
            )
        }

        let pharmacyId: string | undefined = undefined

        // If it's a user request (not cron), get their pharmacy ID
        if (authorization && !isVercelCron) {
            // Extract the JWT token from the Authorization header
            const token = authorization.replace('Bearer ', '')
            
            // Get user from token
            const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
            
            if (authError || !user) {
                return NextResponse.json(
                    { error: 'Invalid authentication token' },
                    { status: 401 }
                )
            }

            // Get user's pharmacy from user_pharmacies table
            const { data: userPharmacy, error: pharmacyError } = await supabaseAdmin
                .from('user_pharmacies')
                .select('pharmacy_id')
                .eq('user_id', user.id)
                .single()

            if (pharmacyError || !userPharmacy) {
                return NextResponse.json(
                    { error: 'User pharmacy not found' },
                    { status: 404 }
                )
            }

            pharmacyId = userPharmacy.pharmacy_id
        }

        // Call the shared cleanup function
        // If pharmacyId is provided (user request), it will only clean that pharmacy
        // If pharmacyId is undefined (cron request), it will clean all pharmacies
        const result = await cleanupExpiredMedicines(supabaseAdmin, pharmacyId)
        
        if (!result.success) {
            return NextResponse.json(result, { status: 500 })
        }
        
        return NextResponse.json(result)
        
    } catch (error) {
        console.error('Cleanup error:', error)
        return NextResponse.json(
            { 
                success: false,
                error: error instanceof Error ? error.message : 'An error occurred during cleanup' 
            },
            { status: 500 }
        )
    }
}
