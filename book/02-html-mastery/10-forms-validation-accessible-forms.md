# Forms, Validation Patterns, and Accessible Forms

> Three connected topics about the most interactive part of HTML: forms. Native form elements give you submission behavior, constraint validation, and accessibility for free — but only if you use them correctly. The gap between a working form and an accessible, validatable form is where most frontend bugs live.

---

## 1. Forms and Native Behavior

### Part 1 — Theory

A `<form>` is a container that collects user input and sends it somewhere. The `action` attribute specifies the URL that receives the data. The `method` attribute specifies the HTTP method (`GET` or `POST`). When a user submits the form — by clicking a submit button, pressing Enter while focused on a form control, or on some mobile keyboards pressing a "Go" key — the browser serializes the form data and sends it to the `action` URL.

The form elements inside the `<form>` are what make this work. `<input>` is the most versatile: its `type` attribute determines both its visual appearance and its behavior. `type="text"` is a single-line text field. `type="email"` adds format validation and a different virtual keyboard on mobile. `type="checkbox"` gives you a toggle. `type="radio"` gives you a mutually exclusive choice within a named group. `type="submit"` renders a button that submits the form.

`<textarea>` handles multi-line text input. `<select>` with `<option>` children renders a dropdown. `<button>` is the most flexible form control — its `type` attribute determines what it does when activated:

- `type="submit"` (the default inside a `<form>`) — submits the form
- `type="reset"` — resets all form controls to their initial values
- `type="button"` — does nothing by default; a blank canvas for JavaScript

The critical detail: inside a `<form>`, `<button>` defaults to `type="submit"`. Outside a `<form>`, or if you explicitly set `type="button"`, it does nothing on its own. This is the source of a pervasive bug — a developer adds a `<button>` for a secondary action like cancel or close modal, doesn't set `type="button"`, and clicking it unexpectedly submits the form. Every `<button>` inside a `<form>` that isn't meant to submit should have `type="button"` explicitly.

`<fieldset>` and `<legend>` group related form controls and provide a visible and accessible label for the group. A screen reader encountering a `<fieldset>` with a `<legend>` announces the group name before each control inside it — "Shipping address, name" instead of just "name." Without the `<fieldset>`/`<legend>`, the controls are announced as ungrouped, and the user loses the context of what they're filling out.

The form's `enctype` attribute controls how the data is encoded. The default (`application/x-www-form-urlencoded`) encodes key-value pairs as URL-encoded text. `multipart/form-data` is required for file uploads — the browser sends each form field as a separate part of a multipart request. `text/plain` is rarely used in practice.

### Part 2 — Interview Answer

A `<form>` is a container that collects user input and sends it to a server via the `action` URL using the specified `method`. The browser handles serialization — it reads each named form control, builds a key-value map, and sends it as the request body for POST or query string for GET. The `enctype` attribute controls encoding; the default works for text, but file uploads require `multipart/form-data`.

The form controls inside — `<input>`, `<textarea>`, `<select>`, `<button>` — each bring their own behavior. The part most people miss is `<button>`'s default `type`. Inside a `<form>`, a `<button>` without an explicit `type` attribute defaults to `type="submit"`. That means every button in your form submits it unless you say otherwise. The fix is trivial but the bug is everywhere: always set `type="button"` on any button that isn't meant to submit.

`<fieldset>` and `<legend>` are the grouping mechanism that screen readers rely on. When you wrap a set of related fields — like a shipping address — in a `<fieldset>` with a `<legend>`, the screen reader announces the legend text before each control inside it. Without that grouping, the user hears a list of fields with no context about what they're for. This is especially important for radio button groups and checkbox sets where the options are meaningless without their group label.

The native behavior you get for free is substantial: the browser manages focus order based on DOM sequence, activates the default submit button on Enter, constrains input based on `type`, and constructs the accessibility tree from the element's implicit role. You don't have to write any of that. What you do have to write is the server-side handling and any client-side validation beyond what the constraint validation API provides — but the form structure itself is native.

### Part 3 — Code

<!-- ILLUSTRATIVE: form behavior is browser-observable, not unit-testable -->

