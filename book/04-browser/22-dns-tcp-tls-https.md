# Session 22 — DNS, TCP, TLS, and HTTPS

> **Module 4 — Browser.** Session 1 of 5.
> **Chain:** DNS resolution (four-level lookup hierarchy, TTLs, DoH/DoT) → TCP (three-way handshake, RTT cost, Keep-Alive, TCP Fast Open) → TLS 1.3 (1-RTT handshake, 0-RTT tradeoff, identity/encryption/integrity) → HTTPS (certificate chain, HSTS, downgrade prevention).
> This session begins Module 4. Session 23 continues with HTTP/1.1 → HTTP/2 → HTTP/3.

<!-- Module 4 convention: This module covers browser internals and networking
protocols. Protocol flows, timing diagrams, and packet sequences are
ILLUSTRATIVE — syntactically valid and mentally traced but not executed in a
runtime environment. Spec-level claims are verified against RFC 8446 (TLS 1.3),
RFC 9114 (HTTP/3), and MDN for browser-observable behavior. Where a claim
couldn't be verified inline, it's marked with <!-- VERIFY -->. This convention
applies to Sessions 22-26. -->

---

## Topic 1 — DNS Resolution

### Part 1: Theory

DNS (Domain Name System) translates human-readable domain names into IP addresses. The junior answer stops there. The senior answer knows there are four distinct levels of resolution, each with its own caching behavior, and that understanding the hierarchy is what lets you diagnose slow page loads, explain why DNS propagation takes time, and reason about privacy implications of DNS queries.

**Level 1: Browser cache.** The browser maintains its own DNS cache, separate from the OS. Chrome's cache holds entries for a duration derived from the record's TTL, capped at a browser-imposed maximum (typically around 60 seconds for entries with very high TTLs). When you type a URL, the browser checks its cache first — if the entry exists and hasn't expired, no network request happens at all. This is why the second visit to a site is faster than the first.

**Level 2: OS cache.** If the browser cache misses, the request goes to the operating system's DNS resolver (on macOS this is `mDNSResponder`, on Windows the DNS Client service, on Linux `systemd-resolved` or `nscd`). The OS cache works the same way — TTL-based, typically holding entries for the record's specified TTL. Applications other than the browser also use this cache, so a DNS lookup from a terminal or another application can warm the OS cache before the browser even asks.

**Level 3: Recursive resolver.** If both caches miss, the OS sends a query to the recursive resolver — typically your ISP's resolver, or a public resolver like `8.8.8.8` (Google) or `1.1.1.1` (Cloudflare). The recursive resolver maintains its own cache (again, TTL-based) and is responsible for walking the authoritative name server chain if it doesn't have a cached answer. This is where most DNS resolution actually happens for first-time visitors.

**Level 4: Authoritative name servers.** The recursive resolver queries the authoritative hierarchy in order: root name servers (there are 13 root server clusters, identified as `a.root-servers.net` through `m.root-servers.net`), then TLD name servers (`.com`, `.org`, `.net`, etc.), then the authoritative name server for the specific domain (managed by the domain owner, often through a DNS provider like Cloudflare, Route 53, or DigitalOcean). Each level returns a referral to the next — the root server points to the TLD server, the TLD server points to the authoritative server, and the authoritative server returns the actual IP address.

**TTLs at each level.** Every DNS record has a Time To Live — a number of seconds that caches should hold the entry before re-querying. The authoritative server is the source of truth for the TTL value. Caches at every level (browser, OS, recursive resolver) honor this TTL, though browsers may cap very long TTLs. When you change a DNS record (pointing a domain to a new IP), the old value persists in every cache until its TTL expires. This is why DNS propagation takes time — it's not instantaneous propagation, it's waiting for caches to expire. A record with a 300-second TTL propagates within 5 minutes; a record with an 86400-second (24-hour) TTL can take up to 24 hours.

**DNS over HTTPS (DoH) and DNS over TLS (DoT).** Traditional DNS queries travel as plain UDP (or TCP for large responses) — anyone on the network path can see which domains you're resolving. DoH wraps DNS queries in HTTPS (port 443), making them indistinguishable from regular HTTPS traffic. DoT wraps DNS queries in TLS (port 853), encrypting them but leaving them identifiable as DNS traffic. Both prevent eavesdropping on DNS queries. The tradeoff: DoH blends DNS into HTTPS traffic, making it harder for network administrators to monitor or filter DNS queries; DoT is easier to manage in enterprise environments because it uses a dedicated port.

---

### Part 2: Interview Answer

DNS resolution happens at four levels, and understanding the hierarchy is what separates a senior answer from "DNS turns domain names into IP addresses."

First, the browser checks its own cache. Entries are held for a duration derived from the record's TTL, capped by the browser. If the entry exists and hasn't expired, there's no network request. Second, on a cache miss, the OS checks its resolver cache — the same TTL-based mechanism, shared across all applications on the machine. Third, if both caches miss, the OS sends the query to the recursive resolver, typically your ISP's resolver or a public one like `8.8.8.8`. The recursive resolver maintains its own cache and walks the authoritative hierarchy if needed. Fourth, the authoritative chain: root servers point to TLD servers, TLD servers point to the domain's authoritative name server, and that server returns the IP address.

Every level caches based on the record's TTL. When you change a DNS record, the old value persists in caches until TTL expiry — that's why propagation isn't instant. A 5-minute TTL propagates in 5 minutes; a 24-hour TTL can take a full day. The authoritative server is the source of truth for the TTL value, and caches at every level honor it.

The privacy angle matters for interviews. Traditional DNS queries are plain text — anyone on the network path sees which domains you're resolving. DNS over HTTPS wraps queries in HTTPS on port 443, making them indistinguishable from regular web traffic. DNS over TLS wraps them in TLS on port 853, encrypted but identifiable as DNS. Both prevent eavesdropping. DoH is harder for network administrators to filter because it looks like HTTPS; DoT is easier to manage in enterprise environments because it uses a dedicated port. The senior answer to "what's wrong with DNS?" names the plain-text exposure and knows DoH and DoT as the mitigations.

---

### Part 3: Whiteboard / Live Coding

**Full DNS resolution for a first-time visitor to `https://example.com`:**

