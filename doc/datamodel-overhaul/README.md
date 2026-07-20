# Datenmodell-Umstellung (geplant)

> **Status: KONZEPT — noch nicht implementiert.**
> Dieses Verzeichnis beschreibt das **Ziel**-Datenmodell, das die heutigen
> Tabellen `story`/`chapter`/`paragraph` ablösen soll. Es ist die konzeptionelle
> Grundlage für die kommende Implementierung und Migration, **nicht** eine
> Beschreibung des aktuellen Standes. Der aktuell implementierte Stand steht in
> `doc/architecture.md` (Abschnitt „Datenmodell").

## Inhalt

- **`datamodel.md`** — Ziel-Datenmodell: Tabellen, Beziehungen, das zentralisierte
  Sichtbarkeitsmodell, App-Zugehörigkeit, Sortierung, Content-Repräsentationen,
  Migrations-Hinweise sowie die noch offenen Entscheidungen und Fragen.

## Warum ein eigenes Verzeichnis

Die Definitionen und Entscheidungen hier gehen über eine reine EXPLORE-Notiz
hinaus und werden Grundlage für mehrere Implementierungsschritte. Sie sollen
dauerhaft dokumentiert, aber klar als **zukünftiger** Stand erkennbar sein —
solange die Umstellung nicht abgeschlossen ist, bleibt `doc/architecture.md` die
maßgebliche Beschreibung des laufenden Systems.
