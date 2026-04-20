'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import AutocompleteDropdown from '@/components/ui/AutocompleteDropdown'
import { useAppDispatch } from '@/lib/store'
import { useCreatePurchaseMutation } from '@/lib/store/api/pharmacyApi'
import { addNotification } from '@/lib/store/slices/uiSlice'

export default function NewPurchaseEntry() {
    const dispatch = useAppDispatch()
    const router = useRouter()
    const [createPurchase, { isLoading: isCreating }] = useCreatePurchaseMutation()

    const [formData, setFormData] = useState({
        supplier_name: '',
        invoice_number: '',
        date: new Date().toISOString().split('T')[0],
        items: [{
            item_name: '',
            pack: '',
            qty: '',
            Free: '',
            expiry: '',
            batch: '',
            mrp: '',
            rate: '',
            amount: ''
        }]
    })

    const handleAddItem = () => {
        setFormData({
            ...formData,
            items: [...formData.items, {
                item_name: '',
                pack: '',
                qty: '',
                Free: '',
                expiry: '',
                batch: '',
                mrp: '',
                rate: '',
                amount: ''
            }]
        })
    }

    const handleRemoveItem = (index: number) => {
        const newItems = formData.items.filter((_, i) => i !== index)
        setFormData({ ...formData, items: newItems })
    }

    const handleItemChange = (index: number, field: string, value: string) => {
        const newItems = [...formData.items]
        
        if (field === 'expiry') {
            let cleaned = value.replace(/\D/g, '')
            if (cleaned.length >= 2) {
                cleaned = cleaned.slice(0, 2) + '/' + cleaned.slice(2, 4)
            }
            newItems[index] = { ...newItems[index], [field]: cleaned }
        } else {
            newItems[index] = { ...newItems[index], [field]: value }
        }

        if (field === 'qty' || field === 'rate') {
            const qty = parseFloat(newItems[index].qty) || 0
            const rate = parseFloat(newItems[index].rate) || 0
            newItems[index].amount = (qty * rate).toFixed(2)
        }

        setFormData({ ...formData, items: newItems })
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        try {
            const purchaseData = {
                supplier_name: formData.supplier_name.toUpperCase(),
                invoice_number: formData.invoice_number,
                date: formData.date,
                items: formData.items.map(item => {
                    let expiryDate = item.expiry
                    if (item.expiry && item.expiry.includes('/')) {
                        const [month, year] = item.expiry.split('/')
                        expiryDate = `20${year}-${month}`
                    }
                    
                    return {
                        medicine_name: item.item_name.toUpperCase(),
                        pack: item.pack || undefined,
                        quantity: parseInt(item.qty),
                        Free: item.Free || undefined,
                        expiry_date: expiryDate,
                        batch_number: item.batch || undefined,
                        mrp: item.mrp ? parseFloat(item.mrp) : undefined,
                        rate: parseFloat(item.rate),
                        amount: parseFloat(item.amount)
                    }
                })
            }

            await createPurchase(purchaseData).unwrap()

            dispatch(addNotification({
                type: 'success',
                title: 'Purchase Saved',
                message: `Purchase from ${formData.supplier_name} saved successfully!`
            }))

            router.push('/admin/purchases')
        } catch (error) {
            dispatch(addNotification({
                type: 'error',
                title: 'Error',
                message: 'Failed to save purchase. Please try again.'
            }))
        }
    }

    const getTotalAmount = () => {
        return formData.items.reduce((total, item) => total + (parseFloat(item.amount) || 0), 0).toFixed(2)
    }

    const getFocusableElements = (currentElement: HTMLElement) => {
        const form = currentElement.closest('form')
        if (!form) return []

        const allInputs = Array.from(
            form.querySelectorAll<HTMLInputElement>(
                'input:not([disabled]):not([tabindex="-1"])'
            )
        )
        
        return allInputs.filter(input => {
            const isAmountField = input.readOnly && input.classList.contains('bg-gray-50')
            return !isAmountField
        })
    }

    const moveToNextField = (currentElement: HTMLElement) => {
        const focusableElements = getFocusableElements(currentElement)
        const currentIndex = focusableElements.indexOf(currentElement as HTMLInputElement)
        const nextElement = focusableElements[currentIndex + 1]

        if (nextElement) {
            nextElement.focus()
            if (nextElement.readOnly) {
                nextElement.click()
            }
        }
    }

    const moveToPreviousField = (currentElement: HTMLElement) => {
        const focusableElements = getFocusableElements(currentElement)
        const currentIndex = focusableElements.indexOf(currentElement as HTMLInputElement)
        const previousElement = focusableElements[currentIndex - 1]

        if (previousElement) {
            previousElement.focus()
            if (previousElement.readOnly) {
                previousElement.click()
            }
        }
    }

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        const input = e.currentTarget
        
        const supportsSelection = input.type === 'text' || input.type === 'search' || 
                                  input.type === 'tel' || input.type === 'url' || input.type === 'password'
        
        let cursorAtStart = true
        let cursorAtEnd = true
        
        if (supportsSelection) {
            cursorAtStart = input.selectionStart === 0 && input.selectionEnd === 0
            cursorAtEnd = input.selectionStart === input.value.length && input.selectionEnd === input.value.length
        }

        if (e.key === 'Enter') {
            e.preventDefault()
            
            const isRateField = input.getAttribute('data-field') === 'rate'
            
            if (isRateField) {
                const tableRow = input.closest('tr')
                if (tableRow) {
                    const tbody = tableRow.parentElement
                    const rowIndex = Array.from(tbody?.children || []).indexOf(tableRow)
                    
                    if (rowIndex === formData.items.length - 1) {
                        handleAddItem()
                        
                        setTimeout(() => {
                            const newRowInputs = document.querySelectorAll('tbody tr:last-child input, tbody tr:last-child [role="textbox"]')
                            if (newRowInputs.length > 0) {
                                const firstInput = newRowInputs[0] as HTMLElement
                                firstInput.focus()
                                if ((firstInput as HTMLInputElement).readOnly) {
                                    firstInput.click()
                                }
                            }
                        }, 50)
                        return
                    }
                }
            }
            
            moveToNextField(e.currentTarget)
        } else if (e.key === 'ArrowRight') {
            if (!supportsSelection || cursorAtEnd) {
                e.preventDefault()
                moveToNextField(e.currentTarget)
            }
        } else if (e.key === 'ArrowLeft') {
            if (!supportsSelection || cursorAtStart) {
                e.preventDefault()
                moveToPreviousField(e.currentTarget)
            }
        }
    }

    const handleAfterSelect = (inputElement: HTMLInputElement) => {
        moveToNextField(inputElement)
    }

    return (
        <div className="space-y-4 md:space-y-6">
            {/* Page Header */}
            <div className="flex items-center gap-3">
                <Link
                    href="/admin/purchases"
                    className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                </Link>
                <h1 className="text-lg sm:text-xl font-semibold text-gray-900">Add Purchase Entry</h1>
            </div>

            {/* Form Content */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                <form onSubmit={handleSubmit} className="p-4 sm:p-6">
                    {/* Supplier & Invoice Details */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 mb-4 sm:mb-6 p-3 sm:p-4 bg-gray-50 rounded-lg">
                        <div>
                            <label className="block text-sm sm:text-base font-semibold text-black mb-1">Supplier Name *</label>
                            <AutocompleteDropdown
                                fieldType="supplier_name"
                                value={formData.supplier_name}
                                onChange={(value) => setFormData({ ...formData, supplier_name: value })}
                                placeholder="Enter supplier name"
                                required
                                className="text-black text-sm sm:text-base font-medium"
                                onAfterSelect={handleAfterSelect}
                            />
                        </div>
                        <div>
                            <label className="block text-sm sm:text-base font-semibold text-black mb-1">
                                Invoice Number 
                             
                            </label>
                            <input
                                type="text"
                                value={formData.invoice_number}
                                onChange={(e) => setFormData({ ...formData, invoice_number: e.target.value })}
                                onKeyDown={handleKeyDown}
                                className="w-full text-black px-2 sm:px-3 py-2 text-sm sm:text-base font-medium border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="Invoice Number"
                            />
                        </div>
                        <div className="sm:col-span-2 lg:col-span-1">
                            <label className="block text-sm sm:text-base font-semibold text-black mb-1">Purchase Date *</label>
                            <input
                                type="date"
                                required
                                value={formData.date}
                                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                                onKeyDown={handleKeyDown}
                                className="w-full text-black px-2 sm:px-3 py-2 text-sm sm:text-base font-medium border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                    </div>

                    {/* Items Section */}
                    <div className="mb-4 sm:mb-6">
                        <div className="mb-3 sm:mb-4">
                            <h3 className="text-base sm:text-lg font-bold text-black">Medicine Items</h3>
                        </div>

                        {/* Items Table */}
                        <div className="overflow-x-auto overflow-y-visible border border-gray-200 rounded-lg -mx-4 sm:mx-0">
                            <div className="inline-block min-w-full align-middle px-4 sm:px-0">
                            <table className="min-w-full">
                                <thead className="bg-green-100 border-b border-gray-400">
                                    <tr>
                                        <th className="px-1.5 sm:px-2 md:px-3 py-2 sm:py-3 text-center text-sm sm:text-base font-semibold text-gray-900 uppercase whitespace-nowrap">#</th>
                                        <th className="px-1.5 sm:px-2 md:px-3 py-2 sm:py-3 text-left text-sm sm:text-base font-semibold text-gray-900 uppercase whitespace-nowrap">Item Name</th>
                                        <th className="px-1.5 sm:px-2 md:px-3 py-2 sm:py-3 text-left text-sm sm:text-base font-semibold text-gray-900 uppercase whitespace-nowrap">Pack</th>
                                        <th className="px-1.5 sm:px-2 md:px-3 py-2 sm:py-3 text-left text-sm sm:text-base font-semibold text-gray-900 uppercase whitespace-nowrap">Qty</th>
                                        <th className="px-1.5 sm:px-2 md:px-3 py-2 sm:py-3 text-left text-sm sm:text-base font-semibold text-gray-900 uppercase whitespace-nowrap">Free</th>
                                        <th className="px-1.5 sm:px-2 md:px-3 py-2 sm:py-3 text-left text-sm sm:text-base font-semibold text-gray-900 uppercase whitespace-nowrap">Expiry</th>
                                        <th className="px-1.5 sm:px-2 md:px-3 py-2 sm:py-3 text-left text-sm sm:text-base font-semibold text-gray-900 uppercase whitespace-nowrap">Batch</th>
                                        <th className="px-1.5 sm:px-2 md:px-3 py-2 sm:py-3 text-left text-sm sm:text-base font-semibold text-gray-900 uppercase whitespace-nowrap">MRP</th>
                                        <th className="px-1.5 sm:px-2 md:px-3 py-2 sm:py-3 text-left text-sm sm:text-base font-semibold text-gray-900 uppercase whitespace-nowrap">S.Rate</th>
                                        <th className="px-1.5 sm:px-2 md:px-3 py-2 sm:py-3 text-left text-sm sm:text-base font-semibold text-gray-900 uppercase whitespace-nowrap">Amount</th>
                                        <th className="px-1.5 sm:px-2 md:px-3 py-2 sm:py-3 text-left text-sm sm:text-base font-semibold text-gray-900 uppercase whitespace-nowrap">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-400">
                                    {formData.items.map((item, index) => (
                                        <tr key={index} className={`${index % 2 === 0 ? 'bg-white' : 'bg-gray-100'} hover:bg-blue-50`}>
                                            <td className="px-1.5 sm:px-2 md:px-3 py-2 sm:py-3 text-center text-xs sm:text-sm font-medium text-gray-700 border-r border-gray-400">{index + 1}</td>
                                            <td className="p-0 border-r border-gray-400">
                                                <AutocompleteDropdown
                                                    fieldType="medicine_name"
                                                    value={item.item_name}
                                                    onChange={(value) => handleItemChange(index, 'item_name', value)}
                                                    placeholder="Medicine name"
                                                    required
                                                    className="text-black font-medium px-2 sm:px-3 py-2 sm:py-3 text-sm sm:text-base min-w-[150px]"
                                                    inTable={true}
                                                    dropdownDirection="auto"
                                                    onAfterSelect={handleAfterSelect}
                                                    showSearchIcon={false}
                                                    borderless
                                                />
                                            </td>
                                            <td className="p-0 border-r border-gray-400">
                                                <input
                                                    type="text"
                                                    value={item.pack}
                                                    onChange={(e) => handleItemChange(index, 'pack', e.target.value)}
                                                    onKeyDown={handleKeyDown}
                                                    className="w-full h-full min-w-[60px] font-medium text-black px-2 sm:px-3 py-2 sm:py-3 border-0 bg-transparent text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500"
                                                    placeholder="10x10"
                                                />
                                            </td>
                                            <td className="p-0 border-r border-gray-400">
                                                <input
                                                    type="number"
                                                    required
                                                    value={item.qty}
                                                    onChange={(e) => handleItemChange(index, 'qty', e.target.value)}
                                                    onKeyDown={handleKeyDown}
                                                    className="w-full h-full min-w-[50px] font-medium text-black px-2 sm:px-3 py-2 sm:py-3 border-0 bg-transparent text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500"
                                                    placeholder="0"
                                                />
                                            </td>
                                            <td className="p-0 border-r border-gray-400">
                                                <input
                                                    type="text"
                                                    value={item.Free}
                                                    onChange={(e) => handleItemChange(index, 'Free', e.target.value)}
                                                    onKeyDown={handleKeyDown}
                                                    className="w-full h-full min-w-[70px] font-medium text-black px-2 sm:px-3 py-2 sm:py-3 border-0 bg-transparent text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500"
                                                    placeholder="100"
                                                />
                                            </td>
                                            <td className="p-0 border-r border-gray-400">
                                                <input
                                                    type="text"
                                                    required
                                                    value={item.expiry}
                                                    onChange={(e) => handleItemChange(index, 'expiry', e.target.value)}
                                                    onKeyDown={handleKeyDown}
                                                    className="w-full h-full min-w-[60px] font-medium text-black px-2 sm:px-3 py-2 sm:py-3 border-0 bg-transparent text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500"
                                                    placeholder="MM/YY"
                                                    title="Expiry date in MM/YY format (e.g., 01/25, 12/26)"
                                                    maxLength={5}
                                                />
                                            </td>
                                            <td className="p-0 border-r border-gray-400">
                                                <input
                                                    type="text"
                                                    value={item.batch}
                                                    onChange={(e) => handleItemChange(index, 'batch', e.target.value)}
                                                    onKeyDown={handleKeyDown}
                                                    className="w-full h-full min-w-[150px] font-medium text-black px-2 sm:px-3 py-2 sm:py-3 border-0 bg-transparent text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500"
                                                    placeholder="Batch"
                                                />
                                            </td>
                                            <td className="p-0 border-r border-gray-400">
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    value={item.mrp}
                                                    onChange={(e) => handleItemChange(index, 'mrp', e.target.value)}
                                                    onKeyDown={handleKeyDown}
                                                    className="w-full h-full min-w-[60px] font-medium text-black px-2 sm:px-3 py-2 sm:py-3 border-0 bg-transparent text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500"
                                                    placeholder="0.00"
                                                />
                                            </td>
                                            <td className="p-0 border-r border-gray-400">
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    required
                                                    value={item.rate}
                                                    onChange={(e) => handleItemChange(index, 'rate', e.target.value)}
                                                    onKeyDown={handleKeyDown}
                                                    data-field="rate"
                                                    className="w-full h-full min-w-[60px] font-medium text-black px-2 sm:px-3 py-2 sm:py-3 border-0 bg-transparent text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500"
                                                    placeholder="0.00"
                                                />
                                            </td>
                                            <td className="p-0 border-r border-gray-400">
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    value={item.amount}
                                                    readOnly
                                                    className="w-full h-full min-w-[60px] font-medium text-black px-2 sm:px-3 py-2 sm:py-3 border-0 text-sm sm:text-base bg-gray-50"
                                                    placeholder="0.00"
                                                />
                                            </td>
                                            <td className="px-1.5 sm:px-2 md:px-3 py-2 sm:py-3">
                                                {formData.items.length > 1 && (
                                                    <button
                                                        type="button"
                                                        onClick={() => handleRemoveItem(index)}
                                                        className="text-red-600 hover:text-red-800 transition-colors"
                                                    >
                                                        <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                        </svg>
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            </div>
                        </div>

                        {/* Total Amount */}
                        <div className="mt-3 sm:mt-4 flex justify-end">
                            <div className="bg-blue-50 px-3 sm:px-4 py-2 rounded-lg">
                                <span className="text-xs sm:text-sm font-medium text-blue-800">
                                    Total Amount: ₹{getTotalAmount()}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2 sm:gap-3 pt-4 border-t border-gray-200">
                        <button
                            type="button"
                            onClick={() => router.push('/admin/purchases')}
                            className="w-full sm:w-auto px-4 py-2 text-sm sm:text-base text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors order-2 sm:order-1"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isCreating}
                            className="w-full sm:w-auto px-4 py-2 text-sm sm:text-base bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 order-1 sm:order-2"
                        >
                            {isCreating ? 'Saving...' : 'Save Purchase'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}
