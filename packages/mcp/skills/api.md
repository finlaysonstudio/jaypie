---
description: API request and response format and conventions
related: express, handlers, style
---

# API Request and Response Format

All API requests and responses follow a consistent envelope format.

## Request Envelope

Request bodies follow the same `{ data }` envelope as responses.

```json
// Single record
{ "data": { "name": "Example" } }

// Array of records
{ "data": [{ "name": "First" }, { "name": "Second" }] }
```

- `{ data: {} }` — single record (object)
- `{ data: [] }` — array of records (even if zero or one result)
- No other top-level keys at the root

## Response Envelope

Every response body is a JSON object with one top-level key:

### Success: `{ data }`

```json
// Single record
{ "data": { "id": "123", "name": "Example" } }

// Array of records
{ "data": [{ "id": "123" }, { "id": "456" }] }
```

- `{ data: {} }` — single record (object)
- `{ data: [] }` — array of records (even if zero or one result)

### Error: `{ errors }`

```json
{
  "errors": [
    { "title": "Not Found", "detail": "Record not found", "status": 404 }
  ]
}
```

- `errors` is always an array, even for a single error
- Each error object should include `title`, `detail`, and `status`

### Rules

1. Requests and responses both use the `{ data }` envelope
2. A response contains either `data` or `errors`, never both
3. Single records use an object: `{ data: {} }`
4. Multiple records use an array: `{ data: [] }`
5. Errors always use an array: `{ errors: [] }` (responses only)
6. No other top-level keys (no `status`, `message`, `meta` at the root)
