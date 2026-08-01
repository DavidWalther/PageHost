--=============================================================================
-- 002_1 -- node aus story
--=============================================================================
--
-- Teil 1 von 6 der Datenkopie. Reihenfolge und Gesamtbild: ../README.md
--
-- Read-only auf story/chapter/paragraph und idempotent. Bewusst portabel:
-- kein Dollar-Quoting, keine temporaeren Objekte, kein "--" in Zeichenketten
-- und klein genug, dass kein Werkzeug die Datei abschneidet.
--

BEGIN;
-- Abbruch, wenn die app-Zeilen fehlen: dann faenden die JOINs weiter unten
-- nichts, und die Kopie waere still unvollstaendig. Die Division durch Null
-- bricht die Transaktion ab, bevor irgendetwas geschrieben wird
-- (ERROR: division by zero). Absicht, kein Versehen -- ein RAISE EXCEPTION
-- braeuchte PL/pgSQL und damit Dollar-Quoting.
SELECT count(*) AS app_zeilen, 1 / count(*) AS abbruch_wenn_leer FROM app;

------------------------------------------------------------------------------
-- 1. node <- story (Wurzelknoten)
------------------------------------------------------------------------------
--
-- is_parent_controls_visibility = false fuer ALLE Knoten, Wurzeln wie Kapitel:
-- das Altmodell kennt keine Vererbung, jede Zeile traegt ihre eigenen
-- App-Spalten. false plus eigene app_node-Zeilen reproduziert die Sichtbarkeit
-- exakt; true waere eine Verhaltensaenderung.
--
-- Im Zielmodell ist true der Default fuer NEUE Knoten -- Vererbung ist dort der
-- Normalfall. Die Umstellung der hier kopierten Knoten darauf ist bewusst ein
-- eigener, spaeterer Schritt und muss laufen, solange die alten Tabellen als
-- Referenz noch stehen (datamodel.md Abschnitt 4).
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

COMMIT;
