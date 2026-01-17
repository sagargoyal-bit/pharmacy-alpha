import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase environment variables')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Database Types (simplified for TypeScript support)
export interface Medicine {
    id: string
    name: string
    generic_name: string
    brand_name?: string
    manufacturer: string
    // category_id removed - medicine_categories table no longer exists
    composition?: string
    strength?: string
    dosage_form?: string
    pack_size?: string
    unit_type: string
    hsn_code?: string
    prescription_required: boolean
    storage_conditions?: string
    is_active: boolean
    created_at: string
    updated_at: string
}

export interface Purchase {
    id: string
    pharmacy_id: string
    supplier_id: string
    user_id: string
    invoice_number: string
    invoice_date: string
    purchase_date: string
    total_amount: number
    payment_status: string
    payment_due_date?: string
    notes?: string
    status: string
    created_at: string
    updated_at: string
}

export interface Supplier {
    id: string
    pharmacy_id: string
    name: string
    contact_person?: string
    phone?: string
    email?: string
    address?: string
    city?: string
    state?: string
    pincode?: string
    gst_number?: string
    drug_license_number?: string
    credit_days: number
    credit_limit: number
    current_balance: number
    is_active: boolean
    created_at: string
    updated_at: string
}

export interface User {
    id: string
    email: string
    full_name: string
    phone?: string
    role: 'admin' | 'pharmacist' | 'staff'
    is_active: boolean
    created_at: string
    updated_at: string
}

export interface Pharmacy {
    id: string
    name: string
    license_number: string
    gst_number?: string
    address: string
    city: string
    state: string
    pincode: string
    phone: string
    email?: string
    owner_id: string
    is_active: boolean
    created_at: string
    updated_at: string
} 