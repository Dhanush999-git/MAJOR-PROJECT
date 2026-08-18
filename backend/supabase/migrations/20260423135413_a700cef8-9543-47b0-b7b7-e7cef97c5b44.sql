
-- Create scans table
CREATE TABLE public.scans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  scan_type TEXT NOT NULL CHECK (scan_type IN ('image', 'text', 'video', 'url')),
  input_label TEXT,
  file_path TEXT,
  verdict TEXT,
  confidence NUMERIC,
  source_type TEXT,
  details JSONB DEFAULT '{}'::jsonb,
  effects JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.scans ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view their own scans"
  ON public.scans FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own scans"
  ON public.scans FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own scans"
  ON public.scans FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own scans"
  ON public.scans FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- Create index for fast user queries
CREATE INDEX idx_scans_user_id ON public.scans (user_id);
CREATE INDEX idx_scans_created_at ON public.scans (created_at DESC);

-- Storage bucket for uploads
INSERT INTO storage.buckets (id, name, public) VALUES ('scan-uploads', 'scan-uploads', true);

-- Storage policies
CREATE POLICY "Users can upload their own scan files"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'scan-uploads' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can view their own scan files"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'scan-uploads' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own scan files"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'scan-uploads' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Public read for scan-uploads (so images can be displayed)
CREATE POLICY "Public can view scan uploads"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'scan-uploads');
