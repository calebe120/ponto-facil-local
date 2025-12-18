-- Add policy for admins to insert time records for any user
CREATE POLICY "Admins can insert all time records" 
ON public.time_records 
FOR INSERT 
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));