// WorkPulse Dashboard Controller

const API_BASE = (window.location.protocol.startsWith('http') && window.location.port === '8000')
  ? '/api/v1'
  : 'http://127.0.0.1:8000/api/v1';

const state = {
  activeTab: 'tab-overview',
  currentUser: null,
  token: localStorage.getItem('wp-token') || null,
  employees: [],
  selectedEmpId: null,
  currentDeviceToken: null,
};

// Global switchTab callable from inline HTML onclick, listeners, and scripts
window.switchTab = function switchTab(tabId) {
  if (!tabId) return;
  state.activeTab = tabId;

  // 1. Update tab navigation buttons
  const tabBtns = document.querySelectorAll('.tab-btn');
  tabBtns.forEach(btn => {
    const isTarget = btn.getAttribute('data-tab') === tabId;
    btn.classList.toggle('active', isTarget);
    if (isTarget) {
      btn.setAttribute('aria-selected', 'true');
    } else {
      btn.removeAttribute('aria-selected');
    }
  });

  // 2. Explicitly toggle visibility on all tab panes
  const tabPanes = document.querySelectorAll('.tab-pane');
  tabPanes.forEach(pane => {
    const isTarget = pane.id === tabId;
    pane.classList.toggle('active', isTarget);
    pane.style.display = isTarget ? 'block' : 'none';
  });

  // 3. Load tab content safely with isolated error catching
  try {
    if (tabId === 'tab-overview') loadOverviewData();
    else if (tabId === 'tab-employees') loadEmployeesDirectory();
    else if (tabId === 'tab-attendance') loadAttendanceRollCall();
    else if (tabId === 'tab-activity') loadActivityTab();
    else if (tabId === 'tab-screenshots') loadScreenshotsGallery();
    else if (tabId === 'tab-rules') loadRulesAndStars();
    else if (tabId === 'tab-finance') loadFinanceTab();
  } catch (err) {
    console.error(`Error loading content for ${tabId}:`, err);
  }
};

// Safe event listener helper that never throws on missing elements
function safeListen(id, event, callback) {
  const el = document.getElementById(id);
  if (el) {
    el.addEventListener(event, callback);
  }
}

// Initial setup on DOM ready (handles cases where DOMContentLoaded already fired)
function initApp() {
  initTheme();
  setupTabs();
  setupEventListeners();

  // Restore cached user info if present
  try {
    const cachedUser = localStorage.getItem('wp-user');
    if (cachedUser) state.currentUser = JSON.parse(cachedUser);
  } catch (e) {}

  // Login as admin and initialize views
  loginAs('admin').then(() => {
    const dateLabel = document.getElementById('todayDateLabel');
    if (dateLabel) {
      dateLabel.textContent = new Date().toLocaleDateString(undefined, {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
      });
    }
    // Explicitly activate the current active tab
    window.switchTab(state.activeTab || 'tab-overview');
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  // DOM already parsed and ready
  initApp();
}

// Theme Management
function initTheme() {
  const saved = localStorage.getItem('wp-theme') || 'dark';
  applyTheme(saved);
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') || 'dark';
  const next = current === 'dark' ? 'light' : 'dark';
  applyTheme(next);
  localStorage.setItem('wp-theme', next);
  if (state.activeTab === 'tab-activity') {
    renderHeatmapForSelected();
  }
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  const icon = document.getElementById('themeIcon');
  const label = document.getElementById('themeLabel');
  if (icon && label) {
    if (theme === 'light') {
      icon.textContent = '☀️';
      label.textContent = 'Light';
    } else {
      icon.textContent = '🌙';
      label.textContent = 'Dark';
    }
  }
}

// Setup tab switches with multiple resilient layers
function setupTabs() {
  // Layer 1: Delegation on #navTabs container
  const navTabs = document.getElementById('navTabs');
  if (navTabs) {
    navTabs.addEventListener('click', (e) => {
      const btn = e.target.closest('.tab-btn');
      if (btn) {
        const targetTab = btn.getAttribute('data-tab');
        if (targetTab) {
          window.switchTab(targetTab);
        }
      }
    });
  }

  // Layer 2: Individual listeners on tab buttons
  const tabBtns = document.querySelectorAll('.tab-btn');
  tabBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const targetTab = btn.getAttribute('data-tab');
      if (targetTab) {
        window.switchTab(targetTab);
      }
    });
  });

  // Layer 3: Global document delegation as absolute fallback
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.tab-btn');
    if (btn) {
      const targetTab = btn.getAttribute('data-tab');
      if (targetTab && targetTab !== state.activeTab) {
        window.switchTab(targetTab);
      }
    }
  });
}

// User / Role login helper
async function loginAs(role) {
  let email = 'admin@tracking.local';
  let pwd = 'admin123';

  if (role === 'manager') {
    email = 'manager@tracking.local';
    pwd = 'manager123';
  } else if (role === 'employee') {
    email = 'alex@tracking.local';
    pwd = 'alex123';
  }

  try {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: pwd })
    });
    if (!res.ok) throw new Error('Login failed');
    const data = await res.json();
    state.token = data.access_token;
    state.currentUser = data;

    localStorage.setItem('wp-token', data.access_token);
    localStorage.setItem('wp-user', JSON.stringify(data));

    // Update Header Pill
    const badge = document.getElementById('activeRoleBadge');
    if (badge) {
      badge.textContent = data.role;
      badge.className = `role-pill ${data.role.toLowerCase()}`;
    }
    const nameEl = document.getElementById('activeUserName');
    if (nameEl) {
      nameEl.textContent = data.name;
    }

    await fetchEmployees();
    refreshAll();
    await checkNotifications();
  } catch (err) {
    console.error('Error logging in:', err);
  }
}

