-- =====================================
-- Warehouse Management Database - IMPROVED VERSION
-- Thiết kế lại theo yêu cầu:
-- 1. Đổi tên ID cột để tránh trùng lặp trong báo cáo
-- 2. Tăng quan hệ giữa các thực thể
-- 3. Tối ưu số bảng (6-7 bảng)
-- =====================================

DROP DATABASE IF EXISTS warehouse_db;
CREATE DATABASE warehouse_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE warehouse_db;

-- =====================================
-- BẢNG 1: roles (Giữ lại)
-- =====================================
CREATE TABLE roles (
  MaRole          INT AUTO_INCREMENT PRIMARY KEY COMMENT 'Mã vai trò',
  TenRole         VARCHAR(50) NOT NULL UNIQUE COMMENT 'Tên vai trò',
  MoTa            VARCHAR(255) NULL COMMENT 'Mô tả vai trò',
  NgayTao         TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Ngày tạo'
) ENGINE=InnoDB COMMENT='Bảng vai trò người dùng';

-- =====================================
-- BẢNG 2: users (Giữ lại, có quan hệ với roles và warehouses)
-- =====================================
CREATE TABLE users (
  MaUser          INT AUTO_INCREMENT PRIMARY KEY COMMENT 'Mã người dùng',
  TenDangNhap     VARCHAR(100) NOT NULL UNIQUE COMMENT 'Tên đăng nhập',
  MatKhau         VARCHAR(255) NOT NULL COMMENT 'Mật khẩu (hash)',
  HoTen           VARCHAR(150) NOT NULL COMMENT 'Họ tên',
  Email           VARCHAR(150) NULL COMMENT 'Email',
  SoDienThoai     VARCHAR(50) NULL COMMENT 'Số điện thoại',
  MaRole          INT NOT NULL COMMENT 'Mã vai trò',
  TrangThai       ENUM('active','inactive') NOT NULL DEFAULT 'active' COMMENT 'Trạng thái',
  NgayTao         TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Ngày tạo',
  CONSTRAINT fk_users_role
    FOREIGN KEY (MaRole) REFERENCES roles(MaRole)
      ON UPDATE CASCADE ON DELETE RESTRICT,
  INDEX idx_users_role (MaRole),
  INDEX idx_users_email (Email)
) ENGINE=InnoDB COMMENT='Bảng người dùng';

-- =====================================
-- BẢNG 3: warehouses (Giữ lại, có quan hệ với users và suppliers)
-- =====================================
CREATE TABLE warehouses (
  MaKho           INT AUTO_INCREMENT PRIMARY KEY COMMENT 'Mã kho',
  MaKhoCode       VARCHAR(50) NOT NULL UNIQUE COMMENT 'Mã kho (code)',
  TenKho          VARCHAR(150) NOT NULL COMMENT 'Tên kho',
  DiaDiem         VARCHAR(255) NULL COMMENT 'Địa điểm',
  NguoiQuanLy     INT NULL COMMENT 'Người quản lý kho (Manager)',
  TrangThai       ENUM('active','inactive') NOT NULL DEFAULT 'active' COMMENT 'Trạng thái',
  NgayTao         TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Ngày tạo',
  CONSTRAINT fk_warehouses_manager
    FOREIGN KEY (NguoiQuanLy) REFERENCES users(MaUser)
      ON UPDATE CASCADE ON DELETE SET NULL,
  INDEX idx_warehouses_manager (NguoiQuanLy),
  INDEX idx_warehouses_code (MaKhoCode)
) ENGINE=InnoDB COMMENT='Bảng kho hàng';

