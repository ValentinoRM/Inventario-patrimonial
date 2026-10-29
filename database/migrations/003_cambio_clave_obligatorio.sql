-- ============================================================
-- Migración 003: cambio obligatorio de contraseñas asignadas.
--
-- Aplicar una sola vez sobre una base existente:
--   mysql -u usuario -p inventario_patrimonial < database/migrations/003_cambio_clave_obligatorio.sql
-- ============================================================

USE inventario_patrimonial;

SET @sql = (
    SELECT IF(
        COUNT(*) = 0,
        'ALTER TABLE users ADD COLUMN must_change_password TINYINT(1) NOT NULL DEFAULT 1 AFTER status',
        'SELECT 1'
    )
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'users'
      AND COLUMN_NAME = 'must_change_password'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
