import { APEX, deleteEntity, initClient, putEntity, queryByScope, queryByXid } from "@jaypie/dynamodb";
import { GARDEN_MODEL } from "@jaypie/garden-models";
import "@jaypie/garden-models"; // Side-effect: registers all models
import { generateJaypieKey, hashJaypieKey } from "@jaypie/kit";
import { log } from "@jaypie/logger";

import { requireAuth } from "../../../lib/requireAuth";

//
//
// Handlers
//

export async function GET(): Promise<Response> {
  const auth = await requireAuth();
  if (!auth) {
    return Response.json({ errors: [{ detail: "Unauthorized", status: 401, title: "Auth Error" }] }, { status: 401 });
  }

  try {
    initClient({ endpoint: process.env.DYNAMODB_ENDPOINT });
    const { items } = await queryByScope({
      model: "apikey",
      scope: APEX,
    });

    const keys = items.map((item) => {
      const record = item as unknown as {
        createdAt?: string;
        garden?: string;
        id?: string;
        label?: string;
        name?: string;
        permissions?: string[];
      };
      return {
        createdAt: record.createdAt ?? "",
        garden: record.garden,
        id: record.id ?? "",
        label: record.label ?? "",
        name: record.name ?? "",
        permissions: record.permissions ?? [],
      };
    });

    return Response.json({ data: keys });
  } catch (err) {
    log.error("Failed to list API keys", { error: err });
    return Response.json({ errors: [{ detail: "Failed to list API keys", status: 500, title: "Server Error" }] }, { status: 500 });
  }
}

export async function POST(request: Request): Promise<Response> {
  const auth = await requireAuth();
  if (!auth) {
    return Response.json({ errors: [{ detail: "Unauthorized", status: 401, title: "Auth Error" }] }, { status: 401 });
  }

  let body: { garden?: string; name?: string; permissions?: string[] } = {};
  try {
    body = await request.json();
  } catch {
    // Empty body is fine
  }

  const keyName = body.name || "API Key";

  try {
    initClient({ endpoint: process.env.DYNAMODB_ENDPOINT });

    // Look up creating user's permissions to inherit
    let userPermissions: string[] = ["registered:*"];
    const userEntity = await queryByXid({
      model: "user",
      scope: APEX,
      xid: auth.sub,
    });
    if (userEntity) {
      userPermissions = (userEntity as unknown as { permissions?: string[] }).permissions ?? ["registered:*"];
    }

    // Use provided permissions (subset of user's) or inherit all
    const keyPermissions = [...(body.permissions ?? userPermissions)];

    // If garden is specified, add garden:* permission
    if (body.garden) {
      if (!keyPermissions.includes("garden:*")) {
        keyPermissions.push("garden:*");
      }
    }

    const key = generateJaypieKey({ issuer: "jaypie" });
    const hash = hashJaypieKey(key);
    const now = new Date().toISOString();

    await putEntity({
      entity: {
        alias: hash,
        createdAt: now,
        ...(body.garden ? { garden: body.garden } : {}),
        id: crypto.randomUUID(),
        label: key.slice(-4),
        model: "apikey",
        name: keyName,
        permissions: keyPermissions,
        scope: APEX,
        sequence: Date.now(),
        updatedAt: now,
        xid: auth.sub,
      } as import("@jaypie/dynamodb").StorableEntity & { garden?: string; permissions: string[] },
    });

    log.debug("API key created", { garden: body.garden, label: key.slice(-4), name: keyName });

    return Response.json({
      data: {
        ...(body.garden ? { garden: body.garden } : {}),
        key,
        label: key.slice(-4),
        name: keyName,
        permissions: keyPermissions,
      },
    });
  } catch (err) {
    log.error("Failed to create API key", { error: err });
    return Response.json({ errors: [{ detail: "Failed to create API key", status: 500, title: "Server Error" }] }, { status: 500 });
  }
}

export async function DELETE(request: Request): Promise<Response> {
  const auth = await requireAuth();
  if (!auth) {
    return Response.json({ errors: [{ detail: "Unauthorized", status: 401, title: "Auth Error" }] }, { status: 401 });
  }

  let body: { id?: string } = {};
  try {
    body = await request.json();
  } catch {
    return Response.json({ errors: [{ detail: "Missing request body", status: 400, title: "Bad Request" }] }, { status: 400 });
  }

  if (!body.id) {
    return Response.json({ errors: [{ detail: "Missing id", status: 400, title: "Bad Request" }] }, { status: 400 });
  }

  try {
    initClient({ endpoint: process.env.DYNAMODB_ENDPOINT });
    await deleteEntity({ id: body.id, model: "apikey" });
    log.debug("API key deleted", { id: body.id });
    return Response.json({ data: { deleted: true, id: body.id } });
  } catch (err) {
    log.error("Failed to delete API key", { error: err });
    return Response.json({ errors: [{ detail: "Failed to delete API key", status: 500, title: "Server Error" }] }, { status: 500 });
  }
}