```
Browser                    OS Resolver            Recursive Resolver       Root Server         TLD Server (.com)     Auth NS
  |                            |                         |                    |                    |                    |
  |-- check cache: miss ------>|                         |                    |                    |                    |
  |                            |-- check cache: miss --->|                    |                    |                    |
  |                            |                         |-- query: example.com?                  |                    |
  |                            |                         |--- referral to .com TLD -------------->|                    |
  |                            |                         |                    |                    |-- referral to auth NS
  |                            |                         |                    |                    |                    |-- A record: 93.184.216.34
  |                            |                         |<-- 93.184.216.34 (TTL=3600) -----------|                    |
  |                            |<-- 93.184.216.34 (TTL=3600) --|              |                    |                    |
  |<-- 93.184.216.34 (TTL=3600) --|                       |                    |                    |                    |
  |                            |                         |                    |                    |                    |
  | [Browser cache: 3600s]     | [OS cache: 3600s]      | [Resolver cache: 3600s]                 |                    |
```

<!-- ILLUSTRATIVE: This shows the four-level hierarchy for a cold query.
The browser cache misses, the OS cache misses, the recursive resolver
queries root → TLD → authoritative in sequence. Each level caches the
result with the TTL from the authoritative server (3600 seconds = 1 hour).
Subsequent queries within that window resolve from cache at whichever
level has a valid entry. -->

**Cache behavior at each level:**

| Level | Cache Location | TTL Behavior | Cap |
|-------|---------------|--------------|-----|
| 1 | Browser (Chrome) | Record TTL, capped at ~60s for very high TTLs | Browser-imposed max |
| 2 | OS resolver | Record TTL, shared across all apps | OS-dependent |
| 3 | Recursive resolver | Record TTL, shared across all users of the resolver | Resolver-dependent |
| 4 | Authoritative server | Source of truth — sets the TTL for all caches | N/A |

**DoH vs DoT packet comparison:**

```
Traditional DNS (plain UDP, port 53):
  [DNS Query: example.com A record] → visible to network observers

DNS over TLS (DoT, port 853):
  [TLS handshake] → [Encrypted DNS Query] → identifiable as DNS, but content hidden

DNS over HTTPS (DoH, port 443):
  [TLS handshake] → [HTTP/2 POST to /dns-query] → indistinguishable from HTTPS traffic
```

<!-- ILLUSTRATIVE: Traditional DNS exposes the queried domain in plain text.
DoT encrypts the content but the port (853) reveals it's DNS traffic. DoH
makes DNS queries look like regular HTTPS traffic on port 443, providing
both encryption and camouflage. -->

---

### Part 4: Follow-Up Questions

**Q: Why does DNS propagation take time? Is it really "propagating"?**

It's not propagating — it's caching. The authoritative server has the new record immediately. The delay is that caches at every level (browser, OS, recursive resolver) hold the old value until its TTL expires. A record with a 300-second TTL propagates within 5 minutes because all caches expire within that window. A record with an 86400-second (24-hour) TTL can take up to 24 hours because caches hold the old value for up to 24 hours. This is why lowering TTL before a planned DNS change is a standard practice — if you know you're going to switch IPs in an hour, lower the TTL to 60 seconds an hour before the change, wait for the old TTL to expire (so caches refresh with the new short TTL), then make the change. The new value propagates in 60 seconds instead of 24 hours.

**Q: What happens if a recursive resolver goes down?**

Your OS can't resolve any domain that isn't already cached. The impact depends on what's cached — if you recently visited a site, its DNS entry might still be in the OS or browser cache, but new lookups fail entirely. This is why DNS is a single point of failure for internet access, and why resolvers like `8.8.8.8` and `1.1.1.1` are anycast across hundreds of locations — the BGP routing protocol redirects queries to the nearest healthy instance if one goes down.

**Q: Can you bypass DNS caching for testing?**

Yes. `chrome://net-internals/#dns` clears Chrome's DNS cache. The OS cache can be flushed with `sudo dscacheutil -flushcache` on macOS or `sudo systemd-resolve --flush-caches` on Linux. The recursive resolver's cache you can't control — it's managed by your ISP or the public resolver operator. For local development, `localhost` and `127.0.0.1` bypass DNS entirely, and the `hosts` file on your OS maps hostnames to IPs without any DNS lookup.

---

### Part 5: Common Mistakes

**Junior/mid answer:**
"DNS is like a phone book for the internet. You type a domain name, DNS looks up the IP address, and your browser connects to it."

**Why this misses the point:** It describes DNS as a single lookup with no awareness of caching, hierarchy, or privacy. The junior answer doesn't mention TTLs, doesn't explain why DNS propagation takes time, doesn't know about DoH or DoT, and treats DNS as a one-step process instead of a four-level hierarchy. If asked "why did my DNS change take 24 hours to propagate?" the junior answer has no framework to explain it.

**Senior answer:**
"DNS resolution happens at four levels: browser cache, OS cache, recursive resolver, and the authoritative chain (root → TLD → authoritative). Each level caches based on the record's TTL. When you change a DNS record, old values survive in caches until TTL expiry — that's why propagation takes time, it's not instantaneous. Traditional DNS queries are plain text, exposing which domains you're resolving. DoH wraps DNS in HTTPS on port 443, making it indistinguishable from web traffic. DoT wraps it in TLS on port 853, encrypted but identifiable as DNS. Both prevent eavesdropping."

**The tell:** The senior answer names all four levels, explains TTL-based caching, and knows DoH/DoT as privacy mechanisms. The junior answer describes DNS as a single lookup.

---

### Part 6: Production Examples

A fintech company migrated their primary domain from one DNS provider to another. They set the new DNS records with a TTL of 3600 seconds (1 hour) and made the switch. Four hours later, some users could reach the new IP while others still hit the old one. The team assumed the migration had failed. The actual cause: the recursive resolver used by a large portion of their enterprise customers (a corporate DNS resolver) had cached the old record with the previous TTL of 86400 seconds (24 hours) — set months earlier during a different infrastructure change. The new 3600-second TTL only affected new cache entries; the existing 86400-second entry hadn't expired yet. The fix was to contact the enterprise customer's IT team and have them flush their resolver cache, or wait until the 86400-second TTL expired naturally.

A different incident: a development team noticed that their staging environment was slow on first load after deploying a new build. The issue traced to DNS — their staging domain had a TTL of 86400 seconds, and the IP had changed during a server migration the previous week. Developers' machines had cached the old IP at the OS level, and the old IP was returning 302 redirects to the new IP, adding an extra round trip on every first request. Lowering the TTL to 60 seconds before the migration and waiting for caches to refresh would have prevented the redirect chain entirely.

