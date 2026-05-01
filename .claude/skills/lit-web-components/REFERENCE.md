# Lit Web Components — Quick Reference

## Property Options (`static properties` / `@property`)

| Option | Type | Default | Description |
|---|---|---|---|
| `type` | `String \| Number \| Boolean \| Array \| Object` | `String` | Type used to convert attribute ↔ property |
| `attribute` | `boolean \| string` | `true` | Map to an attribute. `false` disables; a string sets a custom attribute name |
| `reflect` | `boolean` | `false` | Reflect property changes back to the HTML attribute |
| `state` | `boolean` | `false` | Mark as internal reactive state (no attribute, not part of public API) |
| `hasChanged` | `(newVal, oldVal) => boolean` | strict `!==` | Custom change detection function |
| `converter` | `{fromAttribute, toAttribute}` | built-in | Custom attribute↔property conversion |
| `noAccessor` | `boolean` | `false` | Skip generating accessor (rarely needed) |
| `useDefault` | `boolean` | `false` | Prevent initial attribute reflection for default values |

---

## Template Expression Types

| Expression | Syntax | Notes |
|---|---|---|
| Text content | `` html`<p>${text}</p>` `` | Renders as text, XSS-safe |
| Child template | `` html`<div>${html`<span>…</span>`}</div>` `` | Nest templates |
| Attribute | `` html`<div class="${val}">` `` | String concatenation allowed |
| Boolean attribute | `` html`<input ?disabled="${bool}">` `` | Present/absent based on truthiness |
| Property | `` html`<input .value="${val}">` `` | Sets JS property, not attribute |
| Event listener | `` html`<button @click="${handler}">` `` | Binds function reference |
| Ref (element access) | `` html`<canvas ${ref(this._canvasRef)}>` `` | Requires `createRef()` / `ref()` directive |

---

## Built-in Directives

### Rendering
| Directive | Import | Purpose |
|---|---|---|
| `repeat(items, keyFn, templateFn)` | `lit/directives/repeat.js` | Keyed list rendering for efficient DOM reuse |
| `when(condition, trueCase, falseCase?)` | `lit/directives/when.js` | Cleaner conditional rendering |
| `choose(value, cases, default?)` | `lit/directives/choose.js` | Switch-case style rendering |
| `map(items, fn)` | `lit/directives/map.js` | Like `.map()` but lazy |
| `range(n)` | `lit/directives/range.js` | Render a range of numbers |
| `join(items, joiner)` | `lit/directives/join.js` | Render items with a separator |

### Class & Style
| Directive | Import | Purpose |
|---|---|---|
| `classMap(obj)` | `lit/directives/class-map.js` | Apply classes from `{className: boolean}` map |
| `styleMap(obj)` | `lit/directives/style-map.js` | Apply inline styles from `{prop: value}` map |

### Attribute Guards
| Directive | Import | Purpose |
|---|---|---|
| `ifDefined(value)` | `lit/directives/if-defined.js` | Omit attribute if value is `undefined` |
| `live(value)` | `lit/directives/live.js` | Check live DOM value (useful for inputs) |

### Async
| Directive | Import | Purpose |
|---|---|---|
| `until(...promises)` | `lit/directives/until.js` | Render placeholder until promise resolves |
| `asyncAppend(iterable)` | `lit/directives/async-append.js` | Append items from async iterable |
| `asyncReplace(iterable)` | `lit/directives/async-replace.js` | Replace content from async iterable |

### Other
| Directive | Import | Purpose |
|---|---|---|
| `ref(refOrCallback)` | `lit/directives/ref.js` | Get a reference to a rendered element |
| `cache(template)` | `lit/directives/cache.js` | Cache DOM between conditional renders |
| `keyed(key, template)` | `lit/directives/keyed.js` | Associate key with template (forces re-create on key change) |
| `guard(deps, valueFn)` | `lit/directives/guard.js` | Re-evaluate only when deps change |
| `unsafeHTML(str)` | `lit/directives/unsafe-html.js` | Render raw HTML string (**use with trusted content only**) |
| `unsafeSVG(str)` | `lit/directives/unsafe-svg.js` | Render raw SVG string (**use with trusted content only**) |

---

## CDN Import for Directives

All directives are available in the **full bundle**:
```js
import { repeat, classMap, styleMap, when, ifDefined } from
  'https://cdn.jsdelivr.net/gh/lit/dist@3/all/lit-all.min.js';
```

The **core bundle** does NOT include directives. Use the full bundle or individual npm imports when directives are needed.

---

## Lifecycle Callback Order

### First render
```
constructor()
  → connectedCallback()
    → attributeChangedCallback() (for each observed attribute)
      → willUpdate(changedProperties)
        → render()
          → update()
            → firstUpdated(changedProperties)
              → updated(changedProperties)
                → updateComplete resolves
```

### Subsequent renders (on property change)
```
[property setter called]
  → requestUpdate() scheduled (batched with microtask)
    → willUpdate(changedProperties)
      → render()
        → update()
          → updated(changedProperties)
            → updateComplete resolves
```

### Removal from DOM
```
disconnectedCallback()
```

### Return to DOM
```
connectedCallback()
  → [update scheduled if properties changed while disconnected]
```

---

## Attribute ↔ Property Type Conversion

| `type` option | Attribute → Property | Property → Attribute (reflect) |
|---|---|---|
| `String` (default) | identity | identity |
| `Number` | `Number(attrValue)` | `String(propValue)` |
| `Boolean` | attribute present = `true`, absent = `false` | `true` = set attr, `false` = remove attr |
| `Array` | `JSON.parse(attrValue)` | `JSON.stringify(propValue)` |
| `Object` | `JSON.parse(attrValue)` | `JSON.stringify(propValue)` |

---

## `changedProperties` Map

Passed to `willUpdate`, `updated`, and `firstUpdated`. Keys are property names, values are the **previous** values.

```js
updated(changedProperties) {
  if (changedProperties.has('src')) {
    const previousSrc = changedProperties.get('src');
    console.log('src changed from', previousSrc, 'to', this.src);
  }
}
```
