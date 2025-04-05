# Versions

## Naming pattern
`<major-version>.<minor-version>.<bugfix>`


### 2.18.0 (2025-04-05)

Feature
- index.html will now be generated at runtime instead of being a static file in the codebase

---

## After each **minor-version** the bugfix count is set to 0

### 2.17.4 (2025-03-29)

Bugfix
- Stories with chapter defined as cover are loading it again

### 2.17.3 (2025-03-28)

Feature
- create manifest.json from configuration in database

### 2.16.3 (2025-03-16)

Feature:
- create html meta-tags from configurations in database

### 2.15.3 (2025-03-16)

Bugfix:
- criteria PublishDate is now considering the current date/time instead of the current date

### 2.15.2 (2025-01-18)

Technical:
- alway redirect to links with id to host-url

### 2.14.2 (2025-01-14)

Technical:
- refactoring of endpoint logic
- creation of specific file-endpoints

### 2.13.1 (2024-12-21)

Technical:
- refactoring of database conection
- refactoring of datacache conection
- new mock layer to save database ressources during dvelopment
- new DataFacade to manage accessing of data

### 1.13.1 ( 2024-10-26)

Technical:
- create an option to hide card-border

### 1.12.1 ( 2024-10-03 )

Technical:
- create a layer to access environment variables withou reading the process.env directly
- add CacheDataIncrement variable to force reloading of all cache

### 1.11.1 (2024-09-19)

Technical:
- allow hosting of multiple pages in the same Database
- add to story cache: chapter.id and chapter.name
- add to chapter cache: paragraph.id and paragraph.name

### 1.10.1 (2024-07-24)

Feature
- combobox has now two options
  - read-only
  - editable. the given input acts as filter for the  options

Technical:
- use query-events for metadata
- use query-events for single stories
- use query-events for chapters
- use query-events for paragraphs
- load paragraphs individually

### 1.9.0 (2024-07-01)

Feature:
- Books with many chapter get a combobox instead of chapter-buttons

Technical:
- Create Endpoint to load metadata from Database
- create query-event to handle fetches for stories

### 1.8.0 (2024-06-17)

Feature:
- show latest records of News and Versions first

Technical:
- Show titles in text paragraphs
- create new table for metadata
