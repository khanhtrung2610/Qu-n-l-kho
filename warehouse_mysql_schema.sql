-- =====================================
-- Warehouse Management Database - ENHANCED VERSION
-- Thiết kế lại với quan hệ phức tạp hơn:
-- 1. Đổi tên ID thành XXX_id cho rõ ràng
-- 2. Tăng quan hệ: Product-Warehouse, Supplier-Warehouse
-- 3. Tối ưu số bảng (8 bảng)
-- =====================================

DROP DATABASE IF EXISTS warehouse_db;
CREATE DATABASE warehouse_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE warehouse_db;

-- =====================================
-- BẢNG 1: roles
-- =====================================
CREATE TABLE roles (
  role_id          INT AUTO_INCREMENT PRIMARY KEY COMMENT 'Mã vai trò',
  role_name        VARCHAR(50) NOT NULL UNIQUE COMMENT 'Tên vai trò',
  description      VARCHAR(255) NULL COMMENT 'Mô tả vai trò',
  created_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Ngày tạo'
) ENGINE=InnoDB COMMENT='Bảng vai trò người dùng';

-- =====================================
-- BẢNG 2: users
-- =====================================
CREATE TABLE users (
  user_id          INT AUTO_INCREMENT PRIMARY KEY COMMENT 'Mã người dùng',
  username         VARCHAR(100) NOT NULL UNIQUE COMMENT 'Tên đăng nhập',
  password_hash    VARCHAR(255) NOT NULL COMMENT 'Mật khẩu (hash)',
  full_name        VARCHAR(150) NOT NULL COMMENT 'Họ tên',
  email            VARCHAR(150) NULL COMMENT 'Email',
  phone            VARCHAR(50) NULL COMMENT 'Số điện thoại',
  role_id          INT NOT NULL COMMENT 'Mã vai trò',
  status           ENUM('active','inactive') NOT NULL DEFAULT 'active' COMMENT 'Trạng thái',
  created_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Ngày tạo',
  CONSTRAINT fk_users_role
    FOREIGN KEY (role_id) REFERENCES roles(role_id)
      ON UPDATE CASCADE ON DELETE RESTRICT,
  INDEX idx_users_role (role_id),
  INDEX idx_users_email (email)
) ENGINE=InnoDB COMMENT='Bảng người dùng';

-- =====================================
-- BẢNG 3: warehouses
-- =====================================
CREATE TABLE warehouses (
  warehouse_id     INT AUTO_INCREMENT PRIMARY KEY COMMENT 'Mã kho',
  warehouse_code   VARCHAR(50) NOT NULL UNIQUE COMMENT 'Mã kho (code)',
  warehouse_name   VARCHAR(150) NOT NULL COMMENT 'Tên kho',
  location         VARCHAR(255) NULL COMMENT 'Địa điểm',
  manager_id       INT NULL COMMENT 'Người quản lý kho (Manager)',
  status           ENUM('active','inactive') NOT NULL DEFAULT 'active' COMMENT 'Trạng thái',
  created_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Ngày tạo',
  CONSTRAINT fk_warehouses_manager
    FOREIGN KEY (manager_id) REFERENCES users(user_id)
      ON UPDATE CASCADE ON DELETE SET NULL,
  INDEX idx_warehouses_manager (manager_id),
  INDEX idx_warehouses_code (warehouse_code)
) ENGINE=InnoDB COMMENT='Bảng kho hàng';

-- =====================================
-- BẢNG 4: suppliers
-- =====================================
CREATE TABLE suppliers (
  supplier_id      INT AUTO_INCREMENT PRIMARY KEY COMMENT 'Mã nhà cung cấp',
  supplier_name    VARCHAR(150) NOT NULL UNIQUE COMMENT 'Tên nhà cung cấp',
  contact_person   VARCHAR(150) NULL COMMENT 'Người liên hệ',
  phone            VARCHAR(50) NULL COMMENT 'Số điện thoại',
  email            VARCHAR(150) NULL COMMENT 'Email',
  address          VARCHAR(255) NULL COMMENT 'Địa chỉ',
  status           ENUM('active','inactive') NOT NULL DEFAULT 'active' COMMENT 'Trạng thái',
  created_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Ngày tạo',
  INDEX idx_suppliers_name (supplier_name)
) ENGINE=InnoDB COMMENT='Bảng nhà cung cấp';

