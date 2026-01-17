import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(req: NextRequest) {
    // Get the session token from cookies
    const token = req.cookies.get('sb-access-token')?.value || 
                  req.cookies.get('supabase-auth-token')?.value ||
                  req.cookies.get('sb-' + process.env.NEXT_PUBLIC_SUPABASE_URL?.split('//')[1]?.split('.')[0] + '-auth-token')?.value

    const isAuthenticated = !!token

    // If user is not signed in and trying to access protected routes, redirect to login
    if (!isAuthenticated && req.nextUrl.pathname.startsWith('/admin')) {
        return NextResponse.redirect(new URL('/login', req.url))
    }

    // If user is signed in and trying to access login page, redirect to admin
    if (isAuthenticated && req.nextUrl.pathname === '/login') {
        return NextResponse.redirect(new URL('/admin', req.url))
    }

    // If user is signed in and on root path, redirect to admin
    if (isAuthenticated && req.nextUrl.pathname === '/') {
        return NextResponse.redirect(new URL('/admin', req.url))
    }

    // If user is not signed in and on root path, redirect to login
    if (!isAuthenticated && req.nextUrl.pathname === '/') {
        return NextResponse.redirect(new URL('/login', req.url))
    }

    return NextResponse.next()
}

export const config = {
    matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
}
