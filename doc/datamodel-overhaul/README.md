# Datenmodell-Umstellung

> **Status: umgesetzt.** Der Code liest und schreibt ausschließlich über
> `node` / `content_node` / `content_item`; `story`, `chapter` und `paragraph`
> kommen darin nicht mehr vor. Dieses Verzeichnis beschreibt damit den
> **laufenden** Stand des Inhaltsmodells und die Entscheidungen, die dorthin
> geführt haben.
>
> **Offen bleibt die Datenbank selbst:** die alten Tabellen stehen, bis
> `private/scripts/migration/sql/005_drop_legacy_tables.sql` ausgeführt wurde.
> Vorher ist die Sichtbarkeit auf Vererbung umzustellen — **von Hand**, weil die
> alten App-Spalten zu widersprüchlich sind, als dass
> `004_inherit_visibility.sql` daraus etwas ableiten könnte. Regel, Fallstricke
> und Prüfabfragen: `private/scripts/migration/README.md`, Abschnitt
> „Sichtbarkeit von Hand korrigieren". Danach fehlt die Referenz, gegen die
> sich das prüfen lässt.
>
> Der Überblick über das laufende System steht weiterhin in
> `doc/architecture.md`.

## Inhalt

- **`datamodel.md`** — Ziel-Datenmodell: Tabellen, Beziehungen, das zentralisierte
  Sichtbarkeitsmodell, App-Zugehörigkeit, Sortierung, Content-Repräsentationen,
  Migrations-Hinweise sowie die noch offenen Entscheidungen und Fragen.

## Warum ein eigenes Verzeichnis

Die Definitionen und Entscheidungen hier gehen über eine reine EXPLORE-Notiz
hinaus: sie tragen mehrere Implementierungsschritte und erklären, **warum** das
Modell so aussieht, wie es aussieht. `doc/architecture.md` beschreibt den
Aufbau des Systems, dieses Verzeichnis die Begründung des Inhaltsmodells.
