---
title: "Networking, But Only the Useful Stuff"
date: 2026-07-30
description: "Practical Linux commands for inspecting interfaces, routes, DNS, sockets, TLS, HTTP, LAN devices, packet flow, and common network failures."
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

Most network problems become easier once you stop treating **the network** as one thing.

A request to:

```text
https://api.example.com/users
```

crosses several separate boundaries:

```text
local interface
  ↓
DNS
  ↓
route and next hop
  ↓
TCP or UDP
  ↓
TLS
  ↓
HTTP
  ↓
application
```

A practical troubleshooting order is:

```text
local state
→ name resolution
→ route
→ reachability
→ port
→ TLS
→ HTTP
→ application
```

Find the last boundary that worked. Start there.

---

## Diagnostic Workflow

### 1. Inspect local state

```bash
ip -br addr
ip route
resolvectl status
```

### 2. Resolve the name

```bash
getent hosts host
dig host
```

### 3. Check the selected route

```bash
ip route get IP
```

### 4. Test reachability carefully

```bash
ping -c 3 host
traceroute host
```

Remember that ICMP may be filtered.

### 5. Test the real port

```bash
nc -vz host port
```

When a proxy is configured, test the proxy's address and port as well as the destination path.

### 6. Check proxy configuration

```bash
env | grep -i proxy
curl -v --noproxy '*' https://host/path
```

### 7. Inspect TLS

```bash
openssl s_client \
  -connect host:443 \
  -servername host
```

### 8. Inspect HTTP

```bash
curl -v https://host/path
```

### 9. Inspect the server

```bash
sudo ss -lntp
systemctl status service-name
```

### 10. Capture packets

```bash
sudo tcpdump -ni any host IP and port PORT
```

Find the last stage that succeeded. Start investigating at the next boundary.

---

> Older systems may still use `route`, `arp`, `nslookup`, or `telnet`.
> On modern Linux, prefer `ip`, `dig` or `getent`, and `nc`.

## Interfaces & Addresses

| Command | Use |
|---|---|
| `ip addr` | show all interfaces and addresses |
| `ip -br addr` | compact interface and address summary |
| `ip link` | inspect link state and MAC addresses |
| `ip addr show eth0` | inspect one interface |
| `hostname -I` | print assigned IP addresses |
| `ip -s link` | show interface counters and errors |
| `ethtool eth0` | inspect physical link details |
| `nmcli device status` | show NetworkManager device state |
| `nmcli connection show` | show configured connections |

### Compact view

```bash
ip -br addr
```

Example:

```text
lo       UNKNOWN  127.0.0.1/8 ::1/128
eth0     UP       192.168.1.20/24
docker0  DOWN     172.17.0.1/16
```

| State | Meaning |
|---|---|
| `UP` | interface is enabled |
| `DOWN` | interface is disabled |
| `UNKNOWN` | common for loopback or virtual interfaces |
| `LOWER_UP` | underlying link is available |

### Useful addresses

| Address | Meaning |
|---|---|
| `127.0.0.1` | IPv4 loopback |
| `::1` | IPv6 loopback |
| `0.0.0.0` | all IPv4 interfaces when used as a listener |
| `::` | all IPv6 interfaces when used as a listener |

### Prefixes

```text
192.168.1.20/24
```

The `/24` describes the network prefix.

A practical interpretation:

```text
network: 192.168.1.0/24
typical host range: 192.168.1.1–192.168.1.254
```

### Inspect counters

```bash
ip -s link show eth0
```

Look for:

- RX errors
- TX errors
- dropped packets
- overruns
- carrier errors

A rising error count can indicate bad cabling, driver problems, duplex or link issues, overloaded interfaces, or virtual-network problems.

---

## Routes & Gateways

| Command | Use |
|---|---|
| `ip route` | show the routing table |
| `ip route get 8.8.8.8` | show the route Linux would use |
| `ip rule` | show policy-routing rules |
| `ip route show table all` | show all routing tables |
| `tracepath host` | inspect path and MTU clues |

### Routing table

```bash
ip route
```

Example:

```text
default via 192.168.1.1 dev wlan0
192.168.1.0/24 dev wlan0 scope link src 192.168.1.20
```

| Field | Meaning |
|---|---|
| `default` | fallback route |
| `via` | next-hop gateway |
| `dev` | outgoing interface |
| `src` | preferred source address |
| `scope link` | directly reachable network |

