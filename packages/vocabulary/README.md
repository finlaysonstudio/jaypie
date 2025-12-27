# Jaypie Vocabulary ⛲️

## Philosophies

### Fabric

* Smooth, pliable
* Things that feel right should work
* Catch bad passes

## Concepts

* Fluid scalar coercion, string to object conversion
* Primitives: Boolean, String, Number (scalars); Objects, Arrays (considered different)
* Undefined always available
* "Resolvable" as scalar or function with potential promise
* Treat native types and their string representation equally (`type: String` or `type: "string"`)

### Coercion

#### Arrays

* Non-arrays become arrays of that value
* Arrays of a single value become that value
* Multi-value arrays throw bad request

#### Objects

* Scalars become { value: Boolean | Number | String }
* Arrays become { value: [] }
* Objects with a value attribute attempt coercion with that value
* Objects without a value throw bad request

#### Scalars

* String `""` becomes `undefined`
* String `"true"` becomes `true` or `1`
* String `"false"` becomes `false` or `0`
* Strings that parse to numbers use those numeric values to convert to number or boolean
* Strings that parse to `NaN` throw bad request
* Boolean `true` becomes "true" or `1`
* Boolean `false` becomes "false" or `0`
* Numbers to String are trivial
* Numbers convert to `true` when positive
* Numbers convert to `false` when zero or negative

### Entity Model

```
{
  "model": "job",
  "type": "command",
  "job": "evaluation",
  "plan": "hello"
}
```

### Service Handler

```typescript
import { serviceHandler } from "@jaypie/vocabulary";

const divisionHandler = serviceHandler({
  alias: "division",
  description: "Divides two numbers",
  input: {
    numerator: {
      default: 12,
      description: "Number 'on top', which is to be divided",
      type: Number,
    },
    denominator: {
      default: 3,
      description: "Number 'on bottom', how many ways to split the value",
      type: Number,
      validate: (value) => value !== 0,
    }
  },
  service: ({ numerator, denominator }) => (numerator / denominator),
});

await divisionHandler(); // =4
await divisionHandler({ numerator: 24 }); // =8
await divisionHandler({ numerator: 24, denominator: 2 }); // =12
await divisionHandler({ numerator: "14", denominator: "7" }); // =2
await divisionHandler({ numerator: 1, denominator: 0 }); // throws BadRequestError(); does not validate
await divisionHandler({ numerator: 1, denominator: "0" }); // throws BadRequestError(); does not validate
await divisionHandler('{ "numerator": "18" }'); // =3; String parses as JSON
await divisionHandler({ numerator: "ONE" }); // throws BadRequestError(); cannot coerce NaN to Number
await divisionHandler({ denominator: "TWO" }); // throws BadRequestError(); cannot coerce NaN to Number
await divisionHandler(12, 2); // throws BadRequestError(); future argument coercion may allow
```

Service Handler builds a function that initiates a "controller" step that:
* Parses the input if it is a string to object
* Coerces each input field to its type
* Calls the validation function or regular expression or checks the array
  * The validation function may return false or throw
  * A regular expression should be used as a matcher
  * An array should validate if any scalar matches when coerced to the same type, any regular expression matches, or any function returns true (pocket throws in this case)
* Calls the service function and returns the response (or returns the processed input if no service is provided)
* Parameters are assumed required unless (a) they have a default or (b) they are `required: false`

#### Validation Only (No Service)

When no `service` function is provided, the handler returns the coerced and validated input:

```typescript
const validateUser = serviceHandler({
  input: {
    age: { type: Number, validate: (v) => v >= 18 },
    email: { type: [/^[^@]+@[^@]+\.[^@]+$/] },
    role: { default: "user", type: ["admin", "user", "guest"] },
  },
  // no service - returns processed input
});

await validateUser({ age: "25", email: "bob@example.com" });
// → { age: 25, email: "bob@example.com", role: "user" }

await validateUser({ age: 16, email: "teen@example.com" });
// throws BadRequestError - age validation fails
```

#### Natural Types

* `Array`
  * `[]` same as `Array`
  * `[Boolean]` same as `Array<boolean>`
  * `[Number]` same as `Array<number>`
  * `[Object]` same as `[{}]` same as `Array<object>`
  * `[String]` same as `[""]` same as `Array<string>`
* `Boolean`
* `Number`
* `Object`
  * `{}` same as `Object`
* `String`
  * `""` same as `String`

#### Typed Array Coercion

