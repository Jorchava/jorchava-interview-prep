# Browser Parsing and DOM Construction

> How the HTML parser turns bytes into a tree, why synchronous scripts freeze that process, which loading strategies fix it, and what the browser builds from the result. This session picks up where Session 5 (`01-javascript-mastery/05-event-loop-microtasks-macrotasks.md`) left off: that session explained why synchronous JavaScript blocks the thread. This session is the HTML side of that same story — what happens when the parser encounters a `<script>` and what happens to parsing while it runs. Session 9 (`02-html-mastery/09-semantic-html-accessibility-seo.md`) referenced how crawlers parse HTML and use structural elements. This session goes under that to explain how the browser itself constructs the DOM — the same process crawlers run.

---

## 1. How the HTML Parser Works

### Part 1 — Theory

The HTML parser is not a simple regex or line-by-line reader. It is a state machine defined by the WHATWG HTML specification, and its job is to turn a byte stream into a DOM tree. The process has two phases: tokenization and tree construction.

**Tokenization** is the first phase. The parser reads raw bytes and produces a stream of tokens: doctype tokens, start tags, end tags, text, comments, and EOF. Each token carries its tag name, attributes, and self-closing flag. The tokenizer is itself state-driven — it starts in the "data" state, transitions to the "tag open" state when it sees `<`, transitions to the "tag name" state when it reads the element name, and so on. The spec defines dozens of these states and the exact transitions between them.

**Tree construction** is the second phase. The tree constructor takes the token stream and builds the DOM tree by maintaining a stack of open elements. When it receives a start tag, it creates an element node, appends it as a child of the current node, and pushes it onto the stack. When it receives an end tag, it pops the stack. The stack matters because HTML is hierarchical — a `<p>` inside a `<div>` means the `<p>`'s parent is the `<div>`, and the stack tracks that nesting.

The spec also mandates **implicit element insertion**. When the parser encounters a start tag that cannot legally appear in the current context, it closes elements until it finds a legal context, then inserts the new element. The spec defines exactly which tags cause which elements to close. For example, a `<p>` inside another `<p>` closes the first one. A `<td>` inside a `<table>` closes the `<td>`, then the `<tr>`, and inserts the new `<td>` in the table row. A `<li>` inside a `<ul>` closes the previous `<li>` and inserts a new one. These rules ensure that browsers produce the same DOM from the same malformed HTML — the behavior is deterministic, not implementation-dependent.

**Error recovery** is the part most people skip. The HTML spec mandates specific recovery behaviors for malformed markup. The parser does not throw an error and stop. It does not produce "undefined behavior." It produces a specific, deterministic DOM that every conforming browser must match. Unclosed tags get auto-closed. Misnested tags get reparented. Duplicate attributes are ignored (the first one wins). A `<table>` inside a `<table>` closes the inner one and inserts into the outer. These rules are defined in excruciating detail in the spec's "parse error" section — not suggestions, not optional, but required behavior.

The spec also mandates insertion of `<html>`, `<head>`, and `<body>` even when they are absent from the source. If the parser encounters a `<body>` start tag before seeing a `<body>` in the stream, it inserts the missing elements in order. This means every page has an `<html>`, a `<head>`, and a `<body>` in the DOM, regardless of what the author wrote — the parser constructs them.

### Part 2 — Interview Answer

The HTML parser has two jobs: tokenize the byte stream, then build a DOM tree from those tokens. Tokenization turns raw bytes into a sequence of structured tokens — doctypes, start tags, end tags, text, comments — through a state machine that the WHATWG spec defines in detail. Tree construction takes that token stream and builds the DOM by maintaining a stack of open elements: a start tag pushes an element, an end tag pops it, and the stack tracks the nesting hierarchy.

What makes the parser interesting is error recovery. The spec doesn't say "throw on malformed HTML." It defines specific recovery behaviors — unclosed tags get auto-closed, misnested tags get reparented, and duplicate attributes are silently dropped. Every conforming browser produces the same DOM from the same broken input because the spec mandates it. That's why a `<p>` inside another `<p>` doesn't produce an infinite nest — the parser closes the first one. And that's why the browser silently inserts `<html>`, `<head>`, and `<body>` even when they're missing from the source.

The practical consequence: the DOM the browser builds is not the same as the HTML source you wrote. The source is what you wrote; the DOM is what the parser constructed after running error recovery and implicit insertion. When you call `document.querySelector`, you're querying the constructed DOM, not the source text. And when you're debugging why an element appears where it does, you're debugging the parser's decisions, not your markup — which is why DevTools' Elements panel shows the DOM as the browser built it, not as you authored it.

### Part 3 — Whiteboard / Live Coding

Consider this malformed HTML:

```html
<!DOCTYPE html>
<html>
  <head><title>Test</title></head>
  <body>
    <p>Hello
      <div>World</div>
    </p>
  </body>
</html>
```

<!-- ILLUSTRATIVE — browser DOM construction, not runnable in Node/jsdom -->

What happened: the `<div>` inside the `<p>` is invalid HTML. The spec mandates that the parser close the `<p>` when it encounters the `<div>`, then insert the `<div>` as a sibling of the (now-closed) `<p>`:

1. Parser encounters `<p>`. Pushes `<p>` onto the stack.
2. Parser encounters text `"Hello"`. Appends as text node inside `<p>`.
3. Parser encounters `<div>`. The `<div>` cannot appear inside `<p>` in the HTML spec's content model. The parser closes the `<p>` (popping it from the stack), then inserts the `<div>` as a child of `<body>`.
4. The result: `<p>` and `<div>` are siblings inside `<body>`, not parent-child.

