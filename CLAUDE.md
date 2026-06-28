# Projekt-Anweisungen

Wir arbeiten in diesem Projekt **strikt** nach dem Explore–Plan–Code-Workflow.
Die verbindliche Definition (Phasen, Branching pro Schritt, Commit-Regeln,
Test-Struktur) steht in der folgenden Datei und ist bei jeder Aufgabe einzuhalten:

@.github/instructions/epc.instructions.md

## Merkpunkte (Kurzform, Details siehe Import oben)

- **EXPLORE** und **PLAN** enden erst, wenn der Benutzer es festlegt — in diesen
  Phasen **keine Code-Änderungen**, nur `epcc_explore.md` bzw. `epcc_plan.md`.
- **CODE** läuft selbstständig Schritt für Schritt nach `epcc_plan.md`.
- Jeder Schritt ab Schritt 1 → eigener Sub-Branch `step/<kurzbeschreibung>`.
- Jeder Teilschritt = ein Commit, nur eine Datei pro Commit.
- Backend: Tests nach jeder Änderung (`npm run test`), Suite grün vor Weitergang.
