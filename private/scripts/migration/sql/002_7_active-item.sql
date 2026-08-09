--=============================================================================
-- 002_7 -- active_content_item setzen
--=============================================================================
--
-- Teil 7 von 6 der Datenkopie. Reihenfolge und Gesamtbild: ../README.md
--
-- Read-only auf story/chapter/paragraph und idempotent. Bewusst portabel:
-- kein Dollar-Quoting, keine temporaeren Objekte, kein "--" in Zeichenketten
-- und klein genug, dass kein Werkzeug die Datei abschneidet.
--

BEGIN;
------------------------------------------------------------------------------
-- 7. active_content_item setzen
------------------------------------------------------------------------------
--
-- Aktives Item nach JAVASCRIPT-Wahrheit, nicht nach SQL-Wahrheit. Die Regel
-- steht in custom-paragraph.js: `htmlcontent ? 'html' : 'text'`. In JavaScript
-- ist '' falsy, ' ' (Leerzeichen) aber TRUTHY -- nullif(x, '') bildet genau das
-- ab. Ein trim() wuerde bei Whitespace-only-HTML die Darstellung umschalten.
--

UPDATE content_node cn
   SET active_content_item = ci.id
  FROM paragraph p, content_item ci
 WHERE cn.legacy_id = p.id
   AND ci.content_node_id = cn.id
   AND ci.type = CASE
                   WHEN nullif(p.htmlcontent, '') IS NOT NULL THEN 'html'
                   ELSE 'text'
                 END
   AND cn.active_content_item IS DISTINCT FROM ci.id;

COMMIT;
