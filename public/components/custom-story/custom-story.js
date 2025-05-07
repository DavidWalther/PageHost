import { addGlobalStylesToShadowRoot } from "/modules/global-styles.mjs";

const templatePath = 'components/custom-story/custom-story.html';
let templatePromise = null;
let loadedMarkUp = null;

class CustomBook extends HTMLElement { 
    label = {
        labelNotifcationLinkCopied: 'Link kopiert'
    }

    isLoaded = false;

    // this is used to store changes to attributes before the component is fully loaded
    changesBeforeInit = [];

    // Add selectedChapter attribute
    selectedChapter = null;

    constructor() {
        super();
        const shadowRoot =  this.attachShadow({ mode: 'open' });
        addGlobalStylesToShadowRoot(this.shadowRoot); // add shared stylesheet
        this.changeChapter = this.changeChapter.bind(this);
    }

    // ------------------ react on attribut changes -  ------------------

    static get observedAttributes() {
        return [
            'story-id',
            'chapter-buttons_number-max'
        ];
    }

    attributeChangedCallback(name, oldValue, newValue) {
        console.log('attributeChangedCallback');
        console.log('isLoaded: ', this.isLoaded);

        if (!this.isLoaded) {
            this.changesBeforeInit.push({ name, oldValue, newValue });
            return;
        }

        this.handleAttributeChange(name, oldValue, newValue);
    }
    // ------------------ attribute getters ------------------

    get chapterButtonsNumberMax() {
        return this.getAttribute('chapter-buttons_number-max');
    }

    get storyId() {
        return this.getAttribute('story-id');
    }

    // ------------------ lifecycle methods ------------------

    async connectedCallback() {
        if (!loadedMarkUp) {
            loadedMarkUp = await this.loadHtmlMarkup();
        }

        // Append the main template
        const mainTemplateContent = loadedMarkUp.querySelector('#template-main').content;
        this.shadowRoot.appendChild(mainTemplateContent.cloneNode(true));
        
        this.changesBeforeInit.forEach(change => {
            this.handleAttributeChange(change.name, change.oldValue, change.newValue);
        });

        this.isLoaded = true; 
    }

    // ------------------ event listeners ------------------

    /**
     * @description changes the chapter displayed in the story
     * @param chapterId the id of the chapter to display
     */
    changeChapter(chapterId) {
        this.selectedChapter = chapterId;
        this.setButtonActivity();

        this.dispatchEvent(new CustomEvent('navigation', {
            detail: { type: 'chapter', value: chapterId },
            bubbles: true,
            composed: true
        }));
    }

    // ------------------ load html markup ------------------

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

    setBookdata(bookData) {
        // set text content of span with id 'span-chapter-title' to bookData.name
        const spanChapterTitle = this.shadowRoot.querySelector('#span-chapter-title');
        spanChapterTitle.textContent = bookData.name;
        // add share button
        const shareButton = this.createShareButton(bookData.id);
        shareButton.setAttribute('slot', 'actions');
        const cardElem = this.shadowRoot.querySelector('slds-card');
        // Remove any existing share button
        const existingShareButton = cardElem.querySelector('slds-button-icon');
        if (existingShareButton) {
            cardElem.removeChild(existingShareButton);
        }
        cardElem.appendChild(shareButton);
    }

    createChapterButtonsFromEvent(bookData) {
        let chapterListDiv = this.shadowRoot.querySelector('#chapter-list');
        // remove any existing children
        while (chapterListDiv.firstChild) {
            chapterListDiv.removeChild(chapterListDiv.firstChild);
        }
        
        // add the new buttons
        let chapterList = bookData.chapters;

        let maxNumber = this.chapterButtonsNumberMax;
        if(maxNumber && chapterList.length > maxNumber) {
            let comboboxElem = this.createCombobox(chapterList);
            chapterListDiv.appendChild(comboboxElem);
        } else {
            let chapterButtonsList = this.createChapterButtons(chapterList);
            chapterButtonsList.forEach(buttonContainer => {
                chapterListDiv.appendChild(buttonContainer);
            });
        }        
    }

    createCombobox(chapterList) {
        const mapChapterToComboboxEntry = (chapter) => {
            return {
                value: chapter.id,
                label: chapter.name,
                title: chapter.name
            }
        }  
        let values = chapterList.map(mapChapterToComboboxEntry);
        let comboboxElem = document.createElement('slds-combobox');
        comboboxElem.setAttribute('options', JSON.stringify(values));
        comboboxElem.setAttribute('label', 'Kapitel');
        comboboxElem.setAttribute('placeholder', 'Kapitel auswählen');
        comboboxElem.setAttribute('value', this.getInitialChapterId());
        comboboxElem.addEventListener('select', (event) => {
            const chapterId = event.detail.value;
            this.changeChapter(chapterId);
        });


        const chapterComboboxElem = document.createElement('div');
        chapterComboboxElem.classList.add('slds-col');
        chapterComboboxElem.classList.add('slds-size_1-of-1');
        chapterComboboxElem.classList.add('slds-grow-none');
        chapterComboboxElem.appendChild(comboboxElem);

        return chapterComboboxElem;
    }

