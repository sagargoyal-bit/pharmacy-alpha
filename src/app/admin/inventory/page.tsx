'use client'

import { useState, useEffect } from 'react'
import { useSearchPurchasesQuery, useUpdatePurchaseItemMutation, useDeletePurchaseItemMutation, useGetPurchasesStatsQuery, useGetSuppliersQuery, useUpdateSupplierMutation, type PurchaseSearchResult } from '@/lib/store/api/pharmacyApi'
import AutocompleteDropdown from '@/components/ui/AutocompleteDropdown'

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
        } catch (error) {
            console.error('Update failed:', error)
            alert('Failed to update purchase item')
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
        <div className="space-y-6">
            {/* Page Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Inventory Management</h1>
                    <p className="text-gray-600">Manage your inventory and track your stock</p>
                </div>
            </div>

            {/* Supplier Editing Section */}
            <div className="bg-blue-50 rounded-lg border border-blue-200 p-4">
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-2">
                        <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                            <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-4m-5 0H3m2 0h3M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                            </svg>
                        </div>
                        <div>
                            <h3 className="text-sm font-medium text-blue-900">Quick Supplier Edit</h3>
                            <p className="text-xs text-blue-700">Update supplier names across all purchase records</p>
                        </div>
                    </div>
                </div>

                {!supplierEditMode ? (
                    <div className="relative">
                        <div className="flex items-center space-x-3">
                            <div className="flex-1 relative">
                                <input
                                    type="text"
                                    value={supplierSearchTerm}
                                    onChange={(e) => handleSupplierSearchChange(e.target.value)}
                                    onFocus={() => setShowSupplierDropdown(supplierSearchTerm.length > 0)}
                                    onBlur={handleSupplierSearchBlur}
                                    placeholder="Search suppliers to edit..."
                                    className="w-full px-3 py-2 text-sm text-gray-900 placeholder-gray-500 border border-blue-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                                />

                                {/* Search Results Dropdown */}
                                {showSupplierDropdown && (
                                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-blue-300 rounded-md shadow-lg z-10 max-h-60 overflow-y-auto">
                                        {suppliers.length > 0 ? (
                                            suppliers.map((supplier) => (
                                                <button
                                                    key={supplier.id}
                                                    onClick={() => handleSupplierSelect(supplier)}
                                                    className="w-full px-3 py-2 text-left text-sm hover:bg-blue-50 focus:bg-blue-50 focus:outline-none border-b border-gray-100 last:border-b-0"
                                                >
                                                    <div className="font-medium text-gray-900">{supplier.name}</div>
                                                    {supplier.contact_person && (
                                                        <div className="text-xs text-gray-500">Contact: {supplier.contact_person}</div>
                                                    )}
                                                </button>
                                            ))
                                        ) : supplierSearchTerm.length > 0 ? (
                                            <div className="px-3 py-4 text-sm text-gray-500 text-center">
                                                No suppliers found matching "{supplierSearchTerm}"
                                            </div>
                                        ) : (
                                            <div className="px-3 py-4 text-sm text-gray-500 text-center">
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
                    <div className="space-y-3">
                        <div className="text-sm text-blue-800">
                            Editing: <span className="font-medium">{selectedSupplier?.name}</span>
                        </div>
                        <div className="flex items-center space-x-3">
                            <input
                                type="text"
                                value={newSupplierName}
                                onChange={(e) => setNewSupplierName(e.target.value)}
                                placeholder="Enter new supplier name"
                                className="flex-1 px-3 py-2 text-sm text-gray-900 placeholder-gray-500 border border-blue-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                            <button
                                onClick={handleSupplierUpdate}
                                disabled={isUpdatingSupplier}
                                className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50"
                            >
                                {isUpdatingSupplier ? 'Updating...' : 'Update'}
                            </button>
                            <button
                                onClick={handleSupplierEditCancel}
                                className="px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-200 transition-colors"
                            >
                                Cancel
                            </button>
                        </div>
                        <div className="text-xs text-blue-600">
                            💡 This will update the supplier name in all related purchase records
                        </div>
                    </div>
                )}
            </div>

            {/* Search Filters */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Search Filters</h3>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
                        <label className="block text-sm font-medium text-gray-700 mb-2">Purchase Date</label>
                        <input
                            type="date"
                            value={filters.date}
                            onChange={(e) => handleFilterChange('date', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                        />
                    </div>
                </div>
                <div className="mt-4 flex justify-between items-center">
                    <div className="text-sm text-gray-600">
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
                        className="px-4 py-2 text-gray-600 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
                    >
                        Clear Filters
                    </button>
                </div>
            </div>

            {/* Results Table */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Purchase Entries</h3>
                <div className="overflow-x-auto">
                    <table className="min-w-full table-auto">
                        <thead>
                            <tr className="bg-gray-50">
                                <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Medicine Name</th>
                                <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Supplier</th>
                                <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Batch Number</th>
                                <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Quantity</th>
                                <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Rate</th>
                                <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">MRP</th>
                                <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Expiry Date</th>
                                <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Purchase Date</th>
                                <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {isLoading ? (
                                // Loading skeleton
                                Array.from({ length: 5 }).map((_, index) => (
                                    <tr key={index} className="border-t border-gray-200">
                                        <td className="px-4 py-3"><div className="animate-pulse bg-gray-200 h-4 w-32 rounded"></div></td>
                                        <td className="px-4 py-3"><div className="animate-pulse bg-gray-200 h-4 w-24 rounded"></div></td>
                                        <td className="px-4 py-3"><div className="animate-pulse bg-gray-200 h-4 w-20 rounded"></div></td>
                                        <td className="px-4 py-3"><div className="animate-pulse bg-gray-200 h-4 w-16 rounded"></div></td>
                                        <td className="px-4 py-3"><div className="animate-pulse bg-gray-200 h-4 w-16 rounded"></div></td>
                                        <td className="px-4 py-3"><div className="animate-pulse bg-gray-200 h-4 w-16 rounded"></div></td>
                                        <td className="px-4 py-3"><div className="animate-pulse bg-gray-200 h-4 w-20 rounded"></div></td>
                                        <td className="px-4 py-3"><div className="animate-pulse bg-gray-200 h-4 w-20 rounded"></div></td>
                                        <td className="px-4 py-3"><div className="animate-pulse bg-gray-200 h-4 w-16 rounded"></div></td>
                                    </tr>
                                ))
                            ) : hasFilters && searchResults.length > 0 ? (
                                // Display search results
                                searchResults.map((item: PurchaseSearchResult) => {
                                    const isEditing = editingRows.has(item.id)
                                    const editData = editValues[item.id] || {}

                                    return (
                                        <tr key={item.id} className="border-t border-gray-200 hover:bg-gray-50">
                                            {/* Medicine Name - Editable */}
                                            <td className="px-4 py-3 text-sm text-gray-900">
                                                {isEditing ? (
                                                    <input
                                                        type="text"
                                                        value={editData.medicine_name || ''}
                                                        onChange={(e) => handleFieldChange(item.id, 'medicine_name', e.target.value)}
                                                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                                                        placeholder="Enter medicine name"
                                                    />
                                                ) : (
                                                    <div>
                                                        <div className="font-medium">{item.medicine_name}</div>
                                                        {item.generic_name && (
                                                            <div className="text-xs text-gray-500">{item.generic_name}</div>
                                                        )}
                                                    </div>
                                                )}
                                            </td>

                                            {/* Supplier - Not editable */}
                                            <td className="px-4 py-3 text-sm text-gray-900">{item.supplier_name}</td>

                                            {/* Batch Number - Editable */}
                                            <td className="px-4 py-3 text-sm text-gray-900">
                                                {isEditing ? (
                                                    <input
                                                        type="text"
                                                        value={editData.batch_number || ''}
                                                        onChange={(e) => handleFieldChange(item.id, 'batch_number', e.target.value)}
                                                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                                                    />
                                                ) : (
                                                    item.batch_number || '-'
                                                )}
                                            </td>

                                            {/* Quantity - Editable */}
                                            <td className="px-4 py-3 text-sm text-gray-900">
                                                {isEditing ? (
                                                    <input
                                                        type="number"
                                                        value={editData.quantity || ''}
                                                        onChange={(e) => handleFieldChange(item.id, 'quantity', e.target.value)}
                                                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                                                    />
                                                ) : (
                                                    item.quantity
                                                )}
                                            </td>

                                            {/* Rate - Editable */}
                                            <td className="px-4 py-3 text-sm text-gray-900">
                                                {isEditing ? (
                                                    <input
                                                        type="number"
                                                        step="0.01"
                                                        value={editData.purchase_rate || ''}
                                                        onChange={(e) => handleFieldChange(item.id, 'purchase_rate', e.target.value)}
                                                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                                                    />
                                                ) : (
                                                    `₹${item.purchase_rate.toFixed(2)}`
                                                )}
                                            </td>

                                            {/* MRP - Editable */}
                                            <td className="px-4 py-3 text-sm text-gray-900">
                                                {isEditing ? (
                                                    <input
                                                        type="number"
                                                        step="0.01"
                                                        value={editData.mrp || ''}
                                                        onChange={(e) => handleFieldChange(item.id, 'mrp', e.target.value)}
                                                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                                                    />
                                                ) : (
                                                    `₹${item.mrp.toFixed(2)}`
                                                )}
                                            </td>

                                            {/* Expiry Date - Editable */}
                                            <td className="px-4 py-3 text-sm text-gray-900">
                                                {isEditing ? (
                                                    <input
                                                        type="date"
                                                        value={editData.expiry_date || ''}
                                                        onChange={(e) => handleFieldChange(item.id, 'expiry_date', e.target.value)}
                                                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                                                    />
                                                ) : (
                                                    item.expiry_date ? new Date(item.expiry_date).toLocaleDateString('en-IN') : '-'
                                                )}
                                            </td>

                                            {/* Purchase Date - Not editable */}
                                            <td className="px-4 py-3 text-sm text-gray-900">
                                                {new Date(item.purchase_date).toLocaleDateString('en-IN')}
                                            </td>

                                            {/* Actions */}
                                            <td className="px-4 py-3 text-sm space-x-2">
                                                {isEditing ? (
                                                    <div className="flex space-x-2">
                                                        <button
                                                            onClick={() => handleUpdate(item)}
                                                            disabled={isUpdating}
                                                            className="text-green-600 hover:text-green-800 text-sm font-medium disabled:opacity-50"
                                                        >
                                                            {isUpdating ? 'Updating...' : 'Update'}
                                                        </button>
                                                        <button
                                                            onClick={() => handleCancelEdit(item.id)}
                                                            className="text-gray-600 hover:text-gray-800 text-sm font-medium"
                                                        >
                                                            Cancel
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <div className="flex space-x-2">
                                                        <button
                                                            onClick={() => handleEdit(item)}
                                                            className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                                                        >
                                                            Edit
                                                        </button>
                                                        <button
                                                            onClick={() => handleDeleteClick(item)}
                                                            disabled={isDeleting}
                                                            className="text-red-600 hover:text-red-800 text-sm font-medium disabled:opacity-50"
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
                                    <td colSpan={9} className="px-4 py-12 text-center text-gray-500">
                                        <div className="flex flex-col items-center">
                                            <div className="text-4xl mb-4">🔍</div>
                                            <div className="text-lg font-medium mb-2">No purchase entries found</div>
                                            <div className="text-sm">Try adjusting your search criteria</div>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                // Default empty state
                                <tr>
                                    <td colSpan={9} className="px-4 py-12 text-center text-gray-500">
                                        <div className="flex flex-col items-center">
                                            <div className="text-4xl mb-4">🔍</div>
                                            <div className="text-lg font-medium mb-2">No search criteria selected</div>
                                            <div className="text-sm">Use the filters above to search for purchase entries that need correction</div>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination Controls */}
                {hasFilters && searchResults.length > 0 && (
                    <div className="mt-4 flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                            <button
                                onClick={handlePreviousPage}
                                disabled={currentPage === 1 || isLoading}
                                className="px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                ← Previous
                            </button>

                            <span className="px-3 py-2 text-sm text-gray-700">
                                Page {currentPage}
                            </span>

                            <button
                                onClick={handleNextPage}
                                disabled={searchResults.length < pageSize || isLoading}
                                className="px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Next →
                            </button>
                        </div>

                        <div className="text-sm text-gray-600">
                            Showing {searchResults.length} entries per page
                        </div>
                    </div>
                )}
            </div>

            {/* Delete Confirmation Modal */}
            {deleteConfirmation.isOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
                        <div className="p-6">
                            <div className="flex items-center mb-4">
                                <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center mr-3">
                                    <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                                    </svg>
                                </div>
                                <div>
                                    <h3 className="text-lg font-medium text-gray-900">Confirm Deletion</h3>
                                    <p className="text-sm text-gray-600">This action cannot be undone.</p>
                                </div>
                            </div>

                            <div className="mb-6">
                                <p className="text-gray-700">
                                    Are you sure you want to delete the purchase entry for{' '}
                                    <span className="font-medium text-gray-900">{deleteConfirmation.medicineName}</span>?
                                </p>
                            </div>

                            <div className="flex justify-end space-x-3">
                                <button
                                    onClick={handleDeleteCancel}
                                    disabled={isDeleting}
                                    className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors disabled:opacity-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleDeleteConfirm}
                                    disabled={isDeleting}
                                    className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors disabled:opacity-50"
                                >
                                    {isDeleting ? 'Deleting...' : 'Delete'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
} 