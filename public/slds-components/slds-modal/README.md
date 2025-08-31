# SLDS Modal Component

A Salesforce Lightning Design System (SLDS) modal component built with Web Components.

## Usage

```html
<!-- Basic modal with title -->
<slds-modal id="myModal" title="Modal Title">
  <div>
    <p>Your modal content goes here.</p>
  </div>
</slds-modal>

<!-- Modal with custom headline slot -->
<slds-modal id="modalWithSlot">
  <span slot="headline">Custom Headline</span>
  <div>
    <p>Modal content with custom headline.</p>
  </div>
</slds-modal>

<!-- Headless modal (no header) -->
<slds-modal id="headlessModal" headless>
  <div>
    <h2>Custom Header Content</h2>
    <p>This modal has no header section.</p>
  </div>
</slds-modal>

<!-- Footless modal (no footer) -->
<slds-modal id="footlessModal" footless title="No Footer">
  <div>
    <p>This modal has no footer section.</p>
    <button onclick="closeModal()">Custom Action</button>
  </div>
</slds-modal>

<!-- Minimal modal (no header or footer) -->
<slds-modal id="minimalModal" headless footless>
  <div>
    <p>Minimal modal with only content area.</p>
  </div>
</slds-modal>
```

## JavaScript Usage

```javascript
// Import the component
import '/slds-components/slds-modal/modal.js';

// Show a modal
document.getElementById('myModal').show();

// Hide a modal
document.getElementById('myModal').hide();

// Listen for events
document.addEventListener('show', (event) => {
  console.log('Modal shown:', event.detail);
});

document.addEventListener('close', (event) => {
  console.log('Modal closed:', event.detail);
});

document.addEventListener('save', (event) => {
  console.log('Save clicked:', event.detail);
});
```

## Attributes

- `title` (string): Sets the modal title displayed in the header
- `headless` (boolean): Hides the modal header section
- `footless` (boolean): Hides the modal footer section
- `open` (boolean): Controls modal visibility

## Slots

- Default slot: Main content area
- `headline` slot: Custom headline content (overrides title attribute)

## Methods

- `show()`: Opens the modal
- `hide()`: Closes the modal

## Events

- `show`: Fired when modal is opened
- `close`: Fired when modal is closed
- `save`: Fired when save button is clicked

## Features

- Follows SLDS design guidelines
- Accessible with proper ARIA attributes
- Keyboard navigation (Escape to close)
- Click outside to close
- Body scroll prevention when open
- Shadow DOM encapsulation