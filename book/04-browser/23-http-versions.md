# Session 23 — HTTP/1.1, HTTP/2, and HTTP/3

> **Module 4 — Browser.** Session 2 of 5.
> **Chain:** HTTP/1.1 (text protocol, three performance problems: head-of-line blocking, header bloat, sequential requests) → HTTP/2 (binary framing, multiplexing, HPACK, server push and why it failed, TCP-level head-of-line blocking) → HTTP/3 and QUIC (per-stream reliability, connection migration, 0-RTT, what HTTP/2 couldn't fix).
> This session builds on Session 22: TCP handshake cost → why multiplexing exists; TLS 1.3 RTT → why 0-RTT matters; TCP head-of-line blocking → why HTTP/3 moved to QUIC.

<!-- Module 4 convention: This module covers browser internals and networking
protocols. Protocol flows, timing diagrams, and packet sequences are
ILLUSTRATIVE — syntactically valid and mentally traced but not executed in a
runtime environment. Spec-level claims are verified against RFC 9113 (HTTP/2),
RFC 9114 (HTTP/3), RFC 9000 (QUIC), and MDN for browser-observable behavior.
Where a claim couldn't be verified inline, it's marked with <!-- VERIFY -->.
This convention applies to Sessions 22-26. -->

---

## Topic 1 — HTTP/1.1

### Part 1: Theory

HTTP/1.1 is a text protocol. Every line of a request or response is plain text bytes — the method, the path, the headers, the body, all encoded as readable characters. This was a deliberate design choice in 1997: human-readable protocols were easier to debug, easier to read in packet captures, and simpler to implement. The tradeoff didn't matter when web pages had a handful of resources. It matters enormously when a modern page loads 80+ assets.

**The request/response cycle.** HTTP/1.1 follows a strict request-response model. The client sends a request, the server sends a response, and on a single connection, requests must be sent sequentially — one at a time. The server must finish sending a response before the next request on that connection can be processed. This is the fundamental constraint that drives all three performance problems.

**Problem 1: Head-of-line blocking at the HTTP level.** On a single HTTP/1.1 connection, a response must complete before the next request can be sent. If a large image takes 500ms to transfer, every other request on that connection waits 500ms, even if those other requests are for small CSS files that would return in 5ms. This is HTTP-level head-of-line blocking — one slow response blocks all subsequent responses on the same connection.

**Problem 2: Header bloat.** Every HTTP/1.1 request sends headers in full, uncompressed text. The `Cookie` header alone can be hundreds of bytes on a cookie-heavy site. Every request to the same host repeats the same `User-Agent`, `Accept-Encoding`, `Accept-Language`, and cookie headers. On a page with 80 requests, those identical headers are transmitted 80 times, adding kilobytes of redundant data per request. In extreme cases, the headers are larger than the response body.

**Problem 3: Sequential request processing.** To work around head-of-line blocking, browsers open multiple parallel connections per host — typically six. Each connection is independent, so six requests can be in flight simultaneously. But each connection costs a TCP handshake (one RTT per Session 22's coverage) and consumes server resources. The six-connection limit is a compromise between parallelism and resource management. More connections means more handshakes, more memory on the server, and more TCP slow-start overhead.

**Pipelining — the mechanism that was supposed to help.** HTTP/1.1 technically supports pipelining: the client can send multiple requests without waiting for each response. In theory, this eliminates the idle time between request and response. In practice, pipelining was disabled in browsers because of a critical flaw: server responses must arrive in the same order as requests. A slow resource still blocks faster ones behind it — the server can't reorder responses. Combined with the difficulty of implementing pipelining correctly on intermediaries (proxies, CDNs), browsers chose the simpler approach of multiple connections over pipelining.

**Why these problems compound.** A modern page makes dozens of requests for HTML, CSS, JavaScript, images, fonts, and API calls. Under HTTP/1.1, the browser opens six connections and distributes requests across them. But within each connection, requests are sequential. The total page load time is governed by the slowest request on the busiest connection, plus the handshake cost for each new connection. This is the ceiling HTTP/2 was designed to break.

---

### Part 2: Interview Answer

HTTP/1.1 is a text protocol — every line of a request or response is plain text bytes. The request/response model is strictly sequential: one request per connection at a time, the server must finish responding before the next request is sent. Understanding why this matters means naming three specific performance problems, not just saying "it's slow."

The first problem is HTTP-level head-of-line blocking. On a single connection, a large response — say, a 2MB image that takes 500ms to transfer — blocks every other request on that connection. Smaller requests for CSS or JavaScript files wait behind it, even though they'd return in milliseconds. The second problem is header bloat. Every request sends headers in full, uncompressed text. On a cookie-heavy site, the `Cookie` header alone can be hundreds of bytes, and every request to the same host repeats the same `User-Agent`, `Accept-Encoding`, and language headers. With 80 requests, that's kilobytes of identical data sent 80 times. The third problem is sequential request processing — multiple requests on one connection must be served one after another, not in parallel.

The workaround is opening multiple connections per host, typically six. Each connection is independent, so six requests can be in flight at once. But each new connection costs a TCP handshake — one RTT — and consumes server resources. Pipelining was supposed to fix this by letting the client send multiple requests without waiting for responses, but it was disabled in practice because responses must arrive in request order. A slow resource blocks faster ones behind it, and intermediaries like proxies often broke pipelining entirely. The browser chose multiple connections over pipelining because the failure mode was simpler to reason about.

---

### Part 3: Whiteboard / Live Coding

**HTTP/1.1 sequential blocking on a single connection:**

```
Client                                      Server
  |--- GET /index.html --------------------->|
  |<-- 200 OK (100KB HTML, 50ms) ------------|
  |                                          |  Server must finish
  |                                          |  before next request
  |--- GET /hero.jpg (2MB) ----------------->|
  |<-- 200 OK (2MB image, 500ms) ------------|  500ms of blocking
  |                                          |
  |--- GET /style.css --------------------->|  CSS waits behind image
  |<-- 200 OK (10KB CSS, 5ms) ---------------|  Total: ~505ms for CSS

Wait time for style.css: 500ms (blocked by hero.jpg)
```

<!-- ILLUSTRATIVE: On a single HTTP/1.1 connection, requests are strictly
sequential. The CSS file would return in 5ms on its own, but it waits
behind the 500ms image transfer. This is HTTP-level head-of-line blocking. -->

**Six-connection parallelism (the workaround):**

```
Connection 1:  [GET /index.html] [GET /hero.jpg ..............]
Connection 2:  [GET /style.css]  [GET /font.woff]
Connection 3:  [GET /script1.js] [GET /script2.js]
Connection 4:  [GET /logo.png]   [GET /icon.svg]
Connection 5:  [GET /api/data]   [GET /analytics]
Connection 6:  [GET /track.gif]  [GET /ad-banner.jpg]

Each connection pays its own TCP handshake (1 RTT)
Each connection processes requests sequentially
6 connections = 6 handshakes = 6 RTTs before first requests flow
```

<!-- ILLUSTRATIVE: The browser distributes requests across six parallel
connections. Within each connection, requests are still sequential. The
six-connection limit is a compromise — more connections would mean more
parallelism but also more TCP handshakes and more server memory. -->

**Pipelining (disabled in practice):**

```
Client                                      Server
  |--- GET /index.html --------------------->|
  |--- GET /style.css --------------------->|  Sent without waiting
  |--- GET /script.js --------------------->|  for response
  |                                          |
  |<-- 200 OK (index.html) ------------------|  Must arrive in
  |<-- 200 OK (style.css) ------------------|  request order
  |<-- 200 OK (script.js) ------------------|

Problem: If index.html is slow, style.css and script.js
are blocked even though they're ready to send.
The server CANNOT reorder responses.
```

<!-- ILLUSTRATIVE: Pipelining sends multiple requests without waiting for
responses, but responses must return in request order. If the first
request is slow, all subsequent responses are delayed. This is why
browsers disabled pipelining and used multiple connections instead. -->

**Header bloat in practice:**

```
GET /api/users HTTP/1.1
Host: example.com
User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)...
Accept: text/html,application/xhtml+xml,application/xml;q=0.9...
Accept-Encoding: gzip, deflate, br
Accept-Language: en-US,en;q=0.9
Cookie: session=abc123; _ga=GA1.2.1234567890; _gid=GA1.2.9876543210;
        pref=theme=dark; consent=yes; tracking=on
Connection: keep-alive
Cache-Control: no-cache

Headers: ~450 bytes
Body: 0 bytes (GET request)

On a page with 80 requests: 80 × 450 bytes = 36KB of headers alone
```

<!-- ILLUSTRATIVE: Every HTTP/1.1 request repeats the full header set.
On a cookie-heavy site, the Cookie header alone can be 200+ bytes.
Multiply by 80 requests and the header overhead is significant —
sometimes larger than the response body for small resources. -->

---

### Part 4: Follow-Up Questions

**Q: Why six connections per host, not more or fewer?**

The limit is a browser-imposed heuristic, not a protocol requirement. Six is a balance between parallelism (loading assets concurrently) and resource consumption (each connection uses server memory and a TCP congestion window). More connections would increase parallelism but also increase the number of TCP handshakes, slow-start periods, and server-side state. HTTP/2 changed this calculus — since all requests multiplex over one connection, the six-connection limit matters less, but HTTP/1.1 sites still benefit from it.

**Q: What's the actual difference between HTTP/1.0 and HTTP/1.1?**

HTTP/1.0 created a new TCP connection for every request — no Keep-Alive. HTTP/1.1 made persistent connections the default and added the `Host` header (required for virtual hosting), `Content-Length`, chunked transfer encoding, and additional cache-control directives. The persistent connection change was the biggest performance improvement — it amortized the TCP handshake cost across multiple requests.

**Q: Could you increase the connection limit to fix HTTP/1.1's problems?**

You could, but it doesn't scale. Doubling to 12 connections means 12 TCP handshakes, 12 slow-start periods, and 12 concurrent TCP congestion windows competing for bandwidth. The server also has to maintain 12 connection states per client. At scale — millions of concurrent users — this compounds into serious memory and CPU overhead. HTTP/2's single-connection multiplexing was the architectural solution; the six-connection limit was always a workaround.

---

### Part 5: Common Mistakes

**Junior/mid answer:**
"HTTP/1.1 is the standard version of HTTP. It uses persistent connections and supports pipelining. Pages load slowly because each request has overhead."

**Why this misses the point:** It names features without naming problems. The junior answer doesn't explain head-of-line blocking, doesn't mention header bloat, doesn't say why pipelining was disabled, and doesn't connect the performance ceiling to the six-connection workaround. "Each request has overhead" is vague — the senior answer names which overhead and why it compounds.

**Senior answer:**
"HTTP/1.1 is a text protocol with three specific performance problems. Head-of-line blocking: on a single connection, a slow response blocks all subsequent requests. Header bloat: every request sends full uncompressed headers — Cookie, User-Agent, Accept-Encoding — repeating kilobytes of identical data per request. Sequential processing: requests on one connection must be served one at a time. The workaround is opening six parallel connections per host, but each costs a TCP handshake and server resources. Pipelining was supposed to help, but responses must arrive in request order, so a slow resource still blocks faster ones behind it — browsers disabled it."

**The tell:** The senior answer names all three specific problems and explains why pipelining failed. The junior answer lists features without connecting them to performance.

---

### Part 6: Production Examples

A media company's article page loaded 120 assets over HTTP/1.1 — article images, ad tracking scripts, social widgets, analytics beacons. With six connections, each processing requests sequentially, the total transfer time was governed by the slowest connection. One ad script took 800ms to respond from a third-party server. That 800ms blocked five other assets queued behind it on the same connection. The page load time on mobile was 12 seconds. The fix wasn't HTTP/2 (their CDN didn't support it yet) — it was domain sharding. By splitting assets across three hostnames (`assets1.example.com`, `assets2.example.com`, `assets3.example.com`), they got 18 parallel connections (6 per host × 3 hosts), reducing the worst-case blocking time. The page load dropped to 6 seconds — a 50% improvement from domain sharding alone.

A different team discovered that their API responses were small (200 bytes) but their request headers were 800 bytes — the `Authorization` token, session cookies, and device fingerprint headers dwarfed the response. Each request sent 800 bytes of headers to receive 200 bytes of data. Over 40 API calls per page load, that's 32KB of header overhead for 8KB of response data. Switching to HTTP/2 with HPACK header compression reduced the header overhead by 85% because repeated headers were sent as table index references instead of full strings.

---

## Topic 2 — HTTP/2

### Part 1: Theory

HTTP/2 solved HTTP/1.1's performance problems at the application layer. It introduced binary framing, multiplexing, header compression, and server push. Understanding HTTP/2 means understanding what each mechanism specifically fixes — and what TCP's limitations mean it can't fix.

**Binary framing — the foundational change.** HTTP/1.1 is a text protocol: each line of a request or response is plain text bytes, terminated by `\r\n`. HTTP/2 is binary: requests and responses are encoded as binary frames. This matters for two reasons. First, binary parsing is unambiguous — no whitespace-handling edge cases, no newline-as-delimiter fragility. Second, and more importantly, binary framing is what enables multiplexing. Frames can be interleaved on a single connection — frame 1 from stream 3, frame 2 from stream 7, frame 3 from stream 3 — because each frame carries a header identifying which stream it belongs to. Without binary framing, interleaving text responses would be impossible to parse unambiguously.

**Streams, frames, and multiplexing.** Each request/response pair is a stream, identified by a stream ID. The client assigns odd-numbered stream IDs; the server assigns even-numbered ones. Data is broken into frames — the atomic unit of HTTP/2. Frame types include DATA (body content), HEADERS (metadata), SETTINGS (connection configuration), PUSH_PROMISE (server push), and WINDOW_UPDATE (flow control). Multiple streams share a single TCP connection, and frames from different streams are interleaved. The receiver reassembles each stream from its frames independently. This is multiplexing — multiple requests in flight simultaneously over one connection, without the head-of-line blocking of HTTP/1.1 at the application layer.

**HPACK header compression.** HTTP/1.1 sends headers as uncompressed text on every request. HTTP/2 uses HPACK, which compresses headers using two mechanisms: a static table of common headers (index references for `:method`, `:scheme`, `:path`, `content-type`, etc.) and a dynamic table that both sides maintain. The dynamic table is a shared state — when the client sends a header that's already in the table, it sends a numeric index instead of the full string. Repeated headers like `Cookie`, `User-Agent`, and `Accept-Encoding` are sent as one or two bytes instead of hundreds. The dynamic table grows as new headers are added and evicts old entries when full. This eliminates header bloat — the second HTTP/1.1 problem — entirely.

**Server push — the feature that failed.** HTTP/2 Server Push allowed the server to proactively send resources the client hadn't requested. The idea: when the server sees a request for `index.html`, it knows the client will need `styles.css` and `app.js`, so it pushes those resources without waiting for the client to parse the HTML and issue separate requests. In theory, this eliminates a round trip. In practice, server push was hard to implement correctly. Servers often pushed resources already in the browser cache (wasting bandwidth), pushed resources in the wrong order, or pushed more than the client needed. The implementation complexity wasn't worth the inconsistent gains. Chrome disabled Server Push by default in Chrome 106 (September 2022), citing that only 1.25% of HTTP/2 sites used it and performance analysis showed mixed results. Firefox removed it in Firefox 132 (October 2024). The recommended replacement is `103 Early Hints`, which lets the server hint at resources to preload before the full response is ready — giving the browser a head start without the complexity of push.

**What HTTP/2 doesn't fix: TCP-level head-of-line blocking.** HTTP/2 eliminates HTTP-level head-of-line blocking — one slow stream doesn't block other streams at the application layer. But TCP-level head-of-line blocking still applies. TCP guarantees in-order delivery for the entire connection. If a single TCP segment is lost, ALL streams on that connection wait for retransmission, because TCP must deliver bytes in order to every stream. A lost packet carrying data from stream 3 blocks streams 1, 5, 7, and every other stream on the connection — even though those streams' data arrived intact. This is TCP's head-of-line blocking, and HTTP/2 doesn't fix it. HTTP/3 does, by moving to QUIC.

---

### Part 2: Interview Answer

HTTP/2 was designed to fix HTTP/1.1's specific problems, and understanding what it actually changed — not just "it's faster" — is the senior answer.

The foundational change is binary framing. HTTP/1.1 is text — each line is plain bytes. HTTP/2 encodes requests and responses as binary frames, and this is what makes multiplexing possible. Each request/response pair is a stream with a stream ID. Frames from different streams are interleaved on a single TCP connection. The receiver reassembles each stream independently. One connection, many simultaneous requests, no application-level head-of-line blocking.

Header compression uses HPACK. A shared dynamic table means repeated headers — `Cookie`, `User-Agent`, `Accept-Encoding` — are sent as numeric index references instead of full strings. On a cookie-heavy site, this reduces header overhead by 80-90% compared to HTTP/1.1. The dynamic table is maintained by both sides of the connection, growing as new headers appear and evicting old entries.

Server Push was an HTTP/2 feature that let the server proactively send resources the client hadn't requested yet — pushing `styles.css` when the client asked for `index.html`. In practice, it was rarely used (only 1.25% of HTTP/2 sites), often pushed resources already in cache, and was hard to implement correctly. Chrome disabled it in Chrome 106 (September 2022), Firefox removed it in October 2024. The replacement is `103 Early Hints`, which gives the browser a head start without the complexity of push.

The critical limitation: HTTP/2 doesn't fix TCP-level head-of-line blocking. HTTP/2 eliminated HTTP-level blocking — one slow stream doesn't block others at the application layer. But TCP guarantees in-order delivery for the entire connection. A lost TCP segment blocks ALL streams, because every stream shares one TCP connection and TCP must deliver bytes in order. HTTP/3 fixes this with QUIC, where each stream is independent.

---

### Part 3: Whiteboard / Live Coding

**HTTP/2 binary framing and multiplexing:**

```
Single TCP Connection:

Frame 1: [Stream 3, HEADERS] GET /index.html
Frame 2: [Stream 3, DATA]   <html>...
Frame 3: [Stream 7, HEADERS] GET /style.css
Frame 4: [Stream 3, DATA]   ...</html>
Frame 5: [Stream 7, DATA]   body { color: red }
Frame 6: [Stream 5, HEADERS] GET /script.js
Frame 7: [Stream 5, DATA]   function init() { ... }
Frame 8: [Stream 7, DATA]   }

One connection. Three streams. Frames interleaved.
Each stream is reassembled independently.
```

<!-- ILLUSTRATIVE: HTTP/2 frames carry a stream ID so the receiver can
reassemble each request/response pair from interleaved frames. Stream 3
(index.html) gets its first DATA frame, then stream 7 (style.css) starts,
then stream 3 finishes, then stream 5 (script.js) begins. No stream
blocks another at the application layer. -->

**HTTP/1.1 vs HTTP/2 — head-of-line blocking comparison:**

```
HTTP/1.1 (single connection):
Stream:  [index.html.........] [style.css] [script.js]
         ^^^^^^^^^^^^^^^^^^^^^ blocked ^^^^^^^^^^^^^^^^
         style.css and script.js wait for index.html to finish

HTTP/2 (single connection, multiplexed):
Stream 3: [index.html........]
Stream 7:      [style.css]
Stream 5:           [script.js]
All three in flight simultaneously. No application-level blocking.
```

<!-- ILLUSTRATIVE: HTTP/2 multiplexing eliminates HTTP-level head-of-line
blocking. Multiple streams run simultaneously on one connection. A slow
stream doesn't block faster ones at the application layer. But TCP-level
head-of-line blocking still affects all streams (see below). -->

**HPACK header compression — dynamic table:**

```
Static Table (shared, predefined):
Index 1:  :authority
Index 2:  :method (GET)
Index 3:  :method (POST)
Index 4:  :path (/)
...
Index 54: content-type
Index 55: cookie

Dynamic Table (built during connection):
Index 62: cookie: session=abc123; _ga=GA1.2...  (sent once, referenced by index after)
Index 63: user-agent: Mozilla/5.0 (Macintosh...) (sent once, referenced by index after)

Request 1 (full headers):
:method: GET
:authority: example.com
cookie: session=abc123; _ga=GA1.2...
user-agent: Mozilla/5.0 (Macintosh...)
→ Sends full header strings

Request 2 (compressed):
:method: :2 (static table index)
:authority: :1 (static table index)
cookie: =62 (dynamic table index)
user-agent: =63 (dynamic table index)
→ Sends numeric references, not strings
```

<!-- ILLUSTRATIVE: HPACK uses a static table of common headers and a
dynamic table built during the connection. After the first request sends
full headers, subsequent requests reference them by index. A 450-byte
cookie header becomes a 1-byte index reference. -->

**TCP-level head-of-line blocking in HTTP/2:**

```
TCP Connection carrying 3 HTTP/2 streams:

TCP Segment 1: [Stream 3 data] ✓ delivered
TCP Segment 2: [Stream 7 data] ✗ LOST
TCP Segment 3: [Stream 3 data] ✓ arrived at OS buffer, but...
TCP Segment 4: [Stream 5 data] ✓ arrived at OS buffer, but...
TCP Segment 5: [Stream 7 data] ✓ arrived at OS buffer, but...

TCP MUST deliver in order. Segment 2 is lost.
Segments 3, 4, 5 are held in the TCP buffer until Segment 2
is retransmitted and delivered.

ALL streams blocked — Stream 3 (which has all its data) waits
behind Stream 7's lost segment. This is TCP-level head-of-line
blocking. HTTP/2 can't fix it because it still uses TCP.
```

<!-- ILLUSTRATIVE: TCP guarantees in-order delivery for the entire
connection. A lost segment blocks all data that arrives after it,
regardless of which HTTP/2 stream it belongs to. This is the fundamental
limitation HTTP/2 inherits from TCP — and the problem HTTP/3 solves
with QUIC's per-stream reliability. -->

**Server Push flow and its failure:**

```
Client sends: GET /index.html

Server push flow:
Server: PUSH_PROMISE /styles.css    ← Server decides to push
Server: PUSH_PROMISE /app.js        ← Server decides to push
Server: DATA /index.html (body)     ← Original response
Server: DATA /styles.css (body)     ← Pushed before client asked
Server: DATA /app.js (body)         ← Pushed before client asked

Problems in practice:
1. Client already has styles.css cached → wasted bandwidth
2. Server pushes styles.css before index.html body is parsed
   → client may not need it yet (conditional loading)
3. Server pushes in wrong priority order
4. Implementation complexity on server + intermediaries
→ Chrome 106 (Sep 2022): disabled by default
→ Firefox 132 (Oct 2024): removed entirely
→ Replacement: 103 Early Hints (server hints, doesn't push)
```

<!-- ILLUSTRATIVE: Server Push was meant to eliminate a round trip by
predicting what the client would need. In practice, servers pushed
cached resources, pushed in wrong order, and the complexity wasn't
worth the inconsistent gains. Early Hints (103) gives the browser a
head start without the push complexity. -->

---

### Part 4: Follow-Up Questions

**Q: What exactly are the frame types in HTTP/2?**

The key frame types: DATA carries body content. HEADERS carries metadata and starts a stream. SETTINGS configures connection parameters (max concurrent streams, initial window size). PUSH_PROMISE initiates server push. WINDOW_UPDATE implements flow control — the receiver tells the sender how much data it's willing to accept. GOAWAY gracefully shuts down a connection. RST_STREAM cancels a single stream without closing the connection. PING measures round-trip time on the connection. PRIORITY (deprecated in RFC 9113) was meant to let clients signal stream priority but was rarely implemented correctly.

**Q: How does HPACK handle the dynamic table eviction?**

The dynamic table has a size limit (default 4096 bytes, configurable via SETTINGS). When a new entry would exceed the limit, the oldest entries are evicted until there's room. If a referenced index has been evicted, the receiver sends a dynamic table size update to resynchronize. This is the complexity of HPACK — both sides must maintain the same table state, and eviction can cause synchronization issues. QPACK (used by HTTP/3) solves this by using a different approach that doesn't require synchronized state.

**Q: Why was server push removed instead of improved?**

Three reasons converged. First, usage was extremely low — only 1.25% of HTTP/2 sites. Second, the alternatives were better: `103 Early Hints` lets the server hint at resources without the complexity of push, and `rel="preload"` in HTML does the same thing declaratively. Third, server push didn't survive into HTTP/3 — browsers never implemented push over HTTP/3, so maintaining it in HTTP/2 was investing in a dead end.

---

### Part 5: Common Mistakes

**Junior/mid answer:**
"HTTP/2 is faster than HTTP/1.1 because it supports multiplexing and binary framing. It can send multiple requests at the same time over one connection. It also compresses headers."

**Why this misses the point:** It says HTTP/2 is "faster" without naming which specific problems it fixes. The junior answer doesn't explain binary framing as the enabler of multiplexing, doesn't distinguish HTTP-level head-of-line blocking (fixed) from TCP-level head-of-line blocking (not fixed), doesn't mention HPACK by name or explain how it works, and doesn't know server push was deprecated. The answer is a feature list, not an explanation of tradeoffs.

**Senior answer:**
"HTTP/2 fixed three specific HTTP/1.1 problems. Binary framing — requests and responses encoded as binary frames instead of text lines — enabled multiplexing, where multiple streams share one connection with frames interleaved. This eliminated HTTP-level head-of-line blocking: one slow stream doesn't block others at the application layer. HPACK header compression uses a shared dynamic table so repeated headers like Cookie are sent as index references instead of full strings, eliminating header bloat. Server Push was an HTTP/2 feature that let servers proactively send resources — it was removed because only 1.25% of sites used it, it pushed cached resources, and `103 Early Hints` replaced it more cleanly. The critical limitation: HTTP/2 still uses TCP. TCP guarantees in-order delivery for the entire connection, so a lost TCP segment blocks ALL streams. This is TCP-level head-of-line blocking, and only HTTP/3 with QUIC fixes it."

**The tell:** The junior answer lists features. The senior answer names specific problems fixed, the mechanism that enabled each fix, the distinction between HTTP-level and TCP-level head-of-line blocking, and the server push deprecation.

---

### Part 6: Production Examples

A large e-commerce platform migrated from HTTP/1.1 to HTTP/2. Their product pages loaded 90+ assets — product images, CSS, JavaScript, recommendation widgets, analytics beacons. Under HTTP/1.1, they were domain-sharding across four hostnames to get 24 parallel connections. Under HTTP/2, they consolidated to a single hostname and let multiplexing handle the parallelism. Page load time on mobile dropped from 5.2 seconds to 3.8 seconds — a 27% improvement. But the gains were uneven. Third-party scripts loaded from separate domains still used HTTP/1.1 (the third-party servers hadn't upgraded), so those assets didn't benefit from HTTP/2 multiplexing. The lesson: HTTP/2 only helps for resources served over HTTP/2 — third-party resources on HTTP/1.1 still pay the old costs.

A different team discovered TCP-level head-of-line blocking the hard way. Their real-time dashboard loaded 15 WebSocket streams and 30+ HTTP/2 streams over a single TCP connection. During packet loss events on mobile networks (common on congested cellular), the entire dashboard froze — not because the server was slow, but because TCP retransmission blocked all streams. They added QUIC support (HTTP/3) and the freezes disappeared: lost packets only blocked the specific stream they belonged to. The mobile experience went from "unusable during congestion" to "graceful degradation." This is the TCP-level head-of-line blocking that HTTP/2 inherits and HTTP/3 eliminates.

---

## Topic 3 — HTTP/3 and QUIC

### Part 1: Theory

HTTP/3 is HTTP running over QUIC — a transport protocol built on UDP. QUIC isn't just "HTTP over UDP." It reimplements TCP's reliable, ordered, congestion-controlled delivery, but per-stream rather than per-connection. This architectural difference is what fixes TCP-level head-of-line blocking and enables connection migration.

**QUIC as a transport protocol.** QUIC runs over UDP because UDP provides no built-in transport semantics — no connection state, no ordering, no reliability. This is exactly what QUIC needs: a blank canvas to build its own transport. QUIC implements reliability (retransmission of lost packets), ordering (per-stream), and congestion control (slow start, AIMD) at the QUIC layer. Each QUIC stream is independent — a lost packet in one stream doesn't affect other streams. This is the per-stream reliability that eliminates TCP-level head-of-line blocking.

**Connection establishment.** QUIC combines the transport handshake and TLS 1.3 handshake into a single operation. For a new connection, this is 1 RTT — the client sends initial QUIC packets (including a TLS ClientHello), the server responds with its configuration and TLS ServerHello, and both sides derive encryption keys. For a resumed connection (client has cached session state), this is 0 RTT — the client sends application data in the first message, similar to TLS 1.3 0-RTT but at the transport level. Compare this to TCP + TLS 1.3: one RTT for TCP, one for TLS, total 2 RTTs. QUIC's combined handshake saves one full RTT on new connections and reaches 0 RTT on resumption.

**Connection migration.** TCP identifies connections by a 4-tuple: client IP, client port, server IP, server port. If any element changes — the client switches from WiFi to cellular, getting a new IP address — the TCP connection breaks. QUIC identifies connections by a Connection ID, an opaque identifier negotiated during handshake. When a mobile device switches networks, the Connection ID stays the same. The server doesn't care about the IP change — it uses the Connection ID to find the connection state. The migration is transparent to the application: all streams continue uninterrupted. Before switching paths, QUIC probes the new path with PATH_CHALLENGE/PATH_RESPONSE frames to verify it works. For privacy, Connection IDs change on migration to prevent tracking across networks.

**Per-stream independence.** On a TCP connection carrying three HTTP/2 streams, a lost TCP segment blocks all three streams — TCP must deliver bytes in order to the entire connection. On a QUIC connection carrying three HTTP/3 streams, a lost QUIC packet blocks only the stream it belongs to. Stream 1's data arrived intact and is delivered immediately. Stream 2's data arrived intact and is delivered immediately. Stream 3's lost packet is retransmitted, and only Stream 3 waits. This is the per-stream reliability that QUIC provides and TCP cannot.

**0-RTT resumption.** QUIC 0-RTT is particularly valuable because the combined transport and TLS handshake can be resumed in 0 additional RTTs. On a resumed connection, the client sends application data in the first QUIC packet — no round trip waiting. The tradeoff is the same as TLS 1.3 0-RTT: replay vulnerability. An attacker who captures a 0-RTT request can replay it. For idempotent requests (GET), this is usually harmless. For non-idempotent requests (POST), servers must implement their own replay protection. Many servers reject 0-RTT for non-idempotent operations.

**Current adoption.** As of 2026, HTTP/3 is supported by all major browsers (Chrome 87+, Firefox 88+, Safari 16+, Edge 87+). Approximately 39% of websites use HTTP/3 (W3Techs, 2026), but the vast majority of HTTP/3 traffic comes through CDNs — Cloudflare, Google, and Meta serve most HTTP/3 responses. Self-hosted HTTP/3 remains rare because it requires UDP support in network infrastructure (some corporate firewalls block UDP entirely) and server-side QUIC implementation. For most projects behind a CDN like Cloudflare or Vercel, HTTP/3 is enabled by default.

---

### Part 2: Interview Answer

HTTP/3 is HTTP running over QUIC — but the important part isn't "over UDP." QUIC is a transport protocol that reimplements TCP's guarantees per-stream, and that's what makes HTTP/3 fundamentally different.

TCP identifies connections by a 4-tuple: client IP, client port, server IP, server port. QUIC identifies connections by a Connection ID. When a mobile device switches from WiFi to cellular and gets a new IP address, the TCP connection breaks — the 4-tuple changed. QUIC's Connection ID stays the same, so the connection survives. The server doesn't care about the IP change. Before switching paths, QUIC probes the new path with PATH_CHALLENGE/PATH_RESPONSE frames. For privacy, Connection IDs rotate on migration to prevent cross-network tracking. The migration is transparent to the application — all streams continue without interruption.

QUIC combines the transport handshake and TLS 1.3 handshake into a single operation. A new QUIC connection costs 1 RTT — one fewer than TCP + TLS 1.3's 2 RTTs. A resumed connection costs 0 RTT — the client sends application data in the first QUIC packet. The tradeoff is replay vulnerability for 0-RTT data, same as TLS 1.3 0-RTT: captured requests can be replayed, so servers must protect non-idempotent operations.

The key architectural difference: QUIC streams are independent. A lost packet in stream 3 blocks only stream 3 — streams 1 and 5 continue unaffected. TCP can't do this because TCP guarantees in-order delivery for the entire connection, not per-stream. HTTP/2 inherited this TCP limitation. HTTP/3 eliminates it. The junior answer says "HTTP/3 uses UDP instead of TCP." The senior answer explains QUIC's per-stream reliability, connection migration via Connection IDs, and why moving to UDP was the only way to fix TCP-level head-of-line blocking.

---

### Part 3: Whiteboard / Live Coding

**QUIC connection establishment — new vs resumed:**

```
New QUIC connection (1 RTT):

Client                                              Server
  |--- Initial QUIC (ClientHello + crypto) --------->|  RTT 1
  |<-- Handshake (ServerHello + cert + finished) ----|
  |--- Handshake (finished) ----------------------->|
  |                                                  |
  |--- Application Data (encrypted) --------------->|  Data flows after 1 RTT

Compare TCP + TLS 1.3 (2 RTTs):
  |--- TCP SYN ----------------------------------->|
  |<-- TCP SYN-ACK --------------------------------|  RTT 1: TCP
  |--- TCP ACK + TLS ClientHello ----------------->|
  |<-- TLS ServerHello + cert + finished ----------|  RTT 2: TLS
  |--- TLS finished ------------------------------>|
  |--- Application Data -------------------------->|  Data flows after 2 RTTs

QUIC saves 1 RTT on new connections.
```

<!-- ILLUSTRATIVE: QUIC combines the transport and TLS handshake into a
single operation. A new connection costs 1 RTT instead of TCP + TLS 1.3's
2 RTTs. The combined handshake is possible because QUIC embeds TLS 1.3
directly — there's no separate transport layer to negotiate first. -->

```
Resumed QUIC connection (0 RTT):

Client                                              Server
  |--- Initial (ClientHello + PSK + early data) --->|  0 RTT: data sent immediately
  |<-- Handshake (finished) -----------------------|
  |--- Handshake (finished) ---------------------->|
  |<-- Application Data ---------------------------|

The client sends application data in the first QUIC packet.
No round trip waiting. Tradeoff: replay vulnerability.
```

<!-- ILLUSTRATIVE: On resumption, the client uses a cached Pre-Shared Key
and sends data in the first message — 0 RTT. Same replay tradeoff as
TLS 1.3 0-RTT: captured requests can be replayed. Servers must protect
non-idempotent operations. -->

**TCP head-of-line blocking vs QUIC per-stream independence:**

```
TCP connection, 3 HTTP/2 streams:

TCP Segment 1: [Stream 1 data] ✓ delivered
TCP Segment 2: [Stream 3 data] ✗ LOST
TCP Segment 3: [Stream 1 data] ✓ arrived, BLOCKED (waiting for segment 2)
TCP Segment 4: [Stream 5 data] ✓ arrived, BLOCKED (waiting for segment 2)
TCP Segment 5: [Stream 3 data] ✓ arrived, BLOCKED (waiting for segment 2)

Result: ALL streams blocked. Stream 1's data is ready but TCP must
deliver in order. Retransmit segment 2, then deliver 3, 4, 5.

QUIC connection, 3 HTTP/3 streams:

QUIC Packet 1: [Stream 1 data] ✓ delivered → Stream 1 complete
QUIC Packet 2: [Stream 3 data] ✗ LOST
QUIC Packet 3: [Stream 1 data] ✓ delivered → (Stream 1 already complete)
QUIC Packet 4: [Stream 5 data] ✓ delivered → Stream 5 complete
QUIC Packet 5: [Stream 3 data] ✓ delivered → retransmit needed

Result: Streams 1 and 5 delivered immediately. Only Stream 3 blocked.
Per-stream reliability: a lost packet affects only its own stream.
```

<!-- ILLUSTRATIVE: TCP delivers bytes in order for the entire connection —
a lost segment blocks all streams. QUIC delivers per-stream — a lost
packet blocks only the stream it belongs to. This is the fundamental
architectural difference between HTTP/2 (over TCP) and HTTP/3 (over QUIC). -->

**Connection migration — TCP vs QUIC:**

```
TCP connection (4-tuple: client IP:port, server IP:port):

WiFi:   Client(192.168.1.10:54321) ←→ Server(93.184.216.34:443)
        Connection identified by: (192.168.1.10, 54321, 93.184.216.34, 443)

Cellular: Client(10.0.0.5:54321) ←→ Server(93.184.216.34:443)
          New 4-tuple: (10.0.0.5, 54321, 93.184.216.34, 443)
          → TCP connection BROKEN. Must establish new connection.
          → New TCP handshake (1 RTT) + new TLS handshake (1 RTT) = 2 RTTs

QUIC connection (Connection ID):

WiFi:   Client(192.168.1.10:54321) ←→ Server(93.184.216.34:443)
        Connection ID: 0x4A3F...
        Connection identified by: Connection ID (not IP/port)

Cellular: Client(10.0.0.5:54321) ←→ Server(93.184.216.34:443)
          Same Connection ID: 0x4A3F...
          → QUIC connection CONTINUES. No new handshake.
          → Probe new path with PATH_CHALLENGE/PATH_RESPONSE
          → Application sees no interruption

Privacy: Connection ID rotates on migration to prevent tracking.
```

<!-- ILLUSTRATIVE: TCP connections break on network changes because they're
identified by IP/port 4-tuples. QUIC connections use Connection IDs, so
they survive IP changes. The server uses the Connection ID to find
connection state regardless of which IP the client is coming from.
Connection IDs rotate for privacy. -->

**QUIC stream independence — the mechanism:**

```
QUIC Connection with 3 streams:

Stream 1 (ID: 0): [DATA frame] [DATA frame] [FIN]
Stream 3 (ID: 2): [DATA frame] [DATA frame] [DATA frame] [FIN]
Stream 5 (ID: 4): [DATA frame] [FIN]

Each stream has its own flow control window.
Each stream's data is independent.
A lost packet in Stream 3 only retransmits Stream 3's data.
Streams 1 and 5 continue without interruption.

Compare HTTP/2 over TCP:
All streams share one TCP flow control window.
A lost TCP segment blocks all streams.
```

<!-- ILLUSTRATIVE: QUIC streams are independent at every level — flow
control, reliability, ordering. Each stream has its own state. This is
the architectural change that eliminates TCP-level head-of-line blocking. -->

---

### Part 4: Follow-Up Questions

**Q: Why did QUIC choose UDP instead of fixing TCP?**

TCP's in-order delivery guarantee is fundamental to its design — it's not a bug, it's the core contract. Fixing TCP-level head-of-line blocking would require breaking TCP's in-order guarantee, which would break every application that depends on it. UDP provides no transport semantics, so QUIC can build exactly the semantics it needs — per-stream reliability, per-stream ordering — without breaking anything. UDP was the only viable starting point because it's the only widely-deployed transport protocol that doesn't impose ordering or reliability constraints.

**Q: How does QUIC handle congestion control?**

QUIC implements the same congestion control algorithms as TCP — slow start, AIMD (additive increase, multiplicative decrease), and optionally BBR (Google's bandwidth-based algorithm). The difference: QUIC congestion control is per-connection but not per-stream. All streams share the same congestion window, so a burst of data from one stream affects the bandwidth available to others. But lost packets only affect the specific stream, not the delivery of other streams' data.

**Q: What about UDP being blocked by firewalls?**

This is the main deployment challenge for HTTP/3. Some corporate firewalls, NATs, and older network equipment block UDP traffic entirely, or rate-limit it. If UDP is blocked, the client falls back to HTTP/2 over TCP. The browser discovers HTTP/3 support through the `Alt-Svc` header — the first HTTP/2 response includes `alt-svc: h3=":443"`, telling the browser that QUIC is available. If the QUIC connection fails (UDP blocked), the browser continues with HTTP/2. This fallback is transparent to the user.

---

### Part 5: Common Mistakes

**Junior/mid answer:**
"HTTP/3 uses UDP instead of TCP to be faster. It's the next version of HTTP and it supports multiplexing like HTTP/2 but over UDP."

**Why this misses the point:** It reduces HTTP/3 to "HTTP/2 over UDP" without explaining what QUIC actually does. The junior answer doesn't mention per-stream reliability, doesn't explain connection migration via Connection IDs, doesn't know why UDP was necessary (TCP's in-order guarantee can't be fixed without breaking the contract), and doesn't cover 0-RTT or the replay tradeoff. "Faster" is vague — the senior answer names which specific problem it fixes and the mechanism.

**Senior answer:**
"HTTP/3 runs over QUIC, a transport protocol built on UDP. QUIC reimplements TCP's guarantees — reliability, ordering, congestion control — but per-stream rather than per-connection. A lost packet in one stream only blocks that stream; other streams continue unaffected. This fixes TCP-level head-of-line blocking, which HTTP/2 inherits because TCP guarantees in-order delivery for the entire connection. QUIC also enables connection migration: connections are identified by a Connection ID, not a 4-tuple, so a mobile device switching from WiFi to cellular keeps its connection without a new handshake. The combined QUIC + TLS handshake is 1 RTT for new connections and 0 RTT for resumption. 0-RTT has the same replay vulnerability as TLS 1.3 0-RTT — captured requests can be replayed, so servers must protect non-idempotent operations."

**The tell:** The junior answer says "UDP instead of TCP." The senior answer explains QUIC's per-stream reliability, connection migration, and why UDP was the only way to fix TCP-level head-of-line blocking.

---

### Part 6: Production Examples

A mobile-first social media app served content through Cloudflare. Their users were predominantly on mobile networks in regions with congested cellular infrastructure. Under HTTP/2, users experienced frequent "content loading" spinners during peak hours — not because the server was slow, but because TCP packet loss on congested networks triggered TCP-level head-of-line blocking. A single lost packet froze all streams on the connection. Cloudflare enabled HTTP/3 by default, and the spinners disappeared. The per-stream reliability of QUIC meant that packet loss affected only the specific stream it belonged to — other content continued loading. The improvement was most dramatic on 3G networks in Southeast Asia, where packet loss rates regularly exceed 5%.

A different team built a real-time collaboration tool (think: shared document editing). Under HTTP/2, when one user uploaded a large file, the upload stream consumed TCP bandwidth and caused head-of-line blocking for all other streams — cursor positions, text changes, and presence updates froze during the upload. Under HTTP/3, the upload stream and the real-time streams were independent. The upload could consume bandwidth without blocking the real-time updates. The collaboration experience went from "janky during uploads" to "smooth regardless of what other users are doing." This is the per-stream independence that QUIC provides — and it's the scenario where HTTP/3's difference is most visible.

---

## Tie the Chain Together

HTTP/1.1 established the request/response model that the web runs on. Its text-based, sequential design produced three performance problems at scale: head-of-line blocking on individual connections, header bloat from uncompressed full-header repetition, and the ceiling imposed by the six-connection workaround. Pipelining was supposed to help but failed because responses must arrive in request order.

HTTP/2 solved HTTP-level head-of-line blocking with binary framing and multiplexing — multiple streams sharing one connection with frames interleaved. HPACK header compression eliminated header bloat by using a shared dynamic table. Server Push was an attempt to eliminate a round trip by predicting client needs, but it was deprecated (Chrome 106, September 2022; Firefox 132, October 2024) because only 1.25% of sites used it, it pushed cached resources, and `103 Early Hints` replaced it more cleanly. The critical limitation remained: HTTP/2 still uses TCP, and TCP's in-order delivery guarantee means a lost segment blocks all streams — TCP-level head-of-line blocking.

HTTP/3 eliminated the TCP constraint by building on QUIC. QUIC reimplements TCP's guarantees — reliability, ordering, congestion control — per-stream over UDP. A lost packet blocks only its own stream. Connection migration via Connection IDs means connections survive network changes. The combined QUIC + TLS handshake reduces setup to 1 RTT (new) or 0 RTT (resumption). The progression is not arbitrary — each version exists because the previous version had a remaining bottleneck that required a protocol-level change to fix.

Session 22 covered the foundation: TCP handshake cost motivates multiplexing, TLS 1.3 RTT motivates 0-RTT, TCP head-of-line blocking motivates QUIC. This session completed the chain: HTTP/1.1 → HTTP/2 → HTTP/3, each version fixing what the previous couldn't.

---

## Cross-References

- Session 22 (`book/04-browser/22-dns-tcp-tls-https.md`) — DNS → TCP → TLS → HTTPS, the foundation this session builds on: TCP handshake cost → multiplexing motivation; TLS 1.3 RTT → 0-RTT motivation; TCP head-of-line blocking → QUIC motivation.
- Session 24 (`book/04-browser/24-caching-cookies-storage.md`) — Caching strategies, cookies, and web storage, the browser-side persistence layer.
- Session 25 (`book/04-browser/25-rendering-pipeline.md`) — Rendering pipeline: layout → paint → composite → GPU.
- Session 26 (`book/04-browser/26-reflow-repaint-critical-rendering-path.md`) — Reflow → repaint → critical rendering path.