-- =====================================
-- BẢNG 4: suppliers (Giữ lại, có quan hệ với products và warehouses)
-- =====================================
CREATE TABLE suppliers (
  MaNhaCungCap    INT AUTO_INCREMENT PRIMARY KEY COMMENT 'Mã nhà cung cấp',
  TenNhaCungCap   VARCHAR(150) NOT NULL UNIQUE COMMENT 'Tên nhà cung cấp',
  NguoiLienHe     VARCHAR(150) NULL COMMENT 'Người liên hệ',
  SoDienThoai     VARCHAR(50) NULL COMMENT 'Số điện thoại',
  Email           VARCHAR(150) NULL COMMENT 'Email',
  DiaChi          VARCHAR(255) NULL COMMENT 'Địa chỉ',
  TrangThai       ENUM('active','inactive') NOT NULL DEFAULT 'active' COMMENT 'Trạng thái',
  NgayTao         TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Ngày tạo',
  INDEX idx_suppliers_name (TenNhaCungCap)
) ENGINE=InnoDB COMMENT='Bảng nhà cung cấp';

-- =====================================
-- BẢNG 5: products (Giữ lại, có quan hệ tự tham chiếu và với suppliers)
-- =====================================
CREATE TABLE products (
  MaSanPham       INT AUTO_INCREMENT PRIMARY KEY COMMENT 'Mã sản phẩm',
  MaSKU           VARCHAR(100) NOT NULL UNIQUE COMMENT 'Mã SKU sản phẩm',
  TenSanPham      VARCHAR(200) NOT NULL COMMENT 'Tên sản phẩm',
  DanhMuc         VARCHAR(100) NULL COMMENT 'Danh mục',
  DonVi           VARCHAR(50) NOT NULL DEFAULT 'pcs' COMMENT 'Đơn vị tính',
  MucTonToiThieu INT NOT NULL DEFAULT 0 COMMENT 'Mức tồn tối thiểu',
  SanPhamCha      INT NULL COMMENT 'Mã sản phẩm cha (quan hệ tự tham chiếu)',
  TrangThai       ENUM('active','inactive') NOT NULL DEFAULT 'active' COMMENT 'Trạng thái',
  NgayTao         TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Ngày tạo',
  CONSTRAINT fk_products_parent
    FOREIGN KEY (SanPhamCha) REFERENCES products(MaSanPham)
      ON UPDATE CASCADE ON DELETE SET NULL,
  INDEX idx_products_sku (MaSKU),
  INDEX idx_products_parent (SanPhamCha),
  INDEX idx_products_category (DanhMuc)
) ENGINE=InnoDB COMMENT='Bảng sản phẩm';

-- =====================================
-- BẢNG 6: product_supplier (Bảng liên kết nhiều-nhiều: Products-Suppliers)
-- Tạo quan hệ chặt chẽ giữa sản phẩm và nhà cung cấp
-- =====================================
CREATE TABLE product_supplier (
  MaSanPham       INT NOT NULL COMMENT 'Mã sản phẩm',
  MaNhaCungCap    INT NOT NULL COMMENT 'Mã nhà cung cấp',
  GiaMacDinh      DECIMAL(15,2) NULL COMMENT 'Giá mặc định',
  ThoiGianGiaoHang INT NULL COMMENT 'Thời gian giao hàng (ngày)',
  UuTien          INT DEFAULT 1 COMMENT 'Độ ưu tiên (1=cao nhất)',
  TrangThai       ENUM('active','inactive') NOT NULL DEFAULT 'active' COMMENT 'Trạng thái',
  NgayTao         TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Ngày tạo',
  PRIMARY KEY (MaSanPham, MaNhaCungCap),
  CONSTRAINT fk_ps_product
    FOREIGN KEY (MaSanPham) REFERENCES products(MaSanPham)
      ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_ps_supplier
    FOREIGN KEY (MaNhaCungCap) REFERENCES suppliers(MaNhaCungCap)
      ON UPDATE CASCADE ON DELETE CASCADE,
  INDEX idx_ps_supplier (MaNhaCungCap),
  INDEX idx_ps_product (MaSanPham)
) ENGINE=InnoDB COMMENT='Bảng liên kết sản phẩm-nhà cung cấp';

