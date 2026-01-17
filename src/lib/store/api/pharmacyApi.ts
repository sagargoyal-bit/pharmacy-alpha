import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react'
import { Medicine, Purchase, Supplier } from '@/lib/supabase'
import { supabase } from '@/lib/supabase'

// Enhanced interfaces for API operations
export interface CreatePurchaseRequest {
    supplier_name: string
    invoice_number: string
    date: string
    items: {
        medicine_name: string
        pack?: string
        quantity: number
        expiry_date: string
        batch_number?: string
        mrp?: number
        rate: number
        amount: number
    }[]
}

export interface PurchaseResponse extends Purchase {
    supplier?: Supplier
    items?: PurchaseItem[]
}

export interface PurchaseItem {
    id: string
    purchase_id: string
    medicine_name: string
    pack?: string
    quantity: number
    expiry_date: string
    batch_number?: string
    mrp?: number
    rate: number
    amount: number
}

export interface PurchaseSearchResult {
    id: string
    purchase_id: string
    purchase_item_id?: string
    medicine_name: string
    generic_name?: string
    supplier_name: string
    batch_number: string
    quantity: number
    weight?: number
    purchase_rate: number
    mrp: number
    expiry_date: string | null
    purchase_date: string
    invoice_number: string
    total_amount: number
    manufacturer?: string
    strength?: string
    unit_type?: string
}

export interface PurchaseSearchFilters {
    medicine_name?: string
    supplier_name?: string
    batch_number?: string
    date?: string
    page?: number
    limit?: number
}

export interface InventoryItem {
    medicine_name: string
    total_quantity: number
    current_stock: number
    expiring_soon: number
    total_value: number
    last_purchase_date: string
}

export interface ExpiryAlert {
    medicine_name: string
    supplier_name?: string
    batch_number?: string
    quantity: number
    expiry_date: string
    days_to_expiry: number
    estimated_loss: number
    mrp?: number
}

export interface ExpiryAlertsResponse {
    data: ExpiryAlert[]
    total: number
    page: number
    limit: number
    totalPages: number
    totalValueAtRisk: number
}

export interface ExpiryStats {
    expiredThisWeek: number
    expiringIn30Days: number
    expiringIn90Days: number
    valueAtRisk: number
    recentExpiries: Array<{
        medicine_name: string
        batch_number?: string
        quantity: number
        expiry_date: string
        days_to_expiry: number
        mrp?: number
        supplier_name?: string
    }>
}

