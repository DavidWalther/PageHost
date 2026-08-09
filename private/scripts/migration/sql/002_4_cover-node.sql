--=============================================================================
-- 002_4 -- cover_node_id nachziehen
--=============================================================================
--
-- Teil 4 von 6 der Datenkopie. Reihenfolge und Gesamtbild: ../README.md
--
-- Read-only auf story/chapter/paragraph und idempotent. Bewusst portabel:
-- kein Dollar-Quoting, keine temporaeren Objekte, kein "--" in Zeichenketten
-- und klein genug, dass kein Werkzeug die Datei abschneidet.
--

BEGIN;
------------------------------------------------------------------------------
-- 4. cover_node_id nachziehen
------------------------------------------------------------------------------
--
-- Erst nach dem Kapitel-Durchgang moeglich: story.coverid zeigt auf ein KAPITEL
-- (siehe bookstore.js), der Zielknoten existiert vorher noch nicht.
--

UPDATE node n
   SET cover_node_id = cover.id
  FROM story s
  JOIN node cover ON cover.legacy_id = s.coverid
 WHERE n.legacy_id = s.id
   AND s.coverid IS NOT NULL
   AND n.cover_node_id IS DISTINCT FROM cover.id;

COMMIT;
