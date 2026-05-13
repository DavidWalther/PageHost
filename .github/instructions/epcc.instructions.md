# EPCC Workflow

- Wir arbeiten mit dem EXPLORE-PLAN-CODE-COMMIT Workflow
- Das Ende der Phasen EXPLORE und PLAN wird vom Benutzer festgelegt
- Die Phasen CODE und COMMIT können sich wiederholen, wenn der Plan das verlangt
- Wenn sich CODE und COMMIT wiederholen ist das selbstständig zu tun bis der Plan abgeschlossen ist
- Jeder Schritt des Plans muss in einem eigenen git-Branch implementiert werden
- Jeder Teilschritt durchläuft die CODE und COMMIT Phasen
- Nach Abschluss eines Schrittes muss der dazugehörige branch mit einem merge commit wieder in den Ursprungsbranch gebracht werden

## EXPLORE Phase

das heißt:
1. Ein tiefes Verständins für die Anforderung entwickeln
2. Unklarheiten beseitigen
3. Betroffene Komponenten Identifizieren
4. findings werden in einem ./epcc_explore.md festgehalten
5. Noch keine Instuktionen für die konkrete Implementierung definieren
6. Bei Refactorings: Es müssen Lücken in den existierenden Tests identifiziert werden
7. KEINE ÄNDERUNGEN am Code. Es darf ausschließlich auf die epcc_explore.md Datei schreibend zugegriffen werden.

## PLAN Phase

das heißt:
1. Der Implementierungsplan muss in einem ./epcc_plan.md festgehalten werden
2. Bei Refactorings: Falls Lücken in Tests identifiziert wurden, müssen diese zuerst geschlossen werden.
3. Der Plan muss verschiede Schritte mit Teil-Schritten definieren
4. Der erste Schritt (Schritt "0") muss eine alle tests laufen lassen um eine "Baseline" zu haben
5. Nach Abschluss jedes Schrittes muss ein Testlauf eingeplant werden
6. Der Plan muss als hierarchische Checkliste erstellt werden nach dem Muster

    - [ ] Schritt 0 - Baseline
    - [ ] Schritt 1
       - [x] Teilschritt 1
       - [x] Teilschritt 2
       - [ ] Teilschritt 3
    - [ ] Schritt 2
       - [ ] Teilschritt 1
    ...

7. KEINE ÄNDERUNGEN am Code. Es darf ausschließlich auf die epcc_plan.md Datei schreibend zugegriffen werden.

## CODE Phase

das heißt:
1. Befolge exakt die Implementierungsschritte aus ./epcc_plan.md
2. aktuallisiere die Plan-Datei bei jedem Fortschritt. Auch nach Teilschritten.

## COMMIT Phase

das heißt
1. Es darf pro Commit nur eine Datei verändert werden
2. Das Subject eines Commits muss mit einer kurzen version des Names der Komponente beginnen (z.B. "slds-toggle.js" => "toggle" )
3. in der commit message muss in die änderung in Stichpunkten beschrieben werden.
