-- Drop existing table to recreate with correct structure
DROP TABLE IF EXISTS public.time_records;

-- Create time_records table with all required fields
CREATE TABLE public.time_records (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  employee_name TEXT NOT NULL,
  date DATE NOT NULL,
  entry_time TIME,
  lunch_exit_time TIME,
  lunch_return_time TIME,
  exit_time TIME,
  total_hours TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.time_records ENABLE ROW LEVEL SECURITY;

-- Create policies for user access
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

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_time_records_updated_at
BEFORE UPDATE ON public.time_records
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();