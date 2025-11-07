-- Warehouse Management Database (MySQL)
-- Import this file in MySQL Workbench: File > Open SQL Script > Execute (lightning icon)
-- Requires MySQL 8.0+
-- NOTE: Replace placeholder passwords and adjust GRANTs to fit your environment.

-- =====================================
-- 1) Create Database and Switch Context
-- =====================================
DROP DATABASE IF EXISTS warehouse_db;
CREATE DATABASE warehouse_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE warehouse_db;

-- =====================================
-- 2) Core Reference Tables
-- =====================================
CREATE TABLE roles (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  name         VARCHAR(50) NOT NULL UNIQUE,
  description  VARCHAR(255) NULL
) ENGINE=InnoDB;

CREATE TABLE users (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  username       VARCHAR(100) NOT NULL UNIQUE,
  password_hash  VARCHAR(255) NOT NULL,
  full_name      VARCHAR(150) NOT NULL,
  role_id        INT NOT NULL,
  status         ENUM('active','inactive') NOT NULL DEFAULT 'active',
  created_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_users_role
    FOREIGN KEY (role_id) REFERENCES roles(id)
      ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE warehouses (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  code        VARCHAR(50) NOT NULL UNIQUE,
  name        VARCHAR(150) NOT NULL,
  location    VARCHAR(255) NULL,
  status      ENUM('active','inactive') NOT NULL DEFAULT 'active',
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE suppliers (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(150) NOT NULL,
  contact     VARCHAR(150) NULL,
  phone       VARCHAR(50) NULL,
  email       VARCHAR(150) NULL,
  address     VARCHAR(255) NULL,
  status      ENUM('active','inactive') NOT NULL DEFAULT 'active',
  UNIQUE KEY uk_suppliers_name (name)
) ENGINE=InnoDB;

CREATE TABLE products (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  sku            VARCHAR(100) NOT NULL UNIQUE,
  name           VARCHAR(200) NOT NULL,
  category       VARCHAR(100) NULL,
  unit           VARCHAR(50) NOT NULL DEFAULT 'pcs',
  reorder_level  INT NOT NULL DEFAULT 0,
  status         ENUM('active','inactive') NOT NULL DEFAULT 'active',
  created_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- =====================================
-- 3) Operational Tables
-- =====================================
CREATE TABLE current_stock (
  product_id    INT NOT NULL,
  warehouse_id  INT NOT NULL,
  qty_on_hand   BIGINT NOT NULL DEFAULT 0,
  last_updated  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (product_id, warehouse_id),
  CONSTRAINT fk_cs_product
    FOREIGN KEY (product_id) REFERENCES products(id)
      ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_cs_warehouse
    FOREIGN KEY (warehouse_id) REFERENCES warehouses(id)
      ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE inventory_transactions (
  id             BIGINT AUTO_INCREMENT PRIMARY KEY,
  txn_code       VARCHAR(50) NOT NULL,
  product_id     INT NOT NULL,
  warehouse_id   INT NOT NULL,
  quantity       BIGINT NOT NULL,
  txn_type       ENUM('IN','OUT','ADJUST') NOT NULL,
  reason         VARCHAR(255) NULL,
  ref_document   VARCHAR(100) NULL,
  supplier_id    INT NULL,
  created_by     INT NOT NULL,
  created_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_it_product
    FOREIGN KEY (product_id) REFERENCES products(id)
      ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_it_warehouse
    FOREIGN KEY (warehouse_id) REFERENCES warehouses(id)
      ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_it_supplier
    FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
      ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT fk_it_user
    FOREIGN KEY (created_by) REFERENCES users(id)
      ON UPDATE CASCADE ON DELETE RESTRICT,
  INDEX idx_it_prod_wh_time (product_id, warehouse_id, created_at),
  INDEX idx_it_type_time (txn_type, created_at),
  UNIQUE KEY uk_it_txn_code (txn_code)
) ENGINE=InnoDB;

CREATE TABLE audit_logs (
  id           BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id      INT NULL,
  action       VARCHAR(50) NOT NULL,
  table_name   VARCHAR(100) NOT NULL,
  record_id    BIGINT NULL,
  details      JSON NULL,
  created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_audit_user
    FOREIGN KEY (user_id) REFERENCES users(id)
      ON UPDATE CASCADE ON DELETE SET NULL,
  INDEX idx_audit_table_time (table_name, created_at)
) ENGINE=InnoDB;

-- =====================================
-- 4) Helpful Views for Dashboard/Reports
-- =====================================
CREATE OR REPLACE VIEW v_current_stock AS
SELECT
  p.id AS product_id,
  p.sku,
  p.name AS product_name,
  w.id AS warehouse_id,
  w.code AS warehouse_code,
  w.name AS warehouse_name,
  cs.qty_on_hand,
  p.unit,
  p.reorder_level,
  cs.last_updated
FROM products p
JOIN current_stock cs ON cs.product_id = p.id
JOIN warehouses w ON w.id = cs.warehouse_id;

CREATE OR REPLACE VIEW v_low_stock AS
SELECT *
FROM v_current_stock
WHERE qty_on_hand <= reorder_level;

CREATE OR REPLACE VIEW v_monthly_in_out AS
SELECT
  DATE_FORMAT(created_at, '%Y-%m') AS ym,
  product_id,
  warehouse_id,
  SUM(CASE WHEN txn_type = 'IN' THEN quantity ELSE 0 END) AS qty_in,
  SUM(CASE WHEN txn_type = 'OUT' THEN quantity ELSE 0 END) AS qty_out,
  COUNT(*) AS txn_count
FROM inventory_transactions
GROUP BY ym, product_id, warehouse_id;

CREATE OR REPLACE VIEW v_top_moving_products AS
SELECT
  p.id AS product_id,
  p.sku,
  p.name,
  SUM(ABS(CASE WHEN txn_type IN ('IN','OUT','ADJUST') THEN quantity ELSE 0 END)) AS total_movement_30d
FROM inventory_transactions it
JOIN products p ON p.id = it.product_id
WHERE it.created_at >= (CURRENT_DATE - INTERVAL 30 DAY)
GROUP BY p.id, p.sku, p.name
ORDER BY total_movement_30d DESC
LIMIT 10;

-- =====================================
-- 5) Triggers to Maintain current_stock and Audit Logs
-- =====================================
DELIMITER $$

CREATE TRIGGER trg_it_after_insert
AFTER INSERT ON inventory_transactions
FOR EACH ROW
BEGIN
  -- Ensure the current_stock row exists
  INSERT INTO current_stock (product_id, warehouse_id, qty_on_hand)
  VALUES (NEW.product_id, NEW.warehouse_id, 0)
  ON DUPLICATE KEY UPDATE product_id = product_id;

  -- Apply movement
  IF NEW.txn_type = 'IN' THEN
    UPDATE current_stock
      SET qty_on_hand = qty_on_hand + NEW.quantity
    WHERE product_id = NEW.product_id AND warehouse_id = NEW.warehouse_id;
  ELSEIF NEW.txn_type = 'OUT' THEN
    UPDATE current_stock
      SET qty_on_hand = qty_on_hand - NEW.quantity
    WHERE product_id = NEW.product_id AND warehouse_id = NEW.warehouse_id;
  ELSEIF NEW.txn_type = 'ADJUST' THEN
    -- For ADJUST, positive quantity increases, negative decreases
    UPDATE current_stock
      SET qty_on_hand = qty_on_hand + NEW.quantity
    WHERE product_id = NEW.product_id AND warehouse_id = NEW.warehouse_id;
  END IF;

  -- Audit
  INSERT INTO audit_logs (user_id, action, table_name, record_id, details)
  VALUES (NEW.created_by, 'INSERT', 'inventory_transactions', NEW.id,
          JSON_OBJECT('txn_code', NEW.txn_code, 'type', NEW.txn_type, 'qty', NEW.quantity));
END$$

CREATE TRIGGER trg_it_before_insert
BEFORE INSERT ON inventory_transactions
FOR EACH ROW
BEGIN
  DECLARE current_qty BIGINT DEFAULT 0;
  -- Ensure non-negative quantity input
  IF NEW.quantity < 0 AND NEW.txn_type <> 'ADJUST' THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Quantity cannot be negative';
  END IF;

  -- Prevent negative stock for OUT
  IF NEW.txn_type = 'OUT' THEN
    SELECT qty_on_hand INTO current_qty
    FROM current_stock
    WHERE product_id = NEW.product_id AND warehouse_id = NEW.warehouse_id
    FOR UPDATE;

    IF current_qty IS NULL THEN
      SET current_qty = 0;
    END IF;

    IF current_qty < NEW.quantity THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Insufficient stock for OUT transaction';
    END IF;
  ELSEIF NEW.txn_type = 'ADJUST' AND NEW.quantity < 0 THEN
    SELECT qty_on_hand INTO current_qty
    FROM current_stock
    WHERE product_id = NEW.product_id AND warehouse_id = NEW.warehouse_id
    FOR UPDATE;

    IF current_qty IS NULL THEN
      SET current_qty = 0;
    END IF;

    IF current_qty + NEW.quantity < 0 THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Adjustment would result in negative stock';
    END IF;
  END IF;
END$$

DELIMITER ;

-- =====================================
-- 6) Stored Procedures for Stock Movements
-- =====================================
DELIMITER $$

