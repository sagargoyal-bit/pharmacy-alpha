'use client'

import { useState, useEffect } from 'react'

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

    useEffect(() => {
        fetchUserInfo()
    }, [])

    const fetchUserInfo = async () => {
        try {
            setLoading(true)
            const response = await fetch('/api/user-info')
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
                        <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                            <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
                            </svg>
                        </div>
                        <h3 className="ml-3 text-lg font-semibold text-gray-900">Data Management</h3>
                    </div>
                    
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Backup Schedule</label>
                            <select className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                                <option>Daily at 2:00 AM</option>
                                <option>Weekly on Sunday</option>
                                <option>Monthly</option>
                            </select>
                        </div>
                        
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Data Retention</label>
                            <select className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                                <option>Keep for 7 years</option>
                                <option>Keep for 5 years</option>
                                <option>Keep indefinitely</option>
                            </select>
                        </div>
                        
                        <button className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200 font-medium">
                            Run Manual Backup
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
} 