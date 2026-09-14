# Session 24 — Caching, Cookies, and Browser Storage

> **Module 4 — Browser.** Session 3 of 5.
> **Chain:** HTTP caching (freshness via Cache-Control, validation via ETag/Last-Modified, cache-busting with content hashes) → Cookies (attributes: Domain/Path/Secure/HttpOnly/SameSite, CSRF mitigation, third-party cookie deprecation) → Browser storage (localStorage, sessionStorage, IndexedDB, Cache API — tradeoffs, not just API surface).
> This session builds on Sessions 22-23: HTTP caching headers travel over HTTPS connections established in Session 22. HSTS from Session 22 is itself a form of cache — the browser caches the HSTS directive for the `max-age` duration. HTTP/2 and HTTP/3 from Session 23 use the same HTTP caching semantics as HTTP/1.1 — the caching layer doesn't change across protocol versions. Session 25 continues with the rendering pipeline.

<!-- Module 4 convention: This module covers browser internals and networking
protocols. Protocol flows, timing diagrams, and packet sequences are
ILLUSTRATIVE — syntactically valid and mentally traced but not executed in a
runtime environment. Spec-level claims are verified against RFC 9111 (HTTP
Caching), RFC 6265 (Cookies), the Storage specification, and MDN for
browser-observable behavior. Where a claim couldn't be verified inline,
it's marked with <!-- VERIFY -->. This convention applies to Sessions 22-26. -->

---

## Topic 1 — HTTP Caching

### Part 1: Theory

HTTP caching reduces network requests by storing responses and reusing them when the same request is made again. There are two distinct mechanisms — freshness and validation — and they solve different problems. A senior answer names both and explains how they work together, not just "the browser caches things."

**Freshness: `Cache-Control` and `max-age`.** The freshness model lets the browser serve a cached response without contacting the server at all. The server sends `Cache-Control: max-age=N`, and for N seconds after the response was received, the browser uses the cached copy without making any network request. This is the fastest possible path — zero latency, zero bandwidth. `s-maxage=N` is the same concept but for shared caches — CDNs and proxies. It overrides `max-age` for intermediaries, so the CDN caches for `s-maxage` seconds while the browser caches for `max-age` seconds. The `immutable` directive tells the browser the response will never change for the duration of `max-age` — the browser should not revalidate even on explicit refresh. This is critical for versioned assets (more on that below).

**Validation: `ETag` and `Last-Modified`.** The freshness model has a blind spot — what happens after the cache expires? The validation model lets the browser ask the server "has this changed?" without re-downloading the full response. The server sends an `ETag` (an opaque identifier, usually a hash of the content) or a `Last-Modified` timestamp. On the next request, the browser sends a conditional request: `If-None-Match: <etag>` or `If-Modified-Since: <timestamp>`. If the resource hasn't changed, the server returns `304 Not Modified` — no body, just headers. The browser uses its cached copy. If the resource has changed, the server returns `200 OK` with the new body. Validation avoids re-downloading unchanged content while still confirming freshness.

**The key directives — and the ones that matter in practice.** `max-age=N` — fresh for N seconds, no server contact. `s-maxage=N` — same but for shared caches. `no-cache` — the response CAN be cached but MUST be revalidated before every use. This is not "don't cache" — it's "always validate." `no-store` — don't cache at all, period. `must-revalidate` — once stale, don't serve the stale response even if the server is unreachable. `immutable` — the response won't change; don't revalidate on refresh. The `no-cache` vs `no-store` distinction is the most commonly confused pair in interviews: `no-cache` means "cache it but always check first," while `no-store` means "never cache it."

**Cache-busting with content hashes.** In production, the standard pattern for versioned assets is content-hash URLs. A file like `main.abc123.js` changes its URL when its content changes. This means you can serve it with `Cache-Control: max-age=31536000, immutable` — the browser caches it forever, knowing the URL will change when content changes. The HTML document itself gets `no-cache` so it's always revalidated, ensuring users get the latest HTML that points to the correct hashed asset URLs. Vite, webpack, and Next.js all use this pattern. It's the production answer to "how do you cache static assets aggressively without serving stale content."

**Stale-while-revalidate.** One more directive worth naming: `stale-while-revalidate=N`. The browser serves the stale cached response immediately (fast) and revalidates in the background. If the resource hasn't changed, the fresh copy replaces the stale one. If it has, the next request gets the fresh copy. This trades a brief window of stale content for eliminating the revalidation delay on the user's request.

---

### Part 2: Interview Answer

HTTP caching has two separate mechanisms, and the senior answer names both — freshness and validation — because they solve different problems.

Freshness is `Cache-Control: max-age`. The server says "this response is good for N seconds," and the browser serves the cached copy without any network request. Zero latency, zero bandwidth. `s-maxage` is the same but for CDNs and shared caches — it overrides `max-age` for intermediaries. `immutable` tells the browser the response will never change, so don't even revalidate on explicit refresh. This is what you want for versioned assets.

Validation is `ETag` and `Last-Modified`. After the cache expires, the browser sends a conditional request — `If-None-Match` with the ETag, or `If-Modified-Since` with the timestamp. If the resource hasn't changed, the server returns `304 Not Modified` with no body. The browser uses its cached copy. If it has changed, the server returns `200 OK` with the new body. Validation avoids re-downloading unchanged content while confirming freshness.

The directives that matter: `max-age` for freshness duration, `no-cache` which means "cache it but always revalidate before use" — not "don't cache" — and `no-store` which means genuinely don't cache at all. `must-revalidate` prevents serving stale content when the server is unreachable. `stale-while-revalidate` serves the stale response immediately and revalidates in the background, trading a brief staleness window for zero latency on the user's request.

