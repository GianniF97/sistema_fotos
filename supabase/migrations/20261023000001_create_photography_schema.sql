-- =============================================================================
-- NICOLAS TECHEIRA FOTOGRAFÍAS — ESQUEMA COMPLETO DE BASE DE DATOS SUPABASE
-- Migración 01: Tablas, Relaciones, RLS, Storage y Seguridad
-- =============================================================================

-- Habilitar extensión para generación de UUIDs
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- -----------------------------------------------------------------------------
-- 1. TABLA: albums
-- -----------------------------------------------------------------------------
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
    cover_url TEXT, -- URL de respaldo directo o caché rápida
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Comentario descriptivo
COMMENT ON TABLE public.albums IS 'Colecciones y álbumes fotográficos de Nicolas Techeira';

-- -----------------------------------------------------------------------------
-- 2. TABLA: photos
-- -----------------------------------------------------------------------------
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
    -- Restricción compuesta para vincular con cover_photo_id garantizando pertenencia
    CONSTRAINT uq_photos_id_album UNIQUE (id, album_id)
);

COMMENT ON TABLE public.photos IS 'Metadatos de fotografías individuales archivadas en Supabase Storage';

-- -----------------------------------------------------------------------------
-- 3. INTEGRIDAD DE LA PORTADA (albums.cover_photo_id -> photos.id del mismo álbum)
-- -----------------------------------------------------------------------------
-- Esta restricción compuesta garantiza que la foto de portada pertenezca OBLIGATORIAMENTE
-- al mismo álbum, evitando que un álbum use como portada fotos de otra colección.
ALTER TABLE public.albums
    DROP CONSTRAINT IF EXISTS fk_albums_cover_photo;

ALTER TABLE public.albums
    ADD CONSTRAINT fk_albums_cover_photo
    FOREIGN KEY (cover_photo_id, id)
    REFERENCES public.photos(id, album_id)
    ON DELETE SET NULL
    DEFERRABLE INITIALLY DEFERRED;