---

## Topic 2 — TCP

### Part 1: Theory

TCP (Transmission Control Protocol) is the transport layer that HTTP runs over. Every HTTP request starts with a TCP connection, and that connection has a startup cost that directly impacts page load time. Understanding the handshake and its latency implications is the foundation for understanding why HTTP/2 and HTTP/3 made the architectural decisions they did.

**The three-way handshake.** Before any application data flows, the client and server perform a three-step handshake:

1. **SYN** — The client sends a TCP segment with the SYN flag set, proposing an initial sequence number.
2. **SYN-ACK** — The server responds with its own SYN and acknowledges the client's sequence number.
3. **ACK** — The client acknowledges the server's sequence number, and the connection is established.

The cost: one full round-trip time (RTT). After the three-way handshake completes, the connection is established and the first HTTP request can be sent. For a new TCP connection, there's no way around this one-RTT startup cost.

**The RTT cost in context.** A typical RTT on a broadband connection is 20-50ms. On a mobile connection, it can be 100-200ms. This means the TCP handshake alone adds 20-200ms before any HTTP request is sent. For a page that opens a new TCP connection on every request (HTTP/1.0 behavior), each request pays this handshake cost. This is the problem HTTP Keep-Alive was designed to solve.

**HTTP Keep-Alive (persistent connections).** HTTP/1.1 made persistent connections the default — after the initial TCP handshake, the same connection is reused for multiple HTTP requests and responses. The handshake cost is paid once, and subsequent requests skip it. Keep-Alive doesn't eliminate the handshake cost, but it amortizes it across multiple requests. The browser opens a limited number of connections per host (typically 6), and reuses them for all requests to that host.

**TCP Fast Open (TFO).** For repeat connections to the same server, TCP Fast Open allows the client to include data in the SYN packet — the first request can be sent with the handshake, eliminating the one-RTT wait. The server caches a cryptographic cookie from the first connection and uses it to authenticate the TFO request on subsequent connections. The tradeoff: TFO requires server-side support and a cached cookie, and it only helps on reconnections to the same server, not the first connection.

**Why the handshake cost matters.** The one-RTT TCP handshake is the direct motivation for HTTP/2 multiplexing and HTTP/3/QUIC. HTTP/2 uses a single TCP connection with multiple streams — the handshake is paid once, and all requests multiplex over that one connection. HTTP/3 goes further: QUIC is built on UDP, not TCP, and establishes connections without the TCP handshake entirely — the QUIC handshake combines transport and TLS setup into a single operation, reducing the overhead to zero or one RTT depending on whether it's a new or resumed connection.

---

### Part 2: Interview Answer

TCP's three-way handshake is the first latency cost in every HTTP connection, and understanding it explains why HTTP/2 and HTTP/3 made the architectural choices they did.

The handshake is SYN, SYN-ACK, ACK — the client sends a SYN, the server responds with SYN-ACK, and the client completes with an ACK. The cost is one full round-trip time before any application data can be sent. On broadband that's 20-50ms, on mobile it's 100-200ms. For a new TCP connection, this cost is unavoidable.

HTTP Keep-Alive, which is the default in HTTP/1.1, reuses the same TCP connection for multiple requests. You pay the handshake cost once and amortize it across all requests to that host. The browser typically opens six connections per host, and each one pays the handshake cost once. This is why parallel asset loading has a ceiling — you're limited by the number of persistent connections, and each new connection costs one RTT.

TCP Fast Open reduces the cost on reconnections. It lets the client include data in the SYN packet on repeat connections to the same server, using a cached cryptographic cookie. The handshake and the first request happen simultaneously. But it only helps on reconnections, not the initial connection, and requires server support.

The handshake cost is the direct motivation for HTTP/2 and HTTP/3. HTTP/2 multiplexes all requests over a single TCP connection — one handshake, many streams. HTTP/3 uses QUIC, which is UDP-based and combines transport and TLS setup into a single handshake. QUIC eliminates the TCP handshake entirely. The senior answer to "why does HTTP/2 exist?" includes the TCP handshake cost as the architectural motivation, not just "it's faster" or "it supports multiplexing."

---

### Part 3: Whiteboard / Live Coding

**Cold TCP connection vs. warm Keep-Alive connection:**

```
Cold connection (new TCP connection for every request):

Client                         Server
  |--- SYN (seq=0) ----------------->|           | RTT 1: Handshake
  |<-- SYN-ACK (seq=0, ack=1) -------|           |
  |--- ACK (ack=1) ----------------->|           |
  |                                  |           |
  |--- GET /index.html ------------->|           | RTT 2: First request
  |<-- 200 OK (body) ----------------|           |
  |                                  |           |
  |--- GET /style.css -------------->|           | RTT 3: Second request (new handshake!)
  |<-- SYN-ACK ----------------------|           |
  |--- ACK + GET /style.css -------->|           | RTT 4: Request with handshake
  |<-- 200 OK (body) ----------------|           |

Total: 4 RTTs for two requests
```

<!-- ILLUSTRATIVE: Without Keep-Alive, each request requires a new TCP
connection. The first request costs 2 RTTs (handshake + request). The
second request costs 2 more RTTs (new handshake + request). Total: 4 RTTs
for two requests. -->

```
Warm Keep-Alive connection (persistent connection):

Client                         Server
  |--- SYN (seq=0) ----------------->|           | RTT 1: Handshake
  |<-- SYN-ACK (seq=0, ack=1) -------|           |
  |--- ACK (ack=1) ----------------->|           |
  |                                  |           |
  |--- GET /index.html ------------->|           | RTT 2: First request
  |<-- 200 OK (body) ----------------|           |
  |                                  |           |
  |--- GET /style.css -------------->|           | RTT 3: Second request (no handshake!)
  |<-- 200 OK (body) ----------------|           |

Total: 3 RTTs for two requests (saved 1 RTT)
```

<!-- ILLUSTRATIVE: With Keep-Alive, the TCP handshake happens once. Both
requests reuse the same connection. Two requests cost 3 RTTs instead of 4.
The savings scale with more requests — 10 requests would cost 11 RTTs with
Keep-Alive vs. 20 without it. -->

**TCP Fast Open (reconnection):**