The DOM tree that the spec mandates:

```
document
  html
    head
      title → "Test"
    body
      p → "Hello"
      div → "World"
```

Notice: `<p>` contains only the text `"Hello"`. The `<div>` is a sibling, not a child. Every browser produces this exact tree from the malformed source — the spec mandates it, it is not implementation-dependent.

A second example showing implicit element insertion:

```html
<!DOCTYPE html>
<html>
  <head><title>Test</title></head>
  <body>
    <table>
      <tr><td>A</td></tr>
      <tr><td>B</td></tr>
    </table>
  </body>
</html>
```

<!-- ILLUSTRATIVE — browser DOM construction -->

The DOM is straightforward here because the HTML is well-formed. But if you omitted the `<html>`, `<head>`, and `<body>` tags entirely:

```html
<!DOCTYPE html>
<title>Test</title>
<table>
  <tr><td>A</td></tr>
  <tr><td>B</td></tr>
</table>
```

<!-- ILLUSTRATIVE — browser DOM construction -->

The browser constructs:

```
document
  html
    head
      title → "Test"
    body
      table
        tbody
          tr → td → "A"
          tr → td → "B"
```

The parser inserted `<html>`, `<head>`, `<body>`, and even `<tbody>` inside the `<table>` — all from source that never mentioned them. The DOM is the parser's construction, not the source's transcription.

### Part 4 — Follow-Up Questions

**Q: How does the HTML parser differ from an XML parser?**

An XML parser is strict: if the input is malformed, it throws an error and stops. The HTML parser is lenient by design: malformed input triggers specific recovery behaviors defined in the spec, and parsing always continues. This is a deliberate design choice — HTML was designed to tolerate author errors because real-world HTML is frequently malformed, and a strict parser would fail on most pages. XML was designed for machine-generated, validated data, so strictness is appropriate.

**Q: What is the "adoption agency algorithm"?**

The adoption agency algorithm is the spec's mechanism for handling misnested formatting elements — cases like `<b><i>text</b></i>`. The naive approach would be to close the `<b>` when it encounters `</b>`, which would leave `<i>` unclosed. The adoption agency algorithm instead moves the formatting element to the correct position in the tree, preserving the author's intent while producing valid DOM structure. It's one of the more complex parts of the tree construction algorithm, and it exists because formatting elements like `<b>`, `<i>`, `<u>`, `<em>`, `<strong>` are allowed to have partial overlap in the source — the parser must produce a valid tree from that.

**Q: Does the parser build the DOM synchronously, or in chunks?**

The parser builds the DOM incrementally as it reads the byte stream — it doesn't wait for the entire document to arrive. This is why the browser can render a page before it finishes downloading: the parser tokenizes and constructs the tree as bytes arrive, and the rendering engine can style and paint the portions of the tree that are ready. The critical exception: a synchronous `<script>` tag halts the parser until the script is fetched and executed, which is the subject of Section 2.

### Part 5 — Common Mistakes

**Junior/mid answer:** "The HTML parser just reads tags and builds a tree — it's straightforward."

**Senior answer:** The tokenization is a state machine with dozens of states defined by the spec, and the tree construction handles error recovery, implicit element insertion, and the adoption agency algorithm for misnested formatting. The DOM the parser builds from malformed HTML is deterministic and spec-mandated — every browser produces the same tree from the same broken input. That's not straightforward; it's one of the more complex parts of the web platform.

**Another junior tell:** "If you write invalid HTML, the browser just does whatever."

**Senior correction:** The browser does exactly what the spec mandates — not "whatever." Unclosed tags get auto-closed, misnested tags get reparented, and implicit elements get inserted, all according to deterministic rules. The parser never throws an error and never produces undefined behavior. When you call `document.querySelector` on malformed HTML, you're querying a specific, predictable tree — not a random one.

### Part 6 — Production Examples

**Real incident — parser error causing silent DOM divergence:** A team's component library rendered a navigation menu inside a `<ul>` element. A developer added a `<div>` wrapper inside one `<li>` for styling purposes — valid HTML, but the nesting was: `<li><div>...</div></li>`. The component worked fine in Chrome. In Firefox, the `<div>` inside the `<li>` caused a different layout because Firefox's accessibility tree construction diverged from Chrome's when the `<div>` had ARIA roles. The root cause: the parser's error recovery produced subtly different DOM fragments in the two browsers because the spec allows some implementation variation in how misnested nodes are reparented. The fix was removing the `<div>` and using CSS for the styling, which eliminated the parser ambiguity entirely. The diagnostic was comparing the two browsers' Elements panels side by side — the DOM was literally different.

**Real incident — missing `<tbody>` breaking a component:** A table component expected `<tbody>` to be present in the DOM for its row-selection logic. Developers writing the HTML manually omitted `<tbody>` because it's optional in the source. The parser inserted it, so the component worked. But when a test harness used jsdom — which doesn't always insert `<tbody>` the same way browsers do — the tests failed. The lesson: the DOM you get from the parser is not the same as the HTML you write, and libraries that depend on parser-inserted elements are fragile when the parsing context changes.

---

## 2. Parser-Blocking Resources

### Part 1 — Theory

