-- Create lojas table
CREATE TABLE public.lojas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  nome TEXT NOT NULL,
  ordem INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.lojas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own lojas" ON public.lojas FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own lojas" ON public.lojas FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own lojas" ON public.lojas FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own lojas" ON public.lojas FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_lojas_updated_at BEFORE UPDATE ON public.lojas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Add loja_id to lancamentos and contas_modelo
ALTER TABLE public.lancamentos_financeiros ADD COLUMN loja_id UUID REFERENCES public.lojas(id) ON DELETE CASCADE;
ALTER TABLE public.contas_modelo ADD COLUMN loja_id UUID REFERENCES public.lojas(id) ON DELETE CASCADE;

CREATE INDEX idx_lancamentos_loja ON public.lancamentos_financeiros(loja_id);
CREATE INDEX idx_contas_modelo_loja ON public.contas_modelo(loja_id);