    /**
     * @param chapterData data about the chapters to generate buttons for
     * @returns the list of chapter buttons set up ebent listeners
     */
    createChapterButtons(chapterData) {
        if(!chapterData) {return;}
        if(chapterData.length === 0) {return;}

        // create a list of buttons for each chapter
        const buttons = [];
        chapterData.forEach(chapter => {
            const chapterButtonElem = this.createChapterButton(chapter);
            buttons.push(chapterButtonElem);
        });

        /**
         * create a grid element for each button
         */
        const buttonContainers = [];
        buttons.forEach(button => {
            const chapterButtonListElem = document.createElement('div');
            chapterButtonListElem.classList.add('slds-col');
            chapterButtonListElem.classList.add('slds-grow-none');
            chapterButtonListElem.appendChild(button);
            buttonContainers.push(chapterButtonListElem);
        });
        return buttonContainers;
    }

    createChapterButton(chapterData) {
        const chapterButtonElem = document.createElement('button');
        chapterButtonElem.setAttribute('class', 'slds-button slds-button_neutral');
        chapterButtonElem.setAttribute('data-chapterId', chapterData.id);
        chapterButtonElem.textContent = chapterData.name;
        chapterButtonElem.addEventListener('click', (event) => {
            const chapterId = event.target.dataset.chapterid;
            this.changeChapter(chapterId);
        });
        return chapterButtonElem;
    }

    createShareButton(uri) {
        const shareButtonElem = document.createElement('slds-button-icon');
        shareButtonElem.setAttribute('icon', 'utility:link');
        shareButtonElem.setAttribute('variant', 'container-filled');
        shareButtonElem.addEventListener('click', () => {
            this.writeToClipboard(location.origin + '/' + uri);
        });
        shareButtonElem.addEventListener('click', () => {
            shareButtonElem.setAttribute('disabled', '');
           
            const toastContainer = document.createElement('div');
            toastContainer.style.width = '90%';
            toastContainer.style.textAlign = 'center';
            toastContainer.style.position = 'fixed';
            toastContainer.style.top = '10%';
            toastContainer.style.zIndex = '10';
            
            const toastElement = document.createElement('slds-toast');
            toastElement.setAttribute('state', 'info');
            toastElement.textContent = this.label.labelNotifcationLinkCopied;
            toastContainer.appendChild(toastElement);
            this.shadowRoot.appendChild(toastContainer);

            setTimeout(() => {
                toastContainer.parentNode.removeChild(toastContainer)
            }, 900);
            setTimeout(() => {
                shareButtonElem.removeAttribute('disabled');
            }, 2500);
        });
        return shareButtonElem;
    }

    // ------------------ Actions ------------------

    // Method to set button activity
    setButtonActivity() {
        const buttons = Array.from(this.shadowRoot.querySelectorAll('button'));
        buttons.forEach(button => {
            if (button.dataset.chapterid === this.selectedChapter) {
                button.disabled = true;
                button.classList.add('slds-button_brand');
            } else {
                button.disabled = false;
                button.classList.remove('slds-button_brand');
            }
        });
        return buttons;
    }

    writeToClipboard(value) {
        navigator.clipboard.writeText(value)
        .then(() => {
          console.log('Text copied to clipboard');
        })
        .catch(err => {
          console.error('Error copying text to clipboard:', err);
        });
    }
      
    // ------------------ helper functions ------------------

    getInitialChapterId() {
        let chapterId_coverId = this._bookData?.coverid;
        let chapterId_attribute = this.chapterId

        let chapterId = chapterId_attribute ?  chapterId_attribute: chapterId_coverId;
        return chapterId;
    }

    handleAttributeChange(name, oldValue, newValue) {
        console.log('CustomStory.handleAttributeChange --- START');
        console.table({ name, oldValue, newValue });

        if (oldValue === newValue) {
            return;
        }

        switch (name) {
            case 'story-id':
                this.clearStory();
                if (newValue) {
                    this.shadowRoot.querySelector('#content').classList.add('slds-hide');
                    this.shadowRoot.querySelector('slds-spinner').removeAttribute('hidden');
                    this.fireQueryEvent(newValue, this.storyChangeCallback.bind(this));
                } 
                break;
            default:
                break;
        }
        console.log('CustomStory.handleAttributeChange --- END');
    }

    //------------------- query event ----------------------

    storyChangeCallback(error, data) {
        this.shadowRoot.querySelector('slds-spinner').setAttribute('hidden', '');
        if(data) {
            this._bookData = data;
            this.setBookdata(data);
            this.createChapterButtonsFromEvent(data);
            let initialChapter = this.getInitialChapterId();
            this.shadowRoot.querySelector('#content').classList.remove('slds-hide');
            if(initialChapter) {
                this.changeChapter(initialChapter);
            }
        }
        if(error) {
            console.error(error);
        }
    }

    fireQueryEvent(storyId, callback) {
        let payload = {
            object: 'story',
            id: storyId
        }

        this.dispatchEvent(new CustomEvent('query', {
            detail: { payload, callback },
            bubbles: true,
            composed: true
        }));
    }

    clearStory() {
        const spanChapterTitle = this.shadowRoot.querySelector('#span-chapter-title');
        spanChapterTitle.textContent = '';
        const chapterListDiv = this.shadowRoot.querySelector('#chapter-list');
        while (chapterListDiv.firstChild) {
            chapterListDiv.firstChild.removeEventListener('click', this.changeChapter);
            chapterListDiv.removeChild(chapterListDiv.firstChild);
        }
    }
}

customElements.define('custom-story', CustomBook);
