// Use same-origin backend by default (works with localhost, ngrok, tailscale)
// You can override via localStorage.setItem('API_BASE', 'https://your-ngrok-domain.ngrok.app/api')
const API_BASE = (localStorage.getItem('API_BASE') || `${window.location.origin}/api`).replace(/\/$/, '')
let token = localStorage.getItem('jwt') || null;
let currentUser = null;
let catalog = { products: [], warehouses: [], suppliers: [] };

const el = (id) => document.getElementById(id);
const qs = (sel) => document.querySelector(sel);

function setAuth(t, user) {
  token = t;
  currentUser = user || null;
  if (t) localStorage.setItem('jwt', t); else localStorage.removeItem('jwt');
  renderNav();
}

async function loadReportTxns({ wid=null, pid=null, dateFrom='', dateTo='' }={}) {
  const params = new URLSearchParams();
  if (wid) params.set('warehouse_id', wid);
  if (pid) params.set('product_id', pid);
  if (dateFrom) params.set('from', dateFrom);
  if (dateTo) params.set('to', dateTo);
  const data = await api(`/reports/txns?${params.toString()}`);
  const tb = el('report-txns'); if (!tb) return;
  tb.innerHTML = '';
  if (!data.items || data.items.length === 0) {
    tb.innerHTML = '<tr><td colspan="8" class="text-center text-muted">Không có giao dịch</td></tr>';
    return;
  }
  (data.items||[]).forEach(r=>{
    const tr = document.createElement('tr');
    const when = r.created_at ? new Date(r.created_at).toLocaleString('vi-VN') : '-';
    const qty = Number(r.quantity || 0);
    const qtyDisplay = r.txn_type === 'OUT' ? `-${qty.toLocaleString('vi-VN')}` : `+${qty.toLocaleString('vi-VN')}`;
    const typeBadge = r.txn_type === 'IN' ? '<span class="badge bg-success">NHẬP</span>' : 
                     r.txn_type === 'OUT' ? '<span class="badge bg-danger">XUẤT</span>' : 
                     '<span class="badge bg-warning">ĐIỀU CHỈNH</span>';
    tr.innerHTML = `
      <td>${when}</td>
      <td>${typeBadge}</td>
      <td>${r.sku || '-'}</td>
      <td>${r.product_name || '-'}</td>
      <td>${r.warehouse_code || '-'}</td>
      <td class="cell-num ${r.txn_type === 'OUT' ? 'text-danger' : 'text-success'}">${qtyDisplay}</td>
      <td>${r.ref_document || '-'}</td>
      <td>${r.reason || '-'}</td>`;
    tb.appendChild(tr);
  });
  const hint = el('rep-txns-hint');
  if (hint) {
    const parts = [];
    if (dateFrom || dateTo) parts.push(`Khoảng: ${dateFrom||'...'} → ${dateTo||'...'}`);
    if (wid) parts.push(`Kho: ${wid}`);
    if (pid) parts.push(`SP: ${pid}`);
    hint.textContent = parts.join(' · ');
  }
}

async function loadSuppliers() {
  const res = await api('/suppliers/');
  const items = res.items || [];
  const tbody = el('tbl-suppliers');
  const search = el('sup-search');
  const render = (list) => {
    tbody.innerHTML = '';
    list.forEach(s => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${s.name}</td>
        <td>${s.contact || ''}</td>
        <td>${s.phone || ''}</td>
        <td>${s.email || ''}</td>
        <td>${s.address || ''}</td>
        <td><span class="status-chip ${s.status==='active'?'success':'danger'}">${s.status}</span></td>
        <td class="text-end">
          <div class="btn-group btn-group-sm">
            <button class="btn btn-outline-primary" data-edit="${s.id}">Sửa</button>
            ${currentUser?.role==='manager' ? `<button class="btn btn-outline-danger" data-del="${s.id}">Xóa</button>` : ''}
          </div>
        </td>`;
      tbody.appendChild(tr);
    });
    // bind actions
    tbody.querySelectorAll('[data-edit]').forEach(b=>b.addEventListener('click', ()=>{
      const id = Number(b.getAttribute('data-edit'));
      const s = items.find(x=>x.id===id); if (!s) return;
      openSupModal({...s});
    }));
    tbody.querySelectorAll('[data-del]').forEach(b=>b.addEventListener('click', async ()=>{
      if (!confirm('Xóa nhà cung cấp này?')) return;
      try {
        await api(`/suppliers/${b.getAttribute('data-del')}`, { method:'DELETE' });
        await loadSuppliers();
      } catch (e) {
        alert(e.message || 'Lỗi khi xóa nhà cung cấp');
      }
    }));
  };
  
  async function loadSupplierWarehouse() {
    try {
      const res = await api('/relationships/supplier-warehouses');
      const items = res.items || [];
      const tbody = el('tbl-supplier-warehouse');
      if (!tbody) return;
      tbody.innerHTML = '';
      if (!items.length) {
        tbody.innerHTML = '<tr><td colspan="3" class="text-center text-muted py-4"><i class="bi bi-inbox me-2"></i>Chưa có quan hệ nào</td></tr>';
        return;
      }
      items.forEach(r => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td><span class="fw-semibold">${r.supplier_name}</span></td>
          <td><i class="bi bi-building text-muted me-1"></i>${r.warehouse_code} - ${r.warehouse_name}</td>
          <td class="text-center"><span class="badge bg-info">${r.product_count || 0}</span></td>`;
        tbody.appendChild(tr);
      });
    } catch (e) {
      console.error('Error loading supplier-warehouse relationships:', e);
    }
  }
  
  async function loadProductSupplierWarehouse() {
    try {
      const res = await api('/relationships/product-supplier-warehouse');
      const items = res.items || [];
      const tbody = el('tbl-product-supplier-warehouse');
      if (!tbody) return;
      tbody.innerHTML = '';
      if (!items.length) {
        tbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted py-4"><i class="bi bi-inbox me-2"></i>Chưa có quan hệ nào</td></tr>';
        return;
      }
      items.forEach(r => {
        const tr = document.createElement('tr');
        const deliveryDisplay = r.delivery_date ? 
          `<span class="badge bg-primary"><i class="bi bi-calendar-event me-1"></i>${new Date(r.delivery_date).toLocaleDateString('vi-VN')}</span>` : 
          '<span class="text-muted">-</span>';
        tr.innerHTML = `
          <td><i class="bi bi-box text-muted me-1"></i><span class="fw-semibold">${r.product_sku}</span> - ${r.product_name}</td>
          <td><i class="bi bi-truck text-muted me-1"></i>${r.supplier_name}</td>
          <td>${r.warehouse_code ? `<i class="bi bi-building text-muted me-1"></i>${r.warehouse_code} - ${r.warehouse_name}` : '<span class="text-muted">-</span>'}</td>
          <td class="text-center">${deliveryDisplay}</td>`;
        tbody.appendChild(tr);
      });
    } catch (e) {
      console.error('Error loading product-supplier-warehouse relationships:', e);
    }
  }
  
  render(items);
  
  // Load supplier-warehouse and product-supplier-warehouse relationships
  loadSupplierWarehouse();
  loadProductSupplierWarehouse();
  search?.addEventListener('input', ()=>{
    const q = (search.value || '').toLowerCase();
    render(items.filter(s => `${s.name} ${s.contact||''} ${s.phone||''} ${s.email||''} ${s.address||''}`.toLowerCase().includes(q)));
  });
  // export
  el('btn-export-sup').onclick = ()=>{
    const headers = ['Name','Contact','Phone','Email','Address','Status'];
    const rows = items.map(s => [s.name, s.contact||'', s.phone||'', s.email||'', s.address||'', s.status]);
    const csv = [headers].concat(rows).map(r=>r.map(c=>{
      const s = (c??'').toString(); const needs = /[",\n]/.test(s); const esc = s.replace(/"/g,'""'); return needs?`"${esc}"`:esc;
    }).join(',')).join('\n');
    const blob = new Blob([csv], {type:'text/csv;charset=utf-8;'}); const url = URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download='suppliers.csv'; a.click(); URL.revokeObjectURL(url);
  };
  // new
  el('btn-new-sup').onclick = ()=>{
    if (currentUser?.role !== 'manager') { alert('Chỉ quản lý mới được thêm'); return; }
    openSupModal(null);
  };
}

function matchPW(r, pid, wid) {
  const okP = !pid || r.product_id === pid || false;
  const okW = !wid || r.warehouse_id === wid || false;
  return okP && okW;
}

let chartReportsMoving;
let chartReportsTime;
function renderReportsMovingChart(items) {
  const ctx = el('rep-chart-moving');
  if (!ctx) return;
  const labels = (items||[]).map(r => r.sku);
  const data = (items||[]).map(r => Number(r.total_movement_30d || 0));
  if (chartReportsMoving) chartReportsMoving.destroy();
  chartReportsMoving = new Chart(ctx, {
    type: 'doughnut',
    data: { labels, datasets: [{ data, backgroundColor: genColors(data.length) }] },
    options: { responsive: true, plugins: { legend: { position: 'bottom' } } },
  });
}

function openProductModal(id, items) {
  const p = items.find(x=>x.id===id); if (!p) return;
  el('product-modal-title').textContent = `${p.name}`;
  el('product-modal-img').src = p.image_url;
  el('product-modal-img').onerror = () => { el('product-modal-img').src = 'https://via.placeholder.com/600x400?text=No+Image'; };
  el('product-modal-sku').textContent = p.sku;
  el('product-modal-name').textContent = p.name;
  el('product-modal-category').textContent = p.category || '-';
  el('product-modal-unit').textContent = p.unit;
  el('product-modal-reorder').textContent = p.reorder_level;
  const st = el('product-modal-status'); st.textContent = p.status; st.className = `badge ${p.status==='active'?'bg-success':'bg-secondary'}`;
  
  // Show relationships
  const defaultWhEl = el('product-modal-default-warehouse');
  if (defaultWhEl) {
    defaultWhEl.textContent = p.default_warehouse_name ? `${p.default_warehouse_code} - ${p.default_warehouse_name}` : '-';
  }
  const parentEl = el('product-modal-parent');
  if (parentEl) {
    parentEl.textContent = p.parent_product_name ? `${p.parent_product_sku} - ${p.parent_product_name}` : '-';
  }

  const imgFile = el('product-image-file'); imgFile.value = '';
  const btnUpload = el('btn-upload-image');
  // Hide upload for non-manager
  const canUpload = currentUser?.role === 'manager';
  imgFile.closest('div').style.display = canUpload ? '' : 'none';
  btnUpload.style.display = canUpload ? '' : 'none';
  btnUpload.onclick = async () => {
    if (!canUpload) { alert('Chỉ quản lý mới được tải ảnh'); return; }
    if (!imgFile.files || !imgFile.files[0]) { alert('Chọn file ảnh'); return; }
    btnUpload.disabled = true; btnUpload.textContent = 'Đang tải...';
    try {
      const fd = new FormData(); fd.append('file', imgFile.files[0]);
      const headers = {}; if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetch(`${API_BASE}/products/${id}/image`, { method: 'POST', headers, body: fd });
      if (!res.ok) {
        let msg = await res.text(); try { const j = JSON.parse(msg); msg = j.message || msg; } catch {}
        throw new Error(msg || 'Upload thất bại');
      }
      // reload just this product's image
      el('product-modal-img').src = `${API_BASE}/products/${id}/image?v=${Date.now()}`;
      await loadProducts();
      alert('Đã tải ảnh thành công');
    } catch (e) {
      alert(e.message || 'Không thể tải ảnh');
    } finally {
      btnUpload.disabled = false; btnUpload.textContent = 'Tải ảnh';
    }
  };

  const modal = new bootstrap.Modal(document.getElementById('product-modal'));
  modal.show();
}

