-- Add external feed API keys for Similarweb (RapidAPI) and Newspi
ALTER TABLE public.integrations
  ADD COLUMN IF NOT EXISTS similarweb_rapidapi_key text,
  ADD COLUMN IF NOT EXISTS newspi_api_key text;

COMMENT ON COLUMN public.integrations.similarweb_rapidapi_key IS 'RapidAPI key for Similarweb API Pro (Similar Sites, Website Overview)';
COMMENT ON COLUMN public.integrations.newspi_api_key IS 'Newspi provider key — reserved for direct news API when enabled';
