import {
  LitElement,
  html,
  css,
} from 'https://cdn.jsdelivr.net/gh/lit/dist@3/core/lit-core.min.js';
import { addGlobalStylesToShadowRoot } from '/modules/global-styles.mjs';
import '/components/custom-chapter-edit/custom-chapter-edit.js';
import { deleteChapter } from '/components/custom-chapter/delete-chapter.api.js';
import '/slds-components/slds-progress-bar/slds-progress-bar.js';

class CustomChapter extends LitElement {
  labels = {
    labelCreateParagraph: 'Absatz erstellen',
    labelShareChapter: 'Kapitel teilen',
    labelNotifcationLinkCopied: 'Link kopiert',
    labelParagraphCreated: 'Absatzt erstellt',
    labelParagraphCreateError: 'Fehler beim Erstellen des Absatzes',
    labelNoParagraphs: 'Keine Absätze vorhanden',
    labelDeleteChapter: 'Kapitel löschen',
    labelChapterDeleted: 'Kapitel gelöscht',
    labelChapterDeleteError: 'Fehler beim Löschen des Kapitels',
    labelChapterDeleteConfirm: 'Dieses Kapitel wirklich löschen?',
  };

  static properties = {
    id: { type: String },
    chapterData: { type: Object },
    paragraphsData: { type: Array },
    loading: { type: Boolean },
    loadingChunkSize: { type: Number, attribute: 'loading-chunk-size' },
    paragraphnumber: { type: Number },
    _scrollPending: { type: Boolean, state: true },
    _pendingTotalCount: { type: Number, state: true },
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

  get loadingProgress() {
    if (this._pendingTotalCount === 0) return 0;
    return Math.round(
      ((this._pendingTotalCount - this._pendingDisplaySet.size) /
        this._pendingTotalCount) *
        100
    );
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
      ${this._scrollPending
        ? html`<slds-progress-bar
            percent=${this.loadingProgress}
            circular
          ></slds-progress-bar>`
        : ''}
      <slds-card no-footer ?hidden=${this._scrollPending}>
        <span slot="header">${this.chapterData.name}</span>
        <div slot="actions" class="slds-grid slds-wrap slds-gutters_xxx-small">
          <div class="slds-col slds-grow-none slds-align_absolute-center">
            <custom-chapter-edit
              chapter-id="${this.id}"
              story-id="${this.chapterData?.storyid || ''}"
              name="${this.chapterData?.name || ''}"
              sort-number="${this.chapterData?.sortnumber || 1}"
              ?reversed="${this.chapterData?.reversed || false}"
              publish-date="${this.chapterData?.publishdate || ''}"
              @chapter-updated=${this._handleChapterUpdated}
            ></custom-chapter-edit>
          </div>
          <div class="slds-col slds-grow-none slds-align_absolute-center">
            <slds-button-icon
              icon="utility:link"
              variant="container-filled"
              @click=${this.handleShareClick}
            ></slds-button-icon>
          </div>
          <div class="slds-col slds-grow-none slds-align_absolute-center">
            ${canCreate
              ? html` <slds-button-icon
                  icon="utility:add"
                  variant="container-filled"
                  @click=${this.handleCreateParagraphClick}
                ></slds-button-icon>`
              : ''}
          </div>
          <div class="slds-col slds-grow-none slds-align_absolute-center">
            ${this.checkDeletePermission()
              ? html` <slds-button-icon
                  icon="utility:delete"
                  variant="container-filled"
                  title="${this.labels.labelDeleteChapter}"
                  @click=${this._handleDeleteClick}
                ></slds-button-icon>`
              : ''}
          </div>
        </div>
        <div id="chapter-content">${this.renderParagraphs()}</div>
      </slds-card>
    `;
  }

  renderParagraphs() {
    if (!this.paragraphsData || this.paragraphsData.length === 0) {
      return html`<p>${this.labels.labelNoParagraphs}</p>`;
    }
    const paragraphs = this.chapterData?.reversed
      ? [...this.paragraphsData].reverse()
      : this.paragraphsData;

    // Find target paragraph index for no-display and lazy-load logic
    let targetParagraphIndex = -1;
    if (this.paragraphnumber) {
      targetParagraphIndex = paragraphs.findIndex(
        (p) => p.sortnumber == this.paragraphnumber
      );
    }

    // Without a target paragraph, only the first chunk loads immediately
    const immediateLoadUpToChunk =
      targetParagraphIndex === -1 ? this.getImmediateLoadChunkBoundary() : null;

    return paragraphs.map((paragraph, index) => {
      const chunkIndex = this.getChunkIndex(index);
      // When scrolling to a target: load all paragraphs up to and including the target directly,
      // lazy-load everything after. Without a target: use the standard chunk boundary.
      const shouldLazyLoad =
        targetParagraphIndex !== -1
          ? index > targetParagraphIndex
          : chunkIndex > immediateLoadUpToChunk;
      // Hide paragraphs before the target when scrolling to a specific paragraph
      const shouldHide =
        targetParagraphIndex > 0 && index < targetParagraphIndex;

      return html`
        <div
          class="slds-col slds-p-bottom_small paragraph-container pending"
          data-paragraph-id=${paragraph.id}
          data-chunk-index=${chunkIndex}
        >
          <custom-paragraph
            id=${paragraph.id}
            data-name=${paragraph.name || ''}
            data-sort-number=${paragraph.sortnumber || ''}
            ?no-load=${shouldLazyLoad}
            ?no-display=${shouldHide}
          ></custom-paragraph>
        </div>
      `;
    });
  }

  /**
   * Determines up to which chunk index paragraphs should load immediately (not lazy).
   * If paragraphnumber is set, returns the chunk containing the target paragraph.
   * Otherwise returns 0 (only the first chunk loads immediately).
   * @returns {number} The highest chunk index that should load immediately
   */
  getImmediateLoadChunkBoundary() {
    if (!this.paragraphnumber) return 0;

    const paragraphs = this.chapterData?.reversed
      ? [...this.paragraphsData].reverse()
      : this.paragraphsData;

    const targetIndex = paragraphs.findIndex(
      (p) => p.sortnumber == this.paragraphnumber
    );

    if (targetIndex === -1) {
      console.warn(
        `paragraphnumber ${this.paragraphnumber} not found in paragraphsData`
      );
      return 0;
    }

    return this.getChunkIndex(targetIndex);
  }

  constructor() {
    super();
    this.id = null;
    this.chapterData = null;
    this.paragraphsData = [];
    this.loading = false;
    this.loadingChunkSize = 10; // Default chunk size
    this.paragraphnumber = null; // Target paragraph sort number for scroll-to
    this.pendingNewParagraphId = null; // Track the id of a paragraph being created
    this.intersectionObserver = null; // Intersection Observer for chunk-based lazy loading
    this.currentObservedChunkIndex = 1; // Track which chunk we're currently observing
    this.observedElements = new Map(); // Track observed elements
    this._pendingDisplaySet = new Set(); // IDs of paragraphs waiting to load before reveal
    this._scrollPending = false; // True while waiting for paragraphs to load before scroll
    this._pendingTotalCount = 0; // Total count of paragraphs to load before scroll
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
    if (
      (changedProperties.has('paragraphsData') ||
        changedProperties.has('chapterData')) &&
      !this.loading &&
      this.paragraphsData.length > 0
    ) {
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
    if (
      nextChunkIndex >=
      Math.ceil(this.paragraphsData.length / this.loadingChunkSize)
    ) {
      console.log(
        `No more chunks to observe (requested chunk ${nextChunkIndex})`
      );
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

    console.log(
      `Identifying observer target for chunk ${nextChunkIndex} (trigger at 75% of current chunk ${currentChunkIndex}, paragraph ${triggerIndex})`
    );

    const paragraphContainers = this.shadowRoot.querySelectorAll(
      '.paragraph-container'
    );
    const targetContainer = paragraphContainers[triggerIndex];

    if (!targetContainer) {
      console.error(
        `Could not find container for trigger at index ${triggerIndex}`
      );
      // Fallback to end of current chunk if 75% point doesn't exist
      const fallbackContainer = paragraphContainers[currentChunkEnd];
      if (fallbackContainer) {
        console.log(
          `Using fallback target at end of chunk ${currentChunkIndex} (paragraph ${currentChunkEnd})`
        );
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

    console.log(
      `Collecting paragraphs for chunk ${chunkIndex}: paragraphs ${startIndex} to ${endIndex}`
    );

    const paragraphContainers = Array.from(
      this.shadowRoot.querySelectorAll('.paragraph-container')
    );
    const elementsToLoad = [];

    console.log(`Total containers found: ${paragraphContainers.length}`);

    // Filter containers to only those in the specified chunk range
    let filteredParagraphContainers = paragraphContainers.filter(
      (container, index) => {
        return index >= startIndex && index <= endIndex;
      }
    );
    if (filteredParagraphContainers.length === 0) {
      console.log(`No containers found in chunk ${chunkIndex}`);
      return elementsToLoad;
    }

    // Further filter to only those that still have no-load attribute
    filteredParagraphContainers = filteredParagraphContainers.filter(
      (container, i) => {
        const paragraphElement = container.querySelector('custom-paragraph');
        return paragraphElement && paragraphElement.hasAttribute('no-load');
      }
    );

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
        index: i,
      });
    });

    console.log(
      `Collected ${elementsToLoad.length} paragraphs to load for chunk ${chunkIndex}`
    );
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
        console.log(
          `Removing no-load from paragraph ${index}: ${paragraph.id}`
        );
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

    // Determine which chunks are immediately loaded
    const immediateLoadUpToChunk = this.getImmediateLoadChunkBoundary();
    const firstLazyChunk = immediateLoadUpToChunk + 1;

    // Reset to observe the first lazy chunk
    this.currentObservedChunkIndex = firstLazyChunk;

    // Use multiple animation frames to ensure DOM is fully rendered
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const paragraphContainers = this.shadowRoot.querySelectorAll(
          '.paragraph-container'
        );
        console.log(`Found ${paragraphContainers.length} paragraph containers`);
        console.log(`Chunk size: ${this.loadingChunkSize}`);
        console.log(`Immediate load up to chunk: ${immediateLoadUpToChunk}`);

        const totalChunks = Math.ceil(
          this.paragraphsData.length / this.loadingChunkSize
        );

        // Check if all chunks are already loaded immediately
        if (firstLazyChunk >= totalChunks) {
          console.log(`All paragraphs load immediately, no observer needed`);
          // Mark all containers as loaded
          paragraphContainers.forEach((container) => {
            container.classList.remove('pending');
            container.classList.add('loaded');
          });
          return;
        }

        // Set up observer for the first lazy chunk
        const initialObserverTarget =
          this.identifyNextObserverTarget(firstLazyChunk);
        if (initialObserverTarget) {
          this.observeElement(initialObserverTarget);
          this.currentObservedChunkIndex = firstLazyChunk;
        }

        // Remove 'pending' class of all immediately loaded chunks
        paragraphContainers.forEach((container, index) => {
          const chunkIndex = this.getChunkIndex(index);
          if (chunkIndex <= immediateLoadUpToChunk) {
            container.classList.remove('pending');
            container.classList.add('loaded');
          }
        });

        // Start tracking loaded paragraphs for scroll-to if paragraphnumber is set
        if (this.paragraphnumber) {
          this.waitForParagraphAndScroll();
        }
      });
    });
  }

  initializeIntersectionObserver() {
    // Create single intersection observer for chunk-based lazy loading
    this.intersectionObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            console.log(
              `Chunk trigger is intersecting:`,
              entry.target,
              `ratio: ${entry.intersectionRatio}`
            );
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
    console.log(
      `Trigger element from chunk ${triggerChunkIndex} intersecting - loading chunk ${chunkToLoad}`
    );

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
  // Scroll-to-Paragraph
  // ==================================================

  /**
   * Sets up tracking to wait for all paragraphs before the scroll target to be loaded.
   * Builds a Set of paragraph IDs that must load before the chapter is revealed.
   */
  waitForParagraphAndScroll() {
    // Tracking is already set up via _buildPendingDisplaySet in fetchAndDisplayChapter
    console.log(
      `waitForParagraphAndScroll: ${this._pendingDisplaySet.size} paragraphs pending before scroll to paragraphnumber ${this.paragraphnumber}`
    );
  }

  /**
   * Builds the set of paragraph IDs that need to finish loading before the chapter is revealed.
   * These are all paragraphs before the target paragraph (the ones with no-display).
   * @param {Array} rawParagraphs - The raw paragraphs array from the server
   */
  _buildPendingDisplaySet(rawParagraphs) {
    const paragraphs = this.chapterData?.reversed
      ? [...rawParagraphs].reverse()
      : rawParagraphs;

    const targetIndex = paragraphs.findIndex(
      (p) => p.sortnumber == this.paragraphnumber
    );

    if (targetIndex <= 0) {
      // Target is the first paragraph or not found — nothing to hide, just show immediately
      this._scrollPending = false;
      return;
    }

    this._scrollPending = true;
    this._pendingDisplaySet = new Set();
    for (let i = 0; i < targetIndex; i++) {
      this._pendingDisplaySet.add(paragraphs[i].id);
    }
    this._pendingTotalCount = this._pendingDisplaySet.size;

    console.log(
      `Built pending display set with ${this._pendingDisplaySet.size} paragraph IDs`
    );
  }

  /**
   * Called when all pending paragraphs have loaded.
   * Reveals all hidden paragraphs, stops the spinner, scrolls to target, and resets state.
   */
  _revealAndScroll() {
    const targetNumber = this.paragraphnumber;
    console.log(
      `All pending paragraphs loaded. Revealing and scrolling to paragraphnumber ${targetNumber}`
    );

    // 1. Stop the spinner
    this._scrollPending = false;

    // 2. Wait for render, then remove no-display and scroll
    this.updateComplete.then(() => {
      // Remove no-display from all paragraphs
      const paragraphs = this.shadowRoot.querySelectorAll(
        'custom-paragraph[no-display]'
      );
      paragraphs.forEach((p) => p.removeAttribute('no-display'));

      // Scroll to target paragraph
      requestAnimationFrame(() => {
        this.scrollToParagraph({ paragraphSortNumber: targetNumber });
        // Reset paragraphnumber so it doesn't trigger again on re-render
        this.paragraphnumber = null;
      });
    });
  }

  // ==================================================
  // Event Handlers
  // ==================================================

  _onParagraphLoaded = (event) => {
    // - Only handle if we are waiting for a new paragraph
    // - This also ensures the component will not process the event it has fired itself
    if (
      this.pendingNewParagraphId &&
      event.target.id === this.pendingNewParagraphId
    ) {
      this.requestUpdate();
      this.pendingNewParagraphId = null;
    }

    // Track loaded paragraphs for scroll-to-paragraph feature
    if (this._pendingDisplaySet.size > 0) {
      const paragraphId = event.detail.paragraphData.id;
      if (this._pendingDisplaySet.has(paragraphId)) {
        this._pendingDisplaySet.delete(paragraphId);
        console.log(
          `Pending display: removed ${paragraphId}, ${this._pendingDisplaySet.size} remaining`
        );
      }
      this.requestUpdate();
      if (this._pendingDisplaySet.size === 0) {
        this._revealAndScroll();
      }
    }
  };

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
    this.dispatchEvent(
      new CustomEvent('toast', {
        detail: {
          message: this.labels.labelNotifcationLinkCopied,
          variant: 'info',
        },
        bubbles: true,
        composed: true,
      })
    );
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

      let paragraphsFound =
        data.paragraphs.length > 0 && !!data.paragraphs[0].id;

      this.paragraphsData = paragraphsFound ? data.paragraphs : [];

      // If paragraphnumber is set, build pending display set (spinner via _scrollPending)
      if (this.paragraphnumber && paragraphsFound) {
        this._buildPendingDisplaySet(data.paragraphs);
      }
      this.loading = false;
    });
  }

  clearContent() {
    // Clean up any existing observations
    this.cleanupIntersectionObserver();
    this.chapterData = null;
    this.paragraphsData = [];
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
      return (
        parsedData?.authenticationResult.access?.scopes?.includes('create') ||
        false
      );
    } catch (e) {
      console.error(
        'Failed to parse authenticationResult from sessionStorage:',
        e
      );
      return false;
    }
  }

  checkDeletePermission() {
    const authData = sessionStorage.getItem('code_exchange_response');
    if (!authData) return false;
    try {
      const parsedData = JSON.parse(authData);
      return (
        parsedData?.authenticationResult.access?.scopes?.includes('delete') ||
        false
      );
    } catch (e) {
      return false;
    }
  }

  async _handleDeleteClick() {
    if (!confirm(this.labels.labelChapterDeleteConfirm)) return;
    const authData = sessionStorage.getItem('code_exchange_response');
    let token = '';
    if (authData) {
      try {
        token =
          JSON.parse(authData)?.authenticationResult?.access?.access_token;
      } catch {}
    }
    if (!token) {
      this.dispatchEvent(
        new CustomEvent('toast', {
          detail: { message: 'Nicht eingeloggt', variant: 'error' },
          bubbles: true,
          composed: true,
        })
      );
      return;
    }
    try {
      await deleteChapter({ id: this.id, token });
      this.dispatchEvent(
        new CustomEvent('toast', {
          detail: {
            message: this.labels.labelChapterDeleted,
            variant: 'success',
          },
          bubbles: true,
          composed: true,
        })
      );
      this.dispatchEvent(
        new CustomEvent('chapter-deleted', {
          detail: { chapterId: this.id },
          bubbles: true,
          composed: true,
        })
      );
      this.clearContent();
    } catch (e) {
      this.dispatchEvent(
        new CustomEvent('toast', {
          detail: {
            message: e.message || this.labels.labelChapterDeleteError,
            variant: 'error',
          },
          bubbles: true,
          composed: true,
        })
      );
    }
  }

  handleScrollDownClick() {
    console.log('Scroll down clicked');
    this.scrollToParagraph({ paragraphId: '000p00000000000315' });
  }

  // ======== Actions ================

  scrollToParagraph(scrollParameters) {
    const { paragraphId, paragraphSortNumber } = scrollParameters;

    const paragraphContentElement =
      this.shadowRoot.getElementById('chapter-content');
    if (!paragraphContentElement) return;

    if (paragraphSortNumber) {
      console.log(
        'Scrolling to paragraph with sort number:',
        paragraphSortNumber
      );
      let paragraph = Array.from(
        paragraphContentElement.querySelectorAll('custom-paragraph')
      ).find((elem) => elem.dataset.sortNumber == paragraphSortNumber);
      if (paragraph) {
        paragraph.scrollIntoView({ behavior: 'smooth' });
      }
      return;
    }

    if (paragraphId) {
      console.log('Scrolling to paragraph with ID:', paragraphId);
      let paragraph = Array.from(
        paragraphContentElement.querySelectorAll('custom-paragraph')
      ).find((elem) => elem.id == paragraphId);
      if (paragraph) {
        paragraph.scrollIntoView({ behavior: 'smooth' });
      }
      return;
    }
  }

  // ======= Create Event ========

  fireCreateEvent_Paragraph(chapterId, storyId) {
    let eventDatail = {};
    eventDatail.object = 'paragraph';
    eventDatail.payload = {
      chapterId,
      storyId,
      name: '',
      content: '',
      htmlcontent:
        '<slds-card no-footer><span slot="header">Neuer Absatz</span></slds-card>',
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
      this.dispatchEvent(
        new CustomEvent('toast', {
          detail: {
            message: this.labels.labelParagraphCreateError,
            variant: 'error',
          },
          bubbles: true,
          composed: true,
        })
      );
      return;
    }
    if (data) {
      let newParagraph = data.result;
      // Add the new paragraph to the list
      if (newParagraph.id) {
        this.dispatchEvent(
          new CustomEvent('toast', {
            detail: {
              message: this.labels.labelParagraphCreated,
              variant: 'success',
            },
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

  _handleChapterUpdated(event) {
    const updatedChapter = event.detail?.chapterData;
    if (updatedChapter) {
      this.chapterData = { ...this.chapterData, ...updatedChapter };
      this.requestUpdate();
    }
  }
}

customElements.define('custom-chapter', CustomChapter);
