import { LitElement, html, css } from 'https://cdn.jsdelivr.net/gh/lit/dist@3/core/lit-core.min.js';
import { addGlobalStylesToShadowRoot } from "/modules/global-styles.mjs";

class CustomChapter extends LitElement {
  labels = {
    labelCreateParagraph: 'Absatz erstellen',
    labelShareChapter: 'Kapitel teilen',
    labelNotifcationLinkCopied: 'Link kopiert',
    labelParagraphCreated: 'Absatzt erstellt',
    labelParagraphCreateError: 'Fehler beim Erstellen des Absatzes',
  };

  static properties = {
    id: { type: String },
    chapterData: { type: Object },
    paragraphsData: { type: Array },
    loading: { type: Boolean },
  };

  static styles = css`
    /* Add SLDS styling for your component here */
    :host {
      display: block;
    }
    #chapter-content {
      margin-top: 1rem;
    }
    .paragraph-container.pending {
      min-height: 120px; /* Reserve space to prevent triggering the intersection observer too early */
    }
    .paragraph-container {
      width: 100%;
      transition: min-height 0.3s ease; /* Smooth height transitions */
    }
    .paragraph-container.loaded {
      min-height: auto; /* Allow natural height after loading */
    }
  `;

  constructor() {
    super();
    this.id = null;
    this.chapterData = null;
    this.paragraphsData = [];
    this.loading = false;
    this.templatePromise = null;
    this.loadedMarkUp = null;
    this.pendingNewParagraphId = null; // Track the id of a paragraph being created
    this.intersectionObserver = null; // Intersection Observer for lazy loading
    this.lastItemObserver = null; // Special observer for the last item
    this.observedElements = new Map(); // Track observed elements
  }

  connectedCallback() {
    super.connectedCallback();
    addGlobalStylesToShadowRoot(this.shadowRoot); // Add shared stylesheet
    // Listen for loaded events from paragraphs
    this.addEventListener('loaded', this._onParagraphLoaded, true);
    // Initialize intersection observer for lazy loading
    this.initializeIntersectionObserver();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.removeEventListener('loaded', this._onParagraphLoaded, true);
    // Clean up intersection observer
    this.cleanupIntersectionObserver();
  }

  _onParagraphLoaded = (event) => {
    // - Only handle if we are waiting for a new paragraph
    // - This also ensures the component will new proccess the event it has fired itself
    if (this.pendingNewParagraphId && event.target.id === this.pendingNewParagraphId) {
      this.requestUpdate();
      this.pendingNewParagraphId = null;
    }
  }

  updated(changedProperties) {
    if (changedProperties.has('id')) {
      this.handleIdChange(this.id);
    }
    
    // Set up intersection observing for lazy-loaded paragraphs
    // Only when we have data AND we're not loading
    if ((changedProperties.has('paragraphsData') || changedProperties.has('chapterData')) 
        && !this.loading && this.paragraphsData.length > 0) {
      this.setupParagraphObserving();
    }
  }

