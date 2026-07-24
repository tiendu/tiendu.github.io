---
title: "The Request Should Survive the Tool"
date: 2026-07-24
description: "Why I prefer curl and Python requests when API calls need to be reproducible, debuggable, and operationally reliable."
topic: "Reliability & Operations"
keywords:
  - "curl"
  - "Python requests"
  - "API testing"
  - "Postman"
  - "Hoppscotch"
  - "SRE"
  - "reliability engineering"
  - "incident response"
  - "HTTP debugging"
  - "reproducibility"
  - "automation"
urlSlug: "the-request-should-survive-the-tool"
---

I was recently reminded that there are entire applications for sending HTTP requests.

Postman is the obvious one. Hoppscotch is the lighter, open-source alternative.

Both are capable tools.

I still open a terminal and type `curl`.

It is not because a command line makes the request more legitimate. It is not because clicking **Send** is somehow less technical. It is not even because I dislike graphical interfaces.

I prefer `curl` because reliability work has made me suspicious of requests that I cannot reproduce exactly.

A request involved in an incident should not depend on someone remembering which tab was open, which environment was selected, which variables were active, whether cookies had been retained, or whether a pre-request script quietly generated part of the authentication state.

The request should survive the tool that created it.

---

## The real problem is hidden state

Imagine someone reports:

> The API worked in Postman yesterday, but it fails today.

That is useful as a symptom, but it is not yet a reproducible test case.

The investigation immediately expands:

- Which environment was selected?
- What were the current variable values?
- Was a token generated automatically?
- Were cookies retained from an earlier request?
- Did a pre-request script modify the headers or body?
- Did the client follow redirects?
- Was TLS verification disabled?
- What payload was actually sent?

None of this means Postman is bad. Postman collections are portable artifacts and can be executed from the command line. Hoppscotch also supports collections, environments, runners, and a CLI.

Both tools can be used reproducibly.

The difference is where I naturally begin.

With a GUI client, reproducibility is something I need to preserve through collections, shared environments, exports, and disciplined configuration.

With `curl`, the request usually begins as text:

```bash
curl --request POST \
  --url "$API_URL/v1/jobs" \
  --header "Authorization: Bearer $API_TOKEN" \
  --header "Content-Type: application/json" \
  --data @request.json
```

The command does not describe the entire environment. DNS, proxies, certificates, credentials, and network paths still exist outside it.

But it gives the investigation a concrete artifact. The method, URL, headers, and body source are visible. Another engineer can review it, modify it, compare it with an earlier version, or run the same shape of request elsewhere.

That is a much better starting point than reconstructing a local workspace from memory.

> Hidden state is convenient during exploration and expensive during incidents.

---

## A request should become evidence

A useful operational request should move between contexts without being rebuilt from scratch.

It may need to run from a developer laptop, a restricted server, a failing node, or a CI job. It may need extra timing, tracing, or proxy configuration. Text travels well between these environments.

A request may begin as exploration:

```bash
curl https://api.example.com/v1/health
```

Later, it becomes a deployment check:

```bash
curl \
  --silent \
  --show-error \
  --fail-with-body \
  --connect-timeout 5 \
  --max-time 30 \
  https://api.example.com/v1/health
```

Then it becomes an observable diagnostic:

```bash
curl \
  --silent \
  --show-error \
  --fail-with-body \
  --connect-timeout 5 \
  --max-time 30 \
  --output response.json \
  --write-out \
'http_code=%{http_code}
remote_ip=%{remote_ip}
time_namelookup=%{time_namelookup}
time_connect=%{time_connect}
time_appconnect=%{time_appconnect}
time_starttransfer=%{time_starttransfer}
time_total=%{time_total}
' \
  https://api.example.com/v1/health
```

The endpoint has not changed. The request has become operationally useful.

During an incident, I rarely need only the response body. I need to know where the request failed:

```text
name resolution
    -> TCP connection
        -> TLS handshake
            -> request transmission
                -> server processing
                    -> first response byte
                        -> full response
```

`curl` gives me small tools for separating that path.

### Inspect the response and exchange

```bash
curl --include https://api.example.com/v1/health
curl --verbose https://api.example.com/v1/health
```