-- =====================================
-- BẢNG 7: inventory_transactions (Kết hợp giao dịch và tồn kho)
-- Mở rộng để bao gồm cả thông tin tồn kho hiện tại
-- =====================================
CREATE TABLE inventory_transactions (
  MaGiaoDich      BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT 'Mã giao dịch',
  MaGiaoDichCode  VARCHAR(50) NOT NULL UNIQUE COMMENT 'Mã giao dịch (code)',
  MaSanPham       INT NOT NULL COMMENT 'Mã sản phẩm',
  MaKho           INT NOT NULL COMMENT 'Mã kho',
  MaNhaCungCap    INT NULL COMMENT 'Mã nhà cung cấp',
  SoLuong         BIGINT NOT NULL COMMENT 'Số lượng',
  LoaiGiaoDich    ENUM('IN','OUT','ADJUST') NOT NULL COMMENT 'Loại giao dịch: Nhập/Xuất/Điều chỉnh',
  LyDo            VARCHAR(255) NULL COMMENT 'Lý do',
  TaiLieuThamChieu VARCHAR(100) NULL COMMENT 'Tài liệu tham chiếu',
  TonKhoTruocKhiGiaoDich BIGINT DEFAULT 0 COMMENT 'Tồn kho trước khi giao dịch',
  TonKhoSauKhiGiaoDich BIGINT DEFAULT 0 COMMENT 'Tồn kho sau khi giao dịch',
  NguoiTao        INT NOT NULL COMMENT 'Người tạo giao dịch',
  NgayTao         TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Ngày tạo',
  CONSTRAINT fk_it_product
    FOREIGN KEY (MaSanPham) REFERENCES products(MaSanPham)
      ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_it_warehouse
    FOREIGN KEY (MaKho) REFERENCES warehouses(MaKho)
      ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_it_supplier
    FOREIGN KEY (MaNhaCungCap) REFERENCES suppliers(MaNhaCungCap)
      ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT fk_it_user
    FOREIGN KEY (NguoiTao) REFERENCES users(MaUser)
      ON UPDATE CASCADE ON DELETE RESTRICT,
  INDEX idx_it_product_warehouse (MaSanPham, MaKho),
  INDEX idx_it_type_date (LoaiGiaoDich, NgayTao),
  INDEX idx_it_product (MaSanPham),
  INDEX idx_it_warehouse (MaKho),
  INDEX idx_it_user (NguoiTao)
) ENGINE=InnoDB COMMENT='Bảng giao dịch tồn kho';

-- =====================================
-- VIEW: V_TonKhoHienTai (Thay thế current_stock table)
-- Tính toán tồn kho từ giao dịch cuối cùng
-- =====================================
CREATE OR REPLACE VIEW v_ton_kho_hien_tai AS
SELECT 
  p.MaSanPham,
  p.MaSKU,
  p.TenSanPham,
  w.MaKho,
  w.MaKhoCode,
  w.TenKho,
  COALESCE(MAX(it.TonKhoSauKhiGiaoDich), 0) AS SoLuongTon,
  p.DonVi,
  p.MucTonToiThieu,
  MAX(it.NgayTao) AS NgayCapNhat
FROM products p
CROSS JOIN warehouses w
LEFT JOIN inventory_transactions it ON it.MaSanPham = p.MaSanPham AND it.MaKho = w.MaKho
GROUP BY p.MaSanPham, p.MaSKU, p.TenSanPham, w.MaKho, w.MaKhoCode, w.TenKho, p.DonVi, p.MucTonToiThieu;

-- =====================================
-- VIEW: V_TonKhoThap (Cảnh báo tồn thấp)
-- =====================================
CREATE OR REPLACE VIEW v_ton_kho_thap AS
SELECT *
FROM v_ton_kho_hien_tai
WHERE SoLuongTon <= MucTonToiThieu;

