---
description: Definitions, naming conventions, ontology, and pedantry
related: dynamodb, fabric, models, repository, services
---

# Vocabulary

The "Fabric Vocabulary" attempts to reserve words for implied uses and encourages use of reserved words for conforming uses. It also discourages the use of some words, especially `type`.

## Reservation Hygiene

A reserved word is **magnetic but not automatically bound**: it names a canonical predicate that conforming uses are drawn toward, but likeness or proximity does not conscript an entity into it. A message-like thing is the `message` model only if it takes on message's predicate; otherwise the resemblance is incidental.

The **re-earn test** audits reservations: if a reserved term were absent, would the concept re-derive from the ontology today? Three outcomes: it returns **as-is** (the term is sound — define it if undefined), it returns **broadened or narrowed** (redefine it), or it **does not return** (cut it). A reserved-but-undefined term is debt; the test services it. A term may be undefined by *oversight* (its meaning is pinned elsewhere) or by *genuine ambiguity* — the test distinguishes the two.

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
11. Composition: services joined so emitted state becomes the next event-input; itself a service

Arguably identity, instance, and relation would form a more complete vocabulary.

### Further Postulates

- "Events" trigger "actions"
- Events open cases; cases fall into scenarios; scenarios prescribe plans; jobs run plans against cases

## Attribute Definitions

- abbreviation: Shortest distinguishable arrangement of 1-4 letters
- alias: convenient lookup string modeled after a human-memorable shorthand like email alias; possibly but not guaranteed to be unique with model and scope
- archiveAt: archive timestamp; pro user expectation as an addition to delete
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
- llm: served LLM model id (e.g., "claude-sonnet-5"); used because `model` is reserved for the entity type
- links: usually http references
- message/s: string/s or message object/s
- metadata: usually immutable, what the entity is
- model: defines the entity type
- name: most common way to clearly reference the entity
- related: array of id strings, complex "{model}#{id}" strings, or `{ id, model }` objects
- scope: organizes entities, usually a reference to a parent entity
- sequence: deprecated; ordering now uses `updatedAt` via GSI composite sort key
- state: mutable data the entity tracks
- status: the entity's position in its model's lifecycle; the value vocabulary is declared by the model. The default job/message vocabulary is `canceled, complete, error, pending, processing, queued, sending`. Severity of a log emission (trace, debug, info, warn, error, fatal) is also a `status` vocabulary — the diagnostic vocabulary, aligned with Datadog, which serializes severity under the `status` field (see logs skill). Every model that uses `status` should declare its vocabulary rather than reuse words across unrelated models — a job's `error` and a log line's `error` are different predicates. The reservation is the declaration requirement, not the values (cf. `category`)
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
- kind => category, tags; same rationale as `type`
- ou => scope
- output => state
- thread => session, scope; a thread is a session at chat-grain, organized by `scope`. Never a model or attribute name: it collides with platform thread-channel types and reads like an entity. Use `conversation` only as an informal word for the collection (messages sharing a `scope`), never as a model
- type => category, tags; reserved (exception: `indexModelType` GSI exists in DynamoDB as a legacy pattern; prefer `category` for new work)

Avoid words defined elsewhere (services, terminology)

## Fabric Models

- case
- exchange
- job
- message
- plan
- scenario
- session

### Model Definitions

