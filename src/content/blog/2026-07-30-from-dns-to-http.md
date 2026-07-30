---
title: "From DNS to HTTP"
date: 2026-07-30
description: "A practical guide to TCP, UDP, IP, DNS, TLS, HTTP, proxies, ports, status codes, and network troubleshooting."
topic: "Infrastructure & Automation"
keywords:
  - "networking"
  - "TCP"
  - "UDP"
  - "DNS"
  - "HTTP"
  - "TLS"
  - "Linux"
  - "troubleshooting"
urlSlug: "networking-useful-stuff"
---

A condensed, practical networking reference for software, systems, and operations work.
Not a networking textbook. Just the concepts and commands that repeatedly matter during interviews, incidents, and everyday debugging.

The main path to remember is:

```text
name -> address -> route -> connection -> encryption -> request -> response
 DNS      IP       network      TCP          TLS        HTTP       HTTP
```

---
## Start With the Whole Journey

When a browser opens:

```text
https://api.example.com/users
```

a simplified journey looks like this:

```text
Browser
  |
  | 1. Resolve api.example.com
  v
DNS resolver
  |
  | 2. Return an IP address
  v
Routing
  |
  | 3. Send packets towards that IP
  v
TCP or QUIC connection
  |
  | 4. Establish transport
  v
TLS
  |
  | 5. Verify identity and create encryption keys
  v
HTTP request
  |
  | 6. GET /users
  v
Proxy / load balancer / application
  |
  | 7. Process request
  v
HTTP response
```

The important debugging question is:

> At which layer did the journey stop?

| Symptom | Likely Layer | First Tool |
|---|---|---|
| Domain does not resolve | DNS | `dig` |
| No route to host | routing | `ip route`, `traceroute` |
| Connection refused | TCP / listening service | `ss`, `nc` |
| Connection times out | firewall / routing / service | `nc`, `traceroute` |
| Certificate error | TLS | `openssl s_client` |
| `401`, `403`, `404` | HTTP / application | `curl -v` |
| `502`, `503`, `504` | proxy / upstream service | `curl -v`, logs |
| Intermittent slowness | DNS, loss, saturation, application | `mtr`, `curl -w`, metrics |

---
## OSI vs TCP/IP

The OSI model is useful for vocabulary. The TCP/IP model is closer to how real systems are discussed.

| OSI Layer | Practical Meaning | Examples |
|---|---|---|
| 7 Application | what the program speaks | HTTP, DNS, SSH, SMTP |
| 6 Presentation | encoding and encryption | TLS, JSON, UTF-8 |
| 5 Session | conversation management | sessions, reconnects |
| 4 Transport | process-to-process delivery | TCP, UDP, QUIC |
| 3 Network | host-to-host routing | IP, ICMP |
| 2 Data Link | local-network delivery | Ethernet, Wi-Fi, MAC, ARP |
| 1 Physical | signals and media | cable, fibre, radio |

A practical four-layer view:

| TCP/IP Layer | What It Answers |
|---|---|
| Application | What does the program want to say? |
| Transport | Which process should receive it, and how reliably? |
| Internet | Which host should receive it? |
| Link | How does it reach the next device on this local network? |

Do not force every real protocol into exactly one OSI box. The model is a troubleshooting aid, not a law of nature.

### Useful layer language

```text
Layer 7 problem: HTTP request, authentication, application response
Layer 4 problem: TCP connection, UDP traffic, port, load balancer
Layer 3 problem: IP address, route, firewall rule
Layer 2 problem: local network, MAC address, ARP, VLAN
```

---
## IP Addresses, Subnets, and Routes

An IP address identifies an interface in an IP network.

Examples:

```text
IPv4: 192.0.2.10
IPv6: 2001:db8::10
```

A packet needs at least:

```text
source IP -> destination IP
```

### Private IPv4 ranges

| Range | CIDR |
|---|---|
| `10.0.0.0` to `10.255.255.255` | `10.0.0.0/8` |
| `172.16.0.0` to `172.31.255.255` | `172.16.0.0/12` |
| `192.168.0.0` to `192.168.255.255` | `192.168.0.0/16` |

Private addresses are not routed directly across the public Internet.

### CIDR and subnet masks

CIDR says how many leading bits describe the network.

| CIDR | Subnet Mask | Addresses | Typical Meaning |
|---|---|---:|---|
| `/8` | `255.0.0.0` | 16,777,216 | very large network |
| `/16` | `255.255.0.0` | 65,536 | large private network |
| `/24` | `255.255.255.0` | 256 | common small subnet |
| `/32` | `255.255.255.255` | 1 | one IPv4 address |

For:

```text
192.168.10.42/24
```

the first 24 bits identify the network:

```text
network:   192.168.10.0
host:                 42
```

A `/24` contains 256 addresses. In a traditional IPv4 subnet, the first is the network address and the last is the broadcast address, leaving 254 usable host addresses. Cloud platforms may reserve additional addresses.

### Local destination or gateway?

A host compares the destination with its local subnet.

```text
Host:        192.168.10.42/24
Destination: 192.168.10.80
```

Same subnet:

```text
send directly on the local network
```

Different subnet:

```text
send to the default gateway
```

The default gateway is the router used when no more specific route matches.

```bash
ip route
```

Example:

```text
default via 192.168.10.1 dev eth0
192.168.10.0/24 dev eth0 proto kernel scope link src 192.168.10.42
```

Read it as:

- destinations in `192.168.10.0/24` are directly reachable through `eth0`;
- everything else goes to `192.168.10.1`.

### Longest-prefix match

Routers choose the most specific matching route.

```text
10.0.0.0/8
10.20.0.0/16
10.20.30.0/24
```

