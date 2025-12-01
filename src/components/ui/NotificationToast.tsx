'use client'

import { useEffect } from 'react'
import { useAppDispatch, useAppSelector } from '@/lib/store'
import { removeNotification } from '@/lib/store/slices/uiSlice'

export function NotificationToast() {
    const dispatch = useAppDispatch()
    const notifications = useAppSelector((state) => state.ui.notifications)

    useEffect(() => {
        notifications.forEach((notification) => {
            if (notification.duration !== 0) {
                const timer = setTimeout(() => {
                    dispatch(removeNotification(notification.id))
                }, notification.duration || 5000)

                return () => clearTimeout(timer)
            }
        })
    }, [notifications, dispatch])

    if (notifications.length === 0) return null

    return (
        <div className="fixed top-4 right-4 z-50 space-y-2">
            {notifications.map((notification) => (
                <div
                    key={notification.id}
                    className={`max-w-sm w-full bg-white shadow-lg rounded-lg pointer-events-auto overflow-hidden border-l-4 ${notification.type === 'success' ? 'border-green-400' :
                            notification.type === 'error' ? 'border-red-400' :
                                notification.type === 'warning' ? 'border-yellow-400' :
                                    'border-blue-400'
                        }`}
                >
                    <div className="p-4">
                        <div className="flex items-start">
                            <div className="flex-shrink-0">
                                {notification.type === 'success' && (
                                    <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                    </svg>
                                )}
                                {notification.type === 'error' && (
                                    <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                                    </svg>
                                )}
                                {notification.type === 'warning' && (
                                    <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                    </svg>
                                )}
                                {notification.type === 'info' && (
                                    <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                                    </svg>
                                )}
                            </div>
                            <div className="ml-3 flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-900">{notification.title}</p>
                                <p className="mt-1 text-sm text-gray-500">{notification.message}</p>
                            </div>
                            <div className="ml-4 flex-shrink-0 flex">
                                <button
                                    className="bg-white rounded-md inline-flex text-gray-400 hover:text-gray-500 focus:outline-none"
                                    onClick={() => dispatch(removeNotification(notification.id))}
                                >
                                    <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                                    </svg>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    )
} 