function bindReportTabShown() {
  const btn = document.querySelector('button[data-bs-target="#tab-time"]');
  if (!btn || btn._bound) return; btn._bound = true;
  btn.addEventListener('shown.bs.tab', async () => {
    const bM = el('rep-scale-month');
    const bW = el('rep-scale-week');
    const bD = el('rep-scale-day');
    if (bW?.classList.contains('active')) {
      await renderReportsTimeChart('week');
    } else if (bD?.classList.contains('active')) {
      await renderReportsTimeChart('day');
    } else {
      const m = await api('/reports/monthly-in-out');
      await renderReportsTimeChart('month', m.items || []);
    }
  });
}

async function renderReportsTimeChart(scale, data, range = {}) {
  const ctx = el('rep-chart-time');
  if (!ctx) return;
  if (chartReportsTime) chartReportsTime.destroy();
  let labels = [], inData = [], outData = [];
  if (scale === 'month') {
    const by = {};
    data.forEach(r => { by[r.ym] = by[r.ym] || {in:0,out:0}; by[r.ym].in += +r.qty_in||0; by[r.ym].out += +r.qty_out||0;});
    labels = Object.keys(by).sort(); inData = labels.map(k=>by[k].in); outData = labels.map(k=>by[k].out);
  } else if (scale === 'week') {
    const resp = await api('/reports/weekly-in-out');
    const by = {}; (resp.items||[]).forEach(r=>{ by[r.yw]=by[r.yw]||{in:0,out:0}; by[r.yw].in+=+r.qty_in||0; by[r.yw].out+=+r.qty_out||0;});
    labels = Object.keys(by).sort(); inData = labels.map(k=>by[k].in); outData = labels.map(k=>by[k].out);
  } else {
    const resp = await api('/reports/daily-in-out');
    const by = {}; (resp.items||[]).forEach(r=>{ by[r.yd]=by[r.yd]||{in:0,out:0}; by[r.yd].in+=+r.qty_in||0; by[r.yd].out+=+r.qty_out||0;});
    labels = Object.keys(by).sort().map(d=>{
      const dt = new Date(d);
      const dd = String(dt.getDate()).padStart(2,'0');
      const mm = String(dt.getMonth()+1).padStart(2,'0');
      return `${dd}/${mm}`;
    });
    const orderedKeys = Object.keys(by).sort();
    inData = orderedKeys.map(k=>by[k].in);
    outData = orderedKeys.map(k=>by[k].out);
  }
  const cfg = {
    type: 'bar',
    data: { labels, datasets: [
      { label: 'Nhập', backgroundColor: '#198754', data: inData },
      { label: 'Xuất', backgroundColor: '#dc3545', data: outData },
    ]},
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { position: 'bottom' }, tooltip: { enabled: true } },
      onClick: async (evt, elements) => {
        if (!elements?.length) return;
        const idx = elements[0].index;
        const label = labels[idx];
        // Derive date range by scale
        let dateFrom = '', dateTo = '';
        if (scale === 'month') {
          // label is YYYY-MM
          const [y,m] = label.split('-');
          dateFrom = `${y}-${m}-01`;
          const last = new Date(Number(y), Number(m), 0).getDate();
          dateTo = `${y}-${m}-${String(last).padStart(2,'0')}`;
        } else if (scale === 'week') {
          // label is ISO YYYY-WW (we fallback to last 7 days from today for simplicity)
          const now = new Date();
          const end = new Date(now);
          const start = new Date(now); start.setDate(now.getDate()-6);
          dateFrom = start.toISOString().slice(0,10);
          dateTo = end.toISOString().slice(0,10);
        } else {
          // scale day: labels are dd/mm; assume current year
          const [dd,mm] = label.split('/');
          const y = new Date().getFullYear();
          const d = `${y}-${mm}-${dd}`;
          dateFrom = d; dateTo = d;
        }
        await loadReportTxns({ dateFrom, dateTo });
        const hint = el('rep-txns-hint');
        if (hint) hint.textContent = `Chi tiết cho khoảng: ${dateFrom} → ${dateTo}`;
      }
    },
  };
  chartReportsTime = new Chart(ctx, cfg);
}

function bindReportScale() {
  const bM = el('rep-scale-month');
  const bW = el('rep-scale-week');
  const bD = el('rep-scale-day');
  if (!bM || bM._bound) return; bM._bound = true;
  bM.addEventListener('click', async ()=>{ bM.classList.add('active'); bW.classList.remove('active'); bD.classList.remove('active'); const m = await api('/reports/monthly-in-out'); renderReportsTimeChart('month', m.items||[]); });
  bW.addEventListener('click', async ()=>{ bW.classList.add('active'); bM.classList.remove('active'); bD.classList.remove('active'); await renderReportsTimeChart('week'); });
  bD.addEventListener('click', async ()=>{ bD.classList.add('active'); bM.classList.remove('active'); bW.classList.remove('active'); await renderReportsTimeChart('day'); });
}

function bindReportFilters() {
  const getSel = (id) => (el(id)?.value || '').trim();
  const apply = () => {
    const wid = Number(getSel('rep-filter-warehouse')) || null;
    const pid = Number(getSel('rep-filter-product')) || null;
    const dateFrom = el('rep-filter-from')?.value || '';
    const dateTo = el('rep-filter-to')?.value || '';

    const cur = (window._reportsCache?.cur || []).filter(r => matchPW(r, pid, wid));
    const low = (window._reportsCache?.low || []).filter(r => matchPW(r, pid, wid));
    const top = (window._reportsCache?.top || []).filter(r => !pid || r.product_id === pid || false);

    // KPIs
    const kSku = el('rep-kpi-sku');
    const kQty = el('rep-kpi-qty');
    const kLow = el('rep-kpi-low');
    const kTx = el('rep-kpi-tx');
    if (kSku) {
      const skuCount = new Set(cur.map(r => r.product_id || r.sku || '').filter(Boolean)).size;
      kSku.textContent = skuCount.toLocaleString('vi-VN');
    }
    if (kQty) {
      const totalQty = cur.reduce((s, r) => s + Number(r.qty_on_hand || 0), 0);
      kQty.textContent = totalQty.toLocaleString('vi-VN');
    }
    if (kLow) {
      kLow.textContent = low.length.toLocaleString('vi-VN');
    }
    if (kTx) {
      const monthly = (window._reportsCache?.monthly || []).filter(r => matchPW(r, pid, wid));
      const totalTxns = monthly.reduce((s, r) => s + Number(r.txn_count || 0), 0);
      const totalInTxns = monthly.reduce((s, r) => s + Number(r.txn_in_count || 0), 0);
      const totalOutTxns = monthly.reduce((s, r) => s + Number(r.txn_out_count || 0), 0);
      kTx.textContent = `${totalTxns} (${totalInTxns} nhập, ${totalOutTxns} xuất)`;
    }

    // Tables
    let tbody = el('report-cur');
    if (tbody) {
      tbody.innerHTML = '';
      if (cur.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted">Không có dữ liệu</td></tr>';
      } else {
        cur.forEach(r => {
          const tr = document.createElement('tr');
          const qty = Number(r.qty_on_hand || 0);
          const reorder = Number(r.reorder_level || 0);
          const lastUpdated = r.last_updated ? new Date(r.last_updated).toLocaleString('vi-VN') : '-';
          tr.innerHTML = `<td>${r.sku || '-'}</td><td>${r.product_name || '-'}</td><td>${r.warehouse_code || '-'}</td><td class="cell-num">${qty.toLocaleString('vi-VN')}</td><td>${r.unit || '-'}</td><td class="cell-num">${reorder.toLocaleString('vi-VN')}</td><td class="text-muted small">${lastUpdated}</td>`;
          tbody.appendChild(tr);
        });
      }
    }
    
    tbody = el('report-low');
    if (tbody) {
      tbody.innerHTML = '';
      if (low.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">Không có cảnh báo</td></tr>';
      } else {
        low.forEach(r => {
          const tr = document.createElement('tr');
          const qty = Number(r.qty_on_hand || 0);
          const reorder = Number(r.reorder_level || 0);
          tr.innerHTML = `<td>${r.sku || '-'}</td><td>${r.product_name || r.name || '-'}</td><td>${r.warehouse_code || r.warehouse || '-'}</td><td class="cell-num text-danger fw-bold">${qty.toLocaleString('vi-VN')}</td><td class="cell-num">${reorder.toLocaleString('vi-VN')}</td>`;
          tbody.appendChild(tr);
        });
      }
    }
    tbody = el('report-top'); tbody.innerHTML=''; top.forEach(r=>{ const tr=document.createElement('tr'); tr.innerHTML=`<td>${r.sku}</td><td>${r.name || r.product_name || ''}</td><td>${r.total_movement_30d}</td>`; tbody.appendChild(tr); });

    // Charts
    renderReportsMovingChart(top);
    const activeScale = el('rep-scale-week')?.classList.contains('active') ? 'week' : el('rep-scale-day')?.classList.contains('active') ? 'day' : 'month';
    const monthly = window._reportsCache?.monthly || [];
    renderReportsTimeChart(activeScale, monthly, { dateFrom, dateTo });
    // Load detailed txns under chart
    loadReportTxns({ wid, pid, dateFrom, dateTo });
  };
  el('rep-apply')?.addEventListener('click', apply);
  // Auto-apply when filter changes
  ['rep-filter-warehouse','rep-filter-product','rep-filter-from','rep-filter-to'].forEach(id => {
    const c = el(id); if (c && !c._bound) { c._bound = true; c.addEventListener('change', apply); }
  });
  // Run once on first load so không cần bấm "Áp dụng"
  apply();
  el('rep-clear')?.addEventListener('click', ()=>{
    if (el('rep-filter-warehouse')) el('rep-filter-warehouse').value='';
    if (el('rep-filter-product')) el('rep-filter-product').value='';
    if (el('rep-filter-from')) el('rep-filter-from').value='';
    if (el('rep-filter-to')) el('rep-filter-to').value='';
    apply();
  });
  el('rep-export')?.addEventListener('click', ()=>{
    // Simple CSV export for current stock
    const rows = [['SKU','Tên','Kho','Tồn','ĐVT','Reorder','Cập nhật']];
    document.querySelectorAll('#report-cur tr').forEach(tr=>{
      const tds=[...tr.children].map(td=>`"${td.textContent}"`); rows.push(tds);
    });
    const csv = rows.map(r=>r.join(',')).join('\n');
    const blob = new Blob([csv], {type:'text/csv;charset=utf-8;'}); const url = URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download='current_stock.csv'; a.click(); URL.revokeObjectURL(url);
  });
}

