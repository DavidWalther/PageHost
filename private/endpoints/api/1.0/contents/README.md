# Contents Endpoint — `GET /api/1.0/contents/*`

Liefert die Navigation als Baum aus **Nodes**. Stories und Chapters werden einheitlich als
`Node` abstrahiert (perspektivisch mehr als zwei Ebenen). Der Endpunkt soll langfristig die
`queryAllStories`-basierte Navigation ablösen; aktuell läuft er im Parallelbetrieb.

## Request

```
GET /api/1.0/contents/*?depth=<n>
Authorization: Bearer <jwt>   (optional)
```

- **`depth`** (optional, Query-Parameter): Anzahl der Ebenen.
  - `1` → nur Stories (`childnodes: []`)
  - `2` → Stories + Chapters
  - weggelassen / ungültig (nicht-numerisch, `< 1`, nicht ganzzahlig) → **volle Tiefe** (aktuell 2)
  - Werte `> 2` werden auf die verfügbare Tiefe begrenzt.
- **`/*`**: Das Pfad-Wildcard ist aktuell **reserviert**, wird aber noch nicht ausgewertet —
  der Endpunkt liefert immer den kompletten Baum ab Root.

## Response

```json
{
  "result": [
    {
      "id": "000s00000000000011",
      "label": "Mock Story 1",
      "name": "Mock Story 1",
      "childnodes": [
        {
          "id": "000c00000000000001",
          "label": "Mock Chapter 1 for Story 1",
          "name": "Mock Chapter 1 for Story 1",
          "childnodes": []
        }
      ]
    }
  ]
}
```

**Node**

| Feld         | Bedeutung                                              |
|--------------|--------------------------------------------------------|
| `id`         | Datensatz-ID (Story- bzw. Chapter-ID)                  |
| `name`       | Anzeigename                                            |
| `label`      | Kopie von `name` (Frontend entscheidet die Anzeige)    |
| `childnodes` | Kind-Nodes (nächste Ebene), `[]` an der Tiefen-Grenze  |

Das Mapping ist allowlist-basiert — nur `id`/`name` werden übernommen, daher tauchen interne
Felder (`publishdate`, `application*`, `sortnumber`, …) nie in der Response auf. Nodes sind je
Ebene nach `sortnumber` sortiert.

## Auth & Sichtbarkeit

| Aufrufer                     | Baum                                  | Cache            |
|------------------------------|---------------------------------------|------------------|
| anonym / ohne `edit`-Scope   | nur **veröffentlichte** Nodes         | aus Cache gelesen |
| Bearer-Token mit `edit`-Scope| **alle** Nodes (auch unveröffentlicht)| Cache übersprungen (frisch aus DB) |

Ein ungültiger Bearer-Token führt zu `401 Unauthorized`.

Das Entfernen unveröffentlichter Nodes passiert **zur Laufzeit bei Auslieferung** über das
geteilte Modul [`ContentVisibilityFilter`](../../../../modules/ContentVisibilityFilter.js)
(`setTree(t).setDate(d).getResult()`). Dieselbe Komponente wird später für `sitemap.xml`
wiederverwendet. Ein Node gilt als sichtbar, wenn sein `publishdate` gesetzt und `<=` heute ist.

## Caching

- Dedizierter Cache-Key **`contentsTree`** (`ContentsTreeCacheKeyGenerator`).
- Gecacht wird der **volle** Baum (inkl. unveröffentlichter Nodes); gefiltert wird erst bei
  Auslieferung. Kleinere `depth`-Werte werden im Code aus dem vollen Baum zugeschnitten.
- TTL = `CACHE_CONTAINER_EXPIRATION_SECONDS` (Standard 1 Tag). Kurz genug, dass eine **aktive
  Invalidierung entfällt** — Create/Update/Delete/Publish berühren den Baum-Key nicht.

## Datenherkunft

`DataFacade.getData({ table: 'contents' })` baut den Baum aus flachen Queries je Ebene
(`DataStorage.queryAllStories()` + `queryAllChapters()`) und gruppiert Chapters per
`chapter.storyid → story.id` (konstant 2 DB-Round-Trips, skaliert auf künftige Ebenen).
Im Mock-Modus (`MOCK_DATA_ENABLE=true`) liefert `DataMock.getContentsTree()` den Baum aus
`tables/mocks/story.json`.

## Beteiligte Dateien

- `ContentsEndpoint.js` — Mapping (`mapToNodes`), `depth`-Parsing, Scope-/Filter-Steuerung
- `private/modules/ContentVisibilityFilter.js` — Laufzeit-Publish-Filter (geteilt mit sitemap.xml)
- `private/database2/DataFacade.js` — `getContentsTree` / `buildContentsTree`
- `private/database2/DataStorage/DataStorage.js` — `queryAllChapters`
- `private/database2/DataCache/DataCache.js` — `ContentsTreeCacheKeyGenerator`
- Route-Registrierung in `server.js`
