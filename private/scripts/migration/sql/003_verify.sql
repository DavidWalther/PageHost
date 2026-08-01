--=============================================================================
-- 003 -- Kopie pruefen
--=============================================================================
--
-- Ausfuehren mit psql:
--   psql "$DATABASE_URL" -f 003_verify.sql
--
-- BRAUCHT PSQL oder eine SQL-Konsole: Die Datei besteht aus Abfragen, deren
-- ERGEBNIS die Aussage ist. Migrationswerkzeuge verwerfen Ergebnismengen und
-- kennen die \echo-Zeilen nicht. Wer kein psql hat, laesst die \echo-Zeilen weg
-- und liest die Abfragen der Reihe nach -- die Abschnittsnummern stehen als
-- Kommentar darueber.
--
-- Rein lesend. Bis auf die beiden ausdruecklich als "protokolliert"
-- gekennzeichneten Abschnitte (Waisen, Absatz-Abweichungen) muss JEDE Abfrage
-- eine LEERE Ergebnismenge liefern. Jede Zeile ist ein Befund.
--
-- Vor der Umschaltung des Lesepfads ein letztes Mal laufen lassen.
--

\echo '== 1. Abdeckung: was fehlt im neuen Modell? =============================='

\echo '-- 1a. Stories ohne node (erwartet: leer)'
SELECT s.id, s.name
  FROM story s
  LEFT JOIN node n ON n.legacy_id = s.id
 WHERE n.id IS NULL;

\echo '-- 1b. Kapitel mit existierender Story, aber ohne node (erwartet: leer)'
SELECT c.id, c.name, c.storyid
  FROM chapter c
  LEFT JOIN node n ON n.legacy_id = c.id
 WHERE n.id IS NULL
   AND EXISTS (SELECT 1 FROM story s WHERE s.id = c.storyid);

\echo '-- 1c. Absaetze mit existierendem Kapitel, aber ohne content_node (erwartet: leer)'
SELECT p.id, p.name, p.chapterid
  FROM paragraph p
  LEFT JOIN content_node cn ON cn.legacy_id = p.id
 WHERE cn.id IS NULL
   AND EXISTS (SELECT 1 FROM chapter c WHERE c.id = p.chapterid);

\echo '-- 1d. Knoten mit legacy_id, zu der es keine Altzeile gibt (erwartet: leer)'
SELECT n.id, n.legacy_id
  FROM node n
 WHERE n.legacy_id IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM story s   WHERE s.id = n.legacy_id)
   AND NOT EXISTS (SELECT 1 FROM chapter c WHERE c.id = n.legacy_id);

SELECT cn.id, cn.legacy_id
  FROM content_node cn
 WHERE cn.legacy_id IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM paragraph p WHERE p.id = cn.legacy_id);

\echo '== 2. Struktur ==========================================================='

\echo '-- 2a. Kapitelknoten, deren Parent nicht der Knoten seiner Story ist (erwartet: leer)'
SELECT n.id, n.legacy_id, n.parent_node_id, parent.legacy_id AS parent_legacy_id, c.storyid
  FROM chapter c
  JOIN node n ON n.legacy_id = c.id
  LEFT JOIN node parent ON parent.id = n.parent_node_id
 WHERE parent.legacy_id IS DISTINCT FROM c.storyid;

\echo '-- 2b. Storyknoten mit falschem oder fehlendem cover_node_id (erwartet: leer)'
SELECT n.id, n.legacy_id, n.cover_node_id, s.coverid
  FROM story s
  JOIN node n ON n.legacy_id = s.id
  LEFT JOIN node cover ON cover.id = n.cover_node_id
 WHERE cover.legacy_id IS DISTINCT FROM s.coverid;

\echo '-- 2c. content_node am falschen Knoten (erwartet: leer)'
SELECT cn.id, cn.legacy_id, n.legacy_id AS node_legacy_id, p.chapterid
  FROM paragraph p
  JOIN content_node cn ON cn.legacy_id = p.id
  LEFT JOIN node n ON n.id = cn.node_id
 WHERE n.legacy_id IS DISTINCT FROM p.chapterid;

\echo '-- 2d. Wurzelknoten mit Parent oder Kapitelknoten ohne Parent (erwartet: leer)'
SELECT n.id, n.legacy_id, n.parent_node_id
  FROM node n
 WHERE (n.legacy_id LIKE '000s%' AND n.parent_node_id IS NOT NULL)
    OR (n.legacy_id LIKE '000c%' AND n.parent_node_id IS NULL);

\echo '-- 2e. Vererbung: kein kopierter Knoten darf vom Parent kontrolliert werden (erwartet: leer)'
--
-- Das Altmodell kennt keine Vererbung. is_parent_controls_visibility = true
-- waere hier eine Verhaltensaenderung, keine Kopie.
--
-- ACHTUNG: Diese Pruefung und der Sichtbarkeitsvergleich in Abschnitt 5 setzen
-- beide voraus, dass NICHT geerbt wird. Werden die Bestandsknoten spaeter auf
-- Vererbung umgestellt, muessen beide auf die rekursive Form gezogen werden --
-- sie pruefen die Kopie, nicht das Laufzeitverhalten.
--
SELECT n.id, n.legacy_id, n.is_parent_controls_visibility
  FROM node n
 WHERE n.legacy_id IS NOT NULL
   AND n.is_parent_controls_visibility IS DISTINCT FROM false;