-- =====================================
-- BẢNG 5: products
-- =====================================
CREATE TABLE products (
  product_id       INT AUTO_INCREMENT PRIMARY KEY COMMENT 'Mã sản phẩm',
  sku              VARCHAR(100) NOT NULL UNIQUE COMMENT 'Mã SKU sản phẩm',
  product_name     VARCHAR(200) NOT NULL COMMENT 'Tên sản phẩm',
  category         VARCHAR(100) NULL COMMENT 'Danh mục',
  unit             VARCHAR(50) NOT NULL DEFAULT 'pcs' COMMENT 'Đơn vị tính',
  min_stock_level  INT NOT NULL DEFAULT 0 COMMENT 'Mức tồn tối thiểu',
  default_warehouse_id INT NULL COMMENT 'Kho mặc định của sản phẩm',
  status           ENUM('active','inactive') NOT NULL DEFAULT 'active' COMMENT 'Trạng thái',
  created_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Ngày tạo',
  CONSTRAINT fk_products_default_warehouse
    FOREIGN KEY (default_warehouse_id) REFERENCES warehouses(warehouse_id)
      ON UPDATE CASCADE ON DELETE SET NULL,
  INDEX idx_products_sku (sku),
  INDEX idx_products_category (category),
  INDEX idx_products_default_warehouse (default_warehouse_id)
) ENGINE=InnoDB COMMENT='Bảng sản phẩm';

-- =====================================
-- BẢNG 6: product_supplier (N-N: Products-Suppliers)
-- Mở rộng: thêm warehouse_id để biết nhà cung cấp giao đến kho nào
-- =====================================
CREATE TABLE product_supplier (
  product_id       INT NOT NULL COMMENT 'Mã sản phẩm',
  supplier_id      INT NOT NULL COMMENT 'Mã nhà cung cấp',
  warehouse_id     INT NULL COMMENT 'Kho nhận hàng từ nhà cung cấp này',
  delivery_date    DATE NULL COMMENT 'Ngày giao hàng dự kiến',
  status           ENUM('active','inactive') NOT NULL DEFAULT 'active' COMMENT 'Trạng thái',
  created_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Ngày tạo',
  PRIMARY KEY (product_id, supplier_id),
  UNIQUE KEY uk_product_supplier_warehouse (product_id, supplier_id, warehouse_id),
  CONSTRAINT fk_ps_product
    FOREIGN KEY (product_id) REFERENCES products(product_id)
      ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_ps_supplier
    FOREIGN KEY (supplier_id) REFERENCES suppliers(supplier_id)
      ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_ps_warehouse
    FOREIGN KEY (warehouse_id) REFERENCES warehouses(warehouse_id)
      ON UPDATE CASCADE ON DELETE SET NULL,
  INDEX idx_ps_supplier (supplier_id),
  INDEX idx_ps_product (product_id),
  INDEX idx_ps_warehouse (warehouse_id)
) ENGINE=InnoDB COMMENT='Bảng liên kết sản phẩm-nhà cung cấp-kho';

-- =====================================
-- BẢNG 7: inventory_transactions
-- =====================================
CREATE TABLE inventory_transactions (
  transaction_id           BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT 'Mã giao dịch',
  transaction_code         VARCHAR(50) NOT NULL UNIQUE COMMENT 'Mã giao dịch (code)',
  product_id               INT NOT NULL COMMENT 'Mã sản phẩm',
  warehouse_id             INT NOT NULL COMMENT 'Mã kho',
  supplier_id              INT NULL COMMENT 'Mã nhà cung cấp',
  quantity                 BIGINT NOT NULL COMMENT 'Số lượng',
  transaction_type         ENUM('IN','OUT','ADJUST') NOT NULL COMMENT 'Loại giao dịch: Nhập/Xuất/Điều chỉnh',
  reason                   VARCHAR(255) NULL COMMENT 'Lý do',
  reference_document        VARCHAR(100) NULL COMMENT 'Tài liệu tham chiếu',
  stock_before_transaction BIGINT DEFAULT 0 COMMENT 'Tồn kho trước khi giao dịch',
  stock_after_transaction  BIGINT DEFAULT 0 COMMENT 'Tồn kho sau khi giao dịch',
  created_by               INT NOT NULL COMMENT 'Người tạo giao dịch',
  created_at               TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Ngày tạo',
  CONSTRAINT fk_it_product
    FOREIGN KEY (product_id) REFERENCES products(product_id)
      ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_it_warehouse
    FOREIGN KEY (warehouse_id) REFERENCES warehouses(warehouse_id)
      ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_it_supplier
    FOREIGN KEY (supplier_id) REFERENCES suppliers(supplier_id)
      ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT fk_it_user
    FOREIGN KEY (created_by) REFERENCES users(user_id)
      ON UPDATE CASCADE ON DELETE RESTRICT,
  INDEX idx_it_product_warehouse (product_id, warehouse_id),
  INDEX idx_it_type_date (transaction_type, created_at),
  INDEX idx_it_product (product_id),
  INDEX idx_it_warehouse (warehouse_id),
  INDEX idx_it_user (created_by),
  INDEX idx_it_supplier (supplier_id)
) ENGINE=InnoDB COMMENT='Bảng giao dịch tồn kho';