When the HTML parser encounters a `<script>` tag — whether inline or external — without `defer` or `async`, it does something that no other HTML element triggers: **it stops parsing**. The parser hands control to the JavaScript engine, the script executes synchronously, and only after the script completes does the parser resume. This is called **parser blocking**, and it is the single most important performance consequence of script loading.

The reason the parser must block is `document.write()`. A script can call `document.write()`, which inserts content directly into the parse stream — the parser's current input position. If the parser continued reading ahead while a script was running, and the script called `document.write("...")` to insert content, the parser would have already read past the insertion point. The spec resolves this by making the parser stop entirely when a script executes: the script can safely write to the parse stream because the parser is not ahead of it. This is not an implementation quirk. It is a fundamental design constraint of how the HTML parser and the script execution environment interact.

The blocking cascade: a synchronous `<script src="...">` in `<head>` causes the parser to stop, initiate a network request for the script (which may take hundreds of milliseconds), wait for the download to complete, execute the script, and only then resume parsing. During this entire time, nothing below the `<script>` tag has been parsed — no `<body>`, no content, no stylesheets below it. The rendering pipeline is starved: no layout, no paint, no visual output.

**Stylesheets and script execution** have a related interaction. A `<link rel="stylesheet">` that appears before a `<script>` blocks the script's execution (not just parsing). The reason: the script might read computed styles via `getComputedStyle()`, which requires the stylesheet to be fully applied. So the browser must finish applying the stylesheet before it can run the script. The stylesheet does not block parsing — the parser continues reading tokens — but it blocks script execution, which indirectly blocks parsing if the script is synchronous. This is a double-delay: the stylesheet must be downloaded and applied, then the script must be downloaded and executed, and only then does parsing resume.

**The speculative preload scanner** is the browser's mitigation for this entire class of problems. Modern browsers run a secondary scanner that looks ahead in the HTML token stream while the main parser is blocked. This preload scanner discovers external resources — scripts, stylesheets, images — and begins fetching them before the main parser reaches them. It doesn't build the DOM; it only scans for resource URLs. This means a `<script>` further down the page can start downloading while the main parser is blocked on an earlier script, partially overlapping the network latency with the blocking period. The preload scanner's implementation varies by browser — it is not standardized — but the general behavior is well-supported across modern engines.

### Part 2 — Interview Answer

A synchronous `<script>` tag blocks the HTML parser because of `document.write()`. That's the claim worth knowing in depth, not just as a fact but as a mechanism. The parser reads HTML tokens sequentially, building the DOM as it goes. When it hits a `<script>`, it pauses — completely stops — hands control to the JavaScript engine, and waits. The script might call `document.write()`, which inserts content directly into the parse stream. If the parser had already read ahead past the insertion point, the written content would appear in the wrong position or be lost entirely. So the parser stops, the script runs, and parsing resumes after. A synchronous external script is worse: the browser must also fetch the script over the network before executing it, so the parser is blocked for the download time plus the execution time.

Stylesheets add a second layer. A `<link rel="stylesheet">` placed before a `<script>` blocks the script's execution, not just parsing, because the script might call `getComputedStyle()` and the browser needs the stylesheet applied before that call is valid. So the cascade is: download the stylesheet, apply it, download the script, execute it, then resume parsing. That's the double-delay that kills performance when styles and scripts are misordered in `<head>`.

The browser's mitigation is the speculative preload scanner — a secondary scanner that runs ahead in the HTML token stream while the main parser is blocked, discovers external resources, and starts fetching them early. It doesn't build the DOM; it only looks for resource URLs. Its implementation varies by browser, but the behavior is well-supported: it partially overlaps network latency with the blocking period, so a `<script>` further down the page starts downloading while the main parser is stuck on an earlier one. It's not a complete fix — the parser is still blocked — but it reduces the damage significantly.

The historical workaround was moving scripts to the bottom of `<body>`, which keeps them from blocking the parser until all content is parsed. That was the right call before `defer` and `async` existed. The modern answer is to use those attributes instead, which is what Section 3 covers.

### Part 3 — Whiteboard / Live Coding

Here's a timing diagram showing what happens with parser-blocking scripts:

```html
<!-- ILLUSTRATIVE — browser behavior, not runnable in Node -->
<!DOCTYPE html>
<html>
  <head>
    <link rel="stylesheet" href="styles.css">     <!-- T1: download + apply -->
    <script src="app.js"></script>                  <!-- T2: blocked until T1 done, then download + execute -->
  </head>
  <body>
    <h1>Hello</h1>
    <p>Content</p>
  </body>
</html>
```

<!-- ILLUSTRATIVE — timing diagram of parser-blocking behavior -->

Timeline (what the browser does):

```
Parser reads <head>
  → encounters <link rel="stylesheet">
    → starts downloading styles.css (T1 begins)
    → parser CONTINUES (stylesheets don't block parsing)
  → encounters <script src="app.js">
    → parser STOPS (script is synchronous)
    → waits for styles.css to finish applying (script execution blocked by stylesheet)
    → waits for app.js to download
    → executes app.js
    → parser RESUMES
  → encounters <body>
    → parses <h1>, <p>, text content
  → DOMContentLoaded fires
```

The key: everything below the `<script>` in `<head>` — the entire `<body>` — is invisible to the parser until the script finishes. The user sees a blank page during the entire download + execution period.

Now compare with `defer`:

```html
<!-- ILLUSTRATIVE — browser behavior, not runnable in Node -->
<!DOCTYPE html>
<html>
  <head>
    <link rel="stylesheet" href="styles.css">
    <script src="app.js" defer></script>
  </head>
  <body>
    <h1>Hello</h1>
    <p>Content</p>
  </body>
</html>
```