\echo '== 3. Felder ============================================================='

\echo '-- 3a. Story-Felder abweichend (erwartet: leer)'
SELECT s.id
  FROM story s
  JOIN node n ON n.legacy_id = s.id
 WHERE n.name           IS DISTINCT FROM s.name
    OR n.description    IS DISTINCT FROM s.description
    OR n.sortnumber     IS DISTINCT FROM s.sortnumber
    OR n.published_date IS DISTINCT FROM s.publishdate
    OR n.createddate    IS DISTINCT FROM s.createddate;

\echo '-- 3b. Kapitel-Felder abweichend (erwartet: leer)'
SELECT c.id
  FROM chapter c
  JOIN node n ON n.legacy_id = c.id
 WHERE n.name           IS DISTINCT FROM c.name
    OR n.sortnumber     IS DISTINCT FROM c.sortnumber
    OR n.reversed       IS DISTINCT FROM c.reversed
    OR n.published_date IS DISTINCT FROM c.publishdate
    OR n.createddate    IS DISTINCT FROM c.createddate;

\echo '-- 3c. Absatz-Felder abweichend (erwartet: leer)'
SELECT p.id
  FROM paragraph p
  JOIN content_node cn ON cn.legacy_id = p.id
 WHERE cn.name           IS DISTINCT FROM p.name
    OR cn.sortnumber     IS DISTINCT FROM p.sortnumber
    OR cn.published_date IS DISTINCT FROM p.publishdate
    OR cn.createddate    IS DISTINCT FROM p.createddate;

\echo '== 4. Inhalt ============================================================='

\echo '-- 4a. content_node ohne text-Item (erwartet: leer)'
SELECT cn.id, cn.legacy_id
  FROM content_node cn
 WHERE NOT EXISTS (
   SELECT 1 FROM content_item ci WHERE ci.content_node_id = cn.id AND ci.type = 'text'
 );

\echo '-- 4b. Item-Inhalte abweichend vom Absatz (erwartet: leer)'
SELECT p.id, ci.type
  FROM paragraph p
  JOIN content_node cn ON cn.legacy_id = p.id
  JOIN content_item ci ON ci.content_node_id = cn.id
 WHERE (ci.type = 'text' AND ci.content IS DISTINCT FROM p.content)
    OR (ci.type = 'html' AND ci.content IS DISTINCT FROM p.htmlcontent);

\echo '-- 4c. html-Item, obwohl htmlcontent leer war -- oder umgekehrt (erwartet: leer)'
SELECT p.id, p.htmlcontent
  FROM paragraph p
  JOIN content_node cn ON cn.legacy_id = p.id
 WHERE (nullif(p.htmlcontent, '') IS NOT NULL) <> EXISTS (
   SELECT 1 FROM content_item ci WHERE ci.content_node_id = cn.id AND ci.type = 'html'
 );

\echo '-- 4d. active_content_item zeigt nicht auf die Repraesentation, die das Frontend gewaehlt haette (erwartet: leer)'
--
-- Regel aus custom-paragraph.js: `htmlcontent ? 'html' : 'text'`. In JavaScript
-- ist '' falsy, ' ' aber truthy -- nullif(x, '') bildet das exakt ab.
--
SELECT p.id, ci.type AS aktiv,
       CASE WHEN nullif(p.htmlcontent, '') IS NOT NULL THEN 'html' ELSE 'text' END AS erwartet
  FROM paragraph p
  JOIN content_node cn ON cn.legacy_id = p.id
  LEFT JOIN content_item ci ON ci.id = cn.active_content_item
 WHERE ci.type IS DISTINCT FROM
       CASE WHEN nullif(p.htmlcontent, '') IS NOT NULL THEN 'html' ELSE 'text' END;

\echo '== 5. Sichtbarkeit: beide Modelle je App, symmetrisch ====================='
--
-- Links das alte Praedikat aus actions/get.js, rechts die Aufloesungsregel des
-- neuen Modells (datamodel.md Abschnitt 5). Die Vererbung ueber
-- is_parent_controls_visibility ist hier bewusst NICHT abgebildet: alle
-- kopierten Knoten tragen false (geprueft in 2e), der rekursive Zweig traegt
-- also nichts bei. Sobald Vererbung produktiv genutzt wird, gilt dieser
-- Vergleich nicht mehr -- er prueft die Kopie, nicht das Laufzeitverhalten.
--
-- Verglichen werden Rohzeilen, nicht der Lesepfad: der Publish-Filter und die
-- Erreichbarkeit eines Kapitels ueber seine Story bleiben aussen vor.
--

