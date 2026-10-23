-- ============================================================
-- Migración 001: estados de usuario, último acceso,
-- historial de traslados y auditoría.
--
-- Aplicar UNA sola vez sobre una base existente:
--   mysql -u usuario -p inventario_patrimonial < database/migrations/001_roles_auditoria.sql
--
-- Es idempotente: si una columna o tabla ya existe, no falla.
-- Las instalaciones nuevas pueden usar directamente database/schema.sql.
-- ============================================================

USE inventario_patrimonial;

-- users.status
SET @sql = (
    SELECT IF(
        COUNT(*) = 0,
        "ALTER TABLE users ADD COLUMN status ENUM('activo','inactivo') NOT NULL DEFAULT 'activo' AFTER role",
        'SELECT 1'
    )
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'status'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- users.last_login_at
SET @sql = (
    SELECT IF(
        COUNT(*) = 0,
        'ALTER TABLE users ADD COLUMN last_login_at DATETIME DEFAULT NULL AFTER status',
        'SELECT 1'
    )
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'last_login_at'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- users.last_login_ip
SET @sql = (
    SELECT IF(
        COUNT(*) = 0,
        'ALTER TABLE users ADD COLUMN last_login_ip VARCHAR(45) DEFAULT NULL AFTER last_login_at',
        'SELECT 1'
    )
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'last_login_ip'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Índices de users (solo si no existen).
SET @sql = (
    SELECT IF(
        COUNT(*) = 0,
        'ALTER TABLE users ADD KEY users_status_idx (status)',
        'SELECT 1'
    )
    FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND INDEX_NAME = 'users_status_idx'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (
    SELECT IF(
        COUNT(*) = 0,
        'ALTER TABLE users ADD KEY users_role_idx (role)',
        'SELECT 1'
    )
    FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND INDEX_NAME = 'users_role_idx'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

CREATE TABLE IF NOT EXISTS asset_movements (
    id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    asset_id      BIGINT UNSIGNED NOT NULL,
    from_location VARCHAR(70) NOT NULL,
    to_location   VARCHAR(70) NOT NULL,
    reason        VARCHAR(200) NOT NULL DEFAULT '',
    moved_by      INT UNSIGNED DEFAULT NULL,
    created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY asset_movements_asset_idx (asset_id, created_at),
    KEY asset_movements_user_idx (moved_by),
    CONSTRAINT asset_movements_asset_fk FOREIGN KEY (asset_id) REFERENCES assets (id) ON DELETE CASCADE,
    CONSTRAINT asset_movements_user_fk FOREIGN KEY (moved_by) REFERENCES users (id) ON DELETE SET NULL
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS audit_log (
    id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id    INT UNSIGNED DEFAULT NULL,
    action     VARCHAR(40) NOT NULL,
    entity     VARCHAR(40) NOT NULL,
    entity_id  BIGINT UNSIGNED DEFAULT NULL,
    details    JSON DEFAULT NULL,
    ip_address VARCHAR(45) DEFAULT NULL,
    user_agent VARCHAR(255) DEFAULT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY audit_log_user_idx (user_id),
    KEY audit_log_entity_idx (entity, entity_id),
    KEY audit_log_created_idx (created_at),
    CONSTRAINT audit_log_user_fk FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;