Traffic for `10.20.30.8` uses `/24`, because it is the longest and most specific match.

---
## MAC Addresses and ARP

IP handles routing between networks. MAC addresses handle delivery on a local Ethernet-like network.

A host may know:

```text
destination IP: 192.168.10.80
```

but still need the destination MAC address.

ARP answers:

```text
Who has 192.168.10.80?
Tell 192.168.10.42.
```

Inspect the neighbour table:

```bash
ip neigh
```

Example:

```text
192.168.10.1 dev eth0 lladdr 00:11:22:33:44:55 REACHABLE
```

For a remote destination, the host normally resolves the MAC address of the gateway, not the final remote server.

> IP identifies the final network destination. A local MAC address identifies the next hop on the current link.

---
## NAT

Network Address Translation rewrites addresses, and often ports, as traffic crosses a device.

A common outbound flow:

```text
private client                NAT gateway                  public server
10.0.1.15:49152  -------->  203.0.113.8:62001  -------->  198.51.100.20:443
```

The gateway remembers the mapping so return traffic can reach the original client.

| Term | Meaning |
|---|---|
| SNAT | rewrite the source address |
| DNAT | rewrite the destination address |
| PAT / NAPT | rewrite ports as well as addresses |
| Port forwarding | map an external address and port to an internal service |

NAT is not the same as a firewall.

- NAT rewrites addressing information.
- A firewall permits or denies traffic.
- A device may perform both.

---
## Ports and Sockets

An IP address identifies a host or interface. A port helps identify the application endpoint.

```text
IP address + transport protocol + port
```

Examples:

```text
TCP 203.0.113.10:443
UDP 192.0.2.53:53
```

A TCP connection is commonly identified by:

```text
source IP
source port
destination IP
destination port
protocol
```

This is often called the five-tuple.

Example:

```text
192.168.1.10:53044 -> 203.0.113.20:443 TCP
```

The client usually uses a temporary ephemeral source port. The server listens on a known destination port.

### Common ports

| Port | Transport | Service |
|---:|---|---|
| 22 | TCP | SSH |
| 25 | TCP | SMTP |
| 53 | UDP / TCP | DNS |
| 67 / 68 | UDP | DHCP server / client |
| 80 | TCP | HTTP |
| 123 | UDP | NTP |
| 143 | TCP | IMAP |
| 443 | TCP / UDP | HTTPS over TCP; HTTP/3 over QUIC |
| 465 | TCP | SMTP over implicit TLS |
| 587 | TCP | mail submission |
| 993 | TCP | IMAP over TLS |
| 3306 | TCP | MySQL |
| 5432 | TCP | PostgreSQL |
| 6379 | TCP | Redis default |
| 8080 | TCP | common alternative HTTP port |
| 8443 | TCP | common alternative HTTPS port |

Ports are conventions, not guarantees. Any service can be configured to listen on another port.

---
## TCP vs UDP

| Feature | TCP | UDP |
|---|---|---|
| Connection setup | yes | no transport handshake |
| Delivery guarantee | reliable byte stream | best effort datagrams |
| Ordering | preserves byte order | packets may arrive out of order |
| Retransmission | built in | application must handle it |
| Flow control | yes | no |
| Congestion control | yes | not built into UDP itself |
| Message boundaries | no; byte stream | yes; datagrams |
| Header overhead | higher | lower |
| Common uses | HTTPS, SSH, databases | DNS, voice, games, QUIC |

Do not memorise:

```text
TCP is slow.
UDP is fast.
```

A better version:

```text
TCP includes reliability, ordering, flow control, and congestion control.
UDP provides a smaller best-effort datagram service.
```

An application can build reliability and congestion control over UDP. QUIC does this.

### Mental model

TCP:

> Deliver the bytes reliably and in order, or report failure.

UDP:

> Send this datagram. The network may deliver it, duplicate it, reorder it, or drop it.

### TCP handshake

```text
Client                         Server
  |                              |
  | -------- SYN --------------> |
  | <----- SYN-ACK ------------- |
  | -------- ACK --------------> |
  |                              |
  |       connection ready       |
```

Remember:

```text
SYN -> SYN-ACK -> ACK
```

The handshake establishes connection state and initial sequence-number information. It does not mean the application itself is healthy.

A successful TCP connection to a web server only proves that something accepted the connection on that address and port.

### TCP close

A graceful close uses FIN and ACK messages. Either side can close its sending direction.

A reset:

```text
RST
```

means the connection was aborted rather than closed normally.

Typical interpretations:

| Event | Possible Meaning |
|---|---|
| connection refused | no listener, or active rejection |
| connection timeout | packets dropped, route broken, firewall silent, overloaded path |
| connection reset | peer or middlebox aborted the connection |
| broken pipe | local process wrote after the connection was closed |
| read timeout | connection exists, but expected data did not arrive in time |

### Byte stream, not messages

TCP does not preserve application write boundaries.

If one process writes:

```text
hello
world
```

the receiver may read:

```text
helloworld
```

or:

```text
hel
lowor
ld
```

Applications need framing, such as:

- content length;
- delimiters;
- fixed-size messages;
- length-prefixed messages;
- an application protocol such as HTTP.

---
## DNS

DNS maps names to data.

The familiar case is:

```text
api.example.com -> 203.0.113.20
```

but DNS stores many record types.

### Common DNS records

| Record | Purpose | Example |
|---|---|---|
| `A` | name to IPv4 address | `api.example.com -> 203.0.113.20` |
| `AAAA` | name to IPv6 address | `api.example.com -> 2001:db8::20` |
| `CNAME` | alias to another name | `www -> site.example.net` |
| `MX` | mail exchanger | mail delivery |
| `TXT` | arbitrary text | SPF, DKIM, verification |
| `NS` | authoritative nameserver | delegation |
| `SOA` | zone authority metadata | primary server, serial, timers |
| `PTR` | reverse lookup | IP address to name |
| `SRV` | service location | host and port for a service |
| `CAA` | allowed certificate authorities | certificate issuance policy |

