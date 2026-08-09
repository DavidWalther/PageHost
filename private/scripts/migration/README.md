# Migration auf das neue Datenmodell

SQL zur Umstellung von `story` / `chapter` / `paragraph` auf
`node` / `content_node` / `content_item`. Das Zielmodell und die Begründung
aller Entscheidungen stehen in `doc/datamodel-overhaul/datamodel.md`.

## Reihenfolge

| Datei                            | Wirkung                                                          |
| :------------------------------- | :--------------------------------------------------------------- |
| `sql/001_create_schema.sql`      | legt die neuen Tabellen an — additiv, alte bleiben stehen        |
| _(von Hand)_                     | `app`-Zeilen eintragen, eine je `APPLICATION_APPLICATION_KEY`    |
| `sql/002_1` … `sql/002_7`        | kopiert die Bestandsdaten — read-only auf den alten Tabellen     |
| `sql/003_verify.sql`             | prüft die Kopie — rein lesend                                    |
| _(von Hand)_                     | **Sichtbarkeit korrigieren** — siehe eigenen Abschnitt unten     |
| `sql/005_drop_legacy_tables.sql` | entfernt `story`/`chapter`/`paragraph` — **Punkt ohne Rückkehr** |

`sql/004_inherit_visibility.sql` steht weiterhin im Ordner, ist aber **kein
Pflichtschritt mehr**. Warum, steht unten unter „Sichtbarkeit von Hand
korrigieren".

**`005` erst nach einem Backup**, das sich auch wirklich wiederherstellen lässt.

Die Kopie liegt in **sieben Teilen**, die in dieser Reihenfolge laufen müssen:

| Teil    | Inhalt                                             |
| :------ | :------------------------------------------------- |
| `002_1` | `node` aus `story` — die Wurzelknoten              |
| `002_2` | `node` aus `chapter` — als Kinder ihrer Story      |
| `002_3` | `app_node` aus den App-Spalten beider Ebenen       |
| `002_4` | `cover_node_id` nachziehen (zeigt auf ein Kapitel) |
| `002_5` | `content_node` aus `paragraph`                     |
| `002_6` | `content_item` aus `content` und `htmlcontent`     |
| `002_7` | `active_content_item` setzen                       |

Die Reihenfolge ist erzwungen, nicht kosmetisch: `parent_node_id` ist ein
Fremdschlüssel, und die Ids entstehen erst im `BEFORE INSERT`-Trigger. Jeder
Teil trägt seine eigene Transaktion und ist für sich idempotent — ein Abbruch
mittendrin wird durch einen erneuten Lauf desselben Teils geheilt.

```sh
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f private/scripts/migration/sql/001_create_schema.sql
# app-Zeilen eintragen
for teil in private/scripts/migration/sql/002_?_*.sql; do
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$teil" || break
done
psql "$DATABASE_URL"                    -f private/scripts/migration/sql/003_verify.sql

# Erst wenn 003 Abschnitt 1-4 ohne Befund durchlaeuft:
#   Sichtbarkeit von Hand korrigieren (siehe unten), danach die vier
#   Zielzustands-Abfragen laufen lassen.

# Erst nach einem geprueften Backup:
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f private/scripts/migration/sql/005_drop_legacy_tables.sql
```

Die `app`-Zeilen entstehen bewusst von Hand: es sind eine Handvoll Schlüssel,
und ein `'*'` darf dabei **keine** `app`-Zeile erzeugen — er wird im neuen
Modell zu `app_id IS NULL` (Wildcard). Eine App namens `*` würde mit der Regel
„spezifisch schlägt Wildcard" kollidieren.

## Sichtbarkeit von Hand korrigieren

Die Kopie hat jedem Knoten eine eigene `app_node`-Zeile gegeben und
`is_parent_controls_visibility = false` gesetzt. Das war die wörtliche
Übersetzung des Altmodells, das keine Vererbung kennt — nicht das Zielmodell,
in dem Vererbung der Normalfall ist (`datamodel.md`, Abschnitt 4).

`004` sollte diese Umstellung automatisch machen. Es stellt aber nur um, wo
sich die aufgelöste Sichtbarkeit in **keiner** App ändert — und genau das
trifft auf die Bestandsdaten kaum zu: Die alten Spalten `applicationincluded`
und `applicationexcluded` sind zwischen Story und Kapitel inkonsistent gepflegt,
also blockiert die Prüfung fast jeden Knoten. Ein Lauf gegen die lokale
Testdatenbank hat das bestätigt.

**Deshalb wird die Sichtbarkeit von Hand gesetzt.** Die Zahl der Apps und
Stories ist überschaubar, und nur **eine** App ist produktiv im Einsatz; die
übrigen sind Machbarkeitsstudien. Ein Zielzustand, der von Hand hingeschrieben
wird, ist hier ehrlicher als ein Skript, das aus widersprüchlichen Altdaten das
Richtige raten soll.

