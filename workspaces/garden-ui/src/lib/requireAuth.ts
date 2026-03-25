import { auth0 } from "./auth0";

//
//
// Types
//

interface AuthResult {
  authenticated: true;
  sub: string;
}

//
//
// Main
//

/**
 * Check authentication for API route handlers.
 * In bypass mode, returns a synthetic auth result.
 * Returns null if unauthenticated (caller should return 401).
 */
async function requireAuth(): Promise<AuthResult | null> {
  if (process.env.DANGEROUS_BYPASS_AUTHENTICATION === "true") {
    return { authenticated: true, sub: "local-dev" };
  }

  const session = await auth0.getSession();
  if (!session) {
    return null;
  }

  return { authenticated: true, sub: session.user.sub };
}

//
//
// Export
//

export { requireAuth };
export type { AuthResult };
