
CREATE TABLE public.recorrencias_excluidas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  conta_modelo_id uuid NOT NULL REFERENCES public.contas_modelo(id) ON DELETE CASCADE,
  loja_id uuid REFERENCES public.lojas(id) ON DELETE CASCADE,
  data_vencimento date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (conta_modelo_id, data_vencimento)
);

ALTER TABLE public.recorrencias_excluidas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own recorrencias_excluidas"
  ON public.recorrencias_excluidas FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own recorrencias_excluidas"
  ON public.recorrencias_excluidas FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own recorrencias_excluidas"
  ON public.recorrencias_excluidas FOR DELETE
  USING (auth.uid() = user_id);