### Die Regel, gegen die geschrieben wird

Maßgeblich ist die Laufzeit — `private/modules/NodeVisibility.js`, nicht das
SQL:

```js
isMember = (included || (inherits && parentIsMember)) && !excluded;
```

Daraus folgen vier Dinge, die beim Setzen von Hand leicht danebengehen:

1. **Das Flag allein bewirkt nichts.** `included` ist ein ODER-Zweig. Ein Knoten
   mit `is_parent_controls_visibility = true`, der **weiterhin seine eigene
   include-Zeile trägt**, bleibt Anker — sichtbar auch dann, wenn sein
   Elternknoten es nicht ist. Umstellen heißt immer: Flag setzen **und**
   include-Zeile löschen.
2. **Die Wildcard reicht weiter als die `app`-Tabelle.** Eine Zeile mit
   `app_id IS NULL` gilt für **jeden** Schlüssel — auch für einen, zu dem es gar
   keine `app`-Zeile gibt. Sie veröffentlicht damit in die PoC-Apps und in jeden
   künftigen Schlüssel.
3. **Wurzelknoten können nicht erben.** Der Durchlauf beginnt an den Wurzeln mit
   `parentIsMember = false`. Eine Story mit Flag `true` und ohne include-Zeile
   ist überall unsichtbar. Stories brauchen immer ihre eigene Zeile.
4. **Was von keiner Wurzel erreichbar ist, ist unsichtbar** — unabhängig von
   jeder include-Zeile.

`exclude` wirkt unabhängig vom Flag und schlägt alles andere. Genau deshalb
bleibt der Fall „Story überall, ein Kapitel für App X ausgenommen" auch nach der
Umstellung als exclude-Zeile stehen.

### Zielzustand prüfen

Diese vier Abfragen prüfen nicht „nichts hat sich geändert", sondern ob der
gesetzte Zustand in sich stimmt. Jede muss leer sein — bis auf die dritte, wo
jede Zeile eine bewusste Entscheidung sein muss.

```sql
-- 1. Erbt UND hat trotzdem eine eigene include-Zeile -> Flag wirkungslos
SELECT n.legacy_id, n.name, an.app_id
FROM node n JOIN app_node an ON an.node_id = n.id AND an.relation = 'include'
WHERE n.is_parent_controls_visibility;

-- 2. Wurzelknoten ohne include-Zeile -> ueberall unsichtbar
SELECT n.legacy_id, n.name FROM node n
WHERE n.parent_node_id IS NULL
  AND NOT EXISTS (SELECT 1 FROM app_node a
                   WHERE a.node_id = n.id AND a.relation = 'include');

-- 3. Verbliebene Wildcards -> sichtbar in JEDEM Schluessel, auch unbekannten
SELECT n.legacy_id, n.name, an.relation
FROM app_node an JOIN node n ON n.id = an.node_id
WHERE an.app_id IS NULL;

-- 4. Nicht von einer Wurzel erreichbar -> unsichtbar, egal welche Zeilen
WITH RECURSIVE erreichbar AS (
  SELECT id FROM node WHERE parent_node_id IS NULL
  UNION ALL
  SELECT c.id FROM node c JOIN erreichbar e ON c.parent_node_id = e.id
)
SELECT n.legacy_id, n.name FROM node n
WHERE n.id NOT IN (SELECT id FROM erreichbar);
```

### Was das für `003` bedeutet

`003` Abschnitt 5 vergleicht die aufgelöste Sichtbarkeit **beider** Modelle und
war der Nachweis, dass die Umstellung folgenlos ist. Eine bewusste Korrektur
macht ihn **planmäßig** nicht-leer. Danach gilt: Die Abschnitte 1 bis 4 behalten
ihre Bedeutung unverändert, Abschnitt 5 ist als „diese Abweichungen sind genau
meine Korrekturen" zu lesen — jede Zeile muss erklärbar sein, keine darf
überraschen.

Nach `005` gibt es diesen Vergleich nicht mehr. Wer die Korrektur gegen den
Altstand nachvollziehbar halten will, zieht vorher einen Abzug von Abschnitt 5.

### Und wenn `004` doch läuft?

Es schadet nicht. Es ist idempotent und stellt weiterhin nur um, wo sich nichts
ändert — nach einer sauberen Handkorrektur findet es entweder nichts mehr oder
bestätigt nur. Als „Nachbrenner" bringt es allerdings auch nichts.

## Welche Datei welches Werkzeug braucht