The production pattern for static assets is content-hash URLs. A file like `main.abc123.js` changes its URL when its content changes, so you serve it with `max-age=31536000, immutable` — cached forever. The HTML gets `no-cache` so it's always revalidated, ensuring the latest HTML points to the correct hashed asset URLs. This is what Vite, webpack, and Next.js all do. The junior answer says "set Cache-Control headers." The senior answer names the two mechanisms, explains how they compose, and knows the production asset-cache-busting pattern.

---

### Part 3: Whiteboard / Live Coding

**Complete caching lifecycle — cold request through revalidation:**

```
Request 1: Cold request (no cache)

Client                                            Server
  |--- GET /app.js --------------------------------->|
  |<-- 200 OK (body)                                 |
  |    Cache-Control: max-age=3600                    |
  |    ETag: "abc123"                                 |
  |                                                   |
  | [Browser caches: response + ETag + timestamp]     |
  | [Fresh for 3600 seconds]                          |

Request 2: Within max-age (fresh, no request)

Client                                            Server
  | [Check cache: fresh — 3600s remaining]            |
  | [Serve from cache — NO network request]           |
  | → Zero latency, zero bandwidth                    |

Request 3: After max-age (stale, conditional request)

Client                                            Server
  | [Check cache: stale — expired]                    |
  |--- GET /app.js --------------------------------->|
  |    If-None-Match: "abc123"                        |
  |                                                   |
  | [Server checks: ETag matches, content unchanged]  |
  |<-- 304 Not Modified (no body) -------------------|
  |    Cache-Control: max-age=3600                    |
  |                                                   |
  | [Browser reuses cached copy, resets freshness]    |

Request 4: After max-age (changed content)

Client                                            Server
  | [Check cache: stale]                              |
  |--- GET /app.js --------------------------------->|
  |    If-None-Match: "abc123"                        |
  |                                                   |
  | [Server checks: ETag different — content changed] |
  |<-- 200 OK (new body) ----------------------------|
  |    ETag: "def456"                                 |
  |    Cache-Control: max-age=3600                    |
  |                                                   |
  | [Browser stores new response + new ETag]          |
```

<!-- ILLUSTRATIVE: The full lifecycle. Request 1 fetches and caches with
max-age. Request 2 serves from cache with zero network cost. Request 3
revalidates with a conditional request — 304 means unchanged, reuse cached
copy. Request 4 gets a fresh response because the ETag changed. -->

**Directive comparison — the ones that matter:**

```
Directive              | Behavior                                    | When to use
-----------------------|---------------------------------------------|---------------------------
max-age=N              | Fresh for N seconds, no server contact       | Versioned assets (JS/CSS/images)
s-maxage=N             | Same but for CDN/shared cache                | CDN-cached resources
immutable              | Won't change, skip revalidation on refresh  | Content-hashed assets
no-cache               | CAN cache, MUST revalidate before every use  | HTML documents, API metadata
no-store               | Don't cache at all                           | Sensitive data, personal info
must-revalidate        | Don't serve stale even if server unreachable | Critical assets that must be current
stale-while-revalidate | Serve stale, revalidate in background       | Non-critical assets where brief staleness is OK
```

<!-- ILLUSTRATIVE: The key Cache-Control directives and their practical
applications. no-cache is not "don't cache" — it's "always validate first."
no-store is genuinely "don't cache." The confusion between these two is
the most common interview mistake. -->

**Cache-busting with content hashes — the production pattern:**

```
Build output:
  index.html                          → no-cache (always revalidated)
  main.abc123.js                      → max-age=31536000, immutable
  vendor.def456.css                   → max-age=31536000, immutable
  logo.ghi789.png                     → max-age=31536000, immutable

Flow:
1. User requests index.html
   → Browser: cache miss or revalidated (no-cache)
   → Server: 200 OK with index.html

2. index.html references main.abc123.js
   → Browser: first visit, fetches main.abc123.js
   → Server: 200 OK, Cache-Control: max-age=31536000, immutable
   → Browser: cached for 1 year, never revalidates

3. Developer deploys new version
   → Build hashes change: main.xyz789.js (new content → new URL)
   → index.html updated to reference main.xyz789.js
   → Old main.abc123.js stays cached (harmless — no one requests it)
   → New main.xyz789.js is fetched once, cached for 1 year
```

<!-- ILLUSTRATIVE: Content-hash cache-busting. The HTML is always revalidated
(no-cache) so users get the latest version pointing to correct asset URLs.
Static assets use immutable + long max-age because their URLs change when
content changes. The old cached assets are never evicted — they're just
never requested again. This is the standard in Vite, webpack, and Next.js. -->

---

### Part 4: Follow-Up Questions

**Q: What's the difference between `no-cache` and `no-store`? I keep mixing them up.**

`no-cache` means the response CAN be stored in the cache, but it MUST be revalidated with the server before every use. The browser will cache it — it just won't serve it without asking the server first. `no-store` means don't store it in the cache at all. No copy, no revalidation, nothing — every request goes to the server. The mental model: `no-cache` is "trust but verify," `no-store` is "don't trust." Use `no-cache` for HTML documents where you want the caching benefits (reduced bandwidth on 304) but need to ensure freshness. Use `no-store` for truly sensitive data — banking transactions, personal health information, authentication tokens in the response body.

**Q: How does `must-revalidate` interact with offline scenarios?**

If a cached response has `must-revalidate` and the cache is stale, the browser will NOT serve the stale response even if the server is unreachable (network error, offline mode). It shows an error instead. Without `must-revalidate`, some browsers may serve stale content as a fallback when the server is unreachable — this is the "offline-first" behavior you sometimes want. `must-revalidate` says "always confirm freshness, no exceptions." Use it when serving stale content is worse than showing an error — think medical dosing information, financial rates, or security-critical assets.

**Q: Where does the Cache API fit in this picture?**

