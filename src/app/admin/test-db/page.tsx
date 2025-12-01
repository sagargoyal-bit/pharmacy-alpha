'use client'

import { useState, useEffect } from 'react'

export default function TestDatabasePage() {
    const [connectionStatus, setConnectionStatus] = useState<any>(null)
    const [dashboardStats, setDashboardStats] = useState<any>(null)
    const [isLoading, setIsLoading] = useState(false)
    const [addingPurchase, setAddingPurchase] = useState(false)

    // Test database connection
    const testConnection = async () => {
        setIsLoading(true)
        try {
            const response = await fetch('/api/test-connection')
            const data = await response.json()
            setConnectionStatus(data)
        } catch (error) {
            console.error('Error testing connection:', error)
            setConnectionStatus({ status: 'error', message: 'Failed to connect' })
        } finally {
            setIsLoading(false)
        }
    }

    // Fetch dashboard stats
    const fetchDashboardStats = async () => {
        try {
            const response = await fetch('/api/dashboard/stats')
            const data = await response.json()
            setDashboardStats(data)
        } catch (error) {
            console.error('Error fetching dashboard stats:', error)
        }
    }

    // Add a test purchase for today to see the dashboard update
    const addTestPurchase = async () => {
        setAddingPurchase(true)
        try {
            const testPurchase = {
                supplier_name: 'Test Supplier',
                invoice_number: `TEST-${Date.now()}`,
                date: new Date().toISOString().split('T')[0], // Today's date
                items: [
                    {
                        medicine_name: 'Paracetamol',
                        quantity: 50,
                        expiry_date: '2025-12-31',
                        batch_number: `BATCH-${Date.now()}`,
                        mrp: 10.50,
                        rate: 8.50,
                        amount: 425
                    }
                ]
            }

            const response = await fetch('/api/purchases', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(testPurchase)
            })

            if (response.ok) {
                alert('Test purchase added successfully! Check the dashboard.')
                fetchDashboardStats() // Refresh stats
            } else {
                const error = await response.json()
                alert(`Failed to add purchase: ${error.message || 'Unknown error'}`)
            }
        } catch (error) {
            console.error('Error adding test purchase:', error)
            alert('Failed to add purchase. Check console for details.')
        } finally {
            setAddingPurchase(false)
        }
    }

    useEffect(() => {
        testConnection()
        fetchDashboardStats()
    }, [])

    return (
        <div className="space-y-6 p-6 max-w-4xl mx-auto">
            <div>
                <h1 className="text-2xl font-bold text-gray-900">Database Test & Dashboard Preview</h1>
                <p className="text-gray-600">Test database connection and add sample data to see dashboard in action</p>
            </div>

            {/* Connection Status */}
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-lg font-semibold text-gray-900">Database Connection</h2>
                    <button 
                        onClick={testConnection}
                        disabled={isLoading}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                    >
                        {isLoading ? 'Testing...' : 'Test Connection'}
                    </button>
                </div>

                {connectionStatus && (
                    <div className="space-y-3">
                        <div className={`p-3 rounded-lg ${
                            connectionStatus.status === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
                        }`}>
                            <div className="font-medium">{connectionStatus.message}</div>
                            <div className="text-sm mt-1">Environment: Supabase URL & Key are {connectionStatus.environment?.supabaseUrl === 'Set' ? '✅ Configured' : '❌ Missing'}</div>
                        </div>

                        {connectionStatus.tableStatus && (
                            <div className="grid grid-cols-3 gap-3">
                                {Object.entries(connectionStatus.tableStatus).map(([table, status]: [string, any]) => (
                                    <div key={table} className={`p-2 rounded text-sm ${
                                        status.exists ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                                    }`}>
                                        <div className="font-medium">{table}</div>
                                        <div>{status.exists ? `${status.count} records` : 'Not found'}</div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Dashboard Stats Preview */}
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-lg font-semibold text-gray-900">Current Dashboard Stats</h2>
                    <button 
                        onClick={fetchDashboardStats}
                        className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                    >
                        Refresh Stats
                    </button>
                </div>

                {dashboardStats && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="p-4 bg-blue-50 rounded-lg">
                            <div className="text-sm text-blue-600">Total Medicines</div>
                            <div className="text-2xl font-bold text-blue-900">{dashboardStats.total_medicines}</div>
                            <div className="text-xs text-blue-600 mt-1">
                                {dashboardStats.total_medicines_change !== undefined && (
                                    <span className={dashboardStats.total_medicines_trend === 'up' ? 'text-green-600' : 
                                                   dashboardStats.total_medicines_trend === 'down' ? 'text-red-600' : 'text-gray-600'}>
                                        {dashboardStats.total_medicines_trend === 'up' ? '↗' : 
                                         dashboardStats.total_medicines_trend === 'down' ? '↘' : '→'} 
                                        {dashboardStats.total_medicines_change.toFixed(1)}% vs last month
                                    </span>
                                )}
                            </div>
                        </div>
                        <div className="p-4 bg-green-50 rounded-lg">
                            <div className="text-sm text-green-600">Today&apos;s Purchases</div>
                            <div className="text-2xl font-bold text-green-900">₹{dashboardStats.todays_purchases.toLocaleString()}</div>
                            <div className="text-xs text-green-600 mt-1">
                                {dashboardStats.todays_purchases_change !== undefined && (
                                    <span className={dashboardStats.todays_purchases_trend === 'up' ? 'text-green-600' : 
                                                   dashboardStats.todays_purchases_trend === 'down' ? 'text-red-600' : 'text-gray-600'}>
                                        {dashboardStats.todays_purchases_trend === 'up' ? '↗' : 
                                         dashboardStats.todays_purchases_trend === 'down' ? '↘' : '→'} 
                                        {dashboardStats.todays_purchases_change.toFixed(1)}% vs yesterday
                                    </span>
                                )}
                            </div>
                        </div>
                        <div className="p-4 bg-yellow-50 rounded-lg">
                            <div className="text-sm text-yellow-600">Expiring Soon</div>
                            <div className="text-2xl font-bold text-yellow-900">{dashboardStats.expiring_soon}</div>
                            <div className="text-xs text-yellow-600 mt-1">
                                {dashboardStats.expiring_soon_change !== undefined && (
                                    <span className={dashboardStats.expiring_soon_trend === 'up' ? 'text-red-600' : 
                                                   dashboardStats.expiring_soon_trend === 'down' ? 'text-green-600' : 'text-gray-600'}>
                                        {dashboardStats.expiring_soon_trend === 'up' ? '↗' : 
                                         dashboardStats.expiring_soon_trend === 'down' ? '↘' : '→'} 
                                        {dashboardStats.expiring_soon_change.toFixed(1)}% vs 30 days ago
                                    </span>
                                )}
                            </div>
                        </div>
                        <div className="p-4 bg-purple-50 rounded-lg">
                            <div className="text-sm text-purple-600">Stock Value</div>
                            <div className="text-2xl font-bold text-purple-900">₹{dashboardStats.stock_value.toLocaleString()}</div>
                            <div className="text-xs text-purple-600 mt-1">
                                {dashboardStats.stock_value_change !== undefined && (
                                    <span className={dashboardStats.stock_value_trend === 'up' ? 'text-green-600' : 
                                                   dashboardStats.stock_value_trend === 'down' ? 'text-red-600' : 'text-gray-600'}>
                                        {dashboardStats.stock_value_trend === 'up' ? '↗' : 
                                         dashboardStats.stock_value_trend === 'down' ? '↘' : '→'} 
                                        {dashboardStats.stock_value_change.toFixed(1)}% vs last month
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {dashboardStats?.recent_activity && (
                    <div className="mt-6">
                        <h3 className="font-medium text-gray-900 mb-3">Recent Activity</h3>
                        <div className="space-y-2">
                            {dashboardStats.recent_activity.map((activity: any) => (
                                <div key={activity.id} className="p-3 bg-gray-50 rounded-lg text-sm">
                                    <div className="font-medium text-gray-900">{activity.action}</div>
                                    <div className="text-gray-500">{activity.time} • {activity.type}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Test Actions */}
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Test Actions</h2>
                <div className="space-y-4">
                    <div className="p-4 border border-gray-200 rounded-lg">
                        <h3 className="font-medium text-gray-900 mb-2">Add Test Purchase</h3>
                        <p className="text-sm text-gray-600 mb-3">
                            Add a sample purchase for today to see the &quot;Today&apos;s Purchases&quot; card update in real-time.
                        </p>
                        <button 
                            onClick={addTestPurchase}
                            disabled={addingPurchase}
                            className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50"
                        >
                            {addingPurchase ? 'Adding...' : 'Add Test Purchase (₹425)'}
                        </button>
                    </div>

                    <div className="p-4 border border-gray-200 rounded-lg">
                        <h3 className="font-medium text-gray-900 mb-2">View Main Dashboard</h3>
                        <p className="text-sm text-gray-600 mb-3">
                            Go to the main dashboard to see the live data in action.
                        </p>
                        <a 
                            href="/admin"
                            className="inline-block px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                        >
                            Open Dashboard →
                        </a>
                    </div>
                </div>
            </div>

            {/* Debug Info */}
            {dashboardStats?.debug && (
                <div className="bg-gray-50 rounded-xl p-6 border border-gray-200">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4">Debug Information</h2>
                    <pre className="text-sm bg-white p-4 rounded border overflow-auto">
                        {JSON.stringify(dashboardStats.debug, null, 2)}
                    </pre>
                </div>
            )}
        </div>
    )
} 