### Resolver path

A typical lookup:

```text
Application
    |
    v
OS resolver / local cache
    |
    v
Recursive resolver
    |
    +--> Root nameserver
    |
    +--> .com nameserver
    |
    +--> example.com authoritative nameserver
    |
    v
Answer cached according to TTL
```

| Role | Responsibility |
|---|---|
| Stub resolver | asks DNS questions for the local application |
| Recursive resolver | finds the final answer and caches it |
| Authoritative server | provides official records for a zone |
| Root server | points towards top-level-domain servers |
| TLD server | points towards authoritative servers |

### TTL and caching

TTL tells caches how long an answer may be reused.

A DNS change is not instantly visible everywhere because:

- recursive resolvers cache old answers;
- operating systems cache answers;
- browsers and applications may cache answers;
- negative answers can also be cached.

A low TTL can reduce propagation delay, but increases query volume. A low TTL does not force every existing cache to discard an answer early.

### DNS uses UDP and TCP

DNS commonly uses UDP for ordinary queries. It also uses TCP when needed, including cases such as larger responses, retries after truncation, and zone transfers.

Do not memorise:

```text
DNS is UDP only.
```

### Useful DNS commands

Basic lookup:

```bash
dig example.com
```

Only the answer:

```bash
dig +short example.com
```

Query a record type:

```bash
dig example.com AAAA
dig example.com MX
dig example.com TXT
```

Ask a specific resolver:

```bash
dig @1.1.1.1 example.com
```

Trace delegation:

```bash
dig +trace example.com
```

Reverse lookup:

```bash
dig -x 203.0.113.20
```

Inspect the resolver configured by `systemd-resolved`:

```bash
resolvectl status
resolvectl query example.com
```

Inspect traditional resolver configuration:

```bash
cat /etc/resolv.conf
```

### DNS response ideas worth recognising

| Result | Meaning |
|---|---|
| `NOERROR` with answers | successful lookup |
| `NOERROR` without the requested answer | name may exist, record type does not |
| `NXDOMAIN` | queried name does not exist |
| `SERVFAIL` | resolver could not complete the lookup |
| timeout | resolver unreachable, packet filtered, or no response |

---
## HTTP Request and Response

HTTP is an application protocol with request and response semantics.

A simplified HTTP/1.1 request:

```http
GET /users/42?verbose=true HTTP/1.1
Host: api.example.com
Accept: application/json
Authorization: Bearer TOKEN
```

A simplified response:

```http
HTTP/1.1 200 OK
Content-Type: application/json
Content-Length: 27

{"id":42,"name":"Tien"}
```

### URL anatomy

```text
https://api.example.com:443/users/42?verbose=true#profile
\___/   \_____________/ \_/ \_______/ \__________/ \_____/
scheme         host      port   path       query    fragment
```

Important:

- the fragment is normally handled by the client and is not sent in the HTTP request;
- the `Host` header or HTTP `:authority` value identifies the target host;
- the path and query identify the target resource and parameters;
- HTTPS normally uses port 443, but the port can be changed.

### Common headers

| Header | Purpose |
|---|---|
| `Host` | target hostname in HTTP/1.1 |
| `Accept` | response formats the client understands |
| `Content-Type` | format of the message body |
| `Content-Length` | body length in bytes |
| `Authorization` | credentials |
| `User-Agent` | identifies the client software |
| `Cookie` | sends stored cookies |
| `Set-Cookie` | asks the client to store a cookie |
| `Cache-Control` | caching rules |
| `Location` | redirect target or created resource location |
| `Retry-After` | suggested wait before retrying |
| `ETag` | resource version identifier |
| `If-None-Match` | conditional request using an ETag |
| `X-Forwarded-For` | commonly carries original client IP through proxies |
| `Forwarded` | standardised proxy forwarding information |

Never assume forwarded headers are trustworthy unless they came through a proxy you control.

---
## HTTP Methods

| Method | Safe | Idempotent | Typical Use |
|---|---|---|---|
| `GET` | yes | yes | retrieve a representation |
| `HEAD` | yes | yes | retrieve headers without a response body |
| `POST` | no | no by default | submit or create |
| `PUT` | no | yes | create or replace at a known URI |
| `PATCH` | no | not guaranteed | partial modification |
| `DELETE` | no | yes | remove a resource |
| `OPTIONS` | yes | yes | discover communication options |
| `TRACE` | yes | yes | diagnostic loopback; often disabled |
| `CONNECT` | no | no | create a tunnel, commonly through a proxy |

### Safe vs idempotent

Safe means the method is intended not to change server state.

Idempotent means repeating the same request has the same intended effect as sending it once.

```text
GET    safe and idempotent
PUT    not safe, but idempotent
DELETE not safe, but idempotent
POST   usually neither
```

Idempotent does not mean every repeated response is identical.

Example:

```text
DELETE /users/42
```

The first request may return `204`. A second may return `404`. The intended state is still the same: user 42 is absent.

### PUT vs PATCH

```text
PUT   -> replace the resource representation
PATCH -> apply a partial change
```

Real APIs sometimes use these differently. Read the API contract rather than trusting the method name alone.

---
## HTTP Status Codes

### Categories

| Class | Meaning | Memory |
|---|---|---|
| `1xx` | informational | continue |
| `2xx` | success | done |
| `3xx` | redirection | go |
| `4xx` | client-side request problem | you |
| `5xx` | server-side processing problem | me |

The memory line:

