# Explore–Plan–Code Workflow

## Projekt-Kontext

- **Backend**: Node.js / Express, PostgreSQL (via `DataFacade` / `DataStorage`), Redis (via `DataCache`)
- **Frontend**: Lit-Webkomponenten (CDN, kein Bundler), Salesforce Lightning Design System (SLDS v1)
- **Tests**: Jest (`npm run test`), Testdateien: `*.tests.js` in `__tests__/`-Ordnern
- **Formatter**: Prettier
- **Backend-Quellcode**: `private/endpoints/`, `private/database2/`, `private/modules/`
- **Frontend-Quellcode**: `public/components/`, `public/slds-components/`

## Grundregeln

- Wir arbeiten mit dem EXPLORE-PLAN-CODE Workflow
- Das Ende der Phasen EXPLORE und PLAN wird vom Benutzer festgelegt
- Die CODE-Phase wiederholt sich pro Schritt und Teilschritt, bis der Plan abgeschlossen ist
- Diese Wiederholung ist selbstständig durchzuführen
- Jeder Schritt des Plans (ab Schritt 1) wird auf einem eigenen Sub-Branch implementiert (`step/<kurzbeschreibung>`)
- Jeder Teilschritt wird implementiert und mit einem eigenen Commit abgeschlossen (siehe „Commit-Regeln")
- Nach Abschluss eines Schrittes wird der Sub-Branch per Merge Commit in den Feature-Branch gebracht und anschließend gelöscht
- Details und Ausnahmen zum Branching: siehe Abschnitt „Branching pro Schritt"
- Nebenbefunde werden nicht spontan gefixt, sondern in `EPC/Missed.md` geparkt: siehe Abschnitt „Nebenbefunde"

## Nebenbefunde — `EPC/Missed.md`

In jeder Phase fallen Dinge auf, die **nicht** zur aktuellen Aufgabe gehören: ein
Bug nebenan, eine falsche Doku, eine Altlast. Beides wäre falsch — sie spontan zu
fixen (Scope-Drift, der Plan franst aus) oder sie zu vergessen. Deshalb:

1. **Parken statt fixen.** Jeder Nebenbefund wird sofort in `EPC/Missed.md`
   festgehalten und **nicht** unterwegs behoben. Der geplante Weg bleibt der Weg.
2. **Format: abhakbare Checkliste.** Ein Eintrag = ein Befund, mit Befund, Ort im
   Code und der Begründung, warum er nicht sofort behoben wurde.
3. **Danach ist es die Todo-Liste.** Ist der Plan abgearbeitet, wird `EPC/Missed.md`
   zur neuen Todo-Liste und **abgearbeitet** — jeder Eintrag nach denselben Regeln
   (eigener Schritt, Sub-Branch, Tests, Commit).
4. **Abschluss-Kriterium.** Die Aufgabe ist erst fertig, wenn `EPC/Missed.md` —
   genau wie `EPC/plan.md` — **vollständig abgehakt** ist. Bleibt ein Eintrag
   bewusst offen, wird er in ein eigenes Issue überführt und dort vermerkt.
5. **Arbeitsdokument, kein Register.** `EPC/` ist gitignored und lebt nur für die
   Dauer der Aufgabe. Aus **committeten** Dateien (README, `doc/`, Tests) darf
   deshalb **nie** auf `EPC/Missed.md` verwiesen werden — solche Verweise zeigen
   nach dem Abarbeiten ins Leere. Was dauerhaft gelten soll, gehört in die Doku
   oder in ein Issue, nicht in einen Verweis auf ein Wegwerf-Dokument.

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
5. Findings werden in einem ./EPC/explore.md festgehalten
6. Noch keine Instruktionen für die konkrete Implementierung definieren
7. Bei Refactorings: Es müssen Lücken in den existierenden Tests identifiziert werden
8. Auffälligkeiten außerhalb der Aufgabe kommen nach ./EPC/Missed.md (siehe „Nebenbefunde")
9. KEINE ÄNDERUNGEN am Code. Es darf ausschließlich auf die Dateien EPC/explore.md und EPC/Missed.md schreibend zugegriffen werden.

## PLAN Phase

das heißt:

1. Der Implementierungsplan muss in einem ./EPC/plan.md festgehalten werden
2. Bei Refactorings: Falls Lücken in Tests identifiziert wurden, müssen diese zuerst geschlossen werden.
3. KEINE ÄNDERUNGEN am Code. Es darf ausschließlich auf die Dateien EPC/plan.md und EPC/Missed.md schreibend zugegriffen werden.
4. Der Plan muss die in den folgenden Abschnitten beschriebene Arbeitsstruktur und das Plan-Format vorgeben.
5. Das Abarbeiten der Einträge aus ./EPC/Missed.md gehört mit in den Plan (siehe „Nebenbefunde")

### Arbeitsstruktur für Backend-Änderungen

- **Schritt 0 — Baseline**: Alle existierenden Tests laufen lassen (`npm run test`). Kein Branch, kein Commit — nur ein Testlauf.
- **Schritt 1 — Integrationstests**: Integrationstests für das neue Feature erstellen. So wenig Mocking wie möglich einsetzen.
- **Schritt 2+ — Implementierung**: Implementierung mit eigenen Unit-Tests. Hier darf stark gemockt werden. Empfohlen ist Test-zuerst; ob Test- und Produktivcode in einem Commit oder in mehreren kleinen Commits landen, richtet sich danach, was einen sinnvollen, gut lesbaren Schritt ergibt.
- Nach Abschluss jedes Schrittes muss ein Testlauf eingeplant werden

### Arbeitsstruktur für Frontend-Änderungen

- Frontend wird mit **Playwright-UI-Tests** abgesichert (`ui-tests/*.spec.js`, `npm run test:frontend`). Setup, Callout-Mocking und Auth-Muster: `doc/frontend-testing.md`.
- Neue oder geänderte UI-Flows brauchen mindestens einen Smoke-Test. Eine feste Schritt-0/Integration/Unit-Staffelung wie im Backend ist nicht vorgeschrieben; verpflichtend ist eine grüne Playwright-Suite als Abschlusskriterium (siehe „Branching pro Schritt").
- Bei gemischten Front-/Backend-Änderungen gilt zusätzlich die Backend-Arbeitsstruktur inklusive Schritt 0.

### Branching pro Schritt

- Der **Feature-Branch** ist der aktuelle Arbeits-Branch des Issues (z. B. `122-create-slds-breadcrumbs-component`). Auf ihm wird nicht direkt implementiert.
- Jeder Schritt ab Schritt 1 bekommt einen eigenen **Sub-Branch** `step/<kurzbeschreibung>`, abgezweigt vom Feature-Branch.
- Schritt 0 (Baseline) ist ausgenommen: kein Branch, nur ein Testlauf.
- Jeder Teilschritt = ein Commit auf dem Sub-Branch.
- Die Teilschritte müssen so klein wie möglich gehalten werden, um die Übersicht zu bewahren.
- Abschluss eines Schrittes → Sub-Branch per Merge Commit in den Feature-Branch bringen, dann löschen. Abschluss-Kriterium:
  - Backend: erfolgreicher Testlauf (`npm run test`)
  - Frontend: grüne Playwright-Suite (`npm run test:frontend`)

### Plan-Format

Der Plan muss als hierarchische Checkliste erstellt werden nach dem Muster:

- [ ] Schritt 0 - Baseline (nur Backend; kein Branch, nur Testlauf)
- [ ] Schritt 1 - Integrationstests — Sub-Branch: `step/<kurzbeschreibung>`
  - [ ] Teilschritt 1
  - [ ] Teilschritt 2
  - [ ] Merge Commit in den Feature-Branch, Sub-Branch löschen
- [ ] Schritt 2 - <Beschreibung> — Sub-Branch: `step/<kurzbeschreibung>`
  - [ ] Teilschritt 1
  - [ ] Teilschritt 2
  - [ ] Merge Commit in den Feature-Branch, Sub-Branch löschen
        ...

## CODE Phase

das heißt:

1. Befolge exakt die Implementierungsschritte aus ./EPC/plan.md
2. Aktualisiere die Plan-Datei bei jedem Fortschritt. Auch nach Teilschritten.

### Backend-Entwicklung

3. Tests gehören in `*.tests.js` Dateien in `__tests__/`-Ordnern
4. **Integrationstests** (Schritt 1): So wenig Mocking wie möglich. Nur externe I/O mocken (DataStorage, DataCache, Logging, OpenIdConnectClient)
5. **Unit-Tests** (Schritt 2+): Starkes Mocking erlaubt, um die zu testende Einheit zu isolieren
6. Tests müssen nach jeder Änderung laufen: `npm run test`

### Frontend-Entwicklung

7. Lit-Komponenten in `public/components/` — Skill `lit-web-components` nutzen
8. SLDS-Klassen für Styling verwenden — Skill `slds-v1` nutzen
9. UI-Tests mit Playwright schreiben/aktualisieren (`ui-tests/*.spec.js`) — Setup und Muster: `doc/frontend-testing.md`

### Allgemein

10. Nach Änderungen Prettier ausführen — nur auf die im Teilschritt geänderten Dateien (nicht das ganze Projekt), damit der Commit auf den beabsichtigten Schritt beschränkt bleibt

### Commit-Regeln

Jeder Teilschritt wird mit einem Commit abgeschlossen:

1. Ein Commit umfasst einen sinnvollen Schritt in Richtung des Ziels — nicht an eine einzelne Datei gebunden, darf mehrere Dateien umfassen
   - Commits klein genug halten, dass sich das Vorgehen allein aus der Commit-Historie ablesen lässt
   - Grundsatz: viele kleine Commits sind besser als wenige große
2. Ein Commit pro Teilschritt
3. Das Subject eines Commits muss mit einer kurzen Version des Namens der Komponente beginnen
   - Beispiele: `chapter: add paragraph scroll parameter`, `DataFacade: add getByParagraphId method`, `slds-modal: fix close button alignment`
4. In der Commit Message muss die Änderung in Stichpunkten beschrieben werden
5. Branching und Merge-Vorgehen: siehe Abschnitt „Branching pro Schritt"