The Cache API is a separate interface used by Service Workers — it stores complete Request/Response pairs for offline caching. It's not the same as the HTTP cache (which is managed by the browser automatically based on Cache-Control headers). The Cache API gives you programmatic control: you decide exactly which requests to cache, when to serve from cache, and when to update. Service Workers intercept fetch events and can serve from the Cache API instead of the network. This is how Progressive Web Apps (PWAs) work offline. The HTTP cache is automatic and declarative; the Cache API is manual and programmatic.

**Q: What's the browser's actual caching algorithm when multiple directives conflict?**

The HTTP specification (RFC 9111) defines precedence rules. `no-store` overrides everything — if `no-store` is present, the response is not cached regardless of other directives. `no-cache` allows caching but requires revalidation. `max-age` and `Expires` are both freshness mechanisms — `max-age` takes precedence over `Expires` when both are present. `s-maxage` overrides `max-age` for shared caches only. The browser also has its own heuristics: if no `Cache-Control` header is present, the browser may use the `Last-Modified` timestamp to estimate a freshness lifetime (typically 10% of the time since last modification, capped at a browser-specific limit). This heuristic caching is why you should always set explicit `Cache-Control` headers — relying on heuristic caching produces unpredictable behavior across browsers.

---

### Part 5: Common Mistakes

**Junior/mid answer:**
"Caching is controlled by `Cache-Control` headers. You set `max-age` for how long to cache, and `no-cache` to prevent caching. For API responses, use `no-cache` to always get fresh data."

**Why this misses the point:** The junior answer gets `no-cache` backwards — it's not "prevent caching," it's "always revalidate before serving." A junior setting `no-cache` thinking it means "don't cache" would be confused when they see 304 responses in the network tab — the browser IS caching and revalidating. The junior answer also misses validation entirely — no mention of ETag, Last-Modified, or 304 responses. And there's no awareness of content-hash cache-busting as the production pattern for static assets.

**Senior answer:**
"HTTP caching has two mechanisms: freshness and validation. Freshness — `Cache-Control: max-age` — lets the browser serve cached responses without any network request until the TTL expires. Validation — ETag with `If-None-Match`, or Last-Modified with `If-Modified-Since` — lets the browser ask the server if the resource changed and get a 304 if it hasn't, avoiding re-downloading the body. The key distinction: `no-cache` means 'cache it but always revalidate before serving' — not 'don't cache.' `no-store` means genuinely don't cache. For static assets, the production pattern is content-hash URLs with `max-age=31536000, immutable` — the URL changes when content changes, so the browser caches it forever. The HTML gets `no-cache` so it's always revalidated, ensuring users get the latest HTML pointing to the correct asset URLs."

**The tell:** The senior answer names both mechanisms (freshness and validation), gets `no-cache` right, knows the content-hash pattern, and explains how HTML and assets are cached differently. The junior answer conflates `no-cache` with `no-store` and misses validation entirely.

---

### Part 6: Production Examples

A large media company's article pages loaded 40+ assets — images, CSS, JavaScript, fonts, and API responses. They set `Cache-Control: no-cache` on everything, thinking it meant "don't cache." The result: every asset was revalidated with the server on every page load. The server received 40+ conditional requests per page view — 40+ `If-None-Match` headers, 40+ ETag comparisons, 40+ 304 responses. The 304 responses were fast (no body transfer), but the server-side ETag comparison and header generation for 40+ resources per page load added up to significant CPU overhead. The fix: `Cache-Control: max-age=3600` for static assets (images, CSS, JS, fonts) and `no-cache` only for the HTML document. The server load dropped by 90% and page load time on repeat visits dropped from 1.2 seconds to 200ms because assets were served from the browser cache without any network request.

A different team built a financial dashboard with real-time stock prices. They used `Cache-Control: no-store` on API responses to ensure freshness. The dashboard made 60 API calls per page load, every 30 seconds, all hitting the server with no caching. The server infrastructure scaled to handle the load, but the bandwidth cost was enormous — 60 requests × 300 users × 60 times per hour = over a million requests per hour, all with full response bodies. The fix: `Cache-Control: max-age=5` for stock price responses. The browser would serve the cached 5-second-old price for most requests, and only re-fetch every 5 seconds. For a real-time dashboard, 5-second-old data is acceptable — the UI updates smoothly, and the server load dropped by 80%.

---

## Topic 2 — Cookies

### Part 1: Theory

Cookies are small pieces of data the server tells the browser to store and send back with subsequent requests. The junior answer describes cookies as "small text files." The senior answer knows that cookies have six attributes that control scope, lifetime, security, and cross-site behavior — and getting any of them wrong creates real security vulnerabilities.

**The six attributes:**

**`Domain`** — Which domains the cookie is sent to. If set to `.example.com`, the cookie is sent to `example.com` and all subdomains (`api.example.com`, `cdn.example.com`). If omitted, the cookie is only sent to the exact domain that set it. The leading dot is a historical convention — modern browsers treat the absence of `Domain` as host-only (exact match), and the presence as domain-match (including subdomains).

**`Path`** — Which paths within the domain the cookie is sent to. `Path=/api` means the cookie is sent to `/api`, `/api/users`, `/api/posts`, etc. The cookie is NOT sent to `/dashboard` or `/settings`. Combined with `Domain`, these two attributes define the scope of the cookie — which requests include it.

**`Expires` / `Max-Age`** — Lifetime. `Expires` is an absolute timestamp; `Max-Age` is a relative number of seconds. If both are set, `Max-Age` takes precedence. If neither is set, the cookie is a "session cookie" — it's deleted when the browser closes. Session cookies don't persist across browser restarts.

**`Secure`** — The cookie is only sent over HTTPS connections. If the page is loaded over HTTP, the cookie is not included in the request. This prevents network eavesdroppers from reading the cookie in transit.

**`HttpOnly`** — The cookie is not accessible to JavaScript. `document.cookie` won't include it. This prevents XSS attacks from stealing session cookies — even if an attacker injects a script, they can't read an `HttpOnly` cookie.

