--=============================================================================
-- 004 -- Bestandsknoten auf Vererbung umstellen
--=============================================================================
--
-- Gesamtbild und Reihenfolge: ../README.md
--
-- MUSS LAUFEN, SOLANGE story/chapter/paragraph NOCH STEHEN. Danach fehlt die
-- Referenz, gegen die sich das Ergebnis pruefen laesst (003, Abschnitt 5).
--
-- Die Kopie hat jedem Knoten eine eigene app_node-Zeile gegeben und
-- is_parent_controls_visibility = false gesetzt. Das war die woertliche
-- Uebersetzung des Altmodells, das keine Vererbung kennt -- nicht das
-- Zielmodell. Dort ist Vererbung der Normalfall (datamodel.md Abschnitt 4).
--
-- Umgestellt wird nur, wo sich dadurch NICHTS aendert: fuer jede App muss die
-- heutige Sichtbarkeit des Kindes genau der entsprechen, die es nach der
-- Umstellung haette. Und die ist:
--
--   sichtbar(Parent, A) UND NICHT ausgeschlossen(Kind, A)
--
-- exclude-Zeilen bleiben stehen. Sie wirken unabhaengig vom Flag und sind der
-- Grund, warum der reale Fall "Story ueberall, ein Kapitel fuer App X
-- ausgenommen" nach der Umstellung true PLUS exclude-Zeile ist.
--
-- Idempotent: die Aufloesung ist rekursiv und damit auch dann richtig, wenn
-- schon ein Teil der Knoten erbt. Ein zweiter Lauf findet nichts mehr.
--
-- Braucht psql (TEMP-Tabelle, \echo). Rein additiv ist die Datei NICHT: sie
-- aendert node und loescht app_node-Zeilen. Vorher ein Backup.
--

BEGIN;

------------------------------------------------------------------------------
-- Aufgeloeste Sichtbarkeit je (App, Knoten) -- die Regel aus datamodel.md 5
------------------------------------------------------------------------------
--
-- Anker: jeder Knoten mit eigener include-Zeile (spezifisch oder Wildcard) und
-- ohne exclude. Rekursion: Kinder, die vom Parent kontrolliert werden und
-- selbst nicht ausgeschlossen sind. Der path-Guard bricht Zyklen ab -- vom
-- Anker aus sind sie zwar unerreichbar, aber die Abfrage soll auch dann
-- terminieren, wenn jemand sie anders verankert.
--
CREATE TEMP TABLE resolved_visibility ON COMMIT DROP AS
WITH RECURSIVE reachable AS (
  SELECT a.id AS app_id, n.id AS node_id, ARRAY[n.id]::varchar[] AS path
    FROM app a
    JOIN node n ON TRUE
   WHERE EXISTS (
           SELECT 1 FROM app_node i
            WHERE i.node_id = n.id AND i.relation = 'include'
              AND (i.app_id = a.id OR i.app_id IS NULL)
         )
     AND NOT EXISTS (
           SELECT 1 FROM app_node e
            WHERE e.node_id = n.id AND e.relation = 'exclude'
              AND (e.app_id = a.id OR e.app_id IS NULL)
         )
  UNION ALL
  SELECT r.app_id, c.id, r.path || c.id
    FROM reachable r
    JOIN node c ON c.parent_node_id = r.node_id
   WHERE c.is_parent_controls_visibility
     AND NOT c.id = ANY(r.path)
     AND NOT EXISTS (
           SELECT 1 FROM app_node e
            WHERE e.node_id = c.id AND e.relation = 'exclude'
              AND (e.app_id = r.app_id OR e.app_id IS NULL)
         )
)
SELECT DISTINCT app_id, node_id FROM reachable;

------------------------------------------------------------------------------
-- Kandidaten: Knoten mit Parent, die noch nicht erben
------------------------------------------------------------------------------
CREATE TEMP TABLE inheritance_candidate ON COMMIT DROP AS
SELECT n.id AS node_id, n.parent_node_id, n.legacy_id
  FROM node n
 WHERE n.parent_node_id IS NOT NULL
   AND n.is_parent_controls_visibility IS DISTINCT FROM true;

------------------------------------------------------------------------------
-- Wer nicht umgestellt werden darf: mindestens eine App sieht es anders
------------------------------------------------------------------------------
CREATE TEMP TABLE inheritance_blocked ON COMMIT DROP AS
SELECT DISTINCT c.node_id
  FROM inheritance_candidate c
  CROSS JOIN app a
 WHERE EXISTS (
         SELECT 1 FROM resolved_visibility v
          WHERE v.app_id = a.id AND v.node_id = c.node_id
       )
    IS DISTINCT FROM (
         EXISTS (
           SELECT 1 FROM resolved_visibility v
            WHERE v.app_id = a.id AND v.node_id = c.parent_node_id
         )
         AND NOT EXISTS (
           SELECT 1 FROM app_node e
            WHERE e.node_id = c.node_id AND e.relation = 'exclude'
              AND (e.app_id = a.id OR e.app_id IS NULL)
         )
       );

\echo '-- Kandidaten insgesamt / davon blockiert:'
SELECT
  (SELECT count(*) FROM inheritance_candidate) AS kandidaten,
  (SELECT count(*) FROM inheritance_blocked)   AS blockiert;

\echo '-- Blockierte Knoten (bleiben mit eigener include-Zeile stehen):'
SELECT c.node_id, c.legacy_id
  FROM inheritance_candidate c
  JOIN inheritance_blocked b ON b.node_id = c.node_id
 ORDER BY c.legacy_id;

------------------------------------------------------------------------------
-- Umstellen
------------------------------------------------------------------------------
CREATE TEMP TABLE inheritance_applied ON COMMIT DROP AS
SELECT c.node_id
  FROM inheritance_candidate c
 WHERE NOT EXISTS (
         SELECT 1 FROM inheritance_blocked b WHERE b.node_id = c.node_id
       );

UPDATE node
   SET is_parent_controls_visibility = true
 WHERE id IN (SELECT node_id FROM inheritance_applied);

-- Nur include faellt weg. exclude wirkt unabhaengig vom Flag und traegt den
-- per-App-Ausschluss, der sonst verloren ginge.
DELETE FROM app_node
 WHERE relation = 'include'
   AND node_id IN (SELECT node_id FROM inheritance_applied);

\echo '-- Umgestellt / verbliebene app_node-Zeilen:'
SELECT
  (SELECT count(*) FROM inheritance_applied) AS umgestellt,
  (SELECT count(*) FROM app_node WHERE relation = 'include') AS include_zeilen,
  (SELECT count(*) FROM app_node WHERE relation = 'exclude') AS exclude_zeilen;

COMMIT;

-- Danach 003_verify.sql laufen lassen: Abschnitt 5 vergleicht die aufgeloeste
-- Sichtbarkeit beider Modelle und muss weiterhin leer bleiben. Genau das ist
-- der Nachweis, dass sich nichts geaendert hat.
