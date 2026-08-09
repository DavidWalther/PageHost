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
nicht: Der `bookstore` stellt zwei Instanzen übereinander, oben die Auswahl,
unten den gewählten Knoten. Ohne diese Angabe böte die obere Instanz Aktionen
an, die an ihrer Stelle ins Leere führen — etwa das Löschen des Knotens, an dem
die ganze Auswahl hängt.

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

| Attribut              | Voreinstellung | Wirkung                                                          |
| :-------------------- | :------------- | :--------------------------------------------------------------- |
| `no-child-navigation` | aus (= zeigen) | Kind-Auswahl (Buttons bzw. Combobox) wird nicht gerendert        |
| `no-contents`         | aus (= zeigen) | Inhalte **und** der Hinweis „Keine Inhalte vorhanden" entfallen  |
| `can-create-child`    | aus            | Button „Kind-Knoten anlegen"                                     |
| `can-create-content`  | aus            | Button „Inhalt anlegen" — **zusätzlich** zu `hasScope('create')` |
| `can-delete`          | aus            | Button „Knoten löschen" — **zusätzlich** zu `hasScope('delete')` |

Die beiden `can-…`-Attribute für schreibende Aktionen ersetzen die
Scope-Prüfung **nicht**, sie kommen davor: Ohne Sitzung erscheint der Button
auch mit gesetztem Attribut nicht.

**`Bearbeiten` und `Teilen` haben bewusst kein Attribut.** Beide Rollen tragen
sie, und ein Attribut, das jeder Consumer setzen müsste, wäre nur Rauschen.
Kommt eine Rolle dazu, für die das nicht mehr gilt, ist das der Moment, es
nachzuziehen — nicht vorher.

Mit `no-contents` wird auch die Inhalts-Mechanik stillgelegt (Nachladen per
`IntersectionObserver`, Sprung zu einem Inhalt). Sonst würde `contentnumber`
den Knoten in den Wartezustand versetzen, aus dem ihn nichts mehr holt: Es lädt
kein Inhalt, der das Zählwerk weiterdreht.

Der Hinweis „Keine Inhalte vorhanden" richtet sich danach, was **diese
Instanz** rendert, nicht nach den rohen Daten — mit `no-child-navigation`
erscheint er auch dann, wenn der Knoten Kinder hat. An dieser Stelle führt dann
tatsächlich nichts weiter.

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
- Die Inhalte werden von `custom-paragraph` gerendert. Es holt seine Daten über
  `object: 'content'` und damit über den neuen Endpunkt; allein sein Name
  stammt noch aus dem alten Modell.
