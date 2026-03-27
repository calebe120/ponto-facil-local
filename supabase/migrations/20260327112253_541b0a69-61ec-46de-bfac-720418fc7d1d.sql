
CREATE TYPE public.conta_tipo AS ENUM ('pagar', 'receber');
CREATE TYPE public.conta_status AS ENUM ('aberto', 'pago', 'cancelado');

CREATE TABLE public.contas_modelo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  tipo conta_tipo NOT NULL,
  descricao text NOT NULL,
  pessoa text NOT NULL,
  categoria text NOT NULL DEFAULT '',
  valor numeric(12,2) NOT NULL DEFAULT 0,
  recorrente boolean NOT NULL DEFAULT false,
  dia_vencimento integer CHECK (dia_vencimento >= 1 AND dia_vencimento <= 31),
  observacoes text DEFAULT '',
  documento text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.lancamentos_financeiros (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  conta_modelo_id uuid REFERENCES public.contas_modelo(id) ON DELETE SET NULL,
  tipo conta_tipo NOT NULL,
  descricao text NOT NULL,
  pessoa text NOT NULL,
  categoria text NOT NULL DEFAULT '',
  valor numeric(12,2) NOT NULL DEFAULT 0,
  data_emissao date NOT NULL DEFAULT CURRENT_DATE,
  data_vencimento date NOT NULL,
  data_pagamento date,
  status conta_status NOT NULL DEFAULT 'aberto',
  observacoes text DEFAULT '',
  documento text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.contas_modelo ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lancamentos_financeiros ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own contas_modelo" ON public.contas_modelo FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own contas_modelo" ON public.contas_modelo FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own contas_modelo" ON public.contas_modelo FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own contas_modelo" ON public.contas_modelo FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view own lancamentos" ON public.lancamentos_financeiros FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own lancamentos" ON public.lancamentos_financeiros FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own lancamentos" ON public.lancamentos_financeiros FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own lancamentos" ON public.lancamentos_financeiros FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all contas_modelo" ON public.contas_modelo FOR SELECT USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can insert all contas_modelo" ON public.contas_modelo FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update all contas_modelo" ON public.contas_modelo FOR UPDATE USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete all contas_modelo" ON public.contas_modelo FOR DELETE USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can view all lancamentos" ON public.lancamentos_financeiros FOR SELECT USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can insert all lancamentos" ON public.lancamentos_financeiros FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update all lancamentos" ON public.lancamentos_financeiros FOR UPDATE USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete all lancamentos" ON public.lancamentos_financeiros FOR DELETE USING (has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_contas_modelo_updated_at BEFORE UPDATE ON public.contas_modelo FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_lancamentos_updated_at BEFORE UPDATE ON public.lancamentos_financeiros FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