<!-- ILLUSTRATIVE — timing diagram of deferred script behavior -->

Timeline:

```
Parser reads <head>
  → encounters <link rel="stylesheet">
    → starts downloading styles.css
  → encounters <script defer>
    → parser CONTINUES (defer does not block parsing)
    → browser starts downloading app.js in parallel
  → encounters <body>
    → parses <h1>, <p>, text content
  → DOM fully parsed
  → styles.css applied
  → app.js executes (in order, if multiple deferred scripts)
  → DOMContentLoaded fires
```

The parser never stops. The script downloads in parallel with parsing. Execution happens after the DOM is fully parsed. The user sees content immediately.

### Part 4 — Follow-Up Questions

**Q: Does `document.write()` still work in modern browsers?**

Yes, but only under specific conditions. During HTML parsing, `document.write()` inserts content into the parse stream — this is the original design. After parsing is complete, calling `document.write()` on a new document opens a new document stream and replaces the existing content. Calling it after the page has fully loaded (outside the parser) opens a new document, which is destructive and almost never what you want. Most linting tools flag `document.write()` as an anti-pattern, but the spec still supports it during parsing, which is exactly why the parser blocks on scripts.

**Q: Can a `<link rel="stylesheet">` after a `<script>` block the script?**

No — only stylesheets that appear *before* the script in document order block that script's execution. A `<link>` after the `<script>` has not been parsed yet when the script executes, so it cannot block it. The ordering matters: the browser blocks script execution on any stylesheet that has been discovered but not yet applied.

**Q: What exactly does the preload scanner scan for?**

The preload scanner scans the raw HTML token stream for resource URLs — `<script src>`, `<link href>` for stylesheets, `<img src>`, and similar resource-loading elements. It does not build the DOM, it does not execute scripts, and it does not apply styles. Its sole purpose is to discover resources early so the browser can start fetching them while the main parser is blocked. Its implementation varies by browser engine (Blink, WebKit, Gecko all have their own), which is why the exact list of elements it handles varies slightly.

### Part 5 — Common Mistakes

**Junior/mid answer:** "Put your scripts at the bottom of the `<body>` so they don't block rendering."

**Senior answer:** That was the right workaround before `defer` and `async` existed, and it still works. But the modern answer is to use `defer` on scripts that depend on the DOM or on each other, and `async` on independent scripts like analytics. Moving scripts to the bottom of `<body>` still blocks parsing once the parser reaches them — it just means the block happens later, after content is parsed. `defer` lets the parser continue entirely, downloading the script in parallel and executing it after parsing completes. The bottom-of-body trick is a pre-`defer` era workaround, not the right tool now that the right tools exist.

**Another junior tell:** "Stylesheets don't block anything — they're just CSS."

**Senior correction:** Stylesheets block script execution, not parsing. A `<link rel="stylesheet">` before a `<script>` delays the script's execution because the browser must finish applying the stylesheet before the script can call `getComputedStyle()` or read layout-dependent values. The stylesheet doesn't stop the parser, but it stops the script, which stops the parser indirectly. The cascade matters: if you have a stylesheet and a script in `<head>`, the order determines whether the script is doubly-delayed or singly-delayed.

### Part 6 — Production Examples

**Real incident — synchronous script in analytics snippet killing LCP:** A team added a third-party analytics script to the `<head>` of their marketing page. The script was synchronous — no `defer`, no `async` — and it weighed about 200KB. The Largest Contentful Paint metric jumped from 1.2 seconds to 4.8 seconds. The cause was parser blocking: the script halted the parser in `<head>`, blocking the download of the hero image, the primary stylesheet, and all content below it. The browser's preload scanner discovered the hero image and started fetching it, but the parser was still blocked on the analytics script, so the image sat in the decode queue. The fix was switching to `async` on the analytics script (it didn't need the DOM), which removed it from the critical rendering path. The metric dropped back to 1.3 seconds.

**Real incident — stylesheet before script causing a flash of unstyled content:** A team moved a critical stylesheet from `<head>` to below a synchronous `<script>` tag to "prioritize the script." The result was a flash of unstyled content: the parser processed the script first, then the stylesheet, so the content rendered without styles for the duration of the script's execution plus the stylesheet's download. The team moved the stylesheet back above the script and added `defer` to the script — the stylesheet applied before execution, and the parser was never blocked.

---

## 3. Script Loading Strategies

### Part 1 — Theory

There are four ways to load and execute a `<script>` in HTML, and each one has different behavior for parsing, download timing, execution timing, and execution order. Understanding the differences is not optional — it's the difference between a page that renders in under a second and one that takes five.

**Blocking (no attribute).** The default. The parser encounters the `<script>`, stops parsing, fetches the script (if external), executes it synchronously, and resumes parsing. Multiple blocking scripts execute in source order, but each one blocks parsing for its entire download + execution duration. This is the slowest option and the one to avoid for anything that can be deferred.

**`defer`.** The parser encounters the `<script defer>`, continues parsing without stopping, and begins downloading the script in parallel. The script executes after the DOM is fully parsed, in source order, before `DOMContentLoaded` fires. Multiple deferred scripts maintain their relative order — script A before script B in the source means A executes before B. This is the right choice for scripts that depend on the DOM or on each other: jQuery before a plugin, a framework before an application bundle.

