-- =============================================================================
-- NICOLAS TECHEIRA FOTOGRAFÍAS — ESQUEMA DE BASE DE DATOS (MARIADB / MYSQL)
-- Compatible con MariaDB 10.4+, MySQL 8.0+ y planes de alojamiento en Hostinger
-- Juego de caracteres: utf8mb4 / Motor: InnoDB (Garantía de claves foráneas)
-- =============================================================================

-- 1. CREACIÓN DE LA BASE DE DATOS
CREATE DATABASE IF NOT EXISTS `nicolas_techeira`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE `nicolas_techeira`;

-- -----------------------------------------------------------------------------
-- 2. TABLA: albums (Colecciones y Galerías de Eventos)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `albums` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `slug` VARCHAR(120) NOT NULL UNIQUE,
  `title` VARCHAR(255) NOT NULL,
  `category` VARCHAR(100) NOT NULL DEFAULT 'Fiestas',
  `photographer` VARCHAR(150) NOT NULL DEFAULT 'Nicolas Techeira',
  `event_date` VARCHAR(100) NOT NULL DEFAULT 'Reciente',
  `description` TEXT NULL,
  `price` DECIMAL(10, 2) NOT NULL DEFAULT 4000.00,
  `status` ENUM('draft', 'published') NOT NULL DEFAULT 'draft',
  `sort_order` INT NOT NULL DEFAULT 1,
  `cover_url` TEXT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_albums_status` (`status`),
  INDEX `idx_albums_category` (`category`),
  INDEX `idx_albums_sort` (`sort_order`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 3. TABLA: photos (Fotografías de cada Álbum)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `photos` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `album_id` INT UNSIGNED NOT NULL,
  `filename` VARCHAR(255) NOT NULL,
  `file_path` VARCHAR(500) NULL,
  `url` TEXT NOT NULL,
  `alt_text` VARCHAR(255) NULL,
  `file_size` BIGINT UNSIGNED DEFAULT 0,
  `mime_type` VARCHAR(100) NOT NULL DEFAULT 'image/jpeg',
  `sort_order` INT NOT NULL DEFAULT 1,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `fk_photos_album` 
    FOREIGN KEY (`album_id`) 
    REFERENCES `albums` (`id`) 
    ON DELETE CASCADE 
    ON UPDATE CASCADE,
  INDEX `idx_photos_album_sort` (`album_id`, `sort_order`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 4. TABLA: admin_users (Gestión de Administradores y Seguridad del Estudio)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `admin_users` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `email` VARCHAR(191) NOT NULL UNIQUE,
  `name` VARCHAR(150) NOT NULL DEFAULT 'Nicolas Techeira',
  `password_hash` VARCHAR(255) NOT NULL,
  `salt` VARCHAR(64) NULL,
  `role` ENUM('admin', 'editor') NOT NULL DEFAULT 'admin',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 5. TABLA: site_settings (Configuración dinámica del sitio)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `site_settings` (
  `key` VARCHAR(100) PRIMARY KEY,
  `value` TEXT NOT NULL,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 6. TABLA: orders (Órdenes de Compra y Checkouts)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `orders` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `order_number` VARCHAR(50) NOT NULL UNIQUE,
  `token` VARCHAR(64) NOT NULL UNIQUE,
  `customer_name` VARCHAR(150) NULL,
  `customer_email` VARCHAR(191) NULL,
  `customer_phone` VARCHAR(50) NULL,
  `subtotal` DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  `discount_amount` DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  `discount_label` VARCHAR(100) NULL,
  `total_amount` DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  `payment_method` VARCHAR(50) NOT NULL DEFAULT 'mercadopago',
  `payment_status` ENUM('pending', 'approved', 'rejected') NOT NULL DEFAULT 'pending',
  `mercadopago_preference_id` VARCHAR(191) NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_orders_token` (`token`),
  INDEX `idx_orders_status` (`payment_status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 7. TABLA: order_items (Fotografías adquiridas por orden)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `order_items` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `order_id` INT UNSIGNED NOT NULL,
  `photo_id` INT UNSIGNED NOT NULL,
  `album_id` INT UNSIGNED NULL,
  `price` DECIMAL(10, 2) NOT NULL DEFAULT 4000.00,
  INDEX `idx_order_items_photo` (`photo_id`),
  CONSTRAINT `fk_order_items_order` 
    FOREIGN KEY (`order_id`) 
    REFERENCES `orders` (`id`) 
    ON DELETE CASCADE 
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