- case: the subject entity a job operates on; long-lived, accretes jobs and messages over time. Jobs reference their case via `job.case` (optional — jobs usually operate on a case; system jobs may not). Neither model requires the other: a case exists before any job runs on it, and a case never stores a job list (query jobs by case). `case` (subject of work) and `session` (span of engagement) are distinct axes that cross rather than nest: one session may touch several cases; one case accretes across many sessions
- exchange: an event entity representing one LLM `operate()` call. Attributes use reserved words: `input` (request), `content` (response text), `data` (interpolation parameters — the vocabulary's sanctioned use of the word), `xid` (provider response id), `llm` (served model id), declared `status` vocabulary `completed | incomplete | in_progress` aligned with operate settlement. Turn chains reference the parent exchange (an `exchange` attribute) and store input deltas only — never the resent history; tool loops are the history delta within one exchange, not separate entities. Canonical registration ships upstream: `registerExchangeModel()` / `EXCHANGE_MODEL` in `@jaypie/fabric`
- job: a run of a plan — the executing or executed instance a plan defines. References its `plan` and, optionally, the `case` it operates on. Declares the default run lifecycle `status` vocabulary (`canceled, complete, error, pending, processing, queued, sending`)
- message: an emitted unit of directed content — the emission genus covering inter-actor, workflow, and diagnostic (log) messages. `content` holds the text; `category` selects the species **and** its disposition vocabulary; `scope` is optional — a threadless emission (a log) has none, a threaded emission (a chat line) references its parent. Disposition is category-selected: an **operational** message carries `status` with a category-dependent enum (a *transmission* message, actor↔actor, uses a delivery lifecycle `queued | sending | complete`; a *workflow* message, service↔service, uses a coordination lifecycle — the enum is declared per category, not fixed across the model); a **diagnostic** message carries `status` with the severity vocabulary (`trace … fatal`) for a message reporting on itself or the system. The reservation is a vocabulary claim, not a storage commitment: a diagnostic message need not persist as an entity. Severity is not a second attribute — the observability layer reserves the `status` field for severity, and the vocabulary aligns with it rather than reserving `level` alongside (see Additional Terminology and the logs skill); the invariant is that a message's disposition vocabulary is category-selected. Distinct from `event` (ground #6, "an entity that happens"): an event is an occurrence that *triggers* and need carry neither content nor a recipient; a message always carries both and is not intrinsically a stimulus. The same utterance may be a `message` (content in a thread), give rise to an `event` (a trigger), and be answered by an `exchange` (the model turn) — different predicates on one utterance, not one primitive doing three jobs
- plan: a persisted definition an executor runs; what a job executes. plan : job :: definition : run. A composition projected into data is a plan. Suggested attributes: `alias`, `name`, `description`, `category` (a vocabulary under the model — e.g. composition plans use `workflow` | `agent`), optional `definitionHash` (content hash gating idempotent reseeds), optional `source` (provenance)
- scenario: a named category of cases (see Category in Ontological Grounding). `case.category` holds the scenario alias; the scenario model defines the category itself: `alias`, `name`, `description`, and `plans` (references) — scenarios prescribe which plans respond to them
- session: a bounded, resumable scope of coherence over a span, within which events, jobs, and messages cohere and share context and memory — the reified form of Context (ground #8). Nests recursively via `scope` (a session may scope another session), so a finer-grained dialogue thread is a leaf session rather than a separate model. Declares its own `status` vocabulary, not the job lifecycle: `active` (engagement in progress — a turn in flight or a participant present), `idle` (alive and resumable, no in-flight turn; the resting state that makes "resumable" real), `closed` (ended and no longer resumable; sticky terminal). Transitions: *(birth)* → `active` when born of an activity (a first message), or → `idle` when pre-opened empty (a thread created before anyone speaks); `active → idle` when the in-flight turn settles and nothing is queued; `idle → active` on new input (the resume path); `idle → closed` when the resumability deadline lapses or on an explicit end (the terminate path); `active → closed` on an explicit end mid-turn (rare). No `canceled` and no `error` state — a session is a *scope*, not a *task*: cancellation is a *reason* a session reached `closed` (recorded as metadata, `reason: ended | canceled | expired`), and a scope does not error — errors belong to the jobs and exchanges *within* a session, which holds failed turns and remains a valid, open scope; unrecoverable backing context is a `closed` (reason `expired`/`error`), not a live `error` state. A conversation is a collection (ground #2), not a model — messages sharing a `scope`; promote it to a model (ground #9) only if it earns identity that survives zero members or state irreducible to its members. The empty thread's pre-message identity belongs to its `scope` target — a session — not to a separate entity: a chat thread is a session at chat-grain; platform thread-isms (native thread id, parent channel, archived flag) are `xid` / references / `status`, not a new identity

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
- readOnly
- serializer
- service
- setup
- teardown
- validate

### Service Extensions

- ~Servers~ are transport adapters that consume ~suites~
- ~Suites~ are collections of services

## Fabric Composition

A composition wires services into a graph; it is itself a service.

- workflow: composition model that specifies its selector, entry, and terminal
- edge: directed link carrying one service's emitted state to the next service's event-input
- guard: per-edge predicate; whether an edge is eligible to fire; gates, does not choose; optional
- selector: node function choosing which eligible edge fires
- entry: where a composition begins
- terminal: where a composition halts; a state it no longer transforms

## Constants and Special Characters

```typescript
APEX = "@";
SEPARATOR = "#";
```

## Additional Terminology

The six log levels are **severity**. Severity is a property of an emission; a lifecycle `status` is a position in a model's declared vocabulary. They are distinct concepts that share the word `error` (a job's `error` is a lifecycle position; a log line's `error` is a severity), so keep the concepts straight. Both live on `status`: Datadog reserves the field name `status` for log severity and cannot be reconfigured, so the vocabulary aligns rather than reserving `level` as a separate attribute — severity is the `status` vocabulary of a diagnostic emission (`LOG_LEVEL_FIELD=status`, see logs skill). The logger API surface (`log.trace`, `LOG_LEVEL`, the `level` constructor option) keeps the word `level`; that is API, not vocabulary.

- debug: logging, operating checkpoint or abnormal condition
- error: logging, detected an unrecoverable state and exiting (caught error)
- fatal: logging, exiting because an unrecoverable state was encountered (uncaught exceptions)
- info: logging, emits lifecycle start/stop, rarely for essential values (most metrics push directly to Datadog)
- trace: logging, normal operating activity
- warn: logging, state is unexpected or undesired but recoverable

## Disclaimer

This is subject to change, especially until @jaypie/dynamodb and @jaypie/fabric reach 1.0. Follow release notes with @jaypie/mcp.