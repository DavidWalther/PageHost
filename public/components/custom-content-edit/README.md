# custom-content-edit

Bearbeitet **einen Inhalt** (`content`) in einem Modal. Die Komponente besitzt
den auslösenden Icon-Button _und_ das Modal — dasselbe Muster wie
`custom-chapter-edit`, nur ohne Tabs.

Sie **holt keine Daten**: Der geladene Datensatz wird ihr als Property gereicht.
Gespeichert wird über das `save`-Ereignis, das `public/index.js` an den Endpunkt
bindet.

## Verwendung

```html
<custom-content-edit
  .contentData="${this._paragraphData}"
  @content-updated="${this._handleUpdated}"
  @content-draft-changed="${this._handleDraftChanged}"
></custom-content-edit>
```

Der Auslöser erscheint nur mit dem Scope `edit`; ohne ihn rendert die Komponente
nichts. Von außen lässt sich das Modal über `show()` öffnen.

## Properties

| Property      | Attribut | Typ    | Beschreibung                                                       |
| ------------- | -------- | ------ | ------------------------------------------------------------------ |
| `contentData` | _keines_ | Object | Der geladene Datensatz. Nur als Property setzbar (`.contentData`). |

Erwartet werden die Felder, die `custom-paragraph` aus der Antwort des
`content`-Endpunkts bildet: `id`, `name`, `sortnumber`, `active_type` und je
Fassung ein Feld (`content` für Text, `htmlcontent` für HTML). **Ein Feld, das es
nicht gibt, fehlt** — es ist nicht `null`.

## Aufbau des Modals

Ein durchgehendes Formular, kein Tab-Werk (`size="full"`):

1. **Name** und **Sortierung** (`slds-input`)
2. **Fassung** (`slds-combobox`) — welche Fassung gilt und bearbeitet wird
3. **Ein** Textfeld (`<textarea class="slds-textarea">`) für genau diese Fassung
4. **Entwurfs-Leiste**, abgesetzt: anlegen/aktualisieren und verwerfen
5. Footer: `Abbrechen` und `Speichern`

### Die Fassung wird gewählt, nicht abgeleitet

Früher ergab sich die aktive Fassung daraus, welches Feld zuletzt befüllt war —
wer die HTML-Fassung leerte, kippte den Datensatz still auf `text`. Hier sagt die
Auswahl, welche Fassung gilt. Umschalten ist **Ansehen, nicht Verwerfen**: Der
Inhalt der anderen Fassung bleibt im Formular liegen.

Die Liste der Fassungen ist **fest** (`text`, `html`) und nicht aus den
vorhandenen Items abgeleitet — sonst ließe sich eine Fassung, die es noch nicht
gibt, nie anlegen. Ein neuer Typ ist ein Eintrag in `VERSION_OPTIONS` und
`FIELD_BY_VERSION`.

**Eine leere Fassung wird nicht aktiv.** Wer auf eine Fassung ohne Inhalt
umschaltet und speichert, bekommt die bisherige aktive Fassung zurück — sonst
zeigte der Absatz danach nichts an.

## Entwurf

Ein Entwurf liegt im `localStorage` unter der **Id des Inhalts** und trägt
`draft: true`. Er hat Vorrang: Wer den Editor öffnet, während ein Entwurf liegt,
arbeitet an ihm weiter.

| Aktion                            | Wirkung                                                           |
| --------------------------------- | ----------------------------------------------------------------- |
| `Entwurf anlegen`/`aktualisieren` | schreibt den Formularstand lokal, Modal bleibt offen              |
| `Entwurf verwerfen`               | löscht ihn, das Formular fällt auf den Serverstand zurück         |
| `Speichern`                       | schickt den Formularstand an den Server und räumt den Entwurf weg |

Einen eigenen Knopf zum Übernehmen gibt es deshalb **nicht**: Der Formularstand
_ist_ der Entwurf, also tut `Speichern` genau das.

## Ereignisse

| Ereignis                | `detail`                        | Beschreibung                                               |
| ----------------------- | ------------------------------- | ---------------------------------------------------------- |
| `save`                  | `{ object, payload, callback }` | Speichern-Anfrage, `object: 'content'`. Bubbles, composed. |
| `content-updated`       | `{ contentData }`               | Nach erfolgreichem Speichern, mit dem gespeicherten Stand. |
| `content-draft-changed` | `{ hasDraft }`                  | Wenn ein Entwurf entsteht oder verschwindet.               |
| `toast`                 | `{ message, variant }`          | Rückmeldungen, auch die Validierung.                       |

## Speichern

`Speichern` prüft nur eines: Der **Name** darf nicht leer sein. Schlägt die
Prüfung fehl, gibt es einen Toast und keinen Callout — wie im Vorbild, statt
einer Inline-Meldung im Formular.

Der Payload trägt die Spaltennamen des Datenmodells (`sortnumber`,
`active_type`). **Ein Feld, das es nicht gibt, kommt nicht mit**: Ein
`htmlcontent: null` legte sonst eine leere HTML-Zeile an.

Geht das Speichern schief, **bleibt das Modal offen** und die Eingabe erhalten;
nur ein Erfolg schließt es.

## Methoden

| Methode  | Beschreibung                                                        |
| -------- | ------------------------------------------------------------------- |
| `show()` | Übernimmt `contentData` (bzw. den Entwurf) ins Formular und öffnet. |
| `hide()` | Schließt das Modal.                                                 |

## Styling

SLDS-Styles kommen über `addGlobalStylesToShadowRoot` aus
`/modules/global-styles.mjs` ins ShadowDOM. Die Komponente bringt nur zwei
eigene Regeln mit: `:host { display: inline-block }` und die Trennlinie der
Entwurfs-Leiste.
