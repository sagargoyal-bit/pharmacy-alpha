'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useAppDispatch } from '@/lib/store'
import { useGetPurchasesQuery, useGetPurchasesStatsQuery } from '@/lib/store/api/pharmacyApi'
import { addNotification } from '@/lib/store/slices/uiSlice'
import { supabase } from '@/lib/supabase'

export default function PurchaseEntry() {
    const dispatch = useAppDispatch()
    const [selectedPurchaseDetails, setSelectedPurchaseDetails] = useState<any>(null)
    const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false)

    // RTK Query hooks
    const { data: purchases } = useGetPurchasesQuery({ page: 1, limit: 10 })
    const { data: purchasesStats, isLoading: statsLoading } = useGetPurchasesStatsQuery()

    // Handle viewing purchase details
    const handleViewPurchaseDetails = async (purchaseId: string) => {
        try {
            // Get auth token for the request
            const { data: { session } } = await supabase.auth.getSession()
            const headers: HeadersInit = {
                'Content-Type': 'application/json',
            }
            
            if (session?.access_token) {
                headers['Authorization'] = `Bearer ${session.access_token}`
            }
            
            // Fetch complete purchase details from the API
            const response = await fetch(`/api/purchases?purchase_id=${purchaseId}`, { headers })
            if (!response.ok) throw new Error('Failed to fetch purchase details')
            
            const data = await response.json()
            setSelectedPurchaseDetails(data)
            setIsDetailsModalOpen(true)
        } catch (error) {
            console.error('Error fetching purchase details:', error)
            dispatch(addNotification({
                type: 'error',
                title: 'Error',
                message: 'Failed to load purchase details'
            }))
        }
    }

    return (
        <div className="space-y-4 md:space-y-6">
            {/* Page Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                    <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Purchase Entry</h1>
                    <p className="text-sm sm:text-base text-gray-600">Record daily medicine purchases from wholesalers</p>
                </div>
                <Link
                    href="/admin/purchases/new"
                    className="w-full sm:w-auto px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm sm:text-base text-center"
                >
                    + Add Purchase
                </Link>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                <div className="bg-white p-3 sm:p-4 rounded-lg border border-gray-200">
                    <div className="text-xl sm:text-2xl font-bold text-gray-900">
                        {statsLoading ? (
                            <div className="animate-pulse bg-gray-200 h-6 sm:h-8 w-16 sm:w-20 rounded"></div>
                        ) : (
                            `₹${(purchasesStats?.todaysPurchases || 0).toLocaleString('en-IN')}`
                        )}
                    </div>
                    <div className="text-xs sm:text-sm text-gray-600 mt-1">Today&apos;s Purchases</div>
                </div>
                <div className="bg-white p-3 sm:p-4 rounded-lg border border-gray-200">
                    <div className="text-xl sm:text-2xl font-bold text-green-600">
                        {statsLoading ? (
                            <div className="animate-pulse bg-gray-200 h-6 sm:h-8 w-16 sm:w-20 rounded"></div>
                        ) : (
                            `₹${(purchasesStats?.thisMonth || 0).toLocaleString('en-IN')}`
                        )}
                    </div>
                    <div className="text-xs sm:text-sm text-gray-600 mt-1">This Month</div>
                </div>
                <div className="bg-white p-3 sm:p-4 rounded-lg border border-gray-200">
                    <div className="text-xl sm:text-2xl font-bold text-blue-600">
                        {statsLoading ? (
                            <div className="animate-pulse bg-gray-200 h-6 sm:h-8 w-12 sm:w-16 rounded"></div>
                        ) : (
                            purchasesStats?.totalEntries || 0
                        )}
                    </div>
                    <div className="text-xs sm:text-sm text-gray-600 mt-1">Total Entries</div>
                </div>
                <div className="bg-white p-3 sm:p-4 rounded-lg border border-gray-200">
                    <div className="text-xl sm:text-2xl font-bold text-yellow-600">
                        {statsLoading ? (
                            <div className="animate-pulse bg-gray-200 h-6 sm:h-8 w-10 sm:w-12 rounded"></div>
                        ) : (
                            purchasesStats?.differentSuppliers || 0
                        )}
                    </div>
                    <div className="text-xs sm:text-sm text-gray-600 mt-1">Different Suppliers</div>
                </div>
            </div>

            {/* Recent Purchases */}
            <div className="bg-white rounded-lg border border-gray-200 p-3 sm:p-4 md:p-6">
                <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">Recent Purchases (Last 10)</h3>
                <div className="overflow-x-auto -mx-3 sm:-mx-4 md:-mx-6">
                    <div className="inline-block min-w-full align-middle px-3 sm:px-4 md:px-6">
                    <table className="min-w-full table-auto">
                        <thead>
                            <tr className="bg-gray-50">
                                <th className="px-2 sm:px-3 md:px-4 py-2 text-left text-xs sm:text-sm font-medium text-gray-700 whitespace-nowrap">Medicine Name</th>
                                <th className="px-2 sm:px-3 md:px-4 py-2 text-left text-xs sm:text-sm font-medium text-gray-700 whitespace-nowrap">Supplier</th>
                                <th className="px-2 sm:px-3 md:px-4 py-2 text-left text-xs sm:text-sm font-medium text-gray-700 whitespace-nowrap">Quantity</th>
                                <th className="px-2 sm:px-3 md:px-4 py-2 text-left text-xs sm:text-sm font-medium text-gray-700 whitespace-nowrap">Free</th>
                                <th className="px-2 sm:px-3 md:px-4 py-2 text-left text-xs sm:text-sm font-medium text-gray-700 whitespace-nowrap">S.Rate</th>
                                <th className="px-2 sm:px-3 md:px-4 py-2 text-left text-xs sm:text-sm font-medium text-gray-700 whitespace-nowrap">MRP</th>
                                <th className="px-2 sm:px-3 md:px-4 py-2 text-left text-xs sm:text-sm font-medium text-gray-700 whitespace-nowrap">Purchase Date</th>
                                <th className="px-2 sm:px-3 md:px-4 py-2 text-left text-xs sm:text-sm font-medium text-gray-700 whitespace-nowrap">Total</th>
                            </tr>
                        </thead>
                        <tbody className="space-y-2">
                            {statsLoading ? (
                                // Loading skeleton
                                Array.from({ length: 3 }).map((_, index) => (
                                    <tr key={index} className="border-t border-gray-200">
                                        <td className="px-2 sm:px-3 md:px-4 py-2"><div className="animate-pulse bg-gray-200 h-3 sm:h-4 w-24 sm:w-32 rounded"></div></td>
                                        <td className="px-2 sm:px-3 md:px-4 py-2"><div className="animate-pulse bg-gray-200 h-3 sm:h-4 w-20 sm:w-24 rounded"></div></td>
                                        <td className="px-2 sm:px-3 md:px-4 py-2"><div className="animate-pulse bg-gray-200 h-3 sm:h-4 w-12 sm:w-16 rounded"></div></td>
                                        <td className="px-2 sm:px-3 md:px-4 py-2"><div className="animate-pulse bg-gray-200 h-3 sm:h-4 w-10 sm:w-12 rounded"></div></td>
                                        <td className="px-2 sm:px-3 md:px-4 py-2"><div className="animate-pulse bg-gray-200 h-3 sm:h-4 w-10 sm:w-12 rounded"></div></td>
                                        <td className="px-2 sm:px-3 md:px-4 py-2"><div className="animate-pulse bg-gray-200 h-3 sm:h-4 w-10 sm:w-12 rounded"></div></td>
                                        <td className="px-2 sm:px-3 md:px-4 py-2"><div className="animate-pulse bg-gray-200 h-3 sm:h-4 w-16 sm:w-20 rounded"></div></td>
                                        <td className="px-2 sm:px-3 md:px-4 py-2"><div className="animate-pulse bg-gray-200 h-3 sm:h-4 w-12 sm:w-16 rounded"></div></td>
                                    </tr>
                                ))
                            ) : purchasesStats?.recentPurchases && purchasesStats.recentPurchases.length > 0 ? (
                                // Show only the last 10 purchases (API already limits to 10, but being explicit)
                                purchasesStats.recentPurchases.slice(0, 10).map((purchase: any) => (
                                    <tr key={purchase.id} className="border-t border-gray-200 hover:bg-gray-50">
                                        <td className="px-2 sm:px-3 md:px-4 py-2 text-xs sm:text-sm text-gray-900">
                                            <div className="min-w-[120px]">
                                                <span className="break-words">{purchase.medicine_name}</span>
                                                {purchase.items_count > 1 && (
                                                    <button
                                                        onClick={() => handleViewPurchaseDetails(purchase.id)}
                                                        className="text-xs text-blue-600 hover:text-blue-800 ml-1 underline cursor-pointer"
                                                    >
                                                        (+{purchase.items_count - 1} more)
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-2 sm:px-3 md:px-4 py-2 text-xs sm:text-sm text-gray-900">
                                            <div className="min-w-[100px] truncate">{purchase.supplier}</div>
                                        </td>
                                        <td className="px-2 sm:px-3 md:px-4 py-2 text-xs sm:text-sm text-gray-900">
                                            <div className="min-w-[50px]">{purchase.quantity}</div>
                                        </td>
                                        <td className="px-2 sm:px-3 md:px-4 py-2 text-xs sm:text-sm text-gray-900">
                                            <div className="min-w-[50px]">{purchase.Free || '-'}</div>
                                        </td>
                                        <td className="px-2 sm:px-3 md:px-4 py-2 text-xs sm:text-sm text-gray-900">
                                            <div className="min-w-[60px] whitespace-nowrap">₹{purchase.rate.toFixed(2)}</div>
                                        </td>
                                        <td className="px-2 sm:px-3 md:px-4 py-2 text-xs sm:text-sm text-gray-900">
                                            <div className="min-w-[60px] whitespace-nowrap">₹{purchase.mrp.toFixed(2)}</div>
                                        </td>
                                        <td className="px-2 sm:px-3 md:px-4 py-2 text-xs sm:text-sm text-gray-900">
                                            <div className="min-w-[80px] whitespace-nowrap">{new Date(purchase.purchase_date).toLocaleDateString('en-IN')}</div>
                                        </td>
                                        <td className="px-2 sm:px-3 md:px-4 py-2 text-xs sm:text-sm text-gray-900">
                                            <div className="min-w-[70px] whitespace-nowrap">₹{purchase.total.toLocaleString('en-IN')}</div>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr className="border-t border-gray-200">
                                    <td colSpan={8} className="px-3 sm:px-4 py-6 sm:py-8 text-center text-xs sm:text-sm text-gray-500">
                                        No recent purchases found
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                    </div>
                </div>
            </div>

            {/* Purchase Details Modal */}
            {isDetailsModalOpen && selectedPurchaseDetails && (
                <div className="fixed inset-0 bg-white/30 backdrop-blur-sm flex items-center justify-center z-50 p-2 sm:p-4">
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-5xl max-h-[95vh] sm:max-h-[90vh] overflow-y-auto">
                        {/* Modal Header */}
                        <div className="flex items-start sm:items-center justify-between p-4 sm:p-6 border-b border-gray-200 sticky top-0 bg-white z-10">
                            <div className="flex-1 min-w-0 mr-2">
                                <h2 className="text-lg sm:text-xl font-semibold text-gray-900">Purchase Details</h2>
                                <p className="text-xs sm:text-sm text-gray-600 mt-1 break-words">
                                    Invoice: {selectedPurchaseDetails[0]?.invoice_number || 'N/A'} | 
                                    Date: {selectedPurchaseDetails[0]?.purchase_date ? new Date(selectedPurchaseDetails[0].purchase_date).toLocaleDateString('en-IN') : 'N/A'}
                                </p>
                            </div>
                            <button
                                onClick={() => {
                                    setIsDetailsModalOpen(false)
                                    setSelectedPurchaseDetails(null)
                                }}
                                className="text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0"
                            >
                                <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        {/* Modal Content */}
                        <div className="p-4 sm:p-6">
                            <div className="overflow-x-auto -mx-4 sm:-mx-6">
                                <div className="inline-block min-w-full align-middle px-4 sm:px-6">
                                <table className="min-w-full border border-gray-200 rounded-lg">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="px-2 sm:px-3 md:px-4 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-semibold text-gray-600 uppercase border-b border-gray-200 whitespace-nowrap">#</th>
                                            <th className="px-2 sm:px-3 md:px-4 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-semibold text-gray-600 uppercase border-b border-gray-200 whitespace-nowrap">Medicine Name</th>
                                            <th className="px-2 sm:px-3 md:px-4 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-semibold text-gray-600 uppercase border-b border-gray-200 whitespace-nowrap">Batch</th>
                                            <th className="px-2 sm:px-3 md:px-4 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-semibold text-gray-600 uppercase border-b border-gray-200 whitespace-nowrap">Qty</th>
                                            <th className="px-2 sm:px-3 md:px-4 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-semibold text-gray-600 uppercase border-b border-gray-200 whitespace-nowrap">Free</th>
                                            <th className="px-2 sm:px-3 md:px-4 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-semibold text-gray-600 uppercase border-b border-gray-200 whitespace-nowrap">MRP</th>
                                            <th className="px-2 sm:px-3 md:px-4 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-semibold text-gray-600 uppercase border-b border-gray-200 whitespace-nowrap">Rate</th>
                                            <th className="px-2 sm:px-3 md:px-4 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-semibold text-gray-600 uppercase border-b border-gray-200 whitespace-nowrap">Amount</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {selectedPurchaseDetails.map((item: any, index: number) => (
                                            <tr key={item.id} className={`${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-blue-50`}>
                                                <td className="px-2 sm:px-3 md:px-4 py-2 sm:py-3 text-xs sm:text-sm text-gray-700 border-b border-gray-200">{index + 1}</td>
                                                <td className="px-2 sm:px-3 md:px-4 py-2 sm:py-3 text-xs sm:text-sm text-gray-900 border-b border-gray-200">
                                                    <div className="font-medium min-w-[120px] break-words">{item.medicine_name}</div>
                                                    {item.generic_name && (
                                                        <div className="text-xs text-gray-500 break-words">{item.generic_name}</div>
                                                    )}
                                                </td>
                                                <td className="px-2 sm:px-3 md:px-4 py-2 sm:py-3 text-xs sm:text-sm text-gray-900 border-b border-gray-200">
                                                    <div className="min-w-[60px] truncate">{item.batch_number || '-'}</div>
                                                </td>
                                                <td className="px-2 sm:px-3 md:px-4 py-2 sm:py-3 text-xs sm:text-sm text-gray-900 border-b border-gray-200">
                                                    <div className="min-w-[40px]">{item.quantity}</div>
                                                </td>
                                                <td className="px-2 sm:px-3 md:px-4 py-2 sm:py-3 text-xs sm:text-sm text-gray-900 border-b border-gray-200">
                                                    <div className="min-w-[50px]">{item.Free || '-'}</div>
                                                </td>
                                                <td className="px-2 sm:px-3 md:px-4 py-2 sm:py-3 text-xs sm:text-sm text-gray-900 border-b border-gray-200">
                                                    <div className="min-w-[60px] whitespace-nowrap">₹{item.mrp?.toFixed(2) || '0.00'}</div>
                                                </td>
                                                <td className="px-2 sm:px-3 md:px-4 py-2 sm:py-3 text-xs sm:text-sm text-gray-900 border-b border-gray-200">
                                                    <div className="min-w-[60px] whitespace-nowrap">₹{item.purchase_rate?.toFixed(2) || '0.00'}</div>
                                                </td>
                                                <td className="px-2 sm:px-3 md:px-4 py-2 sm:py-3 text-xs sm:text-sm font-medium text-gray-900 border-b border-gray-200">
                                                    <div className="min-w-[70px] whitespace-nowrap">₹{((item.quantity || 0) * (item.purchase_rate || 0)).toFixed(2)}</div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot className="bg-gray-50">
                                        <tr>
                                            <td colSpan={7} className="px-2 sm:px-3 md:px-4 py-2 sm:py-3 text-right text-xs sm:text-sm font-semibold text-gray-900 border-t-2 border-gray-300">
                                                Total:
                                            </td>
                                            <td className="px-2 sm:px-3 md:px-4 py-2 sm:py-3 text-xs sm:text-sm font-bold text-gray-900 border-t-2 border-gray-300 whitespace-nowrap">
                                                ₹{selectedPurchaseDetails[0]?.total_amount?.toLocaleString('en-IN') || '0.00'}
                                            </td>
                                        </tr>
                                    </tfoot>
                                </table>
                                </div>
                            </div>

                            {/* Additional Info */}
                            <div className="mt-4 sm:mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 p-3 sm:p-4 bg-gray-50 rounded-lg">
                                <div>
                                    <span className="text-xs sm:text-sm font-medium text-gray-600">Supplier:</span>
                                    <span className="ml-2 text-xs sm:text-sm text-gray-900 break-words">{selectedPurchaseDetails[0]?.supplier_name || 'N/A'}</span>
                                </div>
                                <div>
                                    <span className="text-xs sm:text-sm font-medium text-gray-600">Total Items:</span>
                                    <span className="ml-2 text-xs sm:text-sm text-gray-900">{selectedPurchaseDetails.length}</span>
                                </div>
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="flex items-center justify-end p-4 sm:p-6 border-t border-gray-200 bg-gray-50">
                            <button
                                onClick={() => {
                                    setIsDetailsModalOpen(false)
                                    setSelectedPurchaseDetails(null)
                                }}
                                className="w-full sm:w-auto px-4 py-2 text-sm sm:text-base bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
} 