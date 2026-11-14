
-- =========================================
-- LabInventory Database Schema
-- PostgreSQL 18
-- =========================================

-- 1. USERS
CREATE TABLE IF NOT EXISTS users (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    username        VARCHAR(100) NOT NULL UNIQUE,
    password_hash   TEXT NOT NULL,
    full_name       VARCHAR(200) NOT NULL,
    email           VARCHAR(255) UNIQUE,
    role            VARCHAR(50) NOT NULL DEFAULT 'Chemist',
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    last_login      TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. MATERIALS
CREATE TABLE IF NOT EXISTS materials (
    id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name                VARCHAR(255) NOT NULL,
    material_type       VARCHAR(100),
    unit                VARCHAR(50) NOT NULL,
    manufacturer        VARCHAR(255),
    catalog_number      VARCHAR(100),
    min_stock           NUMERIC(14, 3) NOT NULL DEFAULT 0,
    is_active           BOOLEAN NOT NULL DEFAULT TRUE,
    storage_conditions  TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_material_min_stock CHECK (min_stock >= 0)
);

-- 3. LOTS
CREATE TABLE IF NOT EXISTS lots (
    id                          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    lot_number                  VARCHAR(150) NOT NULL,
    material_id                 BIGINT NOT NULL REFERENCES materials(id) ON DELETE RESTRICT,
    received_date               DATE NOT NULL,
    expiry_date                 DATE,
    opened_date                 DATE,
    expiry_after_opening_date   DATE,
    effective_expiry_date       DATE,
    initial_quantity            NUMERIC(14, 3) NOT NULL,
    current_quantity            NUMERIC(14, 3) NOT NULL,
    storage_conditions          TEXT,
    status                      VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_lot_initial_quantity CHECK (initial_quantity >= 0),
    CONSTRAINT chk_lot_current_quantity CHECK (
        current_quantity >= 0 AND current_quantity <= initial_quantity
    ),
    CONSTRAINT chk_lot_status CHECK (
        status IN ('ACTIVE', 'EXPIRED', 'DEPLETED')
    )
);

-- 4. MOVEMENTS
CREATE TABLE IF NOT EXISTS movements (
    id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    lot_id              BIGINT NOT NULL REFERENCES lots(id) ON DELETE RESTRICT,
    movement_datetime   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    movement_type       VARCHAR(30) NOT NULL,
    quantity_signed     NUMERIC(14, 3) NOT NULL,
    reason              TEXT,
    user_id             BIGINT REFERENCES users(id) ON DELETE RESTRICT,
    reference           VARCHAR(255),
    material_id         BIGINT NOT NULL REFERENCES materials(id) ON DELETE RESTRICT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_movement_type CHECK (
        movement_type IN ('RECEIPT', 'WRITE_OFF', 'ADJUSTMENT')
    ),
    CONSTRAINT chk_movement_quantity CHECK (quantity_signed <> 0),
    CONSTRAINT chk_movement_direction CHECK (
        (movement_type = 'RECEIPT' AND quantity_signed > 0)
        OR (movement_type = 'WRITE_OFF' AND quantity_signed < 0)
        OR (movement_type = 'ADJUSTMENT')
    )
);

-- 5. AUDIT TRAIL
CREATE TABLE IF NOT EXISTS audit_trail (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    event_datetime  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    user_id         BIGINT REFERENCES users(id) ON DELETE RESTRICT,
    username        VARCHAR(100),
    action          VARCHAR(50) NOT NULL,
    entity_type     VARCHAR(100),
    record_id       VARCHAR(100),
    field_name      VARCHAR(100),
    old_value       TEXT,
    new_value       TEXT,
    details         TEXT,
    ip_address      INET
);

-- =========================================
-- INDEXES
-- =========================================

CREATE INDEX IF NOT EXISTS idx_materials_name
    ON materials(name);

CREATE INDEX IF NOT EXISTS idx_materials_active
    ON materials(is_active);

CREATE INDEX IF NOT EXISTS idx_lots_material
    ON lots(material_id);

CREATE INDEX IF NOT EXISTS idx_lots_expiry
    ON lots(effective_expiry_date);

CREATE INDEX IF NOT EXISTS idx_lots_status
    ON lots(status);

CREATE INDEX IF NOT EXISTS idx_movements_lot
    ON movements(lot_id);

CREATE INDEX IF NOT EXISTS idx_movements_material
    ON movements(material_id);

CREATE INDEX IF NOT EXISTS idx_movements_datetime
    ON movements(movement_datetime);

CREATE INDEX IF NOT EXISTS idx_audit_datetime
    ON audit_trail(event_datetime);

CREATE INDEX IF NOT EXISTS idx_audit_user
    ON audit_trail(user_id);

CREATE INDEX IF NOT EXISTS idx_audit_entity
    ON audit_trail(entity_type, record_id);

CREATE INDEX IF NOT EXISTS idx_users_active
    ON users(is_active);

-- =========================================
-- END OF SCHEMA
-- =========================================
