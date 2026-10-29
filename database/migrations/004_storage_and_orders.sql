-- =============================================================================
-- MIGRACIÓN 004: ALMACENAMIENTO DE ORIGINALES, MARCAS DE AGUA Y VIGENCIA (FASE 2)
-- Compatible con MariaDB 10.4+, MySQL 8.0+ y entornos de producción (Hostinger)
-- REGLA DEFENSIVA: Estrictamente incremental (sin sentencias DROP).
-- =============================================================================

USE `nicolas_techeira`;

-- -----------------------------------------------------------------------------
-- 1. TABLA photos: Columnas para aislamiento de originales y metadatos
-- -----------------------------------------------------------------------------
-- preview_url: Ruta pública de la versión reducida con marca de agua (máx. 1200px)
-- thumbnail_url: Ruta pública de la miniatura con marca de agua
-- original_path: Identificador o ruta interna relativa en almacenamiento privado
-- storage_driver: Proveedor de almacenamiento ('local' en disco o 'r2' en Cloudflare)
-- file_size_bytes: Tamaño del archivo original en bytes
-- width / height: Dimensiones en píxeles del archivo original
-- is_demo: Bandera booleana (1 = foto de muestra/demo, 0 = foto real vendible)
-- -----------------------------------------------------------------------------
ALTER TABLE `photos`
  ADD COLUMN IF NOT EXISTS `preview_url` VARCHAR(500) NULL AFTER `file_path`,
  ADD COLUMN IF NOT EXISTS `thumbnail_url` VARCHAR(500) NULL AFTER `preview_url`,
  ADD COLUMN IF NOT EXISTS `original_path` VARCHAR(500) NULL AFTER `thumbnail_url`,
  ADD COLUMN IF NOT EXISTS `storage_driver` ENUM('local', 'r2') NOT NULL DEFAULT 'local' AFTER `original_path`,
  ADD COLUMN IF NOT EXISTS `file_size_bytes` BIGINT UNSIGNED DEFAULT 0 AFTER `file_size`,
  ADD COLUMN IF NOT EXISTS `width` INT UNSIGNED NULL AFTER `file_size_bytes`,
  ADD COLUMN IF NOT EXISTS `height` INT UNSIGNED NULL AFTER `width`,
  ADD COLUMN IF NOT EXISTS `is_demo` TINYINT(1) NOT NULL DEFAULT 0 AFTER `height`;

CREATE INDEX IF NOT EXISTS `idx_photos_demo` ON `photos` (`is_demo`);
CREATE INDEX IF NOT EXISTS `idx_photos_driver` ON `photos` (`storage_driver`);

-- -----------------------------------------------------------------------------
-- 2. TABLA orders: Vigencia y expiración del enlace de descarga (SEC-07)
-- -----------------------------------------------------------------------------
-- expires_at: Fecha/hora límite de descarga (calculada al aprobar el pago)
-- -----------------------------------------------------------------------------
ALTER TABLE `orders`
  ADD COLUMN IF NOT EXISTS `expires_at` DATETIME NULL AFTER `payment_status`;

CREATE INDEX IF NOT EXISTS `idx_orders_expires` ON `orders` (`expires_at`);

-- -----------------------------------------------------------------------------
-- 3. TABLA order_items: Control atómico de descargas por fotografía (SEC-07)
-- -----------------------------------------------------------------------------
-- download_count: Contador de descargas efectuadas por foto comprada
-- last_downloaded_at: Fecha y hora de la última descarga realizada
-- -----------------------------------------------------------------------------
ALTER TABLE `order_items`
  ADD COLUMN IF NOT EXISTS `download_count` INT UNSIGNED NOT NULL DEFAULT 0 AFTER `price`,
  ADD COLUMN IF NOT EXISTS `last_downloaded_at` DATETIME NULL AFTER `download_count`;
