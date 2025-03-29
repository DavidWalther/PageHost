const { CustomChapter } = require('../custom-chapter.js');

/**
 * 
 * entire file (including creation of file) was created by Copilot.
 * Prompt:
 * 
 * create tests for the custom-chapter component. Create a Mock for chapter endpoint and paragraph endpoint.
*
* Testcases:
* - test refresh of chapter markup
* - Test new request on change of id
* 
*/

// public/components/chapter/chapter.test.js


// Mock the fetch function
global.fetch = jest.fn((url) => {
  switch (url) {
    case '/chapter':
      return Promise.resolve({
        json: () => Promise.resolve(mockChapterResponse),
      });
    case '/paragraph':
      return Promise.resolve({
        json: () => Promise.resolve(mockParagraphResponse),
      });
    default:
      return Promise.reject(new Error('Unknown URL'));
  }
});


// Mock the chapter endpoint response
const mockChapterResponse = [
  {
    id: 'chapter1',
    name: 'Chapter 1',
  }
];

// Mock the paragraph endpoint response
const mockParagraphResponse = [
  {
    id: 'paragraph1',
    content: 'Paragraph 1',
    htmlcontent: '<p>Paragraph 1</p>',
  },
  {
    id: 'paragraph2',
    content: 'Paragraph 2',
    htmlcontent: '<p>Paragraph 2</p>',
  },
];

describe('CustomChapter', () => {
  let customChapter;

  beforeEach(() => {
    customChapter = new CustomChapter();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('attributeChangedCallback', () => {
    it('should fetch and display chapter when id attribute changes', async () => {
      // Mock the fetchChapterData and fetchParagraphData functions
      customChapter.fetchChapterData = jest.fn().mockResolvedValue(mockChapterResponse);
      customChapter.fetchParagraphData = jest.fn().mockResolvedValue(mockParagraphResponse);

      // Set the initial id attribute
      customChapter.setAttribute('id', 'chapter1');

      // Call the attributeChangedCallback with the new id attribute
      customChapter.attributeChangedCallback('id', 'chapter1', 'chapter2');

      // Wait for the fetch and display chapter to complete
      await new Promise((resolve) => setTimeout(resolve, 0));

      // Expect the fetchChapterData and fetchParagraphData functions to be called with the new chapter id
      expect(customChapter.fetchChapterData).toHaveBeenCalledWith('chapter2');
      expect(customChapter.fetchParagraphData).toHaveBeenCalledWith('chapter2');
    });
  });

  describe('fetchAndDisplayChapter', () => {
    it('should fetch and display chapter', async () => {
      // Mock the fetchChapterData and fetchParagraphData functions
      customChapter.fetchChapterData = jest.fn().mockResolvedValue(mockChapterResponse);
      customChapter.fetchParagraphData = jest.fn().mockResolvedValue(mockParagraphResponse);

      // Call the fetchAndDisplayChapter function with a chapter id
      await customChapter.fetchAndDisplayChapter('chapter1');

      // Expect the fetchChapterData and fetchParagraphData functions to be called with the chapter id
      expect(customChapter.fetchChapterData).toHaveBeenCalledWith('chapter1');
      expect(customChapter.fetchParagraphData).toHaveBeenCalledWith('chapter1');

      // Expect the chapter and paragraphs to be displayed
      expect(customChapter.shadowRoot.querySelector('#template-main')).toBeTruthy();
      expect(customChapter.shadowRoot.querySelector('slds-card')).toBeTruthy();
      expect(customChapter.shadowRoot.querySelectorAll('custom-paragraph')).toHaveLength(2);
    });

    it('should handle error when fetching data', async () => {
      // Mock the fetchChapterData and fetchParagraphData functions to throw an error
      customChapter.fetchChapterData = jest.fn().mockRejectedValue(new Error('Failed to fetch chapter data'));
      customChapter.fetchParagraphData = jest.fn().mockRejectedValue(new Error('Failed to fetch paragraph data'));

      // Call the fetchAndDisplayChapter function with a chapter id
      await customChapter.fetchAndDisplayChapter('chapter1');

      // Expect the error to be logged
      expect(console.error).toHaveBeenCalledWith('Error fetching data:', expect.any(Error));
    });
  });
});