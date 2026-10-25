-- =============================================================================
-- NICOLAS TECHEIRA FOTOGRAFÍAS — ESQUEMA COMPLETO Y DATOS INICIALES (SUPABASE)
-- Este script se puede ejecutar en el SQL Editor del panel de Supabase o mediante CLI
-- =============================================================================

-- Habilitar extensiones
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. TABLA: albums
CREATE TABLE IF NOT EXISTS public.albums (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    description TEXT,
    category TEXT NOT NULL DEFAULT 'Fiestas',
    photographer TEXT NOT NULL DEFAULT 'Nicolas Techeira',
    price NUMERIC(10, 2) NOT NULL DEFAULT 4000.00 CHECK (price >= 0),
    event_date TEXT NOT NULL DEFAULT 'Reciente',
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
    sort_order INTEGER NOT NULL DEFAULT 1,
    cover_photo_id UUID,
    cover_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 2. TABLA: photos
CREATE TABLE IF NOT EXISTS public.photos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    album_id UUID NOT NULL REFERENCES public.albums(id) ON DELETE CASCADE,
    storage_path TEXT NOT NULL,
    url TEXT NOT NULL,
    filename TEXT NOT NULL,
    alt_text TEXT,
    width INTEGER,
    height INTEGER,
    file_size BIGINT,
    mime_type TEXT NOT NULL DEFAULT 'image/jpeg',
    sort_order INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_photos_id_album UNIQUE (id, album_id)
);

-- 3. INTEGRIDAD DE LA PORTADA
ALTER TABLE public.albums
    DROP CONSTRAINT IF EXISTS fk_albums_cover_photo;

ALTER TABLE public.albums
    ADD CONSTRAINT fk_albums_cover_photo
    FOREIGN KEY (cover_photo_id, id)
    REFERENCES public.photos(id, album_id)
    ON DELETE SET NULL
    DEFERRABLE INITIALLY DEFERRED;

-- 4. TABLA: admin_users
CREATE TABLE IF NOT EXISTS public.admin_users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL UNIQUE,
    full_name TEXT NOT NULL DEFAULT 'Nicolas Techeira',
    role TEXT NOT NULL DEFAULT 'admin' CHECK (role IN ('admin', 'superadmin', 'editor')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 5. FUNCIONES Y TRIGGERS
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_albums_updated_at ON public.albums;
CREATE TRIGGER trg_albums_updated_at
BEFORE UPDATE ON public.albums
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_admin_users_updated_at ON public.admin_users;
CREATE TRIGGER trg_admin_users_updated_at
BEFORE UPDATE ON public.admin_users
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.admin_users
        WHERE id = auth.uid()
    );
$$;

CREATE OR REPLACE FUNCTION public.claim_initial_admin(admin_name TEXT DEFAULT 'Nicolas Techeira')
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_user_email TEXT;
    v_count INTEGER;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Operación denegada: debes iniciar sesión previamente en Supabase Auth.';
    END IF;

    SELECT count(*) INTO v_count FROM public.admin_users;
    IF v_count > 0 THEN
        RAISE EXCEPTION 'Acción bloqueada: el administrador de estudio ya ha sido establecido.';
    END IF;

    SELECT email INTO v_user_email FROM auth.users WHERE id = v_user_id;

    INSERT INTO public.admin_users (id, email, full_name, role)
    VALUES (v_user_id, v_user_email, admin_name, 'admin');

    RETURN TRUE;
END;
$$;

