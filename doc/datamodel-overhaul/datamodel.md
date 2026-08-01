# Ziel-Datenmodell: Hierarchischer Content + zentrale Sichtbarkeit

> **Status: KONZEPT — noch nicht implementiert.** Beschreibt das geplante
> Ziel-Modell, nicht den laufenden Stand (der steht in `doc/architecture.md`).

## 1. Ziel

Die heutigen Tabellen `story`, `chapter` und `paragraph` werden durch ein
**hierarchisches, rekursives Content-Modell** abgelöst. Zwei Motive:

1. **Hierarchie vereinheitlichen.** Story und Chapter sind heute zwei feste
   Ebenen. Künftig sind beide `node`-Datensätze in **einem** Baum (Selbstbezug
   über `parent_node_id`) — das erlaubt beliebige Verschachtelung statt genau
   zwei Ebenen.
2. **Sichtbarkeit zentralisieren.** Die Berechnung „was ist sichtbar?" wird zu
   **einer** Regel über die `node`-Kette (siehe Abschnitt 4), statt verteilt in
   Filtern/Spalten zu leben.

## 2. Ablösung: Mapping alt → neu

| Alt (heute)                         | Neu (Ziel)                                   | Bemerkung                                                                                                                                               |
| :---------------------------------- | :------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `story` + `chapter`                 | `node`                                       | Beide Ebenen werden Knoten im selben rekursiven Baum (`parent_node_id`) — **ohne** Typunterscheidung (Abschnitt 3).                                     |
| `story.coverid`, `chapter.reversed` | `node.cover_node_id`, `node.reversed`        | Typspezifische Felder werden optionale Eigenschaften **jedes** Knotens (nullable).                                                                      |
| `story.description`                 | `node.description`                           | Existiert heute nur physisch — keine `tableFields`-Eintragung, wird vom Backend nie selektiert. Wird mitgenommen, damit die Daten nicht verloren gehen. |
| `paragraph`                         | `content_node`                               | Content-Halter, hängt an genau einem `node`.                                                                                                            |
| Spalten `content`/`htmlcontent`     | `content_item` (mehrere Zeilen)              | Eine Zeile je Repräsentation statt zwei feste Spalten — erweiterbar (z. B. `markdown`, `mermaid`).                                                      |
| „html gewinnt, wenn gefüllt"        | `content_node.active_content_item`           | Die bisher **implizite** Auswahl wird ein **expliziter** Zeiger auf die aktive Repräsentation.                                                          |
| `included`/`excluded` (pro App)     | `app_node` (`relation`+Wildcard, nur `node`) | App-Zugehörigkeit nur auf `node`-Ebene; `content_node` app-frei. Auflösung + Herleitung: Abschnitte 5 und 8.                                            |

## 3. Tabellen (konzeptionell)

- **`app`** — eine Anwendung. Mehrere Apps sind gleichzeitig produktiv aktiv.
- **`node`** — Knoten im Inhaltsbaum (ersetzt `story` + `chapter`). Trägt
  `parent_node_id` (Selbstbezug), `published_date`, `is_parent_controls_visibility`
  und `sortnumber` (Geschwister-Reihenfolge). Dazu die beiden bisher
  typspezifischen Felder als **optionale** Eigenschaften: `cover_node_id`
  (heute `story.coverid`), `reversed` (heute `chapter.reversed`) und
  `description` (heute `story.description`).
- **`app_node`** — M:N-Verknüpfung `app` ↔ `node` mit `relation`
  (`include`/`exclude`) und Wildcard (`app_id IS NULL`). Ersetzt die heutige
  `included`/`excluded`-Logik — **nur auf `node`-Ebene** (Details: Abschnitt 5).
- **`content_node`** — Content-Halter (ersetzt `paragraph`). Hängt an genau einem
  `node`, trägt `published_date`, `sortnumber` und `active_content_item`.
  **Kein** `is_parent_controls_visibility` — die Sichtbarkeit wird immer vom
  zugehörigen `node` kontrolliert.
- **`content_item`** — konkrete Repräsentation des Inhalts (`content` + `type`).
  Ersetzt die Spalten `content`/`htmlcontent`. Mehrere Items je `content_node`
  möglich (je `type` eines); welches gilt, bestimmt `content_node.active_content_item`.
  **Keine eigene Sichtbarkeits-/Publish-Spalte** — reiner Payload.

### Knoten sind typfrei (entschieden)

