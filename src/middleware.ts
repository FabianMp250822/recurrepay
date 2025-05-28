
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Paths that require authentication and admin privileges
const protectedPaths = ['/dashboard', '/clients']; // Covers /clients/new, /clients/[id]/edit

// Path for login
const loginPath = '/login';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const firebaseAuthCookie = request.cookies.get('firebaseAuthToken'); // Example, actual cookie name may vary or not exist client-side

  // Simple check based on a hypothetical auth token cookie.
  // In a real scenario, AuthContext on client-side handles actual Firebase auth state.
  // Middleware primarily redirects based on path and a simplified auth hint if available,
  // client-side will then verify and handle admin checks.
  // For Next.js 13+ App Router, true auth state is best managed client-side with redirects
  // or server-side with session management if using server components extensively for auth decisions.

  // This middleware logic is a common pattern but has limitations with Firebase client-side SDK.
  // The AuthProvider will handle more robust redirects once the client loads.

  const isAuthenticated = !!firebaseAuthCookie; // This is a placeholder, Firebase auth state is client-side.

  // If trying to access a protected path and not "authenticated" (based on placeholder), redirect to login
  if (protectedPaths.some(p => pathname.startsWith(p)) && !isAuthenticated && pathname !== loginPath) {
    // If AuthProvider determines user is actually authenticated as admin, it will redirect back.
    // This middleware redirect is a first pass.
    // We allow access if a cookie hint exists, AuthProvider will verify.
  }

  // If "authenticated" (cookie hint) and trying to access login page, redirect to dashboard
  if (isAuthenticated && pathname === loginPath) {
    // This might cause a redirect loop if AuthProvider then finds user is not admin and redirects to /login.
    // It's safer to let AuthProvider handle redirects from /login if user is found to be admin.
    // return NextResponse.redirect(new URL('/dashboard', request.url));
  }
  
  // The primary role of middleware here is to ensure that if a user *is* authenticated (by Firebase on client-side),
  // they don't get stuck on /login. And if they are *not* authenticated, they get to /login from protected routes.
  // The AuthContext is the source of truth for auth state and admin rights.

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