**`SameSite`** — Controls when the cookie is sent in cross-site requests. This is the most important attribute for security and the most commonly misunderstood. Three values:

- `Strict` — The cookie is never sent in cross-site requests. If a user clicks a link from `evil.com` to `example.com`, the cookie is NOT included. This is the most restrictive — it breaks some legitimate flows (email links, social media links) because the first request from the cross-site context won't have the cookie.

- `Lax` — The default since Chrome 80 (February 2020). The cookie IS sent on top-level navigations (clicking a link to the site) but NOT on cross-origin subresource requests (images, scripts, iframes loaded from another site). This is the right default for most session cookies — it allows users to arrive at your site from links while still blocking cross-site request forgery.

- `None` — The cookie IS sent in all contexts, including cross-origin requests. Requires `Secure` — you can't set `SameSite=None` without `Secure`. This is the legacy behavior for third-party cookies: tracking pixels, embedded analytics, cross-site login flows.

**CSRF and SameSite.** CSRF (Cross-Site Request Forgery) is an attack where a malicious site tricks a user's browser into making a request to your site. If the user is authenticated (has a session cookie), the request includes the cookie and appears legitimate. `SameSite=Lax` is the primary defense: cross-origin subresource requests (the mechanism CSRF typically uses) don't include the cookie. The user arrives at the malicious site, the site makes a POST request to your API — no cookie, request rejected. `SameSite=Strict` would block the cookie even on top-level navigations, which is too restrictive for most applications.

**Third-party cookie deprecation.** Browsers have been phasing out third-party cookies — cookies sent in cross-site contexts where `SameSite=None`. Chrome has been leading this effort, initially planning full removal and now implementing it through the Privacy Sandbox initiative. Safari (ITP) and Firefox (ETP) already block third-party cookies aggressively. The replacement mechanisms include the Storage Access API (for embeds that need cross-site access), CHIPS (Cookies Having Independent Partitioned State, which partitions cookies by top-level site), and the Topics API (for interest-based advertising without cross-site cookies). For developers, the impact is: any code relying on third-party cookies for authentication or tracking needs to migrate to partitioned cookies (`Partitioned` attribute) or first-party alternatives.

---

### Part 2: Interview Answer

Cookies have six attributes that control scope, lifetime, and security — and the SameSite attribute is the most important for security interviews.

Domain and Path define which requests include the cookie. Domain controls which hostnames — `.example.com` includes the domain and all subdomains. Path controls which paths — `/api` includes `/api/users` but not `/dashboard`. Together they define the cookie's scope.

Secure sends the cookie only over HTTPS. HttpOnly prevents JavaScript access — `document.cookie` won't include it — which is the primary XSS mitigation for session cookies. Even if an attacker injects a script, they can't exfiltrate the cookie. Max-Age controls lifetime — if neither Max-Age nor Expires is set, it's a session cookie deleted when the browser closes.

SameSite is where the real security story lives. Three values: Strict never sends the cookie in cross-site requests — too restrictive for most apps because email links and social media links won't include it. Lax, the default since Chrome 80, sends the cookie on top-level navigations but not on cross-origin subresource requests. This is the primary CSRF mitigation: a malicious site can make a POST to your API, but the browser won't include the cookie because it's a cross-origin subresource request. None sends the cookie in all contexts but requires Secure — it's the legacy third-party cookie behavior.

Third-party cookies are being deprecated. Chrome is implementing it through the Privacy Sandbox. Safari and Firefox already block them aggressively. The replacement is partitioned cookies via the `Partitioned` attribute — cookies scoped to the top-level site rather than the embedded site. If you're relying on third-party cookies for cross-site authentication or tracking, you need to migrate. The junior answer says "cookies store user data." The senior answer names all six attributes, knows SameSite=Lax as the default and CSRF mitigation, and understands the third-party cookie deprecation landscape.

---

### Part 3: Whiteboard / Live Coding

**Cookie attributes and their scope:**

```
Set-Cookie: session=abc123; Domain=.example.com; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=86400

Breakdown:
  Name:       session
  Value:      abc123
  Domain:     .example.com         → Sent to example.com + all subdomains
  Path:       /                    → Sent to all paths
  Secure:     true                 → Only over HTTPS
  HttpOnly:   true                 → JavaScript cannot access
  SameSite:   Lax                  → Sent on top-level nav, not cross-origin subresource
  Max-Age:    86400                → Expires in 24 hours
```

<!-- ILLUSTRATIVE: A well-configured session cookie. All six attributes
working together. Domain + Path define scope. Secure + HttpOnly provide
transport and script protection. SameSite prevents CSRF. Max-Age controls
lifetime. -->

**SameSite behavior across request types:**

```
Scenario: User on evil.com clicks link to example.com

Top-level navigation (clicking <a href="https://example.com">):
  SameSite=Strict: Cookie NOT sent  ← breaks email links
  SameSite=Lax:    Cookie SENT      ← works correctly
  SameSite=None:   Cookie SENT

Cross-origin subresource (evil.com loads <img src="https.example.com/api/avatar">):
  SameSite=Strict: Cookie NOT sent
  SameSite=Lax:    Cookie NOT sent  ← CSRF protection
  SameSite=None:   Cookie SENT      ← vulnerable to CSRF

Cross-origin form POST (evil.com submits <form action="https.example.com/transfer">):
  SameSite=Strict: Cookie NOT sent
  SameSite=Lax:    Cookie NOT sent  ← CSRF protection
  SameSite=None:   Cookie SENT      ← vulnerable to CSRF

Cross-origin fetch/XMLHttpRequest from evil.com:
  SameSite=Strict: Cookie NOT sent
  SameSite=Lax:    Cookie NOT sent  ← CSRF protection
  SameSite=None:   Cookie SENT      ← vulnerable to CSRF
```