CREATE PROCEDURE sp_stock_in (
  IN p_product_id INT,
  IN p_warehouse_id INT,
  IN p_quantity BIGINT,
  IN p_user_id INT,
  IN p_supplier_id INT,
  IN p_reason VARCHAR(255),
  IN p_ref_document VARCHAR(100)
)
BEGIN
  DECLARE v_code VARCHAR(50);
  IF p_quantity <= 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Quantity must be > 0';
  END IF;

  SET v_code = CONCAT('IN-', DATE_FORMAT(NOW(), '%Y%m%d%H%i%s'), '-', LPAD(FLOOR(RAND()*1000), 3, '0'));

  INSERT INTO inventory_transactions (txn_code, product_id, warehouse_id, quantity, txn_type, reason, ref_document, supplier_id, created_by)
  VALUES (v_code, p_product_id, p_warehouse_id, p_quantity, 'IN', p_reason, p_ref_document, p_supplier_id, p_user_id);
END$$

CREATE PROCEDURE sp_stock_out (
  IN p_product_id INT,
  IN p_warehouse_id INT,
  IN p_quantity BIGINT,
  IN p_user_id INT,
  IN p_reason VARCHAR(255),
  IN p_ref_document VARCHAR(100)
)
BEGIN
  DECLARE v_code VARCHAR(50);
  IF p_quantity <= 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Quantity must be > 0';
  END IF;

  SET v_code = CONCAT('OUT-', DATE_FORMAT(NOW(), '%Y%m%d%H%i%s'), '-', LPAD(FLOOR(RAND()*1000), 3, '0'));

  INSERT INTO inventory_transactions (txn_code, product_id, warehouse_id, quantity, txn_type, reason, ref_document, supplier_id, created_by)
  VALUES (v_code, p_product_id, p_warehouse_id, p_quantity, 'OUT', p_reason, p_ref_document, NULL, p_user_id);