Headers can reveal redirects, caching, rate limits, content types, request IDs, and gateway behavior. Verbose output can expose DNS resolution, connection attempts, proxy usage, TLS negotiation, request headers, and response headers.

It can also expose credentials and cookies. A verbose trace should be reviewed before it enters a ticket or incident channel.

### Separate DNS from the destination

```bash
curl \
  --verbose \
  --resolve api.example.com:443:203.0.113.10 \
  https://api.example.com/v1/health
```

This forces the connection to a known IP while preserving the original hostname for HTTP and TLS. If this succeeds while normal resolution fails, the problem may be DNS or address selection rather than the application.

IPv4 and IPv6 can also be tested independently:

```bash
curl --ipv4 https://api.example.com/v1/health
curl --ipv6 https://api.example.com/v1/health
```

A service can appear intermittently unhealthy when only one network path is broken.

### Make failure visible and bounded

```bash
curl \
  --silent \
  --show-error \
  --fail-with-body \
  --connect-timeout 5 \
  --max-time 30 \
  https://api.example.com/v1/jobs/123
```

By default, an HTTP `4xx` or `5xx` response does not make `curl` exit with an error. `--fail-with-body` gives scripts a non-zero exit while retaining the response body, which often contains the best explanation.

The timeouts matter too. A diagnostic should not become another process waiting indefinitely during an already confusing incident.

> The purpose of a diagnostic command is not merely to send the request. It is to preserve evidence about the path the request took.

### Record the exact test

An incident note that says this is incomplete:

```text
The endpoint was tested and returned 503.
```

A stronger record contains the test itself:

```bash
date -u
hostname

curl \
  --silent \
  --show-error \
  --fail-with-body \
  --connect-timeout 5 \
  --max-time 30 \
  --write-out '\nhttp_code=%{http_code} remote_ip=%{remote_ip} total=%{time_total}s\n' \
  https://api.example.com/v1/health
```

Now another engineer knows when and where it ran, what was requested, which address answered, how long it took, and how failure was defined.

That is a small example of reliability engineering: turning an observation into repeatable evidence.

---

## When one request becomes a workflow, I use Python

`curl` is excellent for a single request, a focused reproduction, or a narrow diagnostic.

It becomes awkward when the work requires authentication flows, pagination, polling, branching, JSON transformation, structured logs, or several related endpoints.

That is where I usually move to Python and `requests`.

```python
from __future__ import annotations

import os
import sys
from typing import Any

import requests


API_URL = os.environ["API_URL"].rstrip("/")
API_TOKEN = os.environ["API_TOKEN"]


def list_failed_jobs(session: requests.Session) -> list[dict[str, Any]]:
    response = session.get(
        f"{API_URL}/v1/jobs",
        params={"status": "failed", "limit": 100},
        timeout=(5, 30),
    )
    response.raise_for_status()
    return response.json()["items"]


with requests.Session() as session:
    session.headers.update(
        {
            "Authorization": f"Bearer {API_TOKEN}",
            "Accept": "application/json",
        }
    )

    try:
        jobs = list_failed_jobs(session)
    except requests.HTTPError as exc:
        response = exc.response
        body = response.text[:2000] if response is not None else ""
        print(f"HTTP request failed: {exc}\n{body}", file=sys.stderr)
        raise SystemExit(2)
    except requests.RequestException as exc:
        print(f"request failed: {exc}", file=sys.stderr)
        raise SystemExit(3)

    for job in jobs:
        print(job["id"], job["status"])
```

Several choices here are boring on purpose:

- configuration and credentials come from the environment;
- a session carries common headers and reuses connections;
- the request has explicit connection and read timeouts;
- unsuccessful HTTP responses are raised;
- the error body is preserved in bounded form;
- failures produce a non-zero exit.

This is more useful in operations than a script that prints JSON when everything works and hangs or crashes vaguely when it does not.

### Timeouts are not optional

A common mistake is:

```python
response = requests.get(url)
```

`requests` does not apply a timeout unless one is provided.

```python
response = requests.get(url, timeout=(5, 30))
```