<!-- ILLUSTRATIVE: SameSite controls which cross-site contexts include
the cookie. Lax allows top-level navigation (links) but blocks subresource
and form submissions — this is the CSRF mitigation. Strict blocks
everything cross-site, which is too restrictive for most apps. None
allows everything but requires Secure. -->

**CSRF attack and defense flow:**

```
Without SameSite (or SameSite=None):
  1. User logs into bank.com (session cookie set)
  2. User visits evil.com
  3. evil.com contains: <form action="https://bank.com/transfer" method="POST">
       <input name="to" value="attacker">
       <input name="amount" value="10000">
     </form>
     <script>document.forms[0].submit()</script>
  4. Browser sends POST to bank.com WITH session cookie
  5. Bank sees authenticated request → transfers money
  → CSRF attack succeeds

With SameSite=Lax (default):
  1. User logs into bank.com (session cookie set)
  2. User visits evil.com
  3. evil.com submits form to bank.com
  4. Browser sends POST to bank.com WITHOUT session cookie (cross-origin subresource)
  5. Bank sees unauthenticated request → rejects
  → CSRF attack blocked

SameSite=Lax = primary CSRF defense in modern browsers
```

<!-- ILLUSTRATIVE: SameSite=Lax blocks CSRF by refusing to send the cookie
on cross-origin form submissions and subresource requests. The bank sees
an unauthenticated request and rejects it. This is why SameSite=Lax as the
default is a major security improvement — it eliminates the most common
CSRF vector without any application-level token system. -->

---

### Part 4: Follow-Up Questions

**Q: If SameSite=Lax is the default, do we still need CSRF tokens?**

SameSite=Lax blocks the most common CSRF vectors — cross-origin form submissions and subresource requests. But it doesn't block top-level navigations with unsafe methods. If an attacker can craft a link that triggers a GET request with side effects (which is a design smell, but exists in legacy systems), SameSite=Lax won't help — it allows cookies on top-level GET navigations. Also, older browsers may not support SameSite or may default to `None`. Defense in depth means using SameSite=Lax AND CSRF tokens for sensitive operations. SameSite is the first line of defense; tokens are the second.

**Q: What's the difference between `Domain=.example.com` and no Domain attribute?**