```html
<!-- A complete registration form with proper grouping -->
<form action="/api/register" method="POST" enctype="multipart/form-data">
  <fieldset>
    <legend>Account Details</legend>

    <label for="email">Email address</label>
    <input
      type="email"
      id="email"
      name="email"
      required
      autocomplete="email"
    >

    <label for="password">Password</label>
    <input
      type="password"
      id="password"
      name="password"
      required
      minlength="8"
      autocomplete="new-password"
    >
  </fieldset>

  <fieldset>
    <legend>Personal Information</legend>

    <label for="name">Full name</label>
    <input
      type="text"
      id="name"
      name="name"
      required
      autocomplete="name"
    >

    <label for="avatar">Profile photo</label>
    <input
      type="file"
      id="avatar"
      name="avatar"
      accept="image/*"
    >
  </fieldset>

  <fieldset>
    <legend>Notifications</legend>

    <label>
      <input type="checkbox" name="notifications" value="email">
      Email notifications
    </label>

    <label>
      <input type="checkbox" name="notifications" value="sms">
      SMS notifications
    </label>
  </fieldset>

  <!-- type="submit" — submits the form -->
  <button type="submit">Create Account</button>

  <!-- type="button" — does nothing by default (JavaScript handles it) -->
  <button type="button" onclick="cancel()">Cancel</button>

  <!-- type="reset" — resets all controls to initial values -->
  <button type="reset">Clear Form</button>
</form>
```

```html
<!-- Radio group — mutually exclusive choices within a named group -->
<fieldset>
  <legend>Preferred contact method</legend>

  <label>
    <input type="radio" name="contact" value="email" required>
    Email
  </label>

  <label>
    <input type="radio" name="contact" value="phone">
    Phone
  </label>

  <label>
    <input type="radio" name="contact" value="mail">
    Postal mail
  </label>
</fieldset>
<!-- The "name" attribute groups the radios — only one can be selected -->
<!-- The "required" attribute on one of them means the group must have a selection -->
```

### Part 4 — Project Example

The `{ALL_CAPS}_ID` naming pattern — `AUTHOR_INPUT_ID`, `TITLE_INPUT_ID`, `SUBMIT_BUTTON_ID` — maps to native form controls with implicit roles. The author input is a textbox. The title input is a textbox. The submit button is a button. Each of these is inside a `<form>`, which means the button's default `type` is `submit` — and that's exactly the behavior you want for a submit button, but you'd have to explicitly set `type="button"` on any other button in the same form.

### Part 5 — Common Mistakes

| Junior/mid tell | Senior version |
|---|---|
| Forgets `type="button"` on non-submit buttons inside forms | Knows that every `<button>` inside a `<form>` defaults to `type="submit"` and explicitly sets `type="button"` on any button that shouldn't submit |
| Uses `<div>` styled as a form with JavaScript handlers for everything | Knows that native form controls give you focus management, keyboard activation, and accessibility tree construction for free |
| Skips `<fieldset>`/`<legend>` because "it looks fine without them" | Understands that `<fieldset>`/`<legend>` provide the grouping context screen readers announce before each control |
| Sets `enctype` to `multipart/form-data` for all forms | Knows that `multipart/form-data` is only needed for file uploads; the default `application/x-www-form-urlencoded` works for everything else |

### Part 6 — Follow-Up Q&A

**Q: Why does `<button>` default to `type="submit"` inside a `<form>` but not outside it?**

Because the HTML spec defines `type`'s default based on context. Inside a `<form>`, the default is `"submit"` — the button's purpose is to submit the form unless you say otherwise. Outside a `<form>`, there's nothing to submit, so the default is `"button"` — do nothing. The asymmetry makes sense from the spec's perspective: inside a form, submission is the expected action. Outside, there's no expected action. The problem is that developers often add buttons inside a form for non-submit purposes like cancel, toggle, or add item, and forget that the default has changed.

**Q: What's the difference between `GET` and `POST` methods, and when would you use each?**

`GET` appends form data to the URL as query parameters. The data is visible in the address bar, bookmarkable, and cacheable. Use it for search forms and filters — anything where the form state should be shareable via URL. `POST` sends form data in the request body. The data isn't visible in the URL, isn't bookmarkable, and isn't cached. Use it for mutations — creating accounts, placing orders, uploading files. The HTML spec also says `GET` should be idempotent (repeating the same request should have the same effect as making it once), while `POST` is not — sending a POST twice might create two records.