  setupParagraphObserving() {
    // Clean up any existing observations first
    this.cleanupIntersectionObserver();
    this.initializeIntersectionObserver();
    
    // Use multiple animation frames to ensure DOM is fully rendered
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const paragraphContainers = this.shadowRoot.querySelectorAll('.paragraph-container');
        console.log(`Found ${paragraphContainers.length} paragraph containers`);
        
        paragraphContainers.forEach((container, index) => {
          // Skip the first paragraph (index 0) as it loads immediately
          if (index == 0) {
            console.log(`Skipping first paragraph (index 0): ${container.querySelector('custom-paragraph')?.id}`);
            return;
          }
          const paragraphElement = container.querySelector('custom-paragraph');
          if (! paragraphElement) {
            console.log(`No custom-paragraph found in container for paragraph index ${index}`);
            return;
          }
          let hasNoLoadAttribute = paragraphElement.hasAttribute('no-load');
          if(!hasNoLoadAttribute) {
            console.log(`Paragraph ${index} already loaded, skipping observer setup: ${paragraphElement.id}`);
            return;
          }

          // Check if this is the last item
          const isLastItem = index === paragraphContainers.length - 1;
          
          if (isLastItem) {
            console.log(`Setting up LAST ITEM observer for paragraph ${index}: ${paragraphElement.id}`);
            this.observeElementAsLast(container);
          } else {
            console.log(`Setting up regular observer for paragraph ${index}: ${paragraphElement.id}`);
            this.observeElement(container);
          }
        }); 
      });
    });
  }

  async handleIdChange(newId) {
    if (!newId || newId === 'null') {
      this.clearContent();
    } else {
      this.loading = true;
      this.chapterData = null;
      this.paragraphsData = [];
      this.fetchAndDisplayChapter(newId);
    }
  }

  async fetchAndDisplayChapter(chapterId) {
    if (!chapterId) return;

    this.fireQueryEvent_Chapter(chapterId, (error, data) => {
      if (error) {
        console.error('Error fetching chapter data:', error);
        this.loading = false;
        return;
      }

      this.dispatchEvent(
        new CustomEvent('loaded', {
          detail: { chapterData: data },
          bubbles: true,
          composed: true,
        })
      );

      this.chapterData = data;
      this.paragraphsData = data.paragraphs || [];
      this.loading = false;
    });
  }

  clearContent() {
    this.chapterData = null;
    this.paragraphsData = [];
    // Clean up any existing observations
    this.cleanupIntersectionObserver();
  }

  initializeIntersectionObserver() {
    // Create intersection observer with settings optimized for regular items
    this.intersectionObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            console.log(`Paragraph container is intersecting:`, entry.target, `ratio: ${entry.intersectionRatio}`);
            this.executeLazyLoading(entry.target);
          }
        });
      },
      {
        root: null, // Use viewport as root
        rootMargin: '0px 0px -100px 0px', // Reduced from -200px to -100px
        threshold: [0, 0.1, 0.25], // Multiple thresholds to catch edge cases
      }
    );

    // Create special observer for the last item with more lenient settings
    this.lastItemObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            console.log(`Last paragraph container is intersecting:`, entry.target, `ratio: ${entry.intersectionRatio}`);
            this.executeLazyLoading(entry.target);
          }
        });
      },
      {
        root: null,
        rootMargin: '50px 0px 50px 0px', // More lenient margins for last item
        threshold: 0, // Any intersection triggers loading for last item
      }
    );
  }
  
  executeLazyLoading(element) {
    if (element) {
      const paragraphElement = element.querySelector('custom-paragraph');
      if (paragraphElement && paragraphElement.hasAttribute('no-load')) {
        console.log(`Executing lazy load for paragraph ${paragraphElement.id}`);
        
        // Mark container as loading to prevent cascade
        element.classList.add('loading');
        
        // Remove pending class to free reserved space
        element.classList.remove('pending');

        // Remove no-load attribute to trigger loading
        paragraphElement.removeAttribute('no-load');
        
        // Stop observing this element immediately from both observers
        if (this.intersectionObserver) {
          this.intersectionObserver.unobserve(element);
        }
        if (this.lastItemObserver) {
          this.lastItemObserver.unobserve(element);
        }
        this.observedElements.delete(element);
        
        // Mark as loaded after a short delay to allow content to load
        setTimeout(() => {
          element.classList.remove('loading');
          element.classList.add('loaded');
        }, 100);
      } else {
        console.log(`Skipping lazy load - paragraph already loaded or no-load not found`);
      }
    }
  }

  cleanupIntersectionObserver() {
    if (this.intersectionObserver) {
      this.intersectionObserver.disconnect();
      this.intersectionObserver = null;
    }
    if (this.lastItemObserver) {
      this.lastItemObserver.disconnect();
      this.lastItemObserver = null;
    }
    this.observedElements.clear();
  }

  observeElement(element) {
    if (this.intersectionObserver && element) {
      this.intersectionObserver.observe(element);
      this.observedElements.set(element, 'regular');
    }
  }

  observeElementAsLast(element) {
    if (this.lastItemObserver && element) {
      this.lastItemObserver.observe(element);
      this.observedElements.set(element, 'last');
    }
  }

  render() {
    if (this.loading) {
      return html`<slds-spinner size="large"></slds-spinner>`;
    }
    if (!this.chapterData) {
      return html``;
    }

    // Check if user is logged in and has 'create' scope
    const canCreate = this.checkCreatePermission();

    return html`
      <slds-card no-footer>
        <span slot="header">${this.chapterData.name}</span>
        <div slot="actions">
        ${canCreate ? html`
          <slds-button-icon
            icon="utility:add"
            variant="container-filled"
            @click=${this.handleCreateParagraphClick}
          ></slds-button-icon>`
          : ''
        }
        <slds-button-icon
          icon="utility:link"
          variant="container-filled"
          @click=${this.handleShareClick}
        ></slds-button-icon>
        </div>
        <div id="chapter-content">
          ${this.renderParagraphs()}
        </div>
      </slds-card>
    `;
  }

  renderParagraphs() {
    const paragraphs = this.chapterData?.reversed
      ? [...this.paragraphsData].reverse()
      : this.paragraphsData;

    return paragraphs.map(
      (paragraph, index) => html`
        <div class="slds-col slds-p-bottom_small paragraph-container pending" 
             data-paragraph-id=${paragraph.id}>
          <custom-paragraph
            id=${paragraph.id}
            data-name=${paragraph.name || ''}
            ?no-load=${index > 0}
          ></custom-paragraph>
        </div>
      `
    );
  }

  handleShareClick() {
    const shareUrl = `${location.origin}/${this.id}`;
    this.writeToClipboard(shareUrl);
    this.dispatchEvent(new CustomEvent('toast', {
      detail: {
        message: this.labels.labelNotifcationLinkCopied,
        variant: 'info',
      },
      bubbles: true,
      composed: true,
    }));
  }

  writeToClipboard(value) {
    navigator.clipboard.writeText(value).catch((err) => {
      console.error('Error copying text to clipboard:', err);
    });
  }

  fireQueryEvent_Chapter(chapterId, callback) {
    const payload = { object: 'chapter', id: chapterId };
    this.dispatchEvent(
      new CustomEvent('query', {
        detail: { payload, callback },
        bubbles: true,
        composed: true,
      })
    );
  }

  checkCreatePermission() {
    const authData = sessionStorage.getItem('code_exchange_response');
    if (!authData) return false;
    try {
      const parsedData = JSON.parse(authData);
      return parsedData?.authenticationResult.access?.scopes?.includes('create') || false;
    } catch (e) {
      console.error('Failed to parse authenticationResult from sessionStorage:', e);
      return false;
    }
  }

  handleCreateParagraphClick = async () => {
    // Fire a 'create' event with chapterId and storyId, and a callback
    if (!this.chapterData) return;

    const chapterId = this.chapterData.id;
    const storyId = this.chapterData.storyid || null; // Assuming storyId is part of chapterData
    this.fireCreateEvent_Paragraph(chapterId, storyId);
  };

  // ======= Create Event ========

  fireCreateEvent_Paragraph(chapterId, storyId) {
    let eventDatail = {}
    eventDatail.object = 'paragraph';
    eventDatail.payload = {
      chapterId,
      storyId,
      name: '',
      content: '',
      htmlcontent: '<slds-card no-footer><span slot="header">Neuer Absatz</span></slds-card>',
    };
    eventDatail.callback = this.createEventCallback_Paragraph.bind(this);

    this.dispatchEvent(
      new CustomEvent('create', {
        detail: eventDatail,
        bubbles: true,
        composed: true,
      })
    );
  }

  createEventCallback_Paragraph(error, data) {
    if (error) {
      this.dispatchEvent(new CustomEvent('toast', {
        detail: { message: this.labels.labelParagraphCreateError, variant: 'error' },
        bubbles: true,
        composed: true,
      }));
      return;
    }
    if(data) {
      let newParagraph = data.result;
      // Add the new paragraph to the list
      if (newParagraph.id) {
        this.dispatchEvent(
          new CustomEvent('toast', {
            detail: { message: this.labels.labelParagraphCreated, variant: 'success' },
            bubbles: true,
            composed: true,
          })
        );
        this.paragraphsData = [...this.paragraphsData, newParagraph];
        this.pendingNewParagraphId = newParagraph.id;
        // Do not call requestUpdate here; wait for loaded event
      }
    }
  }
}

customElements.define('custom-chapter', CustomChapter);
