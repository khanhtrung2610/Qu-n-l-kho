# 🔗 HƯỚNG DẪN SỬ DỤNG QUAN HỆ NHÀ CUNG CẤP

## Ngày cập nhật: 7/11/2025

---

## 🎯 TÍNH NĂNG MỚI

### **Quản lý quan hệ Nhà cung cấp - Sản phẩm - Kho**

Bây giờ khi thêm/sửa **Nhà cung cấp**, bạn có thể:
- ✅ Thiết lập sản phẩm nào nhà cung cấp có thể cung cấp
- ✅ Chỉ định kho nhận hàng cho từng sản phẩm
- ✅ Đặt giá mặc định
- ✅ Thiết lập thời gian giao hàng
- ✅ Đánh dấu độ ưu tiên (cao/trung bình/thấp)

**Dữ liệu này được lưu thực sự vào bảng `product_supplier` trong database!**

---

## 📋 HƯỚNG DẪN SỬ DỤNG

### **1. Thêm Nhà Cung Cấp Mới**

#### Bước 1: Mở Modal
1. Vào trang **Nhà cung cấp**
2. Click nút **"Thêm"**
3. Modal hiện ra với 2 tabs

#### Bước 2: Điền Thông Tin Cơ Bản
**Tab "Thông tin cơ bản":**
- Tên nhà cung cấp (*bắt buộc*)
- Người liên hệ
- Điện thoại
- Email
- Địa chỉ
- Trạng thái (Hoạt động/Ngừng hoạt động)

#### Bước 3: Thêm Sản Phẩm
**Tab "Sản phẩm & Kho":**

1. **Chọn sản phẩm** từ dropdown (hiển thị SKU + tên)
2. **Chọn kho nhận hàng** (tùy chọn)
3. **Nhập giá** (VNĐ) - tùy chọn
4. **Nhập thời gian giao hàng** (số ngày) - tùy chọn
5. **Chọn độ ưu tiên**: Thấp / Trung bình / Cao
6. Click nút **"+"** để thêm

**Lặp lại** để thêm nhiều sản phẩm!

#### Bước 4: Lưu
1. Xem lại danh sách sản phẩm đã thêm
2. Click **"Lưu thông tin"**
3. Hệ thống sẽ:
   - Lưu thông tin nhà cung cấp vào bảng `suppliers`
   - Lưu tất cả quan hệ vào bảng `product_supplier`

---

### **2. Sửa Nhà Cung Cấp**

1. Click nút **"Sửa"** ở nhà cung cấp cần chỉnh
2. Modal hiện ra với:
   - **Tab 1**: Thông tin cơ bản (đã điền sẵn)
   - **Tab 2**: Danh sách sản phẩm hiện có (load từ DB)
3. Bạn có thể:
   - Sửa thông tin cơ bản
   - Thêm sản phẩm mới
   - Xóa sản phẩm hiện có (click nút Trash)
4. Click **"Lưu thông tin"**

---

## 🗄️ CẤU TRÚC DATABASE

### **Bảng `product_supplier`**

```sql
CREATE TABLE product_supplier (
  product_id INT,
  supplier_id INT,
  warehouse_id INT,
  default_price DECIMAL(15, 2),
  delivery_time INT,
  priority ENUM('low', 'medium', 'high'),
  status ENUM('active', 'inactive'),
  created_at TIMESTAMP,
  PRIMARY KEY (product_id, supplier_id, warehouse_id)
);
```

### **Quan hệ:**
- `product_id` → `products.product_id`
- `supplier_id` → `suppliers.supplier_id`
- `warehouse_id` → `warehouses.warehouse_id`

---

## 🔌 API ENDPOINTS MỚI

### **1. Thêm sản phẩm cho nhà cung cấp**
```
POST /api/product-supplier/supplier/{supplier_id}/products
```

**Body:**
```json
{
  "products": [
    {
      "product_id": 1,
      "warehouse_id": 2,
      "price": 50000,
      "delivery_time": 7,
      "priority": "high",
      "status": "active"
    },
    {
      "product_id": 3,
      "warehouse_id": null,
      "price": 120000,
      "delivery_time": 3,
      "priority": "medium"
    }
  ]
}
```

**Response:**
```json
{
  "message": "Đã thêm 2 quan hệ",
  "added": [...],
  "errors": []
}
```

---

### **2. Lấy danh sách sản phẩm của nhà cung cấp**
```
GET /api/product-supplier/supplier/{supplier_id}/products
```

**Response:**
```json
{
  "items": [
    {
      "product_id": 1,
      "product_sku": "SP001",
      "product_name": "Sản phẩm A",
      "warehouse_id": 2,
      "warehouse_code": "KHO-HN",
      "warehouse_name": "Kho Hà Nội",
      "default_price": 50000,
      "delivery_time": 7,
      "priority": "high",
      "status": "active"
    }
  ]
}
```

---

### **3. Xóa sản phẩm khỏi nhà cung cấp**
```
DELETE /api/product-supplier/supplier/{supplier_id}/products/{product_id}?warehouse_id={warehouse_id}
```

---

