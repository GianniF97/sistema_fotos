-- =============================================================================
-- MIGRACIÓN 004: ALMACENAMIENTO DE ORIGINALES, MARCAS DE AGUA Y VIGENCIA (FASE 2)
-- Motor objetivo actual: MariaDB 10.11 (desarrollo local Docker y Hostinger).
-- NOTA DE COMPATIBILIDAD SQL:
--   * `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` y `CREATE INDEX IF NOT EXISTS`
--     son sintaxis específica de MariaDB (no compatible con MySQL 8.0 ni SQLite).
--     Refs: https://mariadb.com/kb/en/alter-table/
--           https://mariadb.com/kb/en/create-index/
--   * Al migrar a Cloudflare D1 (SQLite), se deberá escribir una migración aparte
--     adaptada al dialecto SQLite (sin `IF NOT EXISTS` en `ADD COLUMN`, sin `ENUM`,
--     sin `UNSIGNED`, sin `AFTER` y con una sentencia `ALTER TABLE` por columna).
--     Refs: https://www.sqlite.org/lang_altertable.html
--           https://developers.cloudflare.com/d1/sql-api/
-- REGLA DEFENSIVA: Estrictamente incremental (sin sentencias DROP).
-- =============================================================================

-- Nota: No se incluye `USE <db>` fijo para respetar `DB_NAME` configurado en `.env`
-- (por ejemplo en Hostinger donde el nombre de BD lleva prefijo de cuenta).

-- -----------------------------------------------------------------------------
-- 1. TABLA photos: Columnas para aislamiento de originales y metadatos
-- -----------------------------------------------------------------------------
-- preview_url: Ruta pública de la versión reducida con marca de agua (máx. 1200px)
-- thumbnail_url: Ruta pública de la miniatura con marca de agua
-- original_path: Identificador o ruta interna relativa en almacenamiento privado
-- storage_driver: Proveedor de almacenamiento ('local' en disco o 'r2' en Cloudflare)
-- mime_type: Tipo MIME validado por magic bytes ('image/jpeg', 'image/png', 'image/webp')
-- file_size_bytes: Tamaño del archivo original en bytes
-- width / height: Dimensiones en píxeles del archivo original
-- is_demo: Bandera booleana (1 = foto de muestra/demo, 0 = foto real vendible)
-- -----------------------------------------------------------------------------
ALTER TABLE `photos`
  ADD COLUMN IF NOT EXISTS `preview_url` VARCHAR(500) NULL AFTER `file_path`,
  ADD COLUMN IF NOT EXISTS `thumbnail_url` VARCHAR(500) NULL AFTER `preview_url`,
  ADD COLUMN IF NOT EXISTS `original_path` VARCHAR(500) NULL AFTER `thumbnail_url`,
  ADD COLUMN IF NOT EXISTS `storage_driver` ENUM('local', 'r2') NOT NULL DEFAULT 'local' AFTER `original_path`,
  ADD COLUMN IF NOT EXISTS `mime_type` VARCHAR(100) NOT NULL DEFAULT 'image/jpeg' AFTER `storage_driver`,
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
