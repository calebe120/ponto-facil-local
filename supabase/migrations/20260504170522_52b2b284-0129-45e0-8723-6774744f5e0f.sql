
-- Delete duplicates keeping the oldest (only for status 'aberto' to be safe; but include all to dedupe by created_at)
WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (PARTITION BY conta_modelo_id, data_vencimento ORDER BY created_at ASC) AS rn
  FROM public.lancamentos_financeiros
  WHERE conta_modelo_id IS NOT NULL
)
DELETE FROM public.lancamentos_financeiros
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

-- Add unique constraint to prevent future duplicates from recurring entries
CREATE UNIQUE INDEX IF NOT EXISTS lancamentos_conta_modelo_vencimento_unique
ON public.lancamentos_financeiros (conta_modelo_id, data_vencimento)
WHERE conta_modelo_id IS NOT NULL;
