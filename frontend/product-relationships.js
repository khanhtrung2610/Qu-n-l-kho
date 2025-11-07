// Product Relationships Management
// Handles suppliers for products

let productSuppliers = []; // Temp storage

async function openProdCrudModal(data) {
  const idEl = el('prod-id');
  el('prod-sku').value = data?.sku || '';
  el('prod-name').value = data?.name || '';
  el('prod-category').value = data?.category || '';
  el('prod-unit').value = data?.unit || 'pcs';
  el('prod-reorder').value = data?.reorder_level ?? 0;
  el('prod-status').value = data?.status || 'active';
  idEl.value = data?.id || '';
  el('prod-title').textContent = data ? 'Sửa sản phẩm' : 'Thêm sản phẩm';
  
  // Disable SKU edit when updating
  el('prod-sku').disabled = !!data?.id;
  
  // Reset suppliers list
  productSuppliers = [];
  
  // Load catalogs for dropdowns
  await ensureCatalogsLoaded();
  
  // Load warehouses dropdown
  const whSel = el('prod-default-warehouse');
  whSel.innerHTML = '<option value="">-- Không có --</option>' + 
    catalog.warehouses.map(w => `<option value="${w.id}">${w.code} - ${w.name}</option>`).join('');
  if (data?.default_warehouse_id) whSel.value = data.default_warehouse_id;
  
  // Load parent products dropdown
  const parentSel = el('prod-parent');
  const currentId = data?.id;
  parentSel.innerHTML = '<option value="">-- Không có --</option>' + 
    catalog.products.filter(p => p.id !== currentId).map(p => 
      `<option value="${p.id}">${p.sku} - ${p.name}</option>`
    ).join('');
  if (data?.parent_product_id) parentSel.value = data.parent_product_id;
  
  // Populate supplier dropdown (Tab 2)
  const supplierSel = el('prod-add-supplier');
  supplierSel.innerHTML = '<option value="">-- Chọn nhà cung cấp --</option>' + 
    catalog.suppliers.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
  
  // Populate warehouse dropdown for Tab 2
  const whSel2 = el('prod-add-warehouse');
  whSel2.innerHTML = '<option value="">-- Chọn kho --</option>' + 
    catalog.warehouses.map(w => `<option value="${w.id}">${w.code} - ${w.name}</option>`).join('');
  
  // Load existing suppliers if editing
  if (data?.id) {
    try {
      const res = await api(`/product-supplier/supplier/${data.id}/products`);
      // Note: API returns supplier->products, need to adapt
      // For now, we'll fetch from relationships endpoint
      const relRes = await api(`/relationships/product-supplier-warehouse`);
      productSuppliers = (relRes.items || []).filter(item => item.product_id === data.id);
      renderProductSuppliers();
    } catch (e) {
      console.error('Error loading product suppliers:', e);
      renderProductSuppliers();
    }
  } else {
    renderProductSuppliers();
  }
  
  // Setup add supplier button
  const btnAdd = el('prod-btn-add-supplier');
  btnAdd.replaceWith(btnAdd.cloneNode(true));
  el('prod-btn-add-supplier').addEventListener('click', addSupplierToProduct);
  
  const modal = new bootstrap.Modal(document.getElementById('prod-modal'));
  const btn = el('prod-save');
  const handler = async ()=>{
    const body = {
      sku: el('prod-sku').value.trim(),
      name: el('prod-name').value.trim(),
      category: el('prod-category').value.trim(),
      unit: el('prod-unit').value.trim() || 'pcs',
      reorder_level: Number(el('prod-reorder').value || 0),
      status: el('prod-status').value,
      default_warehouse_id: el('prod-default-warehouse').value ? Number(el('prod-default-warehouse').value) : null,
      parent_product_id: el('prod-parent').value ? Number(el('prod-parent').value) : null,
    };
    
    if (!idEl.value && !body.sku) { alert('SKU bắt buộc'); return; }
    if (!body.name) { alert('Tên bắt buộc'); return; }
    
    try {
      let productId = idEl.value;
      
      // Save product info first
      if (productId) {
        await api(`/products/${productId}`, {method:'PUT', body});
      } else {
        const res = await api('/products', {method:'POST', body});
        productId = res.item.id;
      }
      
      // Save supplier relationships
      if (productSuppliers.length > 0) {
        for (const sup of productSuppliers) {
          const supplierId = sup.supplier_id;
          const productsData = [{
            product_id: productId,
            warehouse_id: sup.warehouse_id || null,
            price: sup.default_price || null,
            delivery_time: sup.delivery_time || null,
            priority: sup.priority || 'medium',
            status: 'active'
          }];
          
          await api(`/product-supplier/supplier/${supplierId}/products`, {
            method: 'POST',
            body: { products: productsData }
          });
        }
      }
      
      modal.hide();
      await refreshCatalogs();
      await loadProducts();
      alert('Đã lưu thành công!');
    } catch (e) {
      alert(e.message || 'Lỗi khi lưu');
    }
  };
  btn.replaceWith(btn.cloneNode(true));
  el('prod-save').addEventListener('click', handler);
  modal.show();
}