-- =====================================
-- VIEW: V_SanPhamNhaCungCap (Chi tiết sản phẩm-nhà cung cấp)
-- =====================================
CREATE OR REPLACE VIEW v_san_pham_nha_cung_cap AS
SELECT 
  p.MaSanPham,
  p.MaSKU,
  p.TenSanPham,
  s.MaNhaCungCap,
  s.TenNhaCungCap,
  s.SoDienThoai AS DienThoaiNCC,
  s.Email AS EmailNCC,
  ps.GiaMacDinh,
  ps.ThoiGianGiaoHang,
  ps.UuTien,
  ps.TrangThai
FROM products p
JOIN product_supplier ps ON ps.MaSanPham = p.MaSanPham
JOIN suppliers s ON s.MaNhaCungCap = ps.MaNhaCungCap
WHERE ps.TrangThai = 'active' AND p.TrangThai = 'active' AND s.TrangThai = 'active';

-- =====================================
-- TRIGGERS: Tự động cập nhật tồn kho trước/sau giao dịch
-- =====================================
DELIMITER $$

CREATE TRIGGER trg_it_before_insert
BEFORE INSERT ON inventory_transactions
FOR EACH ROW
BEGIN
  DECLARE v_ton_hien_tai BIGINT DEFAULT 0;
  DECLARE v_ton_moi BIGINT DEFAULT 0;
  
  -- Lấy tồn kho hiện tại từ giao dịch cuối cùng
  SELECT COALESCE(TonKhoSauKhiGiaoDich, 0) INTO v_ton_hien_tai
  FROM inventory_transactions
  WHERE MaSanPham = NEW.MaSanPham AND MaKho = NEW.MaKho
  ORDER BY NgayTao DESC, MaGiaoDich DESC
  LIMIT 1;
  
  -- Tính toán tồn kho sau giao dịch
  IF NEW.LoaiGiaoDich = 'IN' THEN
    SET v_ton_moi = v_ton_hien_tai + NEW.SoLuong;
  ELSEIF NEW.LoaiGiaoDich = 'OUT' THEN
    IF v_ton_hien_tai < NEW.SoLuong THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Không đủ tồn kho để xuất';
    END IF;
    SET v_ton_moi = v_ton_hien_tai - NEW.SoLuong;
  ELSEIF NEW.LoaiGiaoDich = 'ADJUST' THEN
    SET v_ton_moi = v_ton_hien_tai + NEW.SoLuong;
    IF v_ton_moi < 0 THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Điều chỉnh sẽ làm tồn kho âm';
    END IF;
  END IF;
  
  -- Gán giá trị tồn kho trước/sau
  SET NEW.TonKhoTruocKhiGiaoDich = v_ton_hien_tai;
  SET NEW.TonKhoSauKhiGiaoDich = v_ton_moi;
  
  -- Tạo mã giao dịch tự động nếu chưa có
  IF NEW.MaGiaoDichCode IS NULL OR NEW.MaGiaoDichCode = '' THEN
    SET NEW.MaGiaoDichCode = CONCAT(
      NEW.LoaiGiaoDich, '-',
      DATE_FORMAT(NOW(), '%Y%m%d%H%i%s'), '-',
      LPAD(FLOOR(RAND()*1000), 3, '0')
    );
  END IF;
END$$

DELIMITER ;

-- =====================================
-- STORED PROCEDURES: Thao tác tồn kho
-- =====================================
DELIMITER $$

