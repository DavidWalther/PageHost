# Migration auf das neue Datenmodell

SQL zur Umstellung von `story` / `chapter` / `paragraph` auf
`node` / `content_node` / `content_item`. Das Zielmodell und die Begründung
aller Entscheidungen stehen in `doc/datamodel-overhaul/datamodel.md`.

## Reihenfolge

| Datei                             | Wirkung                                                       |
| :-------------------------------- | :------------------------------------------------------------ |
| `sql/001_create_schema.sql`       | legt die neuen Tabellen an — additiv, alte bleiben stehen     |
| _(von Hand)_                      | `app`-Zeilen eintragen, eine je `APPLICATION_APPLICATION_KEY` |
| `sql/002_copy_legacy_to_node.sql` | kopiert die Bestandsdaten — read-only auf den alten Tabellen  |
| `sql/003_verify.sql`              | prüft die Kopie — rein lesend                                 |

```sh
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f private/scripts/migration/sql/001_create_schema.sql
# app-Zeilen eintragen
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f private/scripts/migration/sql/002_copy_legacy_to_node.sql
psql "$DATABASE_URL"                    -f private/scripts/migration/sql/003_verify.sql
```

Die `app`-Zeilen entstehen bewusst von Hand: es sind eine Handvoll Schlüssel,
und ein `'*'` darf dabei **keine** `app`-Zeile erzeugen — er wird im neuen
Modell zu `app_id IS NULL` (Wildcard). Eine App namens `*` würde mit der Regel
„spezifisch schlägt Wildcard" kollidieren.

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
