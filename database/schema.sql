-- ============================================================
-- Inventario patrimonial municipal - Huamancaca Chico
-- Esquema MySQL / MariaDB
-- Ejecutar en phpMyAdmin o con: mysql -u root -p < database/schema.sql
-- ============================================================

CREATE DATABASE IF NOT EXISTS inventario_patrimonial
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE inventario_patrimonial;

-- ------------------------------------------------------------
-- Usuarios del sistema
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
    email         VARCHAR(190) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name          VARCHAR(120) NOT NULL DEFAULT '',
    role          ENUM('admin', 'user') NOT NULL DEFAULT 'user',
    status        ENUM('activo', 'inactivo') NOT NULL DEFAULT 'activo',
    last_login_at DATETIME DEFAULT NULL,
    last_login_ip VARCHAR(45) DEFAULT NULL,
    created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY users_email_unique (email),
    KEY users_status_idx (status),
    KEY users_role_idx (role)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- Secuencia para el código patrimonial (HC-0001, HC-0002, ...)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS asset_sequence (
    id          TINYINT UNSIGNED NOT NULL,
    last_number INT UNSIGNED NOT NULL DEFAULT 0,
    PRIMARY KEY (id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

INSERT INTO asset_sequence (id, last_number)
VALUES (1, 0)
ON DUPLICATE KEY UPDATE last_number = last_number;

-- ------------------------------------------------------------
-- Bienes patrimoniales
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS assets (
    id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    asset_code  VARCHAR(12) NOT NULL,
    barcode     VARCHAR(120) DEFAULT NULL,
    name        VARCHAR(90) NOT NULL,
    category    VARCHAR(60) NOT NULL,
    quantity    INT UNSIGNED NOT NULL DEFAULT 1,
    location    VARCHAR(70) NOT NULL,
    custodian   VARCHAR(70) NOT NULL DEFAULT '',
    `condition` ENUM('Bueno', 'Regular', 'Malo') NOT NULL,
    acquired_on DATE DEFAULT NULL,
    value       DECIMAL(12, 2) NOT NULL DEFAULT 0,
    notes       VARCHAR(300) NOT NULL DEFAULT '',
    created_by  INT UNSIGNED DEFAULT NULL,
    updated_by  INT UNSIGNED DEFAULT NULL,
    created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY assets_asset_code_unique (asset_code),
    UNIQUE KEY assets_barcode_unique (barcode),
    KEY assets_category_idx (category),
    KEY assets_location_idx (location),
    CONSTRAINT assets_created_by_fk FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE SET NULL,
    CONSTRAINT assets_updated_by_fk FOREIGN KEY (updated_by) REFERENCES users (id) ON DELETE SET NULL
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- Historial de traslados de bienes entre ambientes / áreas
-- ------------------------------------------------------------
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

-- ------------------------------------------------------------
-- Bitácora de auditoría
-- ------------------------------------------------------------
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

-- ------------------------------------------------------------
-- NOTA: el primer administrador se crea abriendo instalar.php
-- en el navegador una sola vez.
-- ------------------------------------------------------------
