import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { createClient } from '@supabase/supabase-js'

export async function GET() {
    try {
        console.log('🔍 Debugging RLS and Permissions...')

        // Test with anon key (what your app uses)
        console.log('Testing with ANON key...')
        const { data: anonUsers, error: anonError } = await supabase
            .from('users')
            .select('*')

        console.log(`Anon key - Users: ${anonUsers?.length || 0}`)
        if (anonError) {
            console.log(`Anon key error: ${anonError.message}`)
        }

        // Test with service role key (admin access)
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
        const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

        const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
            auth: { autoRefreshToken: false, persistSession: false }
        })

        console.log('Testing with SERVICE ROLE key...')
        const { data: adminUsers, error: adminError } = await supabaseAdmin
            .from('users')
            .select('*')

        console.log(`Service role - Users: ${adminUsers?.length || 0}`)
        if (adminError) {
            console.log(`Service role error: ${adminError.message}`)
        }

        // Test pharmacies
        const { data: anonPharmacies } = await supabase
            .from('pharmacies')
            .select('*')

        const { data: adminPharmacies } = await supabaseAdmin
            .from('pharmacies')
            .select('*')

        console.log(`Anon key - Pharmacies: ${anonPharmacies?.length || 0}`)
        console.log(`Service role - Pharmacies: ${adminPharmacies?.length || 0}`)

        // Check if RLS is enabled
        const { data: rlsStatus } = await supabaseAdmin
            .from('pg_class')
            .select('relname, relrowsecurity')
            .in('relname', ['users', 'pharmacies', 'suppliers', 'medicines'])

        console.log('RLS Status:')
        rlsStatus?.forEach(table => {
            console.log(`  ${table.relname}: ${table.relrowsecurity ? 'ENABLED' : 'DISABLED'}`)
        })

        return NextResponse.json({
            status: 'RLS Debug Results',
            anonKey: {
                users: anonUsers?.length || 0,
                pharmacies: anonPharmacies?.length || 0,
                error: anonError?.message
            },
            serviceRole: {
                users: adminUsers?.length || 0,
                pharmacies: adminPharmacies?.length || 0,
                error: adminError?.message
            },
            rlsStatus: rlsStatus,
            diagnosis: {
                issue: adminUsers && adminUsers.length > 0 && (!anonUsers || anonUsers.length === 0)
                    ? 'RLS is blocking anon key access'
                    : 'Other issue',
                solution: adminUsers && adminUsers.length > 0 && (!anonUsers || anonUsers.length === 0)
                    ? 'Disable RLS temporarily or add proper policies'
                    : 'Check data existence and permissions'
            },
            sqlFix: `-- Run this in Supabase SQL Editor to temporarily disable RLS:
ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.pharmacies DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.medicines DISABLE ROW LEVEL SECURITY;
-- medicine_categories table removed

-- After testing, you can re-enable with proper policies:
-- ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;`
        })

    } catch (error) {
        console.error('Debug error:', error)
        return NextResponse.json({
            status: 'error',
            error: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 })
    }
} 