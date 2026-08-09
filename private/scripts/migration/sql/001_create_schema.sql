--=============================================================================
-- 001 -- Schema des neuen Datenmodells anlegen
--=============================================================================
--
-- Ausfuehren mit psql:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f 001_create_schema.sql
--
-- BRAUCHT PSQL: Die Datei enthaelt Dollar-Quoting ($$) fuer die beiden
-- Funktionen und drei DO-Bloecke. Werkzeuge, die Statements naiv an ';'
-- trennen, zerlegen die Funktionsrümpfe und scheitern. Anders als 002 ist das
-- hier nicht vermeidbar -- PL/pgSQL braucht Dollar-Quoting.
--
-- Diese Datei ist der schriftliche Stand dessen, was in der Datenbank bereits
-- von Hand angelegt wurde. Sie ist bewusst durchgaengig wiederholbar
-- (IF NOT EXISTS / WHERE NOT EXISTS): gegen eine Datenbank, in der das Schema
-- schon steht, ist ein Lauf ein No-op. Eine Abweichung zwischen dieser Datei
-- und dem Ist-Stand ist ein Befund, der zu klaeren ist -- nicht etwas, das die
-- Datei stillschweigend nachzieht.
--
-- Additiv: die alten Tabellen story/chapter/paragraph werden nicht angefasst.
-- Konzept und Begruendung der Entscheidungen: doc/datamodel-overhaul/datamodel.md
--
-- Abgleich gegen den Ist-Stand:
--   psql "$DATABASE_URL" -c '\d node' -c '\d app_node' -c '\d content_node' \
--                        -c '\d content_item' -c '\d app'
--

BEGIN;

------------------------------------------------------------------------------
-- Id-Vergabe
------------------------------------------------------------------------------
--
-- Beide Funktionen existieren bereits (die alten Tabellen benutzen sie). Sie
-- stehen hier, damit die Datei eine leere Datenbank vollstaendig aufbauen kann.
-- CREATE OR REPLACE ist gegen den Bestand wirkungslos, solange der Rumpf gleich
-- bleibt.
--

CREATE OR REPLACE FUNCTION public.generate_custom_id(objectprefix character varying, recordnumber integer) RETURNS character varying
    LANGUAGE plpgsql
    AS $$
DECLARE
    custom_id VARCHAR(18);
BEGIN
    IF LENGTH(objectPrefix) != 4 THEN
        RAISE EXCEPTION 'objectPrefix must be exactly 4 characters';
    END IF;

    custom_id := objectPrefix || LPAD(recordNumber::TEXT, 14, '0');

    IF LENGTH(custom_id) != 18 THEN
        RAISE EXCEPTION 'Generated ID must be exactly 18 characters';
    END IF;

    RETURN custom_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_table_id() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    table_prefix TEXT;
BEGIN
    SELECT prefix INTO table_prefix
    FROM table_prefixes
    WHERE table_name = TG_TABLE_NAME;

    IF table_prefix IS NULL THEN
        table_prefix := '000x';
    END IF;

    NEW.id := generate_custom_id(table_prefix, NEW.recordnumber);
    RETURN NEW;
END;
$$;

------------------------------------------------------------------------------
-- Tabellen
------------------------------------------------------------------------------
--
-- Die Beziehungen kommen weiter unten per ALTER TABLE: content_node und
-- content_item verweisen aufeinander, beim CREATE existiert also immer eine
-- der beiden Tabellen noch nicht.
--

