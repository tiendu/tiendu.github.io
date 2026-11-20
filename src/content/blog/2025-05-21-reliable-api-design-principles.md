---
title: "Designing Reliable APIs: Principles That Survive Scale"
date: 2025-05-21
description: "Principles for reliable API design, including resource modeling, idempotency, versioning, HTTP semantics, structured errors, pagination, and rate limits."
topic: "Software Engineering"
keywords:
  - "API design"
  - "REST"
  - "idempotency"
  - "distributed systems"
  - "software architecture"
urlSlug: "api-design-best-practices"
---
APIs are contracts. Clients should not need to understand your database,
queues, deployments, or internal services to use one.

A reliable API has a small set of promises: stable resource names, predictable
failures, safe retries, and enough information to troubleshoot a request.
REST, GraphQL, and gRPC are implementation choices; those promises matter with
any of them.

## Model the outside, not the inside

For a REST API, expose domain resources:

```http
GET    /users/123
POST   /users
DELETE /users/123
```

Avoid exposing your storage layout as `/user_table_record?id=123` or creating
custom verbs for work HTTP already describes. An internal refactor should not
force clients to rewrite their integrations.

## Make retries safe

Networks fail in inconvenient places. The server may commit a change and lose
the response, leaving the client unsure whether it succeeded. A retry must not
silently perform a second payment or launch a second workflow.

`DELETE /users/123` is idempotent in its *effect*: repeating it leaves the
resource deleted, even if the response status differs. For side-effecting
requests such as `POST /payments`, accept an idempotency key and persist the
original result against that key:

```http
POST /payments
Idempotency-Key: 7f3c...
```

Define the key's scope, lifetime, and behavior when the same key is reused with
a different payload. Retrying is a contract, not merely a client convention.

## Evolve without surprising clients

Adding an optional field is often compatible. Changing a field from a number
to a string, removing it, or changing its meaning is not. New enum values may
also break clients that assumed the set was closed.

Version or negotiate breaking changes when necessary. Keep old versions around
long enough for consumers to migrate, and test against real client behavior.

## Let HTTP and errors carry meaning

Use appropriate status codes: `201` for created resources, `202` for accepted
asynchronous work, `204` for a successful empty response, `409` for a conflict,
`429` when rate-limited, and `503` when a service is temporarily unavailable.

A structured error should expose a stable machine-readable code and a request
identifier, not just an English sentence:

```json
{
  "error": {
    "code": "USER_NOT_FOUND",
    "message": "User does not exist",
    "request_id": "req_abc123"
  }
}
```

The request ID should also appear in server logs or traces. Do not put
credentials in query strings; use authenticated headers, short-lived tokens,
least-privilege permissions, audit trails, and clear rate limits.

## Keep lists and documentation predictable

Use consistent filtering and ordering parameters. Cursor pagination is often a
good fit for changing large datasets, but it still needs a stable ordering and
a documented cursor lifetime. Offset pagination can be perfectly adequate for
small or mostly static results.

Maintain an OpenAPI specification alongside the implementation when using
HTTP APIs it can describe. Validate requests and responses, and use the same
contract for documentation and client tests.

## Before publishing

Check that clients can answer five questions without talking to the service
owner: What can I call? What happens on retry? How do errors look? How do I
paginate results? How do I trace a failed request?

If those answers are clear, the API is easier to operate and harder to misuse.
