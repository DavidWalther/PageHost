# My-PWA

## Environment Variables

### General Application Variables

| Variable | Description |
| :--- | :--- |
| APPLICATION_APPLICATION_KEY | Key to seperate different applications in cache and database |
| LOGGING_SEVERITY_LEVEL | Level of Debug messages to show. <br> Messages with the given severity and above are printed. <br><br>Possible values: INFO, DEBUG, FINE, FINER, FINEST |

### Cache related Variables

| Variable | Description |
| :--- | :--- |
| CACHE_KEY_PREFIX | Used to create different 'areas' inside the cache for the same application key. <br> e.g. live-cache, staging-cache, development-cache, ...  |
| CACHE_CONTAINER_EXPIRATION_SECONDS | Number of seconds a record stays in the cache after retrieving from the database |
| CACHE_DATA_INCREMENT | Change od this Value invalidates all existing cache keys. This forces requering all data |
| REDIS_HOST |
| REDIS_PORT |
| REDIS_PASSWORD |

### Database (Postgres) related Variables

| Variable | Description |
| :--- | :--- |
| PG_LOCAL_DB | Variable to specificaly the use of a local database |
| PGHOST |
| PGUSER |
| PGDATABASE |
| ENDPOINT_ID |

## Cache
To avoid additional costs it was decided to use the same database for development, test and live data. However live data is still separated by database-branches.
Development towards the same database puts additional load on the connection which is handled by caching a certain set of data.

For a simple key/value infrastructure is chosen to provide easy access. Still the separation of date is kept intact by automaticaly adding prefixes to each key.

As the whole structure of the Page is driven by data, there are different requirements for the cache.
- An **index-cache**: cache data that indicates structure
- A **content-cache**: cache data for content

### Key Prefixes

These prefixes identify the System a key was created by. The keyprefix is set in the environment variable `CACHE_KEY_PREFIX` of each System

Key prefixs: 
- `PR`
- `TEST`
- `LIVE`

### Index-cache (not implemented yet)
The index cache keeps track of which items exists in the database. It is used as a register of previosly cached data. the livespan in Seconds is defined in `CACHE_INDEX_EXPIRATION_SECONDS`. It can be flushed on demand and it is extended if data encountered that is not in the index yet.

It Contains:
- a list of (id, parentid) - pairs
   
    Representing the structure of IndexData
- a Map of (Id => IndexData)

    Containing the actual IndexData with 
    - Name
    - PublishData
    - SortNumber
    - Description

**Note**: Content data is suposed to dynamically vanish from the cache. It therefore must not be part of the index's data.

### Content-cache (not implemented yet)
the content cache 




## Domains

- Heroku Domain: https://glacial-plains-08201-4314ef80e9a0.herokuapp.com/
- Custom Domain: http://552443572085.hostingkunde.de


## Decissions

### Use of SLDS

This framework offers a great variaty of boilerpate stylings which simplifies and speeds up development.

### No Use of LWC/LWR

Using Ligtning Web Components (LWC) requires the Lightning Web Runtime (LWR) to precompile the developed application before serving. To do that it must be used as the server.

As resources for the node Express server are far more obundant the decission is made to not use the LWR and threfore to not use LWCs
