// Warehouse Relationships Management
// Shows products with default warehouse

async function openWhModal(data) {
  const idEl = el('wh-id');
  el('wh-code').value = data?.code || '';
  el('wh-name').value = data?.name || '';
  el('wh-location').value = data?.location || '';
  el('wh-status').value = data?.status || 'active';
  idEl.value = data?.id || '';
  el('wh-title').textContent = data ? 'Sửa kho' : 'Thêm kho';
  
  // Disable code edit when updating
  el('wh-code').disabled = !!data?.id;
  
  // Load catalogs
  await ensureCatalogsLoaded();
  
  // Populate manager dropdown (only managers)
  const managerSel = el('wh-manager');
  managerSel.innerHTML = '<option value="">-- Chọn người quản lý --</option>';
  
  // We need to load users and filter by role
  try {
    const usersRes = await api('/users');
    const managers = (usersRes.items || []).filter(u => u.role === 'manager' && u.status === 'active');
    managerSel.innerHTML += managers.map(m => 
      `<option value="${m.id}">${m.full_name} (${m.username})</option>`
    ).join('');
  } catch (e) {
    console.error('Error loading managers:', e);
  }
  
  if (data?.manager_id) managerSel.value = data.manager_id;
  
  // Load products with this warehouse as default (Tab 2)
  if (data?.id) {
    loadWarehouseProducts(data.id);
  } else {
    renderWarehouseProducts([]);
  }
  
  const modal = new bootstrap.Modal(document.getElementById('wh-modal'));
  const btn = el('wh-save');
  const handler = async ()=>{
    const body = {
      code: el('wh-code').value.trim(),
      name: el('wh-name').value.trim(),
      location: el('wh-location').value.trim(),
      manager_id: el('wh-manager').value ? Number(el('wh-manager').value) : null,
      status: el('wh-status').value,
    };
    
    if (!body.code) { alert('Mã kho bắt buộc'); return; }
    if (!body.name) { alert('Tên kho bắt buộc'); return; }
    
    try {
      if (idEl.value) {
        await api(`/warehouses/${idEl.value}`, {method:'PUT', body});
      } else {
        await api('/warehouses', {method:'POST', body});
      }
      
      modal.hide();
      await refreshCatalogs();
      await loadWarehouses();
      alert('Đã lưu thành công!');
    } catch (e) {
      alert(e.message || 'Lỗi khi lưu');
    }
  };
  btn.replaceWith(btn.cloneNode(true));
  el('wh-save').addEventListener('click', handler);
  modal.show();
}

async function loadWarehouseProducts(warehouseId) {
  try {
    // Get all products and filter by default_warehouse_id
    const res = await api('/products');
    const products = (res.items || []).filter(p => p.default_warehouse_id === warehouseId);
    renderWarehouseProducts(products);
  } catch (e) {
    console.error('Error loading warehouse products:', e);
    renderWarehouseProducts([]);
  }
}

function renderWarehouseProducts(products) {
  const tbody = el('wh-products-list');
  if (!tbody) return;
  
  if (products.length === 0) {
    tbody.innerHTML = `<tr>
      <td colspan="5" class="text-center text-muted py-4">
        <i class="bi bi-inbox fs-3"></i>
        <p class="mb-0 mt-2">Chưa có sản phẩm nào sử dụng kho này làm mặc định.</p>
      </td>
    </tr>`;
    return;
  }
  
  tbody.innerHTML = '';
  products.forEach(product => {
    const tr = document.createElement('tr');
    const statusBadge = product.status === 'active' ? 'bg-success' : 'bg-secondary';
    
    tr.innerHTML = `
      <td><code>${product.sku}</code></td>
      <td><i class="bi bi-box text-muted me-2"></i>${product.name}</td>
      <td>${product.category || '<span class="text-muted">-</span>'}</td>
      <td class="text-center">${product.unit}</td>
      <td class="text-center"><span class="badge ${statusBadge}">${product.status}</span></td>
    `;
    tbody.appendChild(tr);
  });
}
