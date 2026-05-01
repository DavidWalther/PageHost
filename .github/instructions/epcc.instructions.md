# EPCC Workflow

- Wir arbeiten mit dem EXPLORE-PLAN-CODE-COMMIT Workflow
- Das Ende der Phasen EXPLORE und PLAN wird vom Benutzer festgelegt
- Die Phasen CODE und COMMIT können sich wiederholen, wenn der Plan das verlangt
- Wenn sich CODE und COMMIT wiederholen ist das selbstständig zu tun bis der Plan abgeschlossen ist

## EXPLORE Phase

das heißt:
1. Ein tiefes Verständins für die Anforderung entwickeln
2. Unklarheiten beseitigen
3. Betroffene Komponenten Identifizieren
4. findings werden in einem ./epcc_explore.md festgehalten
5. Noch keine Instuktionen für die konkrete Implementierung definieren
6. Bei Refactorings: Es müssen Lücken in den existierenden Tests identifiziert werden
7. KEINE ÄNDERUNGEN am Code

## PLAN Phase

das heißt:
1. Der Implementierungsplan muss in einem ./epcc_plan.md festgehalten werden
2. Bei Refactorings: Falls Lücken in Tests identifiziert wurden, müssen diese zuerst geschlossen werden.
2. Der Plan muss verschiede Schritte mit Teil-Schritten definieren
4. Die Schritte müssen so gestalltet sein, dass nach jedem Schritt ein Deployment mit anschließendem Testlauf mit allen lokalen tests durchgeführt werden kann
5. Nach jedem Schritt muss ein commit eingeplant werden
6. Der Plan muss als hierarchische Checkliste erstellt werden nach dem Muster

    - [ ] Schritt 1
       - [x] Teilschritt 1
       - [x] Teilschritt 2
       - [ ] Teilschritt 3
    - [ ] Schritt 2
       - [ ] Teilschritt 1
    ...

7. KEINE ÄNDERUNGEN am Code

## CODE Phase

das heißt:
1. führe ein initialen Lauf aller lokalen Tests durch, um eine saubere Baseline zu haben
2. Befolge exakt die Implementierungsschritte aus ./epcc_plan.md
3. aktuallisiere die Plan-Datei bei jedem Fortschritt. Auch nach Teilschritten.
4. Nach einem erfolgreichen Testlauf am Ende eines Schrittes kann für diese Schritt in die COMMIT Phase übergegangen werden

## COMMIT Phase

das heißt
1. Die Änderungen müssen in einer kurzen Commit Nachricht als Headline zusammengefasst werden
2. Die Teilschritte müssen dann in den folgenden Zeilen des Commits genannt werden
3. Sollten weitere Schritte nötig sein, wechsel für den nächsten Schritt wieder in die CODE Phase