function setupEventListeners() {
  safeListen('switchUserSelect', 'change', (e) => {
    loginAs(e.target.value);
  });

  safeListen('refreshDataBtn', 'click', () => {
    refreshAll();
  });

  safeListen('themeToggleBtn', 'click', toggleTheme);

  // Filter Buttons
  safeListen('applyAttFilterBtn', 'click', loadAttendanceRollCall);
  safeListen('loadHeatmapBtn', 'click', renderHeatmapForSelected);
  safeListen('heatmapEmpSelect', 'change', renderHeatmapForSelected);

  // Screenshot Filter & Delete Actions
  safeListen('ssEmpSelect', 'change', loadScreenshotsGallery);
  safeListen('deleteScreenshotsBtn', 'click', handleDeleteScreenshots);
  safeListen('deleteActiveScreenshotBtn', 'click', handleDeleteActiveScreenshot);

  // Policy Rules Edit Form
  safeListen('rulesEditForm', 'submit', handleSaveRules);

  // Custom Policy Creation Form
  safeListen('customRuleCreateForm', 'submit', handleCreateCustomRule);
  safeListen('newRuleActive', 'change', (e) => {
    const txt = document.getElementById('newRuleActiveText');
    if (txt) txt.textContent = e.target.checked ? 'Enabled (Active)' : 'Disabled (Inactive)';
  });

  // Employee Directory Filters
  safeListen('employeeSearchInput', 'input', () => loadEmployeesDirectory());
  safeListen('empRoleFilter', 'change', () => loadEmployeesDirectory());

  // Evaluate Stars & Purge
  safeListen('evaluateStarsBtn', 'click', evaluateStarsNow);
  safeListen('purgeRetentionBtn', 'click', purgeRetentionNow);

  // Notification Center
  const notifBtn = document.getElementById('notifBellBtn');
  if (notifBtn) {
    notifBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleNotifDrawer();
    });
  }
  safeListen('markAllReadBtn', 'click', markAllNotificationsRead);
  document.addEventListener('click', (e) => {
    const drawer = document.getElementById('notifDrawer');
    if (drawer && !drawer.contains(e.target) && e.target !== notifBtn) {
      drawer.style.display = 'none';
    }
  });

  // Finance Banner Actions
  safeListen('financeBannerActionBtn', 'click', () => {
    window.switchTab('tab-finance');
    const banner = document.getElementById('financeAlertBanner');
    if (banner) banner.style.display = 'none';
  });
  safeListen('financeBannerDismissBtn', 'click', () => {
    const banner = document.getElementById('financeAlertBanner');
    if (banner) banner.style.display = 'none';
  });

  // Finance Dispatch Form
  safeListen('financeDispatchForm', 'submit', handleSendFinanceMessage);
  safeListen('tplBonusBtn', 'click', () => applyFinanceTemplate('bonus'));
  safeListen('tplSlipBtn', 'click', () => applyFinanceTemplate('slip'));
  safeListen('tplReimburseBtn', 'click', () => applyFinanceTemplate('reimburse'));
  safeListen('financeStaffSearchInput', 'input', renderFinanceStaffRoster);
  safeListen('refreshFinanceLogBtn', 'click', loadFinanceTab);

  // Modals
  safeListen('closeModalBtn', 'click', () => {
    const modal = document.getElementById('screenshotModal');
    if (modal) modal.classList.remove('active');
  });
  const ssModal = document.getElementById('screenshotModal');
  if (ssModal) {
    ssModal.addEventListener('click', (e) => {
      if (e.target.id === 'screenshotModal') ssModal.classList.remove('active');
    });
  }

  safeListen('closeFinanceModalBtn', 'click', () => {
    const finModal = document.getElementById('financeDetailModal');
    if (finModal) finModal.classList.remove('active');
  });
  const finModal = document.getElementById('financeDetailModal');
  if (finModal) {
    finModal.addEventListener('click', (e) => {
      if (e.target.id === 'financeDetailModal') finModal.classList.remove('active');
    });
  }
}

async function ensureAuthenticated() {
  if (!state.token) {
    await loginAs('admin');
  }
}

function authHeaders() {
  const headers = { 'Content-Type': 'application/json' };
  if (state.token) {
    headers['Authorization'] = `Bearer ${state.token}`;
  }
  return headers;
}

async function fetchEmployees() {
  try {
    const res = await fetch(`${API_BASE}/employees`, { headers: authHeaders() });
    if (res.ok) {
      state.employees = await res.json();
      populateEmployeeDropdowns();
    }
  } catch (err) {
    console.error('Failed to fetch employees:', err);
  }
}

function populateEmployeeDropdowns() {
  const select = document.getElementById('heatmapEmpSelect');
  const ssSelect = document.getElementById('ssEmpSelect');

  if (select) {
    select.innerHTML = '';
    state.employees.forEach(emp => {
      const opt = document.createElement('option');
      opt.value = emp.id;
      opt.textContent = `${emp.name} (${emp.employee_code})`;
      select.appendChild(opt);
    });
    if (state.employees.length > 0) {
      state.selectedEmpId = state.employees[0].id;
    }
  }

  if (ssSelect) {
    ssSelect.innerHTML = '<option value="">All Employees</option>';
    state.employees.forEach(emp => {
      const opt = document.createElement('option');
      opt.value = emp.id;
      opt.textContent = `${emp.name} (${emp.employee_code})`;
      ssSelect.appendChild(opt);
    });
  }
}

function refreshAll() {
  switchTab(state.activeTab);
}

// 1. Overview Tab Data
// Employees Directory
async function loadEmployeesDirectory() {
  await ensureAuthenticated();
  try {
    const res = await fetch(`${API_BASE}/employees`, { headers: authHeaders() });
    if (!res.ok) return;
    const allEmps = await res.json();
    state.employees = allEmps;

    // Fetch departments for clean labeling
    const deptRes = await fetch(`${API_BASE}/departments`, { headers: authHeaders() });
    let deptMap = {};
    if (deptRes.ok) {
      const depts = await deptRes.json();
      depts.forEach(d => { deptMap[d.id] = d.name; });
    }

    const searchVal = (document.getElementById('employeeSearchInput')?.value || '').toLowerCase().trim();
    const roleVal = document.getElementById('empRoleFilter')?.value || '';

    const filtered = allEmps.filter(e => {
      const matchesSearch = !searchVal || 
        e.name.toLowerCase().includes(searchVal) ||
        e.employee_code.toLowerCase().includes(searchVal) ||
        e.email.toLowerCase().includes(searchVal);
      const matchesRole = !roleVal || e.role === roleVal;
      return matchesSearch && matchesRole;
    });

    const badge = document.getElementById('employeeCountBadge');
    if (badge) badge.textContent = `${filtered.length} of ${allEmps.length} Members`;

    const tbody = document.getElementById('employeesTbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (filtered.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--text-dim); padding: 30px;">No matching employees found.</td></tr>`;
      return;
    }

    filtered.forEach(emp => {
      const tr = document.createElement('tr');
      const deptName = deptMap[emp.department_id] || 'General';
      const roleClass = emp.role.toLowerCase();
      const statusClass = emp.status.toLowerCase();

      tr.innerHTML = `
        <td><code style="color: var(--accent-cyan); font-weight: 700;">${emp.employee_code}</code></td>
        <td style="font-weight: 600;">
          <div style="display: flex; align-items: center; gap: 10px;">
            <div style="width: 28px; height: 28px; border-radius: 50%; background: linear-gradient(135deg, var(--accent-primary), var(--accent-violet)); color: #fff; display: flex; align-items: center; justify-content: center; font-size: 0.75rem; font-weight: 700;">
              ${emp.name.split(' ').map(n=>n[0]).join('').slice(0,2)}
            </div>
            <span>${emp.name}</span>
          </div>
        </td>
        <td><span class="role-pill ${roleClass}">${emp.role}</span></td>
        <td style="color: var(--text-muted);">${emp.email}</td>
        <td><span class="badge ${statusClass}">${emp.status}</span></td>
        <td>${deptName}</td>
        <td>
          <button class="btn btn-secondary btn-sm" onclick="viewEmployeeHeatmap('${emp.id}')" style="padding: 3px 8px; font-size: 0.72rem;">
            Heatmap
          </button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    console.error('Error loading employees directory:', err);
  }
}

window.viewEmployeeHeatmap = function(empId) {
  state.selectedEmpId = empId;
  const select = document.getElementById('heatmapEmpSelect');
  if (select) select.value = empId;
  switchTab('tab-activity');
};

async function loadOverviewData() {
  await ensureAuthenticated();
  try {
    // Load KPI metrics
    const res = await fetch(`${API_BASE}/dashboard/metrics`, { headers: authHeaders() });
    if (res.ok) {
      const data = await res.json();
      document.getElementById('kpiTotalEmp').textContent = data.total_employees;
      document.getElementById('kpiPresent').textContent = data.present_today;
      document.getElementById('kpiLate').textContent = data.late_today;
      document.getElementById('kpiOffline').textContent = data.offline_today;
      document.getElementById('kpiStars').textContent = data.total_stars_awarded;
    }

    // Load Quick Attendance Summary
    const attRes = await fetch(`${API_BASE}/attendance/summary`, { headers: authHeaders() });
    if (attRes.ok) {
      const list = await attRes.json();
      const tbody = document.getElementById('overviewAttendanceTbody');
      tbody.innerHTML = '';
      if (list.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color: var(--text-dim);">No attendance recorded yet today.</td></tr>`;
        return;
      }
      list.forEach(row => {
        const tr = document.createElement('tr');
        const firstActive = row.first_activity ? new Date(row.first_activity).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-';
        tr.innerHTML = `
          <td><code>${row.employee_code}</code></td>
          <td style="font-weight: 600;">${row.employee_name}</td>
          <td>${row.department_name || 'General'}</td>
          <td>${firstActive}</td>
          <td>${row.active_hours} hrs</td>
          <td><span class="badge ${row.status.toLowerCase()}">${row.status}</span></td>
        `;
        tbody.appendChild(tr);
      });
    }
  } catch (err) {
    console.error('Error loading overview:', err);
  }
}

