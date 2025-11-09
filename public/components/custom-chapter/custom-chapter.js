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
    loadingChunkSize: { type: Number, attribute: 'loading-chunk-size' },
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
      (paragraph, index) => {
        // First chunk loads immediately, others get no-load attribute
        const shouldLazyLoad = !this.isItemInFirstChunk(index);
        
        return html`
          <div class="slds-col slds-p-bottom_small paragraph-container pending"
               data-paragraph-id=${paragraph.id}
               data-chunk-index=${this.getChunkIndex(index)}>
            <custom-paragraph
              id=${paragraph.id}
              data-name=${paragraph.name || ''}
              ?no-load=${shouldLazyLoad}
            ></custom-paragraph>
          </div>
        `;
      }
    );
  }

  constructor() {
    super();
    this.id = null;
    this.chapterData = null;
    this.paragraphsData = [];
    this.loading = false;
    this.loadingChunkSize = 10; // Default chunk size
    this.pendingNewParagraphId = null; // Track the id of a paragraph being created
    this.intersectionObserver = null; // Intersection Observer for chunk-based lazy loading
    this.currentObservedChunkIndex = 1; // Track which chunk we're currently observing
    this.observedElements = new Map(); // Track observed elements
  }

  // ==================================================
  // Lifecycle Methods
  // ==================================================

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

  // ==================================================
  // Chunk Calculation Helper Methods
  // ==================================================

  getChunkIndex(itemIndex) {
    return Math.floor(itemIndex / this.loadingChunkSize);
  }

  getChunkStartIndex(chunkIndex) {
    return chunkIndex * this.loadingChunkSize;
  }

  getChunkEndIndex(chunkIndex) {
    const calculatedEnd = (chunkIndex + 1) * this.loadingChunkSize - 1;
    const actualEnd = Math.min(calculatedEnd, this.paragraphsData.length - 1);
    return actualEnd;
  }

  isItemInFirstChunk(itemIndex) {
    return this.getChunkIndex(itemIndex) === 0;
  }

  // ==================================================
  // Intersection Observer and Lazy Loading
  // ==================================================

  /**
   * Identifies the next element that should be observed for intersection
   * @param {number} nextChunkIndex - The index of the next chunk to observe
   * @returns {Element|null} The DOM element to observe, or null if no more chunks
   */
  identifyNextObserverTarget(nextChunkIndex) {
    // Check if next chunk exists
    if (nextChunkIndex >= Math.ceil(this.paragraphsData.length / this.loadingChunkSize)) {
      console.log(`No more chunks to observe (requested chunk ${nextChunkIndex})`);
      return null;
    }

    // Instead of observing the end of the next chunk, observe an element 
    // that's earlier to trigger loading before user reaches the end
    // We'll observe an element in the current loaded chunk at about 75% through
    const currentChunkIndex = nextChunkIndex - 1;
    const currentChunkStart = this.getChunkStartIndex(currentChunkIndex);
    const currentChunkEnd = this.getChunkEndIndex(currentChunkIndex);
    
    // Find trigger point at 75% through current chunk
    const chunkSize = currentChunkEnd - currentChunkStart + 1;
    const triggerOffset = Math.floor(chunkSize * 0.75);
    const triggerIndex = currentChunkStart + triggerOffset;
    
    console.log(`Identifying observer target for chunk ${nextChunkIndex} (trigger at 75% of current chunk ${currentChunkIndex}, paragraph ${triggerIndex})`);

    const paragraphContainers = this.shadowRoot.querySelectorAll('.paragraph-container');
    const targetContainer = paragraphContainers[triggerIndex];
    
    if (!targetContainer) {
      console.error(`Could not find container for trigger at index ${triggerIndex}`);
      // Fallback to end of current chunk if 75% point doesn't exist
      const fallbackContainer = paragraphContainers[currentChunkEnd];
      if (fallbackContainer) {
        console.log(`Using fallback target at end of chunk ${currentChunkIndex} (paragraph ${currentChunkEnd})`);
        return fallbackContainer;
      }
      return null;
    }

    return targetContainer;
  }

  /**
   * Collects all paragraph elements in the specified chunk that need to be loaded
   * @param {number} chunkIndex - The index of the chunk to collect paragraphs from
   * @returns {Array} Array of objects containing container and paragraph elements to load
   */
  collectParagraphsToLoad(chunkIndex) {
    const startIndex = this.getChunkStartIndex(chunkIndex);
    const endIndex = this.getChunkEndIndex(chunkIndex);
    
    console.log(`Collecting paragraphs for chunk ${chunkIndex}: paragraphs ${startIndex} to ${endIndex}`);

    const paragraphContainers = Array.from(this.shadowRoot.querySelectorAll('.paragraph-container'));
    const elementsToLoad = [];
    
    console.log(`Total containers found: ${paragraphContainers.length}`);

    // Filter containers to only those in the specified chunk range
    let filteredParagraphContainers = paragraphContainers.filter((container, index) => {
      return index >= startIndex && index <= endIndex;
    });
    if (filteredParagraphContainers.length === 0) {
      console.log(`No containers found in chunk ${chunkIndex}`);
      return elementsToLoad;
    }

    // Further filter to only those that still have no-load attribute
    filteredParagraphContainers = filteredParagraphContainers.filter((container, i) => {
      const paragraphElement = container.querySelector('custom-paragraph');
      return paragraphElement && paragraphElement.hasAttribute('no-load');
    });

    if (filteredParagraphContainers.length === 0) {
      console.log(`No paragraphs with no-load found in chunk ${chunkIndex}`);
      return elementsToLoad;
    }

    // Map filtered containers to elements to load
    filteredParagraphContainers.forEach((container, i) => {
      const paragraphElement = container.querySelector('custom-paragraph');
      elementsToLoad.push({
        container: container,
        paragraph: paragraphElement,
        index: i
      });
    });

    console.log(`Collected ${elementsToLoad.length} paragraphs to load for chunk ${chunkIndex}`);
    return elementsToLoad;
  }

  /**
   * Unobserves the current intersection target element and cleans up tracking
   * @param {Element} observedElement - The element that triggered the intersection
   * @returns {void}
   */
  unobserveCurrentElement(observedElement) {
    if (this.intersectionObserver && observedElement) {
      this.intersectionObserver.unobserve(observedElement);
      this.observedElements.delete(observedElement);
      console.log('Unobserved element:', observedElement);
    }
  }

  /**
   * Removes no-load attributes from paragraph elements to trigger their loading
   * @param {Array} elementsToLoad - Array of objects containing container and paragraph elements
   * @returns {void}
   */
  removeParagraphNoLoadAttributes(elementsToLoad) {
    elementsToLoad.forEach(({ paragraph, index }) => {
      if (paragraph && paragraph.hasAttribute('no-load')) {
        console.log(`Removing no-load from paragraph ${index}: ${paragraph.id}`);
        paragraph.removeAttribute('no-load');
      }
    });
  }

  /**
   * Updates container CSS classes to reflect the current loading state
   * @param {Array} elementsToLoad - Array of objects containing container and paragraph elements
   * @returns {void}
   */
  updateContainerClasses(elementsToLoad) {
    elementsToLoad.forEach(({ container }) => {
      if (container) {
        // Mark container as loading
        container.classList.add('loading');
        container.classList.remove('pending');
        
        // Mark as loaded after delay
        setTimeout(() => {
          container.classList.remove('loading');
          container.classList.add('loaded');
        }, 100);
      }
    });
  }

  setupParagraphObserving() {
    // Clean up any existing observations first
    this.cleanupIntersectionObserver();
    this.initializeIntersectionObserver();

    // Reset to observe chunk 1 (chunk 0 loads immediately)
    this.currentObservedChunkIndex = 1;

    // Use multiple animation frames to ensure DOM is fully rendered
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const paragraphContainers = this.shadowRoot.querySelectorAll('.paragraph-container');
        console.log(`Found ${paragraphContainers.length} paragraph containers`);
        console.log(`Chunk size: ${this.loadingChunkSize}`);

        // Check if we have more than one chunk
        if (this.paragraphsData.length <= this.loadingChunkSize) {
          console.log(`All paragraphs fit in first chunk, no observer needed`);
          return;
        }

        // Set up observer for chunk 1 endpoint (second chunk)
        const initialObserverTarget = this.identifyNextObserverTarget(1);
        if (initialObserverTarget) {
          this.observeElement(initialObserverTarget);
          this.currentObservedChunkIndex = 1;
        }

        // remove 'pending' class of the first chunk immediately
        paragraphContainers.forEach((container, index) => {
          if (this.isItemInFirstChunk(index)) {
            container.classList.remove('pending');
            container.classList.add('loaded');
          };
        });
      });
    });
  }

  initializeIntersectionObserver() {
    // Create single intersection observer for chunk-based lazy loading
    this.intersectionObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            console.log(`Chunk trigger is intersecting:`, entry.target, `ratio: ${entry.intersectionRatio}`);
            this.executeChunkLoading(entry.target);
          }
        });
      },
      {
        root: null, // Use viewport as root
        rootMargin: '200px', // Even more aggressive preloading for better UX
        threshold: 0, // Any intersection triggers loading
      }
    );
  }

  executeChunkLoading(observedElement) {
    const triggerChunkIndex = parseInt(observedElement.dataset.chunkIndex);
    const chunkToLoad = triggerChunkIndex + 1; // Load the NEXT chunk when trigger element is intersecting
    console.log(`Trigger element from chunk ${triggerChunkIndex} intersecting - loading chunk ${chunkToLoad}`);

    // 1. Identify the next element that should be observed
    const nextObserverTarget = this.identifyNextObserverTarget(chunkToLoad + 1);
    
    // 2. Collect all paragraph elements that need to be loaded in the target chunk
    const elementsToLoad = this.collectParagraphsToLoad(chunkToLoad);
    
    // 3. Unobserve the current element and clean up tracking
    this.unobserveCurrentElement(observedElement);
    
    // 4. Remove no-load attributes from collected paragraphs to trigger loading
    this.removeParagraphNoLoadAttributes(elementsToLoad);
    
    // 5. Update container classes to reflect loading state
    this.updateContainerClasses(elementsToLoad);

    // Set up observer for next chunk if target was found
    if (nextObserverTarget) {
      // Use requestAnimationFrame to ensure DOM is ready for next observation
      requestAnimationFrame(() => {
        this.observeElement(nextObserverTarget);
        this.currentObservedChunkIndex = chunkToLoad + 1;
      });
    }
  }

  cleanupIntersectionObserver() {
    if (this.intersectionObserver) {
      this.intersectionObserver.disconnect();
      this.intersectionObserver = null;
    }
    this.observedElements.clear();
  }

  observeElement(element) {
    if (this.intersectionObserver && element) {
      this.intersectionObserver.observe(element);
      this.observedElements.set(element, 'chunk-endpoint');
    }
  }

  // ==================================================
  // Event Handlers
  // ==================================================

  _onParagraphLoaded = (event) => {
    // - Only handle if we are waiting for a new paragraph
    // - This also ensures the component will new proccess the event it has fired itself
    if (this.pendingNewParagraphId && event.target.id === this.pendingNewParagraphId) {
      this.requestUpdate();
      this.pendingNewParagraphId = null;
    }
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
  // ==================================================
  // Actions
  // ==================================================

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

  writeToClipboard(value) {
    navigator.clipboard.writeText(value).catch((err) => {
      console.error('Error copying text to clipboard:', err);
    });
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

  // ==================================================
  // Query Events
  // ==================================================

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

  handleCreateParagraphClick = async () => {
    // Fire a 'create' event with chapterId and storyId, and a callback
    if (!this.chapterData) return;

    const chapterId = this.chapterData.id;
    const storyId = this.chapterData.storyid || null; // Assuming storyId is part of chapterData
    this.fireCreateEvent_Paragraph(chapterId, storyId);
  };
}

customElements.define('custom-chapter', CustomChapter);