END$$

CREATE PROCEDURE sp_stock_adjust (
  IN p_product_id INT,
  IN p_warehouse_id INT,
  IN p_delta BIGINT,
  IN p_user_id INT,
  IN p_reason VARCHAR(255),
  IN p_ref_document VARCHAR(100)
)
BEGIN
  DECLARE v_code VARCHAR(50);
  DECLARE current_qty BIGINT DEFAULT 0;
  -- p_delta can be positive or negative
  IF p_delta = 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Adjustment delta cannot be 0';
  END IF;

  -- If negative adjust, ensure not going below zero
  IF p_delta < 0 THEN
    SELECT qty_on_hand INTO current_qty
    FROM current_stock
    WHERE product_id = p_product_id AND warehouse_id = p_warehouse_id
    FOR UPDATE;

    IF current_qty IS NULL THEN SET current_qty = 0; END IF;
    IF current_qty + p_delta < 0 THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Adjustment would result in negative stock';
    END IF;
  END IF;

  SET v_code = CONCAT('ADJ-', DATE_FORMAT(NOW(), '%Y%m%d%H%i%s'), '-', LPAD(FLOOR(RAND()*1000), 3, '0'));

  INSERT INTO inventory_transactions (txn_code, product_id, warehouse_id, quantity, txn_type, reason, ref_document, supplier_id, created_by)
  VALUES (v_code, p_product_id, p_warehouse_id, p_delta, 'ADJUST', p_reason, p_ref_document, NULL, p_user_id);
END$$

