# PageHost Progressive Web Application

PageHost is a Node.js Progressive Web Application (PWA) built with Express server, native HTML Web Components, and Salesforce Lightning Design System (SLDS). It serves as a content management system for stories, chapters, and paragraphs with PostgreSQL database storage and Redis caching.

Always reference these instructions first and fallback to search or bash commands only when you encounter unexpected information that does not match the info here.

## Working Effectively

### Bootstrap and Install Dependencies
- `npm install` -- installs all dependencies. Takes 13 seconds. NEVER CANCEL.
- Dependencies include Express, PostgreSQL client, Redis client, JWT, SLDS, Jest testing framework

### Build and Test the Application  
- `npm test` -- runs Jest test suite with 144 tests. Takes 3 seconds. NEVER CANCEL. Set timeout to 30+ seconds.
- All tests should pass. The test suite covers database operations, authentication, endpoints, and data storage.

### Environment Configuration
**CRITICAL**: The application requires environment variables. Create a `.env` file with these required variables:
```
APPLICATION_APPLICATION_KEY=your-app-key
LOGGING_SEVERITY_LEVEL=INFO
CACHE_KEY_PREFIX=DEV
CACHE_CONTAINER_EXPIRATION_SECONDS=3600
CACHE_DATA_INCREMENT=1
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
PG_LOCAL_DB=true
PGHOST=localhost
PGUSER=your-user
PGDATABASE=your-database
PORT=3000
```

### Run the Application
- `npm start` -- starts the Express server on port 3000. Takes 2-3 seconds to start. NEVER CANCEL.
- Server serves static files from `/public` directory
- **VALIDATION**: Server should log "Server running on port 3000" when ready
- Access the application at `http://localhost:3000`

## Application Architecture

### Technology Stack
- **Backend**: Node.js with Express server
- **Frontend**: Native HTML Web Components with SLDS styling
- **Database**: PostgreSQL with Redis caching layer
- **Authentication**: OAuth2 (Google) with JWT tokens
- **Testing**: Jest framework
- **PWA Features**: Service Worker, manifest.json

### Directory Structure
```
/public/                    # Static frontend files
  /applications/bookstore/  # Main bookstore application component
  /components/             # Custom application components (prefix: custom-)
  /slds-components/        # Reusable SLDS components (prefix: slds-)
  /modules/               # Shared JavaScript modules
  /styles/               # CSS stylesheets
  index.html            # Main application entry point
  index.js             # Application initialization logic
/private/                 # Backend server code
  /endpoints/            # API endpoint handlers
  /modules/             # Server-side modules
  /database2/           # Database and caching layers
  /scripts/            # Data management scripts
server.js               # Main Express server file
```

### Key API Endpoints
- `GET /` - Serves main application (index.html)
- `GET /metadata` - Application metadata
- `GET /data/query/story` - Story data queries
- `GET /data/query/chapter` - Chapter data queries
- `POST /api/1.0/data/change/` - Data modification (requires auth)
- OAuth2 endpoints under `/api/1.0/oAuth2/`

## Development Workflow

### Making Code Changes
1. **Always run the bootstrap and test steps first** before making changes
2. **Always run `npm test` after making changes** to ensure nothing is broken
3. **Always start the server with `npm start`** and test functionality in browser
4. **Test specific user scenarios** after making changes (see Validation section)

### Data Management Scripts (Require Database Connection)
The following npm scripts manage application data but require proper database setup:
- `npm run story:create` - Create new stories
- `npm run chapter:create` - Create new chapters  
- `npm run paragraph:create` - Create new paragraphs
- `npm run cache:flush` - Clear Redis cache
- `npm run cache:read` - Read cache contents

**Note**: These scripts may fail if database/Redis connections are not configured.

## Validation

### Required Manual Testing
**ALWAYS** manually validate changes by running through these scenarios:

1. **Application Startup Test**:
   - Run `npm start`
   - Navigate to `http://localhost:3000`
   - Verify page loads with light gray background and "PageHost PWA" title
   - Check browser console for JavaScript errors

2. **Component Loading Test**:
   - Verify SLDS components load properly
   - Check that web components initialize (custom elements should be defined)

3. **API Endpoint Test** (if database available):
   - Test `curl http://localhost:3000/metadata`
   - Verify server responds appropriately

### Browser Testing
- Use Chrome/Edge for full PWA feature testing
- Test responsive design on different screen sizes
- Verify Service Worker registration in DevTools

### Common Issues and Solutions
- **Server won't start**: Check environment variables are set correctly
- **Components not loading**: Verify all script tags in index.html point to existing files
- **Database errors**: Ensure PostgreSQL and Redis connections are properly configured
- **Build failures**: Run `npm install` to ensure all dependencies are installed

## File Locations

### Frequently Modified Files
- `/server.js` - Main server configuration and routing
- `/public/index.html` - Application entry point and component loading
- `/public/index.js` - Application initialization and event handling
- `/public/applications/bookstore/bookstore.js` - Main application component
- `/private/endpoints/` - API endpoint implementations
- `/package.json` - Dependencies and npm scripts

### Configuration Files
- `.env` - Environment variables (create as needed)
- `.gitignore` - Git ignore patterns
- `/public/styles/darkmode.css` - Application styling

### Test Files
- Look for `__tests__` directories throughout the codebase
- All test files use `.test.js` or `.tests.js` extensions

## Build Times and Timeouts

- **npm install**: ~13 seconds - Set timeout to 60+ seconds
- **npm test**: ~3 seconds - Set timeout to 30+ seconds  
- **npm start**: ~2-3 seconds startup - Set timeout to 30+ seconds
- **NEVER CANCEL** any of these operations

## Common Commands Reference

```bash
# Development workflow
npm install              # Install dependencies (13s)
npm test                # Run tests (3s) 
npm start               # Start server (2-3s startup)

# Useful Git commands (from package.json)
npm run gitBranchMergedDelete    # Clean merged branches
npm run gitLogGraphOnlineAll     # View git history

# Data operations (require database)
npm run cache:flush     # Clear cache
npm run story:read      # Read stories
npm run chapter:read    # Read chapters
```

Always ensure proper environment setup and database connections before using data management scripts.