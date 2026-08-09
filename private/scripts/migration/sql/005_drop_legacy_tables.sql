--=============================================================================
-- 005 -- Alte Tabellen entfernen
--=============================================================================
--
-- Gesamtbild und Reihenfolge: ../README.md
--
-- PUNKT OHNE RUECKKEHR. Vorher ein Backup, und zwar eines, das auch wirklich
-- wiederhergestellt werden kann. Danach ist der Vergleich beider Modelle
-- (003, Abschnitt 5) fuer immer weg.
--
-- Voraussetzungen, die vorher stimmen muessen:
--
--   1. 003_verify.sql laeuft ohne Befund (Abschnitte 1-5 leer).
--   2. 004_inherit_visibility.sql ist gelaufen -- danach nicht mehr moeglich.
--   3. Der Code liest und schreibt seit Schritt 13 ausschliesslich ueber
--      node / content_node / content_item. Kein Codepfad fasst diese drei
--      Tabellen noch an.
--
-- BETRIFFT NUR story, chapter und paragraph.
--
-- configuration und identity BLEIBEN. Sie waren nie Teil der Umstellung
-- (datamodel.md Abschnitt 2 fuehrt sie nicht auf), tragen weiterhin
-- applicationincluded und werden weiterhin ueber DataStorage gelesen und
-- geschrieben.
--

BEGIN;

------------------------------------------------------------------------------
-- Letzte Gegenprobe: ist jede alte Zeile im neuen Modell angekommen?
------------------------------------------------------------------------------
--
-- Absichtlich hier und nicht nur in 003: wer diese Datei ausfuehrt, soll die
-- Zahlen unmittelbar davor sehen. Stimmen sie nicht, ROLLBACK statt COMMIT.
--
\echo '-- Abdeckung (erwartet: jeweils 0 fehlend)'
SELECT
  (SELECT count(*) FROM story)                             AS storys,
  (SELECT count(*) FROM story s
    WHERE NOT EXISTS (SELECT 1 FROM node n WHERE n.legacy_id = s.id))
                                                           AS storys_fehlend,
  (SELECT count(*) FROM chapter)                           AS kapitel,
  (SELECT count(*) FROM chapter c
    WHERE NOT EXISTS (SELECT 1 FROM node n WHERE n.legacy_id = c.id))
                                                           AS kapitel_fehlend,
  (SELECT count(*) FROM paragraph)                         AS absaetze,
  (SELECT count(*) FROM paragraph p
    WHERE NOT EXISTS (
      SELECT 1 FROM content_node cn WHERE cn.legacy_id = p.id))
                                                           AS absaetze_fehlend;

------------------------------------------------------------------------------
-- Loeschen
------------------------------------------------------------------------------
--
-- Keine Reihenfolge noetig: zwischen den drei alten Tabellen gibt es
-- ueberhaupt keine Fremdschluessel -- genau deshalb konnten dort verwaiste
-- Absaetze entstehen. Ihre Trigger und Sequenzen fallen mit DROP TABLE.
--
DROP TABLE IF EXISTS paragraph;
DROP TABLE IF EXISTS chapter;
DROP TABLE IF EXISTS story;

-- Die Id-Praefixe der alten Tabellen. Der Trigger, der sie gelesen hat, ist
-- mit den Tabellen weg; der Eintrag waere nur noch irrefuehrend.
DELETE FROM table_prefixes
 WHERE table_name IN ('story', 'chapter', 'paragraph');

\echo '-- Verbliebene Tabellen des Inhaltsmodells:'
SELECT table_name
  FROM information_schema.tables
 WHERE table_schema = 'public'
   AND table_name IN (
     'app', 'app_node', 'node', 'content_node', 'content_item',
     'configuration', 'identity',
     'story', 'chapter', 'paragraph'
   )
 ORDER BY table_name;

COMMIT;

-- Die Spalte legacy_id bleibt auf node und content_node. Sie ist ab jetzt der
-- einzige Ort, an dem eine alte Id noch aufloesbar ist -- Deep-Links von
-- frueher haengen daran. Sie kostet eine Spalte und einen Unique-Index.
