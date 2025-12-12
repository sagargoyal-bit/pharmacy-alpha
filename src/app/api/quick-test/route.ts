import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET() {
    try {
        // Test 1: Count users
        const { data: users, error: userError } = await supabase
            .from('users')
            .select('id, email, role')

        // Test 2: Count pharmacies
        const { data: pharmacies, error: pharmError } = await supabase
            .from('pharmacies')
            .select('id, name, owner_id')

        // Test 3: Count suppliers (medicine_categories table removed)
        const { data: suppliers, error: suppError } = await supabase
            .from('suppliers')
            .select('id, name')

        console.log('Quick Test Results:')
        console.log(`- Users: ${users?.length || 0}`)
        console.log(`- Pharmacies: ${pharmacies?.length || 0}`)
        console.log(`- Suppliers: ${suppliers?.length || 0}`)

        if (users?.length) {
            console.log('Users found:')
            users.forEach(user => console.log(`  - ${user.email} (${user.role})`))
        }

        return NextResponse.json({
            status: 'success',
            data: {
                users: users?.length || 0,
                pharmacies: pharmacies?.length || 0,
                suppliers: suppliers?.length || 0,
                userList: users || [],
                pharmacyList: pharmacies || []
            },
            ready: users && users.length > 0 && pharmacies && pharmacies.length > 0,
            message: users && users.length > 0 && pharmacies && pharmacies.length > 0
                ? 'Database is ready! You can now test purchases.'
                : 'Please run the SQL from /api/get-auth-users first'
        })

    } catch (error) {
        console.error('Quick test error:', error)
        return NextResponse.json({
            status: 'error',
            error: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 })
    }
} 