### Inspect one destination

```bash
ip route get 203.0.113.42
```

Example:

```text
203.0.113.42 via 192.168.1.1 dev wlan0 src 192.168.1.20
```

This answers:

- which interface,
- which source address,
- which next hop.

It does not prove that the destination is reachable.

### Longest-prefix match

Linux normally chooses the most specific matching route.

```text
default via 192.168.1.1
10.0.0.0/8 via 192.168.1.2
10.20.0.0/16 via 192.168.1.3
```

Traffic for `10.20.4.5` uses the `/16` route because it is more specific than `/8`.

---

## Neighbours, ARP & MAC

| Command | Use |
|---|---|
| `ip neigh` | show known neighbours |
| `ip neigh show dev eth0` | show neighbours for one interface |
| `arping 192.168.1.1` | test local ARP reachability |
| `arp-scan --localnet` | discover local IPv4 devices |

### Neighbour table

```bash
ip neigh
```

Example:

```text
192.168.1.1 dev wlan0 lladdr 00:11:22:33:44:55 REACHABLE
192.168.1.40 dev wlan0 lladdr aa:bb:cc:dd:ee:ff STALE
```

| State | Meaning |
|---|---|
| `REACHABLE` | recently confirmed |
| `STALE` | known, but not recently confirmed |
| `DELAY` | waiting before reprobe |
| `PROBE` | actively checking |
| `FAILED` | neighbour resolution failed |
| `INCOMPLETE` | resolution still in progress |

### Practical model

IP tells Linux the final destination.

MAC tells the local link where to deliver the next frame.

For remote traffic:

```text
final IP: 203.0.113.42
next-hop MAC: gateway's MAC
```

ARP does not cross routers. It only resolves IPv4 addresses on the local broadcast domain.

IPv6 uses Neighbor Discovery instead of ARP; Linux still exposes those neighbours through `ip neigh`.

---

## DNS

| Command | Use |
|---|---|
| `dig host` | full DNS response |
| `dig +short host` | addresses only |
| `dig host A` | IPv4 records |
| `dig host AAAA` | IPv6 records |
| `dig host MX` | mail records |
| `dig host TXT` | TXT records |
| `dig @1.1.1.1 host` | query a specific resolver |
| `dig +trace host` | trace delegation from the root |
| `resolvectl query host` | query through systemd-resolved |
| `resolvectl status` | inspect active DNS servers and per-interface DNS |
| `getent hosts host` | use normal system resolution |

### Basic lookup

```bash
dig example.com
```

| Field | Meaning |
|---|---|
| `status: NOERROR` | query completed successfully |
| `NXDOMAIN` | name does not exist |
| `SERVFAIL` | resolver failed to obtain an answer |
| `ANSWER SECTION` | returned records |
| `SERVER` | resolver that answered |
| `Query time` | resolver response time |

### Short output

```bash
dig +short example.com
```

Example:

```text
93.184.216.34
```

### Query a specific resolver

```bash
dig @1.1.1.1 example.com
```

Useful when comparing local DNS, corporate DNS, VPN DNS, and public DNS.

### System resolver versus `dig`

```bash
getent hosts example.com
```

Applications usually use the system resolver. That path may include:

- `/etc/hosts`,
- `/etc/nsswitch.conf`,
- search domains,
- local caching,
- systemd-resolved,
- VPN configuration.

So `dig example.com` may differ from `getent hosts example.com`.

### Inspect resolver configuration

```bash
cat /etc/resolv.conf
resolvectl status
```

Look for active DNS servers, search domains, per-interface DNS, and VPN-provided DNS.

---

## Reachability

| Command | Use |
|---|---|
| `ping host` | test ICMP echo replies |
| `ping -c 3 host` | send three probes |
| `ping -I eth0 host` | use a specific interface |
| `ping -4 host` | force IPv4 |
| `ping -6 host` | force IPv6 |
| `arping host` | test local-link ARP reachability |

### Ping output

```bash
ping -c 3 203.0.113.42
```

Example:

```text
64 bytes from 203.0.113.42: icmp_seq=1 ttl=52 time=21.4 ms
```

| Field | Meaning |
|---|---|
| `icmp_seq` | probe sequence number |
| `ttl` | remaining hop limit |
| `time` | round-trip time |
| `packet loss` | probes without replies |
| `min/avg/max` | latency summary |