-- Replace previous sp_stock_adjust with signed quantity version
DROP PROCEDURE IF EXISTS sp_stock_adjust_signed$$
CREATE PROCEDURE sp_stock_adjust_signed (
  IN p_product_id INT,
  IN p_warehouse_id INT,
  IN p_signed_delta BIGINT,
  IN p_user_id INT,
  IN p_reason VARCHAR(255),
  IN p_ref_document VARCHAR(100)
)
BEGIN
  DECLARE v_code VARCHAR(50);
  DECLARE current_qty BIGINT DEFAULT 0;
  IF p_signed_delta = 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Adjustment delta cannot be 0';
  END IF;

  IF p_signed_delta < 0 THEN
    SELECT qty_on_hand INTO current_qty
    FROM current_stock
    WHERE product_id = p_product_id AND warehouse_id = p_warehouse_id
    FOR UPDATE;

    IF current_qty IS NULL THEN SET current_qty = 0; END IF;
    IF current_qty + p_signed_delta < 0 THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Adjustment would result in negative stock';
    END IF;
  END IF;

  SET v_code = CONCAT('ADJ-', DATE_FORMAT(NOW(), '%Y%m%d%H%i%s'), '-', LPAD(FLOOR(RAND()*1000), 3, '0'));

  INSERT INTO inventory_transactions (txn_code, product_id, warehouse_id, quantity, txn_type, reason, ref_document, supplier_id, created_by)
  VALUES (v_code, p_product_id, p_warehouse_id, p_signed_delta, 'ADJUST', p_reason, p_ref_document, NULL, p_user_id);
END$$

DELIMITER ;

-- =====================================
-- 7) Seed Data for Quick Testing
-- =====================================
INSERT INTO roles (name, description) VALUES
  ('manager', 'Full access to system'),
  ('staff', 'Limited access to daily operations')
ON DUPLICATE KEY UPDATE description = VALUES(description);

INSERT INTO warehouses (code, name, location) VALUES
  ('WH-HN', 'Kho Hà Nội', 'Hà Nội'),
  ('WH-HCM', 'Kho Hồ Chí Minh', 'TP.HCM')
ON DUPLICATE KEY UPDATE name = VALUES(name), location = VALUES(location);

INSERT INTO suppliers (name, contact, phone, email) VALUES
  ('Nhà Cung Cấp A', 'Anh A', '0900000001', 'a@supplier.vn'),
  ('Nhà Cung Cấp B', 'Chị B', '0900000002', 'b@supplier.vn')
ON DUPLICATE KEY UPDATE contact = VALUES(contact), phone = VALUES(phone), email = VALUES(email);

INSERT INTO products (sku, name, category, unit, reorder_level) VALUES
  ('SP-001', 'Sản phẩm 1', 'Danh mục A', 'pcs', 10),
  ('SP-002', 'Sản phẩm 2', 'Danh mục B', 'pcs', 5),
  ('SP-003', 'Sản phẩm 3', 'Danh mục A', 'box', 20)
ON DUPLICATE KEY UPDATE name = VALUES(name), category = VALUES(category), unit = VALUES(unit), reorder_level = VALUES(reorder_level);

-- Create example users (passwords are placeholders; store real bcrypt/argon2 hashes from your app)
INSERT INTO users (username, password_hash, full_name, role_id)
SELECT 'manager1', '$2b$12$replace_with_real_bcrypt_hash', 'Quản Lý 1', r.id FROM roles r WHERE r.name='manager'
ON DUPLICATE KEY UPDATE full_name = VALUES(full_name), role_id = VALUES(role_id);

INSERT INTO users (username, password_hash, full_name, role_id)
SELECT 'staff1', '$2b$12$replace_with_real_bcrypt_hash', 'Nhân Viên 1', r.id FROM roles r WHERE r.name='staff'
ON DUPLICATE KEY UPDATE full_name = VALUES(full_name), role_id = VALUES(role_id);

-- Initialize current_stock rows for all product-warehouse combinations with 0
INSERT INTO current_stock (product_id, warehouse_id, qty_on_hand)
SELECT p.id, w.id, 0
FROM products p
CROSS JOIN warehouses w
LEFT JOIN current_stock cs
  ON cs.product_id = p.id AND cs.warehouse_id = w.id
WHERE cs.product_id IS NULL;

