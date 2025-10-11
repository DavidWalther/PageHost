# Database Architecture Documentation

## Overview

The PageHost application implements a three-layer database architecture consisting of:
1. **DataFacade** - Main entry point and coordination layer
2. **DataStorage** - PostgreSQL database operations layer
3. **DataCache** - Redis caching layer

This architecture provides efficient data access through caching while maintaining data persistence and multi-tenant isolation through application keys.

## Architecture Components

### DataFacade Layer

The DataFacade serves as the primary interface for all data operations and coordinates between caching and storage layers.

#### Key Classes:
- **DataFacade** - Main factory class
- **DataFacadeSync** - Synchronous operations handler 
- **DataFacadePromise** - Asynchronous operations handler

#### Core Responsibilities:
- Route requests to appropriate data sources (cache vs database)
- Manage cache-bypass logic through `skipCache` flag
- Handle CRUD operations (Create, Read, Update, Delete)
- Coordinate between DataStorage and DataCache
- Support mock data for testing via `MOCK_DATA_ENABLE` environment variable

#### Cache Strategy:
- **Read Operations**: Check cache first, fallback to database if cache miss
- **Write Operations**: Update database, then update cache (write-through pattern)
- **Delete Operations**: Remove from database, then invalidate cache
- **Create Operations**: Always bypass cache initially

### DataStorage Layer

The DataStorage layer handles all PostgreSQL database operations and manages connection pooling.

#### PostgreSQL Connector (pgConnector.js)

```javascript
class PostgresActions {
  static connect(environment) {
    // Supports both local and cloud connections
    // Local: Basic connection without SSL
    // Cloud: SSL-required connection with project endpoint
  }
  
  executeSql(sqlStatement, options) {
    // Executes raw SQL with connection management
    // Optionally closes connection after execution
  }
}
```

#### Key Features:
- **Connection Management**: Automatic SSL detection for cloud vs local databases
- **Environment-Based Configuration**: Uses `PG_LOCAL_DB` flag to determine connection type
- **Error Handling**: Comprehensive error logging and propagation
- **Connection Pooling**: Reuses connections by default, optional connection closure

#### Application Key Isolation:
The DataStorage layer enforces multi-tenant isolation through the `applicationKey`:
- Set via `setConditionApplicationKey(this.environment.APPLICATION_APPLICATION_KEY)`
- Applied to all database queries as a WHERE condition
- Ensures data separation between different applications/tenants

#### Supported Tables:
- **Story**: Main content containers with chapters
- **Chapter**: Content sections within stories, containing paragraphs  
- **Paragraph**: Individual content blocks
- **Configuration**: Application-specific settings

#### Query Patterns:
- **Single Record Queries**: By ID with application key filtering
- **Joined Queries**: Story-Chapter, Chapter-Paragraph relationships
- **Configuration Queries**: Key-value pairs with nested object support
- **Publish Date Filtering**: Optional temporal filtering for content visibility

### DataCache Layer

The DataCache layer provides Redis-based caching with sophisticated key generation and namespace management.

#### Redis Connector (RedisConnector.js)

```javascript
class RedisConnector {
  constructor(environmentObject) {
    // Creates Redis client with password authentication
    // Supports connection state management
  }
  
  async methodWrapper(method) {
    // Handles connection lifecycle for individual operations
    // Connects -> Execute -> Disconnect pattern
  }
}
```

#### Cache Key Architecture

The cache key system provides multi-dimensional isolation and organization:

##### Global Key Format:
```
{CACHE_KEY_PREFIX}-{APPLICATION_APPLICATION_KEY}-{CACHE_DATA_INCREMENT}-{SPECIFIC_KEY}
```

##### Key Components:
1. **CACHE_KEY_PREFIX**: Environment isolation (prod, staging, dev)
2. **APPLICATION_APPLICATION_KEY**: Application/tenant isolation  
3. **CACHE_DATA_INCREMENT**: Version control for cache invalidation
4. **SPECIFIC_KEY**: Entity-specific identifier

##### Cache Key Generators:

**MetaDataCacheKeyGenerator**:
- Pattern: `{prefix}-metadata`
- Lifetime: Default container expiration
- Use: Application configuration data

**ParagraphCacheKeyGenerator**: 
- Pattern: `{prefix}-paragraphs-{id}`
- ID Prefix: `000p` (identifies paragraph entities)
- Lifetime: Default container expiration

**ChapterCacheKeyGenerator**:
- Pattern: `{prefix}-chapters-{id}`  
- ID Prefix: `000c` (identifies chapter entities)
- Lifetime: Default container expiration

**StoryCacheKeyGenerator**:
- Pattern: `{prefix}-stories-{id}`
- ID Prefix: `000s` (identifies story entities)  
- Lifetime: Default container expiration

**StoriesAllCacheKeyGenerator**:
- Pattern: `{prefix}-stories-all`
- Use: Cached list of all stories for application

**ShortTermCacheKeyGenerator**:
- Pattern: `{prefix}-{key}` (for keys starting with 'short-term')
- Lifetime: 20 minutes (1200 seconds)
- Use: Authentication states, temporary data

**MidTermCacheKeyGenerator**:
- Pattern: `{prefix}-{key}` (for keys starting with 'mid-term')  
- Lifetime: 2 hours (7200 seconds)
- Use: Medium-duration cached data

#### Cache Key Factory Pattern:

```javascript
class CacheKeyGeneratorFactory {
  getProduct(key) {
    // Routes to appropriate generator based on key patterns:
    // - Special prefixes: 'short-term', 'mid-term'
    // - Named keys: 'metadata', 'storiesAll'  
    // - ID prefixes: '000p', '000c', '000s'
  }
}
```