### What ping proves

The host returned ICMP echo replies.

### What ping does not prove

It does not prove that TCP port 443 is open, TLS works, HTTP works, or the application is healthy.

A failed ping also does not prove the host is down. Firewalls often block ICMP while allowing application traffic.

---

## Paths & Hops

| Command | Use |
|---|---|
| `traceroute host` | inspect the apparent path |
| `traceroute -n host` | skip reverse DNS |
| `traceroute -T -p 443 host` | use TCP probes to port 443 |
| `tracepath host` | inspect path and MTU clues |
| `mtr host` | continuously measure path and loss |
| `mtr -rw host` | report mode |

### Traceroute

```bash
traceroute 203.0.113.42
```

Example:

```text
1  192.168.1.1      1.0 ms
2  10.20.0.1        5.2 ms
3  * * *
4  198.51.100.14   18.1 ms
5  203.0.113.42    21.0 ms
```

`* * *` means no reply arrived for those probes. It does not necessarily mean the route failed.

Possible causes include ICMP filtering, rate limiting, load balancing, asymmetric routing, and firewalls.

### Use the real service port

```bash
sudo traceroute -T -p 443 example.com
```

A normal traceroute may fail while HTTPS still works. This uses TCP probes toward port 443.

### Continuous path view

```bash
mtr -rw example.com
```

| Column | Meaning |
|---|---|
| `Loss%` | missing replies from that hop |
| `Snt` | probes sent |
| `Last` | latest RTT |
| `Avg` | average RTT |
| `Best` | best RTT |
| `Wrst` | worst RTT |

Loss at one intermediate hop does not always mean forwarded traffic is being lost. If later hops show no loss, the intermediate router may simply be rate-limiting replies.

---

## Ports & Sockets

A port identifies an application endpoint on a host.

A TCP connection is commonly described by:

```text
protocol
local IP
local port
remote IP
remote port
```

Example:

```text
tcp 192.168.1.20:53144 → 203.0.113.42:443
```

### Common ports

| Port | Typical use |
|---|---|
| `22` | SSH |
| `53` | DNS |
| `80` | HTTP |
| `123` | NTP |
| `443` | HTTPS |
| `3306` | MySQL |
| `5432` | PostgreSQL |
| `6379` | Redis |
| `8080` | common alternate HTTP port |

Port numbers are conventions. They do not prove which application is running.

---

## Inspect Local Sockets

| Command | Use |
|---|---|
| `ss -lnt` | listening TCP sockets |
| `ss -lnu` | listening UDP sockets |
| `ss -lntp` | TCP listeners with processes |
| `ss -ntp` | established TCP connections |
| `ss -s` | socket summary |
| `lsof -i` | sockets grouped by process |
| `lsof -nP -iTCP:8080` | process using TCP port 8080 |
| `fuser 8080/tcp` | process using a port |

### Listener view

```bash
sudo ss -lntp
```

Example:

```text
LISTEN 0 4096 0.0.0.0:22      0.0.0.0:* users:(("sshd",pid=821,fd=3))
LISTEN 0  511 127.0.0.1:8080  0.0.0.0:* users:(("nginx",pid=942,fd=6))
```

### Bind-address meaning

| Address | Meaning |
|---|---|
| `127.0.0.1:8080` | loopback only |
| `192.168.1.20:8080` | one specific interface |
| `0.0.0.0:8080` | all IPv4 interfaces |
| `[::]:8080` | all IPv6 interfaces |

A common failure is that a service works on localhost but fails remotely. Check whether it is bound only to `127.0.0.1`.

### Established connections

```bash
ss -ntp
```

Example:

```text
ESTAB 0 0 192.168.1.20:53144 203.0.113.42:443
```

Read it as:

```text
client: 192.168.1.20:53144
server: 203.0.113.42:443
```

The client port is usually temporary.

---

## TCP

TCP provides a connection, reliable delivery, ordered bytes, retransmission, flow control, and congestion control.

A simplified handshake:

```text
Client                    Server

SYN       ------------>

          <------------  SYN-ACK

ACK       ------------>
```

### Useful TCP states

