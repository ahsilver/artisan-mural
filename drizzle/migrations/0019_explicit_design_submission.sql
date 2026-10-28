ALTER TABLE public.artwork_uploads ADD COLUMN submitted_at timestamptz;
UPDATE public.artwork_uploads SET submitted_at=created_at WHERE status='ready' OR review_status='approved';
COMMENT ON COLUMN public.artwork_uploads.submitted_at IS 'Explicit submission time; existing ready or approved designs are treated as submitted.';