-- Beide Seiten stehen als CTE in jedem der zwei Statements, nicht als
-- temporaere View: eine TEMP-View gehoert zur Sitzung und waere fuer ein
-- Werkzeug, das ueber wechselnde Verbindungen arbeitet, im naechsten Statement
-- verschwunden.

\echo '-- 5a. alt sichtbar, neu nicht (erwartet: leer)'
WITH legacy_visible AS (
  SELECT a.name AS app, s.id AS legacy_id
    FROM app a
    JOIN story s
      ON (s.applicationincluded LIKE '%' || a.name || '%' OR s.applicationincluded = '*')
     AND (s.applicationexcluded IS NULL OR s.applicationexcluded NOT LIKE '%' || a.name || '%')
  UNION ALL
  SELECT a.name, c.id
    FROM app a
    JOIN chapter c
      ON (c.applicationincluded LIKE '%' || a.name || '%' OR c.applicationincluded = '*')
     AND (c.applicationexcluded IS NULL OR c.applicationexcluded NOT LIKE '%' || a.name || '%')
),
node_visible AS (
  SELECT a.name AS app, n.legacy_id
    FROM app a
    JOIN node n ON n.legacy_id IS NOT NULL
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
)
SELECT * FROM legacy_visible EXCEPT SELECT * FROM node_visible;

\echo '-- 5b. neu sichtbar, alt nicht (erwartet: leer)'
WITH legacy_visible AS (
  SELECT a.name AS app, s.id AS legacy_id
    FROM app a
    JOIN story s
      ON (s.applicationincluded LIKE '%' || a.name || '%' OR s.applicationincluded = '*')
     AND (s.applicationexcluded IS NULL OR s.applicationexcluded NOT LIKE '%' || a.name || '%')
  UNION ALL
  SELECT a.name, c.id
    FROM app a
    JOIN chapter c
      ON (c.applicationincluded LIKE '%' || a.name || '%' OR c.applicationincluded = '*')
     AND (c.applicationexcluded IS NULL OR c.applicationexcluded NOT LIKE '%' || a.name || '%')
),
node_visible AS (
  SELECT a.name AS app, n.legacy_id
    FROM app a
    JOIN node n ON n.legacy_id IS NOT NULL
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
)
SELECT * FROM node_visible EXCEPT SELECT * FROM legacy_visible;

\echo '== 6. Protokoll: erwartet NICHT leer ====================================='
--
-- Die folgenden Abschnitte sind kein Fehler, sondern die bewusst in Kauf
-- genommenen Abweichungen. Sie stehen hier, damit sie sichtbar bleiben.
--

\echo '-- 6a. Waisen: Kapitel ohne Story (nicht kopiert)'
SELECT c.id, c.name, c.storyid
  FROM chapter c
 WHERE NOT EXISTS (SELECT 1 FROM story s WHERE s.id = c.storyid);

\echo '-- 6b. Waisen: Absaetze ohne Kapitel (nicht kopiert)'
SELECT p.id, p.name, p.chapterid
  FROM paragraph p
 WHERE NOT EXISTS (SELECT 1 FROM chapter c WHERE c.id = p.chapterid);

\echo '-- 6c. Absaetze, deren App-Sichtbarkeit von ihrem Kapitel abweicht'
--
-- Im neuen Modell hat content_node KEINE eigene App-Zugehoerigkeit und folgt
-- seinem node (datamodel.md Abschnitt 8). Fuer die hier gelisteten Absaetze
-- aendert sich die Sichtbarkeit dadurch. Eingeschraenkt auf veroeffentlichte
-- Absaetze, deren Kapitel in der jeweiligen App ueberhaupt sichtbar ist --
-- alles andere ist ohne Wirkung.
--
SELECT a.name AS app, p.id AS paragraph_id, c.id AS chapter_id,
       p.applicationincluded AS p_included, p.applicationexcluded AS p_excluded,
       c.applicationincluded AS c_included, c.applicationexcluded AS c_excluded
  FROM app a
  CROSS JOIN paragraph p
  JOIN chapter c ON c.id = p.chapterid
 WHERE p.publishdate IS NOT NULL
   AND (
         (c.applicationincluded LIKE '%' || a.name || '%' OR c.applicationincluded = '*')
     AND (c.applicationexcluded IS NULL OR c.applicationexcluded NOT LIKE '%' || a.name || '%')
       )
   -- COALESCE, weil das alte Praedikat bei applicationincluded IS NULL nicht
   -- false, sondern NULL liefert -- ein NOT darauf wuerde die Zeile still
   -- verschlucken, obwohl genau das eine Abweichung ist.
   AND NOT COALESCE(
         (p.applicationincluded LIKE '%' || a.name || '%' OR p.applicationincluded = '*')
     AND (p.applicationexcluded IS NULL OR p.applicationexcluded NOT LIKE '%' || a.name || '%')
       , false)
 ORDER BY a.name, c.id, p.sortnumber;