// 2. Attendance Roll Call Tab
async function loadAttendanceRollCall() {
  await ensureAuthenticated();
  const dateInput = document.getElementById('attDateFilter').value;
  let url = `${API_BASE}/attendance/summary`;
  if (dateInput) url += `?target_date=${dateInput}`;

  try {
    const res = await fetch(url, { headers: authHeaders() });
    if (res.ok) {
      const records = await res.json();
      const tbody = document.getElementById('fullAttendanceTbody');
      tbody.innerHTML = '';
      if (records.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; color: var(--text-dim);">No roll call records found.</td></tr>`;
        return;
      }
      records.forEach(r => {
        const firstAct = r.first_activity ? new Date(r.first_activity).toLocaleTimeString() : '-';
        const lastAct = r.last_activity ? new Date(r.last_activity).toLocaleTimeString() : '-';
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td style="font-weight: 600;">${r.employee_name} (${r.employee_code})</td>
          <td>${r.department_name || 'General'}</td>
          <td>${r.work_date}</td>
          <td>${firstAct}</td>
          <td>${lastAct}</td>
          <td>${r.active_hours}h</td>
          <td>${r.idle_hours}h</td>
          <td><span class="badge ${r.status.toLowerCase()}">${r.status}</span></td>
        `;
        tbody.appendChild(tr);
      });
    }
  } catch (err) {
    console.error('Error loading full attendance:', err);
  }
}

// 3. Activity & Heatmap Tab
async function loadActivityTab() {
  await ensureAuthenticated();
  const select = document.getElementById('heatmapEmpSelect');
  if (select && select.value) {
    state.selectedEmpId = select.value;
  }
  await renderHeatmapForSelected();
}

async function renderHeatmapForSelected() {
  const empId = document.getElementById('heatmapEmpSelect').value || state.selectedEmpId;
  if (!empId) return;

  try {
    // 1. Fetch Stats
    const statsRes = await fetch(`${API_BASE}/activity/stats?employee_id=${empId}`, { headers: authHeaders() });
    if (statsRes.ok) {
      const stats = await statsRes.json();
      document.getElementById('statKeys').textContent = stats.total_key_presses.toLocaleString();
      document.getElementById('statClicks').textContent = stats.total_mouse_clicks.toLocaleString();
      document.getElementById('statMoves').textContent = stats.total_mouse_moves.toLocaleString();
      const mins = Math.round(stats.total_active_seconds / 60);
      document.getElementById('statActive').textContent = `${mins}m`;
    }

    // 2. Fetch Heatmap
    const hmRes = await fetch(`${API_BASE}/activity/heatmap?employee_id=${empId}`, { headers: authHeaders() });
    if (hmRes.ok) {
      const hmData = await hmRes.json();
      drawHeatmapCanvas(hmData.composite_matrix || {}, hmData.grid_cols || 20, hmData.grid_rows || 12);
    }
  } catch (err) {
    console.error('Error rendering heatmap:', err);
  }
}

function drawHeatmapCanvas(matrix, cols = 20, rows = 12) {
  const canvas = document.getElementById('heatmapCanvas');
  const ctx = canvas.getContext('2d');
  const width = canvas.width;
  const height = canvas.height;

  ctx.clearRect(0, 0, width, height);

  const isLight = document.documentElement.getAttribute('data-theme') === 'light';

  // Background desktop mockup grid
  ctx.fillStyle = isLight ? '#f8fafc' : '#090c15';
  ctx.fillRect(0, 0, width, height);

  const cellW = width / cols;
  const cellH = height / rows;

  // Find max count for normalization
  let maxCount = 1;
  Object.values(matrix).forEach(c => {
    if (c > maxCount) maxCount = c;
  });

  // Render 20x12 Cells
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const key = `${r},${c}`;
      const count = matrix[key] || 0;
      const x = c * cellW;
      const y = r * cellH;

      if (count > 0) {
        const ratio = count / maxCount;
        ctx.fillStyle = getThermalColor(ratio);
        ctx.fillRect(x + 1, y + 1, cellW - 2, cellH - 2);

        // Text count
        if (cellW > 25 && cellH > 20) {
          ctx.fillStyle = ratio > 0.6 ? '#ffffff' : (isLight ? '#334155' : '#94a3b8');
          ctx.font = '10px Inter, sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(count.toString(), x + cellW / 2, y + cellH / 2);
        }
      } else {
        ctx.strokeStyle = isLight ? 'rgba(0, 0, 0, 0.06)' : 'rgba(255, 255, 255, 0.04)';
        ctx.strokeRect(x, y, cellW, cellH);
      }
    }
  }
}

function getThermalColor(ratio) {
  if (ratio < 0.25) return `rgba(2, 132, 199, ${0.3 + ratio * 1.5})`;
  if (ratio < 0.5) return `rgba(16, 185, 129, ${0.4 + ratio * 1.2})`;
  if (ratio < 0.75) return `rgba(245, 158, 11, ${0.5 + ratio})`;
  return `rgba(239, 68, 68, ${0.6 + ratio * 0.4})`;
}

// 4. Screenshots Gallery Tab
async function loadScreenshotsGallery() {
  await ensureAuthenticated();
  try {
    const empId = document.getElementById('ssEmpSelect')?.value || '';
    let url = `${API_BASE}/screenshots?page=1&limit=48`;
    if (empId) url += `&employee_id=${encodeURIComponent(empId)}`;

    const res = await fetch(url, { headers: authHeaders() });
    if (res.ok) {
      const data = await res.json();
      const grid = document.getElementById('screenshotsGalleryGrid');
      grid.innerHTML = '';
      if (!data.items || data.items.length === 0) {
        grid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: var(--text-dim); padding: 40px;">No screenshots found for this employee. Click "Capture Screenshot" on top to test.</div>`;
        return;
      }
      data.items.forEach(ss => {
        const card = document.createElement('div');
        card.className = 'gallery-card';
        card.setAttribute('data-id', ss.id);
        const d = new Date(ss.captured_at);
        const timeFormatted = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const dateFormatted = d.toLocaleDateString([], { month: 'short', day: 'numeric' });
        card.innerHTML = `
          <div class="thumbnail-box" style="position: relative;">
            <img src="${ss.image_url}" alt="Screenshot" loading="lazy">
            <span style="position: absolute; bottom: 8px; right: 8px; background: rgba(0,0,0,0.75); color: #fff; font-size: 0.7rem; font-weight: 600; padding: 2px 7px; border-radius: 4px; backdrop-filter: blur(4px);">${timeFormatted}</span>
            <button class="card-delete-btn" title="Delete this screenshot" style="position: absolute; top: 8px; right: 8px; background: rgba(239, 68, 68, 0.85); color: #fff; border: none; border-radius: 4px; padding: 3px 6px; cursor: pointer; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(4px); transition: all 0.15s ease;">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            </button>
          </div>
          <div class="gallery-info">
            <div class="gallery-emp">${ss.employee_name || 'Employee'}</div>
            <div class="gallery-time">${dateFormatted} &bull; ${timeFormatted} &bull; ${Math.round(ss.file_size_bytes / 1024)} KB</div>
          </div>
        `;

        card.querySelector('.card-delete-btn').addEventListener('click', async (e) => {
          e.stopPropagation();
          if (confirm(`Delete screenshot for ${ss.employee_name}?`)) {
            await deleteSingleScreenshot(ss.id);
          }
        });

        card.addEventListener('click', () => {
          openScreenshotModal(ss.image_url, `${ss.employee_name} — ${dateFormatted} ${timeFormatted}`, ss.id);
        });
        grid.appendChild(card);
      });
    }
  } catch (err) {
    console.error('Error loading screenshots:', err);
  }
}

function openScreenshotModal(imgUrl, title, screenshotId) {
  state.activeScreenshotId = screenshotId;
  const modal = document.getElementById('screenshotModal');
  document.getElementById('modalImage').src = imgUrl;
  document.getElementById('modalTitle').textContent = title;
  modal.classList.add('active');
}

async function handleDeleteScreenshots() {
  const empSelect = document.getElementById('ssEmpSelect');
  const empId = empSelect?.value || '';
  const selectedText = empSelect && empSelect.selectedIndex >= 0 ? empSelect.options[empSelect.selectedIndex].text : 'All Employees';

  const confirmMsg = empId
    ? `Are you sure you want to delete all screenshots for "${selectedText}"? This action cannot be undone.`
    : `Are you sure you want to delete ALL screenshots across all employees? This action cannot be undone.`;

  if (!confirm(confirmMsg)) return;

  try {
    const btn = document.getElementById('deleteScreenshotsBtn');
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Deleting...';
    }

    let url = `${API_BASE}/screenshots`;
    if (empId) {
      url += `?employee_id=${encodeURIComponent(empId)}`;
    }

    const res = await fetch(url, {
      method: 'DELETE',
      headers: authHeaders()
    });

    if (btn) {
      btn.disabled = false;
      btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg> Delete Screenshots`;
    }

    if (res.ok) {
      const data = await res.json();
      alert(data.message || 'Screenshots deleted successfully.');
      await loadScreenshotsGallery();
    } else {
      const err = await res.json().catch(() => ({}));
      alert(`Failed to delete screenshots: ${err.detail || 'Server error'}`);
    }
  } catch (err) {
    console.error('Error deleting screenshots:', err);
    alert('Network error while deleting screenshots.');
  }
}

async function handleDeleteActiveScreenshot() {
  if (!state.activeScreenshotId) return;
  if (!confirm('Are you sure you want to delete this screenshot?')) return;
  await deleteSingleScreenshot(state.activeScreenshotId);
  document.getElementById('screenshotModal')?.classList.remove('active');
}

async function deleteSingleScreenshot(screenshotId) {
  try {
    const res = await fetch(`${API_BASE}/screenshots/${screenshotId}`, {
      method: 'DELETE',
      headers: authHeaders()
    });
    if (res.ok) {
      await loadScreenshotsGallery();
    } else {
      const err = await res.json().catch(() => ({}));
      alert(`Failed to delete screenshot: ${err.detail || 'Server error'}`);
    }
  } catch (err) {
    console.error('Error deleting screenshot:', err);
  }
}

// 5. Rules & Stars Tab
async function loadRulesAndStars() {
  await ensureAuthenticated();
  try {
    const rulesRes = await fetch(`${API_BASE}/rules`, { headers: authHeaders() });
    if (rulesRes.ok) {
      const rules = await rulesRes.json();
      const container = document.getElementById('rulesListContainer');
      container.innerHTML = '';

      const attRule = rules.find(r => r.rule_type === 'ATTENDANCE') || rules[0];
      const starRule = rules.find(r => r.rule_type === 'STAR');

      if (attRule) {
        state.activeAttendanceRuleId = attRule.id;
        const p = attRule.config_payload || {};
        const shiftStartInput = document.getElementById('ruleShiftStart');
        const shiftEndInput = document.getElementById('ruleShiftEnd');
        const graceInput = document.getElementById('ruleGraceMinutes');
        const minActiveInput = document.getElementById('ruleMinActiveHours');
        const halfDayInput = document.getElementById('ruleHalfDayHours');

        if (shiftStartInput) shiftStartInput.value = p.shift_start || '09:00:00';
        if (shiftEndInput) shiftEndInput.value = p.shift_end || '18:00:00';
        if (graceInput) graceInput.value = p.grace_period_minutes !== undefined ? p.grace_period_minutes : 15;
        if (minActiveInput) minActiveInput.value = p.minimum_active_hours_full_day || 7.0;
        if (halfDayInput) halfDayInput.value = p.half_day_hours || 4.0;
      }

      if (starRule) {
        state.activeStarRuleId = starRule.id;
        const sp = starRule.config_payload || {};
        const starHours = (sp.min_active_seconds_for_star || 21600) / 3600;
        const starInput = document.getElementById('ruleStarActiveHours');
        if (starInput) starInput.value = starHours;
      }

      const badge = document.getElementById('rulesCountBadge');
      if (badge) badge.textContent = `${rules.length} Policies`;

      rules.forEach(r => {
        const card = document.createElement('div');
        card.className = `policy-card ${r.is_active ? 'active' : 'inactive'}`;
        card.id = `policy-card-${r.id}`;

        const typeColor = r.rule_type === 'ATTENDANCE' ? 'employee' : (r.rule_type === 'STAR' ? 'manager' : 'admin');
        const descText = r.description ? `<div class="policy-desc">${r.description}</div>` : '';

        // Formatted parameters preview
        const payloadKeys = Object.keys(r.config_payload || {});
        let paramsHtml = '';
        if (payloadKeys.length > 0) {
          paramsHtml = `<div style="display: flex; flex-wrap: wrap; gap: 6px; margin: 8px 0;">`;
          payloadKeys.forEach(k => {
            const val = typeof r.config_payload[k] === 'object' ? JSON.stringify(r.config_payload[k]) : r.config_payload[k];
            paramsHtml += `<span style="font-size: 0.72rem; padding: 2px 7px; background: rgba(255,255,255,0.05); border-radius: 4px; border: 1px solid var(--border-subtle); color: var(--text-muted); font-family: monospace;">${k}: <strong style="color: var(--text-main);">${val}</strong></span>`;
          });
          paramsHtml += `</div>`;
        }

        card.innerHTML = `
          <div class="policy-header">
            <div style="flex: 1;">
              <div class="policy-title">
                ${r.name}
                <span class="role-pill ${typeColor}" style="font-size: 0.65rem;">${r.rule_type}</span>
              </div>
              ${descText}
            </div>
          </div>
          ${paramsHtml}
          <div class="policy-actions">
            <!-- Active / Inactive Toggle Switch -->
            <label class="switch-label" title="Click to toggle active/inactive status">
              <input type="checkbox" class="switch-input policy-toggle-input" data-id="${r.id}" ${r.is_active ? 'checked' : ''}>
              <span class="toggle-switch"></span>
              <span class="policy-status-text" style="color: ${r.is_active ? 'var(--accent-emerald)' : 'var(--text-dim)'};">${r.is_active ? 'Active' : 'Inactive'}</span>
            </label>
            
            <div style="display: flex; gap: 8px; align-items: center;">
              <span id="sync-indicator-${r.id}" style="font-size: 0.7rem; color: var(--accent-emerald); display: none; font-weight: 600;">Saved!</span>
              <button class="btn btn-danger btn-sm delete-rule-btn" data-id="${r.id}" data-name="${r.name}" style="padding: 3px 9px; font-size: 0.72rem;">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                Delete
              </button>
            </div>
          </div>
        `;
        container.appendChild(card);
      });

      // Attach Toggle Listeners
      container.querySelectorAll('.policy-toggle-input').forEach(input => {
        input.addEventListener('change', async (e) => {
          const ruleId = e.target.getAttribute('data-id');
          const newStatus = e.target.checked;
          await handleToggleRuleStatus(ruleId, newStatus);
        });
      });

      // Attach Delete Listeners
      container.querySelectorAll('.delete-rule-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
          const ruleId = btn.getAttribute('data-id');
          const ruleName = btn.getAttribute('data-name');
          await handleDeleteRule(ruleId, ruleName);
        });
      });
    }
  } catch (err) {
    console.error('Error loading rules & stars:', err);
  }
}

async function handleToggleRuleStatus(ruleId, newStatus) {
  try {
    const res = await fetch(`${API_BASE}/rules/${ruleId}`, {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify({ is_active: newStatus })
    });
    if (res.ok) {
      const card = document.getElementById(`policy-card-${ruleId}`);
      if (card) {
        card.classList.toggle('active', newStatus);
        card.classList.toggle('inactive', !newStatus);
        const statusText = card.querySelector('.policy-status-text');
        if (statusText) {
          statusText.textContent = newStatus ? 'Active' : 'Inactive';
          statusText.style.color = newStatus ? 'var(--accent-emerald)' : 'var(--text-dim)';
        }
        const syncInd = document.getElementById(`sync-indicator-${ruleId}`);
        if (syncInd) {
          syncInd.style.display = 'inline';
          setTimeout(() => { syncInd.style.display = 'none'; }, 2000);
        }
      }
    } else {
      alert('Failed to update rule status on server.');
      await loadRulesAndStars();
    }
  } catch (err) {
    console.error('Error toggling rule status:', err);
    alert('Network error updating rule status.');
    await loadRulesAndStars();
  }
}

async function handleDeleteRule(ruleId, ruleName) {
  if (!confirm(`Are you sure you want to delete policy rule "${ruleName}"? This action cannot be undone.`)) {
    return;
  }
  try {
    const res = await fetch(`${API_BASE}/rules/${ruleId}`, {
      method: 'DELETE',
      headers: authHeaders()
    });
    if (res.ok) {
      const card = document.getElementById(`policy-card-${ruleId}`);
      if (card) {
        card.style.opacity = '0';
        card.style.transform = 'scale(0.95)';
        setTimeout(() => { card.remove(); }, 200);
      }
      await loadRulesAndStars();
    } else {
      alert('Failed to delete rule from server.');
    }
  } catch (err) {
    console.error('Error deleting rule:', err);
    alert('Network error deleting rule.');
  }
}

async function handleCreateCustomRule(e) {
  e.preventDefault();
  const name = document.getElementById('newRuleTitle').value.trim();
  const description = document.getElementById('newRuleDesc').value.trim();
  const ruleType = document.getElementById('newRuleType').value;
  const isActive = document.getElementById('newRuleActive').checked;
  const payloadStr = document.getElementById('newRulePayload').value.trim();

  let configPayload = {};
  if (payloadStr) {
    try {
      configPayload = JSON.parse(payloadStr);
    } catch (parseErr) {
      alert('Invalid JSON in Configuration Parameters. Please provide valid JSON, e.g. {"threshold": 10}');
      return;
    }
  }

  try {
    const res = await fetch(`${API_BASE}/rules`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        name,
        description,
        rule_type: ruleType,
        is_active: isActive,
        config_payload: configPayload
      })
    });

    if (res.ok) {
      const fb = document.getElementById('customRuleSaveFeedback');
      if (fb) {
        fb.style.display = 'inline';
        setTimeout(() => { fb.style.display = 'none'; }, 3000);
      }
      document.getElementById('customRuleCreateForm').reset();
      document.getElementById('newRuleActive').checked = true;
      document.getElementById('newRuleActiveText').textContent = 'Enabled (Active)';
      await loadRulesAndStars();
    } else {
      const errData = await res.json().catch(() => ({}));
      alert(`Failed to create rule: ${errData.detail || 'Server error'}`);
    }
  } catch (err) {
    console.error('Error creating custom rule:', err);
    alert('Network error creating rule.');
  }
}

async function handleSaveRules(e) {
  e.preventDefault();
  if (!state.activeAttendanceRuleId) {
    alert('No attendance rule loaded to update.');
    return;
  }

  const shiftStart = document.getElementById('ruleShiftStart').value;
  const shiftEnd = document.getElementById('ruleShiftEnd').value;
  const graceMinutes = parseInt(document.getElementById('ruleGraceMinutes').value, 10);
  const minActive = parseFloat(document.getElementById('ruleMinActiveHours').value);
  const halfDay = parseFloat(document.getElementById('ruleHalfDayHours').value);
  const starHours = parseFloat(document.getElementById('ruleStarActiveHours').value);

  const attPayload = {
    shift_start: shiftStart.length === 5 ? `${shiftStart}:00` : shiftStart,
    shift_end: shiftEnd.length === 5 ? `${shiftEnd}:00` : shiftEnd,
    grace_period_minutes: graceMinutes,
    minimum_active_hours_full_day: minActive,
    half_day_hours: halfDay,
  };

  try {
    const resAtt = await fetch(`${API_BASE}/rules/${state.activeAttendanceRuleId}`, {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify({ config_payload: attPayload })
    });

    if (state.activeStarRuleId) {
      await fetch(`${API_BASE}/rules/${state.activeStarRuleId}`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify({
          config_payload: { min_active_seconds_for_star: Math.round(starHours * 3600) }
        })
      });
    }

    if (resAtt.ok) {
      const fb = document.getElementById('rulesSaveFeedback');
      if (fb) {
        fb.style.display = 'inline';
        setTimeout(() => { fb.style.display = 'none'; }, 3500);
      }
      await loadRulesAndStars();
    } else {
      alert('Failed to save rules. Please ensure you are logged in as Admin or Manager.');
    }
  } catch (err) {
    console.error('Failed to save rules:', err);
    alert('Network error saving rules.');
  }
}

async function evaluateStarsNow() {
  if (state.employees.length === 0) return;
  const empId = state.selectedEmpId || state.employees[0].id;
  try {
    const res = await fetch(`${API_BASE}/rules/evaluate-stars/${empId}`, {
      method: 'POST',
      headers: authHeaders()
    });
    if (res.ok) {
      alert('Stars evaluated successfully!');
      loadRulesAndStars();
      loadOverviewData();
    }
  } catch (err) {
    console.error('Error evaluating stars:', err);
  }
}

async function purgeRetentionNow() {
  try {
    const res = await fetch(`${API_BASE}/screenshots/retention/purge`, {
      method: 'POST',
      headers: authHeaders()
    });
    if (res.ok) {
      const data = await res.json();
      alert(`Purged ${data.purged_screenshots} expired screenshots.`);
      loadScreenshotsGallery();
    }
  } catch (err) {
    console.error('Error purging retention:', err);
  }
}



// ============================================
// Notification Center Controller
// ============================================
async function checkNotifications() {
  if (!state.token) return;
  try {
    const res = await fetch(`${API_BASE}/finance/notifications`, { headers: authHeaders() });
    if (!res.ok) return;
    const notifs = await res.json();
    const unread = notifs.filter(n => !n.is_read);

    const badge = document.getElementById('notifCountBadge');
    if (badge) {
      if (unread.length > 0) {
        badge.textContent = unread.length;
        badge.style.display = 'inline-block';
      } else {
        badge.style.display = 'none';
      }
    }

    // Render Drawer items
    const listContainer = document.getElementById('notifListContainer');
    if (listContainer) {
      listContainer.innerHTML = '';
      if (notifs.length === 0) {
        listContainer.innerHTML = `<div style="padding: 20px; text-align: center; color: var(--text-dim); font-size: 0.8rem;">No notifications at this time.</div>`;
      } else {
        notifs.forEach(n => {
          const item = document.createElement('div');
          item.className = `notif-item ${n.is_read ? '' : 'unread'}`;
          const dt = new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          const dateStr = new Date(n.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' });
          item.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 3px;">
              <div style="font-weight: 600; font-size: 0.8rem; color: var(--text-main);">${n.title}</div>
              <span style="font-size: 0.68rem; color: var(--text-dim); white-space: nowrap; margin-left: 8px;">${dateStr} ${dt}</span>
            </div>
            <div style="font-size: 0.74rem; color: var(--text-muted); line-height: 1.4;">${n.body}</div>
          `;
          item.addEventListener('click', async () => {
            if (!n.is_read) {
              await fetch(`${API_BASE}/finance/notifications/${n.id}/read`, {
                method: 'PUT',
                headers: authHeaders()
              });
              checkNotifications();
            }
            switchTab('tab-finance');
            document.getElementById('notifDrawer').style.display = 'none';
          });
          listContainer.appendChild(item);
        });
      }
    }

    // Dynamic Top Banner (For Employee & Manager if unread notices exist)
    const alertBanner = document.getElementById('financeAlertBanner');
    if (alertBanner) {
      if (unread.length > 0 && state.currentUser && state.currentUser.role !== 'ADMIN') {
        const latest = unread[0];
        document.getElementById('financeBannerTitle').textContent = latest.title;
        document.getElementById('financeBannerText').textContent = latest.body;
        alertBanner.style.display = 'flex';
      } else {
        alertBanner.style.display = 'none';
      }
    }
  } catch (err) {
    console.error('Error fetching notifications:', err);
  }
}

