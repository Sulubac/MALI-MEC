-- PNGA PostgreSQL Initial Setup
-- République de Djibouti - Plateforme Nationale de Gestion des Archives

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "unaccent";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";

-- Full-text search configuration for French
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_ts_config WHERE cfgname = 'french_unaccent') THEN
    CREATE TEXT SEARCH CONFIGURATION french_unaccent (COPY = french);
    ALTER TEXT SEARCH CONFIGURATION french_unaccent
      ALTER MAPPING FOR hword, hword_part, word WITH unaccent, french_stem;
  END IF;
END $$;

-- Performance settings
ALTER SYSTEM SET shared_buffers = '256MB';
ALTER SYSTEM SET effective_cache_size = '1GB';
ALTER SYSTEM SET maintenance_work_mem = '128MB';
ALTER SYSTEM SET checkpoint_completion_target = 0.9;
ALTER SYSTEM SET wal_buffers = '16MB';
ALTER SYSTEM SET default_statistics_target = 100;
ALTER SYSTEM SET random_page_cost = 1.1;
ALTER SYSTEM SET effective_io_concurrency = 200;

-- Audit log function for tamper-evident audit trail
CREATE OR REPLACE FUNCTION generate_audit_hash()
RETURNS TRIGGER AS $$
BEGIN
  NEW.hash_chain := encode(
    digest(
      COALESCE(NEW.user_id::text, '') ||
      NEW.action ||
      NEW.resource_type ||
      COALESCE(NEW.resource_id, '') ||
      NEW.created_at::text,
      'sha256'
    ),
    'hex'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Document search vector update function
CREATE OR REPLACE FUNCTION update_document_search_vector()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector := to_tsvector('french_unaccent',
    COALESCE(NEW.title, '') || ' ' ||
    COALESCE(NEW.title_ar, '') || ' ' ||
    COALESCE(NEW.description, '') || ' ' ||
    COALESCE(NEW.content_text, '') || ' ' ||
    COALESCE(NEW.author, '') || ' ' ||
    COALESCE(NEW.document_number, '') || ' ' ||
    COALESCE(NEW.reference, '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON DATABASE pnga_db IS 'PNGA - Plateforme Nationale de Gestion des Archives - République de Djibouti';
