ALTER TABLE public.scans
DROP CONSTRAINT IF EXISTS scans_scan_type_check;

ALTER TABLE public.scans
ADD CONSTRAINT scans_scan_type_check
CHECK (
  scan_type IN (
    'image',
    'text',
    'video',
    'audio',
    'document',
    'url',
    'qr'
  )
);