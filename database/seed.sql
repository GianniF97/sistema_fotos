-- =============================================================================
-- NICOLAS TECHEIRA FOTOGRAFÍAS — DATOS INICIALES (SEED MARIADB / MYSQL)
-- Inserta las colecciones iniciales y fotos de muestra en `nicolas_techeira`
-- =============================================================================

USE `nicolas_techeira`;

-- 1. Insertar Álbumes Iniciales
INSERT INTO `albums` (`id`, `slug`, `title`, `category`, `photographer`, `event_date`, `description`, `price`, `status`, `sort_order`, `cover_url`)
VALUES
(1, 'portugal-infantil', 'PORTUGAL INFANTIL', 'Fiestas', 'Nicolas Techeira', '13 de Septiembre de 2026', 'Busca, descarga y etiqueta! - Instagram: nicolastecheira - Whatsapp: 3755-284134', 4000.00, 'published', 1, 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?auto=format&fit=crop&q=80&w=900'),
(2, 'rusia-infantil', 'RUSIA INFANTIL', 'Fiestas', 'Nicolas Techeira', '13 de Septiembre de 2026', 'Tradiciones y danzas infantiles en Oberá. Busca tus fotos favoritas.', 4000.00, 'published', 2, 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?auto=format&fit=crop&q=80&w=900'),
(3, 'espana-baila-ballet-infantil', 'ESPAÑA BAILA BALLET INFANTIL', 'Ballet', 'Nicolas Techeira', '13 de Septiembre de 2026', 'Gran presentación de danzas típicas españolas y flamenco infantil.', 4000.00, 'published', 3, 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?auto=format&fit=crop&q=80&w=900'),
(4, 'japon-1-2', 'JAPON 1-2', 'Fiestas', 'Nicolas Techeira', '13 de Septiembre de 2026', 'Muestra cultural japonesa, kimonos tradicionales y tambores taiko.', 4000.00, 'published', 4, 'https://images.unsplash.com/photo-1503899036084-c55cdd92da26?auto=format&fit=crop&q=80&w=900'),
(5, 'francia-infantil', 'FRANCIA INFANTIL', 'Fiestas', 'Nicolas Techeira', '13 de Septiembre de 2026', 'Presentación de trajes regionales y danzas infantiles francesas.', 4000.00, 'published', 5, 'https://images.unsplash.com/photo-1533105079780-92b9be482077?auto=format&fit=crop&q=80&w=900'),
(6, 'argentina-infantil', 'ARGENTINA INFANTIL', 'Fiestas', 'Nicolas Techeira', '13 de Septiembre de 2026', 'Ballet folclórico infantil, chamamé y danzas tradicionales de Misiones.', 4000.00, 'published', 6, 'https://images.unsplash.com/photo-1545232979-8bf68ee9b1af?auto=format&fit=crop&q=80&w=900')
ON DUPLICATE KEY UPDATE `title` = VALUES(`title`);

-- 2. Insertar Fotos de Galería
INSERT INTO `photos` (`id`, `album_id`, `filename`, `file_path`, `url`, `alt_text`, `sort_order`)
VALUES
-- Fotos de Portugal Infantil
(1, 1, 'portada.jpg', NULL, 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?auto=format&fit=crop&q=80&w=900', 'Portugal Infantil - Portada', 1),
(2, 1, 'foto-2.jpg', NULL, 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&q=80&w=800', 'Portugal Infantil - Presentación', 2),
(3, 1, 'foto-3.jpg', NULL, 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&q=80&w=800', 'Portugal Infantil - Danza y Trajes', 3),
(4, 1, 'foto-4.jpg', NULL, 'https://images.unsplash.com/photo-1464366400600-7168b8af9bc3?auto=format&fit=crop&q=80&w=800', 'Portugal Infantil - Coreografía', 4),
(5, 1, 'foto-5.jpg', NULL, 'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?auto=format&fit=crop&q=80&w=800', 'Portugal Infantil - Escenario', 5),
(6, 1, 'foto-6.jpg', NULL, 'https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?auto=format&fit=crop&q=80&w=800', 'Portugal Infantil - Final de Fiesta', 6),

-- Portadas de los demás álbumes
(7, 2, 'rusia-portada.jpg', NULL, 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?auto=format&fit=crop&q=80&w=900', 'Rusia Infantil - Portada', 1),
(8, 3, 'espana-portada.jpg', NULL, 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?auto=format&fit=crop&q=80&w=900', 'España Ballet - Portada', 1),
(9, 4, 'japon-portada.jpg', NULL, 'https://images.unsplash.com/photo-1503899036084-c55cdd92da26?auto=format&fit=crop&q=80&w=900', 'Japón 1-2 - Portada', 1),
(10, 5, 'francia-portada.jpg', NULL, 'https://images.unsplash.com/photo-1533105079780-92b9be482077?auto=format&fit=crop&q=80&w=900', 'Francia Infantil - Portada', 1),
(11, 6, 'argentina-portada.jpg', NULL, 'https://images.unsplash.com/photo-1545232979-8bf68ee9b1af?auto=format&fit=crop&q=80&w=900', 'Argentina Infantil - Portada', 1)
ON DUPLICATE KEY UPDATE `filename` = VALUES(`filename`);

-- 3. Insertar Usuario Administrador Inicial (contraseña predeterminada: estudio2026)
-- Hash SHA-256 de 'estudio2026nicolas_techeira_salt_2026'
INSERT INTO `admin_users` (`id`, `email`, `name`, `password_hash`, `salt`, `role`)
VALUES
(1, 'estudio@nicolastecheira.com', 'Nicolas Techeira', 'fce211b6fe3516f57bf67628c46d810b38bfd3bc3b2fe76762170202343c9eee', 'nicolas_techeira_salt_2026', 'admin')
ON DUPLICATE KEY UPDATE `name` = VALUES(`name`);
