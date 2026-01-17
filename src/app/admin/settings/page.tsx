'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

interface UserInfo {
    id: string
    email: string
    full_name: string
    phone?: string
    role: string
    is_active: boolean
    created_at: string
    tenure_days: number
    pharmacy_role: string
}

interface PharmacyInfo {
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
    last_cleanup_date?: string
    statistics: {
        total_medicines: number
        total_suppliers: number
        total_purchases: number
    }
}

interface UserPharmacyData {
    user: UserInfo
    pharmacy: PharmacyInfo
}

export default function AdminSettings() {
    const [userPharmacyData, setUserPharmacyData] = useState<UserPharmacyData | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [showCleanupModal, setShowCleanupModal] = useState(false)
    const [isCleanupRunning, setIsCleanupRunning] = useState(false)
    const [cleanupResult, setCleanupResult] = useState<any>(null)

    useEffect(() => {
        fetchUserInfo()
    }, [])

    const fetchUserInfo = async () => {
        try {
            setLoading(true)
            
            // Get the current session and add auth header
            const { data: { session } } = await supabase.auth.getSession()
            
            if (!session?.access_token) {
                throw new Error('Authentication required. Please log in again.')
            }
            
            const response = await fetch('/api/user-info', {
                headers: {
                    'Authorization': `Bearer ${session.access_token}`
                }
            })
            
            if (!response.ok) {
                throw new Error('Failed to fetch user information')
            }
            
            const data = await response.json()
            setUserPharmacyData(data)
        } catch (err) {
            setError(err instanceof Error ? err.message : 'An error occurred')
        } finally {
            setLoading(false)
        }
    }

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        })
    }

    const getRoleBadgeColor = (role: string) => {
        switch (role.toLowerCase()) {
            case 'admin':
                return 'bg-red-100 text-red-800'
            case 'owner':
                return 'bg-purple-100 text-purple-800'
            case 'manager':
                return 'bg-blue-100 text-blue-800'
            case 'pharmacist':
                return 'bg-green-100 text-green-800'
            case 'staff':
                return 'bg-gray-100 text-gray-800'
            default:
                return 'bg-gray-100 text-gray-800'
        }
    }

    const getDataRetentionInfo = () => {
        const currentYear = new Date().getFullYear()
        const retentionYears = parseInt(process.env.NEXT_PUBLIC_CLEANUP_RETENTION_YEARS || '2', 10)
        const cutoffYear = currentYear - retentionYears
        
        const lastCleanup = userPharmacyData?.pharmacy.last_cleanup_date
        
        return {
            dataFrom: `January 1, ${cutoffYear}`,
            dateTo: 'Present',
            lastCleanup: lastCleanup ? formatDate(lastCleanup) : 'Never run',
            retentionYears: retentionYears
        }
    }

    const handleCleanupExpiredMedicines = async () => {
        try {
            setIsCleanupRunning(true)
            setCleanupResult(null)
            
            // Get the current session and add auth header
            const { data: { session } } = await supabase.auth.getSession()
            
            if (!session?.access_token) {
                throw new Error('Authentication required. Please log in again.')
            }
            
            const response = await fetch('/api/cleanup-expired', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${session.access_token}`,
                    'Content-Type': 'application/json'
                }
            })
            
            if (!response.ok) {
                const errorData = await response.json()
                throw new Error(errorData.error || 'Failed to run cleanup')
            }
            
            const result = await response.json()
            setCleanupResult(result)
            
        } catch (err) {
            setCleanupResult({
                success: false,
                error: err instanceof Error ? err.message : 'An error occurred during cleanup'
            })
        } finally {
            setIsCleanupRunning(false)
        }
    }

    if (loading) {
        return (
            <div className="space-y-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Pharmacy Settings</h1>
                    <p className="text-gray-600">Configure pharmacy preferences and system settings</p>
                </div>
                <div className="animate-pulse">
                    <div className="bg-gray-200 rounded-lg h-64 mb-6"></div>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div className="bg-gray-200 rounded-lg h-48"></div>
                        <div className="bg-gray-200 rounded-lg h-48"></div>
                    </div>
                </div>
            </div>
        )
    }

    if (error) {
        return (
            <div className="space-y-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Pharmacy Settings</h1>
                    <p className="text-gray-600">Configure pharmacy preferences and system settings</p>
                </div>
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <div className="flex">
                        <div className="flex-shrink-0">
                            <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                            </svg>
                        </div>
                        <div className="ml-3">
                            <h3 className="text-sm font-medium text-red-800">Error loading data</h3>
                            <p className="mt-1 text-sm text-red-700">{error}</p>
                            <button 
                                onClick={fetchUserInfo}
                                className="mt-2 text-sm text-red-600 hover:text-red-500 underline"
                            >
                                Try again
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-8">
            {/* Page Header */}
            <div>
                <h1 className="text-3xl font-bold text-gray-900">Pharmacy Settings</h1>
                <p className="mt-2 text-gray-600">Configure pharmacy preferences and system settings</p>
            </div>

            {/* User & Pharmacy Information Section */}
            {userPharmacyData && (
                <div className="bg-gradient-to-br from-blue-50 to-indigo-100 rounded-xl border border-blue-200 overflow-hidden">
                    <div className="px-6 py-4 bg-gradient-to-r from-blue-600 to-indigo-600">
                        <h2 className="text-xl font-semibold text-white flex items-center">
                            <svg className="w-6 h-6 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                            Current User & Pharmacy Information
                        </h2>
                    </div>
                    
                    <div className="p-6">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                            {/* User Information */}
                            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                                <div className="flex items-center mb-4">
                                    <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                                        <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                        </svg>
                                    </div>
                                    <div className="ml-4">
                                        <h3 className="text-lg font-semibold text-gray-900">User Profile</h3>
                                        <p className="text-sm text-gray-500">Personal information and role</p>
                                    </div>
                                </div>
                                
                                <div className="space-y-4">
                                    <div className="flex justify-between items-center">
                                        <span className="text-sm font-medium text-gray-600">Full Name</span>
                                        <span className="text-sm text-gray-900 font-medium">{userPharmacyData.user.full_name}</span>
                                    </div>
                                    
                                    <div className="flex justify-between items-center">
                                        <span className="text-sm font-medium text-gray-600">Email</span>
                                        <span className="text-sm text-gray-900">{userPharmacyData.user.email}</span>
                                    </div>
                                    
                                    {userPharmacyData.user.phone && (
                                        <div className="flex justify-between items-center">
                                            <span className="text-sm font-medium text-gray-600">Phone</span>
                                            <span className="text-sm text-gray-900">{userPharmacyData.user.phone}</span>
                                        </div>
                                    )}
                                    
                                    <div className="flex justify-between items-center">
                                        <span className="text-sm font-medium text-gray-600">System Role</span>
                                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getRoleBadgeColor(userPharmacyData.user.role)}`}>
                                            {userPharmacyData.user.role}
                                        </span>
                                    </div>
                                    
                                    <div className="flex justify-between items-center">
                                        <span className="text-sm font-medium text-gray-600">Pharmacy Role</span>
                                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getRoleBadgeColor(userPharmacyData.user.pharmacy_role)}`}>
                                            {userPharmacyData.user.pharmacy_role}
                                        </span>
                                    </div>
                                    
                                    <div className="flex justify-between items-center">
                                        <span className="text-sm font-medium text-gray-600">Member Since</span>
                                        <span className="text-sm text-gray-900">{formatDate(userPharmacyData.user.created_at)}</span>
                                    </div>
                                    
                                    <div className="flex justify-between items-center">
                                        <span className="text-sm font-medium text-gray-600">Tenure</span>
                                        <span className="text-sm text-gray-900">
                                            {userPharmacyData.user.tenure_days} days
                                            {userPharmacyData.user.tenure_days > 365 && (
                                                <span className="text-gray-500 ml-1">
                                                    ({Math.floor(userPharmacyData.user.tenure_days / 365)} years)
                                                </span>
                                            )}
                                        </span>
                                    </div>
                                    
                                    <div className="flex justify-between items-center">
                                        <span className="text-sm font-medium text-gray-600">Status</span>
                                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                            userPharmacyData.user.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                                        }`}>
                                            {userPharmacyData.user.is_active ? 'Active' : 'Inactive'}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Pharmacy Information */}
                            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                                <div className="flex items-center mb-4">
                                    <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                                        <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                        </svg>
                                    </div>
                                    <div className="ml-4">
                                        <h3 className="text-lg font-semibold text-gray-900">Pharmacy Details</h3>
                                        <p className="text-sm text-gray-500">Business information and statistics</p>
                                    </div>
                                </div>
                                
                                <div className="space-y-4">
                                    <div className="flex justify-between items-center">
                                        <span className="text-sm font-medium text-gray-600">Pharmacy Name</span>
                                        <span className="text-sm text-gray-900 font-medium">{userPharmacyData.pharmacy.name}</span>
                                    </div>
                                    
                                    <div className="flex justify-between items-center">
                                        <span className="text-sm font-medium text-gray-600">License Number</span>
                                        <span className="text-sm text-gray-900 font-mono">{userPharmacyData.pharmacy.license_number}</span>
                                    </div>
                                    
                                    {userPharmacyData.pharmacy.gst_number && (
                                        <div className="flex justify-between items-center">
                                            <span className="text-sm font-medium text-gray-600">GST Number</span>
                                            <span className="text-sm text-gray-900 font-mono">{userPharmacyData.pharmacy.gst_number}</span>
                                        </div>
                                    )}
                                    
                                    <div className="flex justify-between items-start">
                                        <span className="text-sm font-medium text-gray-600">Address</span>
                                        <div className="text-right">
                                            <div className="text-sm text-gray-900">{userPharmacyData.pharmacy.address}</div>
                                            <div className="text-sm text-gray-500">
                                                {userPharmacyData.pharmacy.city}, {userPharmacyData.pharmacy.state} {userPharmacyData.pharmacy.pincode}
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <div className="flex justify-between items-center">
                                        <span className="text-sm font-medium text-gray-600">Phone</span>
                                        <span className="text-sm text-gray-900">{userPharmacyData.pharmacy.phone}</span>
                                    </div>
                                    
                                    {userPharmacyData.pharmacy.email && (
                                        <div className="flex justify-between items-center">
                                            <span className="text-sm font-medium text-gray-600">Email</span>
                                            <span className="text-sm text-gray-900">{userPharmacyData.pharmacy.email}</span>
                                        </div>
                                    )}
                                    
                                    <div className="flex justify-between items-center">
                                        <span className="text-sm font-medium text-gray-600">Established</span>
                                        <span className="text-sm text-gray-900">{formatDate(userPharmacyData.pharmacy.created_at)}</span>
                                    </div>
                                    
                                    <div className="border-t border-gray-200 pt-4 mt-4">
                                        <div className="flex items-center mb-3">
                                            <svg className="w-4 h-4 text-blue-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                            </svg>
                                            <span className="text-sm font-semibold text-gray-700">Data Retention</span>
                                        </div>
                                        
                                        <div className="space-y-2 bg-blue-50 rounded-lg p-3">
                                            <div className="flex justify-between items-center">
                                                <span className="text-xs font-medium text-gray-600">Current Data Range</span>
                                                <span className="text-xs text-gray-900 font-medium">
                                                    {getDataRetentionInfo().dataFrom} - {getDataRetentionInfo().dateTo}
                                                </span>
                                            </div>
                                            
                                            <div className="flex justify-between items-center">
                                                <span className="text-xs font-medium text-gray-600">Retention Period</span>
                                                <span className="text-xs text-gray-900 font-medium">
                                                    {getDataRetentionInfo().retentionYears} years
                                                </span>
                                            </div>
                                            
                                            <div className="flex justify-between items-center">
                                                <span className="text-xs font-medium text-gray-600">Last Cleanup</span>
                                                <span className="text-xs text-gray-900 font-medium">
                                                    {getDataRetentionInfo().lastCleanup}
                                                </span>
                                            </div>
                                            
                                            <div className="text-xs text-gray-500 mt-2 pt-2 border-t border-blue-100">
                                                <svg className="w-3 h-3 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                </svg>
                                                Expired medicines older than {getDataRetentionInfo().retentionYears} years are automatically removed
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                
                                {/* Quick Stats */}
                                <div className="mt-6 pt-4 border-t border-gray-200">
                                    <h4 className="text-sm font-medium text-gray-900 mb-3">Quick Statistics</h4>
                                    <div className="grid grid-cols-3 gap-4">
                                        <div className="text-center">
                                            <div className="text-lg font-semibold text-blue-600">{userPharmacyData.pharmacy.statistics.total_medicines}</div>
                                            <div className="text-xs text-gray-500">Medicines</div>
                                        </div>
                                        <div className="text-center">
                                            <div className="text-lg font-semibold text-green-600">{userPharmacyData.pharmacy.statistics.total_suppliers}</div>
                                            <div className="text-xs text-gray-500">Suppliers</div>
                                        </div>
                                        <div className="text-center">
                                            <div className="text-lg font-semibold text-purple-600">{userPharmacyData.pharmacy.statistics.total_purchases}</div>
                                            <div className="text-xs text-gray-500">Purchases</div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Settings Categories */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Data Management */}
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                    <div className="flex items-center mb-4">
                        <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                            <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                        </div>
                        <h3 className="ml-3 text-lg font-semibold text-gray-900">Expired Medicine Cleanup</h3>
                    </div>
                    
                    <div className="space-y-4">
                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                            <div className="flex">
                                <svg className="w-5 h-5 text-amber-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                                <div className="ml-3">
                                    <p className="text-sm text-amber-800">
                                        This will permanently delete expired medicine records that are <strong>2+ years old</strong>. This action cannot be undone.
                                    </p>
                                </div>
                            </div>
                        </div>
                        
                        {/* <div className="text-sm text-gray-600 space-y-2">
                            <p><strong>What gets deleted:</strong></p>
                            <ul className="list-disc list-inside space-y-1 ml-2">
                                <li>Current inventory records</li>
                                <li>Stock transaction history</li>
                                <li>Purchase items</li>
                                <li>Orphaned purchase records</li>
                            </ul>
                        </div> */}
                       
                        <button 
                            onClick={() => setShowCleanupModal(true)}
                            disabled={isCleanupRunning}
                            className="w-full px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors duration-200 font-medium disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center"
                        > 
                            {isCleanupRunning ? (
                                <>
                                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    Running Cleanup...
                                </>
                            ) : (
                                <>
                                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                    Run Cleanup Now
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>

            {/* Cleanup Confirmation Modal */}
            {showCleanupModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
                        <div className="p-6">
                            <div className="flex items-center mb-4">
                                <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                                    <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                    </svg>
                                </div>
                                <h3 className="ml-4 text-lg font-semibold text-gray-900">Confirm Cleanup</h3>
                            </div>
                            
                            {!cleanupResult ? (
                                <>
                                    <div className="mb-6">
                                        <p className="text-gray-700 mb-4">
                                            Are you sure you want to run the expired medicine cleanup?
                                        </p>
                                        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                                            <p className="text-sm text-red-800 font-medium mb-2">⚠️ Warning:</p>
                                            <ul className="text-sm text-red-700 space-y-1 list-disc list-inside">
                                                <li>This will permanently delete expired medicines from 2+ years ago (before {new Date().getFullYear() - 2})</li>
                                                <li>Deleted data cannot be recovered</li>
                                                <li>This may take several minutes to complete</li>
                                            </ul>
                                        </div>
                                    </div>
                                    
                                    <div className="flex space-x-3">
                                        <button
                                            onClick={() => setShowCleanupModal(false)}
                                            disabled={isCleanupRunning}
                                            className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors duration-200 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            onClick={handleCleanupExpiredMedicines}
                                            disabled={isCleanupRunning}
                                            className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors duration-200 font-medium disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center"
                                        >
                                            {isCleanupRunning ? (
                                                <>
                                                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                    </svg>
                                                    Running...
                                                </>
                                            ) : (
                                                'Continue'
                                            )}
                                        </button>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div className="mb-6">
                                        {cleanupResult.success ? (
                                            <>
                                                <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
                                                    <div className="flex">
                                                        <svg className="w-5 h-5 text-green-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                        </svg>
                                                        <div className="ml-3">
                                                            <p className="text-sm font-medium text-green-800">Cleanup completed successfully!</p>
                                                        </div>
                                                    </div>
                                                </div>
                                                
                                                {cleanupResult.stats && (
                                                    <div className="bg-gray-50 rounded-lg p-4">
                                                        <p className="text-sm font-medium text-gray-700 mb-2">Deletion Summary:</p>
                                                        <div className="space-y-1 text-sm text-gray-600">
                                                            <div className="flex justify-between">
                                                                <span>Current Inventory:</span>
                                                                <span className="font-medium">{cleanupResult.stats.current_inventory}</span>
                                                            </div>
                                                            <div className="flex justify-between">
                                                                <span>Stock Transactions:</span>
                                                                <span className="font-medium">{cleanupResult.stats.stock_transactions}</span>
                                                            </div>
                                                            <div className="flex justify-between">
                                                                <span>Purchase Items:</span>
                                                                <span className="font-medium">{cleanupResult.stats.purchase_items}</span>
                                                            </div>
                                                            <div className="flex justify-between">
                                                                <span>Orphaned Purchases:</span>
                                                                <span className="font-medium">{cleanupResult.stats.purchases}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                            </>
                                        ) : (
                                            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                                                <div className="flex">
                                                    <svg className="w-5 h-5 text-red-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                    </svg>
                                                    <div className="ml-3">
                                                        <p className="text-sm font-medium text-red-800">Cleanup failed</p>
                                                        <p className="text-sm text-red-700 mt-1">{cleanupResult.error}</p>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                    
                                    <button
                                        onClick={() => {
                                            setShowCleanupModal(false)
                                            setCleanupResult(null)
                                        }}
                                        className="w-full px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors duration-200 font-medium"
                                    >
                                        Close
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
} 