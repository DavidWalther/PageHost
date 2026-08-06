# `/data/query/*` — Lese-Endpunkte

Zwei Antwortformen laufen hier nebeneinander: die **alte**, an drei feste Ebenen
gebundene, und die **typfreie** des neuen Datenmodells. Die alte verschwindet,
sobald das Frontend umgestellt ist.

| Route                       | Logik                   | Form                          |
| :-------------------------- | :---------------------- | :---------------------------- |
| `/data/query/story?id=`     | `SingleStoryEndpoint`   | alt (`chapters[]`)            |
| `/data/query/chapter?id=`   | `ChapterEndpoint`       | alt (`paragraphs[]`)          |
| `/data/query/paragraph?id=` | `ParagraphEndpoint`     | alt (`content`/`htmlcontent`) |
| `/data/query/node?id=`      | `TypeFreeQueryEndpoint` | neu (`nodes[]`/`contents[]`)  |
| `/data/query/content?id=`   | `TypeFreeQueryEndpoint` | neu (`items[]`)               |

Alles andere landet im `FallbackEndpoint`.

## Typfreie Form

Der Unterschied ist nicht kosmetisch: Es gibt keine Story und kein Kapitel mehr,
nur Knoten. Ob ein Knoten Kinder hat, Inhalte, beides oder nichts, ergibt sich
aus seiner Position im Baum — nicht aus dem Namen der Route.

### `GET /data/query/node?id=<id>`

```json
{
  "id": "000n00000000000005",
  "legacy_id": "000s00000000000011",
  "name": "…",
  "description": null,
  "sortnumber": 1,
  "reversed": null,
  "parent_node_id": null,
  "cover_node_id": "000n00000000000006",
  "published_date": "2026-01-01T00:00:00.000Z",
  "nodes": [{ "id": "…", "legacy_id": "…", "name": "…", "…": "…" }],
  "contents": [
    {
      "id": "00cn…",
      "legacy_id": "000p…",
      "name": "…",
      "sortnumber": 1,
      "published_date": "…"
    }
  ]
}
```

Die Kind-Knoten unter `nodes[]` tragen dieselben Felder wie der angefragte
Knoten — ein Kind lässt sich also darstellen, ohne es einzeln nachzuladen.

### `GET /data/query/content?id=<id>`

```json
{
  "id": "00cn00000000000033",
  "legacy_id": "000p00000000000033",
  "name": "…",
  "sortnumber": 1,
  "published_date": "…",
  "node_id": "000n00000000000006",
  "active_content_item": "00ci00000000000002",
  "active_type": "html",
  "items": [
    { "id": "00ci…", "type": "text", "content": "…" },
    { "id": "00ci…", "type": "html", "content": "<p>…</p>" }
  ]
}
```

Der Client bekommt **alle** Repräsentationen und den Zeiger auf die aktive,
statt einer vorab getroffenen Auswahl. Ein künftiger Typ (`markdown`, `mermaid`)
braucht damit keine Änderung an der Schnittstelle.

## Regeln, die für beide Formen gelten

- **Ids gehen in beiden Fassungen herein.** Eine alte (`000s…`/`000c…`/`000p…`)
  wird über `legacy_id` aufgelöst. Die typfreie Form gibt die **neue** Id zurück
  und stellt die alte als `legacy_id` daneben; die alte Form gibt weiterhin die
  alte zurück.
- **Unbekannt oder nicht sichtbar → `{}`.** Kein 404 — das ist der Ist-Zustand
  der alten Routen und bleibt so.
- **App-Zugehörigkeit wird immer aufgelöst**, auch mit `edit`-Scope. Sie hängt
  am Knoten; ein Inhalt folgt seinem Knoten.
- **`edit`-Scope** (Bearer-JWT) setzt den Publish-Filter aus und übergeht den
  Cache. Er setzt die App-Grenze **nicht** aus.
- **Cache-Schlüsselräume sind getrennt**: `…-stories-<id>` gegen `…-nodes-<id>`.
  Dieselbe alte Id kann über beide Formen angefragt werden und darf nicht die
  Antwort der jeweils anderen bekommen.

## Rückfallebene

`CONTENT_SOURCE=legacy` schaltet die Inhaltsquelle auf `story`/`chapter`/
`paragraph` zurück. Die **typfreien Routen sind dann nicht bedienbar** und
antworten mit einem Fehler: Das Altmodell könnte die Form nur nachbauen, indem
es den Typ wieder am Id-Präfix ablöst. Der Schalter deckt die alten Routen ab —
dafür wurde er gebaut.
