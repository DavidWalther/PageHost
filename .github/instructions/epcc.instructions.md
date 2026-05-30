# EPCC Workflow

## Projekt-Kontext

- **Backend**: Node.js / Express, PostgreSQL (via `DataFacade` / `DataStorage`), Redis (via `DataCache`)
- **Frontend**: Lit-Webkomponenten (CDN, kein Bundler), Salesforce Lightning Design System (SLDS v1)
- **Tests (Backend)**: Jest (`npm run test:backend`), Testdateien: `*.tests.js` in `__tests__/`-Ordnern
- **Tests (Frontend)**: Playwright (`npm run test:frontend`), Testdateien: `tests/*.spec.js`
- **Formatter**: Prettier
- **Backend-Quellcode**: `private/endpoints/`, `private/database2/`, `private/modules/`
- **Frontend-Quellcode**: `public/components/`, `public/slds-components/`

## Grundregeln

- Wir arbeiten mit dem EXPLORE-PLAN-CODE-COMMIT Workflow
- Das Ende der Phasen EXPLORE und PLAN wird vom Benutzer festgelegt
- Die Phasen CODE und COMMIT können sich wiederholen, wenn der Plan das verlangt
- Wenn sich CODE und COMMIT wiederholen ist das selbstständig zu tun bis der Plan abgeschlossen ist
- Jeder Schritt des Plans muss in einem eigenen Sub-Branch implementiert werden (`feature/<kurzbeschreibung>`)
- Jeder Teilschritt durchläuft die CODE und COMMIT Phasen
- Nach erfolgreichen Tests eines Schrittes muss der Sub-Branch mit einem Merge Commit in den Feature-Branch gebracht und anschließend gelöscht werden

## EXPLORE Phase

das heißt:

1. Ein tiefes Verständnis für die Anforderung entwickeln
2. Unklarheiten beseitigen
3. Betroffene Komponenten identifizieren
4. Betroffene Schicht explizit benennen:
   - Frontend: `public/components/`, `public/slds-components/`
   - Backend Endpoints: `private/endpoints/`
   - Backend Datenschicht: `private/database2/`
   - Backend Module: `private/modules/`
5. Findings werden in einem ./epcc_explore.md festgehalten
6. Noch keine Instruktionen für die konkrete Implementierung definieren
7. Bei Refactorings: Es müssen Lücken in den existierenden Tests identifiziert werden
8. KEINE ÄNDERUNGEN am Code. Es darf ausschließlich auf die epcc_explore.md Datei schreibend zugegriffen werden.

## PLAN Phase

das heißt:

1. Der Implementierungsplan muss in einem ./epcc_plan.md festgehalten werden
2. Bei Refactorings: Falls Lücken in Tests identifiziert wurden, müssen diese zuerst geschlossen werden.
3. Der Plan muss die folgende Arbeitsstruktur vorgeben:

### Arbeitsstruktur für Backend-Änderungen

- **Schritt 0 — Baseline**: Alle existierenden Tests laufen lassen (`npm run test` — Backend + Frontend)
- **Schritt 1 — Integrationstests**: Integrationstests für das neue Feature erstellen. So wenig Mocking wie möglich einsetzen.
- **Schritt 2+ — Implementierung**: Implementierungsschritte mit eigenen Unit-Tests pro Schritt. Hier darf stark gemockt werden.
- Nach Abschluss jedes Schrittes muss ein vollständiger Testlauf eingeplant werden (`npm run test` — Backend + Frontend)

### Arbeitsstruktur für Frontend-Änderungen

- **Schritt 0 — Baseline**: Alle existierenden Tests laufen lassen (`npm run test` — Backend + Frontend)
- **Schritt 1 — Fixture & Spec**: HTML-Fixture in `tests/fixtures/` und Spec-Datei in `tests/` anlegen. Backend per `tests/helpers/mockBackend.js` mocken.
- **Schritt 2+ — Implementierung**: Komponente implementieren, Tests nach jeder Änderung ausführen.
- Nach Abschluss jedes Schrittes muss ein vollständiger Testlauf eingeplant werden (`npm run test` — Backend + Frontend)

### Branching pro Schritt

- Jeder Schritt bekommt einen eigenen Sub-Branch: `feature/<kurzbeschreibung>`
- Jeder Teilschritt = ein Commit
- Die Teilschritte müssen so klein wie möglich gehalten werden, um die Übersicht zu bewahren
- Nach erfolgreichen Tests → Sub-Branch in den Feature-Branch mergen und löschen

### Plan-Format

4. Der Plan muss als hierarchische Checkliste erstellt werden nach dem Muster:
   - [ ] Schritt 0 - Baseline
   - [ ] Schritt 1 - Integrationstests
     - [ ] Teilschritt 1
     - [ ] Teilschritt 2
   - [ ] Schritt 2 - <Beschreibung>
     - [ ] Teilschritt 1
     - [ ] Teilschritt 2
           ...

5. KEINE ÄNDERUNGEN am Code. Es darf ausschließlich auf die epcc_plan.md Datei schreibend zugegriffen werden.

## CODE Phase

das heißt:

1. Befolge exakt die Implementierungsschritte aus ./epcc_plan.md
2. Aktualisiere die Plan-Datei bei jedem Fortschritt. Auch nach Teilschritten.

### Backend-Entwicklung

3. Tests gehören in `*.tests.js` Dateien in `__tests__/`-Ordnern
4. **Integrationstests** (Schritt 1): So wenig Mocking wie möglich. Nur externe I/O mocken (DataStorage, DataCache, Logging, OpenIdConnectClient)
5. **Unit-Tests** (Schritt 2+): Starkes Mocking erlaubt, um die zu testende Einheit zu isolieren
6. Tests müssen nach jeder Änderung laufen: `npm run test`

### Frontend-Entwicklung

7. Lit-Komponenten in `public/components/` — Skill `lit-web-components` nutzen
8. SLDS-Klassen für Styling verwenden — Skill `slds-v1` nutzen
9. Playwright-Specs in `tests/*.spec.js` — ein Spec-File pro Komponente
10. HTML-Fixtures für isoliertes Komponenten-Testing in `tests/fixtures/`
11. Backend-Mocking über `tests/helpers/mockBackend.js` (`setupDefaultMocks(page)`)
12. Tests nach jeder Änderung ausführen: `npm run test:frontend`

### Allgemein

13. Nach Änderungen Prettier ausführen

## COMMIT Phase

das heißt:

1. Es darf pro Commit nur eine Datei verändert werden
2. Ein Commit pro Teilschritt
3. Das Subject eines Commits muss mit einer kurzen Version des Namens der Komponente beginnen
   - Beispiele: `chapter: add paragraph scroll parameter`, `DataFacade: add getByParagraphId method`, `slds-modal: fix close button alignment`
4. In der Commit Message muss die Änderung in Stichpunkten beschrieben werden
5. Sub-Branch pro Schritt: `feature/<kurzbeschreibung>` — nach erfolgreichen Tests: Merge Commit in Feature-Branch, dann Sub-Branch löschen
