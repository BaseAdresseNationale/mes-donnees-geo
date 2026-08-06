-- Enum des fonds de carte disponibles
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'basemap_kind') THEN
    CREATE TYPE basemap_kind AS ENUM ('openmaptiles', 'ortho', 'ign');
  END IF;
END $$;

-- Paramètres par commune (créés paresseusement à la première modification)
CREATE TABLE IF NOT EXISTS commune_settings (
  code_insee VARCHAR(5) PRIMARY KEY
    CHECK (code_insee ~ '^(?:2[AB]\d{3}|\d{5})$'),
  disabled_plugins TEXT[] NOT NULL DEFAULT '{}',
  basemap basemap_kind NOT NULL DEFAULT 'ortho',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Trigger de mise à jour de updated_at
CREATE OR REPLACE FUNCTION commune_settings_touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS commune_settings_updated_at ON commune_settings;
CREATE TRIGGER commune_settings_updated_at
BEFORE UPDATE ON commune_settings
FOR EACH ROW EXECUTE FUNCTION commune_settings_touch_updated_at();