```text
1 = wait
2 = done
3 = go
4 = you
5 = me
```

It is only a memory aid. A `4xx` does not prove the human user is at fault, and a `5xx` may be caused by an upstream dependency.

### Common success codes

| Code | Name | Practical Meaning |
|---:|---|---|
| `200` | OK | request succeeded |
| `201` | Created | a resource was created |
| `202` | Accepted | accepted for later processing, not completed yet |
| `204` | No Content | succeeded with no response body |
| `206` | Partial Content | returned a requested byte range |

### Common redirects and caching responses

| Code | Name | Practical Meaning |
|---:|---|---|
| `301` | Moved Permanently | permanent redirect; clients may change POST to GET |
| `302` | Found | temporary redirect; clients may change POST to GET |
| `303` | See Other | fetch another URI using GET |
| `304` | Not Modified | cached representation is still valid |
| `307` | Temporary Redirect | temporary redirect; preserve method and body |
| `308` | Permanent Redirect | permanent redirect; preserve method and body |

The useful distinction:

```text
301 / 302 -> historical clients may change the method
307 / 308 -> method and body are preserved
```

### Common client-error codes

| Code | Name | Practical Meaning |
|---:|---|---|
| `400` | Bad Request | malformed or invalid request |
| `401` | Unauthorized | authentication is required or invalid |
| `403` | Forbidden | server understood the identity or request but refuses access |
| `404` | Not Found | target resource was not found, or is intentionally hidden |
| `405` | Method Not Allowed | method is unsupported for this resource |
| `408` | Request Timeout | server timed out waiting for the request |
| `409` | Conflict | request conflicts with current resource state |
| `410` | Gone | resource intentionally no longer exists |
| `412` | Precondition Failed | conditional request requirement failed |
| `413` | Content Too Large | request body exceeds the accepted limit |
| `415` | Unsupported Media Type | unsupported body format |
| `422` | Unprocessable Content | syntax understood, semantic validation failed |
| `425` | Too Early | server declines a request at risk of replay |
| `429` | Too Many Requests | rate limit reached |

### Common server-error codes

| Code | Name | Practical Meaning |
|---:|---|---|
| `500` | Internal Server Error | unexpected server-side failure |
| `501` | Not Implemented | server does not support the requested functionality |
| `502` | Bad Gateway | proxy received an invalid or failed upstream response |
| `503` | Service Unavailable | service is unavailable, overloaded, or under maintenance |
| `504` | Gateway Timeout | proxy did not receive an upstream response in time |

### 401 vs 403

```text
401 -> authenticate first, or fix the credentials
403 -> credentials are insufficient, or access is denied
```

Memory:

```text
401: Who are you?
403: I know enough. Still no.
```

The status name `401 Unauthorized` is historically awkward. In practice it usually indicates an authentication problem.

### 400 vs 422

A common API convention:

```text
400 -> request structure or syntax is invalid
422 -> structure is understood, but the values fail validation
```

Example:

```json
{"email": "not-an-email"}
```

The JSON is valid, but the field value may produce `422`.

### 502 vs 503 vs 504

| Code | Ask This |
|---:|---|
| `502` | Did the proxy receive a broken response or fail to speak to the upstream correctly? |
| `503` | Is the service unavailable, overloaded, draining, or intentionally offline? |
| `504` | Did the proxy wait too long for the upstream? |

Memory:

```text
502 = bad upstream response
503 = unavailable service
504 = upstream timeout
```

### Do not over-trust status codes

Applications sometimes:

- return `200` with an error object;
- return `500` for invalid user input;
- return `404` to hide the existence of a protected resource;
- return `403` for failed authentication;
- wrap an upstream timeout as `500`.

Use the status code as evidence, then inspect headers, body, logs, and request context.

---
## HTTP vs HTTPS

| HTTP | HTTPS |
|---|---|
| HTTP semantics without TLS | HTTP carried through TLS, or through QUIC with TLS |
| traffic is not protected by TLS | traffic is encrypted and integrity-protected |
| no certificate-based server identity | certificate normally authenticates the server |
| commonly port 80 | commonly port 443 |

HTTPS protects data in transit between TLS endpoints.

It does not automatically protect:

- data before encryption on the client;
- data after decryption on the server;
- application logs;
- browser extensions;
- compromised endpoints;
- data from an authorised recipient;
- metadata such as destination IP addresses.

---
## TLS

TLS provides:

| Property | Meaning |
|---|---|
| Confidentiality | observers should not read the protected content |
| Integrity | tampering should be detected |
| Authentication | the client can verify the server identity; client certificates are optional |

### Simplified TLS 1.3 handshake

```text
Client                                      Server
  |                                           |
  | ClientHello                               |
  | - supported TLS versions                  |
  | - cipher suites                           |
  | - key share                               |
  | - SNI                                     |
  | - ALPN                                    |
  | ----------------------------------------> |
  |                                           |
  |                             ServerHello   |
  |                             certificate   |
  |                             Finished      |
  | <---------------------------------------- |
  |                                           |
  | Finished                                  |
  | ----------------------------------------> |
  |                                           |
  |        encrypted application data         |
```

This diagram omits details, but the practical results are:

- protocol parameters are negotiated;
- the server proves its identity with a certificate;
- both sides derive shared traffic keys;
- application traffic becomes encrypted.

### Certificate validation

A client generally checks:

- the certificate is valid for the requested hostname;
- the certificate is within its validity period;
- the certificate chains to a trusted certificate authority;
- relevant certificate usage constraints permit the connection;
- the signature chain is valid.

Common failures:

