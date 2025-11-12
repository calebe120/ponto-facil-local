-- Criar tabela para registros de ponto
CREATE TABLE public.time_records (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  employee_name TEXT NOT NULL,
  date DATE NOT NULL,
  entry_time TIME NOT NULL,
  exit_time TIME NOT NULL,
  total_hours TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar Row Level Security
ALTER TABLE public.time_records ENABLE ROW LEVEL SECURITY;

-- Políticas RLS: usuários só podem ver seus próprios registros
CREATE POLICY "Users can view their own time records" 
ON public.time_records 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own time records" 
ON public.time_records 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own time records" 
ON public.time_records 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own time records" 
ON public.time_records 
FOR DELETE 
USING (auth.uid() = user_id);

-- Função para atualizar timestamps automaticamente
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Trigger para atualizar updated_at automaticamente
CREATE TRIGGER update_time_records_updated_at
BEFORE UPDATE ON public.time_records
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();