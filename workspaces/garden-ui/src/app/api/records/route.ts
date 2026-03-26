import {
  APEX,
  getDocClient,
  getTableName,
  initClient,
  queryByAlias,
  queryByCategory,
  queryByScope,
  queryByType,
  queryByXid,
} from "@jaypie/dynamodb";
import { log } from "@jaypie/logger";
import { ScanCommand } from "@aws-sdk/lib-dynamodb";

import { requireAuth } from "../../../lib/requireAuth";

//
//
// Handler
//

export async function GET(request: Request): Promise<Response> {
  const auth = await requireAuth();
  if (!auth) {
    return Response.json(
      { errors: [{ detail: "Unauthorized", status: 401, title: "Auth Error" }] },
      { status: 401 },
    );
  }

  const url = new URL(request.url);
  const model = url.searchParams.get("model");
  const scope = url.searchParams.get("scope") ?? APEX;
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "25", 10), 100);
  const startKey = url.searchParams.get("startKey");
  const index = url.searchParams.get("index");
  const value = url.searchParams.get("value");

  try {
    initClient({ endpoint: process.env.DYNAMODB_ENDPOINT });

    // No model = scan all records
    if (!model) {
      const client = getDocClient();
      const tableName = getTableName();
      const scanResult = await client.send(
        new ScanCommand({
          ExclusiveStartKey: startKey ? JSON.parse(startKey) : undefined,
          Limit: limit,
          TableName: tableName,
        }),
      );

      return Response.json({
        data: scanResult.Items ?? [],
        ...(scanResult.LastEvaluatedKey
          ? { nextKey: JSON.stringify(scanResult.LastEvaluatedKey) }
          : {}),
      });
    }

    const queryOptions = {
      limit,
      model,
      scope,
      ...(startKey ? { startKey: JSON.parse(startKey) } : {}),
    };

    let result;
    if (index && value) {
      switch (index) {
        case "alias":
          result = {
            items: await queryByAlias({ alias: value, model, scope }).then(
              (item) => (item ? [item] : []),
            ),
          };
          break;
        case "category":
          result = await queryByCategory({ ...queryOptions, category: value });
          break;
        case "type":
          result = await queryByType({ ...queryOptions, type: value });
          break;
        case "xid":
          result = {
            items: await queryByXid({ model, scope, xid: value }).then(
              (item) => (item ? [item] : []),
            ),
          };
          break;
        default:
          return Response.json(
            { errors: [{ detail: `Unknown index: ${index}`, status: 400, title: "Bad Request" }] },
            { status: 400 },
          );
      }
    } else {
      result = await queryByScope(queryOptions);
    }

    return Response.json({
      data: result.items ?? result,
      ...(result.lastEvaluatedKey
        ? { nextKey: JSON.stringify(result.lastEvaluatedKey) }
        : {}),
    });
  } catch (err) {
    log.error("Failed to query records", { error: err });
    return Response.json(
      { errors: [{ detail: "Failed to query records", status: 500, title: "Server Error" }] },
      { status: 500 },
    );
  }
}
