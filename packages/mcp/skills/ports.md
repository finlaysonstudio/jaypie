---
description: Local development port numbering convention
related: cors, dynamodb, variables
---

# Ports

A per-project port numbering scheme so multiple Jaypie projects run locally at
once without colliding inside Docker or on the host.

## Identifier

Pick a random two-digit project identifier `NN` (`00`–`99`). It should be unused
by any other project running locally. Have the operator confirm or pick `NN` —
do not assume one.

Every local port is four digits: a role prefix followed by `NN`.

## Map

| Port    | Role                                  |
|---------|---------------------------------------|
| `30NN`  | primary marketing web                 |
| `31NN`  | the app                               |
| `3XNN`  | additional frontends as needed (docs) |
| `80NN`  | api                                   |
| `8XNN`  | additional apis as needed             |
| `90NN`  | dynamo                                |
| `91NN`  | dynamo admin                          |

Example, `NN=60`: marketing `3060`, app `3160`, api `8060`, dynamo `9060`,
dynamo admin `9160`.

## Logic

- `30` derives from `3000`, the conventional frontend dev port
- `80` derives from `80`/`8080`, the conventional backend port
- `90` because `80` is already taken by the api tier
- Fixing the role prefix and varying only `NN` per project keeps concurrent
  projects from colliding

## See Also

- **`skill("dynamodb")`** — local DynamoDB via docker-compose; point `endpoint`
  at `90NN` (admin at `91NN`)
- **`skill("cors")`** — `cors()` auto-allows `localhost:*` in sandbox, so the
  frontend port is accepted without extra config
- **`skill("variables")`** — environment variables reference
