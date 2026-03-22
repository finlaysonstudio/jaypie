import { APEX, initClient, queryByXid } from "@jaypie/dynamodb";
import { log } from "@jaypie/logger";

// Import to ensure user model is registered
import "../../lib/user/upsert";

//
//
// Types
//

interface StatusError {
  detail: string;
  status: number;
  title: string;
}

interface StatusResponse {
  authenticated: boolean;
  errors?: StatusError[];
  permissions?: string[];
  status: string;
  user?: { email?: string; name?: string };
}

//
//
// Handler
//

export async function GET(): Promise<Response> {
  try {
    const { auth0 } = await import("../../lib/auth0");
    const session = await auth0.getSession();
    const authenticated = !!session;

    let permissions: string[] | undefined;
    if (session?.user?.sub) {
      try {
        initClient({ endpoint: process.env.DYNAMODB_ENDPOINT });
        const userEntity = await queryByXid({
          model: "user",
          scope: APEX,
          xid: session.user.sub,
        });
        if (userEntity) {
          permissions = (userEntity as unknown as { permissions?: string[] }).permissions;
        }
      } catch (err) {
        log.warn("Failed to look up user permissions", { error: err });
      }
    }

    const body: StatusResponse = {
      authenticated,
      ...(permissions ? { permissions } : {}),
      status: "ok",
      ...(session?.user
        ? { user: { email: session.user.email, name: session.user.name } }
        : {}),
    };
    return Response.json(body);
  } catch (error) {
    log.error("Failed to check Auth0 session", { error });
    const body: StatusResponse = {
      authenticated: false,
      errors: [
        {
          detail: "Unable to check authentication status",
          status: 500,
          title: "Auth Error",
        },
      ],
      status: "error",
    };
    return Response.json(body, { status: 500 });
  }
}
