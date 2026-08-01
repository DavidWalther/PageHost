--=============================================================================
-- 002_5 -- content_node aus paragraph
--=============================================================================
--
-- Teil 5 von 6 der Datenkopie. Reihenfolge und Gesamtbild: ../README.md
--
-- Read-only auf story/chapter/paragraph und idempotent. Bewusst portabel:
-- kein Dollar-Quoting, keine temporaeren Objekte, kein "--" in Zeichenketten
-- und klein genug, dass kein Werkzeug die Datei abschneidet.
--

BEGIN;
------------------------------------------------------------------------------
-- 5. content_node <- paragraph
------------------------------------------------------------------------------
--
-- Die Kante ist chapterid, nicht storyid: paragraph.storyid ist redundant, und
-- ueber chapterid joint auch der heutige ChapterEndpoint.
--

INSERT INTO content_node (
  name, sortnumber, node_id, published_date, createddate, legacy_id
)
SELECT p.name, p.sortnumber, n.id, p.publishdate, p.createddate, p.id
  FROM paragraph p
  JOIN node n ON n.legacy_id = p.chapterid
 ORDER BY p.createddate, p.id
ON CONFLICT (legacy_id) DO NOTHING;

COMMIT;
