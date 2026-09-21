# custom-paragraph

Stellt **einen Inhalt** dar (`content` im Datenmodell). Die Komponente holt ihren
Datensatz selbst — über ein Ereignis, nicht über einen eigenen Callout — und
zeigt ihn in der Fassung, die der Datensatz als aktiv benennt.

> **Name aus dem alten Modell.** Es gibt keine „Paragraphen" mehr; die Komponente
> arbeitet durchgehend über `object: 'content'` und die neuen Ids. Nur ihr Name
> stammt noch aus der Zeit von `story`/`chapter`/`paragraph`.

## Sie zeigt — sie bearbeitet nicht

Bearbeiten und Veröffentlichen sind **eigene Komponenten mit eigenem Modal**:

- `custom-content-edit` — Name, Sortierung, Fassung und Inhalt
- `custom-content-publish` — Veröffentlichung (Übergangslösung, siehe dort)

`custom-paragraph` bettet beide ein und stellt ihre Auslöser zusammen mit dem
Löschen in eine Leiste. Die Auslöser sind **dauerhaft sichtbar**. Früher standen
sie auf `display: none` und erschienen erst bei `:hover` — auf einem Touchgerät
gab es sie damit gar nicht, und der Rahmen, den der Hover zusätzlich zog, ließ
den Text bei jeder Mausbewegung springen.

Ob ein Auslöser erscheint, entscheidet die Komponente dahinter selbst: Ohne den
passenden Scope rendert sie nichts. `custom-paragraph` prüft nur den Scope für
sein eigenes Löschen.

| Aktion          | Scope              | Wo sie sitzt             |
| --------------- | ------------------ | ------------------------ |
| Bearbeiten      | `edit`             | `custom-content-edit`    |
| Veröffentlichen | `publish` + `edit` | `custom-content-publish` |
| Löschen         | `delete`           | hier                     |

## Verwendung

```html
<custom-paragraph id="00cn00000000000001"></custom-paragraph>
<custom-paragraph id="00cn00000000000002" no-load></custom-paragraph>
```

## Attribute

| Attribut     | Typ     | Beschreibung                                                                                                             |
| ------------ | ------- | ------------------------------------------------------------------------------------------------------------------------ |
| `id`         | String  | Id des Inhalts, zugleich der Schlüssel des lokalen Entwurfs. Ändert sie sich, lädt die Komponente neu (siehe „Löschen“). |
| `no-load`    | Boolean | **Nicht abrufen.** Zeigt einen Platzhalter; `custom-node` nutzt das für verzögertes Laden.                               |
| `no-display` | Boolean | **Nicht zeigen.** Reflektiert; beim Sprung zu einem Inhalt weiter unten.                                                 |

Wird `no-load` zur Laufzeit entfernt, holt die Komponente ihren Inhalt nach.

## Ereignisse

Gefeuert (alle `bubbles` + `composed`):

| Ereignis          | `detail`                | Wann                                           |
| ----------------- | ----------------------- | ---------------------------------------------- |
| `query`           | `{ payload, callback }` | Beim Laden; `payload.object` ist `'content'`.  |
| `loaded`          | `{ paragraphData }`     | Nach der Antwort. `custom-node` zählt darauf.  |
| `content-deleted` | `{ contentId }`         | Nach dem Löschen, **bevor** sie sich entfernt. |
| `toast`           | `{ message, variant }`  | Rückmeldung zum Löschen.                       |

Gehört wird:

| Ereignis                | Quelle                | Wirkung                                       |
| ----------------------- | --------------------- | --------------------------------------------- |
| `published`             | `custom-publishing`   | Datensatz neu abrufen (`published_date`).     |
| `unpublished`           | `custom-publishing`   | dito.                                         |
| `content-updated`       | `custom-content-edit` | Gespeicherten Stand übernehmen, ohne Callout. |
| `content-draft-changed` | `custom-content-edit` | Markierung auffrischen.                       |

## Die angezeigte Fassung

Welche Fassung gilt, **steht im Datensatz** (`active_type`, im Modell
`content_node.active_content_item`). Fehlt der Zeiger, gewinnt die HTML-Fassung,
solange sie gefüllt ist — ein Rückfall für Entwürfe ohne diese Angabe.

- `text` → Name fett, Umbrüche an `\n`
- `html` → das Markup des Datensatzes

`fromContentRecord` übersetzt die Antwort des Endpunkts (eine Liste aller
Repräsentationen) in ein Feld je Fassung. **Ein Feld, das es nicht gibt, kommt
nicht vor** — sonst legte ein `htmlcontent: null` beim Speichern eine leere
HTML-Zeile an.

## Der lokale Entwurf

Ein Entwurf liegt im `localStorage` unter der **Id des Inhalts**. Er gehört dem
Editor (`custom-content-edit` schreibt und löscht ihn), seine **Anzeige** aber
hierher:

- Der Absatz zeigt den Entwurf **statt** des Serverstands — sonst zeigte er etwas
  anderes, als der Editor beim Öffnen anbietet.
- Er markiert sich dabei sichtbar (`#content.hasDraft`, roter Rahmen).

## Löschen

Ruft `deleteParagraph` (`delete-paragraph.api.js`,
`GET /api/1.0/data/delete?object=content&id=…`) nach einer Rückfrage und meldet
dann `content-deleted`.

**Die Komponente nimmt sich nicht selbst aus dem Dokument.** Sie steht in einer
Liste, die `custom-node` mit Lit rendert; ein `remove()` von innen bringt deren
Buchführung durcheinander, und beim nächsten Rendern verschwand ein
unbeteiligter Nachbar gleich mit. Wer die Liste hält, nimmt den Inhalt aus
seinen Daten — das Rendering folgt.

Die Reihenfolge bleibt trotzdem wichtig: Erst melden, dann alles Weitere. Ein
`composed` Ereignis eines bereits entfernten Elements erreicht niemanden mehr.

### Wechselt die `id`, lädt der Absatz neu

Lit setzt Listen ohne Schlüssel über den **Index** zusammen. Fällt ein Inhalt
mitten aus der Liste, werden die vorhandenen Elemente deshalb **neu zugeteilt**
statt verschoben: Dasselbe `<custom-paragraph>` bekommt eine andere `id`.

Die Komponente wirft darauf ihren geladenen Datensatz weg und holt den neuen.
Ohne das zeigte sie weiter den Text ihres Vorgängers — und ihr Editor arbeitete
auf einem Datensatz, der nicht mehr in der Liste steht (beim Speichern ein
Fehler aus dem Backend).

## Styling

SLDS-Styles kommen über `addGlobalStylesToShadowRoot` aus
`/modules/global-styles.mjs` ins ShadowDOM. Eigene Regeln gibt es drei: das
Verstecken bei `no-display`, die Entwurfs-Markierung und die Aktionsleiste.
