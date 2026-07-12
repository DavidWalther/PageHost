# Projekt-Anweisungen

## Arbeitsweise

Wir arbeiten in diesem Projekt **strikt** nach dem Explore–Plan–Code-Workflow.
Die verbindliche Definition (Phasen, Branching pro Schritt, Commit-Regeln,
Test-Struktur) steht in der folgenden Datei und ist bei jeder Aufgabe einzuhalten:

@.github/instructions/epc.instructions.md

## Projekt verstehen

Architektur, Tech-Stack, Request-Flow und Datenmodell:

@doc/architecture.md

Frontend-Komponenten-Konventionen (Lit-first, Legacy-Muster):

@doc/conventions.md

Code-Konventionen (Backend, Tests, Naming; inkl. bekannter Abweichungen):

@doc/coding-conventions.md

## Merkpunkte (Kurzform, Details siehe Import oben)

- **EXPLORE** und **PLAN** enden erst, wenn der Benutzer es festlegt — in diesen
  Phasen **keine Code-Änderungen**, nur `EPC/explore.md` bzw. `EPC/plan.md`.
- **CODE** läuft selbstständig Schritt für Schritt nach `EPC/plan.md`.
- **Nebenbefunde** (Auffälligkeiten außerhalb der Aufgabe) werden **nicht** spontan
  gefixt, sondern in `EPC/Missed.md` geparkt — danach ist diese Datei die Todo-Liste
  und muss am Ende, wie `EPC/plan.md`, komplett abgehakt sein. `EPC/` ist ein
  Wegwerf-Arbeitsverzeichnis: **keine Verweise darauf aus committeten Dateien**.
- Jeder Schritt ab Schritt 1 → eigener Sub-Branch `step/<kurzbeschreibung>`.
- Jeder Teilschritt = ein Commit = ein sinnvoller Schritt (darf mehrere Dateien
  umfassen); viele kleine Commits sind besser als wenige große.
- Backend: Tests nach jeder Änderung (`npm run test`), Suite grün vor Weitergang.
