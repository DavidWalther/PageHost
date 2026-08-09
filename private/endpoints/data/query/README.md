# `/data/query/*` — Lese-Endpunkte

Es gibt genau **eine** Antwortform, die typfreie des Datenmodells. Die frühere
Aufteilung in `story`, `chapter` und `paragraph` ist mit dem alten Modell
weggefallen.

| Route                     | Logik                   | Form                     |
| :------------------------ | :---------------------- | :----------------------- |
| `/data/query/node?id=`    | `TypeFreeQueryEndpoint` | `nodes[]` / `contents[]` |
| `/data/query/content?id=` | `TypeFreeQueryEndpoint` | `items[]`                |

Alles andere landet im `FallbackEndpoint` — auch die alten Namen.

## Die Antwortform

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

## Regeln

- **Ids gehen in beiden Fassungen herein.** Eine alte (`000s…`/`000c…`/`000p…`)
  wird über `legacy_id` aufgelöst; zurück kommt die **neue** Id, die alte steht
  als `legacy_id` daneben. Deep-Links von früher bleiben damit gültig.
- **Unbekannt oder nicht sichtbar → `{}`.** Kein 404 — das ist der Ist-Zustand
  der alten Routen und bleibt so.
- **App-Zugehörigkeit wird immer aufgelöst**, auch mit `edit`-Scope. Sie hängt
  am Knoten; ein Inhalt folgt seinem Knoten.
- **`edit`-Scope** (Bearer-JWT) setzt den Publish-Filter aus und übergeht den
  Cache. Er setzt die App-Grenze **nicht** aus.
- **Cache-Schlüsselräume**: `…-nodes-<id>` und `…-contents-<id>`. Der Marker im
  Schlüssel stammt aus der Zeit, in der beide Formen nebeneinander liefen und
  dieselbe Id in zwei Ausprägungen im Cache lag. Er bleibt, weil ein Knoten und
  ein Inhalt sonst über dieselbe Id kollidieren könnten.