---

## 2. Validation Patterns

### Part 1 — Theory

The constraint validation API is the browser's built-in form validation system. It fires when a form is submitted, when `checkValidity()` or `reportValidity()` is called programmatically, or when certain attributes are present on form controls. The attributes that trigger it are:

- `required` — the field must have a value
- `minlength` / `maxlength` — string length constraints (for text inputs and textareas)
- `pattern` — a regular expression the value must match (for text inputs)
- `min` / `max` — numeric or date constraints (for number, date, and range inputs)
- `type` — format constraints inherent to the type (`email`, `url`, `tel`, `number`, `date`)

When validation fails, the browser fires an `invalid` event on the control, prevents form submission, and (if `reportValidity()` was called or the user attempted to submit) displays a native error message tooltip.

The API surface has three key methods:

- `checkValidity()` — returns `true` if the control is valid, `false` otherwise. Fires `invalid` events but does not show UI.
- `reportValidity()` — same as `checkValidity()`, but also shows the native error message tooltip and moves focus to the control.
- `setCustomValidity(message)` — sets a custom error message. When non-empty, the control is considered invalid regardless of other constraint state. Calling `setCustomValidity("")` clears the custom error and restores native validation.

The `invalid` event fires whenever validation fails — on submit, on `checkValidity()`, or on `reportValidity()`. You can listen for it to customize error display. But there's a subtlety: the `invalid` event fires on page load for fields that start invalid (a `required` field with no value). This is why the `:invalid` pseudo-class styles fields red before the user has typed anything — the field is genuinely invalid at page load.

`:user-invalid` (CSS Selectors Level 4, now widely supported) fixes this by only applying after the user has interacted with the field — either changed its value and then moved away, or attempted to submit. This is the correct production approach to error styling: don't show errors until the user has had a chance to fill in the field.

Now the gaps:

1. **Optional field with `pattern`**: An empty optional field skips `pattern` validation entirely — the browser only checks the pattern when the field is non-empty. The practical gap is different: `pattern` provides no built-in hint about the expected format. The `title` attribute is sometimes shown as a tooltip, but screen-reader support is inconsistent; you need visible help text alongside the field.

2. **`type="email"` permissiveness**: The HTML spec's email validation is surprisingly loose. `type="email"` accepts strings like `a@b` — a single character before and after the `@` with no TLD. It also accepts `user@localhost` (no dot). For stricter validation, you need a `pattern` attribute or JavaScript.

3. **Cross-field validation**: The constraint validation API operates on individual fields. It cannot validate that password and confirm-password match, or that an end date is after a start date. These require JavaScript.

JavaScript validation supplements constraint validation — it doesn't replace it. The canonical pattern: let the browser handle what it can (required, type, pattern), and add JavaScript for cross-field rules and custom error messages. The `submit` event is the natural place for this: the browser's constraint validation fires first, and if it passes, your JavaScript runs next.

### Part 2 — Interview Answer

The constraint validation API is what the browser gives you for free: `required`, `minlength`, `maxlength`, `pattern`, `min`, `max`, and `type`-based format checks. When a field fails validation, the browser fires an `invalid` event and prevents form submission. `checkValidity()` returns a boolean without showing UI. `reportValidity()` returns the boolean and also shows the native error tooltip and moves focus. `setCustomValidity()` lets you override the error state with your own message — but it replaces all native validation, so clearing it with an empty string restores the native behavior.

The production gotcha is `:invalid` versus `:user-invalid`. The `:invalid` pseudo-class applies on page load — a `required` field with no value is immediately styled as invalid before the user has touched anything. That's technically correct (the field is invalid), but UX-terrible. `:user-invalid` only applies after the user has interacted with the field, which is what you actually want. It's part of CSS Selectors Level 4 and is widely supported now.

The real gaps in constraint validation are the ones that trip teams up in production. First: `type="email"` is permissive — it accepts `a@b` without a TLD, which most people wouldn't consider a valid email. You need a `pattern` or server-side validation for stricter rules. Second: the constraint API is field-level, not form-level. It can't check that a password confirmation matches the password, or that an end date is after a start date. That requires JavaScript on the `submit` event, running after the browser's native validation has passed. Third: `pattern` provides no built-in hint about the expected format — the `title` attribute is sometimes shown as a tooltip, but screen reader support is inconsistent. You need visible help text.

