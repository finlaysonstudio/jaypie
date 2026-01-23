---
description: Definitions, naming conventions, ontology, and pedantry
related: fabric, models, services
---

# Vocabulary

The "Fabric Vocabulary" attempts to reserve words for implied uses and encourages use of reserved words for conforming uses. It also discourages the use of some words, especially `type`.

## Ontological Grounding

1. Entity: something that is and we wish to represent
2. Collection: entities grouped by relation
3. Attribute: relation between entity and value
4. Value: what attributes resolve to
5. Category: a collection with a defining principle
6. Event: an entity that happens rather than is
7. State: configuration of attributes at a point
8. Context: scope in which propositions hold
9. Model: category bound to a specification of attributes; defines entity identity and structure
10. Service: responds to event inputs and performs actions that transforms state within context

Arguably composition, identity, instance, and relation would form a more complete vocabulary.

### Further Postulates

- "Events" trigger "actions"

## Attribute Definitions

- abbreviation: Shortest distinguishable arrangement of 1-4 letters
- alias: convenient lookup string modeled after a human-memorable shorthand like email alias; possibly but not guaranteed to be unique with model and scope
- archiveAt: archive timestamp; pro user expectation
- category: free text classifier, ideally a vocabulary under model; substitute for "type"
- content: often the entity text
- createdAt: timestamp
- date: associated with the entity
- deletedAt: soft delete timestamp
- description: concise, ideally complete or inviting
- errors: not error singular, a list of errors usually only one
- id: uuid, usually v4 but unrestricted
- image: tbd, likely urls and references
- input: request parameters
- label: shortened, accepted version of name
- links: usually http references
- message/s: string/s or message object/s
- metadata: usually immutable, what the entity is
- model: defines the entity type
- name: most common way to clearly reference the entity
- related: array of id strings, complex "{model}#{id}" strings, or `{ id, model }` objects
- scope: organizes entities, usually a reference to a parent entity
- sequence: computed scalar, usually normalized createdAt or name
- state: mutable data the entity tracks
- status: canceled, complete, error, pending, processing, queued, sending
- tags: array of category-value pairs `[{role:operator}]`
- updatedAt: timestamp
- value: computed scalar the entity evaluates to
- xid: convenient machine lookup string modeled as an external identifier; possibly but not guaranteed to be unique with model and scope
- _id: an internal identifier, if required by the storage layer

### Discouraged Words => Replacements

- class => category, tags; reserved
- context => metadata; reserved
- data => input, state; `data` is a parameter passed for interpolation or response field signaling success
- jaypie; reserved
- key => alias; make api or secret keys explicit in name
- ou => scope
- output => state
- type => category, tags; reserved

Avoid words defined elsewhere (services, terminology)

## Fabric Models

- job
- message

### Implied Attributes

- Plural attributes for lists
- Singular attributes for objects
- Fields named after models for "references"
- References are id, xid, or alias (searched in that order) foreign key scalars
- References can be objects defining the entity on-the-fly
- Plural model attributes imply list of references
- `{verb}At` implies date and time. Past tense (createdAt, updatedAt) for past, active tense for future (expireAt, publishAt)
- `{verb}Date` implies data without time

## Fabric Services

### Service Attributes

- context
- controller
- idempotence
- locals
- message
- mock
- parameters
- serializer
- service
- setup
- teardown
- validate

### Service Extensions

- ~Servers~ are transport adapters that consume ~suites~
- ~Suites~ are collections of services

## File Systems and Monorepos

- bin: scripts
- etc: configurations
- lib: usually within a src directory, modules of encapsulated logic that could be refactored out later
- LOCAL: human local scratch directory, include in gitignore
- packages: default and preferred name for NPM workspaces; always use for packages publishing to NPM
- stacks: allowed name for NPM workspaces that publish via CDK
- templates: usually CloudFormation
- workspaces: allowed name for NPM workspace that do not publish
- var: agent and machine local scratch directory, include in gitignore

### Discouraged Folder Names

- scripts => bin

### Example

```
bin/
packages/
  cdk/
  express/
    src/
      lib/
      app.ts
      index.ts
package.json
```

## Constants and Special Characters

```typescript
APEX = "@";
SEPARATOR = "#";
```

## Additional Terminology

- debug: logging, 
- error: logging, detected an unrecoverable state and exiting (caught error)
- fatal: logging, exiting because an unrecoverable state was encountered (uncaught exceptions)
- info: logging, emits lifecycle start/stop, rarely for essential values (most metrics push directly to Datadog)
- trace: logging, normal operating activity
- warn: logging, state is unexpected or undesired but recoverable

## Disclaimer

This is subject to change, especially until @jaypie/dynamodb and @jaypie/fabric reach 1.0. Follow release notes with @jaypie/mcp.