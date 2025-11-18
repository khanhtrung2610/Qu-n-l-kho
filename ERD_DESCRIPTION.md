# ERD - Warehouse Management Database (Improved Version)

## Tổng quan
Database được thiết kế lại với **7 bảng** chính, các quan hệ chặt chẽ hơn và đổi tên ID để tránh trùng lặp trong báo cáo.

## Các bảng và quan hệ

### 1. **roles** (Vai trò)
- **Primary Key**: `MaRole`
- **Thuộc tính**: 
  - `TenRole` (Tên vai trò)
  - `MoTa` (Mô tả)
  - `NgayTao` (Ngày tạo)

### 2. **users** (Người dùng)
- **Primary Key**: `MaUser`
- **Foreign Keys**:
  - `MaRole` → `roles.MaRole` (Quan hệ 1-N với roles)
- **Thuộc tính**:
  - `TenDangNhap`, `MatKhau`, `HoTen`, `Email`, `SoDienThoai`
  - `TrangThai`, `NgayTao`
- **Quan hệ**:
  - 1-N với `warehouses` (một user quản lý nhiều kho) qua `warehouses.NguoiQuanLy`
  - 1-N với `inventory_transactions` (một user tạo nhiều giao dịch)

### 3. **warehouses** (Kho hàng)
- **Primary Key**: `MaKho`
- **Foreign Keys**:
  - `NguoiQuanLy` → `users.MaUser` (Quan hệ N-1 với users)
- **Thuộc tính**:
  - `MaKhoCode`, `TenKho`, `DiaDiem`, `TrangThai`, `NgayTao`
- **Quan hệ**:
  - N-1 với `users` (nhiều kho được quản lý bởi một user)
  - 1-N với `inventory_transactions` (một kho có nhiều giao dịch)

### 4. **suppliers** (Nhà cung cấp)
- **Primary Key**: `MaNhaCungCap`
- **Thuộc tính**:
  - `TenNhaCungCap`, `NguoiLienHe`, `SoDienThoai`, `Email`, `DiaChi`
  - `TrangThai`, `NgayTao`
- **Quan hệ**:
  - N-N với `products` qua bảng `product_supplier` (một sản phẩm có nhiều nhà cung cấp, một nhà cung cấp cung cấp nhiều sản phẩm)
  - 1-N với `inventory_transactions` (một nhà cung cấp có nhiều giao dịch nhập)

### 5. **products** (Sản phẩm)
- **Primary Key**: `MaSanPham`
- **Foreign Keys**:
  - `SanPhamCha` → `products.MaSanPham` (Quan hệ tự tham chiếu: sản phẩm cha-con)
- **Thuộc tính**:
  - `MaSKU`, `TenSanPham`, `DanhMuc`, `DonVi`, `MucTonToiThieu`
  - `TrangThai`, `NgayTao`
- **Quan hệ**:
  - 1-N với chính nó (một sản phẩm có thể có nhiều sản phẩm con)
  - N-N với `suppliers` qua `product_supplier`
  - 1-N với `inventory_transactions` (một sản phẩm có nhiều giao dịch)

### 6. **product_supplier** (Bảng liên kết Sản phẩm-Nhà cung cấp)
- **Primary Key**: `(MaSanPham, MaNhaCungCap)` (Composite)
- **Foreign Keys**:
  - `MaSanPham` → `products.MaSanPham`
  - `MaNhaCungCap` → `suppliers.MaNhaCungCap`
- **Thuộc tính**:
  - `GiaMacDinh`, `ThoiGianGiaoHang`, `UuTien`, `TrangThai`, `NgayTao`
- **Mục đích**: Tạo quan hệ nhiều-nhiều giữa Products và Suppliers, lưu thông tin giá và thời gian giao hàng

### 7. **inventory_transactions** (Giao dịch tồn kho)
- **Primary Key**: `MaGiaoDich`
- **Foreign Keys**:
  - `MaSanPham` → `products.MaSanPham`
  - `MaKho` → `warehouses.MaKho`
  - `MaNhaCungCap` → `suppliers.MaNhaCungCap` (nullable)
  - `NguoiTao` → `users.MaUser`
- **Thuộc tính**:
  - `MaGiaoDichCode`, `SoLuong`, `LoaiGiaoDich` (IN/OUT/ADJUST)
  - `LyDo`, `TaiLieuThamChieu`
  - `TonKhoTruocKhiGiaoDich`, `TonKhoSauKhiGiaoDich` (tự động tính từ trigger)
  - `NgayTao`
- **Mục đích**: Ghi lại mọi giao dịch tồn kho, kết nối với tất cả các bảng chính

## Sơ đồ quan hệ

```
roles (1) ──────< (N) users (1) ──────< (N) warehouses
                                    │
                                    │
products (1) ──────< (N) inventory_transactions (N) ──────> (1) suppliers
   │                    │                          │
   │                    │                          │
   │                    │                          │
   └───< (N) product_supplier (N) ────────────────┘
   
products (1) ──────< (N) products (self-reference: SanPhamCha)
```

## Cải tiến so với phiên bản cũ

### 1. Đổi tên ID cột
- Tất cả cột ID được đổi từ `id` thành `MaXXX` (MaRole, MaUser, MaKho, etc.)
- Tránh trùng lặp khi viết báo cáo, dễ nhận biết nguồn gốc

### 2. Quan hệ chặt chẽ hơn
- **Users ↔ Warehouses**: Thêm quan hệ quản lý (NguoiQuanLy)
- **Products ↔ Products**: Quan hệ tự tham chiếu (sản phẩm cha-con)
- **Products ↔ Suppliers**: Quan hệ nhiều-nhiều qua `product_supplier`
- **Inventory_transactions**: Kết nối với tất cả bảng chính

### 3. Tối ưu số bảng
- Giảm từ 8 xuống **7 bảng** chính
- Loại bỏ `current_stock` riêng biệt, tính tồn kho từ giao dịch cuối cùng
- Loại bỏ `audit_logs` (có thể thêm lại nếu cần)

### 4. Views hỗ trợ
- `v_ton_kho_hien_tai`: Tính tồn kho hiện tại
- `v_ton_kho_thap`: Cảnh báo tồn thấp
- `v_san_pham_nha_cung_cap`: Chi tiết sản phẩm-nhà cung cấp

## Sử dụng trong ứng dụng

1. **Báo cáo**: Sử dụng các tên cột `MaXXX` rõ ràng, không bị trùng lặp
2. **Quản lý**: User quản lý kho qua `warehouses.NguoiQuanLy`
3. **Sản phẩm**: Hỗ trợ sản phẩm cha-con và nhiều nhà cung cấp
4. **Tồn kho**: Tính toán tự động từ giao dịch, không cần bảng riêng