| State | Meaning |
|---|---|
| `LISTEN` | waiting for new connections |
| `SYN-SENT` | client sent SYN |
| `SYN-RECV` | SYN received, handshake incomplete |
| `ESTAB` | connection established |
| `FIN-WAIT-1` | closing started |
| `TIME-WAIT` | closed connection retained temporarily |
| `CLOSE-WAIT` | peer closed, local process has not finished |

### Many `SYN-SENT`

Possible causes:

- firewall drops,
- unreachable service,
- no SYN-ACK,
- route problems.

### Many `CLOSE-WAIT`

Often means the remote side closed, but the local application did not close its socket.

### Many `TIME-WAIT`

Not automatically a problem. It is normal after active TCP closes. Investigate only if it causes resource or port exhaustion.

---

## UDP

UDP is connectionless at the transport layer, message-oriented, best effort, and low overhead.

UDP does not guarantee delivery, ordering, retransmission, or duplicate suppression.

Applications can add those properties themselves. QUIC is an important example.

```text
TCP
reliable, ordered byte stream

UDP
best-effort datagrams with message boundaries
```

### Inspect UDP sockets

```bash
sudo ss -lnup
```

UDP often appears as `UNCONN`. That does not mean broken. UDP sockets do not require a TCP-style established state.

---

## Test Remote Ports

| Command | Use |
|---|---|
| `nc -vz host 443` | test one TCP port |
| `nc -vzu host 53` | test one UDP port |
| `timeout 5 bash -c '</dev/tcp/host/443'` | Bash TCP test |
| `curl host:port` | test an HTTP-like service |

### Netcat

```bash
nc -vz example.com 443
```

Success:

```text
Connection to example.com 443 port [tcp/https] succeeded!
```

This proves a TCP connection was accepted. It does not prove TLS, certificate verification, HTTP, or application health.

For UDP, `nc -vzu host 53` is weaker evidence. UDP has no connection handshake, and some Netcat versions report success when no immediate rejection arrives. Use a protocol-specific request, Nmap, or packet capture when the distinction matters.

### Connection refused

```text
Connection refused
```

The host replied, but the port did not accept the connection.

Common causes:

- no listener,
- listener stopped,
- reject rule,
- wrong address or port.

### Timeout

```text
Operation timed out
```

No usable TCP response arrived.

Possible causes:

- silent firewall,
- routing issue,
- unreachable host,
- security group,
- overloaded service.

---

## Proxies

A request may be sent through a proxy instead of directly to the destination.

| Command | Use |
|---|---|
| `env | grep -i proxy` | inspect proxy environment variables |
| `curl -v -x http://proxy:3128 URL` | use an explicit proxy |
| `curl --noproxy '*' URL` | bypass configured proxies |
| `curl --noproxy host URL` | bypass the proxy for one host |

### Inspect proxy configuration

```bash
env | grep -iE '^(http|https|all|no)_proxy='
```

Common variables:

```text
HTTP_PROXY
HTTPS_PROXY
ALL_PROXY
NO_PROXY
```

Variable names may also be lowercase.

### Compare proxied and direct access

```bash
curl -v https://example.com/
curl -v --noproxy '*' https://example.com/
```

For HTTPS through an HTTP proxy, verbose output may show:

```text
CONNECT example.com:443 HTTP/1.1
```

The proxy first creates a tunnel to the destination. A request can therefore fail at the proxy before it ever reaches the server.

### Use an explicit proxy

```bash
curl -v \
  -x http://proxy.example.com:3128 \
  https://example.com/
```

Check:

- proxy name resolution,
- proxy reachability,
- proxy authentication,
- `NO_PROXY` matching,
- whether direct access behaves differently.

---

## TLS Inspection

| Command | Use |
|---|---|
| `openssl s_client -connect host:443` | inspect TLS connection |
| `openssl s_client -connect host:443 -servername host` | include SNI |
| `openssl s_client -showcerts ...` | show certificate chain |
| `openssl x509 -noout -text` | inspect a certificate |
| `openssl x509 -noout -dates` | show validity dates |
| `openssl x509 -noout -subject -issuer` | show subject and issuer |

### Connect with SNI

```bash
openssl s_client \
  -connect example.com:443 \
  -servername example.com
```

| Field | Meaning |
|---|---|
| `CONNECTED` | TCP connection succeeded |
| `Certificate chain` | certificates presented |
| `subject` | certificate identity |
| `issuer` | signing CA |
| `TLSv1.3` | negotiated version |
| `Cipher` | negotiated cipher suite |
| `Verify return code: 0` | chain verification succeeded |