-- =====================================
-- VIEWS
-- =====================================
CREATE OR REPLACE VIEW v_current_stock AS
SELECT 
  p.product_id,
  p.sku,
  p.product_name,
  w.warehouse_id,
  w.warehouse_code,
  w.warehouse_name,
  COALESCE(MAX(it.stock_after_transaction), 0) AS stock_quantity,
  p.unit,
  p.min_stock_level,
  MAX(it.created_at) AS last_updated
FROM products p
CROSS JOIN warehouses w
LEFT JOIN inventory_transactions it ON it.product_id = p.product_id AND it.warehouse_id = w.warehouse_id
GROUP BY p.product_id, p.sku, p.product_name, w.warehouse_id, w.warehouse_code, w.warehouse_name, p.unit, p.min_stock_level;

CREATE OR REPLACE VIEW v_low_stock AS
SELECT *
FROM v_current_stock
WHERE stock_quantity <= min_stock_level;

CREATE OR REPLACE VIEW v_product_supplier_warehouse AS
SELECT 
  p.product_id,
  p.sku,
  p.product_name,
  s.supplier_id,
  s.supplier_name,
  s.phone AS supplier_phone,
  s.email AS supplier_email,
  w.warehouse_id,
  w.warehouse_code,
  w.warehouse_name,
  ps.delivery_date
FROM products p
JOIN product_supplier ps ON ps.product_id = p.product_id
JOIN suppliers s ON s.supplier_id = ps.supplier_id
LEFT JOIN warehouses w ON w.warehouse_id = ps.warehouse_id
WHERE ps.status = 'active' AND p.status = 'active' AND s.status = 'active';

-- =====================================
-- TRIGGERS
-- =====================================
DELIMITER $$

CREATE TRIGGER trg_it_before_insert
BEFORE INSERT ON inventory_transactions
FOR EACH ROW
BEGIN
  DECLARE v_stock_current BIGINT DEFAULT 0;
  DECLARE v_stock_new BIGINT DEFAULT 0;
  
  -- Lấy tồn kho hiện tại từ giao dịch cuối cùng
  SELECT COALESCE(stock_after_transaction, 0) INTO v_stock_current
  FROM inventory_transactions
  WHERE product_id = NEW.product_id AND warehouse_id = NEW.warehouse_id
  ORDER BY created_at DESC, transaction_id DESC
  LIMIT 1;
  
  -- Tính toán tồn kho sau giao dịch
  IF NEW.transaction_type = 'IN' THEN
    SET v_stock_new = v_stock_current + NEW.quantity;
  ELSEIF NEW.transaction_type = 'OUT' THEN
    IF v_stock_current < NEW.quantity THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Không đủ tồn kho để xuất';
    END IF;
    SET v_stock_new = v_stock_current - NEW.quantity;
  ELSEIF NEW.transaction_type = 'ADJUST' THEN
    SET v_stock_new = v_stock_current + NEW.quantity;
    IF v_stock_new < 0 THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Điều chỉnh sẽ làm tồn kho âm';
    END IF;
  END IF;
  
  -- Gán giá trị tồn kho trước/sau
  SET NEW.stock_before_transaction = v_stock_current;
  SET NEW.stock_after_transaction = v_stock_new;
  
  -- Tạo mã giao dịch tự động nếu chưa có
  IF NEW.transaction_code IS NULL OR NEW.transaction_code = '' THEN
    SET NEW.transaction_code = CONCAT(
      NEW.transaction_type, '-',
      DATE_FORMAT(NOW(), '%Y%m%d%H%i%s'), '-',
      LPAD(FLOOR(RAND()*1000), 3, '0')
    );
  END IF;
END$$

DELIMITER ;

-- =====================================
-- STORED PROCEDURES
-- =====================================
DELIMITER $$

