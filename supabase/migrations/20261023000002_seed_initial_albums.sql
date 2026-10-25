-- =============================================================================
-- NICOLAS TECHEIRA FOTOGRAFÍAS — DATOS INICIALES (SEMILLA)
-- Migración 02: Colecciones Publicadas Iniciales y Fotos de Muestra
-- =============================================================================

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

    -- 1. Insertar Álbumes
    INSERT INTO public.albums (id, title, slug, category, photographer, price, event_date, status, sort_order, cover_url, description)
    VALUES
    (v_album_1, 'PORTUGAL INFANTIL', 'portugal-infantil', 'Fiestas', 'Nicolas Techeira', 4000.00, '13 de Septiembre de 2026', 'published', 1, 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?auto=format&fit=crop&q=80&w=900', 'Busca, descarga y etiqueta! - Instagram: nicolastecheira - Whatsapp: 3755-284134'),
    (v_album_2, 'RUSIA INFANTIL', 'rusia-infantil', 'Fiestas', 'Nicolas Techeira', 4000.00, '13 de Septiembre de 2026', 'published', 2, 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?auto=format&fit=crop&q=80&w=900', 'Tradiciones y danzas infantiles en Oberá. Busca tus fotos favoritas.'),
    (v_album_3, 'ESPAÑA BAILA BALLET INFANTIL', 'espana-baila-ballet-infantil', 'Ballet', 'Nicolas Techeira', 4000.00, '13 de Septiembre de 2026', 'published', 3, 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?auto=format&fit=crop&q=80&w=900', 'Gran presentación de danzas típicas españolas y flamenco infantil.'),
    (v_album_4, 'JAPON 1-2', 'japon-1-2', 'Fiestas', 'Nicolas Techeira', 4000.00, '13 de Septiembre de 2026', 'published', 4, 'https://images.unsplash.com/photo-1503899036084-c55cdd92da26?auto=format&fit=crop&q=80&w=900', 'Muestra cultural japonesa, kimonos tradicionales y tambores taiko.'),
    (v_album_5, 'FRANCIA INFANTIL', 'francia-infantil', 'Fiestas', 'Nicolas Techeira', 4000.00, '13 de Septiembre de 2026', 'published', 5, 'https://images.unsplash.com/photo-1533105079780-92b9be482077?auto=format&fit=crop&q=80&w=900', 'Presentación de trajes regionales y danzas infantiles francesas.'),
    (v_album_6, 'ARGENTINA INFANTIL', 'argentina-infantil', 'Fiestas', 'Nicolas Techeira', 4000.00, '13 de Septiembre de 2026', 'published', 6, 'https://images.unsplash.com/photo-1545232979-8bf68ee9b1af?auto=format&fit=crop&q=80&w=900', 'Ballet folclórico infantil, chamamé y danzas tradicionales de Misiones.')
    ON CONFLICT (slug) DO NOTHING;

    -- 2. Insertar Fotografías de Portada
    INSERT INTO public.photos (id, album_id, storage_path, url, filename, alt_text, sort_order)
    VALUES
    (v_photo_1, v_album_1, 'portugal-infantil/portada.jpg', 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?auto=format&fit=crop&q=80&w=900', 'portada.jpg', 'Portugal Infantil - Fotografía de portada', 1),
    (v_photo_2, v_album_2, 'rusia-infantil/portada.jpg', 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?auto=format&fit=crop&q=80&w=900', 'portada.jpg', 'Rusia Infantil - Fotografía de portada', 1),
    (v_photo_3, v_album_3, 'espana-ballet/portada.jpg', 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?auto=format&fit=crop&q=80&w=900', 'portada.jpg', 'España Ballet - Fotografía de portada', 1),
    (v_photo_4, v_album_4, 'japon-1-2/portada.jpg', 'https://images.unsplash.com/photo-1503899036084-c55cdd92da26?auto=format&fit=crop&q=80&w=900', 'portada.jpg', 'Japón 1-2 - Fotografía de portada', 1),
    (v_photo_5, v_album_5, 'francia-infantil/portada.jpg', 'https://images.unsplash.com/photo-1533105079780-92b9be482077?auto=format&fit=crop&q=80&w=900', 'portada.jpg', 'Francia Infantil - Fotografía de portada', 1),
    (v_photo_6, v_album_6, 'argentina-infantil/portada.jpg', 'https://images.unsplash.com/photo-1545232979-8bf68ee9b1af?auto=format&fit=crop&q=80&w=900', 'portada.jpg', 'Argentina Infantil - Fotografía de portada', 1)
    ON CONFLICT (id) DO NOTHING;

    -- 3. Vincular cover_photo_id en albums
    UPDATE public.albums SET cover_photo_id = v_photo_1 WHERE id = v_album_1;
    UPDATE public.albums SET cover_photo_id = v_photo_2 WHERE id = v_album_2;
    UPDATE public.albums SET cover_photo_id = v_photo_3 WHERE id = v_album_3;
    UPDATE public.albums SET cover_photo_id = v_photo_4 WHERE id = v_album_4;
    UPDATE public.albums SET cover_photo_id = v_photo_5 WHERE id = v_album_5;
    UPDATE public.albums SET cover_photo_id = v_photo_6 WHERE id = v_album_6;

    -- 4. Insertar fotos de galería adicionales para el primer álbum
    INSERT INTO public.photos (album_id, storage_path, url, filename, alt_text, sort_order)
    VALUES
    (v_album_1, 'portugal-infantil/foto-2.jpg', 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&q=80&w=800', 'foto-2.jpg', 'Portugal Infantil - Presentación', 2),
    (v_album_1, 'portugal-infantil/foto-3.jpg', 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&q=80&w=800', 'foto-3.jpg', 'Portugal Infantil - Danza y Trajes', 3),
    (v_album_1, 'portugal-infantil/foto-4.jpg', 'https://images.unsplash.com/photo-1464366400600-7168b8af9bc3?auto=format&fit=crop&q=80&w=800', 'foto-4.jpg', 'Portugal Infantil - Coreografía', 4),
    (v_album_1, 'portugal-infantil/foto-5.jpg', 'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?auto=format&fit=crop&q=80&w=800', 'foto-5.jpg', 'Portugal Infantil - Escenario', 5),
    (v_album_1, 'portugal-infantil/foto-6.jpg', 'https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?auto=format&fit=crop&q=80&w=800', 'foto-6.jpg', 'Portugal Infantil - Final de Fiesta', 6);

END $$;
