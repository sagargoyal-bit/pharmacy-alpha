import { createSlice, PayloadAction } from '@reduxjs/toolkit'

export interface Notification {
    id: string
    type: 'success' | 'error' | 'warning' | 'info'
    title: string
    message: string
    duration?: number
}

interface UiState {
    // Modal states
    modals: {
        purchaseEntry: boolean
        medicineEntry: boolean
        supplierEntry: boolean
        confirmDialog: boolean
    }

    // Loading states
    loading: {
        global: boolean
        purchases: boolean
        inventory: boolean
        expiry: boolean
    }

    // Notifications
    notifications: Notification[]

    // Filters and search
    filters: {
        purchases: {
            supplier: string
            dateFrom: string
            dateTo: string
            searchTerm: string
        }
        inventory: {
            // category removed - medicine_categories table no longer exists
            lowStock: boolean
            searchTerm: string
        }
        expiry: {
            daysRange: number
            searchTerm: string
        }
    }

    // Sidebar state
    sidebarOpen: boolean
}

const initialState: UiState = {
    modals: {
        purchaseEntry: false,
        medicineEntry: false,
        supplierEntry: false,
        confirmDialog: false,
    },
    loading: {
        global: false,
        purchases: false,
        inventory: false,
        expiry: false,
    },
    notifications: [],
    filters: {
        purchases: {
            supplier: '',
            dateFrom: '',
            dateTo: '',
            searchTerm: '',
        },
        inventory: {
            // category removed - medicine_categories table no longer exists
            lowStock: false,
            searchTerm: '',
        },
        expiry: {
            daysRange: 90,
            searchTerm: '',
        },
    },
    sidebarOpen: false,
}

export const uiSlice = createSlice({
    name: 'ui',
    initialState,
    reducers: {
        // Modal actions
        openModal: (state, action: PayloadAction<keyof UiState['modals']>) => {
            state.modals[action.payload] = true
        },
        closeModal: (state, action: PayloadAction<keyof UiState['modals']>) => {
            state.modals[action.payload] = false
        },
        closeAllModals: (state) => {
            Object.keys(state.modals).forEach((key) => {
                state.modals[key as keyof UiState['modals']] = false
            })
        },

        // Loading actions
        setLoading: (state, action: PayloadAction<{ key: keyof UiState['loading']; loading: boolean }>) => {
            state.loading[action.payload.key] = action.payload.loading
        },

        // Notification actions
        addNotification: (state, action: PayloadAction<Omit<Notification, 'id'>>) => {
            const notification: Notification = {
                ...action.payload,
                id: Date.now().toString() + Math.random().toString(36).substring(2),
            }
            state.notifications.push(notification)
        },
        removeNotification: (state, action: PayloadAction<string>) => {
            state.notifications = state.notifications.filter((n) => n.id !== action.payload)
        },
        clearNotifications: (state) => {
            state.notifications = []
        },

        // Filter actions
        setPurchaseFilter: (state, action: PayloadAction<Partial<UiState['filters']['purchases']>>) => {
            state.filters.purchases = { ...state.filters.purchases, ...action.payload }
        },
        setInventoryFilter: (state, action: PayloadAction<Partial<UiState['filters']['inventory']>>) => {
            state.filters.inventory = { ...state.filters.inventory, ...action.payload }
        },
        setExpiryFilter: (state, action: PayloadAction<Partial<UiState['filters']['expiry']>>) => {
            state.filters.expiry = { ...state.filters.expiry, ...action.payload }
        },
        clearFilters: (state) => {
            state.filters = initialState.filters
        },

        // Sidebar actions
        toggleSidebar: (state) => {
            state.sidebarOpen = !state.sidebarOpen
        },
        setSidebarOpen: (state, action: PayloadAction<boolean>) => {
            state.sidebarOpen = action.payload
        },
    },
})

export const {
    openModal,
    closeModal,
    closeAllModals,
    setLoading,
    addNotification,
    removeNotification,
    clearNotifications,
    setPurchaseFilter,
    setInventoryFilter,
    setExpiryFilter,
    clearFilters,
    toggleSidebar,
    setSidebarOpen,
} = uiSlice.actions

export default uiSlice.reducer 