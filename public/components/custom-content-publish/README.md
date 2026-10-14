# custom-content-publish

Veröffentlicht **einen Inhalt** (`content`) in einem eigenen Modal: ein
Icon-Button, ein `slds-modal` ohne Footer, darin `custom-publishing`.

## Übergangslösung

Diese Komponente ist **absichtlich dünn und absichtlich getrennt vom Editor**.

Geplant ist **eine** einheitliche Komponente, die Inhalte _und Listen von
Inhalten_ veröffentlicht. Bis es sie gibt, steht hier ein Platzhalter, der
genau so viel tut wie nötig. Dass das Veröffentlichen **nicht** in
`custom-content-edit` sitzt, ist der ganze Zweck: Die Ablösung ist damit ein
getauschtes Tag in `custom-paragraph` und kein Eingriff in den Editor.

Wer sie ersetzt, braucht nur zwei Dinge zu erhalten:

- Der Auslöser darf nur erscheinen, wenn die Sitzung **beide** Scopes trägt
  (`publish` **und** `edit`).
- Die Ereignisse `published` / `unpublished` müssen die Komponente verlassen
  (`bubbles` + `composed`) — `custom-paragraph` lädt darauf seinen Datensatz
  neu, weil sich `published_date` geändert hat.

## Verwendung

```html
<custom-content-publish
  record-id="00cn00000000000001"
  publish-date="2022-01-01 00:00:00"
></custom-content-publish>
```

Ohne die passenden Scopes rendert die Komponente **nichts** — kein leerer
Rahmen, kein deaktiviertes Icon.

## Attribute

| Attribut       | Typ    | Beschreibung                                                                                                                                        |
| -------------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `record-id`    | String | Id des Inhalts, der veröffentlicht wird.                                                                                                            |
| `publish-date` | String | Aktuelles Veröffentlichungsdatum; leer heißt unveröffentlicht.                                                                                      |
| `object-name`  | String | `content` (Standard) oder `node`. Geht an `custom-publishing` und bestimmt die Überschrift des Modals.                                              |
| `trigger-size` | String | Größe des Auslösers, Standard `x-small` (neben dem Absatz). Leer: die Standardgröße von `slds-button-icon`, wie die übrigen Aktionen eines Knotens. |

## A node, too

With `object-name="node"` the same trigger publishes a node — the node view
(`custom-node-view`) uses it for its own publish action. The modal is then
headed `Knoten veröffentlichen` instead of `Absatz veröffentlichen`. Any other
value falls back to a content, silently, as before the attribute existed. The
scope rule is the same for both.

## Berechtigung

`checkPublishPermission()` verlangt `publish` **und** `edit` — dieselbe Regel,
die `custom-publishing` für seinen Schalter anwendet. Wäre der Auslöser
großzügiger, ginge ein Modal auf, dessen einziger Schalter still deaktiviert
ist.

> Diese Auswertung des `sessionStorage` gibt es im Frontend inzwischen an
> mehreren Stellen. Das ist bekannt und wird gesammelt abgeräumt.

## Methoden

| Methode  | Beschreibung        |
| -------- | ------------------- |
| `show()` | Öffnet das Modal.   |
| `hide()` | Schließt das Modal. |

## Styling

SLDS-Styles kommen über `addGlobalStylesToShadowRoot` aus
`/modules/global-styles.mjs` ins ShadowDOM. Eigene Regeln bringt die Komponente
keine mit.