-- -----------------------------------------------------------------------------
-- 4. TABLA: admin_users (Roles administrativos vinculados a Supabase Auth)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.admin_users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL UNIQUE,
    full_name TEXT NOT NULL DEFAULT 'Nicolas Techeira',
    role TEXT NOT NULL DEFAULT 'admin' CHECK (role IN ('admin', 'superadmin', 'editor')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

COMMENT ON TABLE public.admin_users IS 'Identidades con privilegios administrativos verificados por Supabase Auth';

-- -----------------------------------------------------------------------------
-- 5. FUNCIONES AUXILIARES DE SEGURIDAD Y TIMESTAMPS
-- -----------------------------------------------------------------------------

-- Función de actualización automática de timestamps
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para albums
DROP TRIGGER IF EXISTS trg_albums_updated_at ON public.albums;
CREATE TRIGGER trg_albums_updated_at
BEFORE UPDATE ON public.albums
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Trigger para admin_users
DROP TRIGGER IF EXISTS trg_admin_users_updated_at ON public.admin_users;
CREATE TRIGGER trg_admin_users_updated_at
BEFORE UPDATE ON public.admin_users
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Función de verificación de administrador con SECURITY DEFINER
-- Evita bucles recursivos en las políticas RLS al consultar auth.uid()
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

-- Procedimiento seguro para reclamar/iniciar el primer administrador
-- Solo funciona cuando la tabla admin_users está vacía.
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

    -- Verificar si ya existe algún administrador configurado
    SELECT count(*) INTO v_count FROM public.admin_users;
    IF v_count > 0 THEN
        RAISE EXCEPTION 'Acción bloqueada: el administrador de estudio ya ha sido establecido.';
    END IF;

    -- Obtener email del usuario autenticado
    SELECT email INTO v_user_email FROM auth.users WHERE id = v_user_id;

    -- Registrar al primer administrador
    INSERT INTO public.admin_users (id, email, full_name, role)
    VALUES (v_user_id, v_user_email, admin_name, 'admin');

    RETURN TRUE;
END;
$$;

-- -----------------------------------------------------------------------------
-- 6. ÍNDICES DE RENDIMIENTO Y CONSULTA
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_albums_status_order ON public.albums (status, sort_order ASC, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_albums_slug ON public.albums (slug);
CREATE INDEX IF NOT EXISTS idx_photos_album_order ON public.photos (album_id, sort_order ASC, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_admin_users_role ON public.admin_users (role);

-- -----------------------------------------------------------------------------
-- 7. ROW LEVEL SECURITY (RLS)
-- -----------------------------------------------------------------------------

-- Habilitar RLS en todas las tablas
ALTER TABLE public.albums ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

-- --- POLÍTICAS PARA public.albums ---

-- 1. Visitantes: Solo lectura de álbumes publicados
DROP POLICY IF EXISTS "Public can view published albums" ON public.albums;
CREATE POLICY "Public can view published albums"
ON public.albums FOR SELECT
TO public
USING (status = 'published');

-- 2. Administradores: Lectura completa (incluyendo borradores)
DROP POLICY IF EXISTS "Admins can view all albums" ON public.albums;
CREATE POLICY "Admins can view all albums"
ON public.albums FOR SELECT
TO authenticated
USING (public.is_admin());

-- 3. Administradores: Inserción de álbumes
DROP POLICY IF EXISTS "Admins can insert albums" ON public.albums;
CREATE POLICY "Admins can insert albums"
ON public.albums FOR INSERT
TO authenticated
WITH CHECK (public.is_admin());

-- 4. Administradores: Actualización de álbumes
DROP POLICY IF EXISTS "Admins can update albums" ON public.albums;
CREATE POLICY "Admins can update albums"
ON public.albums FOR UPDATE
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- 5. Administradores: Eliminación de álbumes
DROP POLICY IF EXISTS "Admins can delete albums" ON public.albums;
CREATE POLICY "Admins can delete albums"
ON public.albums FOR DELETE
TO authenticated
USING (public.is_admin());


-- --- POLÍTICAS PARA public.photos ---

-- 1. Visitantes: Solo lectura de fotos pertenecientes a álbumes publicados
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

-- 2. Administradores: Lectura de todas las fotos
DROP POLICY IF EXISTS "Admins can view all photos" ON public.photos;
CREATE POLICY "Admins can view all photos"
ON public.photos FOR SELECT
TO authenticated
USING (public.is_admin());

-- 3. Administradores: Inserción de fotos
DROP POLICY IF EXISTS "Admins can insert photos" ON public.photos;
CREATE POLICY "Admins can insert photos"
ON public.photos FOR INSERT
TO authenticated
WITH CHECK (public.is_admin());

-- 4. Administradores: Actualización de fotos (orden, alt_text, etc.)
DROP POLICY IF EXISTS "Admins can update photos" ON public.photos;
CREATE POLICY "Admins can update photos"
ON public.photos FOR UPDATE
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- 5. Administradores: Eliminación de fotos
DROP POLICY IF EXISTS "Admins can delete photos" ON public.photos;
CREATE POLICY "Admins can delete photos"
ON public.photos FOR DELETE
TO authenticated
USING (public.is_admin());


-- --- POLÍTICAS PARA public.admin_users ---

-- 1. Administradores pueden ver la lista de administradores
DROP POLICY IF EXISTS "Admins can view admin_users" ON public.admin_users;
CREATE POLICY "Admins can view admin_users"
ON public.admin_users FOR SELECT
TO authenticated
USING (public.is_admin());

-- 2. Cada administrador puede actualizar su propio nombre pero NO su rol
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


-- -----------------------------------------------------------------------------
-- 8. ALMACENAMIENTO (SUPABASE STORAGE)
-- -----------------------------------------------------------------------------

-- Crear bucket público 'portfolio-photos' para entrega rápida de fotos
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'portfolio-photos',
    'portfolio-photos',
    true,
    31457280, -- 30 MB por fotografía
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/heic']
)
ON CONFLICT (id) DO UPDATE SET
    public = true,
    file_size_limit = 31457280,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/heic'];

-- Políticas de Storage en storage.objects
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
