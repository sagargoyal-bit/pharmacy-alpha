'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'

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

            const url = `${endpoint}?${searchParam}=${encodeURIComponent(searchQuery)}&limit=10`
            const response = await fetch(url)

            if (!response.ok) {
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
            return `Supplier: ${sup?.name || option.value}${sup?.contact_person ? `\nContact: ${sup.contact_person}` : ''}${sup?.phone ? `\nPhone: ${sup.phone}` : ''}${sup?.email ? `\nEmail: ${sup.email}` : ''}${sup?.city ? `\nCity: ${sup.city}` : ''}`
            
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
                label: `${item.name}${item.generic_name ? ` (${item.generic_name})` : ''}${item.manufacturer ? ` - ${item.manufacturer}` : ''}`,
                metadata: item
            }))

        case 'supplier_name':
            return data.map(item => ({
                id: item.id || item.name,
                value: item.name,
                label: `${item.name}${item.contact_person ? ` (${item.contact_person})` : ''}${item.city ? ` - ${item.city}` : ''}`,
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
    inTable = false
}: AutocompleteDropdownProps) {
    const [isOpen, setIsOpen] = useState(false)
    const [highlightedIndex, setHighlightedIndex] = useState(-1)
    const [inputValue, setInputValue] = useState(value)
    const [dropdownDirection, setDropdownDirection] = useState<'up' | 'down'>('down')
    const [absolutePosition, setAbsolutePosition] = useState({ top: 0, left: 0, width: 0 })
    const [dropdownHeight, setDropdownHeight] = useState(0)

    const inputRef = useRef<HTMLInputElement>(null)
    const dropdownRef = useRef<HTMLDivElement>(null)
    const optionRefs = useRef<(HTMLDivElement | null)[]>([])

    // Debounce the input value for API calls
    const debouncedInputValue = useDebounce(inputValue, 300)

    // Fetch autocomplete data
    const { options, loading, error, fetchData } = useAutocompleteData(fieldType, debouncedInputValue)

    // Update input value when prop value changes
    useEffect(() => {
        setInputValue(value)
    }, [value])

    // Calculate dropdown position and direction
    const calculateDropdownPositionAndDirection = (actualHeight: number = 240) => {
        if (!inputRef.current) return { direction: 'down' as const, position: { top: 0, left: 0, width: 0 } }
        
        const rect = inputRef.current.getBoundingClientRect()
        const viewportHeight = window.innerHeight
        const spaceBelow = viewportHeight - rect.bottom
        const spaceAbove = rect.top
        
        // Use actual height or estimate
        const estimatedHeight = actualHeight || Math.min(240, (options.length * 40) + 20) // ~40px per option + padding
        
        // Determine direction
        let direction: 'up' | 'down' = 'down'
        
        if (dropdownDirectionProp === 'top') {
            direction = 'up'
        } else if (dropdownDirectionProp === 'bottom') {
            direction = 'down'
        } else {
            // Auto calculation based on actual space needed
            if (inTable) {
                direction = spaceAbove > estimatedHeight + 10 ? 'up' : 'down'
            } else {
                direction = spaceBelow < estimatedHeight + 10 && spaceAbove > spaceBelow ? 'up' : 'down'
            }
        }
        
        // Calculate absolute position
        const position = {
            top: direction === 'up' ? rect.top - estimatedHeight - 4 : rect.bottom + 4,
            left: rect.left,
            width: rect.width
        }
        
        return { direction, position }
    }

    // Fetch data when debounced input changes
    useEffect(() => {
        if (isOpen && debouncedInputValue !== value && debouncedInputValue.trim()) {
            fetchData(debouncedInputValue)
        }
    }, [debouncedInputValue, isOpen, fetchData, value])

    // Handle input change
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newValue = e.target.value
        setInputValue(newValue)
        onChange(newValue)
        
        const { direction, position } = calculateDropdownPositionAndDirection(dropdownHeight)
        setDropdownDirection(direction)
        setAbsolutePosition(position)
        setIsOpen(true)
        setHighlightedIndex(-1)
    }

    // Handle input focus
    const handleInputFocus = () => {
        const { direction, position } = calculateDropdownPositionAndDirection(dropdownHeight)
        setDropdownDirection(direction)
        setAbsolutePosition(position)
        setIsOpen(true)
        if (inputValue && inputValue !== value && inputValue.trim()) {
            fetchData(inputValue)
        }
    }

    // Handle option selection
    const handleOptionSelect = (option: AutocompleteOption) => {
        setInputValue(option.value)
        onChange(option.value)
        setIsOpen(false)
        setHighlightedIndex(-1)
        inputRef.current?.focus()
    }

    // Handle keyboard navigation
    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (!isOpen) {
            if (e.key === 'ArrowDown' || e.key === 'Enter') {
                setIsOpen(true)
                e.preventDefault()
            }
            return
        }

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
                    handleOptionSelect(options[highlightedIndex])
                } else {
                    setIsOpen(false)
                }
                break

            case 'Escape':
                e.preventDefault()
                setIsOpen(false)
                setHighlightedIndex(-1)
                inputRef.current?.blur()
                break

            case 'Tab':
                setIsOpen(false)
                setHighlightedIndex(-1)
                break
        }
    }

    // Scroll highlighted option into view
    useEffect(() => {
        if (highlightedIndex >= 0 && optionRefs.current[highlightedIndex]) {
            optionRefs.current[highlightedIndex]?.scrollIntoView({
                block: 'nearest',
                behavior: 'smooth'
            })
        }
    }, [highlightedIndex])

    // Measure dropdown height after it renders
    useEffect(() => {
        if (isOpen && dropdownRef.current) {
            const height = dropdownRef.current.offsetHeight
            setDropdownHeight(height)
            
            // Recalculate position with actual height
            const { direction, position } = calculateDropdownPositionAndDirection(height)
            setDropdownDirection(direction)
            setAbsolutePosition(position)
        }
    }, [isOpen, options.length, loading, error])

    // Update position on scroll/resize when dropdown is open
    useEffect(() => {
        if (!isOpen) return

        const updatePosition = () => {
            const { direction, position } = calculateDropdownPositionAndDirection(dropdownHeight)
            setDropdownDirection(direction)
            setAbsolutePosition(position)
        }

        const handleScroll = () => updatePosition()
        const handleResize = () => updatePosition()

        window.addEventListener('scroll', handleScroll, true)
        window.addEventListener('resize', handleResize)

        return () => {
            window.removeEventListener('scroll', handleScroll, true)
            window.removeEventListener('resize', handleResize)
        }
    }, [isOpen, dropdownHeight])

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (
                dropdownRef.current &&
                !dropdownRef.current.contains(event.target as Node) &&
                !inputRef.current?.contains(event.target as Node)
            ) {
                setIsOpen(false)
                setHighlightedIndex(-1)
            }
        }

        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    const baseInputClasses = "w-full px-3 py-2 text-sm text-gray-900 placeholder-gray-500 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
    const inputClasses = `${baseInputClasses} ${className} ${disabled ? 'bg-gray-50 cursor-not-allowed' : ''}`

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
                    value={inputValue}
                    onChange={handleInputChange}
                    onFocus={handleInputFocus}
                    onKeyDown={handleKeyDown}
                    placeholder={placeholder}
                    disabled={disabled}
                    required={required}
                    className={inputClasses}
                    autoComplete="off"
                    role="combobox"
                    aria-expanded={isOpen}
                    aria-haspopup="listbox"
                    aria-label={label || `${fieldType} input`}
                />

                {/* Loading indicator */}
                {loading && (
                    <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                        <svg className="animate-spin h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                    </div>
                )}

                {/* Dropdown arrow */}
                {!loading && (
                    <div className="absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none">
                        <svg 
                            className={`h-4 w-4 text-gray-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} 
                            fill="none" 
                            stroke="currentColor" 
                            viewBox="0 0 24 24"
                        >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                    </div>
                )}
            </div>

            {/* Portal Dropdown menu */}
            {isOpen && typeof window !== 'undefined' && createPortal(
                <div
                    ref={dropdownRef}
                    className="fixed bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto z-[99999]"
                    style={{
                        top: absolutePosition.top,
                        left: absolutePosition.left,
                        width: absolutePosition.width,
                        maxHeight: 240
                    }}
                    role="listbox"
                    aria-label={`${fieldType} options`}
                >
                    {loading && options.length === 0 && (
                        <div className="px-3 py-2 text-sm text-gray-500 text-center">
                            Searching...
                        </div>
                    )}

                    {error && (
                        <div className="px-3 py-2 text-sm text-red-500 text-center">
                            {error}
                        </div>
                    )}

                    {!loading && !error && options.length === 0 && inputValue.trim() && (
                        <div className="px-3 py-2 text-sm text-gray-500 text-center">
                            No results found. You can still use "{inputValue}" as a new entry.
                        </div>
                    )}

                    {options.map((option, index) => (
                        <div
                            key={option.id}
                            ref={el => { optionRefs.current[index] = el }}
                            className={`px-3 py-2 text-sm cursor-pointer transition-colors duration-150 ${
                                index === highlightedIndex
                                    ? 'bg-blue-50 text-blue-900'
                                    : 'text-gray-900 hover:bg-gray-50'
                            }`}
                            onClick={() => handleOptionSelect(option)}
                            role="option"
                            aria-selected={index === highlightedIndex}
                            title={getTooltipText(fieldType, option)}
                        >
                            <div className="truncate">{option.label}</div>
                        </div>
                    ))}
                </div>,
                document.body
            )}
        </div>
    )
}
