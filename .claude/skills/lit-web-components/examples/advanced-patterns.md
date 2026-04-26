# Example: Advanced Lit Patterns

Demonstrates:
- Internal reactive state (`state: true`)
- Custom events with `bubbles` and `composed`
- `repeat` directive for efficient list rendering
- `classMap` directive for conditional classes
- `when` directive for conditional rendering
- Lifecycle: `firstUpdated`, `updated`, `disconnectedCallback`
- `<slot>` for content projection

Full bundle CDN import is used because directives are needed.

---

## Component file: `task-list.js`

```js
import {
  LitElement, html, css,
  repeat, classMap, when,
} from 'https://cdn.jsdelivr.net/gh/lit/dist@3/all/lit-all.min.js';

class TaskList extends LitElement {
  // --- Public reactive properties (component API) ---
  static properties = {
    heading:  { type: String },
    tasks:    { type: Array },

    // --- Internal reactive state (not part of public API) ---
    _filter:  { state: true },
    _newTask: { state: true },
  };

  static styles = css`
    :host {
      display: block;
      font-family: sans-serif;
      max-width: 400px;
    }

    h2 {
      margin: 0 0 0.5rem;
    }

    .filters {
      display: flex;
      gap: 0.5rem;
      margin-bottom: 0.75rem;
    }

    .filter-btn {
      padding: 0.2rem 0.6rem;
      border: 1px solid #ccc;
      border-radius: 4px;
      cursor: pointer;
      background: white;
    }

    .filter-btn.active {
      background: #0070f3;
      color: white;
      border-color: #0070f3;
    }

    ul {
      list-style: none;
      padding: 0;
      margin: 0;
    }

    li {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.4rem 0;
      border-bottom: 1px solid #eee;
    }

    li.done span {
      text-decoration: line-through;
      color: #aaa;
    }

    .add-row {
      display: flex;
      gap: 0.5rem;
      margin-top: 0.75rem;
    }

    input {
      flex: 1;
      padding: 0.3rem 0.5rem;
      border: 1px solid #ccc;
      border-radius: 4px;
    }

    button {
      padding: 0.3rem 0.75rem;
      cursor: pointer;
      border: 1px solid #ccc;
      border-radius: 4px;
    }
  `;

  constructor() {
    super();
    this.heading = 'Tasks';
    this.tasks = [];
    this._filter = 'all';   // 'all' | 'active' | 'done'
    this._newTask = '';
  }

  // ---- Lifecycle ----

  firstUpdated() {
    // Focus the input after first render
    this.shadowRoot.querySelector('input')?.focus();
  }

  updated(changedProperties) {
    // React to external tasks prop change
    if (changedProperties.has('tasks')) {
      this.dispatchEvent(new CustomEvent('tasks-changed', {
        detail: { count: this.tasks.length },
        bubbles: true,
        composed: true,   // crosses shadow DOM boundary
      }));
    }
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    // Clean up if needed (e.g., remove window listeners, cancel timers)
  }

  // ---- Computed ----

  get _visibleTasks() {
    if (this._filter === 'active') return this.tasks.filter(t => !t.done);
    if (this._filter === 'done')   return this.tasks.filter(t => t.done);
    return this.tasks;
  }

  // ---- Handlers ----

  _toggleTask(id) {
    // Replace array (never mutate) so Lit detects the change
    this.tasks = this.tasks.map(t =>
      t.id === id ? { ...t, done: !t.done } : t
    );
  }

  _addTask() {
    const name = this._newTask.trim();
    if (!name) return;
    this.tasks = [
      ...this.tasks,
      { id: Date.now(), name, done: false },
    ];
    this._newTask = '';
  }

  _onInput(e) {
    this._newTask = e.target.value;
  }

  _onKeydown(e) {
    if (e.key === 'Enter') this._addTask();
  }

  // ---- Template ----

  render() {
    return html`
      <h2>${this.heading}</h2>

      <!-- Named slot for optional header actions -->
      <slot name="actions"></slot>

      <!-- Filter buttons using classMap -->
      <div class="filters">
        ${['all', 'active', 'done'].map(f => html`
          <button
            class="${classMap({ 'filter-btn': true, active: this._filter === f })}"
            @click="${() => { this._filter = f; }}"
          >${f}</button>
        `)}
      </div>

      <!-- Task list using repeat for keyed diffing -->
      ${when(
        this._visibleTasks.length === 0,
        () => html`<p>No tasks.</p>`,
        () => html`
          <ul>
            ${repeat(
              this._visibleTasks,
              (task) => task.id,
              (task) => html`
                <li class="${classMap({ done: task.done })}">
                  <input
                    type="checkbox"
                    .checked="${task.done}"
                    @change="${() => this._toggleTask(task.id)}"
                  >
                  <span>${task.name}</span>
                </li>
              `
            )}
          </ul>
        `
      )}

      <!-- Add task row -->
      <div class="add-row">
        <input
          type="text"
          placeholder="New task…"
          .value="${this._newTask}"
          @input="${this._onInput}"
          @keydown="${this._onKeydown}"
        >
        <button @click="${this._addTask}">Add</button>
      </div>

      <!-- Default slot for any additional content -->
      <slot></slot>
    `;
  }
}

customElements.define('task-list', TaskList);
```

---

## Usage in HTML

```html
<!DOCTYPE html>
<html>
  <head>
    <script type="module" src="task-list.js"></script>
    <script type="module">
      const list = document.querySelector('task-list');

      // Set initial tasks via JS property (not attribute — arrays use .prop binding)
      list.tasks = [
        { id: 1, name: 'Buy groceries', done: false },
        { id: 2, name: 'Walk the dog', done: true },
      ];

      // Listen to the custom event
      list.addEventListener('tasks-changed', (e) => {
        console.log('Task count:', e.detail.count);
      });
    </script>
  </head>
  <body>
    <task-list heading="My Tasks">
      <!-- Named slot content -->
      <button slot="actions">Export</button>
    </task-list>
  </body>
</html>
```

---

## Key points

| Pattern | Where used | Notes |
|---|---|---|
| `state: true` | `_filter`, `_newTask` | Internal state — not visible as attributes, not in public API |
| `repeat(items, keyFn, tplFn)` | Task list | Lit reuses existing DOM nodes by key instead of recreating |
| `classMap({cls: bool})` | Filter buttons, list items | Adds/removes classes based on booleans |
| `when(cond, trueCase, falseCase)` | Empty state check | Cleaner than ternary for larger blocks |
| `.checked="${task.done}"` | Checkbox | `.prop` binding sets the JS property, keeping it in sync with state |
| `composed: true` | `tasks-changed` event | Required so the event crosses the shadow root boundary |
| `slot` / `slot="actions"` | `<slot>` elements | Content projection — consumers insert their own HTML |
| Never mutate arrays | `_toggleTask`, `_addTask` | Replace with new array so Lit's `hasChanged` (strict `!==`) detects the change |
