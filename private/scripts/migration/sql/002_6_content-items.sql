--=============================================================================
-- 002_6 -- content_item aus content und htmlcontent
--=============================================================================
--
-- Teil 6 von 6 der Datenkopie. Reihenfolge und Gesamtbild: ../README.md
--
-- Read-only auf story/chapter/paragraph und idempotent. Bewusst portabel:
-- kein Dollar-Quoting, keine temporaeren Objekte, kein "--" in Zeichenketten
-- und klein genug, dass kein Werkzeug die Datei abschneidet.
--

BEGIN;
------------------------------------------------------------------------------
-- 6. content_item <- content / htmlcontent
------------------------------------------------------------------------------
--
-- Je content_node eine text-Zeile, und nur bei gefuelltem htmlcontent
-- zusaetzlich eine html-Zeile. paragraph.createddate geht an content_node UND
-- content_item -- ein Item hat kein eigenes Anlagedatum im Altmodell.
--

INSERT INTO content_item (content, type, content_node_id, createddate)
SELECT p.content, 'text', cn.id, p.createddate
  FROM paragraph p
  JOIN content_node cn ON cn.legacy_id = p.id
 ORDER BY p.createddate, p.id
ON CONFLICT (content_node_id, type) DO NOTHING;

INSERT INTO content_item (content, type, content_node_id, createddate)
SELECT p.htmlcontent, 'html', cn.id, p.createddate
  FROM paragraph p
  JOIN content_node cn ON cn.legacy_id = p.id
 WHERE nullif(p.htmlcontent, '') IS NOT NULL
 ORDER BY p.createddate, p.id
ON CONFLICT (content_node_id, type) DO NOTHING;

COMMIT;
