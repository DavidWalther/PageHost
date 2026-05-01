---
name: lit-web-components
description: Build, edit, and debug web components using the Lit library (LitElement). Use this skill when working with Lit components, including defining components, reactive properties, html templates, scoped styles, lifecycle methods, events, directives, and shadow DOM. Also covers all setup options (npm, CDN pre-built bundles).
when_to_use: Triggered by requests like "create a Lit component", "add a property to a LitElement", "use the repeat directive", "set up Lit via CDN", "dispatch a custom event from a web component", or any mention of LitElement, lit-html, or lit-element.
---

# Lit Web Components

Lit is a lightweight library (~5kB) for building fast, standards-based web components. Every Lit component is a native [Custom Element](https://developer.mozilla.org/en-US/docs/Web/API/Web_components/Using_custom_elements) that works in any HTML environment, with any framework or none at all.

For supporting files, see:
- `REFERENCE.md` — Property options table, template expressions, directives, lifecycle order
- `examples/basic-component.md` — A minimal working counter component
- `examples/advanced-patterns.md` — Events, internal state, repeat directive, slots

---

## 1. Setup & Import Options

### Option A — CDN Pre-Built Bundle (no build step required)

The simplest way to use Lit. Import directly in a `<script type="module">` or a `.js` module file.

**Core bundle** (LitElement + html + css + reactive properties):
```js
import { LitElement, html, css } from 'https://cdn.jsdelivr.net/gh/lit/dist@3/core/lit-core.min.js';
```

**Full bundle** (core + all directives + decorators):
```js
import { LitElement, html, css, repeat, classMap } from 'https://cdn.jsdelivr.net/gh/lit/dist@3/all/lit-all.min.js';
```

**Alternative CDN mirrors** (same content, different providers):
```js
// unpkg
import { LitElement, html, css } from 'https://unpkg.com/lit@3/index.js?module';

// esm.sh (recommended for production CDN use)
import { LitElement, html, css } from 'https://esm.sh/lit@3';
```

**When to choose CDN**: Standalone HTML pages, CMS-managed sites, projects without a build pipeline, progressive enhancement scenarios.

### Option B — npm + Bundler

Best for applications using Vite, Rollup, Webpack, or esbuild.

```bash
npm install lit
```

```js
import { LitElement, html, css } from 'lit';
// Directives are in sub-packages:
import { repeat } from 'lit/directives/repeat.js';
import { classMap } from 'lit/directives/class-map.js';
import { styleMap } from 'lit/directives/style-map.js';
import { when } from 'lit/directives/when.js';
import { ifDefined } from 'lit/directives/if-defined.js';
```

**TypeScript config** (`tsconfig.json`) for decorators:
```json
{
  "compilerOptions": {
    "target": "ES2021",
    "module": "ES2020",
    "moduleResolution": "node",
    "experimentalDecorators": true,
    "useDefineForClassFields": false
  }
}
```

**When to choose npm**: Apps with a build pipeline, TypeScript projects, tree-shaking requirements, monorepos.

---

## 2. Defining a Component

A Lit component is a class extending `LitElement`, registered as a custom element.

### JavaScript (no decorators)
```js
import { LitElement, html } from 'https://cdn.jsdelivr.net/gh/lit/dist@3/core/lit-core.min.js';

class MyGreeting extends LitElement {
  render() {
    return html`<p>Hello, world!</p>`;
  }
}
customElements.define('my-greeting', MyGreeting);
```

```html
<my-greeting></my-greeting>
```

### TypeScript (with decorators)
```ts
import { LitElement, html } from 'lit';
import { customElement } from 'lit/decorators.js';

@customElement('my-greeting')
export class MyGreeting extends LitElement {
  render() {
    return html`<p>Hello, world!</p>`;
  }
}
```

**Rules for custom element names**: Must contain a hyphen (e.g. `my-button`, not `mybutton`).

---

## 3. Reactive Properties

Reactive properties trigger a re-render whenever their value changes.

### JavaScript — `static properties`
```js
class MyElement extends LitElement {
  static properties = {
    name: { type: String },
    count: { type: Number },
    active: { type: Boolean },
    items: { type: Array },
    config: { type: Object },
  };

  constructor() {
    super();
    // Always initialize in constructor (not as class fields) in plain JS
    this.name = 'World';
    this.count = 0;
    this.active = false;
    this.items = [];
    this.config = {};
  }
}
```

### TypeScript — `@property` decorator
```ts
import { property } from 'lit/decorators.js';

class MyElement extends LitElement {
  @property({ type: String }) name = 'World';
  @property({ type: Number }) count = 0;
  @property({ type: Boolean }) active = false;
}
```

### Internal reactive state (not part of public API)

State changes trigger re-renders but are not exposed as attributes.

```js
// JavaScript
static properties = {
  _expanded: { state: true },
};
constructor() { super(); this._expanded = false; }
```

```ts
// TypeScript
import { state } from 'lit/decorators.js';
@state() private _expanded = false;
```

### Important: JS class fields vs reactive properties

In plain JavaScript, **never declare reactive properties as class fields** — use the constructor instead:
```js
// ❌ WRONG — class field hides the reactive accessor
class Bad extends LitElement {
  static properties = { name: { type: String } };
  name = 'World'; // This breaks reactivity!
}

// ✅ CORRECT
class Good extends LitElement {
  static properties = { name: { type: String } };
  constructor() { super(); this.name = 'World'; }
}
```
TypeScript is exempt from this rule when using decorators.

---

## 4. Templates

The `render()` method returns a template created with the `html` tagged template literal.

```js
render() {
  return html`
    <h1>Hello, ${this.name}!</h1>
    <p>Count: ${this.count}</p>
  `;
}
```

### Expressions

| Expression type | Syntax | Example |
|---|---|---|
| Child content | `${value}` | `html\`<p>${this.msg}</p>\`` |
| Attribute | `attr="${value}"` | `html\`<div class="${this.cls}"></div>\`` |
| Boolean attribute | `?attr="${bool}"` | `html\`<button ?disabled="${this.off}"></button>\`` |
| Property | `.prop="${value}"` | `html\`<input .value="${this.val}">\`` |
| Event listener | `@event="${handler}"` | `html\`<button @click="${this._onClick}"></button>\`` |

### Conditionals
```js
render() {
  return html`
    ${this.active
      ? html`<span>Active</span>`
      : html`<span>Inactive</span>`
    }
  `;
}
```

### Lists
```js
render() {
  return html`
    <ul>
      ${this.items.map(item => html`<li>${item.name}</li>`)}
    </ul>
  `;
}
```

---

## 5. Styles

Define scoped styles using the `css` tagged template literal. Styles are encapsulated in the shadow DOM and don't leak in or out.

```js
static styles = css`
  :host {
    display: block;         /* LitElement is inline by default */
    font-family: sans-serif;
  }

  :host([hidden]) {
    display: none;
  }

  .container {
    padding: 1rem;
  }

  h1 {
    color: var(--my-element-heading-color, #333);  /* CSS custom property with fallback */
  }
`;
```

### Multiple style sheets
```js
static styles = [
  baseStyles,       // imported css`` from another module
  css`
    :host { color: red; }
  `,
];
```

### CSS custom properties for theming

Use CSS custom properties (variables) to allow external styling:
```js
static styles = css`
  :host {
    background: var(--card-bg, white);
    color: var(--card-color, #333);
  }
`;
```

---

## 6. Lifecycle Methods

Lit extends the native custom element lifecycle with reactive update callbacks.

### Key callbacks (in execution order on first render)

1. `constructor()` — initialize properties; call `super()` first
2. `connectedCallback()` — element added to DOM; call `super.connectedCallback()`
3. `willUpdate(changedProperties)` — before render; compute derived data here (no side effects)
4. `render()` — return the template (pure function of state, no side effects)
5. `firstUpdated(changedProperties)` — runs once after first render; access DOM here
6. `updated(changedProperties)` — runs after every render; respond to property changes

### Cleanup

```js
disconnectedCallback() {
  super.disconnectedCallback();
  // Remove event listeners, cancel timers, clean up subscriptions
}
```

### Checking which properties changed
```js
updated(changedProperties) {
  if (changedProperties.has('userId')) {
    this._fetchUser(this.userId);
  }
}
```

### Requesting a manual update
```js
this.requestUpdate(); // triggers re-render even without a property change
await this.updateComplete; // promise that resolves after the next render
```

---

## 7. Events

### Dispatching custom events
```js
_handleClick() {
  this.dispatchEvent(new CustomEvent('my-event', {
    detail: { value: this.count },
    bubbles: true,       // event bubbles up the DOM
    composed: true,      // event crosses shadow DOM boundaries
  }));
}
```

### Listening to events in templates
```js
render() {
  return html`
    <button @click="${this._handleClick}">Click me</button>
    <input @input="${this._handleInput}" @change="${this._handleChange}">
  `;
}
```

### Listening to events on the component from outside
```html
<my-counter @count-changed="${handleCountChanged}"></my-counter>
```

---

## 8. Directives

Directives extend the template system. Import from the full CDN bundle or from `lit/directives/` (npm).

### `repeat` — efficient list rendering with keyed diffing
```js
import { repeat } from 'https://cdn.jsdelivr.net/gh/lit/dist@3/all/lit-all.min.js';

render() {
  return html`
    <ul>
      ${repeat(
        this.items,
        (item) => item.id,              // key function
        (item) => html`<li>${item.name}</li>`  // template
      )}
    </ul>
  `;
}
```

### `classMap` — conditionally apply CSS classes
```js
import { classMap } from 'https://cdn.jsdelivr.net/gh/lit/dist@3/all/lit-all.min.js';

render() {
  return html`
    <div class="${classMap({
      active: this.active,
      disabled: this.disabled,
      'is-large': this.size === 'large',
    })}">...</div>
  `;
}
```

