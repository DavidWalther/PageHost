--=============================================================================
-- 002_3 -- app_node aus den App-Spalten
--=============================================================================
--
-- Teil 3 von 6 der Datenkopie. Reihenfolge und Gesamtbild: ../README.md
--
-- Read-only auf story/chapter/paragraph und idempotent. Bewusst portabel:
-- kein Dollar-Quoting, keine temporaeren Objekte, kein "--" in Zeichenketten
-- und klein genug, dass kein Werkzeug die Datei abschneidet.
--

BEGIN;
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

-- Die Quelle steht dreimal als CTE statt einmal als temporaere View: eine
-- TEMP-View gehoert zur Sitzung, und Werkzeuge, die Statements ueber wechselnde
-- Verbindungen schicken, faenden sie im naechsten Statement nicht mehr.

-- include, spezifisch
WITH legacy_app_columns AS (
  SELECT n.id AS node_id,
         s.applicationincluded AS included,
         s.applicationexcluded AS excluded
    FROM node n
    JOIN story s ON s.id = n.legacy_id
  UNION ALL
  SELECT n.id, c.applicationincluded, c.applicationexcluded
    FROM node n
    JOIN chapter c ON c.id = n.legacy_id
)
INSERT INTO app_node (app_id, node_id, relation)
SELECT a.id, l.node_id, 'include'
  FROM legacy_app_columns l
  JOIN app a ON l.included LIKE '%' || a.name || '%'
 WHERE l.included IS DISTINCT FROM '*'
ON CONFLICT (app_id, node_id, relation) WHERE app_id IS NOT NULL DO NOTHING;

-- include, Wildcard ('*' -> app_id IS NULL)
WITH legacy_app_columns AS (
  SELECT n.id AS node_id,
         s.applicationincluded AS included,
         s.applicationexcluded AS excluded
    FROM node n
    JOIN story s ON s.id = n.legacy_id
  UNION ALL
  SELECT n.id, c.applicationincluded, c.applicationexcluded
    FROM node n
    JOIN chapter c ON c.id = n.legacy_id
)
INSERT INTO app_node (app_id, node_id, relation)
SELECT NULL, l.node_id, 'include'
  FROM legacy_app_columns l
 WHERE l.included = '*'
ON CONFLICT (node_id, relation) WHERE app_id IS NULL DO NOTHING;

-- exclude (schlaegt include)
WITH legacy_app_columns AS (
  SELECT n.id AS node_id,
         s.applicationincluded AS included,
         s.applicationexcluded AS excluded
    FROM node n
    JOIN story s ON s.id = n.legacy_id
  UNION ALL
  SELECT n.id, c.applicationincluded, c.applicationexcluded
    FROM node n
    JOIN chapter c ON c.id = n.legacy_id
)
INSERT INTO app_node (app_id, node_id, relation)
SELECT a.id, l.node_id, 'exclude'
  FROM legacy_app_columns l
  JOIN app a ON l.excluded LIKE '%' || a.name || '%'
ON CONFLICT (app_id, node_id, relation) WHERE app_id IS NOT NULL DO NOTHING;

COMMIT;
