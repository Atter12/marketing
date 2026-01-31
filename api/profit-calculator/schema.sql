-- Schema para Calculadora Profit en Supabase
-- Ejecutar en el SQL Editor de Supabase

CREATE TABLE IF NOT EXISTS profit_calculations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR(255),
    user_id UUID,
    inputs JSONB NOT NULL DEFAULT '{}'::jsonb,
    results JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_profit_calculations_user_id ON profit_calculations(user_id);
CREATE INDEX IF NOT EXISTS idx_profit_calculations_created_at ON profit_calculations(created_at DESC);

CREATE OR REPLACE FUNCTION update_profit_calculations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_profit_calculations_updated_at_trigger ON profit_calculations;
CREATE TRIGGER update_profit_calculations_updated_at_trigger
    BEFORE UPDATE ON profit_calculations
    FOR EACH ROW
    EXECUTE FUNCTION update_profit_calculations_updated_at();

ALTER TABLE profit_calculations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read profit_calculations"
    ON profit_calculations FOR SELECT
    USING (true);

CREATE POLICY "Public can insert profit_calculations"
    ON profit_calculations FOR INSERT
    WITH CHECK (true);

CREATE POLICY "Public can update profit_calculations"
    ON profit_calculations FOR UPDATE
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Public can delete profit_calculations"
    ON profit_calculations FOR DELETE
    USING (true);

COMMENT ON TABLE profit_calculations IS 'Cálculos guardados de la Calculadora Profit (inputs y resultados)';
COMMENT ON COLUMN profit_calculations.inputs IS 'JSON: precioVenta, costoProducto, costoEnvio, gastoAds, unidadesVendidas';
COMMENT ON COLUMN profit_calculations.results IS 'JSON: margenUnidad, margenPct, ingresos, roas, profitNeto, roi, breakEven';