```
First connection:
Client                         Server
  |--- SYN (seq=0) ----------------->|           RTT 1: Handshake
  |<-- SYN-ACK (TFO cookie) ---------|
  |--- ACK + data ------------------>|           RTT 2: Handshake + first request
  |<-- 200 OK -----------------------|

Reconnection (with TFO):
Client                         Server
  |--- SYN (seq=N, TFO cookie, data)->|          RTT 1: Handshake + first request simultaneously!
  |<-- 200 OK ------------------------|

Total: 1 RTT instead of 2 on reconnection
```

<!-- ILLUSTRATIVE: TCP Fast Open allows data in the SYN packet on
reconnections, using a cached cookie from the first connection. The
handshake and first request happen in one RTT. TFO only helps on
reconnections — the first connection still costs 2 RTTs. -->

---

### Part 4: Follow-Up Questions

**Q: Why does the browser limit connections to six per host?**

The limit exists to prevent a single page from consuming all available connections to a server, which would starve other tabs and users. Six is a compromise between parallelism (loading multiple assets simultaneously) and resource management (not opening 50 connections to one server). HTTP/2 changed this calculus — since all requests multiplex over one connection, the six-connection limit matters less. But HTTP/1.1 sites still benefit from the limit because each connection is independent.

**Q: What happens if a TCP connection drops mid-transfer?**

TCP guarantees delivery through sequence numbers and acknowledgments. If a segment is lost, the sender retransmits it. If the connection drops entirely (network change, server crash), the TCP stack tries to reestablish it. For HTTP, this means a failed request — the browser retries automatically for idempotent requests (GET, HEAD) but not for non-idempotent ones (POST). The retry cost includes a new TCP handshake (one RTT) plus retransmitting the request.

**Q: How does TCP head-of-line blocking affect performance?**

TCP guarantees in-order delivery. If packet 3 is lost but packets 1, 2, 4, and 5 arrive, packets 4 and 5 wait in the TCP buffer until packet 3 is retransmitted. In HTTP/2, this means a lost packet in one stream blocks all streams — even though HTTP/2 multiplexes streams logically, they all share one TCP connection, so TCP-level blocking affects all of them. This is the problem HTTP/3 solves with QUIC: each stream is independent, so a lost packet in one stream doesn't block others.

---

### Part 5: Common Mistakes

**Junior/mid answer:**
"TCP is the protocol that ensures reliable data delivery. It uses a three-way handshake to establish a connection — SYN, SYN-ACK, ACK — and then data flows."

**Why this misses the point:** It describes TCP correctly but doesn't connect the handshake cost to the performance implications that matter for web development. The junior answer doesn't mention the one-RTT cost, doesn't explain why Keep-Alive exists, doesn't know TCP Fast Open, and doesn't connect the handshake to HTTP/2 and HTTP/3's architectural decisions. The answer is accurate but irrelevant to the interview question.

**Senior answer:**
"TCP's three-way handshake costs one RTT before any application data can be sent. On broadband that's 20-50ms, on mobile 100-200ms. HTTP Keep-Alive reuses the same connection to avoid paying that cost on every request. TCP Fast Open lets you include data in the SYN packet on reconnections, eliminating the RTT on repeat visits. The handshake cost is the direct motivation for HTTP/2 multiplexing — one TCP connection, many streams — and HTTP/3's QUIC, which is UDP-based and combines transport and TLS into a single handshake, eliminating TCP entirely."

**The tell:** The senior answer names the RTT cost, connects it to Keep-Alive, Fast Open, and the architectural motivation for HTTP/2 and HTTP/3. The junior answer describes the handshake without connecting it to performance.

---

### Part 6: Production Examples

