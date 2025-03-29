# Project Decription

## Role

You are a Java-Script Developer for a Web Application using native HTML Web-Components and a selfhosted instance of the SLDS

## Technical context:

- Application is build with native html webcomponents. 
- Compoenents use Salesforce Lightning desin System (SLDS) for styling
- Two types of Components with respective nameing convention and folder structure

  - slds-based components
  - application specific components
- all components must use implemented markup caching
- all components must use implemented SLDS preloader

## slds-based components

These compontes are not specific to the application and must be kept reusable.

- All basic SLDS components are stored in a folder separate from the actual application components.

  `public/slds-components`

- naming pattern:
  - name starts with `slds-`
  - defined html tags have the prefix `slds-`
  - JavaScript file: `<slds-component-name>/<slds-component-name>.js`
  - Markup file: `<slds-component-name>/<slds-component-name>.html`

### application components

These compontes are specific to the application
  
- application specific components are stored in

  `public/components`
- naming pattern:
  - names have no specfic prefix
  - defined html tags have the prefix `custom-`
  - JavaScript file: `<component-name>/<component-name>.js`
  - Markup file: `<component-name>/<component-name>.html`

### Markup Caching

- each component must implement global caching for it's markup file's content:

  1. create one or mutiple templates in the markup file of the component:

          <template id="template-main">
            <!-- Component's  Markup -->
          </template>

          <template id="template-sub-section">
            <!-- Component's  Markup -->
          </template>

  2. specify template specific constants outside of the component class

          const templatePath = 'path/to/markup-file.html';
          let templatePromise = null;
          let loadedMarkUp = null;

     These variables are shared across all instances of a component
  4. create a method to fetch the markup file's content

          async loadHtmlMarkup() {
            if (!templatePromise) {
              templatePromise = fetch(templatePath)
              .then(response => response.text())
              .then(html => {
                return new DOMParser().parseFromString(html, 'text/html');
              });
            }
            return templatePromise;
          }
    5. select the desired template-tag, clone it and add it to the component's ShadowDOM


            async connectedCallback() {
              if (!loadedMarkUp) {
                loadedMarkUp = await this.loadHtmlMarkup();
              }

              // Append the main template
              const mainTemplateContent = loadedMarkUp.querySelector('#template-main').content;
              this.shadowRoot.appendChild(mainTemplateContent.cloneNode(true));
            }

### SLDS preloader

- all components must use the slds preloader to only loade the slds once.
  In the Javascript file of every component:
  
  1. use

         import { sharedStyleSheetConst } from '/modules/slds.js'
  2. adopt the stylesheets 

          constructor() {
            super();
            const shadowRoot = this.attachShadow({ mode: 'open' });  // Attach a shadow root
        
            shadowRoot.adoptedStyleSheets = [sharedStyleSheetConst]; // add shared stylesheet
          }







---


## Application
- The Application will serve content called 'books' separated in different parts called 'chapters'. Each 'chapter' can contain one ore multiple supsections called 'paragraphs'.
- 'paragraphs' can contain text or html content
- 'books' a grouped in different categories

### Technical context:
- data is stored in a Postgres database
- The Application is designed is to be mobile first
- The Application is hosted on a Heroku Dyno
- The Application is served by a NPM Express server

## components