### **4. Cập nhật quan hệ**
```
PUT /api/product-supplier/supplier/{supplier_id}/products/{product_id}
```

**Body:**
```json
{
  "warehouse_id": 2,
  "price": 55000,
  "delivery_time": 5,
  "priority": "high",
  "status": "active"
}
```

---

## 💡 VÍ DỤ THỰC TẾ

### **Tình huống 1: Thêm nhà cung cấp mới**

**Công ty TNHH ABC** cung cấp:
- Sản phẩm "Laptop Dell" → Kho Hà Nội, giá 15,000,000 đ, giao trong 3 ngày
- Sản phẩm "Mouse Logitech" → Kho HCM, giá 500,000 đ, giao trong 7 ngày
- Sản phẩm "Bàn phím cơ" → Không chỉ định kho, giá 1,200,000 đ

**Các bước:**
1. Tab 1: Điền tên "Công ty TNHH ABC", điện thoại, email
2. Tab 2: 
   - Chọn "Laptop Dell", kho "Hà Nội", giá 15000000, 3 ngày → Click "+"
   - Chọn "Mouse Logitech", kho "HCM", giá 500000, 7 ngày → Click "+"
   - Chọn "Bàn phím cơ", để trống kho, giá 1200000 → Click "+"
3. Click "Lưu thông tin"

**Kết quả:**
- 1 bản ghi trong `suppliers`
- 3 bản ghi trong `product_supplier`

---

### **Tình huống 2: Sửa nhà cung cấp**

Bạn muốn thêm thêm sản phẩm "USB SanDisk" cho nhà cung cấp ABC:

1. Click "Sửa" ở nhà cung cấp ABC
2. Tab 2 → thấy 3 sản phẩm hiện có
3. Chọn "USB SanDisk", kho "Hà Nội", giá 300000 → Click "+"
4. Click "Lưu thông tin"

**Kết quả:**
- Thông tin nhà cung cấp giữ nguyên
- Thêm 1 bản ghi mới vào `product_supplier`

---

## 📊 HIỂN THỊ QUAN HỆ

### **Trên trang Suppliers**

**Có 2 bảng quan hệ:**

1. **Quan hệ Nhà cung cấp - Kho**
   - Hiển thị nhà cung cấp nào phục vụ kho nào
   - Số lượng sản phẩm

2. **Quan hệ Sản phẩm - Nhà cung cấp - Kho (Chi tiết)**
   - Hiển thị đầy đủ: SKU, tên sản phẩm, nhà cung cấp, kho, giá, thời gian, ưu tiên

### **Trên trang Warehouses**

**Bảng "Nhà cung cấp phục vụ kho này":**
- Hiển thị kho nào được phục vụ bởi nhà cung cấp nào
- Số lượng sản phẩm

---

## ✅ LỢI ÍCH

### **Cho Quản Lý:**
- ✅ Theo dõi nhà cung cấp nào cung cấp sản phẩm gì
- ✅ Biết kho nào nhận hàng từ nhà cung cấp nào
- ✅ Quản lý giá và thời gian giao hàng
- ✅ Ưu tiên nhà cung cấp quan trọng

### **Cho Hệ Thống:**
- ✅ Dữ liệu chính xác, có cấu trúc
- ✅ Dễ dàng báo cáo, phân tích
- ✅ Hỗ trợ tự động hóa đặt hàng sau này
- ✅ Tích hợp với module nhập kho

---

## 🔒 PHÂN QUYỀN

- **Manager**: Toàn quyền thêm/sửa/xóa
- **Staff**: Chỉ xem được thông tin

---

## 🚀 TÍNH NĂNG TƯƠNG LAI

1. **Auto-suggest**: Gợi ý nhà cung cấp khi tạo phiếu nhập
2. **Price comparison**: So sánh giá giữa các nhà cung cấp
3. **Supplier rating**: Đánh giá nhà cung cấp
4. **Order history**: Lịch sử đặt hàng
5. **Contract management**: Quản lý hợp đồng

---

## 🐛 XỬ LÝ LỖI

### **Lỗi: "Sản phẩm này đã được thêm với kho này rồi!"**
- **Nguyên nhân**: Đã tồn tại quan hệ (product_id, supplier_id, warehouse_id)
- **Giải pháp**: Chọn sản phẩm khác hoặc kho khác

### **Lỗi: "Nhà cung cấp không tồn tại"**
- **Nguyên nhân**: Supplier ID không hợp lệ
- **Giải pháp**: Reload trang và thử lại

### **Lỗi: "Chỉ quản lý mới được thêm quan hệ"**
- **Nguyên nhân**: User không có quyền manager
- **Giải pháp**: Đăng nhập với tài khoản quản lý

---

## 📝 NOTES

- **Warehouse_id có thể NULL**: Nghĩa là nhà cung cấp cung cấp sản phẩm này cho tất cả kho
- **Priority**: Dùng để ưu tiên nhà cung cấp nào khi có nhiều lựa chọn
- **Status**: Có thể đặt "inactive" để tạm ngưng quan hệ mà không xóa dữ liệu

---

**🎉 Chúc bạn sử dụng hiệu quả!**