Ein `node` trägt **keine** `type`/`level`-Spalte. Es gibt im Zielmodell keinen
Unterschied zwischen „Story" und „Kapitel" — nur Knoten, deren Darstellung sich
aus Tiefe und Kontext ergibt. `cover_node_id` und `reversed` sind damit keine
Typmerkmale, sondern optionale Eigenschaften jedes Knotens.

Verworfen wurden: eine explizite `type`-Spalte (hätte den Typ konserviert, aber
den ganzen Sinn des rekursiven Baums verwässert) und die Ableitung aus der
Baumposition („Wurzel = story"), die nur bei genau zwei Ebenen trägt und die
angestrebte beliebige Verschachtelung faktisch wieder einfriert.

**Konsequenzen im Code** (nicht Teil dieses Dokuments, aber durch die
Entscheidung erzwungen):

- Das Frontend leitet den Record-Typ heute aus dem **Id-Präfix** ab
  (`000s`/`000c`/`000p` → story/chapter/paragraph, `bookstore.js`,
  `createInitializationParameterObject`) und schaltet darüber den Init-Modus.
  Diese Typisierung entfällt.
- `custom-story` und `custom-chapter` sind heute zwei Komponenten für zwei feste
  Ebenen. Mit typfreien Knoten müssen sie zu einer knoten-Darstellung
  zusammengeführt oder über Tiefe/Kontext parametrisiert werden.
- Deep-Links auf bestehende `000s…`/`000c…`/`000p…`-Ids bleiben trotzdem
  funktional: die Migration legt Referenzen `story → node`, `chapter → node`
  und `paragraph → content_node` an, über die eine alte Id auf den neuen
  Datensatz aufgelöst wird. Form: **Spalte `legacy_id`** je Zieltabelle
  (entschieden, Abschnitt 8).

### Löschverhalten (`ON DELETE`) — entschieden: durchgängig `RESTRICT`

**Keine** Fremdschlüsselbeziehung kaskadiert. Gelöscht wird strikt **bottom-up**;
die Datenbank verweigert jedes Löschen, das etwas verwaisen ließe.

Damit ist ausgeschlossen, dass ein einzelnes `DELETE … WHERE id = …` still einen
ganzen Subtree mitnimmt. Der Preis: der Schreibpfad muss das mehrstufige Löschen
selbst orchestrieren — heute existiert das nicht (`ActionDelete` setzt ein
einstufiges `DELETE FROM {tablename} WHERE id = '{recordId}'` ab, und zwischen
`story`/`chapter`/`paragraph` gibt es überhaupt keine FK-Constraints, verwaiste
Absätze entstehen also unbemerkt).

Nötige Löschreihenfolge:

| Ziel           | Reihenfolge                                                                                                           |
| :------------- | :-------------------------------------------------------------------------------------------------------------------- |
| `content_item` | `content_node.active_content_item` auf `NULL` setzen bzw. umbiegen → dann löschen                                     |
| `content_node` | `active_content_item` auf `NULL` → alle `content_item` löschen → `content_node` löschen                               |
| `node`         | alle `content_node` (wie oben) → alle Kind-`node` rekursiv von unten → `app_node`-Zeilen des Knotens → `node` löschen |
| `app`          | alle `app_node`-Zeilen der App → `app` löschen                                                                        |

Der zirkuläre Zeiger `content_node ↔ content_item` ist der Grund, warum das
Nullen von `active_content_item` immer der erste Schritt ist: unter `RESTRICT`
blockiert der Zeiger das Löschen des Items, auf das er zeigt.

Postgres-Detail dazu: `DEFERRABLE INITIALLY DEFERRED` verschiebt nur die
Existenzprüfung beim `INSERT`/`UPDATE` — `ON DELETE RESTRICT` ist **nicht**
aufschiebbar und greift sofort. Wer Löschen und Nullen in derselben Transaktion
in beliebiger Reihenfolge erlauben will, nimmt für genau diese Spalte
`ON DELETE NO ACTION`: blockiert genauso, wird aber erst beim `COMMIT` geprüft.

### Zyklen im Baum — entschieden: doppelt abgesichert

`parent_node_id` ist ein Selbstbezug; ein Zyklus (`A → B → A`) ist damit
darstellbar und von der Datenbank **nicht** per Constraint verhinderbar — ein
`CHECK` sieht nur die eigene Zeile. Abgesichert wird deshalb an **beiden** Enden:

1. **Schreibpfad — Vorbeugung.** Ein Zyklus kann nur entstehen, wenn
   `parent_node_id` gesetzt oder umgehängt wird. Genau dort wird geprüft: der
   künftige Parent darf weder der Knoten selbst sein noch in dessen Subtree
   liegen. Geprüft wird **aufwärts** vom künftigen Parent — trifft die Kette auf
   den Knoten, wird abgelehnt. Das läuft über eine Vorfahrenkette statt über den
   ganzen Subtree und ist damit die billigere Richtung.
2. **Lesepfad — Schadensbegrenzung.** Jede rekursive CTE über den Baum führt ein
   `path`-Array mit und bricht mit `WHERE NOT c.id = ANY(t.path)` ab (Form im
   Setup-Skript). Ohne diesen Schutz wird ein Zyklus — gleich welcher Herkunft —
   zur Endlosschleife in einem **öffentlich erreichbaren** Lesepfad.

Keins der beiden ersetzt das andere: Der `path`-Guard verhindert die Schleife,
aber nicht die kaputten Daten — ein Zyklus hängt seinen Teilbaum still von der
Wurzel ab, der Inhalt verschwindet ohne Fehlermeldung. Und die Schreibpfad-Prüfung
deckt nur den Weg über die Anwendung ab; von Hand per `psql` wird ebenfalls
geschrieben (die Migration selbst ist so gelaufen).

**Kein** DB-Trigger für die Prüfung: er bräuchte dieselbe rekursive Abfrage ein
zweites Mal in PL/pgSQL. Bei einem Schreibweg lohnt die Doppelung nicht — sie
lässt sich später additiv nachrüsten, wenn es mehrere werden.

## 4. Sichtbarkeitsmodell (Kern)

Sichtbarkeit vererbt sich die `node`-Kette hinunter. `published_date` ist ein
**eigenständiges Tor auf jeder Ebene**: ein Knoten kann zur App gehören und/oder
vom Parent kontrolliert sein — ist er nicht veröffentlicht, bleibt er trotzdem
unsichtbar. `is_parent_controls_visibility` erlaubt, die Kette gezielt zu
**durchbrechen** (Exclude).

### Wahrheitstabelle je `node` (für eine App A)

| `published_date` | `is_parent_controls_visibility` | sichtbar?                                                                     |
| :--------------- | :------------------------------ | :---------------------------------------------------------------------------- |
| leer             | egal                            | **nein** (Publish-Tor)                                                        |
| gesetzt          | `true`                          | ⟺ Parent-`node` im App-Baum sichtbar                                          |
| gesetzt          | `false`                         | ⟺ Knoten hat `app_node`-`include` für A (spezifisch/Wildcard); sonst **raus** |

### Regeln in Worten

- **`app_node`** definiert Zugehörigkeit **und** Ausschluss je `(app, node)` —
  `include`/`exclude` + Wildcard (Auflösungsregel: Abschnitt 5).
- **`is_parent_controls_visibility = true`** → Zugehörigkeit/Sichtbarkeit erbt
  sich die Kette hinunter (Kind reitet auf dem Parent mit).
- **`is_parent_controls_visibility = false`** → Kette durchbrechen: der Knoten und
  der von ihm erbende Teil des Subtrees fallen heraus, **es sei denn**, der Knoten
  ist selbst per `app_node` verankert → das ist der **Exclude**.
- **`published_date`** wirkt **quer** dazu: immer erforderlich, sonst unsichtbar.

### Default für neue Knoten: `true` (entschieden)

Ein neu angelegter Knoten bekommt `is_parent_controls_visibility = true`.
Vererbung ist der Normalfall; `false` ist die Ausnahme und bedeutet „die Kette
bewusst durchbrechen".

**Die migrierten Bestandsknoten weichen davon bewusst ab** — sie tragen
durchgehend `false` plus eigene `app_node`-Zeilen. Grund: das Altmodell kennt
keine Vererbung, dort trägt jede Zeile ihre eigenen App-Spalten. `false` + eigene
Zeilen ist die wörtliche, zeilenweise prüfbare Übersetzung davon; `true` wäre
eine Verhaltensänderung, die sich in einer Kopie nicht mehr von einem Fehler
unterscheiden ließe.

Die Umstellung der Bestandsknoten auf Vererbung ist deshalb ein **eigener
Schritt**, und er muss erfolgen, **solange die alten Tabellen noch stehen** —
danach fehlt die Referenz, gegen die sich das Ergebnis prüfen lässt. Dabei fallen
nur `include`-Zeilen weg: `exclude` wirkt unabhängig vom Flag (Auflösungsregel in
Abschnitt 5). Der reale Fall „Story überall sichtbar, ein Kapitel für App X
ausgenommen" ist danach `true` **plus** `exclude`-Zeile.

### `content_node`

> `content_node` sichtbar ⟺ eigenes `published_date` gesetzt **und** zugehöriger
> `node` sichtbar. Welche Repräsentation angezeigt wird, bestimmt
> `active_content_item`; das `content_item` selbst hat keine eigene Sichtbarkeit.

### Verhältnis zum `ContentVisibilityFilter`

Das Modell bleibt kompatibel zum bestehenden Ansatz (voller Baum im Cache,
Publish-Filter erst bei der Auslieferung, damit dieselbe Quelle z. B. auch für
`sitemap.xml` nutzbar ist) — **solange** die Rohdaten
(`published_date`, `is_parent_controls_visibility`, `app_node`) im Cache landen
und die Sichtbarkeit erst bei der Auslieferung berechnet wird, nicht schon in der
Query weggefiltert.

## 5. App-Zugehörigkeit (`app_node`)

Entscheidung nach Analyse des heutigen `applicationincluded`/`applicationexcluded`
(Abschnitt 8): App-Zugehörigkeit wird **ausschließlich auf `node`-Ebene** modelliert.
`content_node` bekommt **keine** eigene App-Zugehörigkeit und folgt seinem `node`
(Herleitung in Abschnitt 8).

### `app.name` ist der App-Schlüssel (entschieden)

`app.name` trägt den Wert aus **`APPLICATION_APPLICATION_KEY`** — es ist der
Lookup-Schlüssel der App, **kein Anzeigename**. Daher `UNIQUE NOT NULL`, und ein
Umbenennen ist eine **Migration** (Env-Dateien, Cache-Präfixe), kein Edit. Eine
zusätzliche Spalte für den Env-Schlüssel gibt es bewusst nicht; ein separates
Anzeige-Label kann später additiv ergänzt werden, wenn es gebraucht wird — das
Altmodell hat ebenfalls keins.

Damit trägt das Modell mehrere Apps in **einer** Datenbank. Dass heute nur eine
App pro Serverinstanz bedient wird, liegt allein an der prozessweiten Herkunft
des Schlüssels (`APPLICATION_APPLICATION_KEY`, ebenso `CACHE_KEY_PREFIX`) — nicht
am Datenmodell. Lesecode sollte den Schlüssel deshalb als Parameter bekommen,
statt ihn selbst aus der Umgebung zu lesen.

`app_node` ist **M:N** und trägt dafür zwei Zusätze:

- **Relationstyp** `relation IN ('include', 'exclude')` — eine Zeile drückt
  Zugehörigkeit **oder** Ausschluss aus (ersetzt die getrennten Spalten
  `applicationincluded`/`applicationexcluded`).
- **Wildcard** über `app_id IS NULL` — eine Zeile ohne App-Bezug gilt für **alle**
  Apps (auch künftige) und löst die heutige `'*'`-Konvention ab.

| `app_node`-Zeile            | Bedeutung                    |
| :-------------------------- | :--------------------------- |
| `include`, `app_id = K`     | Knoten in App K enthalten    |
| `include`, `app_id IS NULL` | in **allen** Apps (`'*'`)    |
| `exclude`, `app_id = K`     | aus App K ausgenommen        |
| `exclude`, `app_id IS NULL` | überall ausgenommen (selten) |

**Auflösungsregel** (deckt sich mit dem heutigen SQL, Abschnitt 8):

> `member(node, K)` ⟺
> (`include` für K **oder** `include`-Wildcard **oder**
> (`is_parent_controls_visibility` **und** `member(parent, K)`))
> **und nicht** (`exclude` für K **oder** `exclude`-Wildcard).
>
> Kurz: **spezifisch schlägt Wildcard, `exclude` schlägt `include`.**

Damit ist der reale Produktivfall abgedeckt — Story mit `include`-Wildcard, ein
einzelnes Kapitel zusätzlich mit `exclude` für App X — **ohne** globales Flag: der
per-App-Ausschluss lebt als `(app, node)`-Zeile, `is_parent_controls_visibility`
bleibt der Vererbungs-Default.

## 6. Sortierung

- **`sortnumber`** auf **`node`** (Reihenfolge der Geschwister-Knoten, z. B.
  Kapitel innerhalb einer Story) und auf **`content_node`** (Reihenfolge der
  Content-Halter innerhalb eines Knotens).
- **Kein** `sortnumber` auf `content_item` — die aktive Repräsentation wählt
  `active_content_item`, eine Ordnung unter den Items ist nicht nötig.
- Bewusst getrennt von `published_date` und `recordnumber`: die Ordnung muss
  **unabhängig von der Veröffentlichung** und umsortierbar sein.

## 7. Content-Repräsentationen & `active_content_item`

- Ein `content_node` kann mehrere `content_item`-Zeilen haben, je eine pro `type`
  (`text`, `html`, künftig `markdown`, `mermaid`, …).
- `active_content_item` zeigt **explizit** auf die aktive Repräsentation. Das löst
  das heutige implizite „html wird angezeigt, sobald `htmlcontent` gefüllt ist" ab
  und macht künftige Typen ohne Schema-Änderung möglich.
- **Versionierung ist derzeit nicht geplant** (YAGNI). Ausbaupfad: eine Spalte
  `version_number` auf `content_item`; dann wird aus `UNIQUE(content_node_id, type)`
  ein `UNIQUE(content_node_id, type, version_number)`, und `active_content_item`
  zeigt weiterhin auf die Live-Fassung. Kein Bruch.

## 8. Migrations-Hinweise

Der Umstieg muss das heutige Verhalten **verlustfrei** abbilden:

- **`content`/`htmlcontent` → `content_item`:** pro `paragraph` eine Zeile
  `type='text'` aus `content`, und — nur falls gefüllt — eine Zeile `type='html'`
  aus `htmlcontent`.
- **`active_content_item`:** zeigt auf die `html`-Zeile, falls `htmlcontent`
  gefüllt war, sonst auf die `text`-Zeile. Das reproduziert „implizit html, sobald
  vorhanden" exakt und macht es ab dann explizit umschaltbar.
- **`story`/`chapter` → `node`:** Story-Knoten werden Wurzeln (Verknüpfung über
  `app_node`), Kapitel deren Kinder (`parent_node_id`). Reihenfolge → `sortnumber`.
  Ein Typmerkmal wandert **nicht** mit (Abschnitt 3).
- **Typspezifische Felder:** `story.coverid` → `node.cover_node_id`,
  `chapter.reversed` → `node.reversed`; jeweils `NULL` für Knoten, die das Feld
  nicht führen.
- **Deep-Link-Referenzen:** die Migration legt `story → node`, `chapter → node`
  und `paragraph → content_node` als auflösbare Referenz an, damit bestehende
  `000s…`/`000c…`/`000p…`-URLs weiterhin funktionieren. Form und Lebensdauer
  stehen im folgenden Abschnitt.
- **`LastUpdate` entfällt:** die Spalte existiert heute auf `story`, `chapter`
  und `paragraph`, wird aber **nirgends gelesen** (nur Tabellen-Definitionen und
  Test-SQL). Sie wird nicht übernommen.
- **`included`/`excluded` → `app_node` (`relation` + Wildcard) auf `node`-Ebene:**
  Herleitung in der Ist-Analyse unten; `content_node` erhält **keine** App-Zugehörigkeit.

### `legacy_id` ist verbindlich (entschieden)

Die Auflösung alter Ids läuft über eine **Spalte `legacy_id varchar(18) UNIQUE`**
auf `node` und `content_node` — **keine** eigene Mapping-Tabelle. Die Zuordnung
ist 1:1 und wird nur in **einer** Richtung gelesen (alte Id → neuer Satz); eine
eigene Tabelle wäre ein Join mehr ohne zusätzliche Aussage, und das `UNIQUE`
erzwingt genau die Eindeutigkeit, die dort erst als Constraint nachgebaut werden
müsste.

- **Eingehend:** `000s…`/`000c…` treffen `node.legacy_id`, `000p…` trifft
  `content_node.legacy_id`.
- **Ausgehend** liefert die Kompat-Schicht weiterhin die **alte** Id, solange
  eine vorhanden ist. Daran hängen Deep-Links, Cache-Keys und die
  Präfix-Typisierung im Frontend.

#### Kompat-Id-Vergabe für Neuanlagen

Ein **nach** der Umstellung angelegter Datensatz hat naturgemäß keine
`legacy_id`. Das ist kein Randfall: der Schreibpfad wechselt vor dem
Frontend-Umbau auf das neue Modell, und ein Frontend, das den Record-Typ aus dem
Id-Präfix ableitet, kann mit einer `000n…`-Id nichts anfangen — nicht nur der
Deep-Link, der ganze Init-Weg bricht. Solange die Kompat-Schicht lebt, vergibt
der Schreibpfad deshalb **zusätzlich** eine `legacy_id` im alten Präfix-Schema:

| Neuer Satz                          | Präfix |
| :---------------------------------- | :----- |
| `node` mit `parent_node_id IS NULL` | `000s` |
| `node` mit Parent                   | `000c` |
| `content_node`                      | `000p` |

Gebildet wie `generate_custom_id`, nur mit dem alten Präfix. Die Nummer kommt
**nicht** aus `recordnumber` der neuen Zeile — die Nummernkreise der alten
Tabellen sind bereits vergeben, es gäbe Kollisionen. Stattdessen zählt je Präfix
eine eigene Sequenz weiter, die beim Maximum der jeweiligen Alt-Tabelle startet.
Das `UNIQUE` auf `legacy_id` fängt einen Fehler dabei hart ab, statt ihn stillen
Deep-Link-Verwechslungen zu überlassen.

**Lebensdauer:** Die Vergabe endet mit dem Frontend-Umbau — sobald die Ids nicht
mehr am Präfix typisiert werden, geht die neue Id nach außen. Die **Spalte**
bleibt darüber hinaus bestehen: nach dem Wegfall der alten Tabellen ist sie der
einzige verbliebene Ort, an dem eine alte Id noch auflösbar ist. Sie kostet eine
Spalte und einen Unique-Index.

### Ist-Analyse: heutiges `applicationincluded`/`applicationexcluded`

Quelle: `private/database2/DataStorage/actions/get.js`
(`getLeftTableApplicationKey` / `getRightTableApplicationKey`), Spalten auf
`story`, `chapter`, `paragraph` (je `applicationincluded`, `applicationexcluded`).

Pro Zeile und App-Key `K` gilt als App-Filter (in `WHERE` für die linke, in der
`JOIN`-Bedingung für die rechte Tabelle):

```sql
(applicationIncluded LIKE '%K%' OR applicationIncluded = '*')
AND (applicationExcluded IS NULL OR applicationExcluded NOT LIKE '%K%')
```

Eigenschaften:

- **Zwei Listen pro Zeile:** `applicationincluded` (Positiv-Liste; `'*'` = **alle**
  Apps, auch künftige) **und** `applicationexcluded` (Negativ-Ausnahme).
- **Pro Ebene unabhängig, KEINE Vererbung.** Story, Kapitel und Absatz werden
  jeweils an ihren **eigenen** Spalten gefiltert. Genau deshalb ist der
  Produktiv-Fall möglich: **Story `'*'` (in allen Apps), einzelnes Kapitel per
  `applicationexcluded` aus einer bestimmten App ausgenommen** — die anderen
  Kapitel derselben Story bleiben dort sichtbar.
- **App-Filter und Publish-Filter sind getrennt:** der App-Filter läuft in SQL
  beim Lesen (`get.js`); der Publish-Filter (`publishdate <= now`) erst bei der
  Auslieferung im Modul `ContentVisibilityFilter`. Diese Trennung passt bereits
  zur Aufteilung des Ziel-Modells (App-Zugehörigkeit vs. `published_date`).
- **Substring-Matching** (`LIKE '%K%'` über eine zusammengeschriebene Liste) — ein
  App-Key, der Teilstring eines anderen ist, matcht fälschlich mit. Das normalisierte
  `app_node` (echte Zeilen) beseitigt dieses Risiko und ist insofern die bessere
  Grundlage — es muss die Semantik nur vollständig abbilden.

### Lesepfad: Absätze sind nur über ihr Kapitel erreichbar

Wichtig für die Bewertung der Absatz-Ebene: Paragraph-Ids erreichen den Client
**ausschließlich** über ihr Kapitel. `ChapterEndpoint` lädt das Kapitel per
`LEFT JOIN Chapter → Paragraph` samt Head-Daten seiner Absätze
(`Id, Name, SortNumber, ChapterId`), bereits in der `JOIN`-Bedingung app-gefiltert;
`ParagraphEndpoint` holt danach den vollen Inhalt zu einer id und filtert im `WHERE`
erneut. Der Contents-Tree/Sitemap enthält **keine** Absätze. Der Absatz-App-Filter
wirkt also nur darauf, **welche Absätze eines Kapitels** in einer App ausgeliefert
werden — es gibt keine kapitelübergreifende Wirkung.

### Konsequenz für das Ziel-Modell

- **`node`-Ebene (Story/Kapitel): App-Zugehörigkeit nötig.** Der reale Produktivfall
  „Story für alle Apps, einzelnes Kapitel pro App ausgeschlossen" existiert und wird
  über `app_node` mit `relation` + Wildcard abgebildet (Abschnitt 5).
- **`content_node`-Ebene (Absatz): keine App-Zugehörigkeit.** Eine Analyse der
  Produktivdaten ergab nur eine **Handvoll** Absätze, die — publiziert und in einer
  _aktiven_ App — tatsächlich anders sichtbar sind als ihr Kapitel. Die rohe
  String-Differenz betraf ~200 Zeilen, war aber weit überwiegend bedeutungslos
  (Ausschlüsse aus Apps, die das Kapitel ohnehin nicht erreicht; unveröffentlichte
  Absätze). Für so wenige Fälle wird **keine** dauerhafte per-`content_node`-Mechanik
  gebaut; ein `content_node` folgt seinem `node`.
- Die verbliebenen Altfälle werden in einer **separaten Migrations-Session** aufgelöst
  und hier bewusst nicht im Detail festgehalten.

## 9. Offene Fragen (fachlich)

- [x] **`included`/`excluded`-Treue — entschieden.** App-Zugehörigkeit nur auf
      `node`-Ebene über `app_node` mit `relation` (`include`/`exclude`) + Wildcard
      (`app_id IS NULL`); Auflösungsregel „spezifisch schlägt Wildcard, `exclude`
      schlägt `include`" (Abschnitt 5). `content_node` **ohne** App-Zugehörigkeit
      (Herleitung Abschnitt 8). Verbleibende Altfälle → separate Migrations-Session.
- [x] **`story` vs. `chapter` unterscheiden — entschieden: gar nicht.** Knoten sind
      typfrei, ohne `type`/`level`-Spalte; `cover_node_id` und `reversed` sind
      optionale Eigenschaften jedes Knotens (Abschnitt 3). Die heutige Typisierung
      über das Id-Präfix im Frontend entfällt, Deep-Links bleiben über die
      Migrations-Referenzen funktional.
- [x] **Löschverhalten — entschieden: durchgängig `RESTRICT`** (Abschnitt 3).
- [x] **`LastUpdate` — entschieden: entfällt** (nirgends gelesen, Abschnitt 8).

## 10. Offene Entscheidungen (technisch)

- [x] **FK-Spalten als `varchar(18)`** statt `TEXT` (Typangleich an die PKs) — entschieden.
- [x] **Namenskonvention: `snake_case`** — entschieden. Lesbarkeit schlägt die
      Konsistenz mit der heutigen zusammengeschriebenen Kleinschreibung
      (`recordnumber`, `createddate`); die alten Tabellen verschwinden nach der
      Umstellung ohnehin. Wichtig: unquotierte Identifier faltet Postgres auf
      lowercase — reines camelCase (`isParentControllsVisibility`) ist eine Illusion.
      Bereits vergebene Bestandsnamen (`recordnumber`, `createddate`) bleiben
      unverändert, um Trigger und `table_prefixes` nicht anzufassen.
- [x] Indizes auf allen FK-Spalten, v. a. `node.parent_node_id` (rekursive
      Baum-/Sichtbarkeitsabfrage) — im DDL-Entwurf enthalten.
- [x] `content_node.active_content_item` `NULL`-fähig **und**
      `DEFERRABLE INITIALLY DEFERRED` (zirkulärer Zeiger `content_node ↔ content_item`).
- [x] **`ON DELETE`: durchgängig `RESTRICT`** — entschieden, Löschreihenfolge in
      Abschnitt 3.
- [x] `app_node`: Spalte `relation` (`CHECK (relation IN ('include', 'exclude'))`)
      und Wildcard über `app_id IS NULL`. Eindeutigkeit inkl. Wildcard-Zeilen über
      zwei partielle Indizes (`WHERE app_id IS NULL` / `WHERE app_id IS NOT NULL`) —
      im DDL-Entwurf enthalten, funktioniert auch vor PG 15
      (`UNIQUE NULLS NOT DISTINCT` wäre die Alternative ab PG 15).
- [x] `type` auf `content_item` als `CHECK` (`text`/`html`/`markdown`/`mermaid`) —
      im DDL-Entwurf enthalten.
- [x] `UNIQUE(content_node_id, type)` (solange keine Versionierung) — im
      DDL-Entwurf enthalten.
- [x] **`app.name` als App-Schlüssel** (`UNIQUE NOT NULL`), keine separate
      `application_key`-Spalte und kein Anzeige-Label — entschieden, Begründung in
      Abschnitt 5.
- [x] **`legacy_id` als Spalte auf `node` und `content_node`** (`UNIQUE`), keine
      Mapping-Tabelle; Kompat-Id-Vergabe für Neuanlagen inklusive Lebensdauer —
      entschieden, Abschnitt 8.
- [x] **Cycle-Detection: beides** — Prüfung im Schreibpfad (aufwärts vom künftigen
      Parent) **und** `path`-Array in jeder rekursiven CTE. Begründung, warum
      keins das andere ersetzt: Abschnitt 3.
- [x] Tippfehler aus dem Entwurf: `isParentControllsVisibility` →
      `is_parent_controls_visibility` (mit der `snake_case`-Entscheidung erledigt).

## 11. Referenz-DDL (Entwurf, Ziel-Stand)

> Entwurf mit eingearbeiteten Entscheidungen aus den Abschnitten 9 und 10.
> **Alle Entscheidungen sind gefallen**; die Cycle-Detection ist kein
> Schema-Thema und lebt in Schreib- und Lesepfad (Abschnitt 3). `snake_case` als
> Namensstandard; Prefixe wie im Bestand über `table_prefixes`.

```sql
CREATE TABLE app (
  id            varchar(18) PRIMARY KEY NOT NULL,
  name          text UNIQUE NOT NULL,   -- = APPLICATION_APPLICATION_KEY, siehe 5
  recordnumber  serial NOT NULL,
  createddate   timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE node (
  id                            varchar(18) PRIMARY KEY NOT NULL,
  name                          text,
  description                   text,
  is_parent_controls_visibility boolean,
  sortnumber                    integer,
  parent_node_id                varchar(18) REFERENCES node(id) ON DELETE RESTRICT,
  -- typfrei: keine type/level-Spalte. Die bisher typspezifischen Felder
  -- sind optionale Eigenschaften jedes Knotens:
  cover_node_id                 varchar(18) REFERENCES node(id) ON DELETE RESTRICT,
  reversed                      boolean,
  -- Auflösung alter Deep-Links auf 000s…/000c… (verbindlich, siehe 8)
  legacy_id                     varchar(18) UNIQUE,
  recordnumber                  serial NOT NULL,
  createddate                   timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
  published_date                timestamp without time zone
);

CREATE TABLE app_node (
  id            varchar(18) PRIMARY KEY NOT NULL,
  node_id       varchar(18) NOT NULL REFERENCES node(id) ON DELETE RESTRICT,
  app_id        varchar(18) REFERENCES app(id) ON DELETE RESTRICT, -- NULL = Wildcard: alle Apps
  relation      text NOT NULL CHECK (relation IN ('include', 'exclude')),
  recordnumber  serial NOT NULL,
  createddate   timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Eindeutigkeit inkl. Wildcard-Zeilen (app_id IS NULL):
CREATE UNIQUE INDEX ON app_node (node_id, relation)         WHERE app_id IS NULL;
CREATE UNIQUE INDEX ON app_node (app_id, node_id, relation) WHERE app_id IS NOT NULL;

CREATE TABLE content_node (
  id                  varchar(18) PRIMARY KEY NOT NULL,
  name                text,
  sortnumber          integer,
  node_id             varchar(18) REFERENCES node(id) ON DELETE RESTRICT,
  -- NULL-fähig + DEFERRABLE wegen des zirkulären Zeigers zu content_item.
  -- RESTRICT: das aktive Item lässt sich erst löschen, wenn der Zeiger umgebogen
  -- oder auf NULL gesetzt wurde (siehe Löschreihenfolge, Abschnitt 3).
  active_content_item varchar(18) REFERENCES content_item(id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
  -- Auflösung alter Deep-Links auf 000p… (verbindlich, siehe 8)
  legacy_id           varchar(18) UNIQUE,
  recordnumber        serial NOT NULL,
  createddate         timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
  published_date      timestamp without time zone
);

CREATE TABLE content_item (
  id               varchar(18) PRIMARY KEY NOT NULL,
  content          text,
  type             text CHECK (type IN ('text', 'html', 'markdown', 'mermaid')),
  content_node_id  varchar(18) REFERENCES content_node(id) ON DELETE RESTRICT,
  recordnumber     serial NOT NULL,
  createddate      timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
  UNIQUE (content_node_id, type)
);

-- Indizes auf FK-Spalten (Postgres legt sie nicht automatisch an):
CREATE INDEX idx_node_parent          ON node(parent_node_id);
CREATE INDEX idx_node_cover           ON node(cover_node_id);
CREATE INDEX idx_app_node_node        ON app_node(node_id);
CREATE INDEX idx_app_node_app         ON app_node(app_id);
CREATE INDEX idx_content_node_node    ON content_node(node_id);
CREATE INDEX idx_content_item_cnode   ON content_item(content_node_id);
```

> Hinweis zum zirkulären Zeiger: `content_node.active_content_item` und
> `content_item.content_node_id` verweisen aufeinander. Beim Anlegen der Tabellen
> muss die Reihenfolge/`REFERENCES` das berücksichtigen (z. B. Constraint per
> `ALTER TABLE` nachziehen), und Inserts laufen innerhalb einer Transaktion mit
> `DEFERRABLE`-Constraint.
