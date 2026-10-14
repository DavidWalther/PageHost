# `custom-node`

Stellt **einen Knoten** des Inhaltsbaums dar: seinen Namen, die Auswahl seiner
Kind-Knoten und seine Inhalte.

Ersetzt `custom-story` und `custom-chapter`. Die beiden waren eine Darstellung,
aufgeteilt entlang zweier fester Ebenen — Story zeigt Kapitel zur Auswahl,
Kapitel zeigt Absätze als Inhalt. Das neue Datenmodell kennt diese Ebenen nicht
mehr, und damit auch die Aufteilung nicht.

## Die Daten sagen was, der Consumer sagt wofür

Es gibt **keinen** Modus und **keine** Tiefenangabe. Was ein Knoten überhaupt
zeigen kann, steht in seiner Antwort:

| Antwort des Knotens                  | Darstellung                               |
| :----------------------------------- | :---------------------------------------- |
| `nodes[]` gefüllt, `contents[]` leer | Auswahl der Kinder (wie früher die Story) |
| `nodes[]` leer, `contents[]` gefüllt | Inhalte (wie früher das Kapitel)          |
| beide gefüllt                        | beides, Auswahl oben                      |
| beide leer                           | Hinweis „Keine Inhalte vorhanden"         |

Ein Knoten weiß nicht, ob er einmal eine Story war.

**Wofür** eine einzelne Instanz da ist, weiß er ebenso wenig — das sagt der
Consumer über Attribute (siehe unten). Beides ist nötig und ersetzt einander
nicht.

**Who uses it.** The page no longer does: it shows its node in two components,
`custom-node-view` above for the node itself and `custom-node-contents` below
for its contents. `custom-node` lives on in the feeds (`custom-feed`), one per
tab, without child navigation. Its contents it shows through the very
`custom-node-contents` the page uses below the view.

## Attribute

| Attribut                   | Bedeutung                                                                    |
| :------------------------- | :--------------------------------------------------------------------------- |
| `id`                       | Id des Knotens. Alt (`000s…`/`000c…`) oder neu — das Backend löst beides auf |
| `child-buttons_number-max` | Ab wie vielen Kindern statt Buttons eine Combobox erscheint                  |
| `selected-child`           | Id des hervorgehobenen Kindes                                                |
| `contentnumber`            | `sortnumber` eines Inhalts, zu dem nach dem Laden gesprungen wird            |
| `loading-chunk-size`       | Wie viele Inhalte je Nachlade-Schritt geladen werden (Standard 10)           |

### Wofür diese Instanz da ist

Zwei Familien mit **gegenläufiger Voreinstellung**. Rendering ist an und wird
abgeschaltet (wie `no-load`/`no-display`/`no-footer` im Projekt); ein
schreibender Weg ist aus und wird ausdrücklich gewährt.

| Attribut              | Voreinstellung | Wirkung                                                                                 |
| :-------------------- | :------------- | :-------------------------------------------------------------------------------------- |
| `no-child-navigation` | aus (= zeigen) | Kind-Auswahl (Buttons bzw. Combobox) wird nicht gerendert                               |
| `no-contents`         | aus (= zeigen) | Inhalte **und** der Hinweis „Keine Inhalte vorhanden" entfallen                         |
| `no-title`            | aus (= zeigen) | Der Name des Knotens entfällt; die Aktionen im Kopf bleiben                             |
| `can-create-child`    | aus            | Button „Kind-Knoten anlegen" — **zusätzlich** zu `hasScope('create')`                   |
| `can-create-content`  | aus            | Button „Inhalt anlegen" — **zusätzlich** zu `hasScope('create')`                        |
| `can-delete`          | aus            | „Knoten löschen" (`custom-node-delete`) — **zusätzlich** zu `hasScope('delete')`        |
| `can-move`            | aus            | „Zum Verschieben markieren" (`custom-node-move`) — **zusätzlich** zu `hasScope('edit')` |
| `can-move-root`       | aus            | wie `can-move`, aber nur, solange der Knoten **keinen** Elternknoten hat                |

Die `can-…`-Attribute für schreibende Aktionen ersetzen die Scope-Prüfung
**nicht**, sie kommen davor: Ohne passenden Scope erscheint die Aktion auch mit
gesetztem Attribut nicht — und zwar ganz: Die Leiste bekommt dann auch kein
leeres Element, das als Lücke stehen bliebe.

**Löschen ist eine eigene Komponente.** Mit `can-delete` bettet der Knoten
`custom-node-delete` ein (in der Leiste als `node-delete`). Rückfragen, Anfrage,
Toast und `node-deleted` gehören ihr — dieselbe Aktion steht auch hinter der
Lösch-Kachel des Navigations-Modals. Der Knoten leert sich nur selbst, sobald
seine Aktion `node-deleted` meldet. → `public/components/custom-node-delete/README.md`

**Verschieben ist ebenfalls eine eigene Komponente.** Mit `can-move` bettet der
Knoten `custom-node-move` ein (in der Leiste als `node-move`) und reicht ihr Id,
Name und Elternknoten. Der Knoten selbst markiert nichts: Die Aktion meldet
`node-mark-change`, der Consumer hält die Markierung und gibt jedem Knoten die
Id des markierten über die Property `markedId`; ob das er selbst ist, sagt der
Knoten seiner Aktion. Verschoben wird im Navigations-Modal.
`can-move-root` grants the mark only while the node is a root. It was made for
the upper of the page's two nodes, where a root always stood; no consumer sets
it any more, nor `can-create-child`.
→ `public/components/custom-node-move/README.md`