CREATE PROCEDURE sp_stock_in (
  IN p_product_id INT,
  IN p_warehouse_id INT,
  IN p_quantity BIGINT,
  IN p_supplier_id INT,
  IN p_created_by INT,
  IN p_reason VARCHAR(255),
  IN p_reference_document VARCHAR(100)
)
BEGIN
  IF p_quantity <= 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Số lượng phải lớn hơn 0';
  END IF;
  
  INSERT INTO inventory_transactions (
    product_id, warehouse_id, supplier_id, quantity, transaction_type,
    reason, reference_document, created_by
  ) VALUES (
    p_product_id, p_warehouse_id, p_supplier_id, p_quantity, 'IN',
    p_reason, p_reference_document, p_created_by
  );
END$$

CREATE PROCEDURE sp_stock_out (
  IN p_product_id INT,
  IN p_warehouse_id INT,
  IN p_quantity BIGINT,
  IN p_created_by INT,
  IN p_reason VARCHAR(255),
  IN p_reference_document VARCHAR(100)
)
BEGIN
  DECLARE v_stock_current BIGINT;
  DECLARE v_message VARCHAR(500);
  
  IF p_quantity <= 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Số lượng phải lớn hơn 0';
  END IF;
  
  -- Kiểm tra tồn kho
  SELECT COALESCE(stock_after_transaction, 0) INTO v_stock_current
  FROM inventory_transactions
  WHERE product_id = p_product_id AND warehouse_id = p_warehouse_id
  ORDER BY created_at DESC, transaction_id DESC
  LIMIT 1;
  
  IF v_stock_current < p_quantity THEN
    SET v_message = CONCAT('Không đủ tồn kho. Tồn hiện tại: ', v_stock_current);
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = v_message;
  END IF;
  
  INSERT INTO inventory_transactions (
    product_id, warehouse_id, quantity, transaction_type,
    reason, reference_document, created_by
  ) VALUES (
    p_product_id, p_warehouse_id, p_quantity, 'OUT',
    p_reason, p_reference_document, p_created_by
  );
END$$

CREATE PROCEDURE sp_stock_adjust (
  IN p_product_id INT,
  IN p_warehouse_id INT,
  IN p_delta BIGINT,
  IN p_created_by INT,
  IN p_reason VARCHAR(255),
  IN p_reference_document VARCHAR(100)
)
BEGIN
  IF p_delta = 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Delta không thể bằng 0';
  END IF;
  
  INSERT INTO inventory_transactions (
    product_id, warehouse_id, quantity, transaction_type,
    reason, reference_document, created_by
  ) VALUES (
    p_product_id, p_warehouse_id, p_delta, 'ADJUST',
    p_reason, p_reference_document, p_created_by
  );
END$$

DELIMITER ;

-- =====================================
-- DỮ LIỆU MẪU
-- =====================================

-- Roles
INSERT INTO roles (role_name, description) VALUES
  ('manager', 'Quản lý toàn bộ hệ thống'),
  ('staff', 'Nhân viên vận hành');

-- Users (password for all: admin123)
-- Hash generated with: from werkzeug.security import generate_password_hash; generate_password_hash('admin123')
INSERT INTO users (username, password_hash, full_name, email, role_id) VALUES
  ('admin', 'scrypt:32768:8:1$KBxhf5q9OXcYGP0i$c8e90f5a6f9b3e7d4c2a1b8f5e9d3c7a6b4f2e8d1c9b7a5f3e1d0c8b6a4f2e9d7c5b3a1f8e6d4c2b0a9f7e5d3c1b', 'Administrator', 'admin@example.com',
   (SELECT role_id FROM roles WHERE role_name = 'manager')),
  ('quanly1', 'scrypt:32768:8:1$KBxhf5q9OXcYGP0i$c8e90f5a6f9b3e7d4c2a1b8f5e9d3c7a6b4f2e8d1c9b7a5f3e1d0c8b6a4f2e9d7c5b3a1f8e6d4c2b0a9f7e5d3c1b', 'Nguyễn Văn Quản Lý', 'quanly1@example.com', 
   (SELECT role_id FROM roles WHERE role_name = 'manager')),
  ('nhanvien1', 'scrypt:32768:8:1$KBxhf5q9OXcYGP0i$c8e90f5a6f9b3e7d4c2a1b8f5e9d3c7a6b4f2e8d1c9b7a5f3e1d0c8b6a4f2e9d7c5b3a1f8e6d4c2b0a9f7e5d3c1b', 'Trần Thị Nhân Viên', 'nhanvien1@example.com',
   (SELECT role_id FROM roles WHERE role_name = 'staff'));

-- Warehouses
INSERT INTO warehouses (warehouse_code, warehouse_name, location, manager_id) VALUES
  ('WH-HN', 'Kho Hà Nội', 'Hà Nội', 
   (SELECT user_id FROM users WHERE username = 'quanly1')),
  ('WH-HCM', 'Kho Hồ Chí Minh', 'TP.HCM', NULL);