**`async`.** The parser encounters the `<script async>`, continues parsing without stopping, and begins downloading the script in parallel. The script executes as soon as the download completes — which may be before the DOM is fully parsed, interrupting the parser mid-stream. Multiple async scripts have no guaranteed execution order — whichever finishes downloading first executes first, regardless of source order. This is the right choice for independent scripts that don't care about DOM state or about each other: analytics, ads, social widgets.

**Module scripts (`type="module"`).** Module scripts are deferred by default — they download in parallel with parsing and execute after the DOM is fully parsed, just like `defer`. But they have additional properties: they're treated as strict-mode ES modules with their own scope (no global variable pollution), they support `import`/`export`, and they're subject to CORS when loaded from a different origin. A `<script type="module">` without `defer` or `async` still behaves like `defer` — the spec mandates this. Module scripts can also use `async` to override the default deferred behavior, which is useful for independent module entry points.

The interaction with `DOMContentLoaded`: deferred scripts execute before `DOMContentLoaded`. Async scripts may execute before or after — if the download completes before parsing finishes, the script executes during parsing, and `DOMContentLoaded` fires after parsing completes normally. If the download completes after parsing finishes, the script executes after parsing, and `DOMContentLoaded` fires before or after the script depending on timing. Synchronous scripts block `DOMContentLoaded` because they block parsing, and `DOMContentLoaded` cannot fire until parsing completes.

### Part 2 — Interview Answer

There are four script loading strategies, and the difference is execution order and timing relative to parsing — not just download behavior.

Blocking scripts — no attribute — are the default. The parser stops, the script is fetched and executed, and parsing resumes. Each blocking script halts parsing for its entire download plus execution duration. This is the slowest option and the one that `defer` and `async` were designed to replace.

`defer` downloads the script in parallel with parsing and executes it after the DOM is fully parsed, in source order, before `DOMContentLoaded`. Multiple deferred scripts maintain their relative order — if jQuery is deferred before a plugin, jQuery always executes first. This is the right choice when scripts depend on the DOM or on each other.

`async` downloads the script in parallel with parsing and executes it as soon as the download completes — which may interrupt parsing if the download finishes early. Multiple async scripts have no guaranteed execution order; whichever finishes first runs first. This is the right choice for independent scripts that don't care about DOM state: analytics, ads, social widgets.

Module scripts — `type="module"` — are deferred by default. They download in parallel and execute after parsing, just like `defer`. But they're strict-mode ES modules with their own scope, they support `import`/`export`, and they're subject to CORS. A module script can override the default deferred behavior with `async`, which is useful for independent module entry points.

The `DOMContentLoaded` interaction is the part most candidates get wrong. Deferred scripts execute before `DOMContentLoaded`. Async scripts may execute before or after — there's no guarantee. Synchronous scripts block `DOMContentLoaded` because they block parsing, and `DOMContentLoaded` cannot fire until parsing completes. The junior answer is "async is faster, use async." The senior answer is: it depends on whether the script needs the DOM, needs to run in order, or needs to run at all before other scripts. Analytics doesn't need the DOM — use `async`. A framework bundle needs the DOM and other scripts to have loaded — use `defer`. A module entry point that imports other modules — use `type="module"` with `defer` or just `type="module"` alone.

### Part 3 — Whiteboard / Live Coding

The timing diagram for all four strategies:

```
STRATEGY: BLOCKING (no attribute)
─────────────────────────────────────────────────────────────────
Parse: ████████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░████████████
Script:           ░░░░████████████░░░░░░░░░░░░░░░░░
                   fetch    exec
Result: Parser blocked for fetch + exec. Content invisible until script completes.

STRATEGY: defer
─────────────────────────────────────────────────────────────────
Parse: ████████████████████████████████████████████████████████
Script: ░░░░░░░░░░░░████████████████████████░░░░░░░░░░░░░░░░░░
                   fetch (parallel)        exec (after parse)
DOMContentLoaded:                                              ▲
Result: Parser never stops. Script executes after DOM is built.

STRATEGY: async
─────────────────────────────────────────────────────────────────
Parse: ████████████████░░░░░░░░░░░░████████████████████████████
Script: ░░░░░░░░░████████████░░░░░░░░░
              fetch  exec (interrupts parse)
Result: Script may interrupt parsing mid-stream. No order guarantee.

STRATEGY: module (deferred by default)
─────────────────────────────────────────────────────────────────
Parse: ████████████████████████████████████████████████████████
Script: ░░░░░░░░░░░░░░░░░░░░░░░░░░░░████████████████████████░░
                                        fetch (parallel)  exec
DOMContentLoaded:                                                  ▲
Result: Same timing as defer. Strict-mode scope. Supports import/export.
```

```html
<!-- ILLUSTRATIVE — browser behavior, not runnable in Node -->

<!-- Blocking: parser stops, script blocks everything below -->
<script src="app.js"></script>

<!-- defer: parser continues, script executes after DOM parsed, in order -->
<script src="vendor.js" defer></script>
<script src="app.js" defer></script>

<!-- async: parser continues, script executes when ready, order unknown -->
<script src="analytics.js" async></script>
<script src="ads.js" async></script>

<!-- module: deferred by default, strict-mode, own scope -->
<script type="module" src="app.mjs"></script>
```

The key decision tree:
- Script needs the DOM? → `defer`
- Scripts need to run in a specific order? → `defer` (source order = execution order)
- Script doesn't need the DOM or other scripts? → `async`
- Modern application code with imports? → `type="module"`

