--=============================================================================
-- 002 -- Bestandsdaten aus story/chapter/paragraph in das neue Modell kopieren
--=============================================================================
--
-- Ausfuehren mit psql (setzt 001 und die app-Zeilen voraus):
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f 002_copy_legacy_to_node.sql
--
-- Eigenschaften:
--   * READ-ONLY auf story/chapter/paragraph. Die alten Tabellen werden nicht
--     angefasst -- ein Rollback betrifft nur die neuen Tabellen.
--   * IDEMPOTENT ueber ON CONFLICT … DO NOTHING auf legacy_id bzw. den
--     app_node-Unique-Indizes. Ein zweiter Lauf zieht nur nach, was fehlt.
--   * Reihenfolge top-down erzwungen: parent_node_id ist ein FK, und die Ids
--     entstehen erst im BEFORE-INSERT-Trigger. Die Vollstaendigkeit prueft
--     dagegen 003 bottom-up -- ein Baum-Walk kann nicht finden, was gar nicht
--     am Baum haengt.
--
-- Die app-Zeilen werden NICHT hier angelegt: es sind eine Handvoll Schluessel,
-- die von Hand eingetragen werden. Ein '*' erzeugt dabei bewusst KEINE app-Zeile,
-- sondern spaeter app_id IS NULL -- eine App namens '*' wuerde mit der Regel
-- "spezifisch schlaegt Wildcard" kollidieren.
--
-- Waisen (Kapitel ohne Story, Absaetze ohne Kapitel) werden NICHT mitkopiert:
-- die JOINs unten lassen sie fallen. Im Altmodell sind sie unerreichbar; sie ins
-- neue Modell zu heben wuerde sie erstmals sichtbar machen. 003 protokolliert sie.
--

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM app) THEN
    RAISE EXCEPTION 'Tabelle app ist leer -- die App-Schluessel muessen vor der Kopie eingetragen sein';
  END IF;
END $$;

------------------------------------------------------------------------------
-- 1. node <- story (Wurzelknoten)
------------------------------------------------------------------------------
--
-- is_parent_controls_visibility = false fuer ALLE Knoten, Wurzeln wie Kapitel:
-- das Altmodell kennt keine Vererbung, jede Zeile traegt ihre eigenen
-- App-Spalten. false plus eigene app_node-Zeilen reproduziert die Sichtbarkeit
-- exakt; true waere eine Verhaltensaenderung.
--
-- createddate wird uebernommen, nicht dem DEFAULT ueberlassen. recordnumber
-- dagegen NICHT: daraus leitet set_table_id() die neue Id ab. Das ORDER BY
-- sorgt dafuer, dass die neuen Ids in der Reihenfolge der urspruenglichen
-- Anlage laufen.
--

INSERT INTO node (
  name, description, sortnumber, is_parent_controls_visibility,
  published_date, createddate, legacy_id
)
SELECT s.name, s.description, s.sortnumber, false,
       s.publishdate, s.createddate, s.id
  FROM story s
 ORDER BY s.createddate, s.id
ON CONFLICT (legacy_id) DO NOTHING;

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

------------------------------------------------------------------------------
-- 3. app_node <- applicationincluded / applicationexcluded
------------------------------------------------------------------------------
--
-- NICHT durch Parsen des Feldes, sondern durch Nachspielen des alten Praedikats
-- aus actions/get.js:
--
--   (applicationIncluded LIKE '%K%' OR applicationIncluded = '*')
--   AND (applicationExcluded IS NULL OR applicationExcluded NOT LIKE '%K%')
--
-- Das Feld kann mehrere Schluessel mit unbekanntem Trennzeichen enthalten --
-- gelesen wird nur per Substring-Match, im Code gibt es kein Split. Der JOIN
-- ersetzt den Parser und ist damit separator-agnostisch. Er uebertraegt den
-- Ist-Zustand exakt, inklusive der Fehlmatches, die das Substring-Matching
-- heute erzeugt (ein Schluessel, der Teilstring eines anderen ist).
--
-- Story- und Kapitelknoten brauchen beide eigene Zeilen: mit
-- is_parent_controls_visibility = false erbt kein Knoten von seinem Parent.
--

CREATE TEMP VIEW legacy_app_columns AS
SELECT n.id AS node_id,
       s.applicationincluded AS included,
       s.applicationexcluded AS excluded
  FROM node n
  JOIN story s ON s.id = n.legacy_id
UNION ALL
SELECT n.id, c.applicationincluded, c.applicationexcluded
  FROM node n
  JOIN chapter c ON c.id = n.legacy_id;

-- include, spezifisch
INSERT INTO app_node (app_id, node_id, relation)
SELECT a.id, l.node_id, 'include'
  FROM legacy_app_columns l
  JOIN app a ON l.included LIKE '%' || a.name || '%'
 WHERE l.included IS DISTINCT FROM '*'
ON CONFLICT (app_id, node_id, relation) WHERE app_id IS NOT NULL DO NOTHING;

-- include, Wildcard ('*' -> app_id IS NULL)
INSERT INTO app_node (app_id, node_id, relation)
SELECT NULL, l.node_id, 'include'
  FROM legacy_app_columns l
 WHERE l.included = '*'
ON CONFLICT (node_id, relation) WHERE app_id IS NULL DO NOTHING;

-- exclude (schlaegt include)
INSERT INTO app_node (app_id, node_id, relation)
SELECT a.id, l.node_id, 'exclude'
  FROM legacy_app_columns l
  JOIN app a ON l.excluded LIKE '%' || a.name || '%'
ON CONFLICT (app_id, node_id, relation) WHERE app_id IS NOT NULL DO NOTHING;

DROP VIEW legacy_app_columns;

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