## Namespace Creation Through Application Keys

### Multi-Tenant Isolation Strategy

The system implements comprehensive namespace isolation at multiple levels:

#### 1. Cache Namespace Isolation
Every cache key incorporates the `APPLICATION_APPLICATION_KEY`, creating separate cache spaces:
```
production-app1-v1-metadata  // App1's metadata  
production-app2-v1-metadata  // App2's metadata (completely isolated)
```

#### 2. Database Namespace Isolation  
All database queries include application key filtering:
```sql
SELECT * FROM story WHERE applicationincluded = 'app1-key' AND id = '000s123'
```

#### 3. Environment Namespace Isolation
The `CACHE_KEY_PREFIX` provides environment-level separation:
```
prod-app1-v1-stories-000s123    // Production
stage-app1-v1-stories-000s123   // Staging  
dev-app1-v1-stories-000s123     // Development
```

#### 4. Version-Based Cache Invalidation
The `CACHE_DATA_INCREMENT` enables application-wide cache invalidation:
```
prod-app1-v1-metadata  // Old version
prod-app1-v2-metadata  // New version (old keys effectively invalidated)
```

### Application Key Usage Patterns

#### In DataFacade:
```javascript
// Sets application context for all operations
dataStorage.setConditionApplicationKey(this.environment.APPLICATION_APPLICATION_KEY);
```

#### In DataStorage:
```javascript
// Applied as WHERE condition in all queries
.setConditionApplicationKey(this.applicationKey)
```

#### In DataCache:
```javascript
// Incorporated into every cache key via GlobalCacheKeyGenerator
keyElements.push(this.environmentVars.APPLICATION_APPLICATION_KEY);
```

## Data Flow Patterns

### Read Operation Flow:
1. **Request** → DataFacade
2. **Cache Check** → DataCache.get(key) 
3. **Cache Hit** → Return cached data
4. **Cache Miss** → DataStorage.query()
5. **Database Query** → PostgreSQL with application key filter
6. **Cache Update** → DataCache.set(key, data)
7. **Response** → Return data to client

### Write Operation Flow:
1. **Request** → DataFacade  
2. **Database Update** → DataStorage.updateData()
3. **Cache Update** → DataCache.set(key, updatedData) (if not skipCache)
4. **Response** → Return success status

### Create Operation Flow:
1. **Request** → DataFacade
2. **Database Insert** → DataStorage.createRecord()
3. **Skip Cache** → Cache is not populated on create
4. **Response** → Return created record

### Delete Operation Flow:
1. **Request** → DataFacade
2. **Database Delete** → DataStorage.deleteData()  
3. **Cache Invalidation** → DataCache.del(key) (if not skipCache)
4. **Response** → Return success status

## Configuration and Environment Variables

### Core Application Variables:
- `APPLICATION_APPLICATION_KEY`: Primary tenant/application identifier
- `MOCK_DATA_ENABLE`: Enable/disable mock data for testing
- `LOGGING_SEVERITY_LEVEL`: Control debug output verbosity

### Cache Configuration:
- `CACHE_KEY_PREFIX`: Environment-level cache isolation
- `CACHE_DATA_INCREMENT`: Version control for cache invalidation  
- `CACHE_CONTAINER_EXPIRATION_SECONDS`: Default cache TTL
- `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`: Redis connection details

### Database Configuration:
- `PG_LOCAL_DB`: Local vs cloud database flag
- `PGHOST`, `PGDATABASE`, `PGUSER`, `PGPASSWORD`: PostgreSQL connection
- `ENDPOINT_ID`: Cloud database project identifier

## Testing Architecture

### Mock Data Support:
- Controlled via `MOCK_DATA_ENABLE` environment variable
- DataMock classes provide test data for all entity types
- Enables testing without database/cache dependencies

### Cache Testing:
- RedisConnector mocking for unit tests
- Cache key validation tests  
- Connection lifecycle testing
- Multi-environment cache key isolation tests

### Database Testing:
- PostgreSQL connector mocking
- Application key isolation verification
- CRUD operation testing
- Query sanitization testing

## Performance Considerations

### Cache Efficiency:
- **Write-Through Caching**: Updates both database and cache
- **Intelligent Expiration**: Different TTLs for different data types
- **Connection Pooling**: Redis connections reused when possible
- **Batch Operations**: Multiple cache operations in single connection

### Database Optimization:
- **Application Key Indexing**: Essential for query performance
- **Connection Management**: Optional connection closure for resource control
- **Query Sanitization**: SQL injection prevention
- **Prepared Statement Pattern**: Through action classes

### Namespace Efficiency:
- **Hierarchical Key Structure**: Enables pattern-based operations
- **Predictable Key Generation**: Allows for cache preloading
- **Version-Based Invalidation**: Avoids individual key deletion

## Security Features

### Input Sanitization:
- SQL injection prevention through Sanitizer class
- Input validation in action classes
- Parameter escaping in PostgreSQL queries

### Multi-Tenant Security:
- Mandatory application key filtering
- No cross-tenant data leakage possible
- Environment-level isolation

### Connection Security:
- SSL enforcement for cloud databases
- Password-protected Redis access
- Connection state validation

## Error Handling and Logging

### Comprehensive Logging:
- Operation-level logging with severity levels
- Connection state tracking
- Cache hit/miss reporting
- Database query performance tracking

### Error Recovery:
- Graceful cache fallback to database
- Connection retry mechanisms
- Transaction rollback support
- Detailed error reporting for debugging

This architecture provides a robust, scalable, and secure foundation for multi-tenant data operations with efficient caching and comprehensive isolation mechanisms.