The senior approach is layered: let the browser handle what it can, add JavaScript for cross-field and custom rules, and style errors with `:user-invalid` so the user isn't assaulted with red borders on page load.

### Part 3 — Code

<!-- ILLUSTRATIVE: constraint validation behavior is browser-observable, not unit-testable -->

```html
<!-- Basic constraint validation attributes -->
<form id="signup">
  <label for="username">Username</label>
  <input
    type="text"
    id="username"
    name="username"
    required
    minlength="3"
    maxlength="20"
    pattern="[a-zA-Z0-9_]+"
    title="Only letters, numbers, and underscores"
  >

  <label for="email">Email</label>
  <input
    type="email"
    id="email"
    name="email"
    required
  >
  <!-- type="email" accepts a@b — no TLD required by the spec -->

  <label for="age">Age</label>
  <input
    type="number"
    id="age"
    name="age"
    min="18"
    max="120"
    required
  >

  <button type="submit">Sign Up</button>
</form>

<style>
  /* WRONG: styles fields red on page load */
  input:invalid {
    border-color: red;
  }

  /* CORRECT: only styles after user interaction */
  input:user-invalid {
    border-color: red;
    box-shadow: 0 0 0 1px red;
  }
</style>
```

```typescript
// Cross-field validation: password confirmation
const form = document.getElementById('signup') as HTMLFormElement;
const password = document.getElementById('password') as HTMLInputElement;
const confirm = document.getElementById('confirm') as HTMLInputElement;
const confirmError = document.getElementById('confirm-error') as HTMLElement;

form.addEventListener('submit', (e) => {
  // Browser's native validation has already run by this point
  // Add cross-field rules after it
  if (password.value !== confirm.value) {
    e.preventDefault();
    confirm.setCustomValidity('Passwords do not match');
    confirmError.textContent = 'Passwords do not match';
    confirm.setAttribute('aria-invalid', 'true');
    confirm.setAttribute('aria-describedby', 'confirm-error');
  } else {
    confirm.setCustomValidity('');
    confirmError.textContent = '';
    confirm.removeAttribute('aria-invalid');
  }
});

// Clear custom error when the user types
confirm.addEventListener('input', () => {
  if (confirm.validationMessage === 'Passwords do not match') {
    confirm.setCustomValidity('');
    confirmError.textContent = '';
    confirm.removeAttribute('aria-invalid');
  }
});
```

```typescript
// Programmatic validation with reportValidity()
const form = document.getElementById('checkout') as HTMLFormElement;

// Disable native tooltip and show custom error summary
form.addEventListener('submit', (e) => {
  if (!form.reportValidity()) {
    e.preventDefault();

    // Find first invalid field and focus it
    const firstInvalid = form.querySelector(':invalid') as HTMLElement;
    if (firstInvalid) {
      firstInvalid.focus();
    }
  }
});
```

### Part 4 — Project Example

The `{ALL_CAPS}_ID` naming pattern — `AUTHOR_INPUT_ID`, `TITLE_INPUT_ID` — maps to form controls that can be validated with constraint attributes. An author field might have `required` and `minlength="2"`. A title field might have `required` and `maxlength="100"`. The `SUBMIT_BUTTON_ID` button triggers the browser's native validation before the form submits. If you add a loading state (the `LOADING_ID` element), you'd disable the submit button during the request to prevent double-submission — that's JavaScript validation supplementing the browser's built-in system.

### Part 5 — Common Mistakes

| Junior/mid tell | Senior version |
|---|---|
| Uses `:invalid` for error styling and gets red borders on page load | Uses `:user-invalid` to only show errors after user interaction |
| Relies solely on `type="email"` for email validation | Knows that `type="email"` accepts strings like `a@b` and adds `pattern` or server-side checks for stricter rules |
| Writes all validation in JavaScript, ignoring constraint attributes | Layers: browser handles what it can, JavaScript adds cross-field and custom rules |
| Calls `checkValidity()` without `reportValidity()` and wonders why there's no error UI | Knows that `checkValidity()` only returns a boolean; `reportValidity()` shows the error tooltip and moves focus |

### Part 6 — Follow-Up Q&A

