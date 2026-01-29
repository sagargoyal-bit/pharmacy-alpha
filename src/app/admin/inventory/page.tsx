'use client'

import { useState, useEffect } from 'react'
import { useSearchPurchasesQuery, useUpdatePurchaseItemMutation, useDeletePurchaseItemMutation, useGetPurchasesStatsQuery, useGetSuppliersQuery, useUpdateSupplierMutation, type PurchaseSearchResult } from '@/lib/store/api/pharmacyApi'
import AutocompleteDropdown from '@/components/ui/AutocompleteDropdown'
import { supabase } from '@/lib/supabase'

export default function InventoryManagement() {
    const [filters, setFilters] = useState({
        medicine_name: '',
        supplier_name: '',
        batch_number: '',
        date: ''
    })

    // Debounced filters state
    const [debouncedFilters, setDebouncedFilters] = useState(filters)

    // Pagination state
    const [currentPage, setCurrentPage] = useState(1)
    const [pageSize] = useState(10)

    // Supplier editing state
    const [supplierEditMode, setSupplierEditMode] = useState(false)
    const [selectedSupplier, setSelectedSupplier] = useState<{ id: string; name: string } | null>(null)
    const [newSupplierName, setNewSupplierName] = useState('')

    // Supplier search state
    const [supplierSearchTerm, setSupplierSearchTerm] = useState('')
    const [debouncedSupplierSearch, setDebouncedSupplierSearch] = useState('')
    const [showSupplierDropdown, setShowSupplierDropdown] = useState(false)

    // Editing state
    const [editingRows, setEditingRows] = useState<Set<string>>(new Set())
    const [editValues, setEditValues] = useState<Record<string, Partial<PurchaseSearchResult>>>({})
    const [deleteConfirmation, setDeleteConfirmation] = useState<{
        isOpen: boolean
        itemId: string
        medicineName: string
    }>({
        isOpen: false,
        itemId: '',
        medicineName: ''
    })

    // Multi-select state
    const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set())
    const [isSelectAllChecked, setIsSelectAllChecked] = useState(false)
    const [isBulkDeleting, setIsBulkDeleting] = useState(false)
    const [bulkDeleteConfirmation, setBulkDeleteConfirmation] = useState<{
        isOpen: boolean
        items: PurchaseSearchResult[]
    }>({
        isOpen: false,
        items: []
    })

    // RTK Query mutations and queries
    const [updatePurchaseItem, { isLoading: isUpdating }] = useUpdatePurchaseItemMutation()
    const [deletePurchaseItem, { isLoading: isDeleting }] = useDeletePurchaseItemMutation()
    const [updateSupplier, { isLoading: isUpdatingSupplier }] = useUpdateSupplierMutation()

    // Add purchases stats query to trigger refetch after operations
    const { refetch: refetchStats } = useGetPurchasesStatsQuery()
    const { data: suppliers = [] } = useGetSuppliersQuery(
        debouncedSupplierSearch ? { search: debouncedSupplierSearch } : undefined
    )

    // Debounce the filters with 500ms delay
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedFilters(filters)
            setCurrentPage(1) // Reset to first page when filters change
        }, 500)

        return () => clearTimeout(timer)
    }, [filters])

    // Debounce supplier search with 300ms delay
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSupplierSearch(supplierSearchTerm)
        }, 300)

        return () => clearTimeout(timer)
    }, [supplierSearchTerm])

    // Only trigger search when at least one debounced filter has a value
    const hasFilters = Object.values(debouncedFilters).some(value => value.trim() !== '')

    // Build search parameters using debounced filters
    const searchParams = hasFilters ? {
        ...(debouncedFilters.medicine_name && { medicine_name: debouncedFilters.medicine_name }),
        ...(debouncedFilters.supplier_name && { supplier_name: debouncedFilters.supplier_name }),
        ...(debouncedFilters.batch_number && { batch_number: debouncedFilters.batch_number }),
        ...(debouncedFilters.date && { date: debouncedFilters.date }),
        page: currentPage,
        limit: pageSize
    } : undefined

    // RTK Query hook - only runs when searchParams is defined
    const { data: searchResults = [], isLoading, error, refetch } = useSearchPurchasesQuery(searchParams || {}, {
        skip: !hasFilters
    })

    // Clear selection when filters change or page changes
    useEffect(() => {
        handleClearSelection()
    }, [debouncedFilters, currentPage])

    const handleFilterChange = (field: string, value: string) => {
        setFilters({
            ...filters,
            [field]: value
        })
    }

    const clearFilters = () => {
        setFilters({
            medicine_name: '',
            supplier_name: '',
            batch_number: '',
            date: ''
        })
        setDebouncedFilters({
            medicine_name: '',
            supplier_name: '',
            batch_number: '',
            date: ''
        })
        setCurrentPage(1)
    }

    const handlePageChange = (newPage: number) => {
        setCurrentPage(newPage)
    }

    const handlePreviousPage = () => {
        if (currentPage > 1) {
            setCurrentPage(currentPage - 1)
        }
    }

    const handleNextPage = () => {
        if (searchResults.length === pageSize) { // If we got full page, there might be more
            setCurrentPage(currentPage + 1)
        }
    }

    const handleEdit = (item: PurchaseSearchResult) => {
        setEditingRows(prev => new Set(prev).add(item.id))
        setEditValues(prev => ({
            ...prev,
            [item.id]: {
                medicine_name: item.medicine_name,
                quantity: item.quantity,
                Free: item.Free,
                purchase_rate: item.purchase_rate,
                mrp: item.mrp,
                batch_number: item.batch_number,
                expiry_date: item.expiry_date ? item.expiry_date.split('T')[0] : ''
            }
        }))
    }

    const handleCancelEdit = (itemId: string) => {
        setEditingRows(prev => {
            const newSet = new Set(prev)
            newSet.delete(itemId)
            return newSet
        })
        setEditValues(prev => {
            const newValues = { ...prev }
            delete newValues[itemId]
            return newValues
        })
    }

    const handleFieldChange = (itemId: string, field: string, value: string) => {
        setEditValues(prev => ({
            ...prev,
            [itemId]: {
                ...prev[itemId],
                [field]: value
            }
        }))
    }

    const handleUpdate = async (item: PurchaseSearchResult) => {
        if (!item.purchase_item_id) {
            alert('Cannot update: Purchase item ID not found')
            return
        }

        try {
            const updateData = editValues[item.id]
            await updatePurchaseItem({
                purchase_item_id: item.purchase_item_id,
                data: updateData
            }).unwrap()

            // Success - exit edit mode and refresh data
            handleCancelEdit(item.id)
            if (hasFilters) {
                refetch() // Only refetch if search query is active
            }
            refetchStats() // Explicitly refetch stats after successful update

            // Show success message with medicine info if name was changed
            if (updateData.medicine_name && updateData.medicine_name !== item.medicine_name) {
                alert(`✅ Purchase updated! Medicine name changed to: ${updateData.medicine_name}`)
            }
        } catch (error: any) {
            console.error('Update failed:', error)
            
            // Check if it's a conflict error (duplicate entry)
            if (error?.status === 409 || error?.data?.code === 'DUPLICATE_ENTRY') {
                alert('❌ Cannot update: A purchase with this medicine name, batch number, and expiry date already exists.\n\nPlease change the batch number or expiry date to make this entry unique.')
            } else {
                alert('Failed to update purchase item. Please try again.')
            }
        }
    }

    const handleDeleteClick = (item: PurchaseSearchResult) => {
        setDeleteConfirmation({
            isOpen: true,
            itemId: item.id,
            medicineName: item.medicine_name
        })
    }

    const handleDeleteConfirm = async () => {
        const item = searchResults.find(item => item.id === deleteConfirmation.itemId)
        if (!item || !item.purchase_item_id) {
            alert('Cannot delete: Purchase item ID not found')
            return
        }

        try {
            await deletePurchaseItem(item.purchase_item_id).unwrap()

            // Success - close modal and refresh data
            setDeleteConfirmation({ isOpen: false, itemId: '', medicineName: '' })

            // If this was the only item on current page and we're not on page 1, go back one page
            if (searchResults.length === 1 && currentPage > 1) {
                setCurrentPage(currentPage - 1)
            }

            if (hasFilters) {
                refetch() // Only refetch if search query is active
            }
            refetchStats() // Explicitly refetch stats after successful deletion
        } catch (error) {
            console.error('Delete failed:', error)
            alert('Failed to delete purchase item')
        }
    }

    const handleDeleteCancel = () => {
        setDeleteConfirmation({ isOpen: false, itemId: '', medicineName: '' })
    }

    // Multi-select handlers
    const handleSelectAll = () => {
        if (isSelectAllChecked) {
            setSelectedItems(new Set())
            setIsSelectAllChecked(false)
        } else {
            const allItemIds = new Set(
                searchResults
                    .map(item => item.purchase_item_id)
                    .filter((id): id is string => Boolean(id))
            )
            setSelectedItems(allItemIds)
            setIsSelectAllChecked(true)
        }
    }

    const handleSelectItem = (purchaseItemId: string) => {
        const newSelected = new Set(selectedItems)
        if (newSelected.has(purchaseItemId)) {
            newSelected.delete(purchaseItemId)
        } else {
            newSelected.add(purchaseItemId)
        }
        setSelectedItems(newSelected)
        setIsSelectAllChecked(newSelected.size === searchResults.length && searchResults.length > 0)
    }

    const handleClearSelection = () => {
        setSelectedItems(new Set())
        setIsSelectAllChecked(false)
    }

    const handleBulkDeleteClick = () => {
        const itemsToDelete = searchResults.filter(item => 
            item.purchase_item_id && selectedItems.has(item.purchase_item_id)
        )
        setBulkDeleteConfirmation({
            isOpen: true,
            items: itemsToDelete
        })
    }

    const handleBulkDeleteCancel = () => {
        setBulkDeleteConfirmation({ isOpen: false, items: [] })
    }

    const handleBulkDeleteConfirm = async () => {
        setIsBulkDeleting(true)
        
        try {
            // Get auth token for the request
            const { data: { session } } = await supabase.auth.getSession()
            const headers: HeadersInit = {
                'Content-Type': 'application/json',
            }
            
            if (session?.access_token) {
                headers['Authorization'] = `Bearer ${session.access_token}`
            }

            const itemIds = Array.from(selectedItems).join(',')
            const response = await fetch(`/api/purchases?purchase_item_ids=${itemIds}`, {
                method: 'DELETE',
                headers
            })

            if (!response.ok) {
                throw new Error('Failed to delete items')
            }

            const result = await response.json()

            // Close modal and clear selection
            setBulkDeleteConfirmation({ isOpen: false, items: [] })
            handleClearSelection()

            // Show success/error message
            if (result.failed > 0) {
                alert(`Deleted ${result.deleted} items. Failed to delete ${result.failed} items.`)
            } else {
                alert(`Successfully deleted ${result.deleted} item${result.deleted > 1 ? 's' : ''}`)
            }

            // Refresh data
            if (hasFilters) {
                refetch()
            }
            refetchStats()

            // If all items on current page were deleted and we're not on page 1, go back
            if (result.deleted === searchResults.length && currentPage > 1) {
                setCurrentPage(currentPage - 1)
            }
        } catch (error) {
            console.error('Bulk delete failed:', error)
            alert('Failed to delete selected items. Please try again.')
        } finally {
            setIsBulkDeleting(false)
        }
    }

    const handleSupplierEdit = (supplier: any) => {
        setSelectedSupplier({ id: supplier.id, name: supplier.name })
        setNewSupplierName(supplier.name)
        setSupplierEditMode(true)
    }

    const handleSupplierEditCancel = () => {
        setSupplierEditMode(false)
        setSelectedSupplier(null)
        setNewSupplierName('')
        setSupplierSearchTerm('')
        setShowSupplierDropdown(false)
    }

    const handleSupplierUpdate = async () => {
        if (!selectedSupplier || !newSupplierName.trim()) {
            alert('Please enter a valid supplier name')
            return
        }

        if (newSupplierName.trim() === selectedSupplier.name) {
            alert('No changes made to supplier name')
            handleSupplierEditCancel()
            return
        }

        try {
            const response = await updateSupplier({
                supplier_id: selectedSupplier.id,
                new_name: newSupplierName.trim()
            }).unwrap()

            alert(`✅ ${response.message}`)
            handleSupplierEditCancel() // This now clears all search state too

            // Refresh related data - only refetch search if it's active
            if (hasFilters) {
                refetch() // Only refetch if search query is active
            }
            refetchStats() // Always refetch stats as this query is always active
        } catch (error) {
            console.error('Supplier update failed:', error)
            alert('Failed to update supplier name')
        }
    }

    const handleSupplierSearchChange = (value: string) => {
        setSupplierSearchTerm(value)
        setShowSupplierDropdown(value.length > 0)
    }

    const handleSupplierSelect = (supplier: any) => {
        setSelectedSupplier({ id: supplier.id, name: supplier.name })
        setNewSupplierName(supplier.name)
        setSupplierEditMode(true)
        setSupplierSearchTerm('')
        setShowSupplierDropdown(false)
    }

    const handleSupplierSearchBlur = () => {
        // Delay hiding dropdown to allow for click events
        setTimeout(() => setShowSupplierDropdown(false), 150)
    }

    return (
        <div className="space-y-4 md:space-y-6">
            {/* Page Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Inventory Management</h1>
                    <p className="text-sm sm:text-base text-gray-600">Manage your inventory and track your stock</p>
                </div>
            </div>

            {/* Supplier Editing Section */}
            <div className="bg-blue-50 rounded-lg border border-blue-200 p-3 sm:p-4">
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-2">
                        <div className="w-7 h-7 sm:w-8 sm:h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                            <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-4m-5 0H3m2 0h3M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                            </svg>
                        </div>
                        <div className="min-w-0 flex-1">
                            <h3 className="text-xs sm:text-sm font-medium text-blue-900">Quick Supplier Edit</h3>
                            <p className="text-xs text-blue-700 hidden sm:block">Update supplier names across all purchase records</p>
                        </div>
                    </div>
                </div>

                {!supplierEditMode ? (
                    <div className="relative">
                        <div className="flex items-center space-x-2 sm:space-x-3">
                            <div className="flex-1 relative">
                                <input
                                    type="text"
                                    value={supplierSearchTerm}
                                    onChange={(e) => handleSupplierSearchChange(e.target.value)}
                                    onFocus={() => setShowSupplierDropdown(supplierSearchTerm.length > 0)}
                                    onBlur={handleSupplierSearchBlur}
                                    placeholder="Search suppliers to edit..."
                                    className="w-full px-2 sm:px-3 py-2 text-xs sm:text-sm text-gray-900 placeholder-gray-500 border border-blue-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                                />

                                {/* Search Results Dropdown */}
                                {showSupplierDropdown && (
                                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-blue-300 rounded-md shadow-lg z-10 max-h-48 sm:max-h-60 overflow-y-auto">
                                        {suppliers.length > 0 ? (
                                            suppliers.map((supplier) => (
                                                <button
                                                    key={supplier.id}
                                                    onClick={() => handleSupplierSelect(supplier)}
                                                    className="w-full px-2 sm:px-3 py-2 text-left text-xs sm:text-sm hover:bg-blue-50 focus:bg-blue-50 focus:outline-none border-b border-gray-100 last:border-b-0"
                                                >
                                                    <div className="font-medium text-gray-900 truncate">{supplier.name}</div>
                                                </button>
                                            ))
                                        ) : supplierSearchTerm.length > 0 ? (
                                            <div className="px-2 sm:px-3 py-3 sm:py-4 text-xs sm:text-sm text-gray-500 text-center">
                                                No suppliers found matching "{supplierSearchTerm}"
                                            </div>
                                        ) : (
                                            <div className="px-2 sm:px-3 py-3 sm:py-4 text-xs sm:text-sm text-gray-500 text-center">
                                                Start typing to search suppliers...
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>

                        {supplierSearchTerm.length > 0 && suppliers.length > 0 && !showSupplierDropdown && (
                            <div className="mt-2 text-xs text-blue-600">
                                Found {suppliers.length} supplier{suppliers.length !== 1 ? 's' : ''} • Click to show results
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="space-y-2 sm:space-y-3">
                        <div className="text-xs sm:text-sm text-blue-800">
                            Editing: <span className="font-medium truncate inline-block max-w-[200px] sm:max-w-none align-bottom">{selectedSupplier?.name}</span>
                        </div>
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
                            <input
                                type="text"
                                value={newSupplierName}
                                onChange={(e) => setNewSupplierName(e.target.value)}
                                placeholder="Enter new supplier name"
                                className="flex-1 px-2 sm:px-3 py-2 text-xs sm:text-sm text-gray-900 placeholder-gray-500 border border-blue-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                            <div className="flex gap-2 sm:gap-3">
                                <button
                                    onClick={handleSupplierUpdate}
                                    disabled={isUpdatingSupplier}
                                    className="flex-1 sm:flex-none px-3 sm:px-4 py-2 bg-blue-600 text-white text-xs sm:text-sm font-medium rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50"
                                >
                                    {isUpdatingSupplier ? 'Updating...' : 'Update'}
                                </button>
                                <button
                                    onClick={handleSupplierEditCancel}
                                    className="flex-1 sm:flex-none px-3 sm:px-4 py-2 bg-gray-100 text-gray-700 text-xs sm:text-sm font-medium rounded-md hover:bg-gray-200 transition-colors"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                        <div className="text-xs text-blue-600">
                            💡 This will update the supplier name in all related purchase records
                        </div>
                    </div>
                )}
            </div>

            {/* Search Filters */}
            <div className="bg-white rounded-lg border border-gray-200 p-4 sm:p-5 md:p-6">
                <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">Search Filters</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                    <div>
                        <AutocompleteDropdown
                            fieldType="medicine_name"
                            value={filters.medicine_name}
                            onChange={(value) => handleFilterChange('medicine_name', value)}
                            placeholder="Search by medicine name..."
                            label="Medicine Name"
                        />
                    </div>
                    <div>
                        <AutocompleteDropdown
                            fieldType="supplier_name"
                            value={filters.supplier_name}
                            onChange={(value) => handleFilterChange('supplier_name', value)}
                            placeholder="Search by supplier name..."
                            label="Supplier Name"
                        />
                    </div>
                    <div>
                        <AutocompleteDropdown
                            fieldType="batch_number"
                            value={filters.batch_number}
                            onChange={(value) => handleFilterChange('batch_number', value)}
                            placeholder="Search by batch number..."
                            label="Batch Number"
                        />
                    </div>
                    <div>
                        <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">Purchase Date</label>
                        <input
                            type="date"
                            value={filters.date}
                            onChange={(e) => handleFilterChange('date', e.target.value)}
                            className="w-full px-2 sm:px-3 py-2 text-xs sm:text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                        />
                    </div>
                </div>
                <div className="mt-3 sm:mt-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 sm:gap-4">
                    <div className="text-xs sm:text-sm text-gray-600 order-2 sm:order-1">
                        {hasFilters && (
                            <span>
                                {isLoading ? 'Searching...' : (
                                    <>
                                        Page {currentPage} • {searchResults.length} results
                                        {searchResults.length === pageSize && ' (showing 10 per page)'}
                                    </>
                                )}
                            </span>
                        )}
                    </div>
                    <button
                        onClick={clearFilters}
                        className="w-full sm:w-auto order-1 sm:order-2 px-3 sm:px-4 py-2 text-xs sm:text-sm text-gray-600 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
                    >
                        Clear Filters
                    </button>
                </div>
            </div>

            {/* Results Table */}
            <div className="bg-white rounded-lg border border-gray-200 p-3 sm:p-4 md:p-6">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-3 sm:mb-4">
                    <h3 className="text-base sm:text-lg font-semibold text-gray-900">Purchase Entries</h3>
                    
                    {/* Bulk Action Bar */}
                    {selectedItems.size > 0 && (
                        <div className="w-full sm:w-auto flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2 bg-blue-50 border border-blue-200 rounded-lg">
                            <span className="text-xs sm:text-sm font-medium text-blue-900 text-center sm:text-left">
                                {selectedItems.size} item{selectedItems.size > 1 ? 's' : ''} selected
                            </span>
                            <div className="flex gap-2">
                                <button
                                    onClick={handleBulkDeleteClick}
                                    disabled={isBulkDeleting}
                                    className="flex-1 sm:flex-none px-3 py-1 text-xs sm:text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {isBulkDeleting ? 'Deleting...' : 'Delete Selected'}
                                </button>
                                <button
                                    onClick={handleClearSelection}
                                    className="flex-1 sm:flex-none px-3 py-1 text-xs sm:text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                                >
                                    Clear
                                </button>
                            </div>
                        </div>
                    )}
                </div>
                <div className="overflow-x-auto -mx-3 sm:-mx-4 md:-mx-6">
                    <div className="inline-block min-w-full align-middle px-3 sm:px-4 md:px-6">
                    <table className="min-w-full table-auto">
                        <thead>
                            <tr className="bg-gray-50">
                                <th className="px-2 sm:px-3 md:px-4 py-2 text-center text-xs sm:text-sm font-medium text-gray-700">
                                    <input
                                        type="checkbox"
                                        checked={isSelectAllChecked}
                                        onChange={handleSelectAll}
                                        disabled={!hasFilters || searchResults.length === 0}
                                        className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                    />
                                </th>
                                <th className="px-2 sm:px-3 md:px-4 py-2 text-left text-xs sm:text-sm font-medium text-gray-700 whitespace-nowrap">Medicine Name</th>
                                <th className="px-2 sm:px-3 md:px-4 py-2 text-left text-xs sm:text-sm font-medium text-gray-700 whitespace-nowrap">Supplier</th>
                                <th className="px-2 sm:px-3 md:px-4 py-2 text-left text-xs sm:text-sm font-medium text-gray-700 whitespace-nowrap">Batch Number</th>
                                <th className="px-2 sm:px-3 md:px-4 py-2 text-left text-xs sm:text-sm font-medium text-gray-700 whitespace-nowrap">Quantity</th>
                                <th className="px-2 sm:px-3 md:px-4 py-2 text-left text-xs sm:text-sm font-medium text-gray-700 whitespace-nowrap">Free</th>
                                <th className="px-2 sm:px-3 md:px-4 py-2 text-left text-xs sm:text-sm font-medium text-gray-700 whitespace-nowrap">Rate</th>
                                <th className="px-2 sm:px-3 md:px-4 py-2 text-left text-xs sm:text-sm font-medium text-gray-700 whitespace-nowrap">MRP</th>
                                <th className="px-2 sm:px-3 md:px-4 py-2 text-left text-xs sm:text-sm font-medium text-gray-700 whitespace-nowrap">Expiry Date</th>
                                <th className="px-2 sm:px-3 md:px-4 py-2 text-left text-xs sm:text-sm font-medium text-gray-700 whitespace-nowrap">Purchase Date</th>
                                <th className="px-2 sm:px-3 md:px-4 py-2 text-left text-xs sm:text-sm font-medium text-gray-700 whitespace-nowrap">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {isLoading ? (
                                // Loading skeleton
                                Array.from({ length: 5 }).map((_, index) => (
                                    <tr key={index} className="border-t border-gray-200">
                                        <td className="px-2 sm:px-3 md:px-4 py-2 sm:py-3"><div className="animate-pulse bg-gray-200 h-3 sm:h-4 w-3 sm:w-4 rounded"></div></td>
                                        <td className="px-2 sm:px-3 md:px-4 py-2 sm:py-3"><div className="animate-pulse bg-gray-200 h-3 sm:h-4 w-24 sm:w-32 rounded"></div></td>
                                        <td className="px-2 sm:px-3 md:px-4 py-2 sm:py-3"><div className="animate-pulse bg-gray-200 h-3 sm:h-4 w-20 sm:w-24 rounded"></div></td>
                                        <td className="px-2 sm:px-3 md:px-4 py-2 sm:py-3"><div className="animate-pulse bg-gray-200 h-3 sm:h-4 w-16 sm:w-20 rounded"></div></td>
                                        <td className="px-2 sm:px-3 md:px-4 py-2 sm:py-3"><div className="animate-pulse bg-gray-200 h-3 sm:h-4 w-12 sm:w-16 rounded"></div></td>
                                        <td className="px-2 sm:px-3 md:px-4 py-2 sm:py-3"><div className="animate-pulse bg-gray-200 h-3 sm:h-4 w-10 sm:w-12 rounded"></div></td>
                                        <td className="px-2 sm:px-3 md:px-4 py-2 sm:py-3"><div className="animate-pulse bg-gray-200 h-3 sm:h-4 w-12 sm:w-16 rounded"></div></td>
                                        <td className="px-2 sm:px-3 md:px-4 py-2 sm:py-3"><div className="animate-pulse bg-gray-200 h-3 sm:h-4 w-12 sm:w-16 rounded"></div></td>
                                        <td className="px-2 sm:px-3 md:px-4 py-2 sm:py-3"><div className="animate-pulse bg-gray-200 h-3 sm:h-4 w-16 sm:w-20 rounded"></div></td>
                                        <td className="px-2 sm:px-3 md:px-4 py-2 sm:py-3"><div className="animate-pulse bg-gray-200 h-3 sm:h-4 w-16 sm:w-20 rounded"></div></td>
                                        <td className="px-2 sm:px-3 md:px-4 py-2 sm:py-3"><div className="animate-pulse bg-gray-200 h-3 sm:h-4 w-12 sm:w-16 rounded"></div></td>
                                    </tr>
                                ))
                            ) : hasFilters && searchResults.length > 0 ? (
                                // Display search results
                                searchResults.map((item: PurchaseSearchResult) => {
                                    const isEditing = editingRows.has(item.id)
                                    const editData = editValues[item.id] || {}
                                    const isSelected = item.purchase_item_id ? selectedItems.has(item.purchase_item_id) : false

                                    return (
                                        <tr key={item.id} className={`border-t border-gray-200 ${isSelected ? 'bg-blue-50' : 'hover:bg-gray-50'}`}>
                                            {/* Checkbox Column */}
                                            <td className="px-2 sm:px-3 md:px-4 py-2 sm:py-3 text-center">
                                                <input
                                                    type="checkbox"
                                                    checked={isSelected}
                                                    onChange={() => item.purchase_item_id && handleSelectItem(item.purchase_item_id)}
                                                    disabled={isEditing || !item.purchase_item_id}
                                                    className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                                />
                                            </td>
                                            {/* Medicine Name - Editable */}
                                            <td className="px-2 sm:px-3 md:px-4 py-2 sm:py-3 text-xs sm:text-sm text-gray-900">
                                                {isEditing ? (
                                                    <AutocompleteDropdown
                                                        fieldType="medicine_name"
                                                        value={editData.medicine_name || ''}
                                                        onChange={(value) => handleFieldChange(item.id, 'medicine_name', value)}
                                                        placeholder="Select or enter medicine name"
                                                        required
                                                        className="w-full px-2 py-1 text-sm"
                                                        inTable={true}
                                                        dropdownDirection="auto"
                                                    />
                                                ) : (
                                                    <div className="min-w-[120px] sm:min-w-[150px]">
                                                        <div className="font-medium truncate">{item.medicine_name}</div>
                                                        {item.generic_name && (
                                                            <div className="text-xs text-gray-500 truncate">{item.generic_name}</div>
                                                        )}
                                                    </div>
                                                )}
                                            </td>

                                            {/* Supplier - Not editable */}
                                            <td className="px-2 sm:px-3 md:px-4 py-2 sm:py-3 text-xs sm:text-sm text-gray-900">
                                                <div className="min-w-[100px] truncate">{item.supplier_name}</div>
                                            </td>

                                            {/* Batch Number - Editable */}
                                            <td className="px-2 sm:px-3 md:px-4 py-2 sm:py-3 text-xs sm:text-sm text-gray-900">
                                                {isEditing ? (
                                                    <input
                                                        type="text"
                                                        value={editData.batch_number || ''}
                                                        onChange={(e) => handleFieldChange(item.id, 'batch_number', e.target.value)}
                                                        className="w-full min-w-[80px] px-2 py-1 text-xs sm:text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                                                    />
                                                ) : (
                                                    <div className="min-w-[80px] truncate">{item.batch_number || '-'}</div>
                                                )}
                                            </td>

                                            {/* Quantity - Editable */}
                                            <td className="px-2 sm:px-3 md:px-4 py-2 sm:py-3 text-xs sm:text-sm text-gray-900">
                                                {isEditing ? (
                                                    <input
                                                        type="number"
                                                        value={editData.quantity || ''}
                                                        onChange={(e) => handleFieldChange(item.id, 'quantity', e.target.value)}
                                                        className="w-full min-w-[60px] px-2 py-1 text-xs sm:text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                                                    />
                                                ) : (
                                                    <div className="min-w-[60px]">{item.quantity}</div>
                                                )}
                                            </td>

                                            {/* Free - Editable */}
                                            <td className="px-2 sm:px-3 md:px-4 py-2 sm:py-3 text-xs sm:text-sm text-gray-900">
                                                {isEditing ? (
                                                    <input
                                                        type="number"
                                                        step="0.01"
                                                        value={editData.Free || ''}
                                                        onChange={(e) => handleFieldChange(item.id, 'Free', e.target.value)}
                                                        className="w-full min-w-[60px] px-2 py-1 text-xs sm:text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                                                        placeholder="0.00"
                                                    />
                                                ) : (
                                                    <div className="min-w-[60px]">{item.Free ? `${item.Free}` : '-'}</div>
                                                )}
                                            </td>

                                            {/* Rate - Editable */}
                                            <td className="px-2 sm:px-3 md:px-4 py-2 sm:py-3 text-xs sm:text-sm text-gray-900">
                                                {isEditing ? (
                                                    <input
                                                        type="number"
                                                        step="0.01"
                                                        value={editData.purchase_rate || ''}
                                                        onChange={(e) => handleFieldChange(item.id, 'purchase_rate', e.target.value)}
                                                        className="w-full min-w-[70px] px-2 py-1 text-xs sm:text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                                                    />
                                                ) : (
                                                    <div className="min-w-[70px] whitespace-nowrap">{`₹${item.purchase_rate.toFixed(2)}`}</div>
                                                )}
                                            </td>

                                            {/* MRP - Editable */}
                                            <td className="px-2 sm:px-3 md:px-4 py-2 sm:py-3 text-xs sm:text-sm text-gray-900">
                                                {isEditing ? (
                                                    <input
                                                        type="number"
                                                        step="0.01"
                                                        value={editData.mrp || ''}
                                                        onChange={(e) => handleFieldChange(item.id, 'mrp', e.target.value)}
                                                        className="w-full min-w-[70px] px-2 py-1 text-xs sm:text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                                                    />
                                                ) : (
                                                    <div className="min-w-[70px] whitespace-nowrap">{`₹${item.mrp.toFixed(2)}`}</div>
                                                )}
                                            </td>

                                            {/* Expiry Date - Editable */}
                                            <td className="px-2 sm:px-3 md:px-4 py-2 sm:py-3 text-xs sm:text-sm text-gray-900">
                                                {isEditing ? (
                                                    <input
                                                        type="date"
                                                        value={editData.expiry_date || ''}
                                                        onChange={(e) => handleFieldChange(item.id, 'expiry_date', e.target.value)}
                                                        className="w-full min-w-[100px] px-2 py-1 text-xs sm:text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                                                    />
                                                ) : (
                                                    <div className="min-w-[80px] whitespace-nowrap">{item.expiry_date ? new Date(item.expiry_date).toLocaleDateString('en-IN') : '-'}</div>
                                                )}
                                            </td>

                                            {/* Purchase Date - Not editable */}
                                            <td className="px-2 sm:px-3 md:px-4 py-2 sm:py-3 text-xs sm:text-sm text-gray-900">
                                                <div className="min-w-[80px] whitespace-nowrap">{new Date(item.purchase_date).toLocaleDateString('en-IN')}</div>
                                            </td>

                                            {/* Actions */}
                                            <td className="px-2 sm:px-3 md:px-4 py-2 sm:py-3 text-xs sm:text-sm">
                                                {isEditing ? (
                                                    <div className="flex flex-col sm:flex-row gap-1 sm:gap-2 min-w-[100px]">
                                                        <button
                                                            onClick={() => handleUpdate(item)}
                                                            disabled={isUpdating}
                                                            className="text-green-600 hover:text-green-800 text-xs sm:text-sm font-medium disabled:opacity-50 whitespace-nowrap"
                                                        >
                                                            {isUpdating ? 'Updating...' : 'Update'}
                                                        </button>
                                                        <button
                                                            onClick={() => handleCancelEdit(item.id)}
                                                            className="text-gray-600 hover:text-gray-800 text-xs sm:text-sm font-medium whitespace-nowrap"
                                                        >
                                                            Cancel
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <div className="flex flex-col sm:flex-row gap-1 sm:gap-2 min-w-[80px]">
                                                        <button
                                                            onClick={() => handleEdit(item)}
                                                            className="text-blue-600 hover:text-blue-800 text-xs sm:text-sm font-medium whitespace-nowrap"
                                                        >
                                                            Edit
                                                        </button>
                                                        <button
                                                            onClick={() => handleDeleteClick(item)}
                                                            disabled={isDeleting}
                                                            className="text-red-600 hover:text-red-800 text-xs sm:text-sm font-medium disabled:opacity-50 whitespace-nowrap"
                                                        >
                                                            Delete
                                                        </button>
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                    )
                                })
                            ) : hasFilters && searchResults.length === 0 && !isLoading ? (
                                // No results found
                                <tr>
                                    <td colSpan={11} className="px-3 sm:px-4 py-8 sm:py-12 text-center text-gray-500">
                                        <div className="flex flex-col items-center">
                                            <div className="text-3xl sm:text-4xl mb-3 sm:mb-4">🔍</div>
                                            <div className="text-base sm:text-lg font-medium mb-1 sm:mb-2">No purchase entries found</div>
                                            <div className="text-xs sm:text-sm">Try adjusting your search criteria</div>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                // Default empty state
                                <tr>
                                    <td colSpan={11} className="px-3 sm:px-4 py-8 sm:py-12 text-center text-gray-500">
                                        <div className="flex flex-col items-center">
                                            <div className="text-3xl sm:text-4xl mb-3 sm:mb-4">🔍</div>
                                            <div className="text-base sm:text-lg font-medium mb-1 sm:mb-2">No search criteria selected</div>
                                            <div className="text-xs sm:text-sm px-4">Use the filters above to search for purchase entries that need correction</div>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                    </div>
                </div>

                {/* Pagination Controls */}
                {hasFilters && searchResults.length > 0 && (
                    <div className="mt-3 sm:mt-4 flex flex-col sm:flex-row items-center justify-between gap-3">
                        <div className="flex items-center gap-2 order-2 sm:order-1">
                            <button
                                onClick={handlePreviousPage}
                                disabled={currentPage === 1 || isLoading}
                                className="px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                ← Previous
                            </button>

                            <span className="px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm text-gray-700 whitespace-nowrap">
                                Page {currentPage}
                            </span>

                            <button
                                onClick={handleNextPage}
                                disabled={searchResults.length < pageSize || isLoading}
                                className="px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Next →
                            </button>
                        </div>

                        <div className="text-xs sm:text-sm text-gray-600 order-1 sm:order-2">
                            Showing {searchResults.length} entries per page
                        </div>
                    </div>
                )}
            </div>

            {/* Delete Confirmation Modal */}
            {deleteConfirmation.isOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
                        <div className="p-4 sm:p-6">
                            <div className="flex items-start sm:items-center mb-4">
                                <div className="w-9 h-9 sm:w-10 sm:h-10 bg-red-100 rounded-full flex items-center justify-center mr-3 flex-shrink-0">
                                    <svg className="w-5 h-5 sm:w-6 sm:h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                                    </svg>
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h3 className="text-base sm:text-lg font-medium text-gray-900">Confirm Deletion</h3>
                                    <p className="text-xs sm:text-sm text-gray-600">This action cannot be undone.</p>
                                </div>
                            </div>

                            <div className="mb-4 sm:mb-6">
                                <p className="text-sm sm:text-base text-gray-700">
                                    Are you sure you want to delete the purchase entry for{' '}
                                    <span className="font-medium text-gray-900 break-words">{deleteConfirmation.medicineName}</span>?
                                </p>
                            </div>

                            <div className="flex flex-col sm:flex-row justify-end gap-2 sm:gap-3">
                                <button
                                    onClick={handleDeleteCancel}
                                    disabled={isDeleting}
                                    className="w-full sm:w-auto px-4 py-2 text-sm sm:text-base text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors disabled:opacity-50 order-2 sm:order-1"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleDeleteConfirm}
                                    disabled={isDeleting}
                                    className="w-full sm:w-auto px-4 py-2 text-sm sm:text-base bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors disabled:opacity-50 order-1 sm:order-2"
                                >
                                    {isDeleting ? 'Deleting...' : 'Delete'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Bulk Delete Confirmation Modal */}
            {bulkDeleteConfirmation.isOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] sm:max-h-[80vh] overflow-hidden flex flex-col">
                        <div className="p-4 sm:p-6 border-b border-gray-200">
                            <div className="flex items-start sm:items-center">
                                <div className="w-9 h-9 sm:w-10 sm:h-10 bg-red-100 rounded-full flex items-center justify-center mr-3 flex-shrink-0">
                                    <svg className="w-5 h-5 sm:w-6 sm:h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                                    </svg>
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h3 className="text-base sm:text-lg font-medium text-gray-900">Confirm Bulk Deletion</h3>
                                    <p className="text-xs sm:text-sm text-gray-600">This action cannot be undone.</p>
                                </div>
                            </div>
                        </div>

                        <div className="p-4 sm:p-6 overflow-y-auto flex-1">
                            <p className="text-sm sm:text-base text-gray-700 mb-3 sm:mb-4">
                                Are you sure you want to delete <span className="font-medium text-red-600">{bulkDeleteConfirmation.items.length}</span> purchase {bulkDeleteConfirmation.items.length === 1 ? 'entry' : 'entries'}?
                            </p>
                            
                            <div className="bg-gray-50 rounded-lg p-3 sm:p-4 max-h-48 sm:max-h-60 overflow-y-auto">
                                <p className="text-xs sm:text-sm font-medium text-gray-700 mb-2">Items to be deleted:</p>
                                <ul className="space-y-2">
                                    {bulkDeleteConfirmation.items.map((item, index) => (
                                        <li key={item.id} className="text-xs sm:text-sm text-gray-600 flex items-start">
                                            <span className="font-medium text-gray-700 mr-2 flex-shrink-0">{index + 1}.</span>
                                            <div className="flex-1 min-w-0">
                                                <div className="font-medium text-gray-900 break-words">{item.medicine_name}</div>
                                                <div className="text-xs text-gray-500 break-words">
                                                    Supplier: {item.supplier_name} | Batch: {item.batch_number || 'N/A'} | Qty: {item.quantity}
                                                </div>
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            </div>

                            <div className="mt-3 sm:mt-4 p-2.5 sm:p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                                <p className="text-xs sm:text-sm text-yellow-800">
                                    <strong>Warning:</strong> This will also delete related records from inventory and transaction history.
                                </p>
                            </div>
                        </div>

                        <div className="p-4 sm:p-6 border-t border-gray-200 flex flex-col sm:flex-row justify-end gap-2 sm:gap-3">
                            <button
                                onClick={handleBulkDeleteCancel}
                                disabled={isBulkDeleting}
                                className="w-full sm:w-auto px-4 py-2 text-sm sm:text-base text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors disabled:opacity-50 order-2 sm:order-1"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleBulkDeleteConfirm}
                                disabled={isBulkDeleting}
                                className="w-full sm:w-auto px-4 py-2 text-sm sm:text-base text-white bg-red-600 rounded-md hover:bg-red-700 transition-colors disabled:opacity-50 order-1 sm:order-2"
                            >
                                {isBulkDeleting ? 'Deleting...' : `Delete ${bulkDeleteConfirmation.items.length} Item${bulkDeleteConfirmation.items.length > 1 ? 's' : ''}`}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
} 