# Contents Endpoint — `GET /api/1.0/contents/*`

Liefert die Navigation als Baum aus **Nodes** — Wurzelknoten mit ihren Kindern,
in beliebiger Tiefe. Er ist seit dem Wegfall des alten
Datenmodells die einzige Quelle der Navigation.

## Request

```
GET /api/1.0/contents/*?depth=<n>
Authorization: Bearer <jwt>   (optional)
```

- **`depth`** (optional, Query-Parameter): Anzahl der Ebenen.
  - `1` → nur die Wurzelknoten (`childnodes: []`)
  - `n` → die obersten `n` Ebenen, darunter `childnodes: []`
  - weggelassen / ungültig (nicht-numerisch, `< 1`, nicht ganzzahlig) → **volle Tiefe**
  - Es gibt keine Obergrenze; `depth` kürzt nur.
- **`/*`**: Das Pfad-Wildcard ist aktuell **reserviert**, wird aber noch nicht ausgewertet —
  der Endpunkt liefert immer den kompletten Baum ab Root.

## Response

```json
{
  "result": [
    {
      "id": "000n00000000000011",
      "label": "Mock Story 1",
      "name": "Mock Story 1",
      "sortnumber": 1,
      "childnodes": [
        {
          "id": "000n00000000000001",
          "label": "Mock Chapter 1 for Story 1",
          "name": "Mock Chapter 1 for Story 1",
          "sortnumber": 1,
          "childnodes": []
        }
      ]
    }
  ]
}
```

**Node**

| Feld         | Bedeutung                                                           |
| ------------ | ------------------------------------------------------------------- |
| `id`         | Id des Knotens — die neue Id, **nicht** `legacy_id`                 |
| `name`       | Anzeigename                                                         |
| `label`      | Kopie von `name` (Frontend entscheidet die Anzeige)                 |
| `sortnumber` | Reihenfolge unter den Geschwistern (für „höchste + 1“ beim Anlegen) |
| `childnodes` | Kind-Nodes (nächste Ebene), `[]` an der Tiefen-Grenze               |

Das Mapping ist allowlist-basiert — nur `id`/`name`/`sortnumber` werden übernommen, daher tauchen
interne Felder (`published_date`, `application*`, …) nie in der Response auf. Nodes sind je
Ebene nach `sortnumber` sortiert.

## Auth & Sichtbarkeit

| Aufrufer                      | Baum                                   | Cache                              |
| ----------------------------- | -------------------------------------- | ---------------------------------- |
| anonym / ohne `edit`-Scope    | nur **veröffentlichte** Nodes          | aus Cache gelesen                  |
| Bearer-Token mit `edit`-Scope | **alle** Nodes (auch unveröffentlicht) | Cache übersprungen (frisch aus DB) |

Ein ungültiger Bearer-Token führt zu `401 Unauthorized`.

Unveröffentlichte Nodes entfernt die `DataFacade`: Sie wendet das geteilte Modul
[`ContentVisibilityFilter`](../../../../modules/ContentVisibilityFilter.js) nach dem Cache an
und gibt standardmäßig den veröffentlichten Baum heraus. Der Endpunkt fordert nur mit
`edit`-Scope mehr an (`setIncludeUnpublished(true)`) und filtert selbst nicht. Ein Node ist
sichtbar, wenn `published_date` gesetzt und nicht später als jetzt ist; ein versteckter Node
nimmt seinen ganzen Teilbaum mit.

## Caching

- Dedizierter Cache-Key **`contentsTree`** (`ContentsTreeCacheKeyGenerator`).
- Gecacht wird der **volle** Baum (inkl. unveröffentlichter Nodes); gefiltert wird erst bei
  Auslieferung. Kleinere `depth`-Werte werden im Code aus dem vollen Baum zugeschnitten.
- TTL = `CACHE_CONTAINER_EXPIRATION_SECONDS` (Standard 1 Tag).
- **Aktive Invalidierung:** Jedes Anlegen, Ändern (auch Verschieben), Veröffentlichen,
  Zurückziehen und Löschen eines **Knotens** leert `contentsTree`, auch bei `skipCache`.
  Ohne das sähen Besucher bis zum Ablauf der TTL den alten Baum; mit `edit`-Scope fiel es
  nicht auf, weil der Cache dort übergangen wird. Inhalte stehen nicht im Baum und leeren
  ihn nicht.

## Datenherkunft

`DataFacade.getData({ table: 'contents' })` holt den Baum vom
`NodeContentRepository`: zwei Abfragen (`node`, `app_node`), danach löst
JavaScript die App-Zugehörigkeit auf und baut Wurzelknoten mit ihren Kindern
unter `nodes`. Konstant zwei DB-Round-Trips, unabhängig von der Tiefe.

## Beteiligte Dateien

- `ContentsEndpoint.js` — Mapping (`mapToNodes`), `depth`-Parsing, Scope-/Filter-Steuerung
- `private/modules/ContentVisibilityFilter.js` — Publish-Filter, angewendet von der `DataFacade`
- `private/database2/DataFacade.js` — `getContentsTree` / `buildContentsTree`
- `private/database2/repositories/NodeContentRepository.js` — `getContentsTree`
- `private/modules/NodeVisibility.js` — Auflösung der App-Zugehörigkeit
- `private/database2/DataCache/DataCache.js` — `ContentsTreeCacheKeyGenerator`
- Route-Registrierung in `server.js`
