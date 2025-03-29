import { addGlobalStylesToShadowRoot } from "/modules/global-styles.mjs";

const chaperOneJson = [
  {"title": "Hello, World!", "content": "This is the body of the paragraph component."},
  {"title": "Hello, Paragraph two!", "content": "This is the body of the second paragraph component."},
  {"content": "this paragraph has no title"}
];

const chaperTwoJson = [
  {"title": "Hello, second World!", "content": "This is the body of another paragraph component."},
  {"title": "Hello, Paragraph 2.2!", "content": "This is the body"}
];

const chapterAsychronousCssLoading = [{
  "title": "Necessaty",
  "content": "All components must import the SLDS Styling. Yet fetching the CSS-Sheet over and over again would cost lots of bandwidth and speed. All components are loaded individually and asysnchronously. Therfore a way must be found to have only the first call to result in an actuall fetch while caching the resullt for all subseeding fetches."
},
{
  "title": "Solution",
  "content": "<ol><li>An SLDS loader is created to bundle fetch and cachedHtmlTemplate. every acces to the style sheet has to go via this loader</li><li>To make sure the loader is executed first and all other components have to be inserted after</li><li>Every Component has to import the slds loader and attach the sheet to its shadow dom</li></ol>"
},
{
  "content": "Yet it turned out even if fetch once works the stylesheet must be included in the html once too."
}];



class MainApp extends HTMLElement {
  constructor() {
    super();
    // Attach a shadow DOM tree to the instance
    const shadowRoot = this.attachShadow({ mode: 'open' });
    addGlobalStylesToShadowRoot(this.shadowRoot); // add shared stylesheet
  }

  //--------------------------
  // Handlers
  //--------------------------

  async connectedCallback() {
    // const templateContent = await this.loadHtmlTemplate();
    // this.shadowRoot.appendChild(templateContent.cloneNode(true));
    debugger
    this.attachChapters(this.shadowRoot);
  }

  attachChapters(mainNode) {

    mainNode.appendChild(this.createChapter_css());
    mainNode.appendChild(document.createElement('slds-input-toggle'));
    mainNode.appendChild(this.createChapter_one());
    mainNode.appendChild(document.createElement('slds-input-toggle'));
    mainNode.appendChild(this.createChapter_two());
    mainNode.appendChild(document.createElement('slds-input-toggle'));
  }

  createChapter_css(){
    const cssChapterElement = document.createElement('custom-chapter');
    cssChapterElement.setAttribute('title', 'Load CSS only once');
    cssChapterElement.setAttribute('paragraphs', JSON.stringify(chapterAsychronousCssLoading));
    return cssChapterElement;
  }
  
  createChapter_one(){
    const cssChapterElement = document.createElement('custom-chapter');
    cssChapterElement.setAttribute('title', 'Chapter One');
    cssChapterElement.setAttribute('paragraphs', JSON.stringify(chaperOneJson));
    return cssChapterElement;
  }

  createChapter_two(){
    const cssChapterElement = document.createElement('custom-chapter');
    cssChapterElement.setAttribute('title', 'Chapter two');
    cssChapterElement.setAttribute('paragraphs', JSON.stringify(chaperTwoJson));
    return cssChapterElement;
  }
}

customElements.define('custom-main-app', MainApp);