**Q: Why does `setCustomValidity()` replace all native validation instead of adding to it?**

Because the API was designed before `reportValidity()` existed. `setCustomValidity()` sets a single error message string — if it's non-empty, the field is invalid, period. It doesn't layer on top of `required` or `pattern`. This means if you set a custom message for password mismatch, you also lose the native `required` error message. The workaround is to check all constraints yourself and set the custom message only when the custom rule fails, or to clear the custom message when the field is empty so the native `required` error shows. It's clunky, which is why the modern pattern is to use `aria-describedby` for custom error messages instead of `setCustomValidity()`.

**Q: When would you use `invalid` event versus `submit` event for validation?**

Use the `invalid` event when you want to intercept and customize validation behavior per-field as it happens. Use the `submit` event when you need form-level logic — cross-field validation, error summaries, or focus management. The submit event is the more common choice because it runs after all native validation has completed, giving you a single place to add your custom rules. The `invalid` event fires per-field and can fire multiple times, which makes it harder to coordinate error display across the form.

---

## 3. Accessible Forms

### Part 1 — Theory

Form elements have implicit ARIA roles — `<input type="text">` is `textbox`, `<input type="checkbox">` is `checkbox`, `<input type="radio">` is `radio`, `<select>` is `listbox`, `<textarea>` is `textbox`. But a role without a name is useless to assistive technology. A screen reader encountering an unlabeled textbox announces "text field" — the role, but not what the field is for. That's where labels come in.

There are two ways to associate a label with an input, and the difference matters:

**Explicit association** uses a `for` attribute on the `<label>` that matches the `id` on the `<input>`:

```html
<label for="email">Email address</label>
<input type="email" id="email" name="email">
```

This works regardless of DOM distance — the `<label>` can be anywhere on the page and still be associated with the input. It's the standard pattern for most forms.

**Implicit association** nests the `<input>` inside the `<label>`:

```html
<label>
  Email address
  <input type="email" name="email">
</label>
```

This works because the `<label>` element knows to associate with its descendant `<input>`. But it only works when the input is a direct descendant — you can't put other elements between the label and the input without breaking the association in some screen readers.

The behavior you get from label association: clicking the `<label>` moves focus to its associated control. For checkboxes and radios, clicking the `<label>` also toggles the control. This is free behavior — the same "native elements give you behavior for free" principle from Session 9. A `<div>` styled as a label does none of this.

The alternatives — `aria-label` and `aria-labelledby` — exist for cases where a visible label isn't possible. `aria-label` provides an accessible name without any visible text. `aria-labelledby` references another element's text content as the accessible name. Both work, but neither provides a visible pairing for cognitive accessibility — the user can't see what the field is for, they can only hear it. Use them when a visible label genuinely can't be shown (search inputs with magnifying glass icons, compact toolbar inputs), not as a replacement for visible labels.

The placeholder anti-pattern: `placeholder` text is not a label. It disappears when the user starts typing. It has low contrast by default (fails WCAG 1.4.3 contrast requirements in most browsers). Most screen readers do not announce `placeholder` as a label — they announce it as a description or not at all. WCAG 1.3.5 (Identify Input Purpose) requires that the purpose of each input field can be programmatically determined, and a `placeholder` alone does not satisfy this. A `<label>` — visible, persistent, high-contrast, associated — is the correct mechanism.

Error message accessibility is the most commonly missed part. A red border is not accessible error feedback — a screen reader can't see borders. The correct pattern uses two attributes together:

- `aria-invalid="true"` on the field tells assistive technology the field has an error
- `aria-describedby` pointing to an element that contains the error message text

When validation fails, you populate the error message element, set `aria-invalid="true"` on the field, and ensure the `aria-describedby` points to the error message. The timing matters: error messages should appear after the user leaves the field (blur) or attempts submission, not character-by-character while they type. Inline validation on every keystroke is noisy and distracting — the user hasn't finished filling in the field yet.

Focus management after validation: when form submission fails, focus should move to the first invalid field or to a summary error message at the top of the form. Without this, the user submits the form, nothing happens, and they have no idea what went wrong. The `reportValidity()` method handles this for individual fields. For form-level focus management, you query for the first `:invalid` element and call `.focus()` on it.

### Part 2 — Interview Answer

