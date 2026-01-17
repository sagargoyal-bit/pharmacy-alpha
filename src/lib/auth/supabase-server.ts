import { createClient } from '@supabase/supabase-js'
import { NextRequest } from 'next/server'

/**
 * Creates an authenticated Supabase client for server-side API routes
 * This client will respect RLS policies based on the authenticated user
 */
export function createAuthenticatedSupabaseClient(request: NextRequest) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    
    // Get the authorization header from the request
    const authorization = request.headers.get('authorization')
    
    if (!authorization) {
        throw new Error('No authorization header found')
    }

    // Create Supabase client with the user's session token
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
        global: {
            headers: {
                Authorization: authorization,
            },
        },
    })

    return supabase
}

/**
 * Gets the authenticated user from the request
 */
export async function getAuthenticatedUser(request: NextRequest) {
    try {
        const supabase = createAuthenticatedSupabaseClient(request)
        const { data: { user }, error } = await supabase.auth.getUser()
        
        if (error || !user) {
            throw new Error('User not authenticated')
        }
        
        return { user, supabase }
    } catch (error) {
        throw new Error('Authentication failed')
    }
}

/**
 * Gets the user's pharmacy ID
 */
export async function getUserPharmacyId(supabase: any, userId: string): Promise<string | null> {
    const { data, error } = await supabase
        .from('user_pharmacies')
        .select('pharmacy_id')
        .eq('user_id', userId)
        .eq('is_active', true)
        .single()
    
    if (error || !data) {
        return null
    }
    
    return data.pharmacy_id
}