| Datei | läuft durch ein Migrationswerkzeug? | warum                                                                                                                                                                       |
| :---- | :---------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `001` | **nein**, nur `psql`                | Dollar-Quoting (`$$`) für zwei Funktionen und drei `DO`-Blöcke. Werkzeuge, die Statements naiv an `;` trennen, zerlegen die Funktionsrümpfe. Bei PL/pgSQL nicht vermeidbar. |
| `002` | **ja**                              | Bewusst portabel gehalten: kein Dollar-Quoting, keine `DO`-Blöcke, keine temporären Objekte, keine `\`-Metabefehle. Jedes Statement steht für sich.                         |
| `003` | **nein**, `psql` oder SQL-Konsole   | Die Aussage steckt in den **Ergebnismengen**; Migrationswerkzeuge verwerfen sie.                                                                                            |
| `004` | **nein**, nur `psql`                | Temporäre Tabellen und `\echo`; die Zwischenstände sollen beim Lauf sichtbar sein. Kein Pflichtschritt mehr — siehe „Sichtbarkeit von Hand korrigieren".                    |
| `005` | **nein**, nur `psql`                | `\echo` und eine Gegenprobe, deren Ergebnis vor dem `COMMIT` gelesen werden muss.                                                                                           |

Drei Regeln, die `002` portabel halten und beim Ändern gelten:

- **Klein bleiben.** Gemessen an einem Werkzeug, das die Datei nach **8981
  Bytes** abgeschnitten hat — zweimal an genau dieser Position, bei völlig
  unterschiedlichem Inhalt. Das Fehlerbild ist tückisch, weil der Abbruch
  irgendwo mitten in einem Statement liegt und wie ein Syntaxfehler aussieht
  (`column p.chapter does not exist`, `syntax error at end of input`). Deshalb
  sieben Teile statt einer Datei; der größte liegt bei gut 3 KB.

- **Kein `--` innerhalb von Zeichenketten.** Werkzeuge, die Kommentare
  zeilenweise entfernen, bevor sie Zeichenketten verstehen, erzeugen daraus ein
  unabgeschlossenes Anführungszeichen — und verschieben damit **alle** folgenden
  Statement-Grenzen. Der Fehler zeigt sich dann irgendwo weit hinten als
  `syntax error at end of input`.
- **Keine temporären Objekte.** Eine `TEMP VIEW` gehört zur Sitzung. Ein
  Werkzeug, das Statements über wechselnde Verbindungen schickt, findet sie im
  nächsten Statement nicht mehr. Gemeinsame Teilabfragen stehen deshalb als CTE
  in jedem Statement, auch wenn das Wiederholung bedeutet.

`BEGIN`/`COMMIT` in `002` sind die einzige Annahme: Wer sein Werkzeug die
Transaktion führen lässt, entfernt die beiden Zeilen. Die Datei bleibt auch ohne
sie brauchbar, weil jedes Statement für sich idempotent ist.

## Warum reines SQL und kein Node-Skript

Es gibt eine Datenbank und eine Kopie. Ein Runner mit Konfiguration,
Fehlerbehandlung und Unit-Tests würde für einen einmaligen Vorgang eine zweite
Schicht einziehen, die selbst gepflegt und getestet werden müsste — und die
eigentliche Arbeit stünde weiterhin als SQL darin. Die Dateien sind deshalb
direkt mit `psql` ausführbar und sonst nichts.

## Eigenschaften

- **Additiv.** Die alten Tabellen werden nur gelesen. Ein Rückweg betrifft
  ausschließlich die neuen Tabellen.
- **Wiederholbar.** `001` ist gegen ein vorhandenes Schema ein No-op
  (`IF NOT EXISTS`), `002` zieht über `ON CONFLICT … DO NOTHING` nur nach, was
  fehlt. Wird zwischen Kopie und Umschaltung doch noch geschrieben, genügt ein
  zweiter Lauf.
- **Prüfbar.** In `003` müssen die Abschnitte 1 bis 4 leere Ergebnismengen
  liefern; jede Zeile dort ist ein Befund. Abschnitt 5 war das ebenfalls,
  solange die Sichtbarkeit unverändert bleiben sollte — mit der
  Handkorrektur ist er als Liste der gewollten Änderungen zu lesen (siehe
  „Sichtbarkeit von Hand korrigieren"). Abschnitt 6 ist bewusst **nicht** leer
  und hält die akzeptierten Abweichungen sichtbar (nicht migrierte Waisen,
  Absätze mit vom Kapitel abweichender App-Sichtbarkeit).

## Stand

Schema und Kopie sind bereits **von Hand** vollzogen. Diese Dateien sind die
schriftliche Fassung genau dieser Schritte — nicht ein davon abweichender,
zweiter Weg. Für den produktiven Bestand gilt deshalb: `001` und `002` sind
No-ops, `003` ist das Werkzeug, mit dem der Zustand vor der Umschaltung des
Lesepfads ein letztes Mal geprüft wird.

Die **Sichtbarkeit** wird ebenfalls von Hand gesetzt, nicht über `004` — die
Altdaten geben die automatische Umstellung nicht her (siehe oben). Offen sind
damit: die Handkorrektur, ihre Prüfung über die vier Zielzustands-Abfragen und
danach `005` nach geprüftem Backup.
