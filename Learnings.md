# Learnings

## Load CSS only once

### Chalenge

All components must import the SLDS Styling. Yet fetching the CSS-Sheet over and over again would cost lots of bandwidth and speed. All components are loaded individually and asysnchronously. Therfore a way must be found to have only the first call to result in an actuall fetch while caching the resullt for all subseeding fetches.

### Solution

- An SLDS loader is created to bundle fetch and cachedHtmlTemplate. every acces to the style sheet has to go via this loader
- To make sure the loader is executed first and all other components have to be inserted after
- Every Component has to import the slds loader and attach the sheet to its shadow dom

**Issue:** if css is not named directly in index it wont be delivered by express server


### Post mortem

Yet it turned out even if fetch once works the stylesheet must be included in the html once too.

~~This is not true as the toggle component, whih is a exact copy from [www.lightningdesignsystem.com > Checkbox Toggle](https://www.lightningdesignsystem.com/components/checkbox-toggle/) still takes the styling after removing it everywhere exept the slds loader~~

## Load each HTML Template only once

### Chalenge

The loading behavior of css files applies to the mark up of each component too. As each component has it's own markup a caching must be done by component instead of a single global cache.

### Solution

1. **Caching Mechanism:** The logic implements a caching mechanism for an HTML markup file to optimize performance and reduce redundant network requests.

2. **Promise-Based Fetch:** To ensure proper handling of asynchronous operations and prevent race conditions, the logic uses Promises to fetch the HTML template. This means that subsequent requests for the same template will wait for the initial fetch to complete before proceeding.

3. **Template Fetching:** The HTML template is fetched from a specified path, such as '/components/chapter/chapter.html,' and retrieved using the `fetch` API.

4. **Template Parsing:** After fetching the HTML content, the logic parses it into a document using `DOMParser`. This parsing allows for manipulation and extraction of specific elements within the template.

5. **Caching Strategy:** Once parsed, the template is stored in a variable (in this case, `cachedHtmlTemplate`). This variable acts as a cache, ensuring that subsequent requests for the same template use the cached version instead of fetching it again.

By focusing on the caching aspect, this logic provides an efficient way to retrieve and store HTML markup templates for reuse, minimizing the overhead of repeated network requests and improving the overall performance of web applications.

---

## Update 2024-04-18

### Challenge

Linking a domin to heroku app and activating [Heroku Automated Certificate Management (ACM)](https://devcenter.heroku.com/articles/automated-certificate-management)

### Solution 

1. Buy domain <your-domain.de> at registrar
1. Add Domain to Heroku app

   **Note:** ACM requires subdomain like 'www.'
   
1. Copy dns target
1. Enable ACM
1. Add CNAME entry to DNS records
   - Name: subdomain (eg. 'www')
   - Value: dns target
  
1. add Forwarding
   - Protocoll: 'https://'
   - value: 'www.<your-domain.de>'
   - Forward Type: 301