### `styleMap` — conditionally apply inline styles
```js
import { styleMap } from 'https://cdn.jsdelivr.net/gh/lit/dist@3/all/lit-all.min.js';

render() {
  return html`
    <div style="${styleMap({
      color: this.textColor,
      fontSize: this.size + 'px',
    })}">...</div>
  `;
}
```

### `when` — conditional rendering (cleaner than ternary)
```js
import { when } from 'https://cdn.jsdelivr.net/gh/lit/dist@3/all/lit-all.min.js';

render() {
  return html`
    ${when(this.loading,
      () => html`<span>Loading…</span>`,
      () => html`<span>${this.content}</span>`
    )}
  `;
}
```

### `ifDefined` — only render attribute if value is defined
```js
import { ifDefined } from 'https://cdn.jsdelivr.net/gh/lit/dist@3/all/lit-all.min.js';

render() {
  return html`<a href="${ifDefined(this.url)}">${this.label}</a>`;
}
```

---

## 9. Shadow DOM & Slots

### Accessing the shadow root
```js
firstUpdated() {
  const input = this.shadowRoot.querySelector('input');
  input.focus();
}
```

### Slots — composing content from outside
```js
render() {
  return html`
    <div class="card">
      <div class="header">
        <slot name="header">Default Header</slot>  <!-- named slot with fallback -->
      </div>
      <div class="body">
        <slot></slot>  <!-- default slot -->
      </div>
    </div>
  `;
}
```

```html
<!-- Usage -->
<my-card>
  <span slot="header">My Title</span>
  <p>Card body content goes here.</p>
</my-card>
```

### Querying slotted elements
```js
const slotted = this.shadowRoot
  .querySelector('slot')
  .assignedElements({ flatten: true });
```

---

## 10. Best Practices

- Always call `super.connectedCallback()` and `super.disconnectedCallback()`
- Never mutate `this.items` directly — replace the array to trigger re-render: `this.items = [...this.items, newItem]`
- Use `state: true` for internal-only reactive state; use public `properties` for the component API
- Fire events with `bubbles: true, composed: true` when consumers live outside the shadow tree
- Use CSS custom properties to expose styling hooks instead of `:part()` or global CSS
- Keep `render()` pure — no side effects, no async operations