| Error | Likely Cause |
|---|---|
| hostname mismatch | certificate does not cover the requested name |
| certificate expired | validity period ended |
| unknown issuer | missing or untrusted CA |
| unable to build chain | missing intermediate certificate |
| not yet valid | clock wrong or certificate validity begins later |
| handshake failure | incompatible protocol, cipher, client certificate, or policy |

### SNI

Server Name Indication tells the TLS server which hostname the client wants.

This matters because multiple HTTPS sites may share one IP address.

Without the correct SNI value, the server may return:

- the wrong certificate;
- a default virtual host;
- a handshake failure.

### ALPN

Application-Layer Protocol Negotiation selects the application protocol carried inside TLS.

Examples:

```text
h2       HTTP/2
http/1.1 HTTP/1.1
```

HTTP/3 negotiates through QUIC and TLS.

### Inspect TLS

Show the certificate and handshake:

```bash
openssl s_client \
  -connect example.com:443 \
  -servername example.com
```

Show key certificate fields:

```bash
openssl s_client \
  -connect example.com:443 \
  -servername example.com </dev/null 2>/dev/null \
  | openssl x509 -noout -subject -issuer -dates -ext subjectAltName
```

Test supported protocol through `curl`:

```bash
curl -v --http1.1 https://example.com/
curl -v --http2 https://example.com/
curl -v --http3 https://example.com/
```

`--http3` requires a curl build with HTTP/3 support.

Never use this as a permanent fix:

```bash
curl -k https://example.com/
```

`-k` disables certificate verification. It is useful only as a controlled diagnostic comparison.

---
## HTTP/1.1 vs HTTP/2 vs HTTP/3

HTTP semantics remain broadly the same. The message transport and framing differ.

| Feature | HTTP/1.1 | HTTP/2 | HTTP/3 |
|---|---|---|---|
| Transport | usually TCP | TCP | QUIC over UDP |
| Encryption | optional; HTTPS adds TLS | commonly TLS in browsers | TLS 1.3 integrated with QUIC |
| Framing | text-oriented messages | binary frames | binary frames over QUIC streams |
| Multiplexing | limited; often multiple connections | multiple streams per TCP connection | multiple QUIC streams |
| Header compression | no built-in equivalent | HPACK | QPACK |
| Loss effect | TCP connection affected | one lost TCP packet can delay all streams | loss on one stream need not block unrelated streams |
| Connection migration | no native HTTP feature | no native TCP migration | QUIC supports connection IDs and migration |
| Typical URL semantics | same | same | same |

### Head-of-line blocking

HTTP/1.1 commonly serialises requests on a connection or opens multiple connections.

HTTP/2 multiplexes many streams on one TCP connection. This removes application-level request ordering, but all streams still share TCP. A lost TCP packet can delay delivery across the connection.

HTTP/3 uses independent QUIC streams. Loss affecting one stream does not necessarily block data already available for another stream.

### HTTP/3 is not unreliable HTTP

QUIC runs over UDP, but QUIC itself implements:

- reliable delivery;
- congestion control;
- flow control;
- encryption;
- stream multiplexing;
- connection management.

The useful statement is:

```text
HTTP/3 uses QUIC over UDP.
QUIC supplies the reliability that HTTP needs.
```

---
## Proxies, Load Balancers, and CDNs

These systems often overlap in implementation, but the concepts are different.

| Component | Sits For | Main Purpose |
|---|---|---|
| Forward proxy | client | controls or hides outbound client traffic |
| Reverse proxy | server | accepts traffic on behalf of backend services |
| Load balancer | service pool | distributes traffic among targets |
| CDN | distributed edge | caches and serves content close to users |
| API gateway | APIs | routing, authentication, limits, transformation, policy |

### Forward proxy

```text
Client -> Forward Proxy -> Internet
```

The destination sees the proxy as the connecting client.

Common uses:

- corporate outbound control;
- filtering;
- privacy;
- caching;
- access through a controlled network path.

### Reverse proxy

```text
Client -> Reverse Proxy -> Application
```

The client may not know which backend handled the request.

Common uses:

- TLS termination;
- routing by hostname or path;
- authentication;
- compression;
- request limits;
- caching;
- hiding backend topology.

### Load balancer

```text
                    +-> App 1
Client -> LB -------+-> App 2
                    +-> App 3
```

Common algorithms:

| Algorithm | Idea |
|---|---|
| Round robin | rotate through targets |
| Least connections | prefer the target with fewer active connections |
| Weighted | send more traffic to stronger or preferred targets |
| Hash-based | choose target using client or request data |
| Random | randomly choose a healthy target |

A load balancer normally uses health checks to decide which targets may receive traffic.

### Layer 4 vs Layer 7 load balancing

| Layer 4 | Layer 7 |
|---|---|
| routes using IP, port, and transport data | understands HTTP details |
| lower protocol awareness | route by host, path, header, cookie |
| can pass encrypted traffic without terminating TLS | often terminates TLS |
| works for more than HTTP | HTTP-specific features |

### CDN

```text
User -> Nearby CDN edge -> Origin
```

The edge may serve cached content without contacting the origin.

A cache miss typically causes:

```text
edge -> origin -> edge cache -> user
```

CDNs may also provide:

- TLS termination;
- DDoS protection;
- web application firewall rules;
- image transformation;
- request routing;
- bot controls.

### Where 502, 503, and 504 appear

```text
Client -> CDN -> Load Balancer -> Reverse Proxy -> Application -> Database
```

Any intermediary may generate an error.

A `504` shown by the CDN does not prove the application itself generated `504`. Identify the responder using:

- response headers;
- body style;
- request IDs;
- proxy and application logs;
- timing;
- direct upstream tests.

---
## Cookies, Sessions, and JWTs

These concepts are related but not interchangeable.

