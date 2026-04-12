import {
  APEX,
  initClient,
  putEntity,
  queryByScope,
  type StorableEntity,
} from "@jaypie/dynamodb";
import { GARDEN_MODEL, type GardenEntity } from "@jaypie/garden-models";
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
      model: GARDEN_MODEL,
      scope: APEX,
    });

    const gardens = items.map((item) => ({
      createdAt: item.createdAt,
      id: item.id,
      name: item.name,
      xid: item.xid,
    }));

    return Response.json({ data: gardens });
  } catch (err) {
    log.error("Failed to list gardens", { error: err });
    return Response.json({ errors: [{ detail: "Failed to list gardens", status: 500, title: "Server Error" }] }, { status: 500 });
  }
}

export async function POST(request: Request): Promise<Response> {
  const auth = await requireAuth();
  if (!auth) {
    return Response.json({ errors: [{ detail: "Unauthorized", status: 401, title: "Auth Error" }] }, { status: 401 });
  }

  let body: { name?: string } = {};
  try {
    body = await request.json();
  } catch {
    // Empty body is fine
  }

  const gardenName = body.name || "My Garden";

  try {
    initClient({ endpoint: process.env.DYNAMODB_ENDPOINT });
    const now = new Date().toISOString();

    const entity = {
      createdAt: now,
      id: crypto.randomUUID(),
      model: GARDEN_MODEL,
      name: gardenName,
      scope: APEX,
      updatedAt: now,
      xid: auth.sub,
    } as GardenEntity;

    await putEntity({ entity: entity as unknown as StorableEntity });

    log.debug("Garden created", { name: gardenName });

    return Response.json({
      data: {
        createdAt: entity.createdAt,
        id: entity.id,
        name: entity.name,
      },
    });
  } catch (err) {
    log.error("Failed to create garden", { error: err });
    return Response.json({ errors: [{ detail: "Failed to create garden", status: 500, title: "Server Error" }] }, { status: 500 });
  }
}
