-- ============================================================
-- Migración 002: catálogo de áreas y relación con los bienes.
--
-- Aplicar UNA sola vez sobre una base existente:
--   mysql -u usuario -p inventario_patrimonial < database/migrations/002_areas.sql
--
-- Es idempotente: si una tabla, columna, índice o restricción ya
-- existe, no falla. Las ubicaciones actuales se convierten en áreas.
-- ============================================================

USE inventario_patrimonial;
SET NAMES utf8mb4;

-- ------------------------------------------------------------
-- Catálogo de áreas
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS areas (
    id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
    name       VARCHAR(70) NOT NULL,
    status     ENUM('activo', 'inactivo') NOT NULL DEFAULT 'activo',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY areas_name_unique (name),
    KEY areas_status_idx (status)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- assets.area_id
-- ------------------------------------------------------------
SET @sql = (
    SELECT IF(
        COUNT(*) = 0,
        'ALTER TABLE assets ADD COLUMN area_id INT UNSIGNED DEFAULT NULL AFTER location',
        'SELECT 1'
    )
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'assets' AND COLUMN_NAME = 'area_id'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (
    SELECT IF(
        COUNT(*) = 0,
        'ALTER TABLE assets ADD KEY assets_area_idx (area_id)',
        'SELECT 1'
    )
    FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'assets' AND INDEX_NAME = 'assets_area_idx'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ------------------------------------------------------------
-- Convertir las ubicaciones existentes en áreas.
-- Se agrupa sin distinguir mayúsculas ni espacios para evitar duplicados.
-- ------------------------------------------------------------
INSERT INTO areas (name)
SELECT TRIM(a.location) AS name
FROM assets a
LEFT JOIN assets prev
    ON LOWER(TRIM(prev.location)) = LOWER(TRIM(a.location))
    AND prev.id < a.id
WHERE TRIM(COALESCE(a.location, '')) <> ''
  AND prev.id IS NULL
ON DUPLICATE KEY UPDATE areas.name = areas.name;

INSERT INTO areas (name)
SELECT 'Sin área'
WHERE EXISTS (
    SELECT 1 FROM assets WHERE TRIM(COALESCE(location, '')) = ''
)
AND NOT EXISTS (
    SELECT 1 FROM areas WHERE name = 'Sin área'
);

UPDATE assets a
INNER JOIN areas ar
    ON LOWER(TRIM(COALESCE(a.location, ''))) = LOWER(ar.name)
SET a.area_id = ar.id,
    a.location = ar.name
WHERE a.area_id IS NULL OR a.area_id <> ar.id;

UPDATE assets a
INNER JOIN areas ar ON ar.name = 'Sin área'
SET a.area_id = ar.id,
    a.location = ar.name
WHERE TRIM(COALESCE(a.location, '')) = '';

-- ------------------------------------------------------------
-- Clave foránea (solo si no existe)
-- ------------------------------------------------------------
SET @sql = (
    SELECT IF(
        COUNT(*) = 0,
        'ALTER TABLE assets ADD CONSTRAINT assets_area_fk FOREIGN KEY (area_id) REFERENCES areas (id) ON DELETE RESTRICT',
        'SELECT 1'
    )
    FROM information_schema.TABLE_CONSTRAINTS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'assets'
      AND CONSTRAINT_NAME = 'assets_area_fk'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