### Why `-servername` matters

Many hosts share one IP. SNI tells the server which hostname you want. Without it, the server may return the wrong certificate.

### Inspect certificate dates

```bash
openssl s_client \
  -connect example.com:443 \
  -servername example.com </dev/null 2>/dev/null |
openssl x509 -noout -dates
```

---

## HTTP Inspection

| Command | Use |
|---|---|
| `curl URL` | make a request |
| `curl -v URL` | inspect DNS, TCP, TLS, and HTTP |
| `curl -I URL` | send a HEAD request |
| `curl -i URL` | include response headers |
| `curl -L URL` | follow redirects |
| `curl -sS URL` | quiet output but keep errors |
| `curl --resolve host:443:IP URL` | force a hostname to one IP |
| `curl --connect-timeout 5 URL` | limit connection time |
| `curl --max-time 20 URL` | limit total request time |
| `curl -o /dev/null URL` | discard body |

### Verbose request

```bash
curl -v https://example.com/
```

| Prefix | Meaning |
|---|---|
| `*` | curl commentary |
| `>` | request sent |
| `<` | response received |

Example:

```text
* Host example.com:443 was resolved.
*   Trying 93.184.216.34:443...
* Connected to example.com
* SSL connection using TLSv1.3

> GET / HTTP/1.1
> Host: example.com

< HTTP/1.1 200 OK
< Content-Type: text/html
```

This gives one compact view of DNS, TCP, TLS, the HTTP request, and the HTTP response.

### Force one IP

```bash
curl --resolve example.com:443:203.0.113.42 \
  https://example.com/
```

Useful when DNS points to several backends, when testing one load-balancer node, or when bypassing DNS without breaking TLS hostname checks.

### HTTP timing

```bash
curl -sS -o /dev/null \
  -w 'dns=%{time_namelookup}
connect=%{time_connect}
tls=%{time_appconnect}
first_byte=%{time_starttransfer}
total=%{time_total}\n' \
  https://example.com
```

| Metric | Meaning |
|---|---|
| `time_namelookup` | DNS completed |
| `time_connect` | TCP connection completed |
| `time_appconnect` | TLS completed |
| `time_starttransfer` | first response byte arrived |
| `time_total` | full request completed |

These values are cumulative from the start of the request. Compare the differences between them:

```text
DNS time
= time_namelookup

TCP time
= time_connect - time_namelookup

TLS time
= time_appconnect - time_connect

Server wait after TLS
= time_starttransfer - time_appconnect
```

A large gap points to the boundary that consumed the time.

---

## LAN Discovery

Only scan systems and networks you own or are explicitly authorised to inspect.

| Command | Use |
|---|---|
| `ip route` | identify the local prefix |
| `ip neigh` | show already-known neighbours |
| `nmap -sn 192.168.1.0/24` | discover responding hosts |
| `arp-scan --localnet` | discover local IPv4 devices |
| `nmap -R -sn subnet` | attempt reverse DNS |

### Find the LAN prefix

```bash
ip route
```

Look for:

```text
192.168.1.0/24 dev wlan0
```

Then:

```bash
sudo nmap -sn 192.168.1.0/24
```

### ARP discovery

```bash
sudo arp-scan --localnet
```

Typical output:

```text
192.168.1.1   00:11:22:33:44:55   Router Vendor
192.168.1.40  aa:bb:cc:dd:ee:ff   Printer Vendor
```

ARP discovery is effective on the local link. It does not cross routers.

### Important distinction

```bash
ip neigh
```

shows what Linux already knows.

```bash
nmap -sn
```

actively discovers hosts.

```bash
arp-scan
```

actively discovers local IPv4 neighbours using ARP.

---

## Port Scanning

Only scan authorised systems.

| Command | Use |
|---|---|
| `nmap host` | scan common TCP ports |
| `nmap -p 22,80,443 host` | selected ports |
| `nmap -p- host` | all TCP ports |
| `nmap -sV host` | service detection |
| `nmap -sU host` | UDP scan |
| `nmap --open host` | show open ports only |
| `nmap -Pn host` | skip host discovery |
| `nmap -T4 host` | faster timing on reliable networks |

### Common TCP ports