Typed arrays (`[String]`, `[Number]`, `[Boolean]`, `[Object]`) coerce each element to the specified type.

```typescript
coerce([1, 2, 3], [String])        // → ["1", "2", "3"]
coerce(["1", "2"], [Number])       // → [1, 2]
coerce([1, 0, -1], [Boolean])      // → [true, false, false]
coerce([1, "hello"], [Object])     // → [{ value: 1 }, { value: "hello" }]
```

**String Splitting**: Strings containing commas or tabs are automatically split into arrays.

```typescript
coerce("1,2,3", [Number])          // → [1, 2, 3]
coerce("a, b, c", [String])        // → ["a", "b", "c"] (whitespace trimmed)
coerce("true\tfalse", [Boolean])   // → [true, false]
```

Priority order:
1. JSON parsing: `"[1,2,3]"` → `[1, 2, 3]`
2. Comma splitting: `"1,2,3"` → `["1", "2", "3"]`
3. Tab splitting: `"1\t2\t3"` → `["1", "2", "3"]`
4. Single element wrap: `"42"` → `["42"]`

#### Validated Type Shorthand

Arrays of literals validate a value against allowed options.

**String validation** - array of strings and/or RegExp:

```typescript
const sendMoneyHandler = serviceHandler({
  input: {
    amount: { type: Number },
    currency: { type: ["dec", "sps"] },  // Must be "dec" or "sps"
    user: { type: String },
  },
  service: ({ amount, currency, user }) => ({ amount, currency, user }),
});

await sendMoneyHandler({ amount: 100, currency: "dec", user: "bob" });  // ✓
await sendMoneyHandler({ amount: 100, currency: "usd", user: "bob" });  // ✗ BadRequestError
```

**Number validation** - array of numbers:

```typescript
const taskHandler = serviceHandler({
  input: {
    priority: { type: [1, 2, 3, 4, 5] },  // Must be 1-5
    title: { type: String },
  },
  service: ({ priority, title }) => ({ priority, title }),
});

await taskHandler({ priority: 1, title: "Urgent" });   // ✓
await taskHandler({ priority: 10, title: "Invalid" }); // ✗ BadRequestError
```

**Mixed string and RegExp validation**:

```typescript
const handler = serviceHandler({
  input: {
    value: { type: [/^test-/, "special"] },  // Matches /^test-/ OR equals "special"
  },
  service: ({ value }) => value,
});

await handler({ value: "test-123" });  // ✓
await handler({ value: "special" });   // ✓
await handler({ value: "other" });     // ✗ BadRequestError
```

### Serialization Formats

#### Complete Formats

Flat Model JSON
```json
{
  "model": "job",
  "type": "command",
  "job": "evaluation",
  "plan": "hello"
}
```
```json
{ errors: [] }
```

Response Model JSON
```json
{
  data: {
    "model": "entity",
    "id": "identifier"
  }
}
```
```json
{
  data: [
    { "model": "entity", "id": "identifier" },
    { "model": "entity", "id": "identifier" },
  ]
}
```
```json
{ 
  errors: [] 
}
```

#### Lookup Shorthand

JSON
```json
{ id: "identifier", model: "entity" }
```

String
```javascript
${model}-${id}
```

### Defined Vocabulary

#### Attributes

##### Defined Attributes

Should be treated as "strictly" defined:

* abbreviation: ""
* alias: ""
* createdAt: ""
* deletedAt: ""
* description: ""
* id: ""
* input: {}
* label: ""
* metadata: {}
* mock: {} | Boolean
* model: ""
* name: ""
* ou: ""
* output: {}
* state: {}
* type: ""
* updatedAt: ""
* xid: ""

##### Known Attributes

Ideally optimize for reusability:

* default: *
* input: {}
* service: ()
* value: ""
* validate: [()] | { "": () | // }

##### Assumed Attributes

Future intentions planned:

* authentication: () | [()]
* authorization: () | [()]
* chaos: ""
* class: ""
* context: {}
* controller: () => input | { input, context }
* env: ""
* history: {}
* locals: {}
* message: () | ""
* parameters: {}
* required: []
* role: ""
* seed: ""
* serializer: ()
* setup: [()]
* tags: [""]
* teardown: [()]

##### Avoidable Attributes

* body, data; prefer state
* subtype; prefer class

#### Models

* base
  * Not used directly

* job
  * types: api, call, command, event, schedule
  * attributes: job, plan

#### Extending Vocabulary

* The easiest way to extend the base vocabulary is with namespacing

## Style Guide

* Alphabetize anything