Label association is the most commonly wrong thing in form accessibility. There are two patterns: explicit, where the `<label>` has a `for` attribute matching the input's `id`, and implicit, where the input is nested inside the `<label>`. Explicit works across any DOM distance — the label can be anywhere on the page. Implicit only works when the input is a descendant. Both give you the same free behavior: clicking the label moves focus to the input, and for checkboxes and radios, it toggles the control. A `<div>` styled as a label does none of that.

The placeholder anti-pattern is the thing I see most often in code reviews. A `<input placeholder="Email">` without a `<label>` is not accessible. Placeholder text disappears on input, has low contrast, and most screen readers don't announce it as a label. WCAG 1.3.5 requires that input purpose is programmatically determinable — a `placeholder` alone doesn't satisfy that. You need a `<label>`, even if it's visually hidden (using a technique like `clip` + `position: absolute` to hide it visually while keeping it in the accessibility tree).

For error messages, a red border is not enough. The correct pattern is `aria-invalid="true"` on the field combined with `aria-describedby` pointing to an error message container. When validation fails, you populate that container, set the invalid attribute, and the screen reader announces the error alongside the field label. The timing matters too: show errors on blur or on submit, not on every keystroke. Character-by-character validation is noisy and penalizes slow typers who haven't finished filling in the field yet.

