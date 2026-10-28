ALTER TABLE public.artwork_uploads ADD COLUMN IF NOT EXISTS print_file_url text;
ALTER TABLE public.artwork_uploads ADD COLUMN IF NOT EXISTS max_print_width_cm numeric;
ALTER TABLE public.artwork_uploads ADD COLUMN IF NOT EXISTS max_print_height_cm numeric;
ALTER TABLE public.artwork_uploads ADD COLUMN IF NOT EXISTS designer_notes text;