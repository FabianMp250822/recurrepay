
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Paths that require authentication and admin privileges
const adminProtectedPaths = ['/dashboard', '/clients', '/settings']; // Covers sub-routes like /clients/new, /clients/[id]/edit
const clientProtectedPaths = ['/client-dashboard'];

// Public paths that don't require any authentication
const publicPaths = ['/', '/login', '/inscribir', '/landing']; // Added /landing just in case, / is the main public

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // The Firebase client-side SDK and AuthContext handle the actual auth state and role verification.
  // Middleware primarily ensures structural redirection for very basic cases or can add headers.
  // Given the complexity of Firebase Auth, most granular access control and redirection logic
  // is better handled client-side within AuthProvider or in Server Components checking session (if using server-side auth).

  // Allow all requests to pass through. AuthProvider will handle redirection based on auth state.
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - assets (static assets)
     * - images (static images)
     */
    '/((?!api|_next/static|_next/image|favicon.ico|assets|images).*)',
  ],
};