async function api(path, { method = 'GET', body } = {}) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers['Authorization'] = `Bearer ${token}`;
  
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    
    if (!res.ok) {
      let errorMsg = `HTTP ${res.status}`;
      try {
        const errorData = await res.json();
        errorMsg = errorData.message || errorData.msg || errorMsg;
      } catch {
        try {
          errorMsg = await res.text();
        } catch {}
      }
      
      if (res.status === 401 || res.status === 422) {
        // Treat both as auth problems (JWT missing/malformed)
        setAuth(null, null);
        showPage('login');
      }
      
      throw new Error(errorMsg);
    }
    
    const ct = res.headers.get('content-type') || '';
    return ct.includes('application/json') ? res.json() : res.text();
  } catch (error) {
    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new Error('Không thể kết nối đến server. Vui lòng kiểm tra server có đang chạy không.');
    }
    throw error;
  }
}

function showPage(page) {
  const sections = ['login', 'dashboard', 'products', 'stock', 'reports', 'warehouses', 'suppliers', 'users'];
  sections.forEach((p) => {
    const sec = el(`page-${p}`);
    if (!sec) return;
    if (p === page) sec.classList.remove('d-none'); else sec.classList.add('d-none');
  });
}

function renderNav() {
  const navLinks = el('nav-links');
  const btnLogout = el('btn-logout');
  const usersLink = el('users-link');
  const cur = el('current-user');
  const sidebar = document.getElementById('sidebar');
  const curSide = el('current-user-side');
  const usersLinkSide = el('users-link-side');

  if (token && currentUser) {
    navLinks.hidden = false;
    btnLogout.hidden = false;
    cur.textContent = `${currentUser.full_name} (${currentUser.role})`;
    usersLink.hidden = currentUser.role !== 'manager';
    if (sidebar) sidebar.classList.remove('d-none');
    if (curSide) curSide.textContent = `${currentUser.full_name}`;
    if (usersLinkSide) usersLinkSide.hidden = currentUser.role !== 'manager';
    showPage('dashboard');
  } else {
    navLinks.hidden = true;
    btnLogout.hidden = true;
    cur.textContent = '';
    if (sidebar) sidebar.classList.add('d-none');
    if (curSide) curSide.textContent = 'Guest';
    showPage('login');
  }
}

async function tryLoadMe() {
  if (!token) return;
  try {
    const data = await api('/auth/me');
    currentUser = data.user;
  } catch (e) {
    setAuth(null, null);
  }
}

// Login handlers
async function handleLogin() {
  const username = el('login-username')?.value.trim() || '';
  const password = el('login-password')?.value || '';
  
  if (!username || !password) {
    el('login-error').textContent = 'Vui lòng nhập đầy đủ username và password';
    return;
  }
  
  el('login-error').textContent = '';
  const btn = el('btn-login');
  const sp = el('btn-login-spinner');
  if (btn) btn.disabled = true;
  if (sp) sp.classList.remove('d-none');
  
  try {
    const data = await api('/auth/login', { method: 'POST', body: { username, password } });
    if (data && data.access_token && data.user) {
      setAuth(data.access_token, data.user);
      showPage('dashboard');
      try {
        await loadDashboard();
      } catch (dashboardError) {
        console.error('Dashboard load error:', dashboardError);
        // Continue anyway - user is logged in
      }
    } else {
      el('login-error').textContent = 'Phản hồi từ server không hợp lệ';
    }
  } catch (e) {
    console.error('Login error:', e);
    const errorMsg = e.message || 'Đăng nhập thất bại. Vui lòng kiểm tra lại username và password.';
    el('login-error').textContent = errorMsg;
  } finally {
    if (btn) btn.disabled = false;
    if (sp) sp.classList.add('d-none');
  }
}

function bindNav() {
  document.querySelectorAll('a.nav-link[data-page]').forEach((a) => {
    a.addEventListener('click', async (e) => {
      e.preventDefault();
      const page = a.getAttribute('data-page');
      showPage(page);
      if (page === 'dashboard') await loadDashboard();
      if (page === 'products') await loadProducts();
      if (page === 'reports') await loadReports();
      if (page === 'warehouses') await loadWarehouses();
      if (page === 'stock') await ensureCatalogsLoaded();
      if (page === 'suppliers') await loadSuppliers();
      if (page === 'users') await loadUsers();
    });
  });
  // Handle dropdown items for operations
  document.querySelectorAll('a.dropdown-item[data-page="stock"]').forEach((a) => {
    a.addEventListener('click', async (e) => {
      e.preventDefault();
      const mode = a.getAttribute('data-mode');
      showPage('stock');
      await ensureCatalogsLoaded();
      setOpMode(mode);
    });
  });
  el('btn-logout').addEventListener('click', () => setAuth(null, null));
}

async function loadDashboard() {
  // KPIs
  const [products, currentStock, lowStock, monthly, top] = await Promise.all([
    api('/products/'),
    api('/reports/current-stock'),
    api('/reports/low-stock'),
    api('/reports/monthly-in-out'),
    api('/reports/top-moving'),
  ]);
  el('kpi-products').textContent = (products.items || []).length;
  const warehouses = new Set((currentStock.items || []).map((r) => r.warehouse_id));
  el('kpi-warehouses').textContent = warehouses.size;
  el('kpi-low').textContent = (lowStock.items || []).length;
  const totalInTxns = (monthly.items || []).reduce((s, r) => s + Number(r.txn_in_count || 0), 0);
  const totalOutTxns = (monthly.items || []).reduce((s, r) => s + Number(r.txn_out_count || 0), 0);
  const totalTxns = totalInTxns + totalOutTxns;
  el('kpi-tx').textContent = `${totalTxns.toLocaleString('vi-VN')} (${totalInTxns.toLocaleString('vi-VN')} nhập, ${totalOutTxns.toLocaleString('vi-VN')} xuất)`;

  // Low-stock slider
  const lowInner = el('low-carousel-inner');
  const lowEmpty = el('low-empty');
  if (lowInner) {
    lowInner.innerHTML = '';
    const items = (lowStock.items || []);
    if (!items.length) {
      if (lowEmpty) lowEmpty.style.display = '';
    } else {
      if (lowEmpty) lowEmpty.style.display = 'none';
      items.forEach((r, idx) => {
        const div = document.createElement('div');
        div.className = `carousel-item ${idx===0?'active':''}`;
        const pid = r.product_id || r.id; // fallback when view returns id
        const sku = r.sku || r.product_sku || '';
        const pname = r.name || r.product_name || '';
        const wh = r.warehouse_code || r.warehouse || '';
        const unit = r.unit || '';
        const qty = r.qty_on_hand ?? r.qty ?? 0;
        const reorder = r.reorder_level ?? r.reorder ?? 0;
        const updated = r.last_updated || r.updated_at || '';
        const imgUrl = pid ? `${API_BASE}/products/${pid}/image` : 'https://via.placeholder.com/300?text=No+Image';
        div.innerHTML = `
          <div class="row g-3 align-items-center">
            <div class="col-sm-3">
              <img src="${imgUrl}" onerror="this.src='https://via.placeholder.com/300?text=No+Image'" class="img-fluid" style="max-height:140px" />
            </div>
            <div class="col-sm-9">
              <div class="d-flex align-items-center gap-2">
                <span class="badge bg-danger">LOW</span>
                <span class="fw-semibold">${sku} - ${pname}</span>
              </div>
              <div class="text-muted small mt-1">Kho: ${wh}</div>
              <div class="mt-1">Tồn: <span class="fw-semibold text-danger">${qty}</span> ${unit} · Reorder: ${reorder}</div>
              <div class="text-muted small">${updated ? `Cập nhật: ${new Date(updated).toLocaleString()}` : ''}</div>
            </div>
          </div>`;
        lowInner.appendChild(div);
      });
      const car = document.getElementById('low-carousel');
      const prev = car?.querySelector('.carousel-control-prev');
      const next = car?.querySelector('.carousel-control-next');
      if (items.length <= 1) {
        if (prev) prev.style.display = 'none';
        if (next) next.style.display = 'none';
        try { new bootstrap.Carousel(car, { interval: false, ride: false }); } catch {}
      } else {
        if (prev) prev.style.display = '';
        if (next) next.style.display = '';
        try { new bootstrap.Carousel(car, { interval: 5000, ride: 'carousel', pause: false, touch: true, wrap: true }); } catch {}
      }
    }
  }

  // Charts default to month
  renderMonthlyChart(monthly.items || []);
  renderTopChart(top.items || []);

  // Bind scale toggle
  const btnMonth = el('btn-scale-month');
  const btnWeek = el('btn-scale-week');
  if (btnMonth && btnWeek && !btnMonth._bound) {
    btnMonth._bound = true;
    btnMonth.addEventListener('click', async () => {
      btnMonth.classList.add('active'); btnWeek.classList.remove('active');
      const data = await api('/reports/monthly-in-out');
      renderMonthlyChart(data.items || []);
    });
    btnWeek.addEventListener('click', async () => {
      btnWeek.classList.add('active'); btnMonth.classList.remove('active');
      const data = await api('/reports/weekly-in-out');
      renderWeeklyChart(data.items || []);
    });
  }

  // Quick actions
  const qIn = el('qa-in');
  const qOut = el('qa-out');
  const qAdj = el('qa-adjust');
  const qProd = el('qa-products');
  const qRep = el('qa-reports');
  if (qIn && !qIn._bound) {
    qIn._bound = true; qOut._bound = true; qAdj._bound = true; qProd._bound = true; qRep._bound = true;
    qIn.addEventListener('click', async ()=>{ showPage('stock'); await ensureCatalogsLoaded(); setOpMode('in'); });
    qOut.addEventListener('click', async ()=>{ showPage('stock'); await ensureCatalogsLoaded(); setOpMode('out'); });
    qAdj.addEventListener('click', async ()=>{ showPage('stock'); await ensureCatalogsLoaded(); setOpMode('adjust'); });
    qProd.addEventListener('click', async ()=>{ showPage('products'); await loadProducts(); });
    qRep.addEventListener('click', async ()=>{ showPage('reports'); await loadReports(); });
  }
}