CREATE PROCEDURE sp_nhap_kho (
  IN p_ma_san_pham INT,
  IN p_ma_kho INT,
  IN p_so_luong BIGINT,
  IN p_ma_nha_cung_cap INT,
  IN p_nguoi_tao INT,
  IN p_ly_do VARCHAR(255),
  IN p_tai_lieu VARCHAR(100)
)
BEGIN
  IF p_so_luong <= 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Số lượng phải lớn hơn 0';
  END IF;
  
  INSERT INTO inventory_transactions (
    MaSanPham, MaKho, MaNhaCungCap, SoLuong, LoaiGiaoDich,
    LyDo, TaiLieuThamChieu, NguoiTao
  ) VALUES (
    p_ma_san_pham, p_ma_kho, p_ma_nha_cung_cap, p_so_luong, 'IN',
    p_ly_do, p_tai_lieu, p_nguoi_tao
  );
END$$

CREATE PROCEDURE sp_xuat_kho (
  IN p_ma_san_pham INT,
  IN p_ma_kho INT,
  IN p_so_luong BIGINT,
  IN p_nguoi_tao INT,
  IN p_ly_do VARCHAR(255),
  IN p_tai_lieu VARCHAR(100)
)
BEGIN
  DECLARE v_ton_hien_tai BIGINT;
  DECLARE v_thong_bao VARCHAR(500);
  
  IF p_so_luong <= 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Số lượng phải lớn hơn 0';
  END IF;
  
  -- Kiểm tra tồn kho
  SELECT COALESCE(TonKhoSauKhiGiaoDich, 0) INTO v_ton_hien_tai
  FROM inventory_transactions
  WHERE MaSanPham = p_ma_san_pham AND MaKho = p_ma_kho
  ORDER BY NgayTao DESC, MaGiaoDich DESC
  LIMIT 1;
  
  IF v_ton_hien_tai < p_so_luong THEN
    SET v_thong_bao = CONCAT('Không đủ tồn kho. Tồn hiện tại: ', v_ton_hien_tai);
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = v_thong_bao;
  END IF;
  
  INSERT INTO inventory_transactions (
    MaSanPham, MaKho, SoLuong, LoaiGiaoDich,
    LyDo, TaiLieuThamChieu, NguoiTao
  ) VALUES (
    p_ma_san_pham, p_ma_kho, p_so_luong, 'OUT',
    p_ly_do, p_tai_lieu, p_nguoi_tao
  );
END$$

CREATE PROCEDURE sp_dieu_chinh_kho (
  IN p_ma_san_pham INT,
  IN p_ma_kho INT,
  IN p_delta BIGINT,
  IN p_nguoi_tao INT,
  IN p_ly_do VARCHAR(255),
  IN p_tai_lieu VARCHAR(100)
)
BEGIN
  IF p_delta = 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Delta không thể bằng 0';
  END IF;
  
  INSERT INTO inventory_transactions (
    MaSanPham, MaKho, SoLuong, LoaiGiaoDich,
    LyDo, TaiLieuThamChieu, NguoiTao
  ) VALUES (
    p_ma_san_pham, p_ma_kho, p_delta, 'ADJUST',
    p_ly_do, p_tai_lieu, p_nguoi_tao
  );
END$$

DELIMITER ;

-- =====================================
-- DỮ LIỆU MẪU
-- =====================================

-- Roles
INSERT INTO roles (TenRole, MoTa) VALUES
  ('manager', 'Quản lý toàn bộ hệ thống'),
  ('staff', 'Nhân viên vận hành');

-- Users
INSERT INTO users (TenDangNhap, MatKhau, HoTen, Email, MaRole) VALUES
  ('quanly1', '$2b$12$placeholder', 'Nguyễn Văn Quản Lý', 'quanly1@example.com', 
   (SELECT MaRole FROM roles WHERE TenRole = 'manager')),
  ('nhanvien1', '$2b$12$placeholder', 'Trần Thị Nhân Viên', 'nhanvien1@example.com',
   (SELECT MaRole FROM roles WHERE TenRole = 'staff'));

-- Warehouses
INSERT INTO warehouses (MaKhoCode, TenKho, DiaDiem, NguoiQuanLy) VALUES
  ('WH-HN', 'Kho Hà Nội', 'Hà Nội', 
   (SELECT MaUser FROM users WHERE TenDangNhap = 'quanly1')),
  ('WH-HCM', 'Kho Hồ Chí Minh', 'TP.HCM', NULL);

