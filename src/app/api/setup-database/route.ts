import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function POST() {
    try {
        console.log('🔧 Setting up basic database data...')
        console.log('Note: Medicine categories functionality has been removed')

        // Add some basic medicines (without categories)
        const { data: medicines } = await supabase
            .from('medicines')
            .select('*')

        if (medicines && medicines.length === 0) {
            console.log('Adding basic medicines...')

            const { error: medError } = await supabase
                .from('medicines')
                .insert([
                    {
                        name: 'Paracetamol',
                        generic_name: 'Paracetamol',
                        manufacturer: 'GSK',
                        strength: '650mg',
                        unit_type: 'strips',
                        prescription_required: false,
                        is_active: true
                    },
                    {
                        name: 'Ibuprofen',
                        generic_name: 'Ibuprofen',
                        manufacturer: 'Abbott',
                        strength: '400mg',
                        unit_type: 'strips',
                        prescription_required: false,
                        is_active: true
                    }
                ])

            if (medError) {
                console.error('Failed to insert medicines:', medError)
            } else {
                console.log('✅ Basic medicines added')
            }
        }

        return NextResponse.json({
            success: true,
            message: 'Database setup completed (medicine categories removed)',
            data: {
                medicines: medicines?.length || 0
            }
        })

    } catch (error) {
        console.error('Setup error:', error)
        return NextResponse.json({
            error: 'Setup failed',
            details: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 })
    }
} 
} 