let chartMonthly, chartTop;

function renderMonthlyChart(items) {
  const byYm = {};
  items.forEach((r) => {
    byYm[r.ym] = byYm[r.ym] || { in: 0, out: 0 };
    byYm[r.ym].in += Number(r.qty_in || 0);
    byYm[r.ym].out += Number(r.qty_out || 0);
  });
  const labels = Object.keys(byYm).sort();
  const dataIn = labels.map((k) => byYm[k].in);
  const dataOut = labels.map((k) => byYm[k].out);
  const ctx = el('chart-monthly');
  if (chartMonthly) chartMonthly.destroy();
  chartMonthly = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        { label: 'Nhập', backgroundColor: '#198754', data: dataIn },
        { label: 'Xuất', backgroundColor: '#dc3545', data: dataOut },
      ],
    },
    options: { responsive: true, plugins: { legend: { position: 'bottom' } } },
  });
}

function renderWeeklyChart(items) {
  const byYw = {};
  items.forEach((r) => {
    const key = r.yw;
    if (!byYw[key]) byYw[key] = { in: 0, out: 0 };
    byYw[key].in += Number(r.qty_in || 0);
    byYw[key].out += Number(r.qty_out || 0);
  });
  const labels = Object.keys(byYw).sort();
  const dataIn = labels.map((k) => byYw[k].in);
  const dataOut = labels.map((k) => byYw[k].out);
  const ctx = el('chart-monthly');
  if (chartMonthly) chartMonthly.destroy();
  chartMonthly = new Chart(ctx, {
    type: 'bar',
    data: { labels, datasets: [
      { label: 'Nhập', backgroundColor: '#198754', data: dataIn },
      { label: 'Xuất', backgroundColor: '#dc3545', data: dataOut },
    ]},
    options: { responsive: true, plugins: { legend: { position: 'bottom' } } },
  });
}

function renderTopChart(items) {
  const labels = items.map((r) => r.sku);
  const data = items.map((r) => Number(r.total_movement_30d || 0));
  const ctx = el('chart-top');
  if (chartTop) chartTop.destroy();
  chartTop = new Chart(ctx, {
    type: 'doughnut',
    data: { labels, datasets: [{ data, backgroundColor: genColors(data.length) }] },
    options: { responsive: true, plugins: { legend: { position: 'bottom' } } },
  });
}

function genColors(n) {
  const colors = ['#0d6efd','#6f42c1','#d63384','#dc3545','#fd7e14','#ffc107','#198754','#20c997','#0dcaf0','#6c757d'];
  const res = [];
  for (let i = 0; i < n; i++) res.push(colors[i % colors.length]);
  return res;
}