-- name traegt den Wert aus APPLICATION_APPLICATION_KEY und ist damit der
-- Lookup-Schluessel der App, kein Anzeigename -> UNIQUE NOT NULL. Ein
-- Umbenennen ist eine Migration (Env-Dateien, Cache-Praefixe), kein Edit.
CREATE TABLE IF NOT EXISTS app (
  id            varchar(18) PRIMARY KEY NOT NULL,
  name          text UNIQUE NOT NULL,
  recordnumber  serial NOT NULL,
  createddate   timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Typfrei: keine type/level-Spalte. cover_node_id, reversed und description sind
-- optionale Eigenschaften JEDES Knotens (frueher story.coverid, chapter.reversed
-- bzw. story.description).
CREATE TABLE IF NOT EXISTS node (
  id                            varchar(18) PRIMARY KEY NOT NULL,
  name                          text,
  description                   text,
  is_parent_controls_visibility boolean,
  sortnumber                    integer,
  reversed                      boolean,
  legacy_id                     varchar(18) UNIQUE,   -- alte 000s…/000c…-Id (Deep-Links)
  recordnumber                  serial NOT NULL,
  createddate                   timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
  published_date                timestamp without time zone
);

-- app_id IS NULL = Wildcard (gilt fuer alle Apps, auch kuenftige).
CREATE TABLE IF NOT EXISTS app_node (
  id            varchar(18) PRIMARY KEY NOT NULL,
  relation      text NOT NULL CHECK (relation IN ('include', 'exclude')),
  recordnumber  serial NOT NULL,
  createddate   timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Kein is_parent_controls_visibility: die Sichtbarkeit kontrolliert immer der node.
CREATE TABLE IF NOT EXISTS content_node (
  id              varchar(18) PRIMARY KEY NOT NULL,
  name            text,
  sortnumber      integer,
  legacy_id       varchar(18) UNIQUE,   -- alte 000p…-Id (Deep-Links)
  recordnumber    serial NOT NULL,
  createddate     timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
  published_date  timestamp without time zone
);

-- Reiner Payload: keine eigene Sichtbarkeits-/Publish-Spalte.
CREATE TABLE IF NOT EXISTS content_item (
  id            varchar(18) PRIMARY KEY NOT NULL,
  content       text,
  type          text CHECK (type IN ('text', 'html', 'markdown', 'mermaid')),
  recordnumber  serial NOT NULL,
  createddate   timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

------------------------------------------------------------------------------
-- Beziehungen
------------------------------------------------------------------------------
--
-- Durchgaengig ON DELETE RESTRICT: nichts kaskadiert, geloescht wird bottom-up
-- (Loeschreihenfolge in datamodel.md Abschnitt 3).
--

ALTER TABLE node
  ADD COLUMN IF NOT EXISTS parent_node_id varchar(18) REFERENCES node(id) ON DELETE RESTRICT;
ALTER TABLE node
  ADD COLUMN IF NOT EXISTS cover_node_id  varchar(18) REFERENCES node(id) ON DELETE RESTRICT;

ALTER TABLE app_node
  ADD COLUMN IF NOT EXISTS node_id varchar(18) NOT NULL REFERENCES node(id) ON DELETE RESTRICT;
ALTER TABLE app_node
  ADD COLUMN IF NOT EXISTS app_id  varchar(18) REFERENCES app(id) ON DELETE RESTRICT;

ALTER TABLE content_node
  ADD COLUMN IF NOT EXISTS node_id varchar(18) REFERENCES node(id) ON DELETE RESTRICT;

-- DEFERRABLE wegen des zirkulaeren Zeigers content_node <-> content_item: der
-- Zeiger darf innerhalb einer Transaktion vor dem Item gesetzt werden.
--
-- Gotcha: DEFERRABLE verschiebt nur die Existenzpruefung beim INSERT/UPDATE.
-- ON DELETE RESTRICT ist NICHT aufschiebbar und greift sofort -- ein
-- content_item laesst sich also erst loeschen, wenn dieser Zeiger vorher
-- genullt oder umgebogen wurde.
ALTER TABLE content_node
  ADD COLUMN IF NOT EXISTS active_content_item varchar(18)
    REFERENCES content_item(id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED;

ALTER TABLE content_item
  ADD COLUMN IF NOT EXISTS content_node_id varchar(18) REFERENCES content_node(id) ON DELETE RESTRICT;

-- Solange es keine Versionierung gibt: je content_node hoechstens ein Item pro type.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'content_item_node_type_unique'
  ) THEN
    ALTER TABLE content_item
      ADD CONSTRAINT content_item_node_type_unique UNIQUE (content_node_id, type);
  END IF;
END $$;

------------------------------------------------------------------------------
-- Indizes
------------------------------------------------------------------------------
--
-- Eindeutigkeit von app_node inkl. Wildcard-Zeilen: zwei partielle Indizes
-- statt UNIQUE NULLS NOT DISTINCT, damit es auch vor PG 15 funktioniert.
--
-- Wichtig fuer die Kopie: ON CONFLICT braucht bei partiellen Indizes dasselbe
-- Praedikat wie der Index, sonst findet Postgres ihn nicht (siehe 002).
--

CREATE UNIQUE INDEX IF NOT EXISTS idx_app_node_unique_wildcard ON app_node (node_id, relation)         WHERE app_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_app_node_unique_specific ON app_node (app_id, node_id, relation) WHERE app_id IS NOT NULL;

-- FK-Spalten indizieren (Postgres legt das nicht automatisch an). Der Index auf
-- parent_node_id traegt die rekursive Baum-/Sichtbarkeitsabfrage.
CREATE INDEX IF NOT EXISTS idx_node_parent        ON node(parent_node_id);
CREATE INDEX IF NOT EXISTS idx_node_cover         ON node(cover_node_id);
CREATE INDEX IF NOT EXISTS idx_app_node_node      ON app_node(node_id);
CREATE INDEX IF NOT EXISTS idx_app_node_app       ON app_node(app_id);
CREATE INDEX IF NOT EXISTS idx_content_node_node  ON content_node(node_id);
CREATE INDEX IF NOT EXISTS idx_content_item_cnode ON content_item(content_node_id);

------------------------------------------------------------------------------
-- Id-Praefixe und Trigger
------------------------------------------------------------------------------

INSERT INTO table_prefixes (table_name, prefix)
SELECT v.table_name, v.prefix
  FROM (VALUES
         ('app',          '00ap'),
         ('app_node',     '00an'),
         ('node',         '000n'),
         ('content_node', '00cn'),
         ('content_item', '00ci')
       ) AS v(table_name, prefix)
 WHERE NOT EXISTS (
   SELECT 1 FROM table_prefixes t WHERE t.table_name = v.table_name
 );

-- CREATE TRIGGER kennt kein IF NOT EXISTS.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_app_id') THEN
    CREATE TRIGGER set_app_id
      BEFORE INSERT ON app FOR EACH ROW EXECUTE FUNCTION set_table_id();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_node_id') THEN
    CREATE TRIGGER set_node_id
      BEFORE INSERT ON node FOR EACH ROW EXECUTE FUNCTION set_table_id();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_app_node_id') THEN
    CREATE TRIGGER set_app_node_id
      BEFORE INSERT ON app_node FOR EACH ROW EXECUTE FUNCTION set_table_id();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_content_node_id') THEN
    CREATE TRIGGER set_content_node_id
      BEFORE INSERT ON content_node FOR EACH ROW EXECUTE FUNCTION set_table_id();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_content_item_id') THEN
    CREATE TRIGGER set_content_item_id
      BEFORE INSERT ON content_item FOR EACH ROW EXECUTE FUNCTION set_table_id();
  END IF;
END $$;

COMMIT;