Without the `Domain` attribute, the cookie is host-only — it's only sent to the exact hostname that set it. `example.com` sets a cookie, it's only sent to `example.com`, not to `api.example.com`. With `Domain=.example.com`, the cookie is sent to `example.com` AND all subdomains. The tradeoff: host-only cookies are more scoped (a subdomain can't see cookies set by the parent domain), while domain cookies are shared across subdomains (useful for single sign-on across subdomains).

**Q: How do partitioned cookies (`Partitioned`) work?**

Partitioned cookies solve the third-party cookie problem for legitimate use cases. Instead of a cookie being scoped to the domain that set it (e.g., `analytics.com`), a partitioned cookie is scoped to the top-level site that embedded the content. If `site-a.com` embeds an iframe from `analytics.com`, the cookie is stored under `site-a.com → analytics.com`. If `site-b.com` embeds the same iframe, it gets a different cookie. The cookie is partitioned by the top-level context. This prevents cross-site tracking (analytics.com can't correlate users across site-a.com and site-b.com) while allowing embedded content to function (analytics.com can still read its own cookie within site-a.com).

**Q: What happens to cookies on a redirect?**

A redirect chain (301, 302, 307, 308) can cause cookies to be leaked to unintended domains. If `example.com` redirects to `evil.com`, and `example.com` has cookies with `Domain=.example.com`, those cookies are NOT sent to `evil.com` because the domain doesn't match. But if the redirect is to a subdomain that matches the cookie's Domain attribute, the cookies ARE sent. This is a real concern in open redirect vulnerabilities — a redirect to a matching domain leaks cookies. The `Secure` attribute helps (no cookies over HTTP), and `SameSite` helps (cross-site redirects don't send cookies under Lax for non-GET requests). But the safest mitigation is validating redirect targets server-side.

---

### Part 5: Common Mistakes

**Junior/mid answer:**
"Cookies store user preferences and session data. You should always use `HttpOnly` and `Secure` flags. SameSite prevents cross-site requests."

**Why this misses the point:** The junior answer names two security attributes (`HttpOnly` and `Secure`) without knowing what they specifically protect against — `HttpOnly` prevents JavaScript access (XSS mitigation), `Secure` prevents HTTP transmission (eavesdropping mitigation). SameSite isn't described with its three values or their behavioral differences — "prevents cross-site requests" is vague when `Lax` allows top-level navigations. The junior answer doesn't know `Lax` is the default, doesn't know `None` requires `Secure`, and doesn't understand the third-party cookie deprecation landscape.

**Senior answer:**
"Cookies have six attributes. Domain and Path define scope — which requests include the cookie. Secure sends only over HTTPS. HttpOnly prevents JavaScript access — the primary XSS mitigation for session cookies. Max-Age controls lifetime; without it, session cookies are deleted on browser close. SameSite controls cross-site behavior with three values: Strict never sends in cross-site requests (too restrictive for most apps), Lax — the default since Chrome 80 — sends on top-level navigations but not cross-origin subresource requests, making it the primary CSRF mitigation, and None sends in all contexts but requires Secure. Third-party cookies are being deprecated — Chrome through Privacy Sandbox, Safari and Firefox already blocking them. The replacement is partitioned cookies via the `Partitioned` attribute, which scopes cookies to the top-level site instead of the embedded domain."

**The tell:** The senior answer names all six attributes, explains what each one protects against, knows `Lax` is the default and why, and understands the third-party cookie deprecation. The junior answer mentions `HttpOnly` and `Secure` as a checklist without explaining their mechanisms.

---

### Part 6: Production Examples

A SaaS platform used `SameSite=None; Secure` on their session cookies to support cross-site authentication — their main app at `app.example.com` embedded widgets from `widget.example.com`. When Chrome 80 changed the default to `SameSite=Lax`, their embedded widgets stopped sending session cookies. Users saw "unauthenticated" errors inside the embedded widgets. The team had two options: migrate to `Partitioned` cookies (which would scope cookies to the embedding site) or re-architect the widgets to use a first-party proxy. They chose the proxy: `app.example.com` served the widget content through a reverse proxy, keeping everything first-party. The session cookie was always sent because the requests were same-origin. The lesson: `SameSite=Lax` as the default breaks cross-site cookie usage by design. If you need cross-site cookies, you need an explicit migration plan.

A different team discovered that their analytics tracker — a third-party script loaded on customer sites — relied on third-party cookies to track users across domains. When Safari's ITP (Intelligent Tracking Prevention) started blocking third-party cookies, their analytics broke. Users were counted as new visitors on every page load because the tracking cookie wasn't sent. The fix was to move to first-party analytics: the customer's server set the analytics cookie, and the analytics script read it from the first-party context. This required each customer to add a first-party analytics endpoint to their server — more complex than dropping a script tag, but it worked across all browsers. The deprecation of third-party cookies forced the migration from a simple but fragile pattern to a more complex but robust one.

---

## Topic 3 — Browser Storage

### Part 1: Theory

Browser storage lets JavaScript persist data beyond a single page load. There are four mechanisms — localStorage, sessionStorage, IndexedDB, and the Cache API — and they differ in persistence, capacity, API design, and performance characteristics. The junior answer lists them. The senior answer names the tradeoffs that determine which one to use in which situation.

**localStorage** — Synchronous, origin-scoped, persistent. Data survives browser restarts, tab closures, and browser updates. Capacity is roughly 5MB per origin (varies by browser). The API is synchronous: `localStorage.getItem('key')` and `localStorage.setItem('key', value)` block the main thread until the read or write completes. For small reads and writes (a few hundred bytes), this is imperceptible. For large datasets — reading a 2MB JSON blob from localStorage — it can block the main thread for tens of milliseconds. On a fast desktop machine, this is negligible. On a slow mobile device with a large stored dataset, it causes jank. This is the primary reason to reach for IndexedDB at scale.

**sessionStorage** — Same synchronous API as localStorage, but scoped to the tab session. Data is lost when the tab closes. Two tabs with the same origin have separate sessionStorage instances — data in one tab isn't visible to the other. This is useful for per-tab state: multi-step forms, temporary filters, wizard-style flows where you don't want tab A's state leaking into tab B.

**IndexedDB** — Asynchronous, origin-scoped, persistent. Capacity is much larger — typically 50% of available disk space per origin, with a minimum of 256MB in most browsers. The API is transactional: reads and writes happen inside database transactions, and multiple operations can be batched efficiently. The API is asynchronous — `getIDBRequest()` returns a request object, and results arrive via events or promises (the `idb` library wraps this in a promise-based API). IndexedDB supports structured data (not just strings — objects, arrays, binary blobs) and indexed queries (you can create indexes on object properties and query efficiently). This is the right choice for anything beyond a few KB of simple key-value pairs.

**Cache API** — Used by Service Workers to store complete Request/Response pairs. It's not the same as the HTTP cache (which is managed by the browser based on Cache-Control headers). The Cache API is a separate, programmatic interface: you decide which requests to cache, when to serve from cache, and when to update. Service Workers intercept `fetch` events and can serve responses from the Cache API instead of the network. This is how Progressive Web Apps (PWAs) work offline — the Cache API stores the app shell and critical resources. The Cache API is not designed for general-purpose data storage — it stores HTTP request/response pairs, not arbitrary JavaScript objects.

**Origin isolation.** All four mechanisms are origin-scoped: `https://example.com` and `https://api.example.com` are different origins with separate storage. `http://example.com` and `https://example.com` are also different origins (protocol difference). This is a security boundary — one origin cannot access another origin's storage. The exception: `localStorage` can be accessed by subframes if they have the same origin and the parent doesn't set `X-Frame-Options` to prevent framing. But the general rule holds: same origin, same storage; different origin, different storage.

**Persistence.** localStorage persists across browser restarts. sessionStorage is cleared when the tab closes. IndexedDB persists — data survives restarts. Cache API entries persist — Service Workers can read them on the next visit. But all four can be evicted by the browser in low-storage conditions: the browser may clear site data to reclaim space, and the user can manually clear storage. Don't treat any of these as a reliable database for critical data — they're caches, not sources of truth.

---

### Part 2: Interview Answer

Browser storage has four mechanisms, and the tradeoffs that matter are synchronous vs asynchronous, persistence characteristics, and capacity.

localStorage is synchronous and blocks the main thread. Every `getItem` and `setItem` call is a synchronous operation — the browser can't do anything else while it reads or writes. For a few hundred bytes, it's imperceptible. For large datasets — reading a 2MB JSON blob — it can block the main thread for tens of milliseconds, causing jank on mobile. Data persists across browser restarts. Capacity is roughly 5MB per origin.

sessionStorage has the same synchronous API but is tab-scoped. Two tabs with the same origin have separate instances. Data is lost when the tab closes. This is useful for per-tab state — multi-step forms, temporary filters, wizard flows where you don't want tab A's state leaking into tab B.

IndexedDB is asynchronous and transactional. The API is event-driven — reads and writes happen inside transactions, and results arrive asynchronously. The `idb` library wraps this in a promise-based API. Capacity is large — 50% of available disk space, minimum 256MB in most browsers. It supports structured data and indexed queries. This is the right choice for anything beyond a few KB of simple key-value pairs, because it doesn't block the main thread.

The Cache API is used by Service Workers to store complete Request/Response pairs — it's how PWAs work offline. It's not for general-purpose data storage. All four mechanisms are origin-scoped — one origin can't access another's storage. localStorage persists across restarts; sessionStorage doesn't; IndexedDB persists; Cache API entries persist but can be evicted by the browser in low-storage conditions.

The junior answer says "localStorage stores data." The senior answer names the synchronous blocking issue as the reason to reach for IndexedDB at scale, knows sessionStorage's tab isolation, and understands Cache API as the Service Worker interface, not a general storage mechanism.

---

### Part 3: Whiteboard / Live Coding

**Storage comparison:**

```
Mechanism      | API Style  | Persistence       | Capacity   | Data Type        | Isolation
---------------|------------|-------------------|------------|------------------|-------------
localStorage   | Synchronous| Across restarts   | ~5MB       | Strings only     | Origin
sessionStorage | Synchronous| Tab session       | ~5MB       | Strings only     | Origin + Tab
IndexedDB      | Async      | Across restarts   | 50%+ disk  | Structured/Blobs | Origin
Cache API      | Async      | Across restarts   | Varies     | Request/Response | Origin
```

<!-- ILLUSTRATIVE: The four storage mechanisms and their key tradeoffs.
The synchronous vs asynchronous distinction is the primary reason to
choose IndexedDB over localStorage for anything beyond small datasets. -->

**When to use which — decision tree:**

```
Is this HTTP request/response data for offline caching?
  → Yes: Cache API (via Service Worker)

Is this more than a few KB of data?
  → Yes: IndexedDB (async, doesn't block main thread)

Is this per-tab temporary state (form wizard, filters)?
  → Yes: sessionStorage (tab-scoped, lost on close)

Is this small user preferences (theme, language, settings)?
  → Yes: localStorage (simple, persistent, synchronous is fine)

Is this critical application state that must survive browser updates?
  → Be cautious: all storage can be evicted — treat as cache, not source of truth
```

<!-- ILLUSTRATIVE: The decision tree for choosing a storage mechanism.
localStorage is for small, persistent key-value pairs. IndexedDB is for
larger or structured data. sessionStorage is for tab-scoped temporary
state. Cache API is for Service Worker offline caching. -->

**localStorage synchronous blocking — what it looks like:**

```
Main thread timeline (slow device, large dataset):

|--- Render frame ---|--- localStorage.getItem('bigData') ---|--- Render frame ---|
                     ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
                     Main thread blocked. Frame dropped.

If 'bigData' is 2MB JSON:
  Blocking time: ~30-50ms on slow mobile device
  Dropped frames: 2-3 frames at 60fps
  User perceives: jank/stutter

IndexedDB equivalent:
|--- Render frame ---|--- IDB request (async) ---|--- Render frame ---|
                     ^^^^^^^^^^^^^^^^^^^^^^^^^^^^
                     Main thread free. No frames dropped.
                     Result arrives via event, processed in next tick.
```

<!-- ILLUSTRATIVE: localStorage's synchronous API blocks the main thread
during reads and writes. On a fast desktop machine, the blocking is
imperceptible. On a slow mobile device with a large dataset, it causes
visible jank. IndexedDB's asynchronous API doesn't block — the request
fires in the background and the result arrives via an event. -->

**IndexedDB transaction flow:**

```typescript
// Opening a database
const request = indexedDB.open('myDB', 1);

request.onupgradeneeded = (event) => {
  const db = request.result;
  const store = db.createObjectStore('users', { keyPath: 'id' });
  store.createIndex('email', 'email', { unique: true });
};

// Reading data (async, transactional)
const db = request.result;
const tx = db.transaction('users', 'readonly');
const store = tx.objectStore('users');
const getRequest = store.get(123); // IDBRequest - async

getRequest.onsuccess = () => {
  const user = getRequest.result; // { id: 123, name: '...', email: '...' }
  // Process asynchronously — main thread not blocked
};

// Writing data (async, batched)
const tx = db.transaction('users', 'readwrite');
const store = tx.objectStore('users');
store.put({ id: 456, name: 'New User', email: 'new@example.com' });
store.put({ id: 789, name: 'Another', email: 'another@example.com' });
// Both writes happen in one transaction — efficient batching
tx.oncomplete = () => { /* Both writes done */ };
```

<!-- ILLUSTRATIVE: IndexedDB operations are transactional and asynchronous.
The database is opened asynchronously, reads return IDBRequest objects whose
results arrive via events, and writes are batched in transactions. The
main thread is never blocked. The `idb` library wraps this in promises for
a cleaner API. -->

---

### Part 4: Follow-Up Questions

**Q: What's the actual size limit for localStorage?**

The HTML spec doesn't mandate a specific limit — it's browser-defined. Most browsers set 5MB per origin (Chrome, Firefox, Safari). Some browsers allow up to 10MB. But the real limit isn't the storage cap — it's performance. Reading or writing large values synchronously blocks the main thread. A 1MB localStorage read takes roughly 10-50ms depending on the device, which drops frames at 60fps. For anything beyond a few KB, IndexedDB is the better choice because it doesn't block the main thread.

**Q: Can you use localStorage across subdomains?**

No — localStorage is scoped to the exact origin (protocol + hostname + port). `https://example.com` and `https://app.example.com` are different origins with separate localStorage instances. If you need cross-subdomain data sharing, you'd need to use cookies (which can be scoped to `.example.com`), or an iframe-based communication channel, or an API that stores data server-side. This is a common misconception — people assume `Domain=.example.com` applies to localStorage like it does to cookies, but it doesn't.

**Q: How does IndexedDB handle concurrent access?**

IndexedDB uses optimistic concurrency. Transactions are started with a mode — `readonly` or `readwrite`. Multiple `readonly` transactions can run concurrently. A `readwrite` transaction has exclusive access to its object store — no other transactions can access that store simultaneously. If two tabs try to write to the same object store, one will fail with a `QuotaExceededError` or `TransactionInactiveError` depending on the timing. The browser doesn't lock IndexedDB across tabs — each tab has its own connection, and the browser handles coordination. In practice, for most single-user applications, you don't need to worry about this. For multi-user or multi-tab write-heavy applications, you need a conflict resolution strategy.

**Q: What's the relationship between the Cache API and the HTTP cache?**

They're completely separate. The HTTP cache is managed by the browser automatically — it stores responses based on Cache-Control headers, and the browser decides when to serve from cache vs revalidate. You can't programmatically control it. The Cache API is a separate interface that Service Workers use to store Request/Response pairs. You control exactly what's cached, when it's served, and when it's updated. A Service Worker can intercept a fetch, check the Cache API, and serve from there instead of the network. The HTTP cache is automatic and declarative; the Cache API is manual and programmatic. They're complementary — the HTTP cache handles normal browsing, the Cache API handles offline-first scenarios.

---

### Part 5: Common Mistakes

**Junior/mid answer:**
"There are three browser storage mechanisms: localStorage, sessionStorage, and IndexedDB. localStorage persists across sessions, sessionStorage is cleared when the tab closes, and IndexedDB can store large amounts of data."

**Why this misses the point:** The junior answer lists the three mechanisms without naming the tradeoffs that determine which one to use. It doesn't mention that localStorage is synchronous and blocks the main thread — the primary reason to reach for IndexedDB. It doesn't mention that both localStorage and sessionStorage only store strings (you need `JSON.stringify`/`JSON.parse` for objects). It doesn't mention the Cache API as a fourth mechanism used by Service Workers. And it doesn't mention origin isolation — that different origins have separate storage.

**Senior answer:**
"Browser storage has four mechanisms. localStorage is synchronous and blocks the main thread — every read and write is synchronous, which causes jank on mobile with large datasets. It persists across restarts, about 5MB per origin, and only stores strings. sessionStorage has the same API but is tab-scoped — lost when the tab closes, separate per-tab. IndexedDB is asynchronous and transactional — reads and writes happen in transactions, results arrive via events, and the main thread is never blocked. Capacity is 50%+ of disk space, supports structured data and indexed queries. The Cache API is used by Service Workers to store Request/Response pairs for offline caching — it's not for general-purpose data storage. The synchronous blocking issue with localStorage is the primary reason to use IndexedDB for anything beyond a few KB. All mechanisms are origin-scoped — different origins can't access each other's storage."

**The tell:** The junior answer lists mechanisms without tradeoffs. The senior answer names the synchronous blocking issue, explains when to use which, mentions the Cache API, and knows about origin isolation.

---

### Part 6: Production Examples

A team built a todo application that stored all tasks in localStorage. The app accumulated data over months — 500+ tasks with descriptions, subtasks, and metadata. The serialized JSON grew to 800KB. On desktop, the app was fine. On mobile, every save operation blocked the main thread for 50-80ms, causing visible jank — the input field would freeze momentarily after each keystroke that triggered a save. The fix was migrating to IndexedDB. The same data was stored asynchronously — the save operation fired in the background, the UI stayed responsive, and the main thread was never blocked. The migration took a day because the data model was simple key-value pairs that mapped cleanly to IndexedDB's object store.

A different team built a multi-step checkout flow using sessionStorage. The form had 12 steps across 4 pages, with complex conditional logic. Data was stored in sessionStorage so users could close a tab and return later to continue. But sessionStorage doesn't persist across tab closures — users lost their progress every time they closed the tab. The team moved the in-progress checkout to the server (saved as a draft) and kept only the current step's state in sessionStorage for tab-level isolation. The lesson: sessionStorage is for ephemeral tab-scoped state, not for data the user expects to persist.

---

## Tie the Chain Together

HTTP caching reduces network requests for resources that haven't changed — freshness avoids the round trip entirely, validation avoids re-downloading unchanged content. The two mechanisms compose: `Cache-Control: max-age` handles the freshness window, and ETag/Last-Modified handles revalidation after expiry. Content-hash cache-busting is the production pattern where static assets get aggressive caching (`immutable` + long `max-age`) and HTML gets revalidation (`no-cache`), ensuring users always get the latest code.

Cookies persist authenticated state across requests, with SameSite as the primary CSRF defense. `SameSite=Lax` — the default since Chrome 80 — blocks cross-site form submissions and subresource requests while allowing top-level navigations, which is the right balance for most session cookies. The third-party cookie deprecation is reshaping how cross-site authentication and tracking work, with partitioned cookies (`Partitioned`) as the replacement mechanism.

Browser storage persists data between sessions, with the synchronous vs asynchronous split determining which mechanism to use. localStorage is fine for small user preferences; IndexedDB is the right choice for anything beyond a few KB because it doesn't block the main thread. The Cache API is a separate interface for Service Worker offline caching, not general-purpose storage.

Session 25 continues with the rendering pipeline — how the browser turns the resources fetched and cached in this session into pixels on screen.

---

## Cross-References

- Session 22 (`book/04-browser/22-dns-tcp-tls-https.md`) — DNS, TCP, TLS, HTTPS. HSTS is a form of cache — the browser caches the HSTS directive for the `max-age` duration. HTTP caching headers travel over TLS connections established in Session 22.
- Session 23 (`book/04-browser/23-http-versions.md`) — HTTP/1.1, HTTP/2, HTTP/3. HTTP caching semantics are consistent across protocol versions — the caching layer doesn't change between HTTP/1.1, HTTP/2, and HTTP/3.
- Session 25 (`book/04-browser/25-rendering-pipeline.md`) — Rendering pipeline: layout → paint → composite → GPU. Continues Module 4.
- Session 26 (`book/04-browser/26-reflow-repaint-critical-rendering-path.md`) — Reflow → repaint → critical rendering path.