function toggleNotifDrawer() {
  const drawer = document.getElementById('notifDrawer');
  if (!drawer) return;
  drawer.style.display = drawer.style.display === 'none' ? 'block' : 'none';
}

async function markAllNotificationsRead() {
  try {
    const res = await fetch(`${API_BASE}/finance/notifications/read-all`, {
      method: 'POST',
      headers: authHeaders()
    });
    if (res.ok) {
      await checkNotifications();
    }
  } catch (err) {
    console.error('Error marking all notifications read:', err);
  }
}

// ============================================
// Finance Tab Controller (Admin Controlled)
// ============================================
let allFinanceMessages = [];

async function loadFinanceTab() {
  await ensureAuthenticated();
  if (!state.currentUser) {
    await loginAs('admin');
  }
  const isAdmin = state.currentUser ? state.currentUser.role === 'ADMIN' : true;

  // Toggle View Workspaces
  const adminWs = document.getElementById('financeAdminWorkspace');
  const nonAdminWs = document.getElementById('financeNonAdminWorkspace');
  const rolePill = document.getElementById('financeRoleNoticePill');

  if (rolePill) {
    rolePill.textContent = isAdmin ? 'ADMIN SECURE' : `${state.currentUser.role} INBOX`;
    rolePill.className = `role-pill ${state.currentUser.role.toLowerCase()}`;
  }

  if (isAdmin) {
    if (adminWs) adminWs.style.display = 'block';
    if (nonAdminWs) nonAdminWs.style.display = 'none';

    // 1. Fetch Summary KPI
    try {
      const sumRes = await fetch(`${API_BASE}/finance/summary`, { headers: authHeaders() });
      if (sumRes.ok) {
        const sum = await sumRes.json();
        document.getElementById('kpiFinanceTotalDisbursed').textContent = `$${sum.total_amount_disbursed.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
        document.getElementById('kpiFinanceDirectNotices').textContent = sum.direct_notices;
        document.getElementById('kpiFinanceBroadcasts').textContent = sum.broadcast_notices;
        document.getElementById('kpiFinanceTotalStaff').textContent = sum.total_employees;
        const totalBadge = document.getElementById('financeTotalNoticesBadge');
        if (totalBadge) totalBadge.textContent = `${sum.total_messages} Notices`;
      }
    } catch (e) {
      console.error('Failed to load finance summary:', e);
    }

    // 2. Populate Employee Select Dropdown
    populateFinanceRecipientSelect();

    // 3. Render Staff Compensation Directory
    renderFinanceStaffRoster();

    // 4. Render Dispatched Messages Audit Log
    await loadFinanceMessagesLog();
  } else {
    // Non-Admin: Employee / Manager
    if (adminWs) adminWs.style.display = 'none';
    if (nonAdminWs) nonAdminWs.style.display = 'block';

    const userNameEl = document.getElementById('nonAdminCurrentUserName');
    const roleLabelEl = document.getElementById('nonAdminCurrentRoleLabel');
    if (userNameEl) userNameEl.textContent = state.currentUser.name;
    if (roleLabelEl) {
      roleLabelEl.textContent = state.currentUser.role;
      roleLabelEl.className = `role-pill ${state.currentUser.role.toLowerCase()}`;
    }

    await loadNonAdminInbox();
  }
}

function populateFinanceRecipientSelect() {
  const sel = document.getElementById('financeRecipientSelect');
  if (!sel) return;
  const currentVal = sel.value;
  sel.innerHTML = `
    <option value="">-- Choose Employee to Message --</option>
    <option value="ALL">📢 All Staff (Company-Wide Broadcast)</option>
  `;
  state.employees.forEach(emp => {
    const opt = document.createElement('option');
    opt.value = emp.id;
    opt.textContent = `${emp.name} (${emp.employee_code} — ${emp.role})`;
    sel.appendChild(opt);
  });
  if (currentVal) sel.value = currentVal;
}

function renderFinanceStaffRoster() {
  const tbody = document.getElementById('financeStaffTbody');
  if (!tbody) return;

  const search = (document.getElementById('financeStaffSearchInput')?.value || '').toLowerCase().trim();
  const filtered = state.employees.filter(e => {
    return !search || e.name.toLowerCase().includes(search) || e.employee_code.toLowerCase().includes(search);
  });

  const badge = document.getElementById('financeStaffCountBadge');
  if (badge) badge.textContent = `${filtered.length} Members`;

  tbody.innerHTML = '';
  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="3" style="text-align: center; color: var(--text-dim); padding: 20px;">No employees found.</td></tr>`;
    return;
  }

  filtered.forEach(emp => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>
        <div style="display: flex; align-items: center; gap: 8px;">
          <div style="width: 24px; height: 24px; border-radius: 50%; background: linear-gradient(135deg, var(--accent-primary), var(--accent-cyan)); color: #fff; display: flex; align-items: center; justify-content: center; font-size: 0.65rem; font-weight: 700;">
            ${emp.name.split(' ').map(n=>n[0]).join('').slice(0,2)}
          </div>
          <div>
            <div style="font-weight: 600; color: var(--text-main); font-size: 0.78rem;">${emp.name}</div>
            <div style="font-size: 0.68rem; color: var(--accent-cyan); font-family: monospace;">${emp.employee_code}</div>
          </div>
        </div>
      </td>
      <td><span class="role-pill ${emp.role.toLowerCase()}" style="font-size: 0.65rem;">${emp.role}</span></td>
      <td>
        <button class="btn btn-secondary btn-sm" onclick="selectEmployeeForFinanceMessage('${emp.id}')" style="padding: 2px 7px; font-size: 0.7rem; display: flex; align-items: center; gap: 4px;">
          <span>💬</span> Message
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

window.selectEmployeeForFinanceMessage = function(empId) {
  const sel = document.getElementById('financeRecipientSelect');
  if (sel) {
    sel.value = empId;
    sel.scrollIntoView({ behavior: 'smooth', block: 'center' });
    document.getElementById('financeSubjectInput')?.focus();
  }
};

window.applyFinanceTemplate = function(type) {
  const subInput = document.getElementById('financeSubjectInput');
  const catSelect = document.getElementById('financeCategorySelect');
  const amtInput = document.getElementById('financeAmountInput');
  const msgInput = document.getElementById('financeMessageInput');

  if (type === 'bonus') {
    if (subInput) subInput.value = 'Q3 Performance Incentive Bonus Approved';
    if (catSelect) catSelect.value = 'BONUS';
    if (amtInput) amtInput.value = '500.00';
    if (msgInput) msgInput.value = 'Congratulations! In recognition of your outstanding productivity, reliable attendance, and commitment to project excellence, the company has awarded you an incentive bonus of $500.00. This amount has been credited to your direct deposit account.';
  } else if (type === 'slip') {
    const curMonth = new Date().toLocaleString('default', { month: 'long', year: 'numeric' });
    if (subInput) subInput.value = `Monthly Salary Slip & Compensation Notice — ${curMonth}`;
    if (catSelect) catSelect.value = 'SALARY';
    if (amtInput) amtInput.value = '';
    if (msgInput) msgInput.value = `Your monthly compensation summary and payroll voucher for ${curMonth} has been completed and processed. Direct deposit transfers have initiated. Please review your statements on the internal finance portal.`;
  } else if (type === 'reimburse') {
    if (subInput) subInput.value = 'Approved: Workstation Equipment Expense Reimbursement';
    if (catSelect) catSelect.value = 'REIMBURSEMENT';
    if (amtInput) amtInput.value = '175.50';
    if (msgInput) msgInput.value = 'Your submitted business expense claim and accompanying tax receipts have been verified by Finance and approved for payout. The reimbursement sum will reflect in your upcoming paycheck.';
  }
};

async function handleSendFinanceMessage(e) {
  e.preventDefault();
  const recipientId = document.getElementById('financeRecipientSelect').value;
  const subject = document.getElementById('financeSubjectInput').value.trim();
  const category = document.getElementById('financeCategorySelect').value;
  const amountStr = document.getElementById('financeAmountInput').value;
  const priority = document.getElementById('financePrioritySelect').value;
  const message = document.getElementById('financeMessageInput').value.trim();
  const notifyOthers = document.getElementById('financeNotifyOthersCheckbox').checked;

  if (!recipientId) {
    alert('Please select a recipient employee or choose All Staff.');
    return;
  }
  if (!subject || !message) {
    alert('Please provide a subject and message content.');
    return;
  }

  const payload = {
    recipient_id: recipientId === 'ALL' ? null : recipientId,
    subject,
    message,
    amount: amountStr ? parseFloat(amountStr) : null,
    message_type: category,
    priority,
    notify_others: notifyOthers
  };

  try {
    const btn = document.getElementById('financeSubmitBtn');
    btn.disabled = true;
    btn.innerHTML = '<span>⏳</span> Sending Notice...';

    const res = await fetch(`${API_BASE}/finance/messages`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(payload)
    });

    btn.disabled = false;
    btn.innerHTML = '<span>🚀</span> Send Message & Dispatch Notification';

    if (res.ok) {
      const fb = document.getElementById('financeSubmitFeedback');
      if (fb) {
        fb.style.display = 'inline';
        setTimeout(() => { fb.style.display = 'none'; }, 4000);
      }
      document.getElementById('financeDispatchForm').reset();
      document.getElementById('financeNotifyOthersCheckbox').checked = true;

      // Reload Finance Tab data & notifications
      await loadFinanceTab();
      await checkNotifications();
    } else {
      const err = await res.json().catch(() => ({}));
      alert(`Failed to send finance message: ${err.detail || 'Server error'}`);
    }
  } catch (err) {
    console.error('Error dispatching finance message:', err);
    alert('Network error while sending finance message.');
  }
}

async function loadFinanceMessagesLog() {
  const tbody = document.getElementById('financeMessagesTbody');
  if (!tbody) return;

  try {
    const res = await fetch(`${API_BASE}/finance/messages?limit=50`, { headers: authHeaders() });
    if (!res.ok) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--text-dim); padding: 20px;">Failed to load messages.</td></tr>`;
      return;
    }
    allFinanceMessages = await res.json();
    tbody.innerHTML = '';

    if (allFinanceMessages.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--text-dim); padding: 20px;">No finance messages dispatched yet. Use the form above to send your first message.</td></tr>`;
      return;
    }

    allFinanceMessages.forEach(m => {
      const tr = document.createElement('tr');
      const dt = new Date(m.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' });
      const amtText = m.amount !== null && m.amount !== undefined ? `<strong style="color: var(--accent-emerald);">$${m.amount.toFixed(2)}</strong>` : '<span style="color: var(--text-dim);">&mdash;</span>';

      const typePillClass = m.message_type === 'BONUS' ? 'present' : (m.message_type === 'REIMBURSEMENT' ? 'manager' : (m.message_type === 'DEDUCTION' ? 'late' : 'admin'));

      tr.innerHTML = `
        <td style="color: var(--text-dim); font-size: 0.75rem; white-space: nowrap;">${dt}</td>
        <td>
          <div style="font-weight: 600; color: var(--text-main);">${m.recipient_name}</div>
          <div style="font-size: 0.7rem; color: var(--text-dim);">${m.recipient_department}</div>
        </td>
        <td><span class="badge ${typePillClass}" style="font-size: 0.68rem;">${m.message_type}</span></td>
        <td>
          <div style="font-weight: 600; color: var(--text-main);">${m.subject}</div>
          <div style="font-size: 0.74rem; color: var(--text-muted); max-width: 320px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${m.message}</div>
        </td>
        <td>${amtText}</td>
        <td>
          <span class="badge present" style="font-size: 0.68rem; display: flex; align-items: center; gap: 4px; width: fit-content;">
            <span>✓</span> Delivered & Notified
          </span>
        </td>
        <td>
          <div style="display: flex; gap: 6px;">
            <button class="btn btn-secondary btn-sm" onclick="viewFinanceDetail('${m.id}')" style="padding: 2px 7px; font-size: 0.7rem;">View</button>
            <button class="btn btn-danger btn-sm" onclick="deleteFinanceMessage('${m.id}')" style="padding: 2px 7px; font-size: 0.7rem;">Delete</button>
          </div>
        </td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    console.error('Error loading finance log:', err);
  }
}

window.viewFinanceDetail = function(msgId) {
  const m = allFinanceMessages.find(item => item.id === msgId);
  if (!m) return;

  document.getElementById('financeModalSubject').textContent = m.subject;
  document.getElementById('financeModalRecipient').textContent = `${m.recipient_name} (${m.recipient_code || 'ALL'})`;
  const amtStr = m.amount ? `$${m.amount.toFixed(2)}` : 'Notice Only';
  document.getElementById('financeModalMeta').textContent = `${m.message_type} • ${amtStr}`;
  document.getElementById('financeModalBody').textContent = m.message;
  document.getElementById('financeModalDate').textContent = `Dispatched by ${m.sender_name} on ${new Date(m.created_at).toLocaleString()}`;

  document.getElementById('financeDetailModal').classList.add('active');
};

window.deleteFinanceMessage = async function(msgId) {
  if (!confirm('Are you sure you want to delete this finance message? Associated notifications will also be cleared.')) return;
  try {
    const res = await fetch(`${API_BASE}/finance/messages/${msgId}`, {
      method: 'DELETE',
      headers: authHeaders()
    });
    if (res.ok) {
      await loadFinanceTab();
      await checkNotifications();
    } else {
      alert('Failed to delete finance message.');
    }
  } catch (e) {
    console.error('Error deleting message:', e);
  }
};

async function loadNonAdminInbox() {
  const container = document.getElementById('nonAdminInboxContainer');
  if (!container) return;

  try {
    const res = await fetch(`${API_BASE}/finance/messages?limit=30`, { headers: authHeaders() });
    if (!res.ok) {
      container.innerHTML = `<div style="text-align: center; color: var(--text-dim); padding: 20px;">Could not load notices.</div>`;
      return;
    }
    const msgs = await res.json();
    allFinanceMessages = msgs;

    const badge = document.getElementById('nonAdminInboxBadge');
    if (badge) badge.textContent = `${msgs.length} Notices`;

    container.innerHTML = '';
    if (msgs.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; color: var(--text-dim); padding: 40px; background: rgba(255,255,255,0.02); border-radius: var(--radius-sm); border: 1px dashed var(--border-subtle);">
          <div style="font-size: 2rem; margin-bottom: 8px;">📬</div>
          <div style="font-weight: 600; color: var(--text-main);">No finance notices received yet.</div>
          <div style="font-size: 0.8rem; color: var(--text-dim); margin-top: 4px;">When administration sends you payroll slips, bonus approvals, or reimbursements, they will appear here.</div>
        </div>
      `;
      return;
    }

    msgs.forEach(m => {
      const card = document.createElement('div');
      card.className = 'inbox-card';
      const dt = new Date(m.created_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
      const amtBadge = m.amount ? `<span class="badge present" style="font-size: 0.75rem; font-weight: 700; padding: 3px 8px;">💵 $${m.amount.toFixed(2)}</span>` : '';
      const typeBadge = `<span class="role-pill ${m.message_type === 'BONUS' ? 'manager' : (m.message_type === 'SALARY' ? 'admin' : 'employee')}" style="font-size: 0.68rem;">${m.message_type}</span>`;

      card.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px; gap: 12px; flex-wrap: wrap;">
          <div>
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
              <h4 style="font-size: 0.95rem; font-weight: 700; color: var(--text-main);">${m.subject}</h4>
              ${typeBadge}
              ${amtBadge}
            </div>
            <div style="font-size: 0.75rem; color: var(--text-dim);">From: <strong>${m.sender_name}</strong> &bull; Dispatched ${dt}</div>
          </div>
          <span class="badge present" style="font-size: 0.68rem;">Delivered</span>
        </div>
        <div style="background: rgba(0,0,0,0.2); border: 1px solid var(--border-subtle); border-radius: var(--radius-sm); padding: 12px 14px; font-size: 0.84rem; color: var(--text-main); line-height: 1.6; white-space: pre-wrap; margin-top: 8px;">
          ${m.message}
        </div>
      `;
      container.appendChild(card);
    });
  } catch (err) {
    console.error('Error loading personal inbox:', err);
  }
}