### Part 4 — Follow-Up Questions

**Q: Can a deferred script execute before the DOM is fully parsed?**

No. The spec mandates that deferred scripts execute after the parser has finished parsing the document, in the order they appear in the source, and before `DOMContentLoaded` fires. This is a hard guarantee, not a best-effort one. If you need a script to run before the DOM is fully parsed, you cannot use `defer` — you need a synchronous script (which blocks parsing) or an `async` script (which may run during parsing, but with no order guarantee).

**Q: What happens if I use both `defer` and `async` on the same script?**

If both `defer` and `async` are present on a classic script (one with `src` but no `type="module"`), `async` wins unconditionally — the spec treats it as if only `async` were specified, regardless of origin. The behavior degrades to `async` — the script downloads in parallel and executes when ready, potentially interrupting parsing. This is rarely intentional. The useful case is an `async` attribute on a `type="module"` script, which overrides the module's default deferred behavior for independent entry points.

**Q: Do deferred scripts block `DOMContentLoaded`?**

No — deferred scripts execute *before* `DOMContentLoaded`. The event fires after the DOM is fully parsed and after all deferred scripts have executed. So if you have five deferred scripts, they all execute first, then `DOMContentLoaded` fires. The event does not wait for the scripts; the scripts are a prerequisite for the event.

### Part 5 — Common Mistakes

**Junior/mid answer:** "`async` is faster than `defer` because it executes sooner."

**Senior answer:** `async` may execute sooner, but that's not the same as "faster" — and it's not always desirable. An `async` script executes when the download finishes, which may be during parsing, potentially interrupting the parser and blocking rendering of content below it. A `defer` script never interrupts parsing. The right choice depends on the script's dependencies, not on which one "runs first." Analytics should be `async` because it doesn't need the DOM and order doesn't matter. A UI framework bundle should be `defer` because it needs the DOM and other scripts to have loaded in order. "Faster" is the wrong optimization target — "correct dependency ordering" is the right one.

**Another junior tell:** "Module scripts are just like regular scripts but with imports."

