import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET() {
    try {
        console.log('Testing database connection...')
        
        // Test basic connection
        const { data: connectionTest, error: connectionError } = await supabase
            .from('pharmacies')
            .select('count')
            .limit(1)

        if (connectionError) {
            console.error('Connection error:', connectionError)
            return NextResponse.json({
                status: 'error',
                message: 'Database connection failed',
                error: connectionError.message,
                details: connectionError
            }, { status: 500 })
        }

        // Test table existence and data
        const tables = ['pharmacies', 'medicines', 'current_inventory', 'purchases', 'stock_transactions']
        const tableStatus: Record<string, { exists: boolean; error?: string; count?: number }> = {}

        for (const table of tables) {
            try {
                const { data, error, count } = await supabase
                    .from(table)
                    .select('*', { count: 'exact', head: true })

                if (error) {
                    tableStatus[table] = { exists: false, error: error.message }
                } else {
                    tableStatus[table] = { exists: true, count: count || 0 }
                }
            } catch (err) {
                const errorMessage = err instanceof Error ? err.message : 'Unknown error'
                tableStatus[table] = { exists: false, error: errorMessage }
            }
        }

        // Test sample queries for dashboard
        const dashboardTests: Record<string, any> = {}

        // Test pharmacy existence
        try {
            const { data: pharmacies, error: pharmacyError } = await supabase
                .from('pharmacies')
                .select('id, name')
                .limit(1)

            dashboardTests.pharmacy = {
                success: !pharmacyError,
                data: pharmacies,
                error: pharmacyError?.message
            }
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Unknown error'
            dashboardTests.pharmacy = { success: false, error: errorMessage }
        }

        // Test medicines count
        try {
            const { data: medicines, error: medicineError } = await supabase
                .from('current_inventory')
                .select('medicine_id', { count: 'exact' })
                .gt('current_stock', 0)
                .limit(1)

            dashboardTests.medicines = {
                success: !medicineError,
                count: medicines?.length || 0,
                error: medicineError?.message
            }
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Unknown error'
            dashboardTests.medicines = { success: false, error: errorMessage }
        }

        // Test today's purchases
        try {
            const today = new Date().toISOString().split('T')[0]
            const { data: purchases, error: purchaseError } = await supabase
                .from('purchases')
                .select('total_amount')
                .eq('purchase_date', today)

            dashboardTests.purchases = {
                success: !purchaseError,
                count: purchases?.length || 0,
                total: purchases?.reduce((sum: number, p: any) => sum + (p.total_amount || 0), 0) || 0,
                error: purchaseError?.message
            }
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Unknown error'
            dashboardTests.purchases = { success: false, error: errorMessage }
        }

        return NextResponse.json({
            status: 'success',
            message: 'Database connection successful',
            timestamp: new Date().toISOString(),
            tableStatus,
            dashboardTests,
            environment: {
                supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ? 'Set' : 'Not Set',
                supabaseKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'Set' : 'Not Set'
            }
        })

    } catch (error) {
        console.error('Test connection error:', error)
        return NextResponse.json({
            status: 'error',
            message: 'Unexpected error during connection test',
            error: error.message,
            stack: error.stack
        }, { status: 500 })
    }
} 