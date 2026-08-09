--=============================================================================
-- 002_2 -- node aus chapter
--=============================================================================
--
-- Teil 2 von 6 der Datenkopie. Reihenfolge und Gesamtbild: ../README.md
--
-- Read-only auf story/chapter/paragraph und idempotent. Bewusst portabel:
-- kein Dollar-Quoting, keine temporaeren Objekte, kein "--" in Zeichenketten
-- und klein genug, dass kein Werkzeug die Datei abschneidet.
--

BEGIN;
------------------------------------------------------------------------------
-- 2. node <- chapter (Kinder ihrer Story)
------------------------------------------------------------------------------
--
-- Die Eltern-Aufloesung laeuft set-basiert ueber legacy_id, nicht ueber eine
-- In-Memory-Map. Der JOIN ist zugleich der Waisen-Filter: ein Kapitel ohne
-- passende Story faellt heraus.
--

INSERT INTO node (
  name, sortnumber, reversed, is_parent_controls_visibility,
  published_date, createddate, legacy_id, parent_node_id
)
SELECT c.name, c.sortnumber, c.reversed, false,
       c.publishdate, c.createddate, c.id, p.id
  FROM chapter c
  JOIN node p ON p.legacy_id = c.storyid
 ORDER BY c.createddate, c.id
ON CONFLICT (legacy_id) DO NOTHING;

COMMIT;
