---
layout: post
title: "Designing Reliable REST APIs: Principles That Stand the Test of Time"
date: 2025-05-21
categories: [guide, api, programming, english]
---

REST APIs are the connective tissue of modern systems — especially when you're building tools that others will build on. Whether you're exposing models in production, querying genomic metadata, or orchestrating workflows from the CLI, a good API can be the difference between smooth automation and brittle chaos.

GraphQL is often pitched as a modern alternative to REST — and it does solve real pain points like over-fetching and schema introspection. But when your priority is **reliability, simplicity, and ease of debugging**, REST remains the most dependable option. REST embraces HTTP conventions, works out of the box with tools like `curl`, proxies, and caching layers, and is easier to reason about in high-throughput, distributed systems.

This post is my personal checklist — grounded in real-world reliability — for designing REST APIs that don't break when your team scales, your users misbehave, or your future self forgets how it works.

---

## 🧱 Design Principles Backed by SOLID

Reliable REST APIs follow the same principles that make software maintainable:

### Single Responsibility
  
Every endpoint should do *just one thing*. No side effects, no "magic."  

✅ `POST /users` creates a user — and nothing else.

### Open/Closed Principle

Design for **extension**, not modification.  

Version your APIs. Don't break old contracts to add new features.

### Stable Interfaces

Don't surprise clients by changing field types or removing keys.

Add optional fields instead of changing existing ones.

### Explicit Contracts

Hide internals. Don't expose raw database models or internal logic in responses.

---

## 🔑 REST API Practices That Actually Matter

### 1. Keep URLs Resource-Oriented

Use nouns:

```http
GET /users/42
POST /runs
DELETE /runs/88
```

Avoid verbs in routes. Let HTTP verbs define the action.

Use plural nouns for collections:

- ✅ `/users`, `/orders`, `/runs`  
- ✅ `/users/123/runs`  
- ❌ `/userList`, `/createUserEntry`

Plural resources are the convention and make routes predictable.

---

### 2. Use Query Parameters for Filtering, Sorting, and Pagination

```http
GET /runs?status=completed&sort=created_at&page=2&limit=50
```

Use these for:

- Filtering: `?status=active`
- Sorting: `?sort=-created_at`
- Pagination: `?page=3&limit=20`

---

### 3. Use Status Codes to Reflect Reality

Let HTTP speak for your API:

- `200 OK`, `201 Created`, `204 No Content`
- `400 Bad Request`, `404 Not Found`, `409 Conflict`
- `500 Internal Server Error`

Clients shouldn't need to parse your error strings to guess what happened.

---

### 4. Design Consistent JSON Responses

✅ Good:

```json
{
  "data": {...},
  "error": null
}
```

❌ Bad:

```json
"Operation completed successfully"
```

Structured responses are easier to handle in any client, language, or logging system.

---

### 5. Be Idempotent Where It Counts

APIs must survive retries:

- `DELETE /users/123` — safe to call twice
- `POST /charges` — use an `Idempotency-Key` header so repeated requests return the same result without re-processing

Idempotency isn't optional — it's a survival strategy.

---

### 6. Secure by Default

Security isn't optional — especially for public or internal APIs handling sensitive data.

- Always use **HTTPS**
- Use **OAuth2** or **JWT Bearer Tokens**
- Never pass sensitive data in query params (e.g., passwords, API keys)

💡 _Design your API assuming it will be misused._

---

### 7. Version Early, Version Clearly

APIs evolve — your users shouldn't suffer for that.

- Use URI versioning: `/v1/users`, `/v2/orders`
- Avoid breaking changes
- If needed, support older versions in parallel

Good versioning makes APIs resilient and predictable.

---

### 8. Rate Limit and Fail Gracefully

APIs under load fail. The question is **how** they fail.

- Set rate limits and communicate them:
  - `X-RateLimit-Limit`
  - `X-RateLimit-Remaining`
  - `Retry-After`
- Return `429 Too Many Requests` when appropriate

Graceful degradation builds trust.

---

### 9. Document for Humans

If you need a meeting to explain your API, it's not ready.

- Use OpenAPI/Swagger
- Provide curl examples
- Keep it in sync with the code

Good docs reduce support requests and human error.

---

## 🧠 Final Thoughts

You don't need 20 rules to design a reliable API. You just need to keep it:

- Predictable
- Purposeful
- Clear to humans

REST may not be shiny, but it wins by being boring — and boring is exactly what you want when things go wrong at scale.

Design like you'll need to debug it at 3 AM. You probably will.

