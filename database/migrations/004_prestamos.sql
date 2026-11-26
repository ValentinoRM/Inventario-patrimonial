-- ============================================================
-- Migración 004: historial de préstamos y devoluciones.
-- ============================================================

USE inventario_patrimonial;

CREATE TABLE IF NOT EXISTS asset_loans (
    id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    asset_id    BIGINT UNSIGNED NOT NULL,
    borrower    VARCHAR(120) NOT NULL,
    loaned_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    due_on      DATE DEFAULT NULL,
    returned_at DATETIME DEFAULT NULL,
    notes       VARCHAR(300) NOT NULL DEFAULT '',
    loaned_by   INT UNSIGNED DEFAULT NULL,
    returned_by INT UNSIGNED DEFAULT NULL,
    PRIMARY KEY (id),
    KEY asset_loans_asset_idx (asset_id, loaned_at),
    KEY asset_loans_active_idx (asset_id, returned_at),
    KEY asset_loans_loaned_by_idx (loaned_by),
    KEY asset_loans_returned_by_idx (returned_by),
    CONSTRAINT asset_loans_asset_fk FOREIGN KEY (asset_id) REFERENCES assets (id) ON DELETE CASCADE,
    CONSTRAINT asset_loans_loaned_by_fk FOREIGN KEY (loaned_by) REFERENCES users (id) ON DELETE SET NULL,
    CONSTRAINT asset_loans_returned_by_fk FOREIGN KEY (returned_by) REFERENCES users (id) ON DELETE SET NULL
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;
