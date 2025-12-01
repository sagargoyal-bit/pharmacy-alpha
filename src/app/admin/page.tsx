'use client'

import { useGetDashboardStatsQuery } from '@/lib/store/api/pharmacyApi'
import { useEffect } from 'react'

export default function AdminDashboard() {
    // Fetch dashboard data using RTK Query with auto-refresh
    const { 
        data: dashboardData, 
        isLoading, 
        error, 
        refetch,
        isError
    } = useGetDashboardStatsQuery(undefined, {
        pollingInterval: 30000, // Refresh every 30 seconds
        refetchOnMountOrArgChange: true,
        refetchOnFocus: true,
        refetchOnReconnect: true
    })

    // Manual refresh function
    const handleRefresh = () => {
        refetch()
    }

    // Auto-refresh when component mounts
    useEffect(() => {
        refetch()
    }, [refetch])

    // Fallback stats for when API is not connected (no static changes)
    const fallbackStats = [
        {
            title: 'Total Medicines',
            value: '0',
            change: '0%',
            trend: 'neutral',
            icon: '💊'
        },
        {
            title: `Today's Purchases`,
            value: '₹0',
            change: '0%',
            trend: 'neutral',
            icon: '🛒'
        },
        {
            title: 'Expiring Soon',
            value: '0',
            change: '0%',
            trend: 'neutral',
            icon: '⏰'
        },
        {
            title: 'Stock Value',
            value: '₹0',
            change: '0%',
            trend: 'neutral',
            icon: '💰'
        }
    ]

    const fallbackActivity = [
        { id: 1, action: 'No recent activity', time: 'N/A', type: 'system' },
    ]

    // Helper function to format change percentage
    const formatChange = (change: number, trend: string) => {
        if (change === 0) return '0%'
        const sign = change > 0 ? '+' : ''
        return `${sign}${change.toFixed(1)}%`
    }

    // Helper function to get comparison period text
    const getComparisonText = (title: string) => {
        switch (title) {
            case 'Total Medicines':
                return 'from last month'
            case `Today's Purchases`:
                return 'vs yesterday'
            case 'Expiring Soon':
                return 'vs 30 days ago'
            case 'Stock Value':
                return 'from last month'
            default:
                return 'from last period'
        }
    }

    // Use API data if available, otherwise use fallback data
    const stats = dashboardData ? [
        {
            title: 'Total Medicines',
            value: dashboardData.total_medicines.toString(),
            change: formatChange(dashboardData.total_medicines_change, dashboardData.total_medicines_trend),
            trend: dashboardData.total_medicines_trend as 'up' | 'down' | 'neutral',
            icon: '💊'
        },
        {
            title: `Today's Purchases`,
            value: `₹${dashboardData.todays_purchases.toLocaleString()}`,
            change: formatChange(dashboardData.todays_purchases_change, dashboardData.todays_purchases_trend),
            trend: dashboardData.todays_purchases_trend as 'up' | 'down' | 'neutral',
            icon: '🛒'
        },
        {
            title: 'Expiring Soon',
            value: dashboardData.expiring_soon.toString(),
            change: formatChange(dashboardData.expiring_soon_change, dashboardData.expiring_soon_trend),
            trend: dashboardData.expiring_soon_trend as 'up' | 'down' | 'neutral',
            icon: '⏰'
        },
        {
            title: 'Stock Value',
            value: `₹${(dashboardData.stock_value / 100000).toFixed(1)}L`,
            change: formatChange(dashboardData.stock_value_change, dashboardData.stock_value_trend),
            trend: dashboardData.stock_value_trend as 'up' | 'down' | 'neutral',
            icon: '💰'
        }
    ] : fallbackStats

    const recentActivity = dashboardData?.recent_activity || fallbackActivity

    if (isLoading) {
        return (
            <div className="space-y-6">
                <div className="flex justify-between items-center">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Pharmacy Dashboard</h1>
                        <p className="text-gray-600">Loading dashboard data...</p>
                    </div>
                    <button 
                        onClick={handleRefresh}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
                        disabled={isLoading}
                    >
                        <span className="animate-spin">🔄</span>
                        Refreshing...
                    </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {[1, 2, 3, 4].map((i) => (
                        <div key={i} className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 animate-pulse">
                            <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                            <div className="h-8 bg-gray-200 rounded w-1/2 mb-4"></div>
                            <div className="h-3 bg-gray-200 rounded w-1/4"></div>
                        </div>
                    ))}
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {/* Page Header with Refresh Button */}
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Pharmacy Dashboard</h1>
                    <div className="flex items-center gap-4 mt-1">
                        <p className="text-gray-600">
                            {dashboardData ? 
                                'Real-time data with calculated trends' : 
                                'Using demo data (API not connected)'
                            }
                        </p>
                        {isError && (
                            <span className="text-red-600 text-sm">
                                ⚠️ Connection error - showing fallback data
                            </span>
                        )}
                    </div>
                </div>
                <button 
                    onClick={handleRefresh}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
                    disabled={isLoading}
                >
                    <span className={isLoading ? "animate-spin" : ""}>🔄</span>
                    Refresh Data
                </button>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {stats.map((stat, index) => (
                    <div key={index} className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-gray-600">{stat.title}</p>
                                <p className="text-2xl font-bold text-gray-900 mt-1">{stat.value}</p>
                            </div>
                            <div className="text-2xl">{stat.icon}</div>
                        </div>
                        <div className="mt-4">
                            <span className={`inline-flex items-center text-sm font-medium ${
                                stat.trend === 'up' ? 'text-green-600' : 
                                stat.trend === 'down' ? 'text-red-600' : 
                                'text-gray-600'
                            }`}>
                                {stat.trend === 'up' ? '↗' : stat.trend === 'down' ? '↘' : '→'} {stat.change}
                            </span>
                            <span className="text-gray-500 text-sm ml-2">{getComparisonText(stat.title)}</span>
                        </div>
                        {/* Real-time indicator */}
                        <div className="mt-2 flex items-center">
                            <div className={`w-2 h-2 rounded-full mr-2 ${dashboardData ? 'bg-green-500' : 'bg-yellow-500'}`}></div>
                            <span className="text-xs text-gray-500">
                                {dashboardData ? 'Live Calculated' : 'Demo'}
                            </span>
                        </div>
                    </div>
                ))}
            </div>

            {/* Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Recent Activity */}
                <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-semibold text-gray-900">Recent Activity</h3>
                        <div className={`w-3 h-3 rounded-full ${dashboardData ? 'bg-green-500' : 'bg-yellow-500'}`}></div>
                    </div>
                    <div className="space-y-4">
                        {recentActivity.map((activity) => (
                            <div key={activity.id} className="flex items-center space-x-3 p-3 rounded-lg hover:bg-gray-50">
                                <div className={`w-2 h-2 rounded-full ${activity.type === 'purchase' ? 'bg-blue-500' :
                                    activity.type === 'inventory' ? 'bg-green-500' :
                                        activity.type === 'expiry' ? 'bg-red-500' :
                                            'bg-purple-500'
                                    }`} />
                                <div className="flex-1">
                                    <p className="text-sm font-medium text-gray-900">{activity.action}</p>
                                    <p className="text-xs text-gray-500">{activity.time}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                    <a 
                        href="/admin/inventory" 
                        className="w-full mt-4 text-sm text-blue-600 hover:text-blue-700 font-medium block text-center transition-colors"
                    >
                        View all activity →
                    </a>
                </div>

                {/* Quick Actions */}
                <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
                    <div className="grid grid-cols-2 gap-3">
                        <a 
                            href="/admin/purchases" 
                            className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 text-left transition-colors block"
                        >
                            <div className="text-2xl mb-2">🛒</div>
                            <div className="text-sm font-medium text-gray-900">Add Purchase</div>
                            <div className="text-xs text-gray-500">Record new medicine purchase</div>
                        </a>
                        <a 
                            href="/admin/inventory" 
                            className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 text-left transition-colors block"
                        >
                            <div className="text-2xl mb-2">📦</div>
                            <div className="text-sm font-medium text-gray-900">Check Stock</div>
                            <div className="text-xs text-gray-500">View inventory levels</div>
                        </a>
                        <a 
                            href="/admin/expiry" 
                            className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 text-left transition-colors block"
                        >
                            <div className="text-2xl mb-2">⏰</div>
                            <div className="text-sm font-medium text-gray-900">Expiry Alerts</div>
                            <div className="text-xs text-gray-500">Check expiring medicines</div>
                        </a>
                        <a 
                            href="/admin/settings" 
                            className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 text-left transition-colors block"
                        >
                            <div className="text-2xl mb-2">⚙️</div>
                            <div className="text-sm font-medium text-gray-900">Settings</div>
                            <div className="text-xs text-gray-500">Configure pharmacy</div>
                        </a>
                    </div>
                </div>
            </div>

            {/* System Status */}
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">System Status</h3>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className={`flex items-center justify-between p-4 rounded-lg ${dashboardData ? 'bg-green-50' : 'bg-yellow-50'}`}>
                        <div>
                            <div className={`text-sm font-medium ${dashboardData ? 'text-green-900' : 'text-yellow-900'}`}>Database</div>
                            <div className={`text-xs ${dashboardData ? 'text-green-600' : 'text-yellow-600'}`}>
                                {dashboardData ? 'Connected' : 'Fallback Mode'}
                            </div>
                        </div>
                        <div className={`w-3 h-3 rounded-full ${dashboardData ? 'bg-green-500' : 'bg-yellow-500'}`}></div>
                    </div>
                    <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg">
                        <div>
                            <div className="text-sm font-medium text-green-900">Calculations</div>
                            <div className="text-xs text-green-600">Real-time Trends</div>
                        </div>
                        <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                    </div>
                    <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg">
                        <div>
                            <div className="text-sm font-medium text-green-900">Auto-Refresh</div>
                            <div className="text-xs text-green-600">Every 30s</div>
                        </div>
                        <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                    </div>
                    <div className="flex items-center justify-between p-4 bg-yellow-50 rounded-lg">
                        <div>
                            <div className="text-sm font-medium text-yellow-900">Backup</div>
                            <div className="text-xs text-yellow-600">In Progress</div>
                        </div>
                        <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                    </div>
                </div>
            </div>
        </div>
    )
} 