# `custom-node`

Stellt **einen Knoten** des Inhaltsbaums dar: seinen Namen, die Auswahl seiner
Kind-Knoten und seine Inhalte.

Ersetzt `custom-story` und `custom-chapter`. Die beiden waren eine Darstellung,
aufgeteilt entlang zweier fester Ebenen — Story zeigt Kapitel zur Auswahl,
Kapitel zeigt Absätze als Inhalt. Das neue Datenmodell kennt diese Ebenen nicht
mehr, und damit auch die Aufteilung nicht.

## Was gezeigt wird, entscheiden die Daten

Es gibt **keinen** Modus und **keine** Tiefenangabe:

| Antwort des Knotens                  | Darstellung                               |
| :----------------------------------- | :---------------------------------------- |
| `nodes[]` gefüllt, `contents[]` leer | Auswahl der Kinder (wie früher die Story) |
| `nodes[]` leer, `contents[]` gefüllt | Inhalte (wie früher das Kapitel)          |
| beide gefüllt                        | beides, Auswahl oben                      |
| beide leer                           | Hinweis „Keine Inhalte vorhanden"         |

Ein Knoten weiß nicht, ob er einmal eine Story war.

## Attribute

| Attribut                   | Bedeutung                                                                    |
| :------------------------- | :--------------------------------------------------------------------------- |
| `id`                       | Id des Knotens. Alt (`000s…`/`000c…`) oder neu — das Backend löst beides auf |
| `child-buttons_number-max` | Ab wie vielen Kindern statt Buttons eine Combobox erscheint                  |
| `selected-child`           | Id des hervorgehobenen Kindes                                                |
| `contentnumber`            | `sortnumber` eines Inhalts, zu dem nach dem Laden gesprungen wird            |
| `loading-chunk-size`       | Wie viele Inhalte je Nachlade-Schritt geladen werden (Standard 10)           |

## Ereignisse

| Ereignis       | `detail`                              | Anlass                              |
| :------------- | :------------------------------------ | :---------------------------------- |
| `navigation`   | `{ type: 'node', value: <id>, node }` | Ein Kind wurde ausgewählt           |
| `loaded`       | `{ nodeData }`                        | Der Knoten ist geladen              |
| `node-deleted` | `{ nodeId }`                          | Der Knoten wurde gelöscht           |
| `toast`        | `{ message, variant }`                | Rückmeldung an den Nutzer           |
| `query`        | `{ payload: { object: 'node' } }`     | Datenabruf (beantwortet `index.js`) |
| `create`       | `{ object: 'content', payload }`      | Neuer Inhalt an diesem Knoten       |

`navigation` meldet `type: 'node'` — nicht `story`/`chapter`. Wer den Ausschnitt
umschaltet, entscheidet der Consumer, nicht der Knoten. Der **ganze Datensatz**
des Kindes kommt unter `node` mit: der Consumer hat ihn sonst nicht und müsste
ihn nachladen, etwa um die alte Id zu kennen.

## Einen geladenen Knoten übergeben

`adoptNode(record)` setzt einen **bereits geladenen** Datensatz, statt ihn
abrufen zu lassen. Gebraucht beim Einstieg: `bookstore.resolveEntryPoint` löst
ohnehin auf, was hinter einer Id steckt — ohne die Übergabe holte der Knoten
genau das noch einmal.

Nach außen verhält es sich wie ein Abruf: `id` wird gesetzt, `loaded` gemeldet,
ein gesetztes `contentnumber` ausgewertet. **Ein Listener auf `loaded` muss
vorher hängen** — das Ereignis kommt sofort, nicht erst nach einer Antwort aus
dem Netz. Ebenso muss `contentnumber` vor dem Aufruf gesetzt sein.

## Bekannte Altlasten

- Zum Bearbeiten wird weiterhin `custom-chapter-edit` eingebunden, samt seiner
  Feldnamen (`story-id`, `sort-number`). Die Komponente funktioniert unverändert;
  ihre Benennung stammt aber noch aus dem alten Modell.
- Die Inhalte werden von `custom-paragraph` gerendert, das seine Daten weiterhin
  über `object: 'paragraph'` holt. Das trägt, weil der alte Endpunkt Ids in
  **beiden** Formen auflöst.