-- Sample movements
-- Stock IN 100 units of SP-001 to WH-HN by manager1
CALL sp_stock_in(
  (SELECT id FROM products WHERE sku='SP-001'),
  (SELECT id FROM warehouses WHERE code='WH-HN'),
  100,
  (SELECT id FROM users WHERE username='manager1'),
  (SELECT id FROM suppliers WHERE name='Nhà Cung Cấp A'),
  'Nhập lô đầu kỳ',
  'PO-0001'
);

-- Stock OUT 20 units of SP-001 from WH-HN by staff1
CALL sp_stock_out(
  (SELECT id FROM products WHERE sku='SP-001'),
  (SELECT id FROM warehouses WHERE code='WH-HN'),
  20,
  (SELECT id FROM users WHERE username='staff1'),
  'Xuất bán',
  'SO-0001'
);

-- Adjust -5 units (shrinkage) of SP-001 at WH-HN by manager1
CALL sp_stock_adjust_signed(
  (SELECT id FROM products WHERE sku='SP-001'),
  (SELECT id FROM warehouses WHERE code='WH-HN'),
  -5,
  (SELECT id FROM users WHERE username='manager1'),
  'Hao hụt kiểm kê',
  'ADJ-0001'
);

-- =====================================
-- 8) Roles and Permissions (MySQL Roles)
-- Adjust as needed for your MySQL user accounts.
-- =====================================
-- Create logical roles
CREATE ROLE IF NOT EXISTS 'manager_role';
CREATE ROLE IF NOT EXISTS 'staff_role';

-- Staff: operational access only
GRANT SELECT, INSERT, UPDATE ON warehouse_db.inventory_transactions TO 'staff_role';
GRANT SELECT, UPDATE ON warehouse_db.current_stock TO 'staff_role';
GRANT SELECT ON warehouse_db.products TO 'staff_role';
GRANT SELECT ON warehouse_db.warehouses TO 'staff_role';
GRANT SELECT ON warehouse_db.suppliers TO 'staff_role';
GRANT SELECT ON warehouse_db.v_current_stock TO 'staff_role';
GRANT SELECT ON warehouse_db.v_low_stock TO 'staff_role';
GRANT SELECT ON warehouse_db.v_monthly_in_out TO 'staff_role';
GRANT SELECT ON warehouse_db.v_top_moving_products TO 'staff_role';
GRANT EXECUTE ON PROCEDURE warehouse_db.sp_stock_in TO 'staff_role';
GRANT EXECUTE ON PROCEDURE warehouse_db.sp_stock_out TO 'staff_role';
GRANT EXECUTE ON PROCEDURE warehouse_db.sp_stock_adjust_signed TO 'staff_role';

-- Manager: broader access including user management and suppliers/products
GRANT SELECT, INSERT, UPDATE, DELETE ON warehouse_db.* TO 'manager_role';
GRANT EXECUTE ON PROCEDURE warehouse_db.sp_stock_in TO 'manager_role';
GRANT EXECUTE ON PROCEDURE warehouse_db.sp_stock_out TO 'manager_role';
GRANT EXECUTE ON PROCEDURE warehouse_db.sp_stock_adjust_signed TO 'manager_role';

-- Example: attach roles to existing DB users (replace 'app_staff' and 'app_manager')
-- GRANT 'staff_role' TO 'app_staff'@'%';
-- GRANT 'manager_role' TO 'app_manager'@'%';
-- SET DEFAULT ROLE 'staff_role' TO 'app_staff'@'%';
-- SET DEFAULT ROLE 'manager_role' TO 'app_manager'@'%';

-- =====================================
-- 9) Useful Indexes (additional)
-- =====================================
CREATE INDEX idx_products_name ON products(name);
CREATE INDEX idx_suppliers_name ON suppliers(name);
CREATE INDEX idx_users_role ON users(role_id);

-- =====================================
-- 10) Notes
-- - Authentication: store bcrypt/argon2 hashes in users.password_hash produced by your app layer.
-- - Authorization: app checks users.role_id against roles.name (manager/staff) in addition to MySQL role grants if needed.
-- - Use the provided views for dashboard KPIs and charts.
-- - Use stored procedures for all stock movements so validations are enforced.
-- - Triggers ensure current_stock remains synchronized and audit trail is created.
UPDATE users SET password_hash='admin' WHERE username='manager1';
UPDATE users SET password_hash='admin' WHERE username='staff1';