function addSupplierToProduct() {
  const supplierId = Number(el('prod-add-supplier').value);
  const warehouseId = Number(el('prod-add-warehouse').value) || null;
  const price = Number(el('prod-add-price').value) || null;
  const delivery = Number(el('prod-add-delivery').value) || null;
  const priority = el('prod-add-priority').value;
  
  if (!supplierId) {
    alert('Vui lòng chọn nhà cung cấp');
    return;
  }
  
  // Check duplicate
  const exists = productSuppliers.find(s => 
    s.supplier_id === supplierId && 
    (s.warehouse_id === warehouseId || (!s.warehouse_id && !warehouseId))
  );
  
  if (exists) {
    alert('Nhà cung cấp này đã được thêm với kho này rồi!');
    return;
  }
  
  const supplier = catalog.suppliers.find(s => s.id === supplierId);
  const warehouse = warehouseId ? catalog.warehouses.find(w => w.id === warehouseId) : null;
  
  productSuppliers.push({
    supplier_id: supplierId,
    supplier_name: supplier.name,
    warehouse_id: warehouseId,
    warehouse_code: warehouse?.code,
    warehouse_name: warehouse?.name,
    default_price: price,
    delivery_time: delivery,
    priority: priority,
    status: 'active'
  });
  
  // Reset form
  el('prod-add-supplier').value = '';
  el('prod-add-warehouse').value = '';
  el('prod-add-price').value = '';
  el('prod-add-delivery').value = '';
  el('prod-add-priority').value = 'medium';
  
  renderProductSuppliers();
}

function renderProductSuppliers() {
  const tbody = el('prod-suppliers-list');
  if (!tbody) return;
  
  if (productSuppliers.length === 0) {
    tbody.innerHTML = `<tr>
      <td colspan="7" class="text-center text-muted py-4">
        <i class="bi bi-inbox fs-3"></i>
        <p class="mb-0 mt-2">Chưa có nhà cung cấp. Thêm ở trên.</p>
      </td>
    </tr>`;
    return;
  }
  
  tbody.innerHTML = '';
  productSuppliers.forEach((item, idx) => {
    const tr = document.createElement('tr');
    const priceDisplay = item.default_price ? 
      Number(item.default_price).toLocaleString('vi-VN') + ' đ' : 
      '<span class="text-muted">-</span>';
    const deliveryDisplay = item.delivery_time ? 
      `${item.delivery_time} ngày` : 
      '<span class="text-muted">-</span>';
    const priorityBadge = item.priority === 'high' ? 'bg-danger' : 
      item.priority === 'medium' ? 'bg-warning' : 'bg-info';
    
    tr.innerHTML = `
      <td><i class="bi bi-truck text-muted me-2"></i><strong>${item.supplier_name}</strong></td>
      <td>${item.warehouse_code ? `<i class="bi bi-building text-muted me-1"></i>${item.warehouse_code} - ${item.warehouse_name}` : '<span class="text-muted">-</span>'}</td>
      <td class="text-end">${priceDisplay}</td>
      <td class="text-center">${deliveryDisplay}</td>
      <td class="text-center"><span class="badge ${priorityBadge}">${item.priority}</span></td>
      <td class="text-center"><span class="badge bg-success">active</span></td>
      <td class="text-center">
        <button class="btn btn-sm btn-danger" data-remove="${idx}" title="Xóa">
          <i class="bi bi-trash"></i>
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });
  
  // Add remove handlers
  tbody.querySelectorAll('[data-remove]').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = Number(btn.getAttribute('data-remove'));
      if (confirm('Xóa nhà cung cấp này?')) {
        productSuppliers.splice(idx, 1);
        renderProductSuppliers();
      }
    });
  });
}