**Senior correction:** Module scripts are deferred by default (they don't block parsing even without the `defer` attribute), they run in strict mode automatically, they have their own module scope (no global variable pollution), and they're subject to CORS when loaded cross-origin. The deferred-by-default behavior alone changes the execution model fundamentally — a `<script type="module">` in `<head>` never blocks the parser, while a `<script src>` in `<head>` always does.

### Part 6 — Production Examples

**Real incident — async analytics script breaking a plugin's initialization:** A team loaded jQuery with `defer` and their application bundle with `defer`, then added a third-party analytics script with `async`. The analytics script finished downloading before jQuery and executed first — during its execution, it called `$()` which was undefined because jQuery hadn't loaded yet. The fix was switching the analytics script to `defer` so it executed after jQuery, or wrapping the analytics call in a `DOMContentLoaded` listener. The lesson: `async` doesn't respect source order, so a script that depends on another script cannot safely be `async`.

**Real incident — module scripts and CORS on a CDN:** A team moved their application to `type="module"` and deployed scripts to a CDN on a different origin. The scripts failed to load with a CORS error because module scripts are subject to CORS even for same-site requests — the browser treats cross-origin module requests differently than cross-origin classic script requests. The fix was adding the appropriate CORS headers to the CDN. Classic scripts (`<script src>`) are not subject to CORS for cross-origin loads; module scripts are. This is a deliberate spec change to improve security for ES module imports.

---

## 4. The Resulting DOM

### Part 1 — Theory

The DOM is a tree. The document is the root. `<html>` is the document's child. `<head>` and `<body>` are `<html>`'s children. Everything else descends from those. But the DOM the browser builds is not the same as the HTML source — and the distinction matters for debugging, for querying, and for understanding when events fire.

Three things make the DOM differ from the source. **Error recovery**: unclosed tags get auto-closed, misnested tags get reparented, and implicit elements get inserted — all per the spec-mandated rules from Section 1. **Script and style modifications**: after the DOM is constructed, scripts can modify it arbitrarily via `document.createElement`, `appendChild`, `innerHTML`, and so on. **Parser-inserted elements**: `<html>`, `<head>`, `<body>`, `<tbody>`, and other elements the parser inserts even when they're absent from the source.

The two lifecycle events that matter are `DOMContentLoaded` and `load`, and the distinction between them is precise.

**`DOMContentLoaded`** fires when the HTML has been fully parsed and the DOM is built. It does not wait for stylesheets, images, iframes, or other subresources to finish loading. It does wait for deferred scripts to execute — deferred scripts run before `DOMContentLoaded` fires. Synchronous scripts block `DOMContentLoaded` because they block parsing, and `DOMContentLoaded` cannot fire until parsing is complete.

**`load`** fires when all subresources have finished loading — stylesheets, images, iframes, scripts, and everything else. It waits for everything, including the deferred scripts, including the images, including the font files. On a page with many images, `load` can fire seconds after `DOMContentLoaded`.

The interaction with script loading strategies:

- **Synchronous scripts** block `DOMContentLoaded` because they block parsing. `DOMContentLoaded` fires after the script executes.
- **Deferred scripts** execute before `DOMContentLoaded`. The event fires after all deferred scripts have run.
- **Async scripts** may execute before or after `DOMContentLoaded`. If the download completes before parsing finishes, the script executes during parsing and `DOMContentLoaded` fires after parsing completes normally. If the download completes after parsing finishes, the script executes after parsing, and `DOMContentLoaded` fires before the script — unless the script was the only thing preventing `DOMContentLoaded`, which it isn't, because `DOMContentLoaded` only waits for parsing, not for async script execution.
- **Module scripts** (deferred by default) execute before `DOMContentLoaded`, same as `defer`.

The practical consequence: if you need to run code after the DOM is ready but before all images have loaded, use `DOMContentLoaded`. If you need to run code after everything has loaded (including images, for layout measurement), use the `load` event. Most framework initialization uses `DOMContentLoaded` or its equivalent (`document.readyState` check), not `load`.

### Part 2 — Interview Answer

The DOM is the tree the browser constructs from your HTML — and it's not the same as the source you wrote. Error recovery closes unclosed tags, reparents misnested elements, and inserts implicit `<html>`, `<head>`, `<body>`, and `<tbody>` even when they're absent from the source. Scripts and styles modify the DOM after construction. When you query the DOM with `document.querySelector`, you're querying the browser's constructed tree, not your source text.

Two events tell you when the DOM is ready, and the distinction is precise. `DOMContentLoaded` fires when the HTML has been fully parsed and the DOM is built — not when images or stylesheets have loaded, not when iframes have rendered, but when the parser has finished tokenizing and constructing the tree. Deferred scripts execute before `DOMContentLoaded` fires, because deferred scripts are part of the parsing process — they run after parsing completes but before the event. Synchronous scripts block `DOMContentLoaded` because they block parsing, and the event cannot fire until parsing is complete.

`load` fires when everything has loaded — every stylesheet, every image, every iframe, every font. On a content-heavy page with lazy-loaded images, `load` can fire seconds after `DOMContentLoaded`. The two events measure different things: `DOMContentLoaded` measures DOM readiness; `load` measures full page readiness.

The interaction with script loading strategies is the part worth knowing cold. Deferred scripts execute before `DOMContentLoaded` — always. Async scripts may execute before or after — there's no guarantee, because the download timing is independent of the parsing timeline. Module scripts are deferred by default, so they execute before `DOMContentLoaded` just like `defer`. If you need to run code after the DOM is ready, `DOMContentLoaded` is the right event. If you need to run code after everything has loaded, including images for layout measurement, `load` is the right event. Framework initialization almost always targets `DOMContentLoaded` or its equivalent — not `load`.

### Part 3 — Whiteboard / Live Coding

The timeline showing when events fire relative to parsing, script execution, and resource loading:

```html
<!-- ILLUSTRATIVE — browser behavior, not runnable in Node -->
<!DOCTYPE html>
<html>
  <head>
    <link rel="stylesheet" href="styles.css">
    <script src="vendor.js" defer></script>
    <script src="app.js" defer></script>
  </head>
  <body>
    <h1>Hello</h1>
    <img src="hero.jpg">
    <script src="analytics.js" async></script>
    <p>Content</p>
  </body>
</html>
```

<!-- ILLUSTRATIVE — browser event timing -->

Event timeline:

```
1. Parser starts reading HTML
2. Parser encounters <link rel="stylesheet"> → starts downloading styles.css
3. Parser encounters <script defer> → starts downloading vendor.js, continues parsing
4. Parser encounters <script defer> → starts downloading app.js, continues parsing
5. Parser encounters <img> → starts downloading hero.jpg
6. Parser encounters <script async> → starts downloading analytics.js
7. Parser encounters <p>, finishes parsing HTML
8. parser has finished → DOM is fully built
9. vendor.js executes (deferred, in order)
10. app.js executes (deferred, in order)
11. analytics.js may execute here or later (async, order unknown)
12. DOMContentLoaded fires ← after all deferred scripts execute
13. styles.css finishes applying
14. hero.jpg finishes loading
15. analytics.js may execute here if not yet done
16. load fires ← after ALL subresources finish
```

The critical observation: `DOMContentLoaded` fires after step 12 (all deferred scripts executed, DOM fully built). `load` fires after step 16 (everything loaded). The gap between them depends on how many images, iframes, and fonts the page has.

```javascript
// ILLUSTRATIVE — browser API, not runnable in Node
// DOMContentLoaded: DOM is ready, subresources may not be
document.addEventListener('DOMContentLoaded', () => {
  console.log('DOM is ready');
  console.log(document.querySelector('h1')?.textContent); // "Hello" — safe
  console.log(document.querySelector('img')?.naturalWidth); // 0 — image may not have loaded
});

// load: everything is ready
window.addEventListener('load', () => {
  console.log('Everything loaded');
  console.log(document.querySelector('img')?.naturalWidth); // > 0 — image has loaded
});
```

The `DOMContentLoaded` callback can safely query the DOM — the tree is built. But it cannot reliably read image dimensions, because the image may still be downloading. The `load` callback can do both — the DOM is built and all resources have loaded.

### Part 4 — Follow-Up Questions

**Q: What is `document.readyState` and how does it relate to these events?**

`document.readyState` has three values: `"loading"` (the document is still being parsed), `"interactive"` (the DOM is fully parsed, but subresources like images may still be loading — this corresponds to the moment `DOMContentLoaded` is about to fire), and `"complete"` (all subresources have loaded — this corresponds to the `load` event). You can poll `readyState` instead of listening for events, and frameworks often do: `if (document.readyState !== 'loading') init(); else document.addEventListener('DOMContentLoaded', init);` covers both the case where the script runs after `DOMContentLoaded` and the case where it runs before.

**Q: Can `DOMContentLoaded` fire before deferred scripts execute?**

No. The spec mandates that deferred scripts execute before `DOMContentLoaded`. The event fires after the DOM is fully parsed AND after all deferred scripts have executed. This is a hard guarantee — if you have five deferred scripts, they all execute first, then `DOMContentLoaded` fires. The event is not independent of deferred scripts; it depends on them.

**Q: How does `DOMContentLoaded` interact with dynamically created script elements?**

A script element created with `document.createElement('script')` and appended to the DOM does not block parsing — it's not part of the original HTML parsing process. If the script has `defer`, it downloads in parallel and executes after the DOM is fully parsed. If it has `async`, it executes when the download finishes. If it has neither, it executes synchronously when appended to the DOM — but since the DOM is already being built by the parser (which is ahead of the dynamically created element), this does not block `DOMContentLoaded` in the same way a parser-discovered `<script>` does.

### Part 5 — Common Mistakes

**Junior/mid answer:** "`DOMContentLoaded` fires when everything on the page has loaded."

**Senior answer:** No. `DOMContentLoaded` fires when the HTML has been fully parsed and the DOM is built — not when images, stylesheets, or iframes have loaded. That's the `load` event. `DOMContentLoaded` is the DOM-ready event; `load` is the page-ready event. If you're initializing a component that reads image dimensions, `DOMContentLoaded` is too early — the image may not have loaded yet. If you're initializing a component that only needs the DOM tree, `load` is too late — you've wasted time waiting for images you didn't need.

**Another junior tell:** "I always use `window.onload` to make sure everything is ready."

**Senior correction:** `window.onload` waits for everything — images, stylesheets, iframes, fonts, everything. That's often too late. If you're initializing a UI framework that only needs the DOM, `DOMContentLoaded` is the right event. `window.onload` is appropriate when you genuinely need all resources loaded — for example, measuring layout after images have rendered. Using `onload` for DOM initialization wastes time waiting for resources you don't need yet.

### Part 6 — Production Examples

**Real incident — `DOMContentLoaded` firing before images caused layout thrash:** A team used `DOMContentLoaded` to initialize a masonry layout component that measured image heights to position items in a grid. The event fired before images loaded, so the component calculated positions based on zero-height images. The result was a grid where all items overlapped at the top. The fix was switching to the `load` event, which fires after images have loaded and have their natural dimensions. Alternatively, the team could have used `ResizeObserver` on the image elements to re-layout as each image loaded — which is what they eventually did, because `load` caused a noticeable delay in initialization.

**Real incident — deferred scripts and `DOMContentLoaded` ordering:** A team loaded three deferred scripts: a utility library, a UI framework, and their application code, in that order. The application code's `DOMContentLoaded` listener expected the UI framework to be initialized. But one of the deferred scripts loaded a stylesheet that blocked script execution (Section 2's stylesheet-before-script rule), so the application's deferred script executed before the framework's deferred script. The fix was ensuring the application code's `DOMContentLoaded` listener checked for framework readiness, or moving the stylesheet below the deferred scripts. The lesson: deferred scripts execute in source order, but stylesheet interactions can shift the effective timing.