-- 6. ÍNDICES
CREATE INDEX IF NOT EXISTS idx_albums_status_order ON public.albums (status, sort_order ASC, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_albums_slug ON public.albums (slug);
CREATE INDEX IF NOT EXISTS idx_photos_album_order ON public.photos (album_id, sort_order ASC, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_admin_users_role ON public.admin_users (role);

-- 7. ROW LEVEL SECURITY (RLS)
ALTER TABLE public.albums ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

-- Políticas albums
DROP POLICY IF EXISTS "Public can view published albums" ON public.albums;
CREATE POLICY "Public can view published albums"
ON public.albums FOR SELECT
TO public
USING (status = 'published');

DROP POLICY IF EXISTS "Admins can view all albums" ON public.albums;
CREATE POLICY "Admins can view all albums"
ON public.albums FOR SELECT
TO authenticated
USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can insert albums" ON public.albums;
CREATE POLICY "Admins can insert albums"
ON public.albums FOR INSERT
TO authenticated
WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can update albums" ON public.albums;
CREATE POLICY "Admins can update albums"
ON public.albums FOR UPDATE
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can delete albums" ON public.albums;
CREATE POLICY "Admins can delete albums"
ON public.albums FOR DELETE
TO authenticated
USING (public.is_admin());

-- Políticas photos
DROP POLICY IF EXISTS "Public can view photos of published albums" ON public.photos;
CREATE POLICY "Public can view photos of published albums"
ON public.photos FOR SELECT
TO public
USING (
    EXISTS (
        SELECT 1 FROM public.albums
        WHERE albums.id = photos.album_id
        AND albums.status = 'published'
    )
);

DROP POLICY IF EXISTS "Admins can view all photos" ON public.photos;
CREATE POLICY "Admins can view all photos"
ON public.photos FOR SELECT
TO authenticated
USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can insert photos" ON public.photos;
CREATE POLICY "Admins can insert photos"
ON public.photos FOR INSERT
TO authenticated
WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can update photos" ON public.photos;
CREATE POLICY "Admins can update photos"
ON public.photos FOR UPDATE
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can delete photos" ON public.photos;
CREATE POLICY "Admins can delete photos"
ON public.photos FOR DELETE
TO authenticated
USING (public.is_admin());

-- Políticas admin_users
DROP POLICY IF EXISTS "Admins can view admin_users" ON public.admin_users;
CREATE POLICY "Admins can view admin_users"
ON public.admin_users FOR SELECT
TO authenticated
USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can update own profile name" ON public.admin_users;
CREATE POLICY "Admins can update own profile name"
ON public.admin_users FOR UPDATE
TO authenticated
USING (id = auth.uid() AND public.is_admin())
WITH CHECK (
    id = auth.uid() 
    AND public.is_admin() 
    AND role = (SELECT role FROM public.admin_users WHERE id = auth.uid())
);

-- 8. ALMACENAMIENTO (SUPABASE STORAGE)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'portfolio-photos',
    'portfolio-photos',
    true,
    31457280,
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/heic']
)
ON CONFLICT (id) DO UPDATE SET
    public = true,
    file_size_limit = 31457280,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/heic'];

DROP POLICY IF EXISTS "Public Access to Portfolio Photos" ON storage.objects;
CREATE POLICY "Public Access to Portfolio Photos"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'portfolio-photos');

DROP POLICY IF EXISTS "Admins can upload portfolio photos" ON storage.objects;
CREATE POLICY "Admins can upload portfolio photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'portfolio-photos' AND public.is_admin()
);

DROP POLICY IF EXISTS "Admins can update portfolio photos" ON storage.objects;
CREATE POLICY "Admins can update portfolio photos"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'portfolio-photos' AND public.is_admin())
WITH CHECK (bucket_id = 'portfolio-photos' AND public.is_admin());

DROP POLICY IF EXISTS "Admins can delete portfolio photos" ON storage.objects;
CREATE POLICY "Admins can delete portfolio photos"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'portfolio-photos' AND public.is_admin());

-- 9. DATOS DE SEMILLA INICIALES
DO $$
DECLARE
    v_album_1 UUID := '11111111-1111-4111-8111-111111111111';
    v_album_2 UUID := '22222222-2222-4222-8222-222222222222';
    v_album_3 UUID := '33333333-3333-4333-8333-333333333333';
    v_album_4 UUID := '44444444-4444-4444-8444-444444444444';
    v_album_5 UUID := '55555555-5555-4555-8555-555555555555';
    v_album_6 UUID := '66666666-6666-4666-8666-666666666666';

    v_photo_1 UUID := 'aaaaaaaa-1111-4aaa-8aaa-aaaaaaaaaaaa';
    v_photo_2 UUID := 'bbbbbbbb-2222-4bbb-8bbb-bbbbbbbbbbbb';
    v_photo_3 UUID := 'cccccccc-3333-4ccc-8ccc-cccccccccccc';
    v_photo_4 UUID := 'dddddddd-4444-4ddd-8ddd-dddddddddddd';
    v_photo_5 UUID := 'eeeeeeee-5555-4eee-8eee-eeeeeeeeeeee';
    v_photo_6 UUID := 'ffffffff-6666-4fff-8fff-ffffffffffff';