```bash
nmap 192.168.1.40
```

Example:

```text
PORT     STATE SERVICE
80/tcp   open  http
443/tcp  open  https
9100/tcp open  jetdirect
```

### Port states

| State | Meaning |
|---|---|
| `open` | service accepted the probe |
| `closed` | host responded, but no service accepted |
| `filtered` | filtering prevented a conclusion |
| `open\|filtered` | common ambiguous UDP result |

### Scan all TCP ports

```bash
nmap -p- 192.168.1.40
```

`-p-` means ports 1 through 65535.

### Service detection

```bash
sudo nmap -sV 192.168.1.40
```

This is an estimate based on probes. It is not absolute proof.

### UDP scan

```bash
sudo nmap -sU -p 53,123,161 192.168.1.40
```

UDP scanning is slower and more ambiguous because UDP has no handshake.

---

## Packet Capture

`tcpdump` answers questions that higher-level tools cannot:

- Did the packet leave?
- Did the reply return?
- Is TCP retransmitting?
- Was DNS queried?
- Is TLS traffic present?
- Which interface carried the traffic?

| Command | Use |
|---|---|
| `tcpdump -ni any` | capture on all interfaces |
| `tcpdump -ni eth0` | capture on one interface |
| `tcpdump -ni eth0 host 203.0.113.42` | filter one host |
| `tcpdump -ni eth0 port 443` | filter one port |
| `tcpdump -ni eth0 tcp` | TCP only |
| `tcpdump -ni eth0 udp` | UDP only |
| `tcpdump -ni eth0 icmp` | ICMP only |
| `tcpdump -w capture.pcap` | save capture |
| `tcpdump -r capture.pcap` | read saved capture |

### Basic capture

```bash
sudo tcpdump -ni any host 203.0.113.42
```

| Option | Meaning |
|---|---|
| `-n` | no name resolution |
| `-i` | interface |
| `-v` | more detail |
| `-A` | ASCII payload |
| `-X` | hex and ASCII |
| `-c 20` | stop after 20 packets |
| `-w file.pcap` | save raw capture |

### Capture DNS

```bash
sudo tcpdump -ni any port 53
```

### Capture HTTPS traffic

```bash
sudo tcpdump -ni any host 203.0.113.42 and port 443
```

You usually cannot read encrypted HTTP content, but you can still see the TCP handshake, packet sizes, retransmissions, resets, and connection timing.

### SYN packets

```bash
sudo tcpdump -ni any 'tcp[tcpflags] & tcp-syn != 0'
```

### Reset packets

```bash
sudo tcpdump -ni any 'tcp[tcpflags] & tcp-rst != 0'
```

### Save for Wireshark

```bash
sudo tcpdump -ni any -w capture.pcap
```

---

## Firewalls

| Command | Use |
|---|---|
| `sudo nft list ruleset` | inspect nftables |
| `sudo iptables -L -n -v` | inspect legacy iptables rules |
| `sudo iptables -t nat -L -n -v` | inspect legacy iptables NAT rules |
| `sudo ufw status verbose` | inspect UFW |
| `sudo firewall-cmd --list-all` | inspect firewalld |

### Drop versus reject

```text
DROP
```

Silently discard traffic. Often appears as a timeout.

```text
REJECT
```

Actively return an error. Often appears as connection refused or unreachable.

---

## Containers & Network Namespaces

A process inside a container may see different interfaces, routes, DNS, and bind addresses from the host.

### Docker

```bash
docker exec -it container sh
ip -br addr
ip route
cat /etc/resolv.conf
ss -lntp
```

### Kubernetes

```bash
kubectl exec -it pod -- sh
kubectl get pod -o wide
kubectl get svc
```

A connection that works on the host may still fail inside a container because it runs in a different network namespace.

---

## Common Failure Patterns

### Name resolves, but connection times out

Check:

```bash
ip route get "$ip"
nc -vz -w 5 "$host" 443
sudo traceroute -T -p 443 "$host"
sudo tcpdump -ni any host "$ip" and port 443
```

Likely areas:

- routing,
- firewall,
- security group,
- unavailable service,
- wrong destination IP.

### Connection refused

The host responded, but the port rejected the connection.

On the server:

```bash
sudo ss -lntp
systemctl status service-name
```

Check the service, port, bind address, and reject rules.

### Works on localhost, not remotely

