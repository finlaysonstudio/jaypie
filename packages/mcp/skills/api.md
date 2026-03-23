---
description: API response format and conventions
related: express, handlers, style
---

# API Response Format

All API responses follow a consistent envelope format.

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

1. A response contains either `data` or `errors`, never both
2. Single records use an object: `{ data: {} }`
3. Multiple records use an array: `{ data: [] }`
4. Errors always use an array: `{ errors: [] }`
5. No other top-level keys (no `status`, `message`, `meta` at the root)