The tuple represents connection and read timeouts. It is not a guaranteed upper bound for the entire business operation, but it prevents an individual connection or read from waiting without limit.

HTTP responses also do not raise themselves. Use `raise_for_status()` when an unsuccessful status should stop the workflow:

```python
response = requests.get(url, timeout=(5, 30))
response.raise_for_status()
```

A reliability tool should fail loudly enough for automation to notice and clearly enough for an engineer to investigate.

---

## Retries are a semantic decision

Retries are often presented as a generic reliability improvement.

They are not.

A retry repeats an operation. Whether that is safe depends on the operation.

Retrying this is usually reasonable:

```http
GET /v1/jobs/123
```

Retrying this may create duplicate work:

```http
POST /v1/jobs
```

A timed-out client may not know whether the server received and completed the original request. Retrying blindly can launch the job twice, charge the customer twice, or create two records.

For safe methods, controlled retries can be added deliberately:

```python
import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry


retry_policy = Retry(
    total=3,
    backoff_factor=0.5,
    status_forcelist={429, 500, 502, 503, 504},
    allowed_methods={"GET", "HEAD", "OPTIONS"},
    respect_retry_after_header=True,
)

session = requests.Session()
session.mount("https://", HTTPAdapter(max_retries=retry_policy))
session.mount("http://", HTTPAdapter(max_retries=retry_policy))
```

For state-changing operations, the better answer may be an idempotency key, a client-generated operation ID, a status lookup before retrying, or no automatic retry at all.

> A retry policy is part of the API's behavior, not merely a networking option.

---

## Text is not automatically reliable

It is easy to turn this into the wrong lesson:

> CLI good. GUI bad.

That is not the point.

A bad `curl` command is still bad:

```bash
curl --insecure https://api.example.com
```

A bad Python client is still bad:

```python
requests.get(url)
```

A shell script can contain hidden assumptions. A Python program can swallow exceptions. A command pasted into a ticket can expose a production token. A retry loop can amplify an outage. A request can be reproducible and still be dangerously wrong.

Reliability requires the behavior to be intentional.

### Do not normalize disabled TLS verification

`--insecure` and `verify=False` are useful for narrow diagnosis of certificate problems. They should not quietly become the permanent fix.

If disabling verification changes the result, the investigation has found evidence of a trust, hostname, interception, or certificate-chain problem. The next step is to fix that problem, not remove verification everywhere.

### Do not turn secrets into evidence

This is convenient:

```bash
curl \
  --header "Authorization: Bearer actual-production-token" \
  https://api.example.com/v1/jobs
```

It can also leave the token in shell history, logs, screenshots, process inspection, chat systems, and incident records.

Use short-lived credentials, protected files, secret injection, or an authentication helper appropriate to the environment. Review and redact diagnostic output before sharing it.

Error bodies should also be bounded and sanitized. They may contain sensitive data, large stack traces, gateway pages, or user-provided content.

### Do not confuse reproducibility with correctness

A perfectly reproducible command can still test the wrong endpoint, use stale credentials, omit a required header, or send a destructive request to production.

Reproducibility lets other people inspect and repeat the mistake. Review and safeguards are still required.

---

## GUI clients still have a place

Postman and Hoppscotch solve real problems.

They are useful for learning an unfamiliar API, organizing many endpoints, experimenting with authentication, visualizing responses, sharing collections, generating documentation, and helping teams work together without requiring everyone to live in a terminal.

A graphical client may be the fastest way to understand an API I have never seen before.

The reliability boundary appears when the request becomes operationally important.

When a request proves a production failure, verifies a deployment, enters a runbook, runs from a restricted host, or needs to execute in CI, I want its essential behavior represented as text.

That text may be a `curl` command, a `.http` file, a shell script, a Python program, or a collection stored and executed through a CLI. The format matters less than the property:

> Another engineer should be able to understand what was sent without depending on my local session.

I do not use `curl` because terminals are more serious than graphical tools. I use it because a request that matters should be inspectable, portable, and repeatable.

Postman or Hoppscotch may help me discover the API. But when the request becomes evidence, automation, or an operational procedure, it should survive the tool that created it.
