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

1. **Name**, **Sortierung** und **Fassung** in einer Zeile (`slds-input`,
   `slds-combobox`) — ab `medium` nebeneinander, darunter umbrechend
2. **Ein** Textfeld (`<textarea class="slds-textarea">`) für genau diese
   Fassung, daneben der Schalter für den Zeilenumbruch
3. **Entwurfs-Leiste**, abgesetzt: anlegen/aktualisieren und verwerfen
4. Footer: `Abbrechen` und `Speichern`

Die **Anordnung** macht durchgehend `slds-layout` / `slds-layout-item` — auch die
Spalte im Modal (`vertical`, Hauptachse senkrecht), in der das Textfeld zwischen
seinen `grow-none`-Nachbarn wächst. Abstände, Trennlinie und Textfarben kommen
als SLDS-Utilities ans Markup. Eigenes CSS gibt es nur für **Maße**, die das
Raster nicht ausdrücken kann (siehe unten); Klassen landen nie an einem
Layout-Host, die gehören der Komponente (`layout-classlist-contract.spec.js`).

### Die Fassung wird gewählt, nicht abgeleitet

Früher ergab sich die aktive Fassung daraus, welches Feld zuletzt befüllt war —
wer die HTML-Fassung leerte, kippte den Datensatz still auf `text`. Hier sagt die
Auswahl, welche Fassung gilt. Umschalten ist **Ansehen, nicht Verwerfen**: Der
Inhalt der anderen Fassung bleibt im Formular liegen.

Die Liste der Fassungen ist **fest** (`text`, `html`) und nicht aus den
vorhandenen Items abgeleitet — sonst ließe sich eine Fassung, die es noch nicht
gibt, nie anlegen. Ein neuer Typ ist ein Eintrag in `VERSION_OPTIONS` und
`FIELD_BY_VERSION`.

**„Gibt es nicht" ist nicht dasselbe wie „ist leer".** Der Zeiger des Modells
(`content_node.active_content_item`) zeigt auf ein `content_item` — ein
vorhandenes, leeres Item hat eine Id, eine nicht vorhandene Fassung nicht.

- Eine **vorhandene** Fassung wird aktiv, auch wenn sie leer ist. Sie geht dafür
  im Payload mit (als `null`): Der Schreibpfad nimmt die gewählte Fassung nur
  an, wenn der Payload sie mitbringt — sonst bliebe der Zeiger stehen und das
  Umschalten verpuffte.
- Eine Fassung, die es **nicht gibt**, wird nicht aktiv; es bleibt bei der
  bisherigen. Das wird als Toast gesagt, statt still zu geschehen. Wer die neue
  Fassung befüllt, legt sie damit an — und macht sie aktiv.

## Platz für den Text

Das Textfeld bekommt, was im Modal übrig ist — es steht **nicht** auf einer
festen Zeilenzahl. Dafür sorgt die senkrechte `slds-layout`-Spalte: Ihre
Hauptachse läuft von oben nach unten, Formularzeile, Kopfzeile und
Entwurfs-Leiste sind `grow-none`, und das Feld dazwischen nimmt den Rest
(`.slds-col` ist `flex: 1 1 auto`).

### Warum es trotzdem noch CSS gibt

Das SLDS-Raster **ordnet** an — es sagt nicht, **wie hoch** etwas ist. Drei
Dinge kann es deshalb nicht ausdrücken:

1. **Die Spalte braucht eine Höhe.** Eine Flex-Spalte verteilt nur Platz, den
   sie hat; ohne Höhe wäre sie so hoch wie ihr Inhalt und hätte nichts zu
   verteilen. SLDS v1 kennt dafür keine Utility — ein `slds-height_full` gibt es
   nicht (nachgesehen im ausgelieferten Stylesheet).
2. **`min-height: 0`.** Flexbox setzt für Glieder `min-height: auto`; damit
   weigert sich ein Glied, unter seinen Inhalt zu schrumpfen. Die Spalte wüchse
   mit dem Text, statt ihn scrollen zu lassen.
3. **Die Mindesthöhe des Felds** ist eine Produktfrage, keine Rasterfrage.

Nummer 3 braucht es, weil das Modal zwei Gestalten hat: Unter 30em ist es ein
Vollbild-Grid, dessen Inhaltsbereich eine aufgelöste Höhe hat — dort dehnt sich
das Feld auf den ganzen Rest. Darüber richtet sich der Inhaltsbereich nach
seinem Inhalt; ein Prozentwert hätte nichts, worauf er sich beziehen könnte, und
gemessen fiel das Feld dort auf seine Mindesthöhe zurück. Die ist deshalb am
Fenster bemessen (`min-height: max(8rem, 40vh)`).

Alles andere ist im Markup: Abstände, Trennlinie und Textfarben als
SLDS-Utilities, die Breite des Felds von `slds-textarea` selbst. Wer mehr Platz
braucht, zieht das Feld auf (`resize: vertical`).

## Zeilenumbruch abschalten

Neben der Beschriftung des Textfelds sitzt ein Schalter. Aus heißt: lange Zeilen
laufen nach rechts weiter und werden gescrollt, statt weich umzubrechen — bei
Markup und langen Datenzeilen verdeckt der Umbruch sonst die Struktur.

Der Schalter ist eine **Ansichtssache**: Am gespeicherten Text ändert er nichts.
Umgesetzt ist er über `white-space: pre` und nicht über das `wrap`-Attribut —
ein Wechsel von `wrap` an einem bestehenden Textfeld greift nicht zuverlässig,
und `wrap="hard"` würde echte Umbrüche in den gespeicherten Wert schreiben.

Er merkt sich nichts: Jedes Öffnen beginnt wieder mit Umbruch.

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
`/modules/global-styles.mjs` ins ShadowDOM. Die Komponente bringt **vier**
eigene Regeln mit, und alle vier sind Maße oder Verhalten, keine Anordnung:
die Höhe der Spalte, das Schrumpfen ihrer Glieder, die Mindesthöhe des
Textfelds und der abgeschaltete Zeilenumbruch — siehe „Platz für den Text“.
