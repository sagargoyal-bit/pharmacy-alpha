import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { createClient } from '@supabase/supabase-js'

export async function GET() {
    try {
        console.log('🔍 Checking RLS Status...')

        // Use service role to check RLS status
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
        const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

        const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
            auth: { autoRefreshToken: false, persistSession: false }
        })

        // Check RLS status on key tables
        const { data: rlsStatus } = await supabaseAdmin
            .from('pg_class')
            .select('relname, relrowsecurity')
            .in('relname', ['users', 'pharmacies', 'purchases', 'suppliers'])

        // Test INSERT permissions with anon key (using suppliers table instead of removed medicine_categories)
        console.log('Testing INSERT with anon key...')
        const testResult = await supabase
            .from('suppliers')
            .insert({ name: 'TEST_SUPPLIER_' + Date.now(), pharmacy_id: '00000000-0000-0000-0000-000000000000' })
            .select()

        const insertWorks = !testResult.error

        // Check current policies
        const { data: policies } = await supabaseAdmin
            .from('pg_policies')
            .select('tablename, policyname, cmd, permissive')
            .eq('schemaname', 'public')
            .in('tablename', ['users', 'pharmacies', 'purchases', 'suppliers'])

        console.log('Current RLS Status:')
        console.log('- Insert test:', insertWorks ? 'WORKS' : 'BLOCKED')
        console.log('- Policies found:', policies?.length || 0)

        // Clean up test data
        if (insertWorks && testResult.data) {
            await supabase
                .from('suppliers')
                .delete()
                .eq('id', testResult.data[0].id)
        }

        return NextResponse.json({
            status: 'RLS Status Check',
            insertPermissions: insertWorks ? 'ALLOWED' : 'BLOCKED',
            policies: policies?.length || 0,
            rlsEnabled: rlsStatus?.some((table: any) => table.relrowsecurity) || false,
            issue: !insertWorks ? 'RLS is blocking INSERT operations' : 'RLS is properly configured',
            quickFix: !insertWorks ? 'Disable RLS temporarily or add proper anonymous policies' : 'No fix needed',
            solutions: {
                solution1: {
                    title: 'Quick Fix: Disable RLS (Development)',
                    sql: `-- Run in Supabase SQL Editor:
ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.pharmacies DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchases DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.medicines DISABLE ROW LEVEL SECURITY;
-- medicine_categories table removed
ALTER TABLE public.current_inventory DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_transactions DISABLE ROW LEVEL SECURITY;
-- expiry_alerts table removed
ALTER TABLE public.pharmacy_settings DISABLE ROW LEVEL SECURITY;`
                },
                solution2: {
                    title: 'Alternative: Add Anonymous INSERT Policies',
                    sql: `-- Run in Supabase SQL Editor:
CREATE POLICY "Allow anon insert purchases" ON public.purchases
FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow anon insert purchase_items" ON public.purchase_items  
FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow anon insert suppliers" ON public.suppliers
FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow anon insert medicines" ON public.medicines
FOR INSERT WITH CHECK (true);`
                }
            },
            recommendation: 'For development: Use Solution 1 (disable RLS). For production: Implement proper authentication.'
        })

    } catch (error) {
        console.error('RLS check error:', error)
        return NextResponse.json({
            status: 'error',
            error: error instanceof Error ? error.message : 'Unknown error',
            quickFix: 'Run the disable RLS SQL in Supabase SQL Editor'
        }, { status: 500 })
    }
} 