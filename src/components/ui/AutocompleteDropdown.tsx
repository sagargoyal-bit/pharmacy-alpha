'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '@/lib/supabase'

// Type definitions
export type FieldType = 'medicine_name' | 'supplier_name' | 'batch_number'

export interface AutocompleteOption {
    id: string
    value: string
    label: string
    metadata?: any
}

export interface AutocompleteDropdownProps {
    fieldType: FieldType
    value: string
    onChange: (value: string) => void
    placeholder?: string
    label?: string
    className?: string
    disabled?: boolean
    required?: boolean
    dropdownDirection?: 'bottom' | 'top' | 'auto'
    inTable?: boolean
    onAfterSelect?: (inputElement: HTMLInputElement) => void
    showSearchIcon?: boolean
}

// Custom hook for debounced API calls
function useDebounce<T>(value: T, delay: number): T {
    const [debouncedValue, setDebouncedValue] = useState<T>(value)

    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedValue(value)
        }, delay)

        return () => {
            clearTimeout(handler)
        }
    }, [value, delay])

    return debouncedValue
}

// Custom hook for data fetching
function useAutocompleteData(fieldType: FieldType, query: string) {
    const [options, setOptions] = useState<AutocompleteOption[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const fetchData = useCallback(async (searchQuery: string) => {
        if (!searchQuery.trim()) {
            setOptions([])
            return
        }

        setLoading(true)
        setError(null)

        try {
            let endpoint = ''
            let searchParam = 'search'

            switch (fieldType) {
                case 'medicine_name':
                    endpoint = '/api/medicines'
                    break
                case 'supplier_name':
                    endpoint = '/api/suppliers'
                    break
                case 'batch_number':
                    endpoint = '/api/batch-numbers'
                    break
                default:
                    throw new Error(`Unknown field type: ${fieldType}`)
            }

            // Convert search query to uppercase for case-insensitive search
            const uppercaseQuery = searchQuery.toUpperCase()
            const url = `${endpoint}?${searchParam}=${encodeURIComponent(uppercaseQuery)}&limit=10`
            
            // Get auth token for the request
            const { data: { session } } = await supabase.auth.getSession()
            const headers: HeadersInit = {
                'Content-Type': 'application/json',
            }
            
            if (session?.access_token) {
                headers['Authorization'] = `Bearer ${session.access_token}`
            }
            
            const response = await fetch(url, { headers })

            if (!response.ok) {
                if (response.status === 401) {
                    throw new Error('Authentication required. Please log in.')
                }
                throw new Error(`Failed to fetch ${fieldType} data`)
            }

            const data = await response.json()
            const transformedOptions = transformDataToOptions(fieldType, data, searchQuery)
            setOptions(transformedOptions)
        } catch (err) {
            console.error(`Error fetching ${fieldType} data:`, err)
            setError(err instanceof Error ? err.message : 'Failed to fetch data')
            setOptions([])
        } finally {
            setLoading(false)
        }
    }, [fieldType])

    return { options, loading, error, fetchData }
}

// Get tooltip text for options
function getTooltipText(fieldType: FieldType, option: AutocompleteOption): string {
    switch (fieldType) {
        case 'medicine_name':
            const med = option.metadata
            return `Medicine: ${med?.name || option.value}${med?.generic_name ? `\nGeneric: ${med.generic_name}` : ''}${med?.manufacturer ? `\nManufacturer: ${med.manufacturer}` : ''}${med?.strength ? `\nStrength: ${med.strength}` : ''}${med?.unit_type ? `\nUnit: ${med.unit_type}` : ''}`
            
        case 'supplier_name':
            const sup = option.metadata
            return `Supplier: ${sup?.name || option.value}`
            
        case 'batch_number':
            const batch = option.metadata
            return `Batch: ${batch?.batch_number || option.value}${batch?.medicine_name ? `\nMedicine: ${batch.medicine_name}` : ''}${batch?.medicine_generic ? `\nGeneric: ${batch.medicine_generic}` : ''}${batch?.expiry_date ? `\nExpiry: ${new Date(batch.expiry_date).toLocaleDateString()}` : ''}`
            
        default:
            return option.label
    }
}

// Transform API data to autocomplete options
function transformDataToOptions(fieldType: FieldType, data: any[], searchQuery: string = ''): AutocompleteOption[] {
    if (!Array.isArray(data)) return []

    switch (fieldType) {
        case 'medicine_name':
            return data.map(item => ({
                id: item.id || item.name,
                value: item.name,
                label: `${item.name}`,
                metadata: item
            }))

        case 'supplier_name':
            return data.map(item => ({
                id: item.id || item.name,
                value: item.name,
                label: `${item.name}`,
                metadata: item
            }))

        case 'batch_number':
            // Data is already filtered and unique from the dedicated batch-numbers API
            return data.map(item => ({
                id: item.batch_number,
                value: item.batch_number,
                label: `${item.batch_number}${item.medicine_name ? ` (${item.medicine_name})` : ''}${item.expiry_date ? ` - Exp: ${new Date(item.expiry_date).toLocaleDateString()}` : ''}`,
                metadata: item
            }))

        default:
            return []
    }
}

// Get modal title based on field type
function getModalTitle(fieldType: FieldType): string {
    switch (fieldType) {
        case 'medicine_name':
            return 'Select Medicine'
        case 'supplier_name':
            return 'Select Supplier'
        case 'batch_number':
            return 'Select Batch Number'
        default:
            return 'Select Option'
    }
}

export default function AutocompleteDropdown({
    fieldType,
    value,
    onChange,
    placeholder = '',
    label,
    className = '',
    disabled = false,
    required = false,
    dropdownDirection: dropdownDirectionProp = 'auto',
    inTable = false,
    onAfterSelect,
    showSearchIcon = true
}: AutocompleteDropdownProps) {
    const [isOpen, setIsOpen] = useState(false)
    const [highlightedIndex, setHighlightedIndex] = useState(-1)
    const [modalSearchValue, setModalSearchValue] = useState('')

    const inputRef = useRef<HTMLInputElement>(null)
    const modalRef = useRef<HTMLDivElement>(null)
    const modalSearchRef = useRef<HTMLInputElement>(null)
    const optionRefs = useRef<(HTMLDivElement | null)[]>([])
    const shouldIgnoreFocus = useRef(false)

    // Debounce the modal search value for API calls
    const debouncedSearchValue = useDebounce(modalSearchValue, 300)

    // Fetch autocomplete data
    const { options, loading, error, fetchData } = useAutocompleteData(fieldType, debouncedSearchValue)

    // Fetch data when debounced search value changes
    useEffect(() => {
        if (isOpen && debouncedSearchValue.trim()) {
            fetchData(debouncedSearchValue)
        }
    }, [debouncedSearchValue, isOpen, fetchData])

    // Handle input click - opens modal
    const handleInputClick = () => {
        if (!disabled && !shouldIgnoreFocus.current) {
            setIsOpen(true)
            setModalSearchValue(value)
            setHighlightedIndex(-1)
        }
        shouldIgnoreFocus.current = false
    }

    // Handle modal close
    const handleCloseModal = useCallback(() => {
        setIsOpen(false)
        setModalSearchValue('')
        setHighlightedIndex(-1)
        // Set flag to ignore next focus event
        shouldIgnoreFocus.current = true
        // Use setTimeout to ensure state updates before focusing
        setTimeout(() => {
            inputRef.current?.focus()
        }, 0)
    }, [])

    // Handle option selection
    const handleOptionSelect = useCallback((option: AutocompleteOption) => {
        onChange(option.value)
        setIsOpen(false)
        setModalSearchValue('')
        setHighlightedIndex(-1)
        // Set flag to ignore next focus event
        shouldIgnoreFocus.current = true
        
        // If onAfterSelect callback is provided, use it to handle post-selection behavior
        if (onAfterSelect && inputRef.current) {
            const currentInput = inputRef.current
            setTimeout(() => {
                onAfterSelect(currentInput)
            }, 50) // Small delay to ensure modal is fully closed
        } else {
            // Default behavior: focus back on the input
            setTimeout(() => {
                inputRef.current?.focus()
            }, 0)
        }
    }, [onChange, onAfterSelect])

    // Handle modal search input change
    const handleModalSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setModalSearchValue(e.target.value)
        setHighlightedIndex(-1)
    }

    // Handle keyboard navigation in modal
    const handleModalKeyDown = (e: React.KeyboardEvent) => {
        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault()
                setHighlightedIndex(prev => 
                    prev < options.length - 1 ? prev + 1 : 0
                )
                break

            case 'ArrowUp':
                e.preventDefault()
                setHighlightedIndex(prev => 
                    prev > 0 ? prev - 1 : options.length - 1
                )
                break

            case 'Enter':
                e.preventDefault()
                if (highlightedIndex >= 0 && highlightedIndex < options.length) {
                    // Select the highlighted option
                    handleOptionSelect(options[highlightedIndex])
                } else if (modalSearchValue.trim()) {
                    // No option selected but user has typed something - accept it as new value
                    onChange(modalSearchValue.trim())
                    setIsOpen(false)
                    setModalSearchValue('')
                    setHighlightedIndex(-1)
                    shouldIgnoreFocus.current = true
                    
                    if (onAfterSelect && inputRef.current) {
                        const currentInput = inputRef.current
                        setTimeout(() => {
                            onAfterSelect(currentInput)
                        }, 50)
                    } else {
                        setTimeout(() => {
                            inputRef.current?.focus()
                        }, 0)
                    }
                }
                break

            case 'Escape':
                e.preventDefault()
                handleCloseModal()
                break

            case 'Tab':
                e.preventDefault()
                // Keep focus within modal
                break
        }
    }

    // Auto-focus modal search input when modal opens
    useEffect(() => {
        if (isOpen && modalSearchRef.current) {
            modalSearchRef.current.focus()
        }
    }, [isOpen])

    // Scroll highlighted option into view
    useEffect(() => {
        if (highlightedIndex >= 0 && optionRefs.current[highlightedIndex]) {
            optionRefs.current[highlightedIndex]?.scrollIntoView({
                block: 'nearest',
                behavior: 'smooth'
            })
        }
    }, [highlightedIndex])

    const baseInputClasses = "w-full px-3 py-2 text-sm text-gray-900 placeholder-gray-500 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
    const inputClasses = `${baseInputClasses} ${className} ${disabled ? 'bg-gray-50 cursor-not-allowed' : 'cursor-pointer'}`

    return (
        <div className="relative">
            {label && (
                <label className="block text-sm font-medium text-gray-700 mb-2">
                    {label}
                    {required && <span className="text-red-500 ml-1">*</span>}
                </label>
            )}
            
            <div className="relative">
                <input
                    ref={inputRef}
                    type="text"
                    value={value}
                    onClick={handleInputClick}
                    onFocus={handleInputClick}
                    placeholder={placeholder}
                    disabled={disabled}
                    required={required}
                    className={inputClasses}
                    autoComplete="off"
                    readOnly
                    role="combobox"
                    aria-expanded={isOpen}
                    aria-haspopup="dialog"
                    aria-label={label || `${fieldType} input`}
                />

                {/* Dropdown arrow */}
                {showSearchIcon && (
                    <div className="absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none">
                        <svg 
                            className="h-4 w-4 text-gray-400" 
                            fill="none" 
                            stroke="currentColor" 
                            viewBox="0 0 24 24"
                        >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                    </div>
                )}
            </div>

            {/* Modal */}
            {isOpen && typeof window !== 'undefined' && createPortal(
                <div 
                    className="fixed inset-0 bg-white/30 backdrop-blur-sm flex items-center justify-center z-[99999] p-4"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="modal-title"
                >
                    <div
                        ref={modalRef}
                        className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[600px] flex flex-col"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Modal Header */}
                        <div className="flex items-center justify-between p-4 border-b border-gray-200">
                            <h2 id="modal-title" className="text-lg font-semibold text-gray-900">
                                {getModalTitle(fieldType)}
                            </h2>
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.preventDefault()
                                    e.stopPropagation()
                                    handleCloseModal()
                                }}
                                className="text-gray-400 hover:text-gray-600 transition-colors p-1 hover:bg-gray-100 rounded"
                                aria-label="Close modal"
                            >
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        {/* Search Input */}
                        <div className="p-4 border-b border-gray-200">
                            <div className="relative">
                                <input
                                    ref={modalSearchRef}
                                    type="text"
                                    value={modalSearchValue}
                                    onChange={handleModalSearchChange}
                                    onKeyDown={handleModalKeyDown}
                                    placeholder={`Search ${fieldType.replace('_', ' ')}...`}
                                    className="w-full px-4 py-3 pr-10 text-base text-gray-900 placeholder-gray-500 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    autoComplete="off"
                                    autoFocus
                                />
                                
                                {/* Loading indicator */}
                                {loading && (
                                    <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                                        <svg className="animate-spin h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                    </div>
                                )}

                                {/* Search icon */}
                                {!loading && (
                                    <div className="absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none">
                                        <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                        </svg>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Results List */}
                        <div 
                            className="overflow-y-auto max-h-[480px] p-2"
                            role="listbox"
                            aria-label={`${fieldType} options`}
                        >
                            {loading && options.length === 0 && (
                                <div className="px-4 py-8 text-sm text-gray-500 text-center">
                                    Searching...
                                </div>
                            )}

                            {error && (
                                <div className="px-4 py-8 text-sm text-red-500 text-center">
                                    {error}
                                </div>
                            )}

                            {!loading && !error && options.length === 0 && modalSearchValue.trim() && (
                                <div className="px-4 py-8 text-sm text-gray-500 text-center">
                                    No results found. You can still use "{modalSearchValue}" as a new entry.
                                </div>
                            )}

                            {!loading && !error && options.length === 0 && !modalSearchValue.trim() && (
                                <div className="px-4 py-8 text-sm text-gray-500 text-center">
                                    Start typing to search...
                                </div>
                            )}

                            {options.map((option, index) => (
                                <div
                                    key={option.id}
                                    ref={el => { optionRefs.current[index] = el }}
                                    className={`px-4 py-3 rounded-md cursor-pointer transition-colors duration-150 ${
                                        index === highlightedIndex
                                            ? 'bg-blue-50 text-blue-900'
                                            : 'text-gray-900 hover:bg-gray-50'
                                    }`}
                                    onClick={(e) => {
                                        e.preventDefault()
                                        e.stopPropagation()
                                        handleOptionSelect(option)
                                    }}
                                    onMouseDown={(e) => {
                                        e.preventDefault()
                                    }}
                                    role="option"
                                    aria-selected={index === highlightedIndex}
                                    title={getTooltipText(fieldType, option)}
                                >
                                    <div className="truncate">{option.label}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    )
}