---

## 5. Putting It All Together — The Chain

The HTML parser turns bytes into a DOM tree. It tokenizes the input, builds the tree by maintaining a stack of open elements, and recovers from malformed HTML using deterministic spec-mandated rules. When it encounters a synchronous `<script>`, it stops — because the script might call `document.write()`, which inserts content into the parse stream, and the parser cannot safely continue while that is possible. Session 5 (`01-javascript-mastery/05-event-loop-microtasks-macrotasks.md`) established that synchronous JavaScript blocks the thread — the event loop cannot service rendering, input, or other tasks while the stack is occupied. Parser blocking is the HTML-side consequence of that same mechanism: the parser pauses because the script occupies the thread.

The browser's mitigation is the speculative preload scanner — a secondary scanner that runs ahead in the token stream while the main parser is blocked, discovers external resources, and starts fetching them early. It doesn't build the DOM; it only looks for resource URLs. Its implementation varies by browser, but the behavior is well-supported: it partially overlaps network latency with the blocking period.

`defer` and `async` are the controls that move scripts off the critical rendering path. `defer` downloads in parallel with parsing and executes after the DOM is fully parsed, in source order, before `DOMContentLoaded`. `async` downloads in parallel and executes when the download finishes, potentially interrupting parsing, with no order guarantee. Module scripts are deferred by default, with strict-mode scope and `import`/`export` support.

The resulting DOM may differ from the HTML source — error recovery, implicit insertion, and script modifications all contribute. Two events mark the lifecycle: `DOMContentLoaded` fires when the DOM is built (after deferred scripts execute); `load` fires when all subresources have loaded. Synchronous scripts block `DOMContentLoaded`. Deferred scripts execute before it. Async scripts may execute before or after it.

Session 13 (`02-html-mastery/13-shadow-dom-web-components-encapsulation.md`) continues Module 2 by exploring an alternative DOM tree that browsers construct alongside the main one: the Shadow DOM, which gives web components encapsulated DOM subtrees with their own style scopes.

---

*End of Session 12. The HTML parser is a state machine that turns bytes into a tree, synchronous scripts block it because of `document.write()`, defer and async are the controls that move scripts off the critical rendering path, and the DOM the browser builds is the parser's construction — not the source's transcription.*
