import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

// Routes that stay open — everything else under /api/* requires a signed-in
// user by default, so a new route is protected automatically unless it's
// explicitly listed here (e.g. the Stripe webhook, verified by signature instead).
const isPublicRoute = createRouteMatcher([
  '/api/stripe/webhook(.*)',
]);

// Non-API page routes that require a signed-in user
const isProtectedPageRoute = createRouteMatcher([
  '/onboarding(.*)',
  '/dashboard(.*)',
]);

export default clerkMiddleware(async (auth, req) => {
  if (isPublicRoute(req)) return;
  if (isProtectedPageRoute(req) || req.nextUrl.pathname.startsWith('/api/')) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    // Skip Next.js internals and static files
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
};