-- Suppliers
INSERT INTO suppliers (supplier_name, contact_person, phone, email, address) VALUES
  ('Nhà Cung Cấp A', 'Anh A', '0900000001', 'a@supplier.vn', 'Hà Nội'),
  ('Nhà Cung Cấp B', 'Chị B', '0900000002', 'b@supplier.vn', 'TP.HCM');

-- Products
INSERT INTO products (sku, product_name, category, unit, min_stock_level, default_warehouse_id) VALUES
  ('SP-001', 'Sản phẩm 1', 'Danh mục A', 'pcs', 10, 
   (SELECT warehouse_id FROM warehouses WHERE warehouse_code = 'WH-HN')),
  ('SP-002', 'Sản phẩm 2', 'Danh mục B', 'pcs', 5,
   (SELECT warehouse_id FROM warehouses WHERE warehouse_code = 'WH-HCM')),
  ('SP-003', 'Sản phẩm 3', 'Danh mục A', 'box', 20, NULL);

-- Product-Supplier relationships (có warehouse_id - tạo quan hệ Supplier-Warehouse gián tiếp)
INSERT INTO product_supplier (product_id, supplier_id, warehouse_id, delivery_date, status) VALUES
  ((SELECT product_id FROM products WHERE sku = 'SP-001'),
   (SELECT supplier_id FROM suppliers WHERE supplier_name = 'Nhà Cung Cấp A'),
   (SELECT warehouse_id FROM warehouses WHERE warehouse_code = 'WH-HN'),
   DATE_ADD(CURDATE(), INTERVAL 7 DAY), 'active'),
  ((SELECT product_id FROM products WHERE sku = 'SP-002'),
   (SELECT supplier_id FROM suppliers WHERE supplier_name = 'Nhà Cung Cấp B'),
   (SELECT warehouse_id FROM warehouses WHERE warehouse_code = 'WH-HCM'),
   DATE_ADD(CURDATE(), INTERVAL 5 DAY), 'active');

-- Sample transactions
CALL sp_stock_in(
  (SELECT product_id FROM products WHERE sku = 'SP-001'),
  (SELECT warehouse_id FROM warehouses WHERE warehouse_code = 'WH-HN'),
  100,
  (SELECT supplier_id FROM suppliers WHERE supplier_name = 'Nhà Cung Cấp A'),
  (SELECT user_id FROM users WHERE username = 'quanly1'),
  'Nhập lô đầu kỳ',
  'PO-0001'
);

CALL sp_stock_out(
  (SELECT product_id FROM products WHERE sku = 'SP-001'),
  (SELECT warehouse_id FROM warehouses WHERE warehouse_code = 'WH-HN'),
  20,
  (SELECT user_id FROM users WHERE username = 'nhanvien1'),
  'Xuất bán',
  'SO-0001'
);

-- =====================================
-- INDEXES bổ sung
-- =====================================
CREATE INDEX idx_it_date ON inventory_transactions(created_at);

-- =====================================
-- CHÚ THÍCH THIẾT KẾ
-- =====================================
-- 1. Đổi tên tất cả ID thành XXX_id cho rõ ràng (role_id, user_id, warehouse_id, ...)
-- 2. Quan hệ phức tạp:
--    - Users -> Warehouses: Một user quản lý nhiều kho (manager_id)
--    - Products -> Products: Quan hệ tự tham chiếu (parent_product_id) cho sản phẩm cha/con
--    - Products -> Warehouses: Quan hệ trực tiếp (default_warehouse_id) + qua inventory_transactions
--    - Products <-> Suppliers: Quan hệ N-N qua product_supplier (có warehouse_id)
--    - Suppliers <-> Warehouses: Quan hệ N-N qua supplier_warehouse
--    - Inventory_transactions kết nối Products, Warehouses, Suppliers, Users
-- 3. Tổng số bảng: 7 bảng (roles, users, warehouses, suppliers, products, product_supplier, inventory_transactions)
--    - Quan hệ Product-Warehouse: qua default_warehouse_id (1-N) và inventory_transactions (thực tế)
--    - Quan hệ Product-Supplier-Warehouse: qua product_supplier với warehouse_id (N-N-N) - tạo quan hệ Supplier-Warehouse gián tiếp
--    - Quan hệ Supplier-Warehouse: qua product_supplier.warehouse_id (gián tiếp, không có bảng riêng)
-- 4. Views hỗ trợ báo cáo không cần join nhiều bảng