| Concept | What It Is |
|---|---|
| Cookie | small value stored by the client and sent with matching HTTP requests |
| Session | server-side or distributed state associated with a client |
| Session ID | identifier that points to session state |
| JWT | structured token containing claims, usually signed |
| Bearer token | credential usable by whoever possesses it |

### Cookie-based session

```text
1. User logs in
2. Server creates session state
3. Server returns a session ID in Set-Cookie
4. Browser stores the cookie
5. Browser sends the cookie on later requests
6. Server looks up the session
```

Example:

```http
Set-Cookie: session_id=abc123; Secure; HttpOnly; SameSite=Lax
```

Useful cookie attributes:

| Attribute | Meaning |
|---|---|
| `Secure` | send only over secure transport |
| `HttpOnly` | hide from normal JavaScript access |
| `SameSite` | restrict cross-site sending |
| `Domain` | hosts that may receive the cookie |
| `Path` | URL path scope |
| `Max-Age` / `Expires` | persistence period |

### JWT

A JWT commonly has:

```text
header.payload.signature
```

The payload may contain claims such as:

```json
{
  "sub": "user-42",
  "role": "admin",
  "exp": 1785400000
}
```

Important:

- a signed JWT is not automatically encrypted;
- anyone holding a bearer JWT may be able to use it;
- revocation can be harder than deleting a server-side session;
- expiry, issuer, audience, algorithm, and signature must be validated;
- storing JWTs in cookies does not make them sessions, but they can be used as session credentials;
- a system using JWTs may still maintain server-side state.

Do not memorise:

```text
cookies are stateful
JWTs are stateless
```

A better question is:

> Where is the authoritative session state, how is the credential transported, and how is it revoked?

---
## curl

`curl` is often the fastest way to separate HTTP, TLS, DNS, and application problems.

### Common patterns

| Command | Purpose |
|---|---|
| `curl URL` | send request and print body |
| `curl -I URL` | request response headers with HEAD |
| `curl -i URL` | include response headers |
| `curl -v URL` | verbose connection, TLS, and HTTP details |
| `curl -L URL` | follow redirects |
| `curl -f URL` | fail on HTTP errors of 400 or greater |
| `curl -sS URL` | silent progress but show errors |
| `curl -o file URL` | save body to a named file |
| `curl -w FORMAT URL` | print timing and response metadata |
| `curl --connect-timeout 5 URL` | limit connection setup time |
| `curl --max-time 30 URL` | limit total operation time |

### Request examples

GET:

```bash
curl -fsS https://api.example.com/users
```

POST JSON:

```bash
curl -fsS \
  -X POST \
  -H 'Content-Type: application/json' \
  -d '{"name":"Tien"}' \
  https://api.example.com/users
```

Bearer token:

```bash
curl -fsS \
  -H "Authorization: Bearer $TOKEN" \
  https://api.example.com/me
```

Show status only:

```bash
curl -sS -o /dev/null -w '%{http_code}\n' \
  https://example.com/
```

Show useful timings:

```bash
curl -sS -o /dev/null \
  -w 'dns=%{time_namelookup}\nconnect=%{time_connect}\ntls=%{time_appconnect}\nfirst_byte=%{time_starttransfer}\ntotal=%{time_total}\n' \
  https://example.com/
```

Interpretation:

| Timing | What It Includes |
|---|---|
| `time_namelookup` | DNS resolution |
| `time_connect` | time until transport connection completed |
| `time_appconnect` | time until TLS completed |
| `time_starttransfer` | time until first response byte |
| `time_total` | complete request duration |

Test a hostname against a specific IP while preserving hostname and TLS SNI:

```bash
curl -v \
  --resolve example.com:443:203.0.113.20 \
  https://example.com/
```

This is excellent for testing a new server before DNS changes.

Follow redirects and retain the chain:

```bash
curl -sS -L -D headers.txt -o body.txt \
  https://example.com/
```

### Read verbose output by layer

A simplified `curl -v` sequence:

```text
* Host resolved
* Trying IP:443
* Connected
* TLS handshake
* Server certificate
> GET / HTTP/1.1
> Host: example.com
< HTTP/1.1 200 OK
< Content-Type: text/html
```

This tells you how far the request reached.

---
## Linux Networking Commands

### Quick command table

| Command | Main Use |
|---|---|
| `ip addr` | addresses and interfaces |
| `ip link` | link state |
| `ip route` | routes and default gateway |
| `ip neigh` | ARP / neighbour cache |
| `ping` | ICMP reachability and latency sample |
| `traceroute` / `tracepath` | path towards destination |
| `mtr` | repeated path and loss observations |
| `dig` | DNS queries |
| `resolvectl` | systemd resolver state |
| `ss` | sockets and listeners |
| `lsof -i` | processes using network sockets |
| `nc` | raw TCP / UDP connection tests |
| `curl` | HTTP, TLS, timing |
| `openssl s_client` | TLS handshake and certificate inspection |
| `tcpdump` | packet capture |
| `ethtool` | interface and link details |

### Interfaces and addresses

```bash
ip -br addr
ip link
```

`-br` gives a compact summary.

### Routes

```bash
ip route
ip route get 203.0.113.20
```

The second command asks the kernel which route it would use for that destination.

### Listeners and connections

```bash
ss -lntp
```

Flags:

| Flag | Meaning |
|---|---|
| `-l` | listening |
| `-n` | numeric addresses and ports |
| `-t` | TCP |
| `-u` | UDP |
| `-p` | process information |

Useful variants:

```bash
ss -lntp
ss -lnup
ss -tan state established
ss -s
```

Find a process using port 8080:

```bash
sudo lsof -nP -iTCP:8080 -sTCP:LISTEN
```

### Test a port

TCP:

```bash
nc -vz example.com 443
```

