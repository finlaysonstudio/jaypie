import { APEX, initClient, queryByXid } from "@jaypie/dynamodb";
import { log } from "@jaypie/logger";
import { cookies } from "next/headers";

// Import to ensure models are registered
import "../../lib/session";
import "../../lib/user/upsert";

//
//
// Types
//

interface ContextData {
  authenticated: boolean;
  permissions?: string[];
  session?: string;
  user?: { email?: string; name?: string };
}

interface ContextError {
  detail: string;
  status: number;
  title: string;
}

//
//
// Handler
//

export async function GET(request: Request): Promise<Response> {
  try {
    const { auth0 } = await import("../../lib/auth0");
    const auth0Session = await auth0.getSession();
    const authenticated = !!auth0Session;

    // Get garden session hint from cookie and store device ID
    let session: string | undefined;
    try {
      const cookieStore = await cookies();
      const sessionToken = cookieStore.get("garden-session")?.value;
      if (sessionToken) {
        session = sessionToken.slice(-4);

        // Store device ID on session if provided
        const deviceId = request.headers.get("x-device-id");
        if (deviceId) {
          const { getSession, updateSessionDeviceId } = await import("../../lib/session");
          initClient({ endpoint: process.env.DYNAMODB_ENDPOINT });
          const sessionEntity = await getSession(sessionToken);
          if (sessionEntity && (sessionEntity as unknown as { deviceId?: string }).deviceId !== deviceId) {
            await updateSessionDeviceId(sessionToken, deviceId);
          }
        }
      }
    } catch {
      // Best effort
    }

    let permissions: string[] | undefined;
    if (auth0Session?.user?.sub) {
      try {
        initClient({ endpoint: process.env.DYNAMODB_ENDPOINT });
        const userEntity = await queryByXid({
          model: "user",
          scope: APEX,
          xid: auth0Session.user.sub,
        });
        if (userEntity) {
          permissions = (userEntity as unknown as { permissions?: string[] }).permissions;
        }
      } catch (err) {
        log.warn("Failed to look up user permissions", { error: err });
      }
    }

    const data: ContextData = {
      authenticated,
      ...(permissions ? { permissions } : {}),
      ...(session ? { session } : {}),
      ...(auth0Session?.user
        ? { user: { email: auth0Session.user.email, name: auth0Session.user.name } }
        : {}),
    };
    return Response.json({ data });
  } catch (error) {
    log.error("Failed to check Auth0 session", { error });
    const errors: ContextError[] = [
      {
        detail: "Unable to check authentication status",
        status: 500,
        title: "Auth Error",
      },
    ];
    return Response.json({ errors }, { status: 500 });
  }
}
