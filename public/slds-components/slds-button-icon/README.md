## SLDSButtonIcon Component

The `SLDSButtonIcon` component is a custom web component that creates a Salesforce Lightning Design System (SLDS) styled button with an icon. It supports various configurations like icon selection, size, variant, and disabled state.

### Attributes

- **icon**: Specifies the icon to be used in the format "icon-type:icon-name".
- **disabled**: If present, disables the button.
- **size**: Defines the size of the button. Acceptable values are `"large"`, `"small"`, `"x-small"`, `"xx-small"`.
- **variant**: Determines the button's style variant. Possible values are `"icon-only"`, `"container-transparent"`, `"container-filled"`.
- **no-border** (Deprecated): If present, removes the border styling from the button. Note: This attribute has been deprecated and replaced by the `variant` attribute.

### Usage

To use the `SLDSButtonIcon` component, you need to define the element in your HTML and set any desired attributes. Here's an example of how to use it:

```html
<slds-button-icon icon="utility:settings" size="large" variant="icon-only"></slds-button-icon>
```

### Events

- **sldsbuttonclick**: This event is dispatched when the button is clicked, provided the button is not disabled.

### Example

```html
<!-- SLDS Button Icon with settings icon and large size -->
<slds-button-icon icon="utility:settings" size="large"></slds-button-icon>

<!-- SLDS Button Icon as a filled container with a disabled state -->
<slds-button-icon icon="utility:download" variant="container-filled" disabled></slds-button-icon>
```

### Importing the Component

Make sure to import the JavaScript file of the component into your project to use `SLDSButtonIcon`:

```html
<script type="module" src="path/to/slds-button-icon.js"></script>
```

### Styling

The component internally uses SLDS classes and supports customizations through the exposed attributes. Direct CSS styling can be applied to the custom element, and it will inherit the styles according to the Shadow DOM encapsulation rules.