export const pharmacyApi = createApi({
    reducerPath: 'pharmacyApi',
    baseQuery: fetchBaseQuery({
        baseUrl: '/api/',
        prepareHeaders: async (headers) => {
            // Get the current session and add auth header
            const { data: { session } } = await supabase.auth.getSession()
            if (session?.access_token) {
                headers.set('authorization', `Bearer ${session.access_token}`)
            }
            return headers
        },
    }),
    tagTypes: ['Purchase', 'Medicine', 'Supplier', 'Inventory', 'Expiry', 'PurchaseStats'],
    endpoints: (builder) => ({
        // Purchase endpoints
        getPurchases: builder.query<PurchaseResponse[], { page?: number; limit?: number }>({
            query: ({ page = 1, limit = 10 } = {}) => `purchases?page=${page}&limit=${limit}`,
            providesTags: ['Purchase'],
        }),

        searchPurchases: builder.query<PurchaseSearchResult[], PurchaseSearchFilters>({
            query: (filters) => {
                const params = new URLSearchParams()
                if (filters.medicine_name) params.append('medicine_name', filters.medicine_name)
                if (filters.supplier_name) params.append('supplier_name', filters.supplier_name)
                if (filters.batch_number) params.append('batch_number', filters.batch_number)
                if (filters.date) params.append('date', filters.date)
                params.append('page', (filters.page || 1).toString())
                params.append('limit', (filters.limit || 50).toString())

                return `purchases?${params.toString()}`
            },
            providesTags: ['Purchase'],
        }),

        getPurchaseById: builder.query<PurchaseResponse, string>({
            query: (id) => `purchases/${id}`,
            providesTags: (result, error, id) => [{ type: 'Purchase', id }],
        }),

        createPurchase: builder.mutation<PurchaseResponse, CreatePurchaseRequest>({
            query: (purchase) => ({
                url: 'purchases',
                method: 'POST',
                body: purchase,
            }),
            invalidatesTags: ['Purchase', 'PurchaseStats', 'Inventory', 'Expiry'],
        }),

        updatePurchase: builder.mutation<PurchaseResponse, { id: string; data: Partial<CreatePurchaseRequest> }>({
            query: ({ id, data }) => ({
                url: `purchases/${id}`,
                method: 'PUT',
                body: data,
            }),
            invalidatesTags: (result, error, { id }) => [
                { type: 'Purchase', id },
                'Inventory',
                'Expiry',
            ],
        }),

        deletePurchase: builder.mutation<void, string>({
            query: (id) => ({
                url: `purchases/${id}`,
                method: 'DELETE',
            }),
            invalidatesTags: ['Purchase', 'Inventory', 'Expiry'],
        }),

        updatePurchaseItem: builder.mutation<PurchaseSearchResult, { purchase_item_id: string; data: Partial<PurchaseSearchResult> }>({
            query: ({ purchase_item_id, data }) => ({
                url: 'purchases',
                method: 'PUT',
                body: { purchase_item_id, ...data },
            }),
            invalidatesTags: ['Purchase', 'PurchaseStats', 'Inventory', 'Expiry'],
        }),

        deletePurchaseItem: builder.mutation<void, string>({
            query: (purchase_item_id) => ({
                url: `purchases?purchase_item_id=${purchase_item_id}`,
                method: 'DELETE',
            }),
            invalidatesTags: ['Purchase', 'PurchaseStats', 'Inventory', 'Expiry'],
        }),

        // Medicine endpoints
        getMedicines: builder.query<Medicine[], void>({
            query: () => 'medicines',
            providesTags: ['Medicine'],
        }),

        createMedicine: builder.mutation<Medicine, Omit<Medicine, 'id' | 'created_at'>>({
            query: (medicine) => ({
                url: 'medicines',
                method: 'POST',
                body: medicine,
            }),
            invalidatesTags: ['Medicine'],
        }),

        // Supplier endpoints
        getSuppliers: builder.query<Supplier[], { search?: string; page?: number; limit?: number } | void>({
            query: (params) => {
                if (!params) return 'suppliers'

                const searchParams = new URLSearchParams()
                if (params.search) searchParams.append('search', params.search)
                if (params.page) searchParams.append('page', params.page.toString())
                if (params.limit) searchParams.append('limit', params.limit.toString())

                return `suppliers?${searchParams.toString()}`
            },
            providesTags: ['Supplier'],
        }),

        createSupplier: builder.mutation<Supplier, Omit<Supplier, 'id' | 'created_at'>>({
            query: (supplier) => ({
                url: 'suppliers',
                method: 'POST',
                body: supplier,
            }),
            invalidatesTags: ['Supplier'],
        }),

        updateSupplier: builder.mutation<{ supplier: Supplier; message: string }, { supplier_id: string; new_name: string }>({
            query: ({ supplier_id, new_name }) => ({
                url: 'suppliers',
                method: 'PUT',
                body: { supplier_id, new_name },
            }),
            invalidatesTags: ['Supplier', 'Purchase', 'PurchaseStats'],
        }),

        // Inventory endpoints
        getInventory: builder.query<InventoryItem[], void>({
            query: () => 'inventory',
            providesTags: ['Inventory'],
        }),

        updateStock: builder.mutation<void, { medicine_name: string; quantity: number; operation: 'add' | 'subtract' }>({
            query: (data) => ({
                url: 'inventory/update-stock',
                method: 'POST',
                body: data,
            }),
            invalidatesTags: ['Inventory'],
        }),

        // Expiry tracking endpoints
        getExpiryAlerts: builder.query<ExpiryAlertsResponse, {
            days?: number;
            medicine_name?: string;
            batch_number?: string;
            supplier_name?: string;
            start_date?: string;
            end_date?: string;
            status?: string;
            page?: number;
            limit?: number;
        }>({
            query: (params = {}) => {
                const searchParams = new URLSearchParams()
                if (params.days) searchParams.append('days', params.days.toString())
                if (params.medicine_name) searchParams.append('medicine_name', params.medicine_name)
                if (params.batch_number) searchParams.append('batch_number', params.batch_number)
                if (params.supplier_name) searchParams.append('supplier_name', params.supplier_name)
                if (params.start_date) searchParams.append('start_date', params.start_date)
                if (params.end_date) searchParams.append('end_date', params.end_date)
                if (params.status) searchParams.append('status', params.status)
                if (params.page) searchParams.append('page', params.page.toString())
                if (params.limit) searchParams.append('limit', params.limit.toString())

                return `expiry?${searchParams.toString()}`
            },
            providesTags: ['Expiry'],
        }),

        getExpiredMedicines: builder.query<ExpiryAlert[], void>({
            query: () => 'expiry/expired',
            providesTags: ['Expiry'],
        }),

        getExpiryStats: builder.query<ExpiryStats, void>({
            query: () => 'expiry?type=stats',
            providesTags: ['Expiry'],
        }),

        // Dashboard stats
        getDashboardStats: builder.query<{
            total_medicines: number
            total_medicines_change: number
            total_medicines_trend: 'up' | 'down' | 'neutral'
            todays_purchases: number
            todays_purchases_change: number
            todays_purchases_trend: 'up' | 'down' | 'neutral'
            expiring_soon: number
            expiring_soon_change: number
            expiring_soon_trend: 'up' | 'down' | 'neutral'
            stock_value: number
            stock_value_change: number
            stock_value_trend: 'up' | 'down' | 'neutral'
            recent_activity: {
                id: string
                action: string
                time: string
                type: string
            }[]
        }, void>({
            query: () => 'dashboard/stats',
            providesTags: ['Purchase', 'Inventory', 'Expiry'],
        }),

        // Purchases page stats
        getPurchasesStats: builder.query<{
            todaysPurchases: number
            thisMonth: number
            totalEntries: number
            differentSuppliers: number
            recentPurchases: Array<{
                id: string
                medicine_name: string
                supplier: string
                quantity: number
                rate: number
                mrp: number
                expiry_date: string
                total: number
                purchase_date: string
                items_count: number
            }>
        }, void>({
            query: () => 'purchases/stats',
            providesTags: ['Purchase', 'PurchaseStats'],
        }),
    }),
})

// Export hooks for usage in functional components
export const {
    useGetPurchasesQuery,
    useSearchPurchasesQuery,
    useGetPurchaseByIdQuery,
    useCreatePurchaseMutation,
    useUpdatePurchaseMutation,
    useDeletePurchaseMutation,
    useUpdatePurchaseItemMutation,
    useDeletePurchaseItemMutation,
    useGetMedicinesQuery,
    useCreateMedicineMutation,
    useGetSuppliersQuery,
    useCreateSupplierMutation,
    useUpdateSupplierMutation,
    useGetInventoryQuery,
    useUpdateStockMutation,
    useGetExpiryAlertsQuery,
    useGetExpiredMedicinesQuery,
    useGetExpiryStatsQuery,
    useGetDashboardStatsQuery,
    useGetPurchasesStatsQuery,
} = pharmacyApi 