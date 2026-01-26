'use client'

import { useGetExpiryStatsQuery, useGetExpiryAlertsQuery } from '@/lib/store/api/pharmacyApi'
import { useState, useMemo } from 'react'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import AutocompleteDropdown from '@/components/ui/AutocompleteDropdown'
import { supabase } from '@/lib/supabase'

export default function ExpiryTracking() {
    // Filter state
    const [filters, setFilters] = useState({
        medicine_name: '',
        batch_number: '',
        supplier_name: '',
        start_date: '',
        end_date: ''
    })

    // Applied filters state (for actual API calls)
    const [appliedFilters, setAppliedFilters] = useState({
        medicine_name: '',
        batch_number: '',
        supplier_name: '',
        start_date: '',
        end_date: '',
        days: 90 // Default to 90 days on initial load
    })

    // Pagination state
    const [currentPage, setCurrentPage] = useState(1)
    const itemsPerPage = 10

    // PDF download state
    const [isDownloading, setIsDownloading] = useState(false)

    // RTK Query hooks to fetch expiry data
    const { data: expiryStats, isLoading, error } = useGetExpiryStatsQuery()

    // Build filter parameters for expiry alerts query
    // Check if any specific filters are applied
    const hasSpecificFilters = !!(
        appliedFilters.medicine_name ||
        appliedFilters.batch_number ||
        appliedFilters.supplier_name ||
        appliedFilters.start_date ||
        appliedFilters.end_date
    )

    // Always include page and limit to ensure RTK Query detects parameter changes
    const alertsParams = useMemo(() => {
        const params: any = {
            page: currentPage,
            limit: itemsPerPage
        }

        // Only include days restriction if no other filters are applied (for initial load)
        if (!hasSpecificFilters) {
            params.days = appliedFilters.days
        }

        // Add other filters if they exist
        if (appliedFilters.medicine_name) params.medicine_name = appliedFilters.medicine_name
        if (appliedFilters.batch_number) params.batch_number = appliedFilters.batch_number
        if (appliedFilters.supplier_name) params.supplier_name = appliedFilters.supplier_name
        if (appliedFilters.start_date) params.start_date = appliedFilters.start_date
        if (appliedFilters.end_date) params.end_date = appliedFilters.end_date

        return params
    }, [
        currentPage,
        itemsPerPage,
        hasSpecificFilters,
        appliedFilters.days,
        appliedFilters.medicine_name,
        appliedFilters.batch_number,
        appliedFilters.supplier_name,
        appliedFilters.start_date,
        appliedFilters.end_date
    ])

    const { data: expiryResponse, isLoading: alertsLoading } = useGetExpiryAlertsQuery(alertsParams)

    // Extract data and metadata from response
    const expiryAlerts = expiryResponse?.data || []
    const totalResults = expiryResponse?.total || 0
    const totalPages = expiryResponse?.totalPages || 1
    const totalValueAtRisk = expiryResponse?.totalValueAtRisk || 0

    // Helper function to calculate days to expiry
    const getDaysToExpiry = (expiryDate: string) => {
        const today = new Date()
        const expiry = new Date(expiryDate)
        const diffTime = expiry.getTime() - today.getTime()
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
        return diffDays
    }

    // Filter handlers
    const handleFilterChange = (field: string, value: string | number) => {
        setFilters({
            ...filters,
            [field]: value
        })
    }

    const handleSubmitFilters = () => {
        setAppliedFilters({
            medicine_name: filters.medicine_name,
            batch_number: filters.batch_number,
            supplier_name: filters.supplier_name,
            start_date: filters.start_date,
            end_date: filters.end_date,
            days: 90 // Keep days for internal logic, but won't be used if other filters are applied
        })
        setCurrentPage(1) // Reset to first page when applying new filters
    }

    const clearFilters = () => {
        const defaultFormFilters = {
            medicine_name: '',
            batch_number: '',
            supplier_name: '',
            start_date: '',
            end_date: ''
        }
        const defaultAppliedFilters = {
            medicine_name: '',
            batch_number: '',
            supplier_name: '',
            start_date: '',
            end_date: '',
            days: 90 // Reset to 90 days for initial load
        }
        setFilters(defaultFormFilters)
        setAppliedFilters(defaultAppliedFilters)
        setCurrentPage(1) // Reset to first page when clearing filters
    }

    // Pagination functions
    const handlePageChange = (page: number) => {
        setCurrentPage(page)
    }

    const handlePreviousPage = () => {
        setCurrentPage(prev => Math.max(prev - 1, 1))
    }

    const handleNextPage = () => {
        if (currentPage < totalPages) {
            setCurrentPage(prev => prev + 1)
        }
    }

    // Calculate if there are more pages
    const hasNextPage = currentPage < totalPages
    const hasPreviousPage = currentPage > 1

    // PDF Download Function
    const downloadExpiryDataAsPDF = async () => {
        if (isDownloading) return
        
        setIsDownloading(true)
        
        try {
            // Fetch ALL data without pagination
            const params = new URLSearchParams()
            
            // Add all current filters but no pagination
            if (appliedFilters.medicine_name) params.append('medicine_name', appliedFilters.medicine_name)
            if (appliedFilters.batch_number) params.append('batch_number', appliedFilters.batch_number)
            if (appliedFilters.supplier_name) params.append('supplier_name', appliedFilters.supplier_name)
            if (appliedFilters.start_date) params.append('start_date', appliedFilters.start_date)
            if (appliedFilters.end_date) params.append('end_date', appliedFilters.end_date)
            
            // Set a high limit to get all results
            params.append('limit', '10000')
            params.append('page', '1')
            
            // Only include days restriction if no other filters are applied
            if (!hasSpecificFilters) {
                params.append('days', appliedFilters.days.toString())
            }
            
            // Get the current session and add auth header
            const { data: { session } } = await supabase.auth.getSession()
            
            if (!session?.access_token) {
                alert('Authentication required. Please log in again.')
                return
            }
            
            const response = await fetch(`/api/expiry?${params.toString()}`, {
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`
                }
            })
            
            if (!response.ok) {
                console.error('Failed to fetch expiry data:', response.status, response.statusText)
                alert(`Failed to fetch data: ${response.statusText}`)
                return
            }
            
            const allData = await response.json()
            
            if (!allData.data || allData.data.length === 0) {
                alert('No data to export')
                return
            }
            
            // Create PDF
            const doc = new jsPDF('landscape', 'mm', 'a4')
            const pageWidth = doc.internal.pageSize.getWidth()
            
            // Add header with better formatting
            doc.setFontSize(20)
            doc.setFont('helvetica', 'bold')
            doc.text('Expiry Tracking Report', 20, 25)
            
            // Add a line under the header
            doc.setLineWidth(0.5)
            doc.line(20, 30, pageWidth - 20, 30)
            
            // Add export info with better spacing
            doc.setFontSize(11)
            doc.setFont('helvetica', 'normal')
            const exportDate = new Date().toLocaleString('en-IN', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
            })
            doc.text(`Generated on: ${exportDate}`, 20, 40)
            doc.text(`Total Records: ${allData.total}`, 20, 46)
            
            // Format currency properly
            const formattedValueAtRisk = new Intl.NumberFormat('en-IN', {
                style: 'currency',
                currency: 'INR',
                maximumFractionDigits: 0
            }).format(allData.totalValueAtRisk || 0)
            doc.text(`Total Value at Risk: ${formattedValueAtRisk}`, 20, 52)
            
            // Add filters info with better formatting
            let yPosition = 62
            doc.setFontSize(12)
            doc.setFont('helvetica', 'bold')
            doc.text('Applied Filters:', 20, yPosition)
            yPosition += 8
            
            doc.setFontSize(10)
            doc.setFont('helvetica', 'normal')
            
            // Check if any filters are applied
            const hasAnyFilters = hasSpecificFilters || appliedFilters.start_date || appliedFilters.end_date
            
            if (hasAnyFilters) {
                if (appliedFilters.medicine_name) {
                    doc.text(`• Medicine Name: ${appliedFilters.medicine_name}`, 25, yPosition)
                    yPosition += 5
                }
                if (appliedFilters.batch_number) {
                    doc.text(`• Batch Number: ${appliedFilters.batch_number}`, 25, yPosition)
                    yPosition += 5
                }
                if (appliedFilters.supplier_name) {
                    doc.text(`• Supplier Name: ${appliedFilters.supplier_name}`, 25, yPosition)
                    yPosition += 5
                }
                if (appliedFilters.start_date) {
                    const formattedStartDate = new Date(appliedFilters.start_date).toLocaleDateString('en-IN')
                    doc.text(`• From Date: ${formattedStartDate}`, 25, yPosition)
                    yPosition += 5
                }
                if (appliedFilters.end_date) {
                    const formattedEndDate = new Date(appliedFilters.end_date).toLocaleDateString('en-IN')
                    doc.text(`• To Date: ${formattedEndDate}`, 25, yPosition)
                    yPosition += 5
                }
            } else {
                doc.text(`• Showing medicines expiring in next ${appliedFilters.days} days`, 25, yPosition)
                yPosition += 5
            }
            
            // Add some spacing before table
            yPosition += 5
            
            // Prepare table data with better formatting
            const tableData = allData.data.map((item: any, index: number) => {
                const daysToExpiry = getDaysToExpiry(item.expiry_date)
                const daysText = daysToExpiry < 0
                    ? `Expired ${Math.abs(daysToExpiry)} days ago`
                    : daysToExpiry === 0
                        ? 'Expires today'
                        : `${daysToExpiry} days left`
                
                // Format currency values properly
                const sellingRate = item.quantity > 0 ? (item.estimated_loss / item.quantity) : 0
                const formattedSellingRate = new Intl.NumberFormat('en-IN', {
                    style: 'currency',
                    currency: 'INR',
                    minimumFractionDigits: 2
                }).format(sellingRate)
                
                const formattedMRP = new Intl.NumberFormat('en-IN', {
                    style: 'currency',
                    currency: 'INR',
                    minimumFractionDigits: 2
                }).format(item.mrp || 0)
                
                // Format expiry date
                const formattedExpiryDate = new Date(item.expiry_date).toLocaleDateString('en-IN')
                
                return [
                    (index + 1).toString(), // Serial number
                    item.medicine_name || '-',
                    item.supplier_name || '-',
                    item.batch_number || '-',
                    `${item.quantity || 0}`,
                    formattedExpiryDate,
                    daysText,
                    formattedSellingRate,
                    formattedMRP
                ]
            })
            
            // Add table with improved formatting
            autoTable(doc, {
                head: [['S.No', 'Medicine Name', 'Supplier', 'Batch No.', 'Qty', 'Expiry Date', 'Days to Expiry', 'S.Rate', 'MRP']],
                body: tableData,
                startY: yPosition,
                theme: 'striped',
                styles: {
                    fontSize: 9,
                    cellPadding: { top: 3, right: 2, bottom: 3, left: 2 },
                    overflow: 'linebreak',
                    halign: 'left',
                    valign: 'middle'
                },
                headStyles: {
                    fillColor: [41, 128, 185], // Professional blue
                    textColor: 255,
                    fontStyle: 'bold',
                    fontSize: 10,
                    halign: 'center'
                },
                columnStyles: {
                    0: { cellWidth: 15, halign: 'center' }, // S.No
                    1: { cellWidth: 45 }, // Medicine Name
                    2: { cellWidth: 35 }, // Supplier
                    3: { cellWidth: 25, halign: 'center' }, // Batch Number
                    4: { cellWidth: 20, halign: 'center' }, // Quantity
                    5: { cellWidth: 25, halign: 'center' }, // Expiry Date
                    6: { cellWidth: 30, halign: 'center' }, // Days to Expiry
                    7: { cellWidth: 25, halign: 'right' }, // S.Rate
                    8: { cellWidth: 25, halign: 'right' }, // MRP
                },
                alternateRowStyles: {
                    fillColor: [245, 247, 250]
                },
                margin: { left: 20, right: 20 },
                didDrawPage: function (data) {
                    // Add page numbers
                    doc.setFontSize(8)
                    doc.setFont('helvetica', 'normal')
                    const pageNumber = (doc as any).internal.getCurrentPageInfo().pageNumber
                    const totalPages = (doc as any).internal.pages.length - 1
                    doc.text(`Page ${pageNumber} of ${totalPages}`, pageWidth - 40, doc.internal.pageSize.getHeight() - 10)
                }
            })
            
            // Save the PDF
            const fileName = `expiry-report-${new Date().toISOString().split('T')[0]}.pdf`
            doc.save(fileName)
            
        } catch (error) {
            console.error('Error generating PDF:', error)
            alert('Failed to generate PDF. Please try again.')
        } finally {
            setIsDownloading(false)
        }
    }

    return (
        <div className="space-y-4 md:space-y-6">
            {/* Page Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Expiry Tracking</h1>
                    <p className="text-sm sm:text-base text-gray-600">Monitor medicine expiry dates and manage expired stock</p>
                </div>
            </div>

            {/* Expiry Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                <div className="bg-white p-3 sm:p-4 rounded-lg border border-gray-200">
                    <div className="text-xl sm:text-2xl font-bold text-red-600">
                        {isLoading ? (
                            <div className="animate-pulse bg-gray-200 h-6 sm:h-8 w-6 sm:w-8 rounded"></div>
                        ) : (
                            expiryStats?.expiredThisWeek || 0
                        )}
                    </div>
                    <div className="text-xs sm:text-sm text-gray-600 mt-1">Expired This Week</div>
                </div>
                <div className="bg-white p-3 sm:p-4 rounded-lg border border-gray-200">
                    <div className="text-xl sm:text-2xl font-bold text-orange-600">
                        {isLoading ? (
                            <div className="animate-pulse bg-gray-200 h-6 sm:h-8 w-6 sm:w-8 rounded"></div>
                        ) : (
                            expiryStats?.expiringIn30Days || 0
                        )}
                    </div>
                    <div className="text-xs sm:text-sm text-gray-600 mt-1">Expiring in 30 Days</div>
                </div>
                <div className="bg-white p-3 sm:p-4 rounded-lg border border-gray-200">
                    <div className="text-xl sm:text-2xl font-bold text-yellow-600">
                        {isLoading ? (
                            <div className="animate-pulse bg-gray-200 h-6 sm:h-8 w-6 sm:w-8 rounded"></div>
                        ) : (
                            expiryStats?.expiringIn90Days || 0
                        )}
                    </div>
                    <div className="text-xs sm:text-sm text-gray-600 mt-1">Expiring in 90 Days</div>
                </div>
                <div className="bg-white p-3 sm:p-4 rounded-lg border border-gray-200">
                    <div className="text-xl sm:text-2xl font-bold text-blue-600">
                        {alertsLoading ? (
                            <div className="animate-pulse bg-gray-200 h-6 sm:h-8 w-12 sm:w-16 rounded"></div>
                        ) : (
                            `₹${totalValueAtRisk.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
                        )}
                    </div>
                    <div className="text-xs sm:text-sm text-gray-600 mt-1">
                        Value at Risk
                        {totalResults > 0 && (
                            <div className="text-xs text-gray-500 mt-1">
                                All filtered results ({totalResults} items)
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Filter Section */}
            <div className="bg-white rounded-lg border border-gray-200 p-4 sm:p-5 md:p-6">
                <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">Filter Expiry Alerts</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3 sm:gap-4">
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
                            fieldType="batch_number"
                            value={filters.batch_number}
                            onChange={(value) => handleFilterChange('batch_number', value)}
                            placeholder="Search by batch number..."
                            label="Batch Number"
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
                        <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">From Date</label>
                        <input
                            type="date"
                            value={filters.start_date}
                            onChange={(e) => handleFilterChange('start_date', e.target.value)}
                            className="w-full px-2 sm:px-3 py-2 text-xs sm:text-sm text-gray-900 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                    <div>
                        <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">To Date</label>
                        <input
                            type="date"
                            value={filters.end_date}
                            onChange={(e) => handleFilterChange('end_date', e.target.value)}
                            className="w-full px-2 sm:px-3 py-2 text-xs sm:text-sm text-gray-900 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                </div>
                <div className="mt-3 sm:mt-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4">
                    <div className="text-xs sm:text-sm text-gray-600 order-2 sm:order-1">
                        {alertsLoading ? 'Searching...' : `Found ${expiryAlerts.length} results`}
                        {!hasSpecificFilters && (
                            <span className="block sm:inline sm:ml-2 text-blue-600 text-xs sm:text-sm">
                                • Showing next 90 days
                            </span>
                        )}
                        {hasSpecificFilters && (
                            <span className="block sm:inline sm:ml-2 text-green-600 text-xs sm:text-sm">
                                • Searching entire database
                            </span>
                        )}
                        {(appliedFilters.start_date || appliedFilters.end_date) && (
                            <span className="block sm:inline sm:ml-2 text-purple-600 text-xs sm:text-sm">
                                • Custom date range
                            </span>
                        )}
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 w-full sm:w-auto order-1 sm:order-2">
                        <button
                            onClick={handleSubmitFilters}
                            className="group relative px-3 sm:px-4 py-2 text-xs sm:text-sm text-white bg-gradient-to-r from-blue-600 to-indigo-600 rounded-lg font-medium shadow-lg hover:shadow-xl hover:from-blue-700 hover:to-indigo-700 transform hover:-translate-y-0.5 transition-all duration-200 focus:outline-none focus:ring-4 focus:ring-blue-200"
                        >
                            <span className="relative flex items-center justify-center gap-2">
                                <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.414A1 1 0 013 6.707V4z" />
                                </svg>
                                Apply Filters
                            </span>
                        </button>
                        <button
                            onClick={clearFilters}
                            className="group relative px-3 sm:px-4 py-2 text-xs sm:text-sm text-gray-700 bg-white border-2 border-gray-200 rounded-lg font-medium shadow-md hover:shadow-lg hover:border-red-300 hover:text-red-600 transform hover:-translate-y-0.5 transition-all duration-200 focus:outline-none focus:ring-4 focus:ring-red-100"
                        >
                            <span className="relative flex items-center justify-center gap-2">
                                <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                                Clear Filters
                            </span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Expiry Table */}
            <div className="bg-white rounded-lg border border-gray-200 p-3 sm:p-4 md:p-6">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-3 sm:mb-4">
                    <h3 className="text-base sm:text-lg font-semibold text-gray-900">All Expiry Alerts</h3>
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 w-full sm:w-auto">
                        <div className="text-xs sm:text-sm text-gray-600">
                            {!alertsLoading && totalResults > 0 && (
                                <span className="inline-flex items-center gap-1.5 sm:gap-2 bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 text-emerald-700 px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-full font-medium shadow-sm text-xs sm:text-sm">
                                    <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    <span className="whitespace-nowrap">{totalResults} total result{totalResults !== 1 ? 's' : ''}</span>
                                </span>
                            )}
                        </div>
                        {!alertsLoading && totalResults > 0 && (
                            <button
                                onClick={downloadExpiryDataAsPDF}
                                disabled={isDownloading}
                                className={`group relative px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium shadow-lg transform transition-all duration-200 focus:outline-none focus:ring-4 ${
                                    isDownloading
                                        ? 'bg-gray-400 text-white cursor-not-allowed'
                                        : 'text-white bg-sky-500 hover:shadow-xl hover:-translate-y-0.5 focus:ring-purple-200'
                                }`}
                            >
                                <span className="relative flex items-center justify-center gap-1.5 sm:gap-2 whitespace-nowrap">
                                    {isDownloading ? (
                                        <>
                                            <svg className="animate-spin w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                            </svg>
                                            <span className="hidden sm:inline">Generating PDF...</span>
                                            <span className="sm:hidden">Generating...</span>
                                        </>
                                    ) : (
                                        <>
                                            <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                            </svg>
                                            <span className="hidden sm:inline">Download PDF</span>
                                            <span className="sm:hidden">PDF</span>
                                        </>
                                    )}
                                </span>
                            </button>
                        )}
                    </div>
                </div>
                <div className="overflow-x-auto -mx-3 sm:-mx-4 md:-mx-6">
                    <div className="inline-block min-w-full align-middle px-3 sm:px-4 md:px-6">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th scope="col" className="px-2 sm:px-4 md:px-6 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                                    Medicine Name
                                </th>
                                <th scope="col" className="px-2 sm:px-4 md:px-6 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                                    Supplier Name
                                </th>
                                <th scope="col" className="px-2 sm:px-4 md:px-6 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                                    Batch Number
                                </th>
                                <th scope="col" className="px-2 sm:px-4 md:px-6 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                                    Quantity
                                </th>
                                <th scope="col" className="px-2 sm:px-4 md:px-6 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                                    Expiry Date
                                </th>
                                <th scope="col" className="px-2 sm:px-4 md:px-6 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                                    Days to Expiry
                                </th>
                                <th scope="col" className="px-2 sm:px-4 md:px-6 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                                   S.Rate
                                </th>
                                <th scope="col" className="px-2 sm:px-4 md:px-6 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                                    MRP
                                </th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {alertsLoading ? (
                                // Loading skeleton
                                Array.from({ length: 3 }).map((_, index) => (
                                    <tr key={index}>
                                        <td className="px-2 sm:px-4 md:px-6 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm font-medium text-gray-900">
                                            <div className="animate-pulse bg-gray-200 h-3 sm:h-4 w-24 sm:w-32 rounded"></div>
                                        </td>
                                        <td className="px-2 sm:px-4 md:px-6 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-500">
                                            <div className="animate-pulse bg-gray-200 h-3 w-20 sm:w-24 rounded"></div>
                                        </td>
                                        <td className="px-2 sm:px-4 md:px-6 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-500">
                                            <div className="animate-pulse bg-gray-200 h-3 w-20 sm:w-24 rounded"></div>
                                        </td>
                                        <td className="px-2 sm:px-4 md:px-6 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-500">
                                            <div className="animate-pulse bg-gray-200 h-3 w-12 sm:w-16 rounded"></div>
                                        </td>
                                        <td className="px-2 sm:px-4 md:px-6 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-500">
                                            <div className="animate-pulse bg-gray-200 h-3 w-12 sm:w-16 rounded"></div>
                                        </td>
                                        <td className="px-2 sm:px-4 md:px-6 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-500">
                                            <div className="animate-pulse bg-gray-200 h-3 w-12 sm:w-16 rounded"></div>
                                        </td>
                                        <td className="px-2 sm:px-4 md:px-6 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-500">
                                            <div className="animate-pulse bg-gray-200 h-3 w-12 sm:w-16 rounded"></div>
                                        </td>
                                        <td className="px-2 sm:px-4 md:px-6 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-500">
                                            <div className="animate-pulse bg-gray-200 h-3 w-12 sm:w-16 rounded"></div>
                                        </td>
                                    </tr>
                                ))
                            ) : expiryAlerts.length > 0 ? (
                                expiryAlerts.map((item, index) => {
                                    const daysToExpiry = getDaysToExpiry(item.expiry_date)

                                    return (
                                        <tr key={index}>
                                            <td className="px-2 sm:px-4 md:px-6 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm font-medium text-gray-900">
                                                <div className="min-w-[100px] sm:min-w-[120px] truncate">{item.medicine_name}</div>
                                            </td>
                                            <td className="px-2 sm:px-4 md:px-6 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-500">
                                                <div className="min-w-[80px] sm:min-w-[100px] truncate">{item.supplier_name || '-'}</div>
                                            </td>
                                            <td className="px-2 sm:px-4 md:px-6 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-500">
                                                <div className="min-w-[70px] sm:min-w-[80px] truncate">{item.batch_number || '-'}</div>
                                            </td>
                                            <td className="px-2 sm:px-4 md:px-6 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-500">
                                                <div className="min-w-[60px]">{item.quantity} units</div>
                                            </td>
                                            <td className="px-2 sm:px-4 md:px-6 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-500">
                                                <div className="min-w-[70px]">{new Date(item.expiry_date).toLocaleDateString()}</div>
                                            </td>
                                            <td className="px-2 sm:px-4 md:px-6 py-3 sm:py-4 text-xs sm:text-sm text-gray-500">
                                                <div className="min-w-[100px] sm:min-w-[120px]">
                                                    {daysToExpiry < 0
                                                        ? `Expired ${Math.abs(daysToExpiry)} days ago`
                                                        : daysToExpiry === 0
                                                            ? 'Expires today'
                                                            : `Expires in ${daysToExpiry} days`
                                                    }
                                                </div>
                                            </td>
                                            <td className="px-2 sm:px-4 md:px-6 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-500">
                                                <div className="min-w-[60px]">₹{item.quantity > 0 ? (item.estimated_loss / item.quantity).toFixed(2) : '0.00'}</div>
                                            </td>
                                            <td className="px-2 sm:px-4 md:px-6 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-500">
                                                <div className="min-w-[60px]">₹{item.mrp?.toFixed(2) || '0.00'}</div>
                                            </td>
                                        </tr>
                                    )
                                })
                            ) : (
                                <tr>
                                    <td colSpan={8} className="px-3 sm:px-4 md:px-6 py-6 sm:py-8 text-center text-xs sm:text-sm text-gray-500">
                                        No expiry alerts found.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                    </div>
                </div>

                {/* Pagination Controls */}
                {(expiryAlerts.length > 0 || currentPage > 1) && (
                    <div className="mt-3 sm:mt-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-t border-gray-200 pt-3 sm:pt-4">
                        <div className="text-xs sm:text-sm text-gray-700 order-2 sm:order-1">
                            <span className="block sm:inline">Showing page {currentPage} of {totalPages}</span>
                            <span className="text-gray-500 block sm:inline">
                                {expiryAlerts.length > 0 && (
                                    ` (${((currentPage - 1) * itemsPerPage) + 1}-${((currentPage - 1) * itemsPerPage) + expiryAlerts.length} of ${totalResults} items)`
                                )}
                            </span>
                        </div>
                        <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto order-1 sm:order-2">
                            <button
                                onClick={handlePreviousPage}
                                disabled={!hasPreviousPage}
                                className={`flex-1 sm:flex-none group relative px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all duration-200 ${hasPreviousPage
                                    ? 'text-gray-700 bg-white border border-gray-300 shadow-md hover:shadow-lg hover:bg-gradient-to-r hover:from-gray-50 hover:to-blue-50 hover:border-blue-300 transform hover:-translate-y-0.5 focus:outline-none focus:ring-4 focus:ring-blue-100'
                                    : 'text-gray-400 bg-gray-50 border border-gray-200 cursor-not-allowed opacity-60'
                                    }`}
                            >
                                <span className="flex items-center justify-center gap-1">
                                    <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                                    </svg>
                                    <span className="hidden sm:inline">Previous</span>
                                    <span className="sm:hidden">Prev</span>
                                </span>
                            </button>

                            <div className="px-3 sm:px-4 py-2 text-xs sm:text-sm font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 rounded-lg shadow-lg whitespace-nowrap">
                                Page {currentPage}
                            </div>

                            <button
                                onClick={handleNextPage}
                                disabled={!hasNextPage}
                                className={`flex-1 sm:flex-none group relative px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all duration-200 ${hasNextPage
                                    ? 'text-gray-700 bg-white border border-gray-300 shadow-md hover:shadow-lg hover:bg-gradient-to-r hover:from-blue-50 hover:to-gray-50 hover:border-blue-300 transform hover:-translate-y-0.5 focus:outline-none focus:ring-4 focus:ring-blue-100'
                                    : 'text-gray-400 bg-gray-50 border border-gray-200 cursor-not-allowed opacity-60'
                                    }`}
                            >
                                <span className="flex items-center justify-center gap-1">
                                    Next
                                    <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                    </svg>
                                </span>
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
} 