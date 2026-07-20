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

| Alt (heute)                     | Neu (Ziel)                                   | Bemerkung                                                                                                    |
| :------------------------------ | :------------------------------------------- | :----------------------------------------------------------------------------------------------------------- |
| `story` + `chapter`             | `node`                                       | Beide Ebenen werden Knoten im selben rekursiven Baum (`parent_node_id`).                                     |
| `paragraph`                     | `content_node`                               | Content-Halter, hängt an genau einem `node`.                                                                 |
| Spalten `content`/`htmlcontent` | `content_item` (mehrere Zeilen)              | Eine Zeile je Repräsentation statt zwei feste Spalten — erweiterbar (z. B. `markdown`, `mermaid`).           |
| „html gewinnt, wenn gefüllt"    | `content_node.active_content_item`           | Die bisher **implizite** Auswahl wird ein **expliziter** Zeiger auf die aktive Repräsentation.               |
| `included`/`excluded` (pro App) | `app_node` (`relation`+Wildcard, nur `node`) | App-Zugehörigkeit nur auf `node`-Ebene; `content_node` app-frei. Auflösung + Herleitung: Abschnitte 5 und 8. |

## 3. Tabellen (konzeptionell)

- **`app`** — eine Anwendung. Mehrere Apps sind gleichzeitig produktiv aktiv.
- **`node`** — Knoten im Inhaltsbaum (ersetzt `story` + `chapter`). Trägt
  `parent_node_id` (Selbstbezug), `published_date`, `is_parent_controls_visibility`
  und `sortnumber` (Geschwister-Reihenfolge).
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
- **`included`/`excluded` → `app_node` (`relation` + Wildcard) auf `node`-Ebene:**
  Herleitung in der Ist-Analyse unten; `content_node` erhält **keine** App-Zugehörigkeit.

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
- [ ] **`story` vs. `chapter` unterscheiden.** Über „Wurzel via `app_node` = story,
      alles darunter = chapter" ableiten, oder eine explizite `type`/`level`-Spalte
      am `node`? (Relevant, falls Frontend/Backend einen echten Typunterschied
      braucht: eigene Landing-Page, Breadcrumb-Wurzel, Metadaten.)

## 10. Offene Entscheidungen (technisch)

- [ ] FK-Spalten als `varchar(18)` statt `TEXT` (Typangleich an die PKs).
- [ ] Namenskonvention festlegen: `snake_case` (lesbar, hier verwendet) vs. die
      heutige zusammengeschriebene Kleinschreibung (`recordnumber`, `createddate`).
      Wichtig: unquotierte Identifier faltet Postgres auf lowercase — reines
      camelCase (`isParentControllsVisibility`) ist eine Illusion.
- [ ] Indizes auf allen FK-Spalten, v. a. `node.parent_node_id` (rekursive
      Baum-/Sichtbarkeitsabfrage).
- [ ] `content_node.active_content_item` `NULL`-fähig **und**
      `DEFERRABLE INITIALLY DEFERRED` (zirkulärer Zeiger `content_node ↔ content_item`).
- [ ] `ON DELETE`-Verhalten je Beziehung bewusst festlegen (Cascade/Restrict).
- [ ] `app_node`: Spalte `relation` (`CHECK (relation IN ('include', 'exclude'))`)
      und Wildcard über `app_id IS NULL`. Eindeutigkeit inkl. Wildcard-Zeilen:
      `UNIQUE NULLS NOT DISTINCT (app_id, node_id, relation)` (ab PG 15) **oder** zwei
      partielle Indizes (`WHERE app_id IS NULL` / `WHERE app_id IS NOT NULL`).
- [ ] `type` auf `content_item` als `CHECK`/Enum (`text`/`html`/`markdown`/`mermaid`).
- [ ] `UNIQUE(content_node_id, type)` (solange keine Versionierung).
- [ ] Zyklen im Baum (`parent_node_id`) im Schreibpfad bzw. in der rekursiven CTE
      abfangen (Cycle-Detection).
- [ ] Tippfehler aus dem Entwurf: `isParentControllsVisibility` → `..._controls_...`.

## 11. Referenz-DDL (Entwurf, Ziel-Stand)

> Entwurf mit eingearbeiteten Entscheidungen aus Abschnitt 10 — **noch nicht
> final** (offene Punkte oben zuerst klären). `snake_case` als vorgeschlagener
> Namensstandard; Prefixe wie im Bestand über `table_prefixes`.

```sql
CREATE TABLE app (
  id            varchar(18) PRIMARY KEY NOT NULL,
  name          text,
  recordnumber  serial NOT NULL,
  createddate   timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE node (
  id                            varchar(18) PRIMARY KEY NOT NULL,
  name                          text,
  is_parent_controls_visibility boolean,
  sortnumber                    integer,
  parent_node_id                varchar(18) REFERENCES node(id),
  recordnumber                  serial NOT NULL,
  createddate                   timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
  published_date                timestamp without time zone
);

CREATE TABLE app_node (
  id            varchar(18) PRIMARY KEY NOT NULL,
  node_id       varchar(18) NOT NULL REFERENCES node(id),
  app_id        varchar(18) REFERENCES app(id), -- NULL = Wildcard: alle Apps
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
  node_id             varchar(18) REFERENCES node(id),
  -- NULL-fähig + DEFERRABLE wegen des zirkulären Zeigers zu content_item:
  active_content_item varchar(18) REFERENCES content_item(id) DEFERRABLE INITIALLY DEFERRED,
  recordnumber        serial NOT NULL,
  createddate         timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
  published_date      timestamp without time zone
);

CREATE TABLE content_item (
  id               varchar(18) PRIMARY KEY NOT NULL,
  content          text,
  type             text CHECK (type IN ('text', 'html', 'markdown', 'mermaid')),
  content_node_id  varchar(18) REFERENCES content_node(id),
  recordnumber     serial NOT NULL,
  createddate      timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
  UNIQUE (content_node_id, type)
);

-- Indizes auf FK-Spalten (Postgres legt sie nicht automatisch an):
CREATE INDEX idx_node_parent          ON node(parent_node_id);
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