Check:

```bash
sudo ss -lntp
```

If you see:

```text
127.0.0.1:8080
```

the service listens only on loopback.

For remote access, it may need to bind to `0.0.0.0:8080` or a specific non-loopback address. Do not expose services broadly unless intended and secured.

### DNS works with `dig`, but the application fails

Compare:

```bash
dig host
getent hosts host
resolvectl query host
```

Inspect:

```bash
cat /etc/hosts
cat /etc/resolv.conf
resolvectl status
```

Possible causes include system-resolver differences, search domains, VPN DNS, stale caches, `/etc/hosts` overrides, and IPv4 versus IPv6 behavior.

### Works with `--noproxy`, fails normally

Compare:

```bash
curl -v https://host/
curl -v --noproxy '*' https://host/
```

Inspect:

```bash
env | grep -i proxy
```

Likely areas:

- incorrect proxy address,
- proxy authentication,
- destination blocked by the proxy,
- incorrect `NO_PROXY` matching,
- proxy DNS or routing failure.

### TCP works, TLS fails

```bash
openssl s_client \
  -connect host:443 \
  -servername host
```

Look for an expired certificate, wrong hostname, incomplete chain, unsupported TLS version, wrong SNI, or incorrect system time.

### TLS works, HTTP fails

```bash
curl -v https://host/path
```

Possible causes:

- wrong path,
- wrong `Host` header,
- authentication,
- proxy routing,
- application error,
- upstream timeout.

| Status | Meaning |
|---|---|
| `400` | malformed request |
| `401` | authentication required |
| `403` | request understood but denied |
| `404` | resource not found |
| `429` | rate limited |
| `500` | application error |
| `502` | bad upstream response |
| `503` | service unavailable |
| `504` | upstream timeout |

### Service is listening, but Nmap says filtered

Possible causes:

- host firewall,
- network firewall,
- security group,
- container port not published,
- listener bound to another interface,
- VLAN or subnet isolation.

Check:

```bash
sudo ss -lntp
sudo nft list ruleset
sudo tcpdump -ni any port 443
```

### Intermittent connection problems

Use repeated measurements:

```bash
mtr -rw host
ping -c 50 host
curl -sS -o /dev/null -w '%{time_total}\n' https://host/
```

Inspect packet loss, latency spikes, retransmissions, DNS variation, multiple backend IPs, and load-balancer behavior.

### IPv4 works, IPv6 fails

Compare:

```bash
curl -4 -v https://host/
curl -6 -v https://host/
```

DNS:

```bash
dig host A
dig host AAAA
```

Routes:

```bash
ip -4 route
ip -6 route
```

Do not assume both protocols follow the same path or firewall rules.

---

## Command Cheat Sheet

### Interfaces

```bash
ip -br addr
ip link
ip -s link
ethtool eth0
```

### Routing

```bash
ip route
ip route get <ip>
ip rule
```

### Neighbours

```bash
ip neigh
arping <local-ip>
arp-scan --localnet
```

### DNS

```bash
dig host
dig +short host
dig @1.1.1.1 host
getent hosts host
resolvectl status
```

### Reachability

```bash
ping -c 3 host
traceroute host
traceroute -T -p 443 host
mtr -rw host
```

### Local sockets

```bash
sudo ss -lntp
sudo ss -lnup
ss -ntp
sudo lsof -nP -iTCP:8080
sudo fuser -v 8080/tcp
```

### Remote ports

```bash
nc -vz host port
nmap host
nmap -p- host
nmap -sV host
nmap -sU host
```

### Proxies

```bash
env | grep -i proxy
curl -v -x http://proxy:3128 https://host/
curl -v --noproxy '*' https://host/
```

### TLS

```bash
openssl s_client \
  -connect host:443 \
  -servername host
```

### HTTP

```bash
curl -v https://host/
curl -I https://host/
curl --resolve host:443:IP https://host/
```

### Packet capture

```bash
sudo tcpdump -ni any
sudo tcpdump -ni any host IP
sudo tcpdump -ni any port 443
sudo tcpdump -ni any -w capture.pcap
```

### Firewalls

```bash
sudo nft list ruleset
sudo iptables -L -n -v
sudo ufw status verbose
```
---

The useful question is rarely:

> Is the network broken?

It is:

> What was the last boundary that worked?

Start there.