BEGIN
    INSERT INTO public.albums (id, title, slug, category, photographer, price, event_date, status, sort_order, cover_url, description)
    VALUES
    (v_album_1, 'PORTUGAL INFANTIL', 'portugal-infantil', 'Fiestas', 'Nicolas Techeira', 4000.00, '13 de Septiembre de 2026', 'published', 1, 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?auto=format&fit=crop&q=80&w=900', 'Busca, descarga y etiqueta! - Instagram: nicolastecheira - Whatsapp: 3755-284134'),
    (v_album_2, 'RUSIA INFANTIL', 'rusia-infantil', 'Fiestas', 'Nicolas Techeira', 4000.00, '13 de Septiembre de 2026', 'published', 2, 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?auto=format&fit=crop&q=80&w=900', 'Tradiciones y danzas infantiles en Oberá. Busca tus fotos favoritas.'),
    (v_album_3, 'ESPAÑA BAILA BALLET INFANTIL', 'espana-baila-ballet-infantil', 'Ballet', 'Nicolas Techeira', 4000.00, '13 de Septiembre de 2026', 'published', 3, 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?auto=format&fit=crop&q=80&w=900', 'Gran presentación de danzas típicas españolas y flamenco infantil.'),
    (v_album_4, 'JAPON 1-2', 'japon-1-2', 'Fiestas', 'Nicolas Techeira', 4000.00, '13 de Septiembre de 2026', 'published', 4, 'https://images.unsplash.com/photo-1503899036084-c55cdd92da26?auto=format&fit=crop&q=80&w=900', 'Muestra cultural japonesa, kimonos tradicionales y tambores taiko.'),
    (v_album_5, 'FRANCIA INFANTIL', 'francia-infantil', 'Fiestas', 'Nicolas Techeira', 4000.00, '13 de Septiembre de 2026', 'published', 5, 'https://images.unsplash.com/photo-1533105079780-92b9be482077?auto=format&fit=crop&q=80&w=900', 'Presentación de trajes regionales y danzas infantiles francesas.'),
    (v_album_6, 'ARGENTINA INFANTIL', 'argentina-infantil', 'Fiestas', 'Nicolas Techeira', 4000.00, '13 de Septiembre de 2026', 'published', 6, 'https://images.unsplash.com/photo-1545232979-8bf68ee9b1af?auto=format&fit=crop&q=80&w=900', 'Ballet folclórico infantil, chamamé y danzas tradicionales de Misiones.')
    ON CONFLICT (slug) DO NOTHING;

    INSERT INTO public.photos (id, album_id, storage_path, url, filename, alt_text, sort_order)
    VALUES
    (v_photo_1, v_album_1, 'portugal-infantil/portada.jpg', 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?auto=format&fit=crop&q=80&w=900', 'portada.jpg', 'Portugal Infantil - Fotografía de portada', 1),
    (v_photo_2, v_album_2, 'rusia-infantil/portada.jpg', 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?auto=format&fit=crop&q=80&w=900', 'portada.jpg', 'Rusia Infantil - Fotografía de portada', 1),
    (v_photo_3, v_album_3, 'espana-ballet/portada.jpg', 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?auto=format&fit=crop&q=80&w=900', 'portada.jpg', 'España Ballet - Fotografía de portada', 1),
    (v_photo_4, v_album_4, 'japon-1-2/portada.jpg', 'https://images.unsplash.com/photo-1503899036084-c55cdd92da26?auto=format&fit=crop&q=80&w=900', 'portada.jpg', 'Japón 1-2 - Fotografía de portada', 1),
    (v_photo_5, v_album_5, 'francia-infantil/portada.jpg', 'https://images.unsplash.com/photo-1533105079780-92b9be482077?auto=format&fit=crop&q=80&w=900', 'portada.jpg', 'Francia Infantil - Fotografía de portada', 1),
    (v_photo_6, v_album_6, 'argentina-infantil/portada.jpg', 'https://images.unsplash.com/photo-1545232979-8bf68ee9b1af?auto=format&fit=crop&q=80&w=900', 'portada.jpg', 'Argentina Infantil - Fotografía de portada', 1)
    ON CONFLICT (id) DO NOTHING;

    UPDATE public.albums SET cover_photo_id = v_photo_1 WHERE id = v_album_1;
    UPDATE public.albums SET cover_photo_id = v_photo_2 WHERE id = v_album_2;
    UPDATE public.albums SET cover_photo_id = v_photo_3 WHERE id = v_album_3;
    UPDATE public.albums SET cover_photo_id = v_photo_4 WHERE id = v_album_4;
    UPDATE public.albums SET cover_photo_id = v_photo_5 WHERE id = v_album_5;
    UPDATE public.albums SET cover_photo_id = v_photo_6 WHERE id = v_album_6;

    INSERT INTO public.photos (album_id, storage_path, url, filename, alt_text, sort_order)
    VALUES
    (v_album_1, 'portugal-infantil/foto-2.jpg', 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&q=80&w=800', 'foto-2.jpg', 'Portugal Infantil - Presentación', 2),
    (v_album_1, 'portugal-infantil/foto-3.jpg', 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&q=80&w=800', 'foto-3.jpg', 'Portugal Infantil - Danza y Trajes', 3),
    (v_album_1, 'portugal-infantil/foto-4.jpg', 'https://images.unsplash.com/photo-1464366400600-7168b8af9bc3?auto=format&fit=crop&q=80&w=800', 'foto-4.jpg', 'Portugal Infantil - Coreografía', 4),
    (v_album_1, 'portugal-infantil/foto-5.jpg', 'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?auto=format&fit=crop&q=80&w=800', 'foto-5.jpg', 'Portugal Infantil - Escenario', 5),
    (v_album_1, 'portugal-infantil/foto-6.jpg', 'https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?auto=format&fit=crop&q=80&w=800', 'foto-6.jpg', 'Portugal Infantil - Final de Fiesta', 6);
END $$;