**`Bearbeiten` und `Teilen` haben bewusst kein Attribut.** Beide Rollen tragen
sie, und ein Attribut, das jeder Consumer setzen müsste, wäre nur Rauschen.
`Bearbeiten` hängt trotzdem am Scope `edit`; `Teilen` erscheint immer.
Kommt eine Rolle dazu, für die das nicht mehr gilt, ist das der Moment, es
nachzuziehen — nicht vorher.

With `no-contents` the node renders no `custom-node-contents` at all, and with
it the mechanism of the contents is gone (loading in chunks, the jump to a
content). Otherwise `contentnumber` would put a list into a waiting state no
content ever ends.

**The contents are `custom-node-contents`.** The node hands its record over
once it has it, `contentnumber` with it — the jump belongs to the list from
then on, the next node does not jump again. While a jump waits, the list hides
behind its progress bar; the card with the name and the actions stays. The add
button in the header adds through the list (`createContent()`), which reports
`content-created`; the node counts the new content for its hint.
→ `public/components/custom-node-contents/README.md`

`no-title` ist für Consumer gedacht, die den Knoten schon an anderer Stelle
benennen — `custom-feed` etwa im Tab. Es nimmt nur den Namen weg, nicht den
Kopf der Karte: Dort stehen auch die Aktionen, und die müssen erreichbar
bleiben.

Der Hinweis „Keine Inhalte vorhanden" richtet sich danach, was **diese
Instanz** rendert, nicht nach den rohen Daten — mit `no-child-navigation`
erscheint er auch dann, wenn der Knoten Kinder hat. An dieser Stelle führt dann
tatsächlich nichts weiter.

## Ereignisse

| Ereignis           | `detail`                              | Anlass                                                                                     |
| :----------------- | :------------------------------------ | :----------------------------------------------------------------------------------------- |
| `navigation`       | `{ type: 'node', value: <id>, node }` | Ein Kind wurde ausgewählt                                                                  |
| `loaded`           | `{ nodeData }`                        | Der Knoten ist geladen                                                                     |
| `node-deleted`     | `{ nodeId, nodeIds }`                 | Der Knoten wurde gelöscht (von `custom-node-delete`, `nodeIds` = er und alles darunter)    |
| `node-mark-change` | `{ marked, node }`                    | Wunsch, diesen Knoten zu markieren oder die Markierung aufzuheben (von `custom-node-move`) |
| `toast`            | `{ message, variant }`                | Rückmeldung an den Nutzer                                                                  |
| `query`            | `{ payload: { object: 'node' } }`     | Datenabruf (beantwortet `index.js`)                                                        |
| `create`           | `{ object: 'content', payload }`      | Neuer Inhalt an diesem Knoten                                                              |

`navigation` meldet `type: 'node'` — nicht `story`/`chapter`. Wer den Ausschnitt
umschaltet, entscheidet der Consumer, nicht der Knoten. Der **ganze Datensatz**
des Kindes kommt unter `node` mit: der Consumer hat ihn sonst nicht und müsste
ihn nachladen, etwa um die alte Id zu kennen.

## Einen geladenen Knoten übergeben

`adoptNode(record)` setzt einen **bereits geladenen** Datensatz, statt ihn
abrufen zu lassen — für einen Consumer, der den Datensatz schon in der Hand hat
und ihn sonst ein zweites Mal holen ließe.

Nach außen verhält es sich wie ein Abruf: `id` wird gesetzt, `loaded` gemeldet,
ein gesetztes `contentnumber` ausgewertet. **Ein Listener auf `loaded` muss
vorher hängen** — das Ereignis kommt sofort, nicht erst nach einer Antwort aus
dem Netz. Ebenso muss `contentnumber` vor dem Aufruf gesetzt sein.

## Einen Knoten neu laden

`reload()` holt den Knoten unter **derselben** Id noch einmal. Die Id erneut zu
setzen bewirkt nichts — der Knoten hat den Datensatz ja schon. Nach einem
Verschieben ist er aber veraltet: anderer Elternknoten, andere Kinder; der
Bearbeiten-Dialog schriebe den alten Elternknoten zurück. Ohne Id passiert nichts.

## Bekannte Altlasten

- Zum Bearbeiten wird weiterhin `custom-chapter-edit` eingebunden, samt seiner
  Feldnamen (`story-id`, `sort-number`). Die Komponente funktioniert unverändert;
  ihre Benennung stammt aber noch aus dem alten Modell.
- Die Inhalte werden von `custom-paragraph` gerendert. Es holt seine Daten über
  `object: 'content'` und damit über den neuen Endpunkt; allein sein Name
  stammt noch aus dem alten Modell. Bearbeitet und veröffentlicht wird dort
  nicht mehr selbst: Das tun `custom-content-edit` und `custom-content-publish`,
  jedes in einem eigenen Modal. → `public/components/custom-paragraph/README.md`

## Ein gelöschter Inhalt

Ein Absatz, der gelöscht wurde, meldet `content-deleted` mit seiner Id. The list
(`custom-node-contents`) takes the content out of its **data**, not out of the
DOM — its container would come back on the next render otherwise —, and the
node does the same with its own record, for the hint below.

Der Absatz entfernt sich **nicht** selbst; er meldet nur. Diese Liste wird von
Lit gerendert, und ein `remove()` von innen bringt deren Buchführung
durcheinander — beim Löschen mitten in der Liste verschwand sonst ein
unbeteiligter Nachbar gleich mit.
Bleibt danach nichts übrig und führt der Knoten auch nirgends weiter, steht dort
der Hinweis `#no-contents`.
