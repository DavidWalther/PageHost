# Migration auf das neue Datenmodell

SQL zur Umstellung von `story` / `chapter` / `paragraph` auf
`node` / `content_node` / `content_item`. Das Zielmodell und die Begründung
aller Entscheidungen stehen in `doc/datamodel-overhaul/datamodel.md`.

## Reihenfolge

| Datei                       | Wirkung                                                       |
| :-------------------------- | :------------------------------------------------------------ |
| `sql/001_create_schema.sql` | legt die neuen Tabellen an — additiv, alte bleiben stehen     |
| _(von Hand)_                | `app`-Zeilen eintragen, eine je `APPLICATION_APPLICATION_KEY` |
| `sql/002_1` … `sql/002_7`   | kopiert die Bestandsdaten — read-only auf den alten Tabellen  |
| `sql/003_verify.sql`        | prüft die Kopie — rein lesend                                 |

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
```

Die `app`-Zeilen entstehen bewusst von Hand: es sind eine Handvoll Schlüssel,
und ein `'*'` darf dabei **keine** `app`-Zeile erzeugen — er wird im neuen
Modell zu `app_id IS NULL` (Wildcard). Eine App namens `*` würde mit der Regel
„spezifisch schlägt Wildcard" kollidieren.

## Welche Datei welches Werkzeug braucht

| Datei | läuft durch ein Migrationswerkzeug? | warum                                                                                                                                                                       |
| :---- | :---------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `001` | **nein**, nur `psql`                | Dollar-Quoting (`$$`) für zwei Funktionen und drei `DO`-Blöcke. Werkzeuge, die Statements naiv an `;` trennen, zerlegen die Funktionsrümpfe. Bei PL/pgSQL nicht vermeidbar. |
| `002` | **ja**                              | Bewusst portabel gehalten: kein Dollar-Quoting, keine `DO`-Blöcke, keine temporären Objekte, keine `\`-Metabefehle. Jedes Statement steht für sich.                         |
| `003` | **nein**, `psql` oder SQL-Konsole   | Die Aussage steckt in den **Ergebnismengen**; Migrationswerkzeuge verwerfen sie.                                                                                            |

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
- **Prüfbar.** In `003` müssen die Abschnitte 1 bis 5 leere Ergebnismengen
  liefern; jede Zeile dort ist ein Befund. Abschnitt 6 ist bewusst **nicht**
  leer und hält die akzeptierten Abweichungen sichtbar (nicht migrierte Waisen,
  Absätze mit vom Kapitel abweichender App-Sichtbarkeit).

## Stand

Schema und Kopie sind bereits **von Hand** vollzogen. Diese Dateien sind die
schriftliche Fassung genau dieser Schritte — nicht ein davon abweichender,
zweiter Weg. Für den produktiven Bestand gilt deshalb: `001` und `002` sind
No-ops, `003` ist das Werkzeug, mit dem der Zustand vor der Umschaltung des
Lesepfads ein letztes Mal geprüft wird.