async function loadProducts() {
  const data = await api('/products/');
  const items = data.items || [];
  const tbody = el('tbl-products');
  if (!tbody) return;
  const qInput = el('prod-search');
  const stSel = el('prod-filter-status');

  const renderTable = (list) => {
    tbody.innerHTML = '';
    if (!list.length) {
      tbody.innerHTML = '<tr><td colspan="9" class="text-center text-muted">Không có sản phẩm</td></tr>';
      return;
    }
    list.forEach((p, idx) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${idx + 1}</td>
        <td>${p.sku}</td>
        <td>${p.name}${p.parent_product_name ? ` <span class="badge bg-info" title="Sản phẩm con của ${p.parent_product_sku}">↗</span>` : ''}</td>
        <td>${p.category || '-'}</td>
        <td class="text-center">
          <img src="${p.image_url}" alt="${p.name}" 
               onerror="this.src='https://via.placeholder.com/80?text=No+Image'" 
               style="width:60px; height:60px; object-fit:cover; border-radius:4px; cursor:pointer;"
               data-view="${p.id}" />
        </td>
        <td>${p.unit}</td>
        <td>${p.reorder_level}</td>
        <td><span class="status-chip ${p.status==='active'?'success':'danger'}">${p.status}</span></td>
        <td>
          <div class="btn-group btn-group-sm">
            <button class="btn btn-action-view" data-view="${p.id}" title="Xem"><i class="bi bi-eye"></i></button>
            ${currentUser?.role==='manager' ? `
              <button class="btn btn-action-edit" data-edit="${p.id}" title="Sửa"><i class="bi bi-pencil"></i></button>
              <button class="btn btn-action-del" data-del="${p.id}" title="Xóa"><i class="bi bi-trash"></i></button>
            ` : ''}
          </div>
        </td>`;
      tbody.appendChild(tr);
    });
    // bind events
    tbody.querySelectorAll('[data-view]').forEach(b => b.addEventListener('click', ()=> openProductModal(Number(b.getAttribute('data-view')), items)));
    if (currentUser?.role === 'manager') {
      tbody.querySelectorAll('[data-edit]').forEach(b => b.addEventListener('click', ()=> {
        const p = items.find(x=>x.id===Number(b.getAttribute('data-edit')));
        if (p) openProdCrudModal({...p});
      }));
      tbody.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', async ()=>{
        const id = Number(b.getAttribute('data-del'));
        if (!confirm('Xóa sản phẩm này?')) return;
        await api(`/products/${id}`, { method: 'DELETE' });
        await loadProducts();
      }));
    }
  };

  const applyFilter = () => {
    const q = (qInput?.value || '').toLowerCase();
    const st = stSel?.value || '';
    const filtered = items.filter(p => {
      const okQ = !q || p.sku.toLowerCase().includes(q) || p.name.toLowerCase().includes(q);
      const okS = !st || p.status === st;
      return okQ && okS;
    });
    renderTable(filtered);
  };
  qInput?.addEventListener('input', applyFilter);
  stSel?.addEventListener('change', applyFilter);
  renderTable(items);

  // Export
  el('btn-export-products').onclick = () => exportProductsCsv(items);
  // New via modal
  if (currentUser?.role === 'manager') {
    el('btn-new-product').onclick = () => openProdCrudModal(null);
  } else {
    el('btn-new-product').onclick = () => alert('Chỉ quản lý mới được thêm sản phẩm');
  }
}

function exportProductsCsv(items) {
  const headers = ['ID','SKU','Name','Unit','ReorderLevel','Status'];
  const rows = items.map(p => [p.id, p.sku, p.name, p.unit, p.reorder_level, p.status]);
  const csv = [headers].concat(rows).map(r => r.map(cell => {
    const s = (cell ?? '').toString();
    // Escape quotes and wrap if needed
    const needsWrap = s.includes(',') || s.includes('"') || s.includes('\n');
    const esc = s.replace(/"/g, '""');
    return needsWrap ? `"${esc}"` : esc;
  }).join(',')).join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const now = new Date();
  const ymd = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
  a.download = `products_${ymd}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Warehouses page
async function loadWarehouses() {
  const res = await api('/warehouses/');
  const items = res.items || [];
  const tbody = el('tbl-warehouses');
  const search = el('wh-search');
  if (!tbody) return;
  const render = (list) => {
    tbody.innerHTML = '';
    if (!list.length) { tbody.innerHTML = '<tr><td colspan="6" class="text-muted">Không có kho</td></tr>'; return; }
    list.forEach(w => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${w.code}</td>
        <td>${w.name}</td>
        <td>${w.location || ''}</td>
        <td>${w.manager_name || '<span class="text-muted">-</span>'}</td>
        <td><span class="status-chip ${w.status==='active'?'success':'danger'}">${w.status}</span></td>
        <td class="text-end">
          <div class="btn-group btn-group-sm">
            <button class="btn btn-outline-primary" data-edit="${w.id}">Sửa</button>
            ${currentUser?.role==='manager' ? `<button class="btn btn-outline-danger" data-del="${w.id}">Xóa</button>` : ''}
          </div>
        </td>`;
      tbody.appendChild(tr);
    });
    // actions
    tbody.querySelectorAll('[data-edit]').forEach(b=>b.addEventListener('click', async ()=>{
      const id = Number(b.getAttribute('data-edit'));
      const w = items.find(x=>x.id===id); if (!w) return;
      openWhModal({ ...w });
    }));
    tbody.querySelectorAll('[data-del]').forEach(b=>b.addEventListener('click', async ()=>{
      if (!confirm('Xóa kho này?')) return;
      const id = b.getAttribute('data-del');
      const r = await api(`/warehouses/${id}`, { method:'DELETE' });
      if (r?.message && r.message.includes('cannot delete')) alert('Không thể xóa kho đang được sử dụng');
      await loadWarehouses();
    }));
  };
  
  async function loadWarehouseSupplier() {
    try {
      const res = await api('/relationships/supplier-warehouses');
      const items = res.items || [];
      const tbody = el('tbl-warehouse-supplier');
      if (!tbody) return;
      tbody.innerHTML = '';
      if (!items.length) {
        tbody.innerHTML = '<tr><td colspan="3" class="text-center text-muted py-4"><i class="bi bi-inbox me-2"></i>Chưa có quan hệ nào</td></tr>';
        return;
      }
      items.forEach(r => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td><i class="bi bi-building text-muted me-1"></i><span class="fw-semibold">${r.warehouse_code}</span> - ${r.warehouse_name}</td>
          <td><i class="bi bi-truck text-muted me-1"></i>${r.supplier_name}</td>
          <td class="text-center"><span class="badge bg-info">${r.product_count || 0}</span></td>`;
        tbody.appendChild(tr);
      });
    } catch (e) {
      console.error('Error loading warehouse-supplier relationships:', e);
    }
  }
  
  render(items);
  // Load warehouse-supplier relationships after rendering
  loadWarehouseSupplier();
  search?.addEventListener('input', ()=>{
    const q = (search.value || '').toLowerCase();
    render(items.filter(w => `${w.code} ${w.name} ${w.location||''}`.toLowerCase().includes(q)));
  });
  // export
  const btnExp = el('btn-export-wh');
  if (btnExp && !btnExp._bound) {
    btnExp._bound = true;
    btnExp.onclick = ()=>{
      const headers = ['Code','Name','Location','Status'];
      const rows = items.map(w => [w.code, w.name, w.location||'', w.status]);
      const csv = [headers].concat(rows).map(r=>r.map(c=>{ const s=(c??'').toString(); const needs=/[",\n]/.test(s); const esc=s.replace(/"/g,'""'); return needs?`"${esc}"`:esc; }).join(',')).join('\n');
      const blob = new Blob([csv], {type:'text/csv;charset=utf-8;'}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download='warehouses.csv'; a.click(); URL.revokeObjectURL(url);
    };
  }
  // new
  const btnNew = el('btn-new-wh');
  if (btnNew && !btnNew._bound) {
    btnNew._bound = true;
    btnNew.onclick = ()=> openWhModal(null);
  }
}

async function openWhModal(data) {
  const idEl = el('wh-id');
  el('wh-code').value = data?.code || '';
  el('wh-code').disabled = !!data?.id;
  el('wh-name').value = data?.name || '';
  el('wh-location').value = data?.location || '';
  el('wh-status').value = data?.status || 'active';
  idEl.value = data?.id || '';
  el('wh-title').textContent = data ? 'Sửa kho' : 'Thêm kho';
  
  await ensureCatalogsLoaded();
  
  // Load manager dropdown
  const mgrSel = el('wh-manager');
  try {
    const usersRes = await api('/users');
    const mgrs = (usersRes.items || []).filter(u => u.role === 'manager' && u.status === 'active');
    mgrSel.innerHTML = '<option value="">-- Chọn người quản lý --</option>' + 
      mgrs.map(m => `<option value="${m.id}">${m.full_name} (${m.username})</option>`).join('');
  } catch (e) {
    console.error('Error loading managers:', e);
  }
  if (data?.manager_id) mgrSel.value = data.manager_id;
  
  // Load products with this warehouse as default (Tab 2)
  if (data?.id) {
    loadWarehouseProducts(data.id);
  } else {
    renderWarehouseProducts([]);
  }
  
  const modal = new bootstrap.Modal(document.getElementById('wh-modal'));
  const btnSave = el('wh-save');
  const handler = async () => {
    const payload = {
      code: el('wh-code').value.trim(),
      name: el('wh-name').value.trim(),
      location: el('wh-location').value.trim(),
      status: el('wh-status').value,
      manager_id: el('wh-manager').value ? Number(el('wh-manager').value) : null,
    };
    if (!payload.code || !payload.name) { alert('Vui lòng nhập mã và tên'); return; }
    if (idEl.value) {
      await api(`/warehouses/${idEl.value}`, { method: 'PUT', body: payload });
    } else {
      await api('/warehouses/', { method: 'POST', body: payload });
    }
    modal.hide();
    await loadWarehouses();
    btnSave.removeEventListener('click', handler);
  };
  btnSave.addEventListener('click', handler);
  modal.show();
}

async function loadReports() {
  // Ensure catalogs to fill filters
  await ensureCatalogsLoaded();
  const whSel = el('rep-filter-warehouse');
  const prSel = el('rep-filter-product');
  if (whSel && !whSel._filled) {
    whSel._filled = true;
    whSel.innerHTML = '<option value="">-- Tất cả --</option>' + catalog.warehouses.map(w=>`<option value="${w.id}">${w.code} - ${w.name}</option>`).join('');
  }
  if (prSel && !prSel._filled) {
    prSel._filled = true;
    prSel.innerHTML = '<option value="">-- Tất cả --</option>' + catalog.products.map(p=>`<option value="${p.id}">${p.sku} - ${p.name}</option>`).join('');
  }

  const [cur, low, monthly, top] = await Promise.all([
    api('/reports/current-stock'),
    api('/reports/low-stock'),
    api('/reports/monthly-in-out'),
    api('/reports/top-moving'),
  ]);

  // Cache datasets for client-side filtering
  window._reportsCache = {
    cur: cur.items || [],
    low: low.items || [],
    monthly: monthly.items || [],
    top: top.items || [],
  };

  const tbCur = el('report-cur');
  if (tbCur) {
    tbCur.innerHTML = '';
    if (!cur.items || cur.items.length === 0) {
      tbCur.innerHTML = '<tr><td colspan="7" class="text-center text-muted">Không có dữ liệu</td></tr>';
    } else {
      (cur.items || []).forEach(r => {
        const tr = document.createElement('tr');
        const qty = Number(r.qty_on_hand || 0);
        const reorder = Number(r.reorder_level || 0);
        const lastUpdated = r.last_updated ? new Date(r.last_updated).toLocaleString('vi-VN') : '-';
        tr.innerHTML = `
          <td>${r.sku || '-'}</td>
          <td>${r.product_name || '-'}</td>
          <td>${r.warehouse_code || '-'}</td>
          <td class="cell-num">${qty.toLocaleString('vi-VN')}</td>
          <td>${r.unit || '-'}</td>
          <td class="cell-num">${reorder.toLocaleString('vi-VN')}</td>
          <td><span class="text-muted small">${lastUpdated}</span></td>`;
        tbCur.appendChild(tr);
      });
    }
  }

  // Low-stock table in Reports page
  const tbLowRep = el('report-low');
  if (tbLowRep) {
    tbLowRep.innerHTML = '';
    const lowItems = low.items || [];
    if (lowItems.length === 0) {
      tbLowRep.innerHTML = '<tr><td colspan="5" class="text-center text-muted">Không có cảnh báo</td></tr>';
    } else {
      lowItems.forEach(r => {
        const tr = document.createElement('tr');
        const qty = Number(r.qty_on_hand || 0);
        const reorder = Number(r.reorder_level || 0);
        tr.innerHTML = `
          <td>${r.sku || '-'}</td>
          <td>${r.product_name || r.name || '-'}</td>
          <td>${r.warehouse_code || r.warehouse || '-'}</td>
          <td class="cell-num text-danger fw-bold">${qty.toLocaleString('vi-VN')}</td>
          <td class="cell-num">${reorder.toLocaleString('vi-VN')}</td>`;
        tbLowRep.appendChild(tr);
      });
    }
  }

  const tbTop = el('report-top');
  if (tbTop) {
    tbTop.innerHTML = '';
    const topItems = top.items || [];
    if (topItems.length === 0) {
      tbTop.innerHTML = '<tr><td colspan="3" class="text-center text-muted">Không có dữ liệu</td></tr>';
    } else {
      topItems.forEach(r => {
        const tr = document.createElement('tr');
        const movement = Number(r.total_movement_30d || 0);
        tr.innerHTML = `
          <td>${r.sku || '-'}</td>
          <td>${r.name || r.product_name || '-'}</td>
          <td class="cell-num">${movement.toLocaleString('vi-VN')}</td>`;
        tbTop.appendChild(tr);
      });
    }
  }

  // Render time-series chart (default month) to avoid blank area
  renderReportsTimeChart('month', monthly.items || []);
  // Render moving chart
  renderReportsMovingChart(top.items || []);
  bindReportScale();
  bindReportFilters();
  bindReportTabShown();
  bindReportKPIClicks();
}

function bindReportKPIClicks() {
  // Click on SKU KPI -> show current stock tab
  const skuCard = el('rep-kpi-card-sku');
  if (skuCard && !skuCard._bound) {
    skuCard._bound = true;
    skuCard.addEventListener('click', () => {
      const tab = document.querySelector('button[data-bs-target="#tab-cur"]');
      if (tab) tab.click();
    });
  }
  
  // Click on Total Stock KPI -> show current stock tab with filter
  const qtyCard = el('rep-kpi-card-qty');
  if (qtyCard && !qtyCard._bound) {
    qtyCard._bound = true;
    qtyCard.addEventListener('click', () => {
      const tab = document.querySelector('button[data-bs-target="#tab-cur"]');
      if (tab) tab.click();
      // Scroll to table
      setTimeout(() => {
        const table = el('report-cur');
        if (table) table.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    });
  }
  
  // Click on Alert KPI -> show low stock tab
  const lowCard = el('rep-kpi-card-low');
  if (lowCard && !lowCard._bound) {
    lowCard._bound = true;
    lowCard.addEventListener('click', () => {
      const tab = document.querySelector('button[data-bs-target="#tab-low"]');
      if (tab) tab.click();
      // Scroll to table
      setTimeout(() => {
        const table = el('report-low');
        if (table) table.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    });
  }
  
  // Click on Transaction KPI -> show time series tab
  const txCard = el('rep-kpi-card-tx');
  if (txCard && !txCard._bound) {
    txCard._bound = true;
    txCard.addEventListener('click', () => {
      const tab = document.querySelector('button[data-bs-target="#tab-time"]');
      if (tab) tab.click();
      // Scroll to chart
      setTimeout(() => {
        const chart = el('rep-chart-time');
        if (chart) chart.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    });
  }
}

function bindStockOps() {
  // Handle reason select change
  const reasonSelect = el('op-reason-select');
  const reasonCustomWrap = el('op-reason-custom-wrap');
  const reasonCustom = el('op-reason-custom');
  if (reasonSelect) {
    reasonSelect.addEventListener('change', () => {
      if (reasonSelect.value === 'Khác') {
        reasonCustomWrap.style.display = '';
        reasonCustom.value = '';
        reasonCustom.focus();
      } else {
        reasonCustomWrap.style.display = 'none';
        reasonCustom.value = '';
      }
    });
  }
  
  // helper to disable/enable button during request
  const withBusy = async (btn, fn) => {
    const sp = btn?.querySelector('.spinner-border');
    if (btn) btn.disabled = true;
    if (sp) sp.classList.remove('d-none');
    try { await fn(); }
    finally { if (btn) btn.disabled = false; if (sp) sp.classList.add('d-none'); }
  };

  // Mode switch buttons inside the unified form
  document.querySelectorAll('[data-mode-switch]').forEach((b) => {
    if (b._bound) return; b._bound = true;
    b.addEventListener('click', () => {
      document.querySelectorAll('[data-mode-switch]').forEach(x=>x.classList.remove('active'));
      b.classList.add('active');
      setOpMode(b.getAttribute('data-mode-switch'));
    });
  });

  // Watch warehouse + product changes to fetch current stock
  const whSel = el('op-warehouse');
  const prSel = el('op-product');
  if (whSel && !whSel._stockBound) {
    whSel._stockBound = true;
    whSel.addEventListener('change', fetchCurrentStock);
  }
  if (prSel && !prSel._stockBound) {
    prSel._stockBound = true;
    prSel.addEventListener('change', fetchCurrentStock);
  }

  // Save / Reset buttons
  el('btn-op-save').onclick = async () => {
    await withBusy(el('btn-op-save'), async () => {
      const mode = el('page-stock').getAttribute('data-mode') || 'in';
      const pid = Number(el('op-product').value);
      const wid = Number(el('op-warehouse').value);
      const qty = Number(el('op-qty').value);
      if (!pid || !wid || (!qty && mode==='adjust') || (qty<=0 && mode!=='adjust')) {
        alert('Vui lòng chọn SP, Kho và nhập số lượng hợp lệ'); return; }
      
      // Validate OUT: check current stock
      if (mode === 'out') {
        const currentStock = Number(el('op-current-stock').textContent || 0);
        if (qty > currentStock) {
          alert(`Không thể xuất ${qty} sản phẩm. Số lượng tồn kho hiện tại chỉ còn ${currentStock}.`);
          return;
        }
      }

      // Get reason from select or custom input
      let reason = '';
      const reasonSelect = el('op-reason-select');
      const reasonCustom = el('op-reason-custom');
      if (reasonSelect && reasonSelect.value) {
        if (reasonSelect.value === 'Khác' && reasonCustom && reasonCustom.value.trim()) {
          reason = reasonCustom.value.trim();
        } else if (reasonSelect.value !== 'Khác') {
          reason = reasonSelect.value;
        }
      }
      if (!reason) {
        alert('Vui lòng chọn hoặc nhập lý do');
        return;
      }
      
      let body = { product_id: pid, warehouse_id: wid, reason: reason, ref_document: el('op-ref').value };
      if (mode === 'in') {
        body.quantity = qty;
        const sid = el('op-supplier').value ? Number(el('op-supplier').value) : null;
        body.supplier_id = sid;
        await api('/stock/in', { method: 'POST', body: { ...body, supplier_id: sid } });
        alert('Đã nhập kho');
      } else if (mode === 'out') {
        body.quantity = qty;
        try { await api('/stock/out', { method: 'POST', body }); alert('Đã xuất kho'); }
        catch { alert('Xuất kho thất bại (có thể thiếu tồn)'); }
      } else {
        body.signed_delta = qty; // có thể âm/dương
        try { await api('/stock/adjust', { method: 'POST', body }); alert('Đã điều chỉnh'); }
        catch { alert('Điều chỉnh thất bại'); }
      }
      genDocCode(); // cập nhật mã phiếu tiếp theo
      await fetchCurrentStock(); // refresh stock display
      await loadRecentTransactions(mode); // refresh recent transactions
    });
  };
  el('btn-op-reset').onclick = () => resetOpForm();
}

function genDocCode() {
  const ts = new Date();
  const code = `${ts.getFullYear()}${String(ts.getMonth()+1).padStart(2,'0')}${String(ts.getDate()).padStart(2,'0')}-${String(ts.getHours()).padStart(2,'0')}${String(ts.getMinutes()).padStart(2,'0')}${String(ts.getSeconds()).padStart(2,'0')}`;
  el('doc-code').textContent = `TX_${code}`;
}

function resetOpForm() {
  el('op-warehouse').value = '';
  el('op-product').value = '';
  el('op-supplier').value = '';
  el('op-qty').value = '';
  if (el('op-reason-select')) el('op-reason-select').value = '';
  if (el('op-reason-custom')) el('op-reason-custom').value = '';
  if (el('op-reason-custom-wrap')) el('op-reason-custom-wrap').style.display = 'none';
  el('op-ref').value = '';
  el('op-stock-info').classList.add('d-none');
}

function setOpMode(mode) {
  const section = el('page-stock');
  section.setAttribute('data-mode', mode);
  const reasonSelect = el('op-reason-select');
  const reasonCustomWrap = el('op-reason-custom-wrap');
  
  // Label & supplier visibility per mode
  if (mode === 'in') {
    el('op-qty-label').textContent = 'Số lượng nhập';
    el('op-supplier-wrap').classList.remove('d-none');
    el('op-stock-info').classList.add('d-none');
    el('recent-title').textContent = 'Nhập kho gần đây';
    
    // Update reason dropdown for IN mode
    if (reasonSelect) {
      reasonSelect.innerHTML = `
        <option value="">-- Chọn lý do --</option>
        <option value="Nhập hàng từ nhà cung cấp">Nhập hàng từ nhà cung cấp</option>
        <option value="Nhập hàng trả về">Nhập hàng trả về</option>
        <option value="Nhập hàng điều chuyển từ kho khác">Nhập hàng điều chuyển từ kho khác</option>
        <option value="Nhập hàng kiểm kê thừa">Nhập hàng kiểm kê thừa</option>
        <option value="Nhập hàng khác">Nhập hàng khác</option>
        <option value="Khác">Khác (tự nhập)</option>
      `;
    }
  } else if (mode === 'out') {
    el('op-qty-label').textContent = 'Số lượng xuất';
    el('op-supplier-wrap').classList.add('d-none');
    fetchCurrentStock();
    el('recent-title').textContent = 'Xuất kho gần đây';
    
    // Update reason dropdown for OUT mode
    if (reasonSelect) {
      reasonSelect.innerHTML = `
        <option value="">-- Chọn lý do --</option>
        <option value="Xuất hàng bán">Xuất hàng bán</option>
        <option value="Xuất hàng điều chuyển">Xuất hàng điều chuyển</option>
        <option value="Xuất hàng hỏng/loại bỏ">Xuất hàng hỏng/loại bỏ</option>
        <option value="Xuất hàng kiểm kê thiếu">Xuất hàng kiểm kê thiếu</option>
        <option value="Xuất hàng mẫu/QC">Xuất hàng mẫu/QC</option>
        <option value="Xuất hàng khác">Xuất hàng khác</option>
        <option value="Khác">Khác (tự nhập)</option>
      `;
    }
  } else {
    el('op-qty-label').textContent = 'Delta (+/-)';
    el('op-supplier-wrap').classList.add('d-none');
    el('op-stock-info').classList.add('d-none');
    el('recent-title').textContent = 'Điều chỉnh gần đây';
    
    // Update reason dropdown for ADJUST mode
    if (reasonSelect) {
      reasonSelect.innerHTML = `
        <option value="">-- Chọn lý do --</option>
        <option value="Điều chỉnh tăng">Điều chỉnh tăng</option>
        <option value="Điều chỉnh giảm">Điều chỉnh giảm</option>
        <option value="Điều chỉnh kiểm kê">Điều chỉnh kiểm kê</option>
        <option value="Điều chỉnh lỗi nhập liệu">Điều chỉnh lỗi nhập liệu</option>
        <option value="Khác">Khác (tự nhập)</option>
      `;
    }
  }
  
  // Reset reason and custom input
  if (reasonSelect) reasonSelect.value = '';
  if (reasonCustomWrap) reasonCustomWrap.style.display = 'none';
  if (el('op-reason-custom')) el('op-reason-custom').value = '';
  
  genDocCode();
  loadRecentTransactions(mode);
}

async function fetchCurrentStock() {
  const pid = Number(el('op-product').value);
  const wid = Number(el('op-warehouse').value);
  const mode = el('page-stock')?.getAttribute('data-mode') || 'in';
  const stockInfo = el('op-stock-info');
  const stockSpan = el('op-current-stock');
  const stockIcon = el('op-stock-icon');
  const stockWarning = el('op-stock-warning');
  
  console.log('fetchCurrentStock called', { pid, wid, mode });
  
  if (!stockInfo || !stockSpan) {
    console.log('Missing stock elements');
    return;
  }
  
  if (!pid || !wid || mode !== 'out') {
    stockInfo.classList.add('d-none');
    console.log('Hide stock info', { pid, wid, mode });
    return;
  }
  
  try {
    const data = await api(`/reports/current-stock`);
    const items = data.items || [];
    const current = items.find(it => it.product_id === pid && it.warehouse_id === wid);
    const qty = current ? current.qty_on_hand : 0;
    stockSpan.textContent = qty;
    stockInfo.classList.remove('d-none');
    
    // Color coding and icon
    if (qty === 0) {
      stockInfo.className = 'form-text text-danger';
      stockIcon.className = 'bi bi-exclamation-triangle me-1';
      stockWarning.textContent = ' - Hết hàng!';
    } else if (qty < 10) {
      stockInfo.className = 'form-text text-warning';
      stockIcon.className = 'bi bi-exclamation-circle me-1';
      stockWarning.textContent = ' - Sắp hết';
    } else {
      stockInfo.className = 'form-text text-info';
      stockIcon.className = 'bi bi-info-circle me-1';
      stockWarning.textContent = '';
    }
  } catch (err) {
    console.error('Fetch stock error:', err);
    stockInfo.classList.add('d-none');
  }
}

async function loadRecentTransactions(mode) {
  const tbody = el('tbl-recent-tx');
  if (!tbody) return;
  
  const typeMap = { 'in': 'IN', 'out': 'OUT', 'adjust': 'ADJUST' };
  const txnType = typeMap[mode] || 'IN';
  
  try {
    const data = await api(`/stock/recent?type=${txnType}&limit=10`);
    const items = data.items || [];
    
    tbody.innerHTML = '';
    if (!items.length) {
      tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">Chưa có giao dịch</td></tr>';
      return;
    }
    
    items.forEach(tx => {
      const tr = document.createElement('tr');
      const created = tx.created_at ? new Date(tx.created_at).toLocaleString('vi-VN') : '-';
      tr.innerHTML = `
        <td><code class="small">${tx.txn_code}</code></td>
        <td>${tx.product_sku} - ${tx.product_name}</td>
        <td>${tx.warehouse_code} - ${tx.warehouse_name}</td>
        <td class="text-end fw-semibold">${tx.quantity}</td>
        <td>${tx.reason || '-'}</td>
        <td class="small text-muted">${created}</td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    console.error('Load recent transactions error:', err);
    tbody.innerHTML = '<tr><td colspan="6" class="text-center text-danger">Lỗi tải dữ liệu</td></tr>';
  }
}

async function ensureCatalogsLoaded() {
  if (!(catalog.products.length && catalog.warehouses.length && catalog.suppliers.length)) {
    const [prods, whs, sups] = await Promise.all([
      api('/catalog/products-min'),
      api('/catalog/warehouses'),
      api('/catalog/suppliers'),
    ]);
    catalog.products = prods.items || [];
    catalog.warehouses = whs.items || [];
    catalog.suppliers = sups.items || [];
  }
  // Always fill current UI controls
  fillStockDropdowns();
  fillUnifiedStockDropdowns();
}

// Force refresh catalogs after CRUD and update UI controls immediately
async function refreshCatalogs() {
  const [prods, whs, sups] = await Promise.all([
    api('/catalog/products-min'),
    api('/catalog/warehouses'),
    api('/catalog/suppliers'),
  ]);
  catalog.products = prods.items || [];
  catalog.warehouses = whs.items || [];
  catalog.suppliers = sups.items || [];
  fillStockDropdowns();
  fillUnifiedStockDropdowns();
  // Refresh report filters if present
  const whSel = el('rep-filter-warehouse');
  const prSel = el('rep-filter-product');
  if (whSel) whSel.innerHTML = '<option value="">-- Tất cả --</option>' + catalog.warehouses.map(w=>`<option value="${w.id}">${w.code} - ${w.name}</option>`).join('');
  if (prSel) prSel.innerHTML = '<option value="">-- Tất cả --</option>' + catalog.products.map(p=>`<option value="${p.id}">${p.sku} - ${p.name}</option>`).join('');
}

function fillStockDropdowns() {
  const setOptions = (sel, items, getLabel) => {
    if (!sel) return;
    sel.innerHTML = '<option value="">-- Chọn --</option>' + items.map(it => `<option value="${it.id}">${getLabel(it)}</option>`).join('');
  };
  // IN
  setOptions(el('in-product'), catalog.products, p => `${p.sku} - ${p.name}`);
  setOptions(el('in-warehouse'), catalog.warehouses, w => `${w.code} - ${w.name}`);
  setOptions(el('in-supplier'), catalog.suppliers, s => `${s.name}`);
  // OUT
  setOptions(el('out-product'), catalog.products, p => `${p.sku} - ${p.name}`);
  setOptions(el('out-warehouse'), catalog.warehouses, w => `${w.code} - ${w.name}`);
  // ADJ
  setOptions(el('adj-product'), catalog.products, p => `${p.sku} - ${p.name}`);
  setOptions(el('adj-warehouse'), catalog.warehouses, w => `${w.code} - ${w.name}`);
}

function fillUnifiedStockDropdowns() {
  const setOptions = (sel, items, getLabel) => {
    if (!sel) return;
    sel.innerHTML = '<option value="">-- Chọn --</option>' + items.map(it => `<option value="${it.id}">${getLabel(it)}</option>`).join('');
  };
  setOptions(el('op-product'), catalog.products, p => `${p.sku} - ${p.name}`);
  setOptions(el('op-warehouse'), catalog.warehouses, w => `${w.code} - ${w.name}`);
  setOptions(el('op-supplier'), catalog.suppliers, s => `${s.name}`);
}

async function loadUsers() {
  if (currentUser?.role !== 'manager') { showPage('dashboard'); return; }
  let data;
  try {
    data = await api('/users/');
  } catch (e) {
    // Likely 403 if current user is no longer manager
    showPage('dashboard');
    renderNav();
    return;
  }
  const tbody = el('tbl-users');
  tbody.innerHTML = '';
  (data.items || []).forEach((u) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${u.id}</td>
      <td>${u.username}</td>
      <td>${u.full_name}</td>
      <td>${u.role}</td>
      <td><span class="status-chip ${u.status==='active'?'success':'danger'}">${u.status}</span></td>
      <td class="text-end">
        <div class="btn-group btn-group-sm">
          <button class="btn btn-outline-primary" data-edit="${u.id}">Sửa</button>
          <button class="btn btn-outline-secondary" data-reset="${u.id}">Reset PW</button>
          ${u.status==='active' ? `<button class="btn btn-outline-warning" data-deact="${u.id}">Disable</button>` : `<button class="btn btn-outline-success" data-act="${u.id}">Enable</button>`}
          <button class="btn btn-outline-danger" data-del="${u.id}">Xóa</button>
        </div>
      </td>`;
    tbody.appendChild(tr);
  });
  tbody.querySelectorAll('button[data-edit]').forEach((b) => b.addEventListener('click', async () => {
    const id = Number(b.getAttribute('data-edit'));
    const u = (data.items||[]).find(x=>x.id===id); if (!u) return;
    openUserModal({...u});
  }));
  tbody.querySelectorAll('button[data-reset]').forEach((b) => b.addEventListener('click', async () => {
    const id = Number(b.getAttribute('data-reset'));
    openUserPwModal(id);
  }));
  // Activate/Deactivate
  tbody.querySelectorAll('button[data-deact]').forEach((b) => b.addEventListener('click', async () => {
    const id = Number(b.getAttribute('data-deact'));
    await api(`/users/${id}/deactivate`, { method:'POST' });
    await loadUsers();
  }));
  tbody.querySelectorAll('button[data-act]').forEach((b) => b.addEventListener('click', async () => {
    const id = Number(b.getAttribute('data-act'));
    await api(`/users/${id}/activate`, { method:'POST' });
    await loadUsers();
  }));
  // Delete
  tbody.querySelectorAll('button[data-del]').forEach((b) => b.addEventListener('click', async () => {
    const id = Number(b.getAttribute('data-del'));
    if (confirm('Xóa người dùng này? Hành động không thể hoàn tác.')) {
      await api(`/users/${id}`, { method:'DELETE' });
      await loadUsers();
    }
  }));
  el('btn-new-user').onclick = () => openUserModal(null);
}

// Supplier modal handlers with product relationships
let supplierProducts = []; // Temporary storage for products

async function openSupModal(data) {
  const idEl = el('sup-id');
  el('sup-name').value = data?.name || '';
  el('sup-contact').value = data?.contact || '';
  el('sup-phone').value = data?.phone || '';
  el('sup-email').value = data?.email || '';
  el('sup-address').value = data?.address || '';
  el('sup-status').value = data?.status || 'active';
  idEl.value = data?.id || '';
  el('sup-title').textContent = data ? 'Sửa nhà cung cấp' : 'Thêm nhà cung cấp';
  
  // Reset products list
  supplierProducts = [];
  
  // Load catalogs for dropdowns
  await ensureCatalogsLoaded();
  
  // Populate product dropdown
  const productSel = el('sup-add-product');
  productSel.innerHTML = '<option value="">-- Chọn sản phẩm --</option>' + 
    catalog.products.map(p => `<option value="${p.id}">${p.sku} - ${p.name}</option>`).join('');
  
  // Populate warehouse dropdown
  const warehouseSel = el('sup-add-warehouse');
  warehouseSel.innerHTML = '<option value="">-- Chọn kho --</option>' + 
    catalog.warehouses.map(w => `<option value="${w.id}">${w.code} - ${w.name}</option>`).join('');
  
  // Load existing products if editing
  if (data?.id) {
    try {
      const res = await api(`/product-supplier/supplier/${data.id}/products`);
      supplierProducts = res.items || [];
      renderSupplierProducts();
    } catch (e) {
      console.error('Error loading supplier products:', e);
    }
  } else {
    renderSupplierProducts();
  }
  
  // Setup add product button
  const btnAdd = el('sup-btn-add-product');
  btnAdd.replaceWith(btnAdd.cloneNode(true));
  el('sup-btn-add-product').addEventListener('click', addProductToSupplier);
  
  const modal = new bootstrap.Modal(document.getElementById('sup-modal'));
  const btn = el('sup-save');
  const handler = async ()=>{
    const body = {
      name: el('sup-name').value.trim(),
      contact: el('sup-contact').value.trim(),
      phone: el('sup-phone').value.trim(),
      email: el('sup-email').value.trim(),
      address: el('sup-address').value.trim(),
      status: el('sup-status').value,
    };
    if (!body.name) { alert('Tên nhà cung cấp bắt buộc'); return; }
    try {
      let supplierId = idEl.value;
      
      // Save supplier info first
      if (supplierId) {
        await api(`/suppliers/${supplierId}`, {method:'PUT', body});
      } else {
        const res = await api('/suppliers', {method:'POST', body});
        supplierId = res.item.id;
      }
      
      // Save product relationships
      if (supplierProducts.length > 0) {
        const productsData = supplierProducts.map(p => ({
          product_id: p.product_id,
          warehouse_id: p.warehouse_id || null,
          delivery_date: p.delivery_date || null,
          status: p.status || 'active'
        }));
        
        await api(`/product-supplier/supplier/${supplierId}/products`, {
          method: 'POST',
          body: { products: productsData }
        });
      }
      
      modal.hide();
      loadSuppliers();
      alert('Đã lưu thành công!');
    } catch (e) {
      alert(e.message || 'Lỗi khi lưu');
    }
  };
  btn.replaceWith(btn.cloneNode(true));
  el('sup-save').addEventListener('click', handler);
  modal.show();
}

function addProductToSupplier() {
  const productId = Number(el('sup-add-product').value);
  const warehouseId = Number(el('sup-add-warehouse').value) || null;
  const deliveryDate = el('sup-add-delivery').value || null;
  
  if (!productId) {
    alert('Vui lòng chọn sản phẩm');
    return;
  }
  
  // Check duplicate
  const exists = supplierProducts.find(p => 
    p.product_id === productId && 
    (p.warehouse_id === warehouseId || (!p.warehouse_id && !warehouseId))
  );
  
  if (exists) {
    alert('Sản phẩm này đã được thêm với kho này rồi!');
    return;
  }
  
  const product = catalog.products.find(p => p.id === productId);
  const warehouse = warehouseId ? catalog.warehouses.find(w => w.id === warehouseId) : null;
  
  supplierProducts.push({
    product_id: productId,
    product_sku: product.sku,
    product_name: product.name,
    warehouse_id: warehouseId,
    warehouse_code: warehouse?.code,
    warehouse_name: warehouse?.name,
    delivery_date: deliveryDate,
    status: 'active'
  });
  
  // Reset form
  el('sup-add-product').value = '';
  el('sup-add-warehouse').value = '';
  el('sup-add-delivery').value = '';
  
  renderSupplierProducts();
}

function renderSupplierProducts() {
  const tbody = el('sup-products-list');
  if (!tbody) return;
  
  if (supplierProducts.length === 0) {
    tbody.innerHTML = `<tr>
      <td colspan="5" class="text-center text-muted py-4">
        <i class="bi bi-inbox fs-3"></i>
        <p class="mb-0 mt-2">Chưa có sản phẩm nào. Vui lòng thêm sản phẩm ở trên.</p>
      </td>
    </tr>`;
    return;
  }
  
  tbody.innerHTML = '';
  supplierProducts.forEach((item, idx) => {
    const tr = document.createElement('tr');
    const deliveryDisplay = item.delivery_date ? 
      `<span class="badge bg-primary"><i class="bi bi-calendar-event me-1"></i>${new Date(item.delivery_date).toLocaleDateString('vi-VN')}</span>` : 
      '<span class="text-muted">-</span>';
    
    tr.innerHTML = `
      <td><i class="bi bi-box text-muted me-2"></i><strong>${item.product_sku}</strong> - ${item.product_name}</td>
      <td>${item.warehouse_code ? `<i class="bi bi-building text-muted me-1"></i>${item.warehouse_code} - ${item.warehouse_name}` : '<span class="text-muted">-</span>'}</td>
      <td class="text-center">${deliveryDisplay}</td>
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
      if (confirm('Xóa sản phẩm này khỏi nhà cung cấp?')) {
        supplierProducts.splice(idx, 1);
        renderSupplierProducts();
      }
    });
  });
}

// Product CRUD modal handler (basic info only)
let productSuppliers = []; // kept for backward compatibility but not used in Products modal

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
  el('prod-sku').disabled = !!data?.id;
  
  await ensureCatalogsLoaded();

  // Load warehouses dropdown (Tab 1)
  const whSel = el('prod-default-warehouse');
  whSel.innerHTML = '<option value="">-- Không có --</option>' + 
    catalog.warehouses.map(w => `<option value="${w.id}">${w.code} - ${w.name}</option>`).join('');
  if (data?.default_warehouse_id) whSel.value = data.default_warehouse_id;

  const modal = new bootstrap.Modal(document.getElementById('prod-modal'));
  const btn = el('prod-save');
  const handler = async ()=>{
    const body = {
      sku: el('prod-sku').value.trim(),
      name: el('prod-name').value.trim(),
      category: el('prod-category').value.trim(),
      unit: el('prod-unit').value.trim() || 'pcs',
      reorder_level: Number(el('prod-reorder').value||0),
      status: el('prod-status').value,
      default_warehouse_id: el('prod-default-warehouse').value ? Number(el('prod-default-warehouse').value) : null,
    };
    if (!idEl.value && !body.sku) { alert('SKU bắt buộc'); return; }
    if (!body.name) { alert('Tên bắt buộc'); return; }
    
    try {
      let productId = idEl.value;
      if (productId) {
        await api(`/products/${productId}`, {method:'PUT', body});
      } else {
        const res = await api('/products', {method:'POST', body});
        productId = res.item.id;
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
  const deliveryDate = el('prod-add-delivery').value || null;
  
  if (!supplierId) {
    alert('Vui lòng chọn nhà cung cấp');
    return;
  }
  
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
    delivery_date: deliveryDate,
    status: 'active'
  });
  
  el('prod-add-supplier').value = '';
  el('prod-add-warehouse').value = '';
  el('prod-add-delivery').value = '';
  
  renderProductSuppliers();
}

function renderProductSuppliers() {
  const tbody = el('prod-suppliers-list');
  if (!tbody) return;
  
  if (productSuppliers.length === 0) {
    tbody.innerHTML = `<tr>
      <td colspan="5" class="text-center text-muted py-4">
        <i class="bi bi-inbox fs-3"></i>
        <p class="mb-0 mt-2">Chưa có nhà cung cấp. Thêm ở trên.</p>
      </td>
    </tr>`;
    return;
  }
  
  tbody.innerHTML = '';
  productSuppliers.forEach((item, idx) => {
    const tr = document.createElement('tr');
    const deliveryDisplay = item.delivery_date ? 
      `<span class="badge bg-primary"><i class="bi bi-calendar-event me-1"></i>${new Date(item.delivery_date).toLocaleDateString('vi-VN')}</span>` : 
      '<span class="text-muted">-</span>';
    
    tr.innerHTML = `
      <td><i class="bi bi-truck text-muted me-2"></i><strong>${item.supplier_name}</strong></td>
      <td>${item.warehouse_code ? `<i class="bi bi-building text-muted me-1"></i>${item.warehouse_code} - ${item.warehouse_name}` : '<span class="text-muted">-</span>'}</td>
      <td class="text-center">${deliveryDisplay}</td>
      <td class="text-center">
        <button class="btn btn-sm btn-danger" data-remove="${idx}" title="Xóa">
          <i class="bi bi-trash"></i>
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });
  
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

// User modal handlers
function openUserModal(data) {
  const idEl = el('user-id');
  el('user-username').value = data?.username || '';
  el('user-fullname').value = data?.full_name || '';
  el('user-role').value = data?.role || 'staff';
  el('user-status').value = data?.status || 'active';
  idEl.value = data?.id || '';
  el('user-title').textContent = data ? 'Sửa người dùng' : 'Thêm người dùng';
  // show/hide password field based on create/edit
  const pwWrap = el('user-password-wrap');
  pwWrap.style.display = data ? 'none' : '';
  const modal = new bootstrap.Modal(document.getElementById('user-modal'));
  const btn = el('user-save');
  const handler = async ()=>{
    if (idEl.value) {
      // update full_name, status; role via set-role if changed
      await api(`/users/${idEl.value}`, { method:'PUT', body: { full_name: el('user-fullname').value.trim(), status: el('user-status').value } });
      // set role if changed
      const newRole = el('user-role').value;
      if (data?.role !== newRole) {
        await api(`/users/${idEl.value}/set-role`, { method:'POST', body: { role: newRole } });
        // If editing myself and I lost manager role, update UI state
        if (currentUser && Number(idEl.value) === Number(currentUser.id) && newRole !== 'manager') {
          currentUser.role = newRole;
          renderNav();
          showPage('dashboard');
        }
      }
    } else {
      const payload = {
        username: el('user-username').value.trim(),
        full_name: el('user-fullname').value.trim(),
        role: el('user-role').value,
        password: el('user-password').value,
      };
      if (!payload.username || !payload.full_name || !payload.role || !payload.password) { alert('Điền đầy đủ thông tin'); return; }
      await api('/users/', { method:'POST', body: payload });
    }
    modal.hide(); await loadUsers(); btn.removeEventListener('click', handler);
  };
  btn.addEventListener('click', handler);
  modal.show();
}

function openUserPwModal(id) {
  el('user-pw-id').value = id;
  el('user-new-password').value = '';
  const modal = new bootstrap.Modal(document.getElementById('user-pw-modal'));
  const btn = el('user-pw-save');
  const handler = async ()=>{
    const pw = el('user-new-password').value;
    if (!pw) { alert('Nhập mật khẩu mới'); return; }
    await api(`/users/${el('user-pw-id').value}/reset-password`, { method:'POST', body:{ new_password: pw } });
    modal.hide(); btn.removeEventListener('click', handler);
  };
  btn.addEventListener('click', handler);
  modal.show();
}

function init() {
  bindNav();
  bindStockOps();
  // Initialize reason dropdown with IN mode defaults
  const reasonSelect = el('op-reason-select');
  if (reasonSelect) {
    reasonSelect.innerHTML = `
      <option value="">-- Chọn lý do --</option>
      <option value="Nhập hàng từ nhà cung cấp">Nhập hàng từ nhà cung cấp</option>
      <option value="Nhập hàng trả về">Nhập hàng trả về</option>
      <option value="Nhập hàng điều chuyển từ kho khác">Nhập hàng điều chuyển từ kho khác</option>
      <option value="Nhập hàng kiểm kê thừa">Nhập hàng kiểm kê thừa</option>
      <option value="Nhập hàng khác">Nhập hàng khác</option>
      <option value="Khác">Khác (tự nhập)</option>
    `;
  }
  el('btn-login').addEventListener('click', handleLogin);
  // Sidebar logout button
  const btnLogoutSide = el('btn-logout-side');
  if (btnLogoutSide && !btnLogoutSide._bound) { btnLogoutSide._bound = true; btnLogoutSide.addEventListener('click', ()=> setAuth(null, null)); }
  // Google SSO login
  const btnG = el('btn-google');
  if (btnG) {
    btnG.addEventListener('click', () => {
      window.location.href = `${API_BASE}/auth/sso/login`;
    });
  }
  // GitHub SSO login
  const btnGh = el('btn-github');
  if (btnGh) {
    btnGh.addEventListener('click', () => {
      window.location.href = `${API_BASE}/auth/sso/github/login`;
    });
  }
  // Toggle show/hide password
  const btnPw = el('btn-toggle-pw');
  const pw = el('login-password');
  if (btnPw && pw) {
    btnPw.addEventListener('click', () => {
      const isPwd = pw.getAttribute('type') === 'password';
      pw.setAttribute('type', isPwd ? 'text' : 'password');
      btnPw.innerHTML = `<i class="bi ${isPwd ? 'bi-eye-slash' : 'bi-eye'}"></i>`;
      pw.focus();
    });
  }
  // Submit on Enter
  const userIn = el('login-username');
  if (userIn) userIn.addEventListener('keydown', (e)=>{ if (e.key==='Enter') handleLogin(); });
  if (pw) pw.addEventListener('keydown', (e)=>{ if (e.key==='Enter') handleLogin(); });
  // If redirected back from SSO with token in hash
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const ssoToken = hash.get('token');
  if (ssoToken) {
    window.location.hash = '';
    token = ssoToken;
    tryLoadMe().then(async () => {
      if (currentUser) setAuth(token, currentUser);
      if (token && currentUser) await loadDashboard();
    });
  }
  tryLoadMe().then(async () => {
    renderNav();
    if (token && currentUser) await loadDashboard();
  });
}

document.addEventListener('DOMContentLoaded', init);

// Warehouse products helper functions
async function loadWarehouseProducts(warehouseId) {
  try {
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