Focus management ties it together. When submission fails, focus should move to the first invalid field — or to a summary at the top of the form if there are many errors. Without this, the user submits, nothing visible happens (or the page scrolls to the first error but doesn't announce it), and they're stuck. `reportValidity()` handles per-field focus. For form-level, you query the first `:invalid` element and focus it.

### Part 3 — Code

<!-- ILLUSTRATIVE: label association and error announcement are screen-reader-observable, not unit-testable -->

```html
<!-- Explicit label association (for/id pair) — works across any DOM distance -->
<label for="username">Username</label>
<input type="text" id="username" name="username" required>

<!-- Implicit label association (input inside label) — only works for descendants -->
<label>
  Username
  <input type="text" name="username" required>
</label>

<!-- Visually hidden label — accessible but not visible -->
<label for="search" class="visually-hidden">Search</label>
<input type="search" id="search" name="search" placeholder="Search...">

<style>
  .visually-hidden {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }
</style>
```

```html
<!-- Accessible error pattern: aria-describedby + aria-invalid -->
<label for="email">Email address</label>
<input
  type="email"
  id="email"
  name="email"
  required
  aria-invalid="true"
  aria-describedby="email-error"
>
<!-- role="alert" fires when this content is dynamically inserted — the span must start EMPTY for the announcement to work -->
<span id="email-error" role="alert" aria-live="assertive"></span>

<!-- Screen reader announces: "Email address, invalid entry, please enter a valid
     email address" — the label, the state, and the description are all connected -->
```

```html
<!-- Error summary at top of form (focus management) -->
<div id="error-summary" role="alert" tabindex="-1">
  <h2>Please fix the following errors:</h2>
  <ul>
    <li><a href="#username">Username is required</a></li>
    <li><a href="#email">Email is invalid</a></li>
  </ul>
</div>

<!-- The tabindex="-1" makes the summary focusable programmatically -->
<!-- After validation failure, JavaScript focuses this element -->
```

```typescript
// Focus management after validation failure
const form = document.getElementById('signup') as HTMLFormElement;
const errorSummary = document.getElementById('error-summary') as HTMLElement;

form.addEventListener('submit', (e) => {
  if (!form.checkValidity()) {
    e.preventDefault();

    // OPTION A: focus an error summary at the top of the form.
    // Use for long forms with many potential errors. The summary
    // gets focus so screen readers announce it; links inside let
    // the user jump to each invalid field.
    errorSummary.focus();

    // OPTION B: focus the first invalid field directly.
    // Use for short forms where a summary isn't needed.
    // const firstInvalid = form.querySelector(':invalid') as HTMLElement;
    // if (firstInvalid) firstInvalid.focus();

    // Do NOT call both — the second focus() overwrites the first
    // before the browser announces anything.
  }
});
```

### Part 4 — Project Example

The `{ALL_CAPS}_ID` naming pattern — `AUTHOR_INPUT_ID`, `TITLE_INPUT_ID`, `SUBMIT_BUTTON_ID`, `LOADING_ID`, `ERROR_ID` — maps to the accessible form pattern. The author and title inputs have explicit labels via `for`/`id` pairs. The submit button has an implicit accessible name from its text content. The `ERROR_ID` element is the `aria-describedby` target for error messages. The `LOADING_ID` element is likely an ARIA live region that announces loading state to screen readers.

### Part 5 — Common Mistakes

| Junior/mid tell | Senior version |
|---|---|
| Uses `placeholder` as the only label | Knows that `placeholder` disappears on input, has low contrast, and doesn't satisfy WCAG 1.3.5 — always uses a `<label>` |
| Shows errors with a red border only | Uses `aria-invalid="true"` + `aria-describedby` so screen readers announce the error alongside the field |
| Shows error messages on every keystroke | Shows errors on blur or submit, not during input — avoids noise and penalizing slow typers |
| Doesn't manage focus after validation failure | Focuses the first invalid field or an error summary so the user knows what went wrong |
| Uses `aria-label` instead of a visible `<label>` for form fields | Knows that `aria-label` provides no visible pairing for cognitive accessibility — uses it only when a visible label genuinely can't be shown |

### Part 6 — Follow-Up Q&A

**Q: When would you use `aria-label` instead of a visible `<label>` for a form field?**

The honest answer is: almost never for form fields. The ARIA authoring practices recommend visible labels. You'd use `aria-label` on a search input inside a search landmark where the magnifying glass icon communicates purpose visually, or on a compact toolbar input where space is genuinely constrained. But even then, a visually hidden `<label>` with `for`/`id` association is more robust — it works in the accessibility tree without depending on the screen reader parsing `aria-label`, and it's testable with automated tools. The rule of thumb: if you can show a visible label, do. If you absolutely can't, use `aria-label`. Never use `placeholder` as either.

**Q: What's the correct pattern for showing error messages inline versus in a summary?**

Both are valid — the WCAG guidance allows either. Inline errors (per-field, below each invalid input) are better for short forms with few fields because they keep the error close to the field. Error summaries (a list at the top of the form with anchor links to each invalid field) are better for long forms with many fields because the user can see all errors at once and navigate directly to each one. The best pattern combines both: show the summary at the top for an overview, and also show inline errors below each field. The summary gets focus on submission failure so screen readers announce it. Each inline error uses `aria-describedby` so it's announced when the user tabs to that field.

---

## 4. Topic Connections — Closing the Chain

### Forms as the Concrete Application of Session 9

Session 9 established that native HTML elements give you behavior for free — keyboard focusability, screen-reader role announcement, activation on Enter and Space. Forms are where that claim is most concrete. A `<label>` element extends the click target for its associated control — click the label, focus moves to the input, or the checkbox toggles. That's free behavior from a semantic element. A `<fieldset>` announces its group name to screen readers — the `<legend>` text is read before each control inside. That's the accessibility tree being built correctly from native semantics. A `<button type="submit">` submits the form on Enter without a single line of JavaScript. That's the browser's native form behavior working as designed.

### The Accessibility Layer

On top of the native behavior, the accessibility layer provides three things:

1. **Accessible name** — from `<label>` association (explicit or implicit). This is what the screen reader announces as the field's purpose. Without it, the field is announced by role only ("text field"), which is useless.

2. **Accessible description** — from `aria-describedby`. This is the error message, help text, or format hint that gives the user context about what's expected. The description is announced after the label and role.

3. **State** — from `aria-invalid`. This tells assistive technology that the field has an error. Combined with the description, the screen reader announces "Email address, invalid entry, please enter a valid email address" — label, state, and description in sequence.

### The Continuation

This session continues the Module 2 chain from Session 9's implicit-role vocabulary to the concrete application of form semantics. Session 11 (tables and ARIA basics in HTML context) continues the chain by covering table semantics and the ARIA patterns that don't belong in Module 6 (Accessibility) but do show up in HTML interviews.

---

*End of Session 10. Forms are where the "native elements give you behavior for free" claim becomes tangible: labels extend click targets, fieldsets announce groups, submit buttons work on Enter. The accessibility layer — label association, aria-describedby, aria-invalid — builds on top of that native foundation to create forms that work for everyone.*