UDP tests are less conclusive because no response does not prove failure:

```bash
nc -vzu dns.example.com 53
```

### Ping caveat

```bash
ping example.com
```

A successful ping proves ICMP echo traffic works.

A failed ping does not prove the host or application is down. ICMP may be filtered while HTTPS still works.

Test the protocol you actually care about:

```bash
curl -v https://example.com/
```

### Trace a path

```bash
traceroute example.com
tracepath example.com
mtr example.com
```

Missing hops do not automatically mean packet loss at that device. Routers may deprioritise or block diagnostic responses while forwarding normal traffic.

### Packet capture

Capture DNS:

```bash
sudo tcpdump -ni any port 53
```

Capture traffic to a host and port:

```bash
sudo tcpdump -ni any host 203.0.113.20 and port 443
```

Write a capture:

```bash
sudo tcpdump -ni any -w capture.pcap host 203.0.113.20
```

Read it later:

```bash
tcpdump -nn -r capture.pcap
```

Use `-nn` to avoid DNS and service-name resolution while inspecting packets.

Packet captures may contain credentials, identifiers, and sensitive data. Handle them accordingly.

---
## Practical Troubleshooting Flow

Do not start with random commands. Move through the path in order.

```text
1. Name
2. Address
3. Route
4. Port
5. TLS
6. HTTP
7. Application
8. Dependency
```

### 1. Confirm the exact target

Record:

```text
hostname
port
protocol
path
source machine
time of failure
expected result
actual result
```

`api.example.com:443` is not enough when the failing request is:

```text
POST /v1/jobs
```

### 2. Check DNS

```bash
dig +short api.example.com
resolvectl query api.example.com
```

Ask:

- Did it resolve?
- Did it return the expected address?
- Do affected and healthy machines use different resolvers?
- Is IPv6 returned?
- Is there split DNS between internal and external networks?

### 3. Check the route

```bash
ip route get 203.0.113.20
```

Ask:

- Which interface is used?
- Which source IP is selected?
- Is the expected gateway used?
- Is a VPN changing the route?

### 4. Check the destination port

```bash
nc -vz api.example.com 443
```

Interpret carefully:

| Result | Likely Meaning |
|---|---|
| succeeded | TCP connection established |
| refused | host reachable, but port rejected or not listening |
| timed out | traffic silently dropped, path broken, or service unable to respond |
| name resolution failed | DNS problem before TCP |

### 5. Check TLS

```bash
openssl s_client \
  -connect api.example.com:443 \
  -servername api.example.com
```

Ask:

- Is the certificate for the right hostname?
- Is the chain complete?
- Is the certificate valid now?
- Was a client certificate requested?
- Which protocol and cipher were negotiated?

### 6. Check HTTP

```bash
curl -v https://api.example.com/health
```

Ask:

- Which status code returned?
- Which server generated it?
- Was there a redirect?
- Were authentication headers sent?
- Did the response take a long time before the first byte?
- Is the body an application error?

### 7. Check the serving process

On the server:

```bash
ss -lntp
systemctl status my-service
journalctl -u my-service --since '15 minutes ago'
```

Ask:

- Is the service running?
- Is it listening on the correct address?
- Is it bound only to `127.0.0.1`?
- Is the proxy configured for the correct upstream port?
- Did it restart or run out of resources?

### 8. Check dependencies

```text
application
  |
  +-> database
  +-> object storage
  +-> identity provider
  +-> message queue
  +-> another API
```

A healthy listener can still return `500`, `502`, or `504` because a dependency failed.

---
## Symptom Playbooks

### Domain does not resolve

```bash
dig api.example.com
dig @1.1.1.1 api.example.com
resolvectl status
```

Check:

- spelling;
- configured resolver;
- search domains;
- VPN or corporate DNS;
- `A` vs `AAAA`;
- `NXDOMAIN` vs `SERVFAIL`;
- recent record changes and TTL;
- `/etc/hosts`.

### Connection refused

```bash
nc -vz host 443
ss -lntp
```

Likely causes:

- service is stopped;
- service listens on another port;
- service is bound to loopback only;
- container port is not published;
- load balancer target points to the wrong port;
- firewall actively rejects the connection.

### Connection timeout

```bash
ip route get IP
traceroute IP
nc -vz -w 5 host port
```

Likely causes:

- firewall silently drops traffic;
- security group or network ACL blocks traffic;
- incorrect route;
- VPN conflict;
- dead host;
- overloaded device;
- asymmetric routing;
- return traffic cannot reach the source.

### TLS certificate error

```bash
date
openssl s_client -connect host:443 -servername host
```

Check:

- local clock;
- hostname;
- expiration;
- intermediate certificates;
- trusted CA;
- SNI;
- proxy performing TLS inspection.

### 401 or 403

Check:

- token or cookie was sent;
- token expired;
- issuer and audience are correct;
- required scope or role exists;
- clock skew;
- CSRF policy;
- proxy stripped the `Authorization` header;
- resource belongs to another tenant or project.

### 404

Check:

- hostname;
- path and case sensitivity;
- API version;
- reverse-proxy route;
- resource ID;
- deployment version;
- whether access controls intentionally hide the resource.

### 429

Check:

- rate-limit headers;
- retry policy;
- `Retry-After`;
- concurrency;
- accidental retry storms;
- whether many clients share one credential or source IP.

Use bounded exponential backoff with jitter when the API contract permits retries.

### 502

Check the proxy-to-upstream path:

```text
proxy -> DNS -> upstream IP -> upstream port -> protocol -> response
```

Common causes:

- upstream process stopped;
- wrong port;
- HTTP sent to an HTTPS upstream, or the reverse;
- connection reset;
- invalid upstream response;
- upstream DNS failure;
- proxy cannot reach the target network.

