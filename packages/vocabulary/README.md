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

divisionHandler(); // =4
divisionHandler({ numerator: 24 }); // =8
divisionHandler({ numerator: 24, denominator: 2 }); // =12
divisionHandler({ numerator: "14", denominator: "7" }); // =2
divisionHandler({ numerator: 1, denominator: 0 }); // throws BadRequestError(); does not validate
divisionHandler({ numerator: 1, denominator: "0" }); // throws BadRequestError(); does not validate
divisionHandler('{ "numerator": "18" }'); // =3; String parses as JSON
divisionHandler({ numerator: "ONE" }); // throws BadRequestError(); cannot coerce NaN to Number
divisionHandler({ denominator: "TWO" }); // throws BadRequestError(); cannot coerce NaN to Number
divisionHandler(12, 2); // throws BadRequestError(); future argument coercion may allow
```

Service Handler builds a function that initiates a "controller" step that:
* Parses the input if it is a string to object
* Coerces each input field to its type
* Calls the validation function or regular expression or checks the array
  * The validation function may return false or throw
  * A regular expression should be used as a matcher
  * An array should validate if any scalar matches when coerced to the same type, any regular expression matches, or any function returns true (pocket throws in this case)
* Calls the service function and returns the response

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