A news website had a page with 80+ assets (images, scripts, stylesheets) loaded over HTTP/1.1 with no Keep-Alive. Each asset required a new TCP connection. At 40ms RTT, the handshake cost alone was 80 × 40ms = 3.2 seconds — before any data transferred. The page load time was over 8 seconds on mobile networks. Enabling Keep-Alive reduced the number of TCP handshakes from 80 to 6 (the browser's connection limit per host), cutting the handshake overhead from 3.2 seconds to 240ms. The total page load time dropped from 8 seconds to 3.5 seconds — the handshake cost reduction alone saved nearly 3 seconds.

A different team noticed that their API calls had a 200ms latency floor even when the server responded in 10ms. The investigation revealed that their HTTP client was creating a new TCP connection for every request — no connection pooling, no Keep-Alive. Each request paid a 100ms RTT for the TCP handshake before sending any data. Switching to a connection-pooled HTTP client that reused connections across requests dropped the latency floor from 200ms to 30ms, because the handshake was amortized across dozens of requests per connection.

---

## Topic 3 — TLS 1.3

### Part 1: Theory

TLS (Transport Layer Security) is the protocol that provides encryption, identity verification, and integrity for connections that use it. HTTPS is HTTP running over TLS — the HTTP protocol itself doesn't change; TLS wraps the connection. Understanding what TLS provides and how its handshake works is essential for reasoning about web security and performance.

**What TLS provides — the three guarantees:**

1. **Identity (certificate validation).** The server presents a certificate that proves it is who it claims to be. The browser validates the certificate against a chain of trust: the leaf certificate (the server's) is signed by an intermediate Certificate Authority (CA), which is signed by a root CA. The root CA's certificate is in the browser's trust store. If the chain validates — correct domain name, unexpired, not revoked, signed by a trusted CA — the browser trusts the server's identity. If it doesn't validate, the browser shows a warning.

2. **Encryption.** TLS encrypts the data in transit using a shared secret negotiated during the handshake. Eavesdroppers on the network see ciphertext, not plaintext. The encryption algorithm is negotiated in the handshake — TLS 1.3 supports only AEAD (Authenticated Encryption with Associated Data) ciphers, which provide both encryption and integrity in a single operation.

3. **Integrity.** TLS ensures that packets haven't been tampered with. AEAD ciphers produce an authentication tag for each record — if a bit is flipped in transit, the tag won't match and the record is rejected. This prevents man-in-the-middle attacks from modifying data in transit (changing a bank transfer amount, injecting a script into an HTML response).

**TLS 1.2 vs TLS 1.3 — the handshake:**

TLS 1.2 required two round trips for the TLS handshake after the TCP handshake was complete: one RTT for cipher suite negotiation and certificate exchange, one RTT for key exchange confirmation. Total: one RTT for TCP + two RTTs for TLS = three RTTs before application data.

TLS 1.3 combined the TLS handshake into a single round trip that overlaps with the TCP handshake. The client sends its supported cipher suites and key share in the first message (ClientHello), the server responds with its chosen cipher suite, certificate, and key share (ServerHello), and both sides derive session keys immediately. Total: two RTTs before application data flows — one for the TCP handshake, one for the TLS handshake. TLS 1.2 required three RTTs (one TCP plus two TLS), so TLS 1.3 saves one full RTT. The 0-RTT session resumption case does reach parity with plain HTTP — one RTT total — because TLS data is sent in the same message as the TCP handshake, as covered below.

**TLS 1.3 0-RTT (early data).** On session resumption (when the client has connected to the server before and has a cached session ticket), TLS 1.3 allows the client to send data in the first handshake message — the ClientHello — without waiting for the server's response. This is 0-RTT: data flows with no round-trip delay.

The tradeoff: 0-RTT data is vulnerable to replay attacks. An attacker who captures a legitimate 0-RTT request can replay it later, and the server cannot distinguish it from the original. For idempotent requests (GET), this is usually harmless — replayed GET requests return the same data. For non-idempotent requests (POST, PUT, DELETE), replay can cause unintended side effects — duplicating an order, applying a coupon twice, executing a transfer again. The server must implement its own replay protection (request IDs, timestamp validation) for non-idempotent 0-RTT requests, and many servers simply reject 0-RTT for non-idempotent operations. On a 0-RTT resumption, the total setup cost is one RTT — the same as plain HTTP over a new TCP connection. On a full TLS 1.3 handshake (first connection or expired session ticket), the cost is two RTTs.

---

### Part 2: Interview Answer

TLS 1.3 provides three guarantees: identity, encryption, and integrity — and the "senior answer" names all three, not just encryption.

Identity comes from certificate validation. The server presents a leaf certificate signed by an intermediate CA, which chains to a root CA in the browser's trust store. If the chain validates — correct domain, not expired, not revoked, signed by a trusted authority — the browser trusts the server. Encryption uses a shared secret negotiated during the handshake, so eavesdroppers see only ciphertext. Integrity comes from AEAD ciphers — each record has an authentication tag, and any tampering is detected and rejected.

The handshake improvement from TLS 1.2 to TLS 1.3 is significant. TLS 1.2 required two round trips for the TLS handshake after TCP — cipher suite negotiation in one RTT, key exchange in another. That's two RTTs of overhead before any application data. TLS 1.3 reduced the handshake from three RTTs to two — one for TCP, one for TLS — saving one full round trip compared to TLS 1.2. Only 0-RTT session resumption reaches parity with plain HTTP at one RTT total. The client sends supported cipher suites and a key share in ClientHello, the server responds with its chosen cipher, certificate, and key share, and both sides derive session keys. Data flows immediately after.

0-RTT is the session resumption optimization — the client sends data in the first handshake message using a cached session ticket, eliminating the round trip entirely. The tradeoff: 0-RTT data is vulnerable to replay attacks. An attacker who captures a 0-RTT request can replay it, and the server can't distinguish it from the original. For GET requests this is usually harmless, but for POST or DELETE it can cause real damage — duplicate orders, double-applied coupons, unintended transfers. Many servers reject 0-RTT for non-idempotent requests. The junior answer says "0-RTT is always better"; the senior answer names the replay tradeoff and when it matters.

---

### Part 3: Whiteboard / Live Coding

**TLS 1.2 vs TLS 1.3 handshake comparison:**

```
TLS 1.2 — 2 RTT after TCP:

Client                                          Server
  |                                                 |
  |--- TCP Handshake (SYN → SYN-ACK → ACK) -------->  |  RTT 0: TCP
  |                                                 |
  |--- ClientHello (supported cipher suites) ------>|  RTT 1: TLS negotiation
  |<-- ServerHello (chosen cipher suite) -----------|
  |<-- Certificate (server's leaf cert) ------------|
  |<-- ServerHelloDone ----------------------------|
  |                                                 |
  |--- ClientKeyExchange (key share) -------------->|  RTT 2: Key exchange
  |--- ChangeCipherSpec (switch to encryption) ---->|
  |--- Finished (verify handshake) ---------------->|
  |<-- ChangeCipherSpec ----------------------------|
  |<-- Finished -----------------------------------|
  |                                                 |
  |--- Application Data (encrypted) --------------->|  Data flows after 3 RTTs
```

<!-- ILLUSTRATIVE: TLS 1.2 requires two round trips for the TLS handshake
after TCP is established. The first RTT negotiates cipher suites and
exchanges certificates. The second RTT completes key exchange. Total: 1
RTT (TCP) + 2 RTT (TLS) = 3 RTTs before application data. -->

```
TLS 1.3 — 2 RTTs total (1 TCP + 1 TLS):

Client                                          Server
  |                                                 |
  |--- TCP Handshake (SYN → SYN-ACK → ACK) -------->|  RTT 1: TCP
  |                                                 |
  |--- ClientHello (cipher suites + key share) ---->|  RTT 2: TLS (1 RTT, not 2)
  |<-- ServerHello + Certificate + Finished --------|
  |--- Finished ---------------------------------->|
  |                                                 |
  |--- Application Data (encrypted) --------------->|  Data flows after 2 RTTs
```

<!-- ILLUSTRATIVE: TLS 1.3 reduces the TLS handshake from 2 RTTs (TLS 1.2)
to 1 RTT. Combined with the TCP handshake (always 1 RTT), the total is 2 RTTs
before application data flows. TLS 1.2 required 3 RTTs total (1 TCP + 2 TLS).
0-RTT session resumption reaches 1 RTT total — parity with plain HTTP — by
sending data in the first TLS message without waiting for a server response. -->

**TLS 1.3 0-RTT (session resumption):**

```
First connection (full handshake):
Client                                          Server
  |--- ClientHello + key share ------------------->|  RTT 1
  |<-- ServerHello + cert + finished --------------|
  |--- Finished + application data --------------->|
  |<-- application data ---------------------------|
  |                                                 |
  | [Client caches session ticket with key]         |

Resumption with 0-RTT:
Client                                          Server
  |--- ClientHello + PSK + early data (request) -->|  0 RTT: data sent immediately
  |<-- ServerHello + finished --------------------|
  |--- Finished --------------------------------->|
  |<-- application data (response) ----------------|  RTT 1: response arrives
```

<!-- ILLUSTRATIVE: On resumption, the client uses a Pre-Shared Key (PSK)
from the cached session ticket and sends application data in the first
message. The server receives the request immediately — no round trip
waiting. But the server cannot distinguish this from a replayed packet,
which is the 0-RTT replay vulnerability. -->

**What TLS provides — the three guarantees:**

| Guarantee | Mechanism | What it prevents |
|-----------|-----------|-----------------|
| Identity | Certificate chain (leaf → intermediate → root CA) | Impersonation — connecting to a fake server |
| Encryption | AEAD cipher suite, shared secret from handshake | Eavesdropping — reading data in transit |
| Integrity | AEAD authentication tag per record | Tampering — modifying data in transit |

---

### Part 4: Follow-Up Questions

**Q: How does the browser validate a certificate chain?**

The browser starts with the leaf certificate (the server's) and walks up the chain: the leaf is signed by an intermediate CA, the intermediate is signed by a root CA. The browser checks each signature using the public key of the signer. It verifies the root CA is in its trust store (a list of pre-installed root CAs maintained by the browser/OS vendor). It checks that the certificate isn't expired, isn't revoked (via OCSP or CRL), and that the domain name in the certificate matches the domain being connected to. If any step fails, the browser shows a warning. The chain can be deeper — intermediate CAs can be signed by other intermediate CAs — but the browser walks up until it reaches a trusted root.

**Q: Why can't you just use self-signed certificates?**

You can, but the browser won't trust them. A self-signed certificate isn't signed by any CA in the browser's trust store, so the browser shows a warning. Self-signed certificates work for development and internal services where you can install the certificate on every client machine. For public-facing sites, you need a certificate from a trusted CA. Let's Encrypt provides free certificates from a trusted CA — the cost of certificates is no longer a barrier.

**Q: What's the difference between certificate pinning and certificate validation?**

Certificate validation checks the chain against the browser's trust store. Certificate pinning goes further: the application pins a specific certificate or public key and only accepts that exact one, regardless of whether it chains to a trusted CA. Pinning protects against compromised CAs — if a malicious CA issues a fraudulent certificate for your domain, validation alone would accept it because the malicious CA is in the trust store. Pinning rejects it because it doesn't match the pinned key. The tradeoff: pinning requires code changes and careful key rotation, and a misconfiguration locks out legitimate traffic. Most teams rely on validation with certificate transparency logs instead of pinning.

---

### Part 5: Common Mistakes

**Junior/mid answer:**
"TLS encrypts the connection between the client and server. HTTPS is just HTTP over TLS. The browser shows a padlock when the connection is secure."

**Why this misses the point:** It names one of three TLS guarantees (encryption) and describes HTTPS as "HTTP with a padlock." The junior answer doesn't mention identity verification (certificate chains), doesn't mention integrity (AEAD tamper detection), doesn't know the difference between TLS 1.2 and TLS 1.3, and doesn't understand 0-RTT or its replay vulnerability. The padlock comment reveals that the answer is about the UI indicator, not the protocol.

**Senior answer:**
"TLS provides three guarantees: identity through certificate validation — the server presents a certificate that chains to a trusted root CA, proving it's who it claims. Encryption through AEAD cipher suites negotiated in the handshake, so eavesdroppers see ciphertext. Integrity through authentication tags on each record, so tampering is detected. TLS 1.3 reduced the handshake from three RTTs to two — one for TCP, one for TLS — saving one full round trip compared to TLS 1.2. Only 0-RTT session resumption reaches parity with plain HTTP at one RTT total. 0-RTT allows data in the first handshake message on session resumption, but it's vulnerable to replay attacks because the server can't distinguish a legitimate first request from a replayed captured packet. Many servers reject 0-RTT for non-idempotent requests."

**The tell:** The senior answer names all three guarantees, knows the TLS 1.3 RTT improvement, and understands 0-RTT's replay tradeoff. The junior answer says "TLS encrypts" and stops there.

---

### Part 6: Production Examples

A SaaS company's users reported intermittent "connection not private" warnings. The investigation revealed that their load balancer was presenting a certificate for `app.example.com`, but a subset of users accessed the service through `api.example.com` — a different subdomain with a different certificate. The certificate validation failed for those users because the domain in the certificate didn't match. The fix: a wildcard certificate (`*.example.com`) that covered all subdomains, or separate certificates for each subdomain with automated renewal. The incident demonstrated that certificate validation isn't just about trust chains — the domain name match is equally critical.

A different team enabled 0-RTT on their checkout API to improve mobile performance. Within a week, they detected duplicate orders — the same `POST /checkout` request appearing twice with identical timestamps. The root cause: a mobile network proxy was buffering and replaying requests during network transitions. The fix was to disable 0-RTT for all non-idempotent endpoints (POST, PUT, DELETE) and keep it only for idempotent ones (GET). The performance regression from disabling 0-RTT on checkout was negligible — one RTT on session resumption — but the duplicate orders would have caused real financial impact if undetected.

---

## Topic 4 — HTTPS

### Part 1: Theory

HTTPS is HTTP running over TLS. The HTTP protocol itself — the request methods, headers, status codes, body format — doesn't change. TLS wraps the TCP connection, providing identity, encryption, and integrity. Understanding HTTPS means understanding what TLS adds on top of plain HTTP and how the browser enforces secure connections.

**The certificate chain in detail.** When a browser connects to `https://example.com`, the server presents a leaf certificate. This certificate contains the server's public key, the domain name it's valid for, the issuing CA, and a validity period. The leaf certificate is signed by an intermediate CA's private key. The intermediate CA's certificate is signed by a root CA's private key. The root CA's certificate is self-signed and pre-installed in the browser's trust store. The browser walks the chain — leaf signed by intermediate, intermediate signed by root — and verifies each signature. If the chain validates, the server's identity is confirmed.

**Why the chain exists.** Root CAs never sign end-entity certificates directly. If a root CA's private key were compromised, every certificate it ever signed would be untrustworthy. By keeping root keys offline and using intermediate CAs for day-to-day signing, the blast radius of a key compromise is limited. The intermediate can be revoked and replaced without revoking the root.

**HSTS (HTTP Strict Transport Security).** HSTS is the mechanism that prevents downgrade attacks after the first HTTPS connection. Without HSTS, a user typing `example.com` might initially connect over HTTP (port 80), get redirected to HTTPS, and only then have an encrypted connection. But that first HTTP request is vulnerable — a network attacker can intercept it and serve a fake response, or strip the HTTPS redirect. HSTS closes this gap.

After the first successful HTTPS connection, the server sends a `Strict-Transport-Security` header:

```
Strict-Transport-Security: max-age=31536000; includeSubDomains
```

The browser remembers this directive for the specified duration (`max-age` in seconds). For the next year, any attempt to connect to `example.com` or any subdomain over HTTP is automatically upgraded to HTTPS before any request is sent. The browser never makes an insecure connection to that domain again.

**HSTS preloading.** HSTS has a bootstrapping problem: the first connection is still vulnerable because the browser hasn't seen the HSTS header yet. HSTS preloading solves this. Domain owners submit their domain to the HSTS preload list, maintained by browser vendors (Chrome, Firefox, Safari, Edge all share the list). Preloaded domains are always HTTPS, even on the very first connection — the browser has the HSTS directive built in before any connection is made. The tradeoff: preloading is hard to undo. Once preloaded, removing a domain from the list requires a browser update, and during the transition period, users with the old preload list still force HTTPS.

**HSTS and the first-request vulnerability.** Without HSTS preloading, the first HTTP request is the window of vulnerability. A network attacker (on the same WiFi, for example) can intercept the initial HTTP request and serve a redirect to their own server, or strip the HTTPS redirect and keep the user on HTTP. HSTS closes this for subsequent visits, but the first visit remains vulnerable without preloading. This is why security-conscious sites submit to the preload list — it eliminates the first-request vulnerability entirely.

---

### Part 2: Interview Answer

HTTPS is HTTP over TLS — the protocol itself doesn't change, TLS wraps the connection. Understanding what TLS adds and how the browser enforces secure connections is the senior-level skill.

The certificate chain is how the browser verifies the server's identity. The server presents a leaf certificate signed by an intermediate CA, which chains to a root CA in the browser's trust store. The browser walks the chain — leaf → intermediate → root — verifying each signature. It checks the domain name matches, the certificate isn't expired, and it isn't revoked. Root CAs never sign end-entity certificates directly — they stay offline and use intermediate CAs for signing, limiting the blast radius if an intermediate key is compromised.

HSTS prevents downgrade attacks. After the first HTTPS connection, the server sends `Strict-Transport-Security: max-age=31536000; includeSubDomains`, and the browser remembers to always use HTTPS for that domain. But the first connection is still vulnerable — the browser hasn't seen the HSTS header yet, so a network attacker can intercept the initial HTTP request. HSTS preloading closes this gap. Domain owners submit to a preload list maintained by browser vendors, and preloaded domains are always HTTPS even on the very first connection. The tradeoff: preloading is hard to reverse — removing a domain requires a browser update.

The junior answer to "what is HTTPS?" says "HTTP with a padlock." The senior answer names the certificate chain, explains why intermediate CAs exist, knows HSTS as the downgrade prevention mechanism, and understands that the first HTTP request is a vulnerability without preloading. The padlock is the UI indicator; the actual security comes from certificate validation, encryption, and integrity — and HSTS is what makes those guarantees persistent across visits.

---

### Part 3: Whiteboard / Live Coding

**Certificate chain validation:**

```
Root CA (self-signed, in browser trust store)
  |
  signs
  |
Intermediate CA (signed by Root CA)
  |
  signs
  |
Leaf Certificate (server's cert, signed by Intermediate CA)

Browser validation:
1. Leaf certificate domain matches example.com? ✓
2. Leaf certificate not expired? ✓
3. Leaf signed by Intermediate CA's public key? ✓
4. Intermediate signed by Root CA's public key? ✓
5. Root CA in browser's trust store? ✓
6. Leaf certificate not revoked (OCSP/CRL check)? ✓
→ Connection trusted
```

<!-- ILLUSTRATIVE: The browser walks the chain from leaf to root,
verifying each signature. If any step fails — wrong domain, expired cert,
untrusted CA — the browser shows a warning. The chain can be deeper
(multiple intermediates) but the principle is the same. -->

**HSTS flow — without preloading (first visit vulnerable):**

```
User types: http://example.com

1. Browser sends HTTP request to example.com:80
   [VULNERABLE: attacker can intercept this request]
2. Server responds with 301 → https://example.com
   [Attacker can strip this redirect]
3. Browser connects to https://example.com
4. Server sends Strict-Transport-Security: max-age=31536000
5. Browser remembers: always HTTPS for example.com

Second visit:
User types: http://example.com
→ Browser upgrades to https://example.com automatically (no HTTP request sent)
```

<!-- ILLUSTRATIVE: Without preloading, the first HTTP request is
vulnerable. The HSTS header takes effect after the first HTTPS connection.
A network attacker can intercept the initial HTTP request before HSTS is
established. -->

**HSTS flow — with preloading (first visit protected):**

```
example.com is on the HSTS preload list (submitted via hstspreload.org)

User types: http://example.com (first visit ever)

1. Browser checks preload list: example.com is preloaded
2. Browser upgrades to https://example.com before any request
3. [No HTTP request is ever sent]
4. Connection is secure from the very first visit
```

<!-- ILLUSTRATIVE: HSTS preloading eliminates the first-request
vulnerability. The browser has the HSTS directive built in before any
connection is made. The tradeoff: preloading is hard to undo — removing
a domain from the preload list requires a browser vendor update. -->

**The full HTTPS connection sequence:**

```
Browser                    DNS                    Server
  |                         |                        |
  |-- DNS lookup ---------->|                        |
  |<-- IP address ----------|                        |
  |                         |                        |
  |--- TCP SYN ----------------------------->|       |
  |<-- TCP SYN-ACK --------------------------|       |  RTT 1: TCP + TLS
  |--- TCP ACK + ClientHello (TLS) --------->|       |
  |<-- ServerHello + Certificate + Finished -|       |
  |--- Finished (TLS) ---------------------->|       |
  |                                          |       |
  |--- GET /index.html (encrypted) --------->|       |  RTT 2: Application data
  |<-- 200 OK (encrypted) -------------------|       |
```

<!-- ILLUSTRATIVE: The full sequence: DNS resolves the IP, TCP handshake
establishes the connection (one RTT), TLS handshake secures it (overlapping
with TCP in TLS 1.3), and the HTTP request flows over the encrypted channel.
With TLS 1.3, TCP + TLS is two RTTs — one for TCP, one for TLS — saving one RTT compared to TLS 1.2's three RTTs. -->

---

### Part 4: Follow-Up Questions

**Q: What happens if a certificate expires mid-day?**

The browser shows a warning page and blocks the connection by default. Users can click through the warning (in most browsers), but most won't — the warning is scary and designed to be. For the server operator, expired certificates are a common outage cause. Automated renewal with tools like Let's Encrypt's `certbot` or Cloudflare's automatic certificate management eliminates this — certificates renew before expiry without human intervention. The best practice is to set up monitoring that alerts days before expiry, as a safety net for automated renewal failures.

**Q: Can you use HTTPS with a self-signed certificate in production?**

Technically yes, but users will see browser warnings. Self-signed certificates work for internal services, development, or machine-to-machine communication where you can install the certificate on every client. For public-facing sites, you need a certificate from a trusted CA — Let's Encrypt provides them for free. Some teams use self-signed certificates with certificate pinning in mobile apps, where the app embeds the expected certificate and rejects anything else. But for web browsers, the trust store model is the only practical approach.

**Q: How does certificate revocation work?**

Two mechanisms: CRL (Certificate Revocation List) and OCSP (Online Certificate Status Protocol). CRL is a list of revoked certificate serial numbers published by the CA — the browser downloads the list and checks if the certificate is on it. The problem: CRLs can be large and are updated infrequently. OCSP is a live query — the browser asks the CA "is this certificate revoked?" The problem: OCSP adds latency to the connection, and if the OCSP server is down, the browser has to decide whether to fail open (allow the connection) or fail closed (block it). Most browsers fail open for OCSP failures, which means revocation checking is best-effort in practice. Certificate Transparency logs are the modern complement — they make all issued certificates publicly auditable, so unauthorized issuance is detectable even if revocation checking is imperfect.

---

### Part 5: Common Mistakes

**Junior/mid answer:**
"HTTPS is HTTP with encryption. The browser shows a padlock when the connection is secure. You get an SSL certificate from a certificate authority."

**Why this misses the point:** It names encryption as the only TLS guarantee and describes HTTPS as "HTTP plus padlock." The junior answer doesn't mention identity verification through certificate chains, doesn't mention integrity through AEAD, doesn't know HSTS or why it matters, doesn't understand the first-request vulnerability, and doesn't know what HSTS preloading is. "SSL certificate" is also outdated terminology — SSL was replaced by TLS in 1999, and modern certificates are TLS certificates.

**Senior answer:**
"HTTPS is HTTP over TLS, which provides three guarantees: identity — the server presents a certificate that chains to a trusted root CA, proving it's who it claims. Encryption — AEAD ciphers ensure eavesdroppers see ciphertext. Integrity — authentication tags detect any tampering. The certificate chain is leaf → intermediate → root CA, with root CAs kept offline to limit blast radius. HSTS prevents downgrade attacks: after the first HTTPS connection, the server sends a Strict-Transport-Security header and the browser always uses HTTPS for that domain. But the first request is still vulnerable without HSTS preloading — a network attacker can intercept it. Preloading submits the domain to a browser-maintained list so HTTPS is enforced from the very first connection. The tradeoff: preloading is hard to undo."

**The tell:** The senior answer names all three TLS guarantees, explains the certificate chain structure, covers HSTS and preloading with the first-request vulnerability, and knows preloading's reversibility tradeoff. The junior answer says "padlock" and stops.

---

### Part 6: Production Examples

A major e-commerce platform had a certificate expire on a Saturday morning. The automated renewal had failed three days earlier due to a DNS validation issue — a recent infrastructure change had modified a DNS record that the ACME challenge used for domain validation. The monitoring system had alerted, but the alert went to a team that no longer existed (org restructuring). The expired certificate caused the site to show browser warnings for 6 hours before someone manually renewed it. The estimated revenue loss was $200K per hour. The fix: multi-channel alerting (Slack, SMS, PagerDuty), certificate expiry monitoring with a 14-day warning, and a fallback validation method that doesn't depend on a single DNS record.

A different team noticed that users on public WiFi were being redirected to phishing pages when accessing their dashboard. The initial connection was over HTTP — the dashboard URL in their marketing emails used `http://` instead of `https://`. A network attacker on the same WiFi intercepted the HTTP request and served a fake login page that captured credentials. The fix: HSTS preloading. The domain was submitted to the preload list, ensuring that even the first connection uses HTTPS. The marketing team was also trained to always use `https://` URLs in emails and marketing materials, reducing the reliance on HSTS as the sole defense.

---

## Tie the Chain Together

A browser navigating to `https://example.com` for the first time runs all four protocols in sequence. DNS resolves the domain to an IP address through the four-level hierarchy — browser cache, OS cache, recursive resolver, authoritative chain. TCP establishes a connection with a three-way handshake, costing one RTT before any application data can be sent. TLS 1.3 secures the connection in one additional RTT — the client sends cipher suites and a key share in the first message, the server responds with its certificate and key share, and both sides derive session keys. The HTTPS request flows over the encrypted channel.

Each step adds latency, and each protocol has mechanisms to minimize that cost. DNS caching at every level avoids repeated lookups. HTTP Keep-Alive reuses TCP connections across requests, paying the handshake cost once. TLS 1.3 collapsed the handshake from three RTTs to two, saving one RTT compared to TLS 1.2. HTTP/2 multiplexes requests over a single TCP connection, and HTTP/3's QUIC eliminates TCP entirely.

The security guarantees compound: DNS over HTTPS prevents eavesdropping on domain lookups. TLS provides identity (certificate validation), encryption (ciphertext in transit), and integrity (tamper detection). HSTS ensures those guarantees persist across visits by forcing HTTPS on every connection after the first. HSTS preloading eliminates even the first-request vulnerability.

Session 23 continues with the HTTP protocol evolution — HTTP/1.1 → HTTP/2 → HTTP/3 — covering why each version changed what it changed and how the mechanisms in this session (TCP handshake cost, TLS 1.3 optimization, multiplexing) motivated those changes.

---

## Cross-References

- Session 23 (`book/04-browser/23-http-versions.md`) — HTTP/1.1 → HTTP/2 → HTTP/3, the protocol evolution and why each version changed what it changed.
- Session 25 (`book/04-browser/25-rendering-pipeline.md`) — Rendering pipeline: layout → paint → composite → GPU.
- Session 26 (`book/04-browser/26-reflow-repaint-critical-rendering-path.md`) — Reflow → repaint → critical rendering path.
- Session 24 (`book/04-browser/24-caching-cookies-storage.md`) — Caching strategies, cookies, and web storage.
- Session 12 (`book/02-html-mastery/12-browser-parsing-dom.md`) — Browser parsing and DOM construction, the foundation for understanding how the browser processes responses from the network stack.
