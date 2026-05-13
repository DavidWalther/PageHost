# Example: Basic Lit Component (Counter)

A minimal, self-contained counter component demonstrating:
- CDN import (core bundle)
- `static properties` with `type: Number`
- `static styles` with `:host` and scoped CSS
- `render()` with `html` template, attribute binding, event listener

---

## Component file: `simple-counter.js`

```js
import { LitElement, html, css } from 'https://cdn.jsdelivr.net/gh/lit/dist@3/core/lit-core.min.js';

class SimpleCounter extends LitElement {
  static properties = {
    count: { type: Number },
    label: { type: String },
  };

  static styles = css`
    :host {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      font-family: sans-serif;
    }

    button {
      padding: 0.25rem 0.75rem;
      font-size: 1rem;
      cursor: pointer;
      border: 1px solid #ccc;
      border-radius: 4px;
      background: #f5f5f5;
    }

    button:hover {
      background: #e0e0e0;
    }

    .count {
      min-width: 2rem;
      text-align: center;
      font-size: 1.25rem;
      font-weight: bold;
    }
  `;

  constructor() {
    super();
    this.count = 0;
    this.label = 'Counter';
  }

  render() {
    return html`
      <span>${this.label}:</span>
      <button @click="${this._decrement}">−</button>
      <span class="count">${this.count}</span>
      <button @click="${this._increment}">+</button>
    `;
  }

  _increment() {
    this.count += 1;
  }

  _decrement() {
    this.count -= 1;
  }
}

customElements.define('simple-counter', SimpleCounter);
```

---

## Usage in HTML

```html
<!DOCTYPE html>
<html>
  <head>
    <script type="module" src="simple-counter.js"></script>
  </head>
  <body>
    <!-- default count=0, label="Counter" -->
    <simple-counter></simple-counter>

    <!-- set initial count via attribute -->
    <simple-counter count="10" label="Score"></simple-counter>
  </body>
</html>
```

---

## Key points

- `static properties` declares `count` and `label` as reactive — any change triggers a re-render.
- Properties are initialized in `constructor()` (required in plain JS to avoid class-field issues).
- `@click="${this._increment}"` binds the click event; Lit automatically removes/re-adds listeners efficiently.
- `:host` styles the component's outer element (`<simple-counter>` itself). `display: inline-flex` is set because custom elements default to `display: inline`.
- No build step required — the CDN core bundle is loaded directly by the browser.