### 503

Check:

- maintenance mode;
- no healthy load-balancer targets;
- overload;
- worker pool exhaustion;
- readiness checks;
- autoscaling delay;
- deployment draining;
- dependency unavailable.

### 504

Check:

- upstream response time;
- proxy timeout;
- database query time;
- downstream API timeout;
- connection-pool exhaustion;
- queue delay;
- retry multiplication.

Increasing a timeout may hide the symptom while making resource exhaustion worse. Find where the time is spent first.

### Slow request

Measure the phases:

```bash
curl -sS -o /dev/null \
  -w 'dns=%{time_namelookup} connect=%{time_connect} tls=%{time_appconnect} first_byte=%{time_starttransfer} total=%{time_total}\n' \
  https://example.com/
```

| Slow Phase | Investigate |
|---|---|
| DNS | resolver latency, cache misses, DNS failure retries |
| connect | route, packet loss, firewall, overloaded listener |
| TLS | handshake latency, certificate path, crypto load |
| first byte | application, queue, database, dependencies |
| body transfer | bandwidth, congestion, packet loss, large response |

---
## Containers and Kubernetes

A few recurring networking mistakes:

### Bind address

Inside a container:

```text
127.0.0.1:8080
```

usually accepts connections only from that container's loopback interface.

For traffic from outside the container, the service commonly needs to bind to:

```text
0.0.0.0:8080
```

or the appropriate container interface.

### Exposed is not published

A container image declaring a port does not necessarily publish it to the host.

Inspect:

```bash
docker ps
podman ps
```

Run with a mapping:

```bash
docker run -p 8080:8080 image
```

This maps:

```text
host port 8080 -> container port 8080
```

### Kubernetes path

A simplified path:

```text
Client
  |
Ingress / Gateway
  |
Service
  |
Endpoint / Pod IP
  |
Container port
```

Useful checks:

```bash
kubectl get ingress
kubectl get svc
kubectl get endpoints
kubectl get pods -o wide
kubectl describe svc SERVICE
kubectl logs POD
```

Common failures:

- Service selector matches no pods;
- target port is wrong;
- pod is not Ready;
- application binds only to loopback;
- NetworkPolicy blocks traffic;
- Ingress route or hostname is wrong;
- TLS secret is wrong;
- readiness path returns failure.

---
## Interview Questions and Traps

| Question | Useful Answer |
|---|---|
| TCP vs UDP? | TCP provides a reliable ordered byte stream. UDP provides best-effort datagrams with lower built-in overhead. |
| What happens when you open a website? | DNS resolution, routing, transport connection, TLS for HTTPS, HTTP request, proxy/application processing, HTTP response. |
| 401 vs 403? | Authentication required or invalid vs access denied. |
| 502 vs 504? | Invalid/failed upstream response vs upstream response timeout. |
| HTTP vs HTTPS? | HTTPS protects HTTP traffic with TLS; HTTP semantics remain HTTP. |
| Why can ping fail while HTTPS works? | ICMP may be filtered while TCP or QUIC on port 443 is allowed. |
| Why can DNS use TCP? | Large or truncated responses, zone transfer, and other cases require or use TCP. |
| Is UDP unreliable? | UDP itself provides no delivery guarantee; protocols built over it can add reliability. |
| Is a JWT encrypted? | Not normally. A standard signed JWT protects integrity, not confidentiality. |
| Does TCP preserve messages? | No. It preserves an ordered byte stream, so applications need framing. |
| Is NAT a firewall? | No. NAT rewrites addresses; firewall policy permits or denies traffic. |
| Is DELETE idempotent? | Its intended effect is idempotent, although repeated response codes may differ. |
| Is HTTP/3 just unreliable HTTP over UDP? | No. It uses QUIC, which adds reliable streams, congestion control, flow control, and TLS. |
| Does a successful TCP handshake prove the application works? | No. It only proves the transport connection was accepted. |
| Does `404` prove the resource never existed? | No. It may be absent, routed incorrectly, or intentionally hidden. |

### Common bad answers

```text
Bad:  UDP is always faster.
Better: UDP has less built-in transport machinery; application behaviour and network conditions determine performance.

Bad:  4xx means the user made a mistake.
Better: 4xx means the server classifies the request as a client-side request problem.

Bad:  503 means the server is down.
Better: The service is currently unavailable; causes include overload, maintenance, or no healthy targets.

Bad:  HTTPS hides everything.
Better: TLS protects application data between TLS endpoints, but does not hide every piece of metadata or protect compromised endpoints.

Bad:  ping proves the server is healthy.
Better: ping tests ICMP echo behaviour, not the application protocol.
```

---
## The Small Set Worth Memorising

### Network path

```text
DNS -> IP -> route -> port -> TLS -> HTTP -> application
```

### TCP handshake

```text
SYN -> SYN-ACK -> ACK
```

### TCP vs UDP

```text
TCP = reliable ordered byte stream
UDP = best-effort datagrams
```

### HTTP classes

```text
1 = wait
2 = done
3 = go
4 = you
5 = me
```

### Authentication

```text
401 = authenticate
403 = denied
```

### Gateway failures

```text
502 = bad upstream response
503 = service unavailable
504 = upstream timeout
```

### Essential commands

```bash
dig example.com
ip route get 203.0.113.20
nc -vz example.com 443
openssl s_client -connect example.com:443 -servername example.com
curl -v https://example.com/
ss -lntp
tcpdump -ni any host 203.0.113.20
```

### Final debugging rule

> Test the protocol that is actually failing, and move through the layers in order.

Do not use `ping` alone to diagnose HTTPS.
Do not use a status code alone to diagnose an application.
Do not increase a timeout before finding where the time went.
