
CREATE TABLE public.nfse (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  loja_id UUID REFERENCES public.lojas(id) ON DELETE SET NULL,
  numero TEXT NOT NULL,
  serie TEXT NOT NULL DEFAULT '1',
  data_emissao DATE NOT NULL DEFAULT CURRENT_DATE,
  -- Prestador
  prestador_razao_social TEXT NOT NULL,
  prestador_cnpj TEXT NOT NULL,
  prestador_inscricao_municipal TEXT,
  prestador_endereco TEXT,
  -- Tomador
  tomador_nome TEXT NOT NULL,
  tomador_documento TEXT NOT NULL,
  tomador_endereco TEXT,
  tomador_email TEXT,
  -- Serviço
  descricao_servico TEXT NOT NULL,
  codigo_servico TEXT,
  valor_servico NUMERIC NOT NULL DEFAULT 0,
  aliquota_iss NUMERIC NOT NULL DEFAULT 0,
  valor_iss NUMERIC NOT NULL DEFAULT 0,
  valor_liquido NUMERIC NOT NULL DEFAULT 0,
  observacoes TEXT,
  status TEXT NOT NULL DEFAULT 'emitida',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.nfse ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own nfse" ON public.nfse FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own nfse" ON public.nfse FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own nfse" ON public.nfse FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own nfse" ON public.nfse FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER nfse_set_updated_at
BEFORE UPDATE ON public.nfse
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_nfse_user ON public.nfse(user_id);
CREATE INDEX idx_nfse_loja ON public.nfse(loja_id);
