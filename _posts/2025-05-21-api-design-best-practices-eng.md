---
layout: post
title: "Designing Reliable APIs: Principles That Survive Scale"
date: 2025-05-21
categories: ["Architecture", "Backend", "Systems Design"]
---

APIs are contracts.

Whether you're building a public SaaS platform, a genomics workflow service, an internal platform API, or a cloud control plane, the quality of your API determines how easy it is for other systems to interact with yours.

Many API discussions focus on technologies:

- REST
- GraphQL
- gRPC
- WebSockets
- Event streams

Those choices matter, but reliability usually comes down to something much simpler:

**Can consumers depend on your interface without constantly reading release notes?**

The best APIs are boring.

They are predictable, stable, easy to debug, and difficult to misuse.

This article covers the principles that matter regardless of protocol.

---

## APIs Are Contracts

The most important rule:

**Clients should depend on your API contract, not your implementation.**

Consumers should not need to know:

- your database schema
- your internal microservices
- your queue architecture
- your deployment strategy

Good APIs expose business concepts.

Bad APIs expose implementation details.

Good:

```http
GET /users/123
```

Bad:

```http
GET /user_table_record?id=123
```

The contract should remain stable even if everything behind it changes.

---

## Design Resources Around Business Concepts

If using REST, model resources as nouns.

```http
GET    /users
GET    /users/123
POST   /users
DELETE /users/123
```

Avoid RPC-style endpoints whenever possible.

Less ideal:

```http
POST /createUser
POST /deleteUser
POST /updateUser
```

HTTP already provides verbs.

Use the protocol instead of reinventing it.

---

## Make Operations Safe to Retry

Distributed systems fail constantly.

Networks timeout.

Load balancers reset connections.

Clients retry requests.

Your API must survive retries.

### Idempotent Operations

Calling an operation multiple times should not produce unexpected results.

Example:

```http
DELETE /users/123
```

The second request should produce the same final state as the first.

### Idempotency Keys

For financial transactions, workflow launches, and other side-effect-heavy operations:

```http
POST /payments
Idempotency-Key: 7f3c...
```

If the request is retried, return the original result rather than creating duplicates.

This single feature prevents an enormous number of production incidents.

---

## Design for Long-Term Evolution

Every successful API eventually changes.

Assume future requirements are coming.

The challenge is evolving without breaking consumers.

### Safe Changes

Usually safe:

- adding optional fields
- adding new endpoints
- adding new enum values (with care)

Example:

```json
{
  "id": "123",
  "name": "Alice",
  "department": "Engineering"
}
```

Adding:

```json
{
  "id": "123",
  "name": "Alice",
  "department": "Engineering",
  "timezone": "UTC"
}
```

should not break existing clients.

### Dangerous Changes

Avoid:

- removing fields
- renaming fields
- changing data types
- changing semantics

Bad:

```json
{
  "id": 123
}
```

becomes:

```json
{
  "id": "123"
}
```

Many clients will fail unexpectedly.

---

## Use HTTP Properly

HTTP already communicates a lot of useful information.

Let it do its job.

### Success

```http
200 OK
201 Created
202 Accepted
204 No Content
```

### Client Errors

```http
400 Bad Request
401 Unauthorized
403 Forbidden
404 Not Found
409 Conflict
422 Unprocessable Entity
429 Too Many Requests
```

### Server Errors

```http
500 Internal Server Error
502 Bad Gateway
503 Service Unavailable
504 Gateway Timeout
```

Clients should never need to parse free-form text to determine success or failure.

---

## Return Structured Errors

Bad:

```json
{
  "message": "Something went wrong"
}
```

Better:

```json
{
  "error": {
    "code": "USER_NOT_FOUND",
    "message": "User does not exist",
    "request_id": "req_abc123"
  }
}
```

Benefits:

- machine-readable
- searchable
- easier automation
- better support experience

Error codes become part of the API contract.

Treat them carefully.

---

## Prefer Cursor Pagination

Traditional pagination:

```http
GET /users?page=50&limit=100
```

works until datasets become large.

Modern systems often use cursor pagination:

```http
GET /users?cursor=abc123
```

Benefits:

- faster queries
- more stable ordering
- avoids duplicates during concurrent updates
- scales better

For large datasets, cursor-based pagination is usually the better default.

---

## Filter, Sort, and Search Consistently

Provide predictable query patterns.

```http
GET /runs?status=completed
GET /runs?sort=-created_at
GET /runs?limit=100
```

Avoid inventing different conventions for every endpoint.

Consistency reduces documentation requirements.

---

## Security Must Be Built In

Security is not a later enhancement.

Start with:

- HTTPS everywhere
- OAuth2 / OpenID Connect
- short-lived tokens
- least-privilege permissions
- audit logging
- rate limiting

Avoid:

```http
GET /users?apikey=secret123
```

Credentials should never live in URLs.

Use headers instead.

---

## Rate Limit Before You Need To

Eventually every API gets abused.

Sometimes intentionally.

Often accidentally.

Implement:

```http
429 Too Many Requests
Retry-After: 60
```

and communicate limits clearly.

A predictable limit is better than an overloaded service.

---

## Design for Observability

A surprisingly common API mistake:

the API works, but nobody can debug it.

Include request identifiers.

Example:

```http
X-Request-ID: 1b5e6d...
```

Return the same identifier in responses and logs.

When customers report issues, support teams can immediately trace requests through the system.

This saves countless hours during incidents.

---

## Use OpenAPI as the Source of Truth

Documentation should not be a separate project.

Generate documentation from the API contract.

OpenAPI provides:

- machine-readable schemas
- SDK generation
- validation
- interactive documentation
- testing support

The specification should be treated as part of the product.

---

## The Reliability Checklist

Before publishing an API, ask:

- Is the contract stable?
- Can requests be retried safely?
- Are errors structured?
- Can consumers paginate large datasets?
- Is authentication standardized?
- Are requests traceable?
- Are breaking changes avoidable?
- Can someone understand it from the documentation alone?

If the answer is yes, you're already ahead of most APIs in production.
