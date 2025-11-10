# 🔧 FRONTEND JAVASCRIPT - XÓA PRIORITY & PARENT PRODUCT

## **Cần sửa trong `frontend/main.js`:**

### **1. Xóa tất cả references đến `priority`:**

**Trong function `addProductToSupplier()`:**
```javascript
// XÓA dòng này:
const priority = el('sup-add-priority').value;

// XÓA trong object:
priority: priority,  // ← XÓA dòng này

// XÓA reset:
el('sup-add-priority').value = 'medium';  // ← XÓA dòng này
```

**Trong function `renderSupplierProducts()`:**
```javascript
// XÓA cả block priority badge:
const priorityBadge = item.priority === 'high' ? 'bg-danger' : 
  item.priority === 'medium' ? 'bg-warning' : 'bg-info';

// XÓA trong tr.innerHTML:
<td class="text-center"><span class="badge ${priorityBadge}">${item.priority}</span></td>
```

**Trong function `addSupplierToProduct()`:**
```javascript
// XÓA dòng này:
const priority = el('prod-add-priority').value;

// XÓA trong object:
priority: priority,  // ← XÓA dòng này

// XÓA reset:
el('prod-add-priority').value = 'medium';  // ← XÓA dòng này
```

**Trong function `renderProductSuppliers()`:**
```javascript
// XÓA cả block priority badge:
const priorityBadge = item.priority === 'high' ? 'bg-danger' : 
  item.priority === 'medium' ? 'bg-warning' : 'bg-info';

// XÓA trong tr.innerHTML:
<td class="text-center"><span class="badge ${priorityBadge}">${item.priority}</span></td>
```

**Trong function `loadProductSupplierWarehouse()`:**
```javascript
// XÓA dòng priority badge:
const priorityBadge = r.priority === 'high' ? 'bg-danger' : r.priority === 'medium' ? 'bg-warning' : 'bg-info';

// XÓA trong tr.innerHTML:
<td class="text-center"><span class="badge ${priorityBadge}">${r.priority || '-'}</span></td>
```

**Trong các payload gửi API:**
```javascript
// XÓA priority khỏi:
{
  warehouse_id: ...,
  delivery_date: ...,
  priority: ...,  // ← XÓA dòng này
  status: 'active'
}
```

---

### **2. Xóa tất cả references đến `parent_product`:**

**Không có trong main.js hiện tại** - đã xóa rồi!

---

## ✅ **HOẶC CHẠY LỆNH TỰ ĐỘNG:**

Chạy script này để tự động xóa:

```bash
# Backup trước
cp frontend/main.js frontend/main.js.backup

# Xóa priority references (cần tool sed hoặc sửa thủ công)
```

Hoặc tải file `main.js` đã sửa từ attachment!