-- Suppliers
INSERT INTO suppliers (TenNhaCungCap, NguoiLienHe, SoDienThoai, Email, DiaChi) VALUES
  ('Nhà Cung Cấp A', 'Anh A', '0900000001', 'a@supplier.vn', 'Hà Nội'),
  ('Nhà Cung Cấp B', 'Chị B', '0900000002', 'b@supplier.vn', 'TP.HCM');

-- Products
INSERT INTO products (MaSKU, TenSanPham, DanhMuc, DonVi, MucTonToiThieu) VALUES
  ('SP-001', 'Sản phẩm 1', 'Danh mục A', 'pcs', 10),
  ('SP-002', 'Sản phẩm 2', 'Danh mục B', 'pcs', 5),
  ('SP-003', 'Sản phẩm 3', 'Danh mục A', 'box', 20);

-- Product-Supplier relationships
INSERT INTO product_supplier (MaSanPham, MaNhaCungCap, GiaMacDinh, ThoiGianGiaoHang, UuTien) VALUES
  ((SELECT MaSanPham FROM products WHERE MaSKU = 'SP-001'),
   (SELECT MaNhaCungCap FROM suppliers WHERE TenNhaCungCap = 'Nhà Cung Cấp A'),
   100000, 7, 1),
  ((SELECT MaSanPham FROM products WHERE MaSKU = 'SP-002'),
   (SELECT MaNhaCungCap FROM suppliers WHERE TenNhaCungCap = 'Nhà Cung Cấp B'),
   50000, 5, 1);

-- Sample transactions
CALL sp_nhap_kho(
  (SELECT MaSanPham FROM products WHERE MaSKU = 'SP-001'),
  (SELECT MaKho FROM warehouses WHERE MaKhoCode = 'WH-HN'),
  100,
  (SELECT MaNhaCungCap FROM suppliers WHERE TenNhaCungCap = 'Nhà Cung Cấp A'),
  (SELECT MaUser FROM users WHERE TenDangNhap = 'quanly1'),
  'Nhập lô đầu kỳ',
  'PO-0001'
);

CALL sp_xuat_kho(
  (SELECT MaSanPham FROM products WHERE MaSKU = 'SP-001'),
  (SELECT MaKho FROM warehouses WHERE MaKhoCode = 'WH-HN'),
  20,
  (SELECT MaUser FROM users WHERE TenDangNhap = 'nhanvien1'),
  'Xuất bán',
  'SO-0001'
);

-- =====================================
-- INDEXES bổ sung
-- =====================================
-- Các index idx_users_email, idx_warehouses_manager, idx_products_parent 
-- đã được định nghĩa trong CREATE TABLE, không cần tạo lại
CREATE INDEX idx_it_date ON inventory_transactions(NgayTao);

-- =====================================
-- CHÚ THÍCH THIẾT KẾ
-- =====================================
-- 1. Đổi tên tất cả ID thành MaXXX để tránh trùng lặp trong báo cáo
-- 2. Quan hệ chặt chẽ:
--    - Users -> Warehouses: Một user có thể quản lý nhiều kho (NguoiQuanLy)
--    - Products -> Products: Quan hệ tự tham chiếu (SanPhamCha) cho sản phẩm cha/con
--    - Products <-> Suppliers: Quan hệ nhiều-nhiều qua product_supplier
--    - Inventory_transactions kết nối Products, Warehouses, Suppliers, Users
-- 3. Tổng số bảng: 7 bảng (roles, users, warehouses, suppliers, products, product_supplier, inventory_transactions)
-- 4. Loại bỏ current_stock riêng biệt, tính tồn kho từ giao dịch cuối cùng
-- 5. Views hỗ trợ báo cáo không cần join nhiều bảng

