-- =============================================================================
-- CREACIÓN DE BASE DE DATOS Y USUARIO DEDICADO PARA NICOLAS TECHEIRA
-- =============================================================================

CREATE DATABASE IF NOT EXISTS `nicolas_techeira`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

-- Usuario dedicado con privilegios exclusivos sobre nicolas_techeira
CREATE USER IF NOT EXISTS 'nt_user'@'localhost' IDENTIFIED BY 'nt_local_secure_pass_2026';
CREATE USER IF NOT EXISTS 'nt_user'@'127.0.0.1' IDENTIFIED BY 'nt_local_secure_pass_2026';
CREATE USER IF NOT EXISTS 'nt_user'@'%' IDENTIFIED BY 'nt_local_secure_pass_2026';

GRANT ALL PRIVILEGES ON `nicolas_techeira`.* TO 'nt_user'@'localhost';
GRANT ALL PRIVILEGES ON `nicolas_techeira`.* TO 'nt_user'@'127.0.0.1';
GRANT ALL PRIVILEGES ON `nicolas_techeira`.* TO 'nt_user'@'%';

FLUSH PRIVILEGES;
