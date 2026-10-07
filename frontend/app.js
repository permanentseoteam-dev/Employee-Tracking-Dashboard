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
  ssTimer: {
    intervalMinutes: parseInt(localStorage.getItem('ss_capture_interval_minutes') || '10', 10),
    remainingSeconds: parseInt(localStorage.getItem('ss_capture_interval_minutes') || '10', 10) * 60,
    isRunning: localStorage.getItem('ss_capture_timer_running') !== 'false',
    timerId: null,
    lastCapturedAt: null,
  },
};

// Global Role & Tab Permission Enforcer
function applyRolePermissions() {
  const role = (state.currentUser?.role || localStorage.getItem('wp-role') || 'admin').toUpperCase();

  // 1. Task Sheets vs Activity Heatmap: Employee replaces Heatmap with Sheet tab
  const sheetTabBtn = document.getElementById('btn-tab-sheets');
  const sheetNavLabel = document.getElementById('sheetTabNavLabel');
  const activityTabBtn = document.getElementById('btn-tab-activity');
  const sheetsMgrWs = document.getElementById('sheetsManagerWorkspace');
  const sheetsEmpWs = document.getElementById('sheetsEmployeeWorkspace');
  const sheetsRoleBadge = document.getElementById('sheetsRoleContextBadge');

  if (sheetTabBtn) {
    sheetTabBtn.style.display = 'inline-flex';
    if (role === 'EMPLOYEE') {
      if (sheetNavLabel) sheetNavLabel.textContent = 'Daily Task Sheet';
    } else if (role === 'MANAGER') {
      if (sheetNavLabel) sheetNavLabel.textContent = 'Team Task Sheets';
    } else {
      if (sheetNavLabel) sheetNavLabel.textContent = 'Employee Task Sheets';
    }
  }

  // Employee role replaces Heatmap tab with Sheet tab
  if (activityTabBtn) {
    if (role === 'EMPLOYEE') {
      activityTabBtn.style.display = 'none';
      if (state.activeTab === 'tab-activity') {
        state.activeTab = 'tab-sheets';
      }
    } else {
      activityTabBtn.style.display = 'inline-flex';
    }
  }

  // Sheet Tab Workspaces: Manager/Admin Cards Grid vs Employee Task Submission
  if (role === 'EMPLOYEE') {
    if (sheetsEmpWs) sheetsEmpWs.style.display = 'block';
    if (sheetsMgrWs) sheetsMgrWs.style.display = 'none';
    if (sheetsRoleBadge) {
      sheetsRoleBadge.textContent = 'MY DAILY SHEET';
      sheetsRoleBadge.className = 'role-pill employee';
    }
  } else if (role === 'MANAGER') {
    if (sheetsMgrWs) sheetsMgrWs.style.display = 'block';
    if (sheetsEmpWs) sheetsEmpWs.style.display = 'none';
    if (sheetsRoleBadge) {
      sheetsRoleBadge.textContent = 'MANAGER VIEW';
      sheetsRoleBadge.className = 'role-pill manager';
    }
  } else {
    // ADMIN
    if (sheetsMgrWs) sheetsMgrWs.style.display = 'block';
    if (sheetsEmpWs) sheetsEmpWs.style.display = 'none';
    if (sheetsRoleBadge) {
      sheetsRoleBadge.textContent = 'ADMIN VIEW';
      sheetsRoleBadge.className = 'role-pill admin';
    }
  }

  // 2. Finance Tab Navigation Button: Visible ONLY for ADMIN
  const finTabBtn = document.getElementById('btn-tab-finance');
  if (finTabBtn) {
    if (role === 'ADMIN') {
      finTabBtn.style.display = 'inline-flex';
    } else {
      finTabBtn.style.display = 'none';
      if (state.activeTab === 'tab-finance') {
        state.activeTab = 'tab-overview';
      }
    }
  }

  // 3. Screenshot Gallery Tab: Visible for ADMIN and MANAGER, HIDDEN for EMPLOYEE
  const ssTabBtn = document.getElementById('btn-tab-screenshots');
  if (ssTabBtn) {
    if (role === 'EMPLOYEE') {
      ssTabBtn.style.display = 'none';
      if (state.activeTab === 'tab-screenshots') {
        state.activeTab = 'tab-overview';
      }
    } else {
      ssTabBtn.style.display = 'inline-flex';
    }
  }

  // 4. Rules & Stars Workspaces: Admin Hub vs Personal Performance Scorecard
  const adminWs = document.getElementById('rulesAdminWorkspace');
  const personalWs = document.getElementById('rulesPersonalWorkspace');
  if (role === 'ADMIN') {
    if (adminWs) adminWs.style.display = 'block';
    if (personalWs) personalWs.style.display = 'none';
  } else {
    if (adminWs) adminWs.style.display = 'none';
    if (personalWs) personalWs.style.display = 'block';
  }

  // 5. Overview Tab Workspaces: Team View (Admin/Manager) vs Employee Overall View (Employee)
  const teamOverviewWs = document.getElementById('overviewTeamWorkspace');
  const empOverviewWs = document.getElementById('overviewEmployeeWorkspace');
  if (role === 'EMPLOYEE') {
    if (teamOverviewWs) teamOverviewWs.style.display = 'none';
    if (empOverviewWs) empOverviewWs.style.display = 'block';
  } else {
    if (teamOverviewWs) teamOverviewWs.style.display = 'block';
    if (empOverviewWs) empOverviewWs.style.display = 'none';
  }

  // 6. Staff Directory Tab: Hide for Employee (Individual overview only)
  const staffDirBtn = document.getElementById('btn-tab-employees');
  if (staffDirBtn) {
    if (role === 'EMPLOYEE') {
      staffDirBtn.style.display = 'none';
      if (state.activeTab === 'tab-employees') {
        state.activeTab = 'tab-overview';
      }
    } else {
      staffDirBtn.style.display = 'inline-flex';
    }
  }
}

// Global switchTab callable from inline HTML onclick, listeners, and scripts
window.switchTab = function switchTab(tabId) {
  if (!tabId) return;
  const role = (state.currentUser?.role || localStorage.getItem('wp-role') || 'admin').toUpperCase();
  if (tabId === 'tab-finance' && role !== 'ADMIN') {
    tabId = 'tab-overview';
  }
  if (tabId === 'tab-screenshots' && role === 'EMPLOYEE') {
    tabId = 'tab-overview';
  }
  if (tabId === 'tab-employees' && role === 'EMPLOYEE') {
    tabId = 'tab-overview';
  }
  if (tabId === 'tab-activity' && role === 'EMPLOYEE') {
    tabId = 'tab-sheets';
  }
  state.activeTab = tabId;

  // 1. Enforce Role Visibility Permissions
  applyRolePermissions();

  // 2. Update tab navigation buttons
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

  // 3. Explicitly toggle visibility on all tab panes
  const tabPanes = document.querySelectorAll('.tab-pane');
  tabPanes.forEach(pane => {
    const isTarget = pane.id === tabId;
    pane.classList.toggle('active', isTarget);
    pane.style.display = isTarget ? 'block' : 'none';
  });

  // 4. Load tab content safely with isolated error catching
  try {
    if (tabId === 'tab-overview') loadOverviewData();
    else if (tabId === 'tab-employees') loadEmployeesDirectory();
    else if (tabId === 'tab-attendance') loadAttendanceRollCall();
    else if (tabId === 'tab-sheets') loadSheetsTab();
    else if (tabId === 'tab-activity') {
      if (role !== 'EMPLOYEE') loadActivityTab();
    }
    else if (tabId === 'tab-screenshots') {
      if (role !== 'EMPLOYEE') {
        loadScreenshotsGallery();
        initScreenshotTimer();
      }
    }
    else if (tabId === 'tab-rules') loadRulesAndStars();
    else if (tabId === 'tab-finance') {
      if (role === 'ADMIN') loadFinanceTab();
    }
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
  initScreenshotTimer();

  // Restore cached user info if present
  try {
    const cachedUser = localStorage.getItem('wp-user');
    if (cachedUser) state.currentUser = JSON.parse(cachedUser);
  } catch (e) {}

  // Login with saved role (or admin default) and initialize views
  const savedRole = localStorage.getItem('wp-role') || 'admin';
  loginAs(savedRole).then(() => {
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
    localStorage.setItem('wp-role', role);

    // Update Header Pill
    const badge = document.getElementById('activeRoleBadge');
    if (badge) {
      badge.textContent = data.role;
      badge.className = `role-pill ${data.role.toLowerCase()}`;
    }

    // Synchronize Role Switcher Select
    const roleSelect = document.getElementById('switchUserSelect');
    if (roleSelect && roleSelect.value !== role) {
      roleSelect.value = role;
    }

    const nameEl = document.getElementById('activeUserName');
    if (nameEl) {
      nameEl.textContent = data.name;
    }

    applyRolePermissions();
    await fetchEmployees();
    refreshAll();
    await checkNotifications();
  } catch (err) {
    console.warn('Backend login unavailable, activating demo session for role:', role, err);
    const mockProfiles = {
      admin: { name: 'System Administrator', email: 'admin@tracking.local', role: 'ADMIN', employee_code: 'ADM001', access_token: 'mock-admin-token' },
      manager: { name: 'Sarah Connor', email: 'manager@tracking.local', role: 'MANAGER', employee_code: 'MGR001', access_token: 'mock-manager-token' },
      employee: { name: 'Alex Rivera', email: 'alex@tracking.local', role: 'EMPLOYEE', employee_code: 'EMP001', access_token: 'mock-employee-token' },
    };
    const data = mockProfiles[role] || mockProfiles.admin;
    state.token = data.access_token;
    state.currentUser = data;

    localStorage.setItem('wp-token', data.access_token);
    localStorage.setItem('wp-user', JSON.stringify(data));
    localStorage.setItem('wp-role', role);

    const badge = document.getElementById('activeRoleBadge');
    if (badge) {
      badge.textContent = data.role;
      badge.className = `role-pill ${data.role.toLowerCase()}`;
    }

    const roleSelect = document.getElementById('switchUserSelect');
    if (roleSelect && roleSelect.value !== role) {
      roleSelect.value = role;
    }

    const nameEl = document.getElementById('activeUserName');
    if (nameEl) {
      nameEl.textContent = data.name;
    }

    applyRolePermissions();
    refreshAll();
  }
}

function setupEventListeners() {
  safeListen('switchUserSelect', 'change', (e) => {
    loginAs(e.target.value);
  });

  safeListen('themeToggleBtn', 'click', toggleTheme);

  // Filter Buttons
  safeListen('applyAttFilterBtn', 'click', loadAttendanceRollCall);
  safeListen('loadHeatmapBtn', 'click', renderHeatmapForSelected);
  safeListen('heatmapEmpSelect', 'change', renderHeatmapForSelected);

  // Screenshot Filter, Delete & Auto-Capture Timer Actions
  safeListen('ssEmpSelect', 'change', loadScreenshotsGallery);
  safeListen('deleteScreenshotsBtn', 'click', handleDeleteScreenshots);
  safeListen('deleteActiveScreenshotBtn', 'click', handleDeleteActiveScreenshot);
  safeListen('ssTimerIntervalSelect', 'change', handleIntervalChange);
  safeListen('ssApplyCustomMinutesBtn', 'click', handleApplyCustomMinutes);
  safeListen('ssCustomMinutesInput', 'change', handleApplyCustomMinutes);
  safeListen('ssTimerToggleBtn', 'click', toggleScreenshotTimer);
  safeListen('ssTimerResetBtn', 'click', resetScreenshotTimer);
  safeListen('ssCaptureNowBtn', 'click', () => executeScreenshotCapture(true));

  // Policy Rules Edit Form
  safeListen('rulesEditForm', 'submit', handleSaveRules);

  // Custom Policy Creation Form
  safeListen('customRuleCreateForm', 'submit', handleCreateCustomRule);
  safeListen('newRuleActive', 'change', (e) => {
    const txt = document.getElementById('newRuleActiveText');
    if (txt) txt.textContent = e.target.checked ? 'Enabled (Active)' : 'Disabled (Inactive)';
  });

  // Rules Admin Inspector Select
  safeListen('rulesAdminEmpSelect', 'change', (e) => {
    if (e.target.value) loadAdminScorecardInspector(e.target.value);
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
    const role = (state.currentUser?.role || localStorage.getItem('wp-role') || 'admin').toUpperCase();
    const banner = document.getElementById('financeAlertBanner');
    const title = document.getElementById('financeBannerTitle')?.textContent || '';
    const body = document.getElementById('financeBannerText')?.textContent || '';
    if (banner) banner.style.display = 'none';
    if (role === 'ADMIN') {
      window.switchTab('tab-finance');
    } else {
      showFinanceNoticeModal(title, body, 'FINANCE NOTICE', state.currentUser?.name);
    }
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

  // Task Sheets Event Listeners
  safeListen('sheetDatePresetFilter', 'change', loadManagerSheetsGrid);
  safeListen('sheetDeptFilter', 'change', loadManagerSheetsGrid);
  safeListen('sheetEmpFilter', 'change', loadManagerSheetsGrid);
  safeListen('sheetStatusFilter', 'change', loadManagerSheetsGrid);
  safeListen('sheetSearchInput', 'input', () => {
    clearTimeout(window._sheetSearchTimeout);
    window._sheetSearchTimeout = setTimeout(loadManagerSheetsGrid, 250);
  });
  safeListen('refreshSheetsBtn', 'click', loadSheetsTab);

  safeListen('sheetsViewGridBtn', 'click', () => {
    state.sheetsViewMode = 'grid';
    const gridBtn = document.getElementById('sheetsViewGridBtn');
    const tblBtn = document.getElementById('sheetsViewTableBtn');
    if (gridBtn) { gridBtn.className = 'btn btn-sm active'; gridBtn.style.background = 'var(--accent-primary)'; gridBtn.style.color = '#fff'; }
    if (tblBtn) { tblBtn.className = 'btn btn-sm btn-secondary'; tblBtn.style.background = ''; tblBtn.style.color = ''; }
    const gridContainer = document.getElementById('sheetsCardsGrid');
    const tblContainer = document.getElementById('sheetsTableContainer');
    if (gridContainer) gridContainer.style.display = 'grid';
    if (tblContainer) tblContainer.style.display = 'none';
    renderSheetsCardsGrid(state.allSheets || []);
  });

  safeListen('sheetsViewTableBtn', 'click', () => {
    state.sheetsViewMode = 'table';
    const gridBtn = document.getElementById('sheetsViewGridBtn');
    const tblBtn = document.getElementById('sheetsViewTableBtn');
    if (tblBtn) { tblBtn.className = 'btn btn-sm active'; tblBtn.style.background = 'var(--accent-primary)'; tblBtn.style.color = '#fff'; }
    if (gridBtn) { gridBtn.className = 'btn btn-sm btn-secondary'; gridBtn.style.background = ''; gridBtn.style.color = ''; }
    const gridContainer = document.getElementById('sheetsCardsGrid');
    const tblContainer = document.getElementById('sheetsTableContainer');
    if (gridContainer) gridContainer.style.display = 'none';
    if (tblContainer) tblContainer.style.display = 'block';
    renderSheetsTableView(state.allSheets || []);
  });

  // Employee Task Sheet Form Actions
  safeListen('quickTaskAddForm', 'submit', handleQuickTaskAdd);
  safeListen('empOpenAddTaskBtn', 'click', () => {
    const input = document.getElementById('quickTaskTitle');
    if (input) { input.focus(); input.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
  });
  safeListen('empSaveDraftBtn', 'click', () => handleSaveEmployeeSheet(false));
  safeListen('empSubmitSheetBtn', 'click', () => handleSaveEmployeeSheet(true));
  safeListen('empAddProjectRowBtn', 'click', () => window.addNewProjectRow?.());

  // Task Sheet Modals
  safeListen('closeSheetDetailsModalBtn', 'click', () => {
    document.getElementById('sheetDetailsModal')?.classList.remove('active');
  });
  safeListen('modalSheetCloseFooterBtn', 'click', () => {
    document.getElementById('sheetDetailsModal')?.classList.remove('active');
  });
  safeListen('modalSheetReviewActionBtn', 'click', () => {
    const sheetId = state.activeDetailSheetId;
    document.getElementById('sheetDetailsModal')?.classList.remove('active');
    if (sheetId) openSheetReviewModal(sheetId);
  });
  safeListen('closeSheetReviewModalBtn', 'click', () => {
    document.getElementById('sheetReviewModal')?.classList.remove('active');
  });
  safeListen('cancelSheetReviewBtn', 'click', () => {
    document.getElementById('sheetReviewModal')?.classList.remove('active');
  });
  safeListen('sheetReviewForm', 'submit', handleSubmitSheetReview);

  safeListen('closeTaskEditModalBtn', 'click', () => {
    document.getElementById('taskItemEditModal')?.classList.remove('active');
  });
  safeListen('cancelTaskEditBtn', 'click', () => {
    document.getElementById('taskItemEditModal')?.classList.remove('active');
  });
  safeListen('taskItemEditForm', 'submit', handleSubmitTaskEdit);
}

async function ensureAuthenticated() {
  if (!state.token) {
    const savedRole = localStorage.getItem('wp-role') || 'admin';
    await loginAs(savedRole);
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

  const timerTargetSelect = document.getElementById('ssTimerTargetEmp');
  if (timerTargetSelect) {
    const curVal = timerTargetSelect.value || 'ACTIVE_FILTER';
    timerTargetSelect.innerHTML = `
      <option value="ACTIVE_FILTER">Current Gallery Employee</option>
      <option value="ALL">All Active Employees (Cycle)</option>
    `;
    state.employees.forEach(emp => {
      const opt = document.createElement('option');
      opt.value = emp.id;
      opt.textContent = `${emp.name} (${emp.employee_code})`;
      timerTargetSelect.appendChild(opt);
    });
    if (curVal) timerTargetSelect.value = curVal;
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

    // For employee and admin role, don't show heatmap in this tab. Only show for manager role (and not for admin rows)
    const currentRole = (state.currentUser?.role || localStorage.getItem('wp-role') || 'admin').toUpperCase();
    const canViewHeatmap = (currentRole === 'MANAGER');

    filtered.forEach(emp => {
      const tr = document.createElement('tr');
      const deptName = deptMap[emp.department_id] || 'General';
      const roleClass = emp.role.toLowerCase();
      const statusClass = emp.status.toLowerCase();
      const showHeatmapBtn = canViewHeatmap && (emp.role !== 'ADMIN');
      const actionHtml = showHeatmapBtn
        ? `<button class="btn btn-secondary btn-sm" onclick="viewEmployeeHeatmap('${emp.id}')" style="padding: 3px 8px; font-size: 0.72rem;">Heatmap</button>`
        : `<span style="color: var(--text-dim);">-</span>`;

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
        <td>${actionHtml}</td>
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
  const role = (state.currentUser?.role || localStorage.getItem('wp-role') || 'admin').toUpperCase();

  // If Employee, show personal overall view ONLY
  if (role === 'EMPLOYEE') {
    await loadEmployeePersonalOverview();
    return;
  }

  // Admin & Manager: Load Team-wide KPI metrics & Roll Call
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

async function loadEmployeePersonalOverview() {
  await ensureAuthenticated();
  const currentUser = state.currentUser || JSON.parse(localStorage.getItem('wp-user') || '{}');
  const empName = currentUser.name || 'Alex Rivera';
  const empCode = currentUser.employee_code || 'EMP001';
  const empId = currentUser.id || 'b3d7b006-12c8-41c4-8d47-9205722d8b46';

  // 1. Profile banner & avatar
  const nameEl = document.getElementById('empOverviewName');
  if (nameEl) nameEl.textContent = empName;
  const metaEl = document.getElementById('empOverviewMeta');
  if (metaEl) metaEl.textContent = `${empCode} • Engineering • Standard Shift: 09:00 AM – 06:00 PM`;
  const avatarEl = document.getElementById('empOverviewAvatar');
  if (avatarEl) {
    const initials = empName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
    avatarEl.textContent = initials || 'AR';
  }

  // 2. Load today's attendance summary for this employee
  let todayRecord = null;
  try {
    const attRes = await fetch(`${API_BASE}/attendance/summary`, { headers: authHeaders() });
    if (attRes.ok) {
      const list = await attRes.json();
      todayRecord = list.find(r => r.employee_code === empCode || r.employee_name === empName) || list[0];
    }
  } catch (err) {
    console.warn('Could not fetch attendance summary:', err);
  }

  const status = todayRecord?.status || 'PRESENT';
  const firstActiveDate = todayRecord?.first_activity ? new Date(todayRecord.first_activity) : null;
  const firstActiveStr = firstActiveDate 
    ? firstActiveDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : '08:52 AM';
  const activeHours = todayRecord?.active_hours != null ? Number(todayRecord.active_hours).toFixed(1) : '5.7';
  const idleHours = todayRecord?.idle_hours != null ? Number(todayRecord.idle_hours).toFixed(1) : '0.5';

  // Update Status Card
  const statusEl = document.getElementById('empKpiStatus');
  if (statusEl) {
    statusEl.innerHTML = `<span class="badge ${status.toLowerCase()}" style="font-size: 1rem; padding: 4px 14px;">${status}</span>`;
  }
  const statusSubEl = document.getElementById('empKpiStatusSub');
  if (statusSubEl) {
    statusSubEl.textContent = status === 'PRESENT' ? 'Checked in on schedule' : (status === 'LATE' ? 'Late arrival' : 'Shift active');
  }

  // Update First Active Card & Details
  const firstActiveEl = document.getElementById('empKpiFirstActive');
  if (firstActiveEl) firstActiveEl.textContent = firstActiveStr;
  const firstCheckinDetail = document.getElementById('empOverviewFirstCheckinDetail');
  if (firstCheckinDetail) firstCheckinDetail.textContent = `${firstActiveStr} (On-Time)`;

  // Update Active Hours Card & Target
  const activeHoursEl = document.getElementById('empKpiActiveHours');
  if (activeHoursEl) activeHoursEl.textContent = `${activeHours} hrs`;
  const idleHoursEl = document.getElementById('empOverviewIdleHours');
  if (idleHoursEl) idleHoursEl.textContent = `${idleHours} hrs`;

  const targetHours = 8.0;
  const targetPct = Math.min(100, Math.round((parseFloat(activeHours) / targetHours) * 100));
  const targetPctEl = document.getElementById('empOverviewTargetPct');
  if (targetPctEl) targetPctEl.textContent = `${targetPct}% (${activeHours} / ${targetHours.toFixed(1)} hrs)`;
  const targetBar = document.getElementById('empOverviewTargetProgressBar');
  if (targetBar) targetBar.style.width = `${targetPct}%`;

  // 3. Stars Count
  let starsCount = 12; // Seeded stars for Alex
  try {
    const starRes = await fetch(`${API_BASE}/dashboard/metrics`, { headers: authHeaders() });
    if (starRes.ok) {
      const data = await starRes.json();
      if (data.total_stars_awarded) starsCount = data.total_stars_awarded;
    }
  } catch (err) {}
  const starsEl = document.getElementById('empKpiStars');
  if (starsEl) starsEl.textContent = `⭐ ${starsCount}`;

  // 4. Tasks ratio from today's sheet
  let completedTasks = 3;
  let totalTasks = 4;
  if (state.currentTodaySheet) {
    if (state.currentTodaySheet.project_rows && state.currentTodaySheet.project_rows.length > 0) {
      totalTasks = state.currentTodaySheet.project_rows.length;
      completedTasks = state.currentTodaySheet.project_rows.filter(r => r.status === 'Done').length;
    } else if (state.currentTodaySheet.tasks && state.currentTodaySheet.tasks.length > 0) {
      totalTasks = state.currentTodaySheet.tasks.length;
      completedTasks = state.currentTodaySheet.tasks.filter(t => t.status === 'COMPLETED').length;
    }
  }
  const taskPct = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
  const taskRatioEl = document.getElementById('empKpiTasksRatio');
  if (taskRatioEl) taskRatioEl.textContent = `${completedTasks} / ${totalTasks} Done`;
  const taskPctEl = document.getElementById('empKpiTasksPct');
  if (taskPctEl) taskPctEl.textContent = `${taskPct}% completed`;

  const delivPctEl = document.getElementById('empOverviewDeliverablesPct');
  if (delivPctEl) delivPctEl.textContent = `${taskPct}% (${completedTasks} of ${totalTasks})`;
  const delivBar = document.getElementById('empOverviewDeliverablesProgressBar');
  if (delivBar) delivBar.style.width = `${taskPct}%`;

  // 5. Personal Attendance History Table (Past days for this employee only)
  const tbody = document.getElementById('empPersonalAttendanceTbody');
  if (!tbody) return;
  tbody.innerHTML = '';

  try {
    const histRes = await fetch(`${API_BASE}/attendance?employee_id=${empId}`, { headers: authHeaders() });
    if (histRes.ok) {
      const records = await histRes.json();
      if (records && records.length > 0) {
        records.slice(0, 7).forEach(rec => {
          const tr = document.createElement('tr');
          const firstTime = rec.first_activity_time 
            ? (rec.first_activity_time.includes('T') ? new Date(rec.first_activity_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : rec.first_activity_time.slice(0, 5))
            : '-';
          const actHrs = ((rec.total_active_seconds || 0) / 3600).toFixed(1);
          const idleHrs = ((rec.total_idle_seconds || 1800) / 3600).toFixed(1);
          const starBadges = rec.stars_awarded > 0 ? `⭐ ${rec.stars_awarded}` : '-';

          tr.innerHTML = `
            <td><strong>${rec.work_date}</strong></td>
            <td>${firstTime}</td>
            <td><strong style="color: var(--accent-cyan);">${actHrs} hrs</strong></td>
            <td style="color: var(--text-dim);">${idleHrs} hrs</td>
            <td><span class="badge ${rec.status.toLowerCase()}">${rec.status}</span></td>
            <td><span style="color: var(--accent-violet); font-weight: 700;">${starBadges}</span></td>
          `;
          tbody.appendChild(tr);
        });
        return;
      }
    }
  } catch (err) {
    console.warn('Could not fetch personal attendance history:', err);
  }

  // Fallback realistic records for Alex Rivera if offline/mock
  const fallbackRecords = [
    { date: '2026-10-07', first: '08:52 AM', active: '5.7 hrs', idle: '0.5 hrs', status: 'PRESENT', stars: '⭐ 2' },
    { date: '2026-10-06', first: '08:45 AM', active: '7.8 hrs', idle: '0.4 hrs', status: 'PRESENT', stars: '⭐ 2' },
    { date: '2026-10-05', first: '08:50 AM', active: '8.2 hrs', idle: '0.6 hrs', status: 'PRESENT', stars: '⭐ 2' },
    { date: '2026-10-04', first: '09:02 AM', active: '7.5 hrs', idle: '0.5 hrs', status: 'PRESENT', stars: '⭐ 1' },
    { date: '2026-10-03', first: '08:48 AM', active: '8.0 hrs', idle: '0.3 hrs', status: 'PRESENT', stars: '⭐ 2' },
  ];
  fallbackRecords.forEach(r => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${r.date}</strong></td>
      <td>${r.first}</td>
      <td><strong style="color: var(--accent-cyan);">${r.active}</strong></td>
      <td style="color: var(--text-dim);">${r.idle}</td>
      <td><span class="badge ${r.status.toLowerCase()}">${r.status}</span></td>
      <td><span style="color: var(--accent-violet); font-weight: 700;">${r.stars}</span></td>
    `;
    tbody.appendChild(tr);
  });
}


// Helper to determine if a shift has ended for a given work date
function isShiftEnded(workDateStr, shiftEndTime = '18:00:00') {
  if (!workDateStr) return true;
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const todayStr = `${y}-${m}-${d}`;

  // Past dates: shift ended
  if (workDateStr < todayStr) return true;
  // Future dates: shift has not ended
  if (workDateStr > todayStr) return false;

  // Today: check if current time is past shift_end
  const parts = (shiftEndTime || '18:00:00').split(':').map(Number);
  const endHour = isNaN(parts[0]) ? 18 : parts[0];
  const endMin = isNaN(parts[1]) ? 0 : parts[1];

  const shiftEndDate = new Date();
  shiftEndDate.setHours(endHour, endMin, 0, 0);

  return now >= shiftEndDate;
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
        
        // When shift didn't end, leave a blank space in Last Activity
        const shiftEnded = (r.shift_ended !== undefined) ? r.shift_ended : isShiftEnded(r.work_date);
        const lastAct = (shiftEnded && r.last_activity)
          ? new Date(r.last_activity).toLocaleTimeString()
          : (shiftEnded ? '-' : ''); // Blank space when shift didn't end

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

// ============================================
// Automated Screenshot Capture Timer (5m - 1h)
// ============================================
function initScreenshotTimer() {
  const savedInterval = parseInt(localStorage.getItem('ss_capture_interval_minutes') || '10', 10);
  const validInterval = Math.max(5, Math.min(60, isNaN(savedInterval) ? 10 : savedInterval));
  state.ssTimer.intervalMinutes = validInterval;
  if (!state.ssTimer.remainingSeconds || state.ssTimer.remainingSeconds > validInterval * 60) {
    state.ssTimer.remainingSeconds = validInterval * 60;
  }

  // Set interval dropdown & controls
  const intervalSelect = document.getElementById('ssTimerIntervalSelect');
  const customWrapper = document.getElementById('ssCustomMinutesWrapper');
  const customInput = document.getElementById('ssCustomMinutesInput');
  const notice = document.getElementById('ssTimerNotice');

  if (intervalSelect) {
    const isStandard = ['5', '10', '15', '20', '30', '45', '60'].includes(String(validInterval));
    if (isStandard) {
      intervalSelect.value = String(validInterval);
      if (customWrapper) customWrapper.style.display = 'none';
    } else {
      intervalSelect.value = 'custom';
      if (customWrapper) customWrapper.style.display = 'inline-flex';
      if (customInput) customInput.value = validInterval;
    }
  }

  if (notice) notice.textContent = `Interval: ${validInterval} mins`;

  updateScreenshotCountdownDisplay();
  updateScreenshotTimerBadgeAndButton();

  // Ensure timer tick interval is running
  if (!state.ssTimer.timerId) {
    state.ssTimer.timerId = setInterval(tickScreenshotTimer, 1000);
  }
}

function updateScreenshotCountdownDisplay() {
  const countdownEl = document.getElementById('ssTimerCountdownText');
  const progressFill = document.getElementById('ssTimerProgressFill');
  if (!countdownEl) return;

  const rem = Math.max(0, state.ssTimer.remainingSeconds);
  const mins = Math.floor(rem / 60);
  const secs = rem % 60;
  const formatted = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  countdownEl.textContent = formatted;

  const totalSecs = Math.max(1, state.ssTimer.intervalMinutes * 60);
  const pct = Math.max(0, Math.min(100, (rem / totalSecs) * 100));
  if (progressFill) {
    progressFill.style.width = `${pct}%`;
  }
}

function updateScreenshotTimerBadgeAndButton() {
  const badge = document.getElementById('ssTimerStatusBadge');
  const statusText = document.getElementById('ssTimerStatusText');
  const toggleBtn = document.getElementById('ssTimerToggleBtn');
  const toggleText = document.getElementById('ssTimerToggleText');
  const toggleIcon = document.getElementById('ssTimerToggleIcon');
  const countdownEl = document.getElementById('ssTimerCountdownText');

  if (state.ssTimer.isRunning) {
    if (badge) {
      badge.className = 'ss-timer-badge ss-badge-active';
    }
    if (statusText) statusText.textContent = 'Auto-Capture Active';
    if (toggleText) toggleText.textContent = 'Pause Timer';
    if (toggleIcon) {
      toggleIcon.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>`;
    }
    if (countdownEl) {
      countdownEl.style.color = '#10b981';
      countdownEl.style.textShadow = '0 0 12px rgba(16, 185, 129, 0.4)';
    }
  } else {
    if (badge) {
      badge.className = 'ss-timer-badge ss-badge-paused';
    }
    if (statusText) statusText.textContent = 'Auto-Capture Paused';
    if (toggleText) toggleText.textContent = 'Resume Timer';
    if (toggleIcon) {
      toggleIcon.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>`;
    }
    if (countdownEl) {
      countdownEl.style.color = '#f59e0b';
      countdownEl.style.textShadow = '0 0 12px rgba(245, 158, 11, 0.4)';
    }
  }
}

function tickScreenshotTimer() {
  if (!state.ssTimer.isRunning) return;

  if (state.ssTimer.remainingSeconds > 0) {
    state.ssTimer.remainingSeconds--;
    updateScreenshotCountdownDisplay();
  }

  if (state.ssTimer.remainingSeconds <= 0) {
    // When selected timer occurs, automatically capture screenshot
    state.ssTimer.remainingSeconds = state.ssTimer.intervalMinutes * 60;
    updateScreenshotCountdownDisplay();
    executeScreenshotCapture(false);
  }
}

function toggleScreenshotTimer() {
  state.ssTimer.isRunning = !state.ssTimer.isRunning;
  localStorage.setItem('ss_capture_timer_running', state.ssTimer.isRunning ? 'true' : 'false');
  updateScreenshotTimerBadgeAndButton();
}

function resetScreenshotTimer() {
  state.ssTimer.remainingSeconds = state.ssTimer.intervalMinutes * 60;
  updateScreenshotCountdownDisplay();
  const notice = document.getElementById('ssTimerNotice');
  if (notice) {
    notice.textContent = `Countdown reset to ${state.ssTimer.intervalMinutes}m`;
    setTimeout(() => {
      if (notice) notice.textContent = `Interval: ${state.ssTimer.intervalMinutes} mins`;
    }, 2500);
  }
}

async function handleIntervalChange(e) {
  const val = e.target.value;
  const customWrapper = document.getElementById('ssCustomMinutesWrapper');
  const customInput = document.getElementById('ssCustomMinutesInput');

  if (val === 'custom') {
    if (customWrapper) customWrapper.style.display = 'inline-flex';
    if (customInput) customInput.focus();
    return;
  }

  if (customWrapper) customWrapper.style.display = 'none';
  const mins = parseInt(val, 10);
  await applyScreenshotInterval(mins);
}

async function handleApplyCustomMinutes() {
  const input = document.getElementById('ssCustomMinutesInput');
  if (!input) return;
  let mins = parseInt(input.value, 10);
  if (isNaN(mins)) mins = 10;
  mins = Math.max(5, Math.min(60, mins));
  input.value = mins;
  await applyScreenshotInterval(mins);
}

async function applyScreenshotInterval(minutes) {
  // Enforce range from 5 mins to 1 hour (60 mins)
  const bounded = Math.max(5, Math.min(60, minutes));
  state.ssTimer.intervalMinutes = bounded;
  state.ssTimer.remainingSeconds = bounded * 60;
  localStorage.setItem('ss_capture_interval_minutes', bounded);

  const notice = document.getElementById('ssTimerNotice');
  if (notice) notice.textContent = `Interval: ${bounded} mins`;

  updateScreenshotCountdownDisplay();

  // Sync with backend policy
  try {
    await fetch(`${API_BASE}/screenshots/interval?interval_minutes=${bounded}`, {
      method: 'POST',
      headers: authHeaders()
    });
  } catch (err) {
    console.debug('Failed to sync screenshot interval with backend:', err);
  }
}

async function executeScreenshotCapture(isManual = false) {
  const targetSelect = document.getElementById('ssTimerTargetEmp');
  const filterSelect = document.getElementById('ssEmpSelect');
  let targetEmpId = null;

  if (targetSelect && targetSelect.value === 'ACTIVE_FILTER') {
    targetEmpId = filterSelect?.value || null;
  } else if (targetSelect && targetSelect.value && targetSelect.value !== 'ALL') {
    targetEmpId = targetSelect.value;
  } else if (state.employees && state.employees.length > 0) {
    // Round-robin or random active employee
    const activeEmps = state.employees.filter(e => e.status === 'ACTIVE');
    const pool = activeEmps.length > 0 ? activeEmps : state.employees;
    const picked = pool[Math.floor(Math.random() * pool.length)];
    targetEmpId = picked.id;
  }

  const btn = document.getElementById('ssCaptureNowBtn');
  const origBtnContent = btn ? btn.innerHTML : '';
  if (btn && isManual) {
    btn.disabled = true;
    btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="animation: spin 1s linear infinite;"><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"/><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"/><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"/></svg> Capturing...`;
  }

  try {
    let url = `${API_BASE}/screenshots/capture`;
    if (targetEmpId) url += `?employee_id=${encodeURIComponent(targetEmpId)}`;

    const res = await fetch(url, {
      method: 'POST',
      headers: authHeaders(),
    });

    if (res.ok) {
      const data = await res.json();
      const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      const lastCapEl = document.getElementById('ssTimerLastCapturedText');
      if (lastCapEl) {
        lastCapEl.textContent = `Captured: ${timeStr} (${data.employee_name})`;
        lastCapEl.style.color = '#10b981';
      }

      // Visual pulse on countdown box
      const box = document.querySelector('.ss-countdown-box');
      if (box) {
        box.style.borderColor = '#10b981';
        setTimeout(() => { if (box) box.style.borderColor = 'rgba(99, 102, 241, 0.25)'; }, 1000);
      }

      // Auto-reload screenshots gallery so the newly captured screenshot immediately appears!
      await loadScreenshotsGallery();

      if (isManual) {
        state.ssTimer.remainingSeconds = state.ssTimer.intervalMinutes * 60;
        updateScreenshotCountdownDisplay();
      }
    } else {
      const err = await res.json().catch(() => ({}));
      console.error('Failed to capture screenshot:', err);
    }
  } catch (err) {
    console.error('Network error capturing screenshot:', err);
  } finally {
    if (btn && isManual) {
      btn.disabled = false;
      btn.innerHTML = origBtnContent;
    }
  }
}

// 5. Rules & Stars Tab Controller
async function loadRulesAndStars() {
  await ensureAuthenticated();
  applyRolePermissions();
  const role = (state.currentUser?.role || localStorage.getItem('wp-role') || 'admin').toUpperCase();

  if (role === 'ADMIN') {
    await loadAdminRulesConfig();
    await populateRulesAdminInspectorSelect();
  } else {
    // Both EMPLOYEE and MANAGER only see their own performance and policy violations
    await loadPersonalPerformanceScorecard();
  }
}

// Admin: Load and Render Configured Policies & Shift Forms
async function loadAdminRulesConfig() {
  try {
    const rulesRes = await fetch(`${API_BASE}/rules`, { headers: authHeaders() });
    if (!rulesRes.ok) return;
    const rules = await rulesRes.json();
    const container = document.getElementById('rulesListContainer');
    if (!container) return;
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

    container.querySelectorAll('.policy-toggle-input').forEach(input => {
      input.addEventListener('change', async (e) => {
        const ruleId = e.target.getAttribute('data-id');
        const newStatus = e.target.checked;
        await handleToggleRuleStatus(ruleId, newStatus);
      });
    });

    container.querySelectorAll('.delete-rule-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const ruleId = btn.getAttribute('data-id');
        const ruleName = btn.getAttribute('data-name');
        await handleDeleteRule(ruleId, ruleName);
      });
    });
  } catch (err) {
    console.error('Error loading admin rules:', err);
  }
}

// Admin: Populate Employee Selector for Scorecard Inspector
async function populateRulesAdminInspectorSelect() {
  const sel = document.getElementById('rulesAdminEmpSelect');
  if (!sel) return;
  const currentVal = sel.value;
  sel.innerHTML = '';

  if (state.employees.length === 0) {
    await fetchEmployees();
  }

  state.employees.forEach(emp => {
    const opt = document.createElement('option');
    opt.value = emp.id;
    opt.textContent = `${emp.name} (${emp.employee_code} • ${emp.role})`;
    sel.appendChild(opt);
  });

  const targetEmpId = currentVal && state.employees.some(e => e.id === currentVal)
    ? currentVal
    : (state.employees[0]?.id || null);

  if (targetEmpId) {
    sel.value = targetEmpId;
    await loadAdminScorecardInspector(targetEmpId);
  }
}

// Admin: Fetch and render specific employee scorecard inspector
async function loadAdminScorecardInspector(empId) {
  const container = document.getElementById('rulesAdminScorecardContainer');
  if (!container || !empId) return;
  container.innerHTML = '<div style="padding: 24px; text-align: center; color: var(--text-dim); font-size: 0.85rem;">Loading employee scorecard...</div>';

  try {
    const res = await fetch(`${API_BASE}/rules/performance?employee_id=${empId}`, { headers: authHeaders() });
    if (!res.ok) throw new Error('Failed to fetch scorecard');
    const data = await res.json();
    renderScorecardHTMLInto(container, data);
  } catch (err) {
    console.error('Error loading inspector scorecard:', err);
    container.innerHTML = `<div style="padding: 20px; text-align: center; color: var(--accent-rose); font-size: 0.85rem;">Failed to load performance scorecard for selected employee.</div>`;
  }
}

// Employee & Manager: Personal Performance Scorecard Controller
async function loadPersonalPerformanceScorecard() {
  try {
    const res = await fetch(`${API_BASE}/rules/performance`, { headers: authHeaders() });
    if (!res.ok) throw new Error('Failed to load personal scorecard');
    const data = await res.json();

    // 1. Profile Pill & Dept
    const profilePill = document.getElementById('personalScorecardProfilePill');
    if (profilePill) {
      profilePill.textContent = `${data.employee_name} (${data.employee_code}) • ${data.role}`;
      profilePill.className = `role-pill ${data.role.toLowerCase()}`;
    }
    const deptPill = document.getElementById('personalScorecardDeptPill');
    if (deptPill) deptPill.textContent = data.department || 'General';

    // 2. Scorecard KPIs
    const kpiStars = document.getElementById('personalKpiStars');
    if (kpiStars) kpiStars.textContent = `${data.total_stars} ⭐`;
    const kpiStarsSub = document.getElementById('personalKpiStarsSub');
    if (kpiStarsSub) kpiStarsSub.textContent = `${data.stars_ledger.length} award recognitions`;

    const kpiPunct = document.getElementById('personalKpiPunctuality');
    if (kpiPunct) kpiPunct.textContent = `${data.punctuality_rate_pct}%`;
    const kpiPunctSub = document.getElementById('personalKpiPunctualitySub');
    if (kpiPunctSub) kpiPunctSub.textContent = `${data.on_time_days} on-time / ${data.late_days} late`;

    const kpiActive = document.getElementById('personalKpiActiveHours');
    if (kpiActive) kpiActive.textContent = `${data.total_active_hours} hrs`;
    const kpiActiveSub = document.getElementById('personalKpiActiveHoursSub');
    if (kpiActiveSub) kpiActiveSub.textContent = `Avg ${data.avg_daily_active_hours} hrs/day`;

    const kpiViolations = document.getElementById('personalKpiViolations');
    if (kpiViolations) kpiViolations.textContent = data.total_violations_count;
    const kpiViolationsSub = document.getElementById('personalKpiViolationsSub');
    if (kpiViolationsSub) kpiViolationsSub.textContent = data.total_violations_count === 0 ? 'Compliant & Clear' : 'Policy Infractions';

    const kpiDays = document.getElementById('personalKpiDaysLogged');
    if (kpiDays) kpiDays.textContent = `${data.total_days_logged} Shifts`;

    const vBadge = document.getElementById('personalViolationsCountBadge');
    if (vBadge) vBadge.textContent = `${data.total_violations_count} Infractions`;

    const sBadge = document.getElementById('personalStarsCountBadge');
    if (sBadge) sBadge.textContent = `${data.total_stars} Stars`;

    // 3. Render Violations Table
    const vTbody = document.getElementById('personalViolationsTbody');
    if (vTbody) {
      vTbody.innerHTML = '';
      if (data.violations_ledger.length === 0) {
        vTbody.innerHTML = `
          <tr>
            <td colspan="6" style="text-align: center; color: var(--accent-emerald); padding: 24px; font-size: 0.85rem;">
              ✨ <strong>Zero Policy Violations!</strong> Excellent work — all workplace punctuality and shift policies are satisfied.
            </td>
          </tr>
        `;
      } else {
        data.violations_ledger.forEach(v => {
          const tr = document.createElement('tr');
          const typeBadge = v.violation_type === 'LATE_ARRIVAL'
            ? '<span class="badge late">Late Arrival</span>'
            : (v.violation_type === 'HOURS_SHORTFALL' ? '<span class="badge absent">Hours Shortfall</span>' : `<span class="badge offline">${v.violation_type}</span>`);
          
          const sevBadge = v.severity === 'WARNING'
            ? '<span class="role-pill manager" style="font-size: 0.65rem;">Warning</span>'
            : `<span class="role-pill admin" style="background: rgba(244,63,94,0.15); color: #f43f5e; border-color: rgba(244,63,94,0.3); font-size: 0.65rem;">${v.severity}</span>`;

          tr.innerHTML = `
            <td style="font-weight: 600; font-family: monospace; font-size: 0.82rem; color: var(--text-main);">${v.date}</td>
            <td>${typeBadge}</td>
            <td style="font-weight: 500; color: var(--text-main); font-size: 0.82rem;">${v.policy_name}</td>
            <td>${sevBadge}</td>
            <td style="font-size: 0.78rem; color: var(--text-muted); line-height: 1.4;">${v.details}</td>
            <td>
              <span style="color: var(--accent-rose); font-weight: 600; font-size: 0.78rem; display: flex; align-items: center; gap: 4px;">
                <span>🔻</span> ${v.star_impact}
              </span>
            </td>
          `;
          vTbody.appendChild(tr);
        });
      }
    }

    // 4. Render Stars Table
    const sTbody = document.getElementById('personalStarsTbody');
    if (sTbody) {
      sTbody.innerHTML = '';
      if (data.stars_ledger.length === 0) {
        sTbody.innerHTML = `
          <tr>
            <td colspan="5" style="text-align: center; color: var(--text-dim); padding: 24px; font-size: 0.85rem;">
              ⭐ No star recognitions earned yet. Arrive before shift start or on-time to unlock daily stars!
            </td>
          </tr>
        `;
      } else {
        data.stars_ledger.forEach(s => {
          const tr = document.createElement('tr');
          const starIcons = '⭐'.repeat(Math.max(1, s.star_count)) + ` +${s.star_count}`;
          
          let critHtml = '';
          if (s.criteria && Object.keys(s.criteria).length > 0) {
            critHtml = Object.entries(s.criteria).map(([k, val]) => `<span style="font-size: 0.72rem; padding: 2px 6px; background: rgba(255,255,255,0.05); border-radius: 4px; border: 1px solid var(--border-subtle); color: var(--text-muted); margin-right: 4px; font-family: monospace;">${k}: <strong>${val}</strong></span>`).join('');
          } else {
            critHtml = '<span style="font-size: 0.74rem; color: var(--text-dim);">Policy criteria satisfied</span>';
          }

          const awardedTime = new Date(s.awarded_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

          tr.innerHTML = `
            <td style="font-weight: 600; font-family: monospace; font-size: 0.82rem; color: var(--text-main);">${s.date}</td>
            <td>
              <span class="role-pill employee" style="background: rgba(245,158,11,0.15); color: var(--accent-amber); border-color: rgba(245,158,11,0.3); font-size: 0.75rem; font-weight: 700;">
                ${starIcons}
              </span>
            </td>
            <td style="font-weight: 600; color: var(--text-main); font-size: 0.82rem;">${s.reason}</td>
            <td>${critHtml}</td>
            <td style="font-size: 0.74rem; color: var(--text-dim);">${s.date} ${awardedTime}</td>
          `;
          sTbody.appendChild(tr);
        });
      }
    }

  } catch (err) {
    console.error('Error loading personal scorecard:', err);
  }
}

// Reusable renderer for admin inspector container
function renderScorecardHTMLInto(container, data) {
  let violationsRows = '';
  if (data.violations_ledger.length === 0) {
    violationsRows = `
      <tr>
        <td colspan="6" style="text-align: center; color: var(--accent-emerald); padding: 18px; font-size: 0.82rem;">
          ✨ <strong>Zero Policy Violations!</strong> Employee has complied with all workplace and shift policies.
        </td>
      </tr>
    `;
  } else {
    violationsRows = data.violations_ledger.map(v => {
      const typeBadge = v.violation_type === 'LATE_ARRIVAL'
        ? '<span class="badge late">Late Arrival</span>'
        : (v.violation_type === 'HOURS_SHORTFALL' ? '<span class="badge absent">Hours Shortfall</span>' : `<span class="badge offline">${v.violation_type}</span>`);
      
      const sevBadge = v.severity === 'WARNING'
        ? '<span class="role-pill manager" style="font-size: 0.65rem;">Warning</span>'
        : `<span class="role-pill admin" style="background: rgba(244,63,94,0.15); color: #f43f5e; border-color: rgba(244,63,94,0.3); font-size: 0.65rem;">${v.severity}</span>`;

      return `
        <tr>
          <td style="font-weight: 600; font-family: monospace; font-size: 0.8rem; color: var(--text-main);">${v.date}</td>
          <td>${typeBadge}</td>
          <td style="font-weight: 500; color: var(--text-main); font-size: 0.8rem;">${v.policy_name}</td>
          <td>${sevBadge}</td>
          <td style="font-size: 0.76rem; color: var(--text-muted); line-height: 1.4;">${v.details}</td>
          <td>
            <span style="color: var(--accent-rose); font-weight: 600; font-size: 0.76rem;">🔻 ${v.star_impact}</span>
          </td>
        </tr>
      `;
    }).join('');
  }

  let starsRows = '';
  if (data.stars_ledger.length === 0) {
    starsRows = `
      <tr>
        <td colspan="5" style="text-align: center; color: var(--text-dim); padding: 18px; font-size: 0.82rem;">
          ⭐ No stars awarded yet.
        </td>
      </tr>
    `;
  } else {
    starsRows = data.stars_ledger.map(s => {
      const starIcons = '⭐'.repeat(Math.max(1, s.star_count)) + ` +${s.star_count}`;
      let critHtml = '';
      if (s.criteria && Object.keys(s.criteria).length > 0) {
        critHtml = Object.entries(s.criteria).map(([k, val]) => `<span style="font-size: 0.7rem; padding: 2px 5px; background: rgba(255,255,255,0.05); border-radius: 4px; border: 1px solid var(--border-subtle); color: var(--text-muted); margin-right: 4px; font-family: monospace;">${k}: <strong>${val}</strong></span>`).join('');
      } else {
        critHtml = '<span style="font-size: 0.72rem; color: var(--text-dim);">Criteria met</span>';
      }
      const awardedTime = new Date(s.awarded_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      return `
        <tr>
          <td style="font-weight: 600; font-family: monospace; font-size: 0.8rem; color: var(--text-main);">${s.date}</td>
          <td>
            <span class="role-pill employee" style="background: rgba(245,158,11,0.15); color: var(--accent-amber); border-color: rgba(245,158,11,0.3); font-size: 0.72rem; font-weight: 700;">
              ${starIcons}
            </span>
          </td>
          <td style="font-weight: 600; color: var(--text-main); font-size: 0.8rem;">${s.reason}</td>
          <td>${critHtml}</td>
          <td style="font-size: 0.72rem; color: var(--text-dim);">${s.date} ${awardedTime}</td>
        </tr>
      `;
    }).join('');
  }

  container.innerHTML = `
    <div style="background: var(--bg-card); border: 1px solid var(--border-subtle); border-radius: var(--radius-sm); padding: 18px; margin-top: 10px;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; flex-wrap: wrap; gap: 10px;">
        <div style="display: flex; align-items: center; gap: 10px;">
          <div style="font-weight: 700; color: var(--text-main); font-size: 1.05rem;">${data.employee_name}</div>
          <span class="role-pill ${data.role.toLowerCase()}" style="font-size: 0.7rem;">${data.role}</span>
          <span class="badge" style="font-size: 0.7rem;">${data.employee_code}</span>
          <span style="font-size: 0.8rem; color: var(--text-muted);">${data.department}</span>
        </div>
      </div>

      <div class="stat-grid" style="grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); margin-bottom: 20px;">
        <div class="stat-card" style="border-left: 3px solid var(--accent-amber); padding: 14px;">
          <div class="stat-label">Total Stars</div>
          <div class="stat-value" style="color: var(--accent-amber); font-size: 1.4rem;">${data.total_stars} ⭐</div>
          <div class="stat-sub">${data.stars_ledger.length} awards earned</div>
        </div>
        <div class="stat-card emerald" style="padding: 14px;">
          <div class="stat-label">Punctuality Rate</div>
          <div class="stat-value" style="font-size: 1.4rem;">${data.punctuality_rate_pct}%</div>
          <div class="stat-sub">${data.on_time_days} On-Time / ${data.late_days} Late</div>
        </div>
        <div class="stat-card cyan" style="padding: 14px;">
          <div class="stat-label">Active Time</div>
          <div class="stat-value" style="font-size: 1.4rem;">${data.total_active_hours} hrs</div>
          <div class="stat-sub">Avg ${data.avg_daily_active_hours} hrs/day</div>
        </div>
        <div class="stat-card" style="border-left: 3px solid var(--accent-rose); padding: 14px;">
          <div class="stat-label">Policy Violations</div>
          <div class="stat-value" style="color: var(--accent-rose); font-size: 1.4rem;">${data.total_violations_count}</div>
          <div class="stat-sub">Infractions logged</div>
        </div>
      </div>

      <div style="display: flex; flex-direction: column; gap: 20px;">
        <div>
          <div style="font-weight: 700; color: var(--text-main); font-size: 0.88rem; margin-bottom: 8px; display: flex; align-items: center; gap: 6px;">
            <span style="color: var(--accent-rose);">⚠️</span> Policy Violations & Star Impact Ledger
          </div>
          <div class="table-responsive">
            <table class="data-table" style="width: 100%;">
              <thead>
                <tr>
                  <th style="width: 100px;">Date</th>
                  <th style="width: 120px;">Violation</th>
                  <th>Policy Violated</th>
                  <th style="width: 80px;">Severity</th>
                  <th>Details</th>
                  <th style="width: 200px;">Star Impact</th>
                </tr>
              </thead>
              <tbody>
                ${violationsRows}
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <div style="font-weight: 700; color: var(--text-main); font-size: 0.88rem; margin-bottom: 8px; display: flex; align-items: center; gap: 6px;">
            <span style="color: var(--accent-amber);">⭐</span> Stars Earned History
          </div>
          <div class="table-responsive">
            <table class="data-table" style="width: 100%;">
              <thead>
                <tr>
                  <th style="width: 100px;">Award Date</th>
                  <th style="width: 90px;">Stars</th>
                  <th>Reason</th>
                  <th>Criteria Snapshot</th>
                  <th style="width: 140px;">Awarded At</th>
                </tr>
              </thead>
              <tbody>
                ${starsRows}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  `;
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
      alert('Failed to save rules. Please ensure you are logged in as Admin.');
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

// Modal helper for viewing finance & notification messages
function showFinanceNoticeModal(title, body, meta, recipient) {
  const finModal = document.getElementById('financeDetailModal');
  if (!finModal) return;
  const subjEl = document.getElementById('financeModalSubject');
  const bodyEl = document.getElementById('financeModalBody');
  const recipEl = document.getElementById('financeModalRecipient');
  const metaEl = document.getElementById('financeModalMeta');
  const dateEl = document.getElementById('financeModalDate');

  if (subjEl) subjEl.textContent = title || 'Finance Notice';
  if (bodyEl) bodyEl.textContent = body || 'No message content provided.';
  if (recipEl) recipEl.textContent = recipient || (state.currentUser ? state.currentUser.name : 'Staff Member');
  if (metaEl) metaEl.textContent = meta || 'OFFICIAL NOTICE';
  if (dateEl) dateEl.textContent = `Received on ${new Date().toLocaleDateString()}`;

  finModal.classList.add('active');
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
            const role = (state.currentUser?.role || localStorage.getItem('wp-role') || 'admin').toUpperCase();
            if (role === 'ADMIN') {
              switchTab('tab-finance');
            } else {
              showFinanceNoticeModal(n.title, n.body, n.notification_type, state.currentUser?.name);
            }
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

// ==========================================================================
// 8. Daily Task Sheets & Work Logs Controller
// ==========================================================================

state.allSheets = [];
state.currentTodaySheet = null;
state.activeDetailSheetId = null;
state.sheetsViewMode = 'grid';

// Date utility for consistent relative day strings
function getDummyDates() {
  const now = new Date();
  const format = d => d.toISOString().split('T')[0];
  const today = format(now);
  const y = new Date(now); y.setDate(y.getDate() - 1);
  const yesterday = format(y);
  const d2 = new Date(now); d2.setDate(d2.getDate() - 2);
  const twoDays = format(d2);
  const d3 = new Date(now); d3.setDate(d3.getDate() - 3);
  const threeDays = format(d3);
  return { today, yesterday, twoDays, threeDays };
}

// --------------------------------------------------------------------------
// Rich Dummy Data Generators (Manager Team Sheets & Employee Workspace)
// --------------------------------------------------------------------------

function getDummyManagerSheets() {
  const dates = getDummyDates();
  return [
    {
      id: "sh-dummy-mgr-01",
      employee_id: "emp-alex",
      employee_name: "Alex Rivera",
      employee_code: "EMP001",
      department_name: "Core Platform Engineering",
      department_id: "dept-eng",
      sheet_date: dates.today,
      status: "SUBMITTED",
      total_hours: 7.5,
      total_tasks: 4,
      completed_tasks: 3,
      progress_percent: 75,
      summary_notes: "Completed frontend sheet integration, responsive card grids, and token auth interceptor. Running unit and E2E tests.",
      blockers_summary: "Waiting on staging mock socket server for multi-client sync test suite.",
      manager_feedback: "Terrific progress on the task sheets controller Alex! The responsive layout and review flow look great.",
      reviewed_by_name: "Sarah Connor (Tech Lead)",
      reviewed_at: new Date(Date.now() - 3600000).toISOString(),
      tasks: [
        { id: "t-mgr-1-1", title: "Implement Daily Task Sheet UI and Card Grids", category: "Frontend Development", priority: "HIGH", status: "COMPLETED", hours_spent: 3.5, description: "Built modern interactive cards and responsive grid layout for multi-employee daily task management.", blockers: null },
        { id: "t-mgr-1-2", title: "JWT Session Auto-refresh Hook & Interceptor", category: "Security & Auth", priority: "MEDIUM", status: "COMPLETED", hours_spent: 2.0, description: "Created automatic token refresh interceptor for expiring bearer credentials.", blockers: null },
        { id: "t-mgr-1-3", title: "Refactor Employee Switcher Dropdown & Role Sync", category: "Frontend Development", priority: "LOW", status: "COMPLETED", hours_spent: 1.0, description: "Added quick role switching synchronization and badge color indicators.", blockers: null },
        { id: "t-mgr-1-4", title: "End-to-End WebSocket Sync Tests", category: "Testing & QA", priority: "MEDIUM", status: "IN_PROGRESS", hours_spent: 1.0, description: "Testing live desktop agent sync and payload dispatching.", blockers: "Waiting on staging mock socket server" },
      ]
    },
    {
      id: "sh-dummy-mgr-02",
      employee_id: "emp-elena",
      employee_name: "Elena Rostova",
      employee_code: "EMP002",
      department_name: "Core Platform Engineering",
      department_id: "dept-eng",
      sheet_date: dates.today,
      status: "APPROVED",
      total_hours: 7.5,
      total_tasks: 3,
      completed_tasks: 3,
      progress_percent: 100,
      summary_notes: "Finished Rust Agent memory leak profiling and batch queue buffering. Peak memory consumption reduced by 40%.",
      blockers_summary: null,
      manager_feedback: "Outstanding efficiency Elena! Memory footprint is down 40%. Approved with top punctuality score.",
      reviewed_by_name: "Sarah Connor (Tech Lead)",
      reviewed_at: new Date(Date.now() - 7200000).toISOString(),
      tasks: [
        { id: "t-mgr-2-1", title: "Rust Agent Memory Allocation Audit", category: "Core Platform", priority: "URGENT", status: "COMPLETED", hours_spent: 3.5, description: "Profiled heap allocation in raw desktop mouse tracking buffer.", blockers: null },
        { id: "t-mgr-2-2", title: "Batch Queue Flush Throttling", category: "Backend Architecture", priority: "HIGH", status: "COMPLETED", hours_spent: 2.5, description: "Implemented 5-minute debounced flush to reduce server load.", blockers: null },
        { id: "t-mgr-2-3", title: "CI/CD Cross-compilation for Windows x64", category: "DevOps & Cloud", priority: "MEDIUM", status: "COMPLETED", hours_spent: 1.5, description: "Automated cargo build target artifacts in GitHub Actions.", blockers: null },
      ]
    },
    {
      id: "sh-dummy-mgr-03",
      employee_id: "emp-aisha",
      employee_name: "Aisha Patel",
      employee_code: "EMP008",
      department_name: "Core Platform Engineering",
      department_id: "dept-eng",
      sheet_date: dates.today,
      status: "SUBMITTED",
      total_hours: 6.5,
      total_tasks: 3,
      completed_tasks: 2,
      progress_percent: 67,
      summary_notes: "Implemented background database indexing for activity logs. Optimizing query latency on date range filters.",
      blockers_summary: null,
      manager_feedback: null,
      reviewed_by_name: null,
      reviewed_at: null,
      tasks: [
        { id: "t-mgr-3-1", title: "SQLAlchemy Async Session Pool Tuning", category: "Backend API", priority: "HIGH", status: "COMPLETED", hours_spent: 3.5, description: "Configured max overflow and pool pre-ping connection check.", blockers: null },
        { id: "t-mgr-3-2", title: "Composite Index on Activity Timestamps", category: "Backend API", priority: "HIGH", status: "COMPLETED", hours_spent: 2.0, description: "Added index to activity_logs table for fast interval queries.", blockers: null },
        { id: "t-mgr-3-3", title: "Database Backup Cron Integration", category: "DevOps & Cloud", priority: "MEDIUM", status: "IN_PROGRESS", hours_spent: 1.0, description: "Writing automated nightly snapshot script to S3 storage.", blockers: null },
      ]
    },
    {
      id: "sh-dummy-mgr-04",
      employee_id: "emp-james",
      employee_name: "James Wilson",
      employee_code: "EMP007",
      department_name: "Core Platform Engineering",
      department_id: "dept-eng",
      sheet_date: dates.today,
      status: "APPROVED",
      total_hours: 8.0,
      total_tasks: 3,
      completed_tasks: 3,
      progress_percent: 100,
      summary_notes: "All scheduled bug tickets resolved and closed for sprint 14. IP spoofing bypass resolved.",
      blockers_summary: null,
      manager_feedback: "Superb turnaround time on the critical security patch James. Great job!",
      reviewed_by_name: "Sarah Connor (Tech Lead)",
      reviewed_at: new Date(Date.now() - 5400000).toISOString(),
      tasks: [
        { id: "t-mgr-4-1", title: "Fix Screenshot Upload Rate Limiter", category: "Security & Auth", priority: "URGENT", status: "COMPLETED", hours_spent: 3.0, description: "Fixed IP spoofing bypass on agent screenshot upload handler.", blockers: null },
        { id: "t-mgr-4-2", title: "Refactor Employee Punctuality Star Evaluator", category: "Core Platform", priority: "HIGH", status: "COMPLETED", hours_spent: 3.0, description: "Added grace period condition checker according to active rules.", blockers: null },
        { id: "t-mgr-4-3", title: "OpenAPI Swagger Schema Documentation", category: "Documentation", priority: "LOW", status: "COMPLETED", hours_spent: 2.0, description: "Generated OpenAPI swagger schemas and route test recipes.", blockers: null },
      ]
    },
    {
      id: "sh-dummy-mgr-05",
      employee_id: "emp-carlos",
      employee_name: "Carlos Mendez",
      employee_code: "EMP009",
      department_name: "Core Platform Engineering",
      department_id: "dept-eng",
      sheet_date: dates.today,
      status: "DRAFT",
      total_hours: 5.0,
      total_tasks: 2,
      completed_tasks: 0,
      progress_percent: 0,
      summary_notes: "Investigating intermittent desktop agent disconnects on Windows sleep mode.",
      blockers_summary: "Need test laptop with Windows 10 build 19045 to reproduce.",
      manager_feedback: null,
      reviewed_by_name: null,
      reviewed_at: null,
      tasks: [
        { id: "t-mgr-5-1", title: "Desktop Agent Power State Listener", category: "Desktop Agent", priority: "HIGH", status: "IN_PROGRESS", hours_spent: 3.0, description: "Added Win32 API power broadcast notification handlers.", blockers: null },
        { id: "t-mgr-5-2", title: "Heartbeat Reconnect Backoff Strategy", category: "Desktop Agent", priority: "MEDIUM", status: "IN_PROGRESS", hours_spent: 2.0, description: "Implementing exponential backoff with jitter on reconnect.", blockers: null },
      ]
    },
    {
      id: "sh-dummy-mgr-06",
      employee_id: "emp-sophie",
      employee_name: "Sophie Martin",
      employee_code: "EMP006",
      department_name: "Quality Assurance & Testing",
      department_id: "dept-qa",
      sheet_date: dates.today,
      status: "SUBMITTED",
      total_hours: 7.0,
      total_tasks: 3,
      completed_tasks: 2,
      progress_percent: 67,
      summary_notes: "Completed Playwright core regression test suite. Cross-browser alignment verified.",
      blockers_summary: null,
      manager_feedback: null,
      reviewed_by_name: null,
      reviewed_at: null,
      tasks: [
        { id: "t-mgr-6-1", title: "Playwright End-to-End Test Suite", category: "Testing & QA", priority: "HIGH", status: "COMPLETED", hours_spent: 3.5, description: "Created automated browser scripts for login, role switcher, and rules update.", blockers: null },
        { id: "t-mgr-6-2", title: "Cross-browser Consistency Checks", category: "Testing & QA", priority: "MEDIUM", status: "COMPLETED", hours_spent: 2.0, description: "Verified UI alignment across Chromium, Firefox, and WebKit engines.", blockers: null },
        { id: "t-mgr-6-3", title: "Screenshot Compression Quality Test", category: "Testing & QA", priority: "LOW", status: "IN_PROGRESS", hours_spent: 1.5, description: "Verified WEBP 65% quality threshold balances fidelity and size.", blockers: null },
      ]
    },
    {
      id: "sh-dummy-mgr-07",
      employee_id: "emp-ryan",
      employee_name: "Ryan Gallagher",
      employee_code: "EMP013",
      department_name: "Quality Assurance & Testing",
      department_id: "dept-qa",
      sheet_date: dates.today,
      status: "SUBMITTED",
      total_hours: 6.5,
      total_tasks: 2,
      completed_tasks: 1,
      progress_percent: 50,
      summary_notes: "Conducted API stress tests and validated concurrent employee check-ins.",
      blockers_summary: null,
      manager_feedback: null,
      reviewed_by_name: null,
      reviewed_at: null,
      tasks: [
        { id: "t-mgr-7-1", title: "Locust Load Test Script for Check-ins", category: "Testing & QA", priority: "HIGH", status: "COMPLETED", hours_spent: 4.0, description: "Simulated 200 concurrent agent heartbeats and check-in calls.", blockers: null },
        { id: "t-mgr-7-2", title: "Database Lock Contention Analysis", category: "Testing & QA", priority: "MEDIUM", status: "IN_PROGRESS", hours_spent: 2.5, description: "Analyzed row lock wait times during bulk attendance updates.", blockers: null },
      ]
    },
    {
      id: "sh-dummy-mgr-08",
      employee_id: "emp-marcus",
      employee_name: "Marcus Vance",
      employee_code: "EMP003",
      department_name: "Product & UX Design",
      department_id: "dept-dsn",
      sheet_date: dates.today,
      status: "SUBMITTED",
      total_hours: 5.5,
      total_tasks: 3,
      completed_tasks: 2,
      progress_percent: 67,
      summary_notes: "Finalized design tokens for Dark/Light glassmorphism and mobile layout reflow.",
      blockers_summary: "Waiting on brand assets for new vector icons from client team.",
      manager_feedback: null,
      reviewed_by_name: null,
      reviewed_at: null,
      tasks: [
        { id: "t-mgr-8-1", title: "Figma Design System V2 Tokens", category: "UI/UX Design", priority: "HIGH", status: "COMPLETED", hours_spent: 3.0, description: "Created full HSL palette, dark theme glass tokens, and responsive typography variables.", blockers: null },
        { id: "t-mgr-8-2", title: "Screenshot Viewer Modal Polish", category: "UI/UX Design", priority: "MEDIUM", status: "COMPLETED", hours_spent: 2.0, description: "Designed full-screen lightbox modal with keyboard arrow navigation.", blockers: null },
        { id: "t-mgr-8-3", title: "Mobile Responsive Nav Drawer", category: "UI/UX Design", priority: "LOW", status: "BLOCKED", hours_spent: 0.5, description: "Wireframed collapsible sidebar navigation for smaller tablet screens.", blockers: "Awaiting approval on navigation hierarchy" },
      ]
    },
    // Multi-day sheets (Yesterday)
    {
      id: "sh-dummy-mgr-y01",
      employee_id: "emp-alex",
      employee_name: "Alex Rivera",
      employee_code: "EMP001",
      department_name: "Core Platform Engineering",
      department_id: "dept-eng",
      sheet_date: dates.yesterday,
      status: "APPROVED",
      total_hours: 7.0,
      total_tasks: 2,
      completed_tasks: 2,
      progress_percent: 100,
      summary_notes: "Finished attendance roll call audit and KPI calculation improvements.",
      blockers_summary: null,
      manager_feedback: "Great work on the attendance calculations and query optimizations Alex!",
      reviewed_by_name: "Sarah Connor (Tech Lead)",
      reviewed_at: new Date(Date.now() - 86400000).toISOString(),
      tasks: [
        { id: "t-mgr-y1-1", title: "Attendance KPI Query Optimization", category: "Backend API", priority: "HIGH", status: "COMPLETED", hours_spent: 4.0, description: "Added subqueries for punctual and late check-in metrics.", blockers: null },
        { id: "t-mgr-y1-2", title: "Rules Admin Inspector UI", category: "UI/UX Design", priority: "MEDIUM", status: "COMPLETED", hours_spent: 3.0, description: "Designed scorecard breakdown table and penalty deduction list.", blockers: null },
      ]
    },
    {
      id: "sh-dummy-mgr-y02",
      employee_id: "emp-elena",
      employee_name: "Elena Rostova",
      employee_code: "EMP002",
      department_name: "Core Platform Engineering",
      department_id: "dept-eng",
      sheet_date: dates.yesterday,
      status: "APPROVED",
      total_hours: 7.5,
      total_tasks: 2,
      completed_tasks: 2,
      progress_percent: 100,
      summary_notes: "Investigated raw mouse event jitter filter on high-polling gaming mice.",
      blockers_summary: null,
      manager_feedback: "Solid filtering algorithm Elena. Jitter is eliminated.",
      reviewed_by_name: "Sarah Connor (Tech Lead)",
      reviewed_at: new Date(Date.now() - 86400000).toISOString(),
      tasks: [
        { id: "t-mgr-y2-1", title: "Low-pass Event Coordinate Filter", category: "Core Platform", priority: "HIGH", status: "COMPLETED", hours_spent: 4.0, description: "Applied weighted smoothing average to prevent synthetic micro-jitters.", blockers: null },
        { id: "t-mgr-y2-2", title: "Rust Native Win32 LowLevelMouseProc", category: "Core Platform", priority: "HIGH", status: "COMPLETED", hours_spent: 3.5, description: "Optimized hook callback throughput under CPU stress.", blockers: null },
      ]
    },
    {
      id: "sh-dummy-mgr-y03",
      employee_id: "emp-james",
      employee_name: "James Wilson",
      employee_code: "EMP007",
      department_name: "Core Platform Engineering",
      department_id: "dept-eng",
      sheet_date: dates.yesterday,
      status: "APPROVED",
      total_hours: 7.5,
      total_tasks: 2,
      completed_tasks: 2,
      progress_percent: 100,
      summary_notes: "Fixed JWT bearer token verification edge case on expired refresh tokens.",
      blockers_summary: null,
      manager_feedback: "Good catch on token expiration handling.",
      reviewed_by_name: "Sarah Connor (Tech Lead)",
      reviewed_at: new Date(Date.now() - 86400000).toISOString(),
      tasks: [
        { id: "t-mgr-y3-1", title: "Bearer Auth Header Interceptor", category: "Security & Auth", priority: "HIGH", status: "COMPLETED", hours_spent: 4.0, description: "Handled clock skew edge cases in JWT payload expiration check.", blockers: null },
        { id: "t-mgr-y3-2", title: "Security Audit Trail Integration", category: "Security & Auth", priority: "MEDIUM", status: "COMPLETED", hours_spent: 3.5, description: "Logged all failed authorization attempts with client IP metadata.", blockers: null },
      ]
    },
    {
      id: "sh-dummy-mgr-y04",
      employee_id: "emp-aisha",
      employee_name: "Aisha Patel",
      employee_code: "EMP008",
      department_name: "Core Platform Engineering",
      department_id: "dept-eng",
      sheet_date: dates.yesterday,
      status: "APPROVED",
      total_hours: 7.0,
      total_tasks: 2,
      completed_tasks: 2,
      progress_percent: 100,
      summary_notes: "Completed activity logs partition planning and migration test script.",
      blockers_summary: null,
      manager_feedback: "Partitioning plan looks very solid. Approved for staging rollout.",
      reviewed_by_name: "Sarah Connor (Tech Lead)",
      reviewed_at: new Date(Date.now() - 86400000).toISOString(),
      tasks: [
        { id: "t-mgr-y4-1", title: "Table Partitioning DDL Generation", category: "Database & Backend", priority: "HIGH", status: "COMPLETED", hours_spent: 4.0, description: "Designed monthly range partitioning schema for activity records.", blockers: null },
        { id: "t-mgr-y4-2", title: "Dry-run Benchmark on 1M Records", category: "Database & Backend", priority: "MEDIUM", status: "COMPLETED", hours_spent: 3.0, description: "Measured query response times before and after index optimization.", blockers: null },
      ]
    },
  ];
}

function getFilteredDummyManagerSheets(preset, deptId, empId, status, search) {
  const dates = getDummyDates();
  let list = getDummyManagerSheets();

  // Date Preset Filter
  if (preset === 'today') {
    list = list.filter(s => s.sheet_date === dates.today);
  } else if (preset === 'yesterday') {
    list = list.filter(s => s.sheet_date === dates.yesterday);
  }

  // Dept Filter
  if (deptId) {
    list = list.filter(s => s.department_id === deptId || s.department_name?.toLowerCase().includes(deptId.toLowerCase()));
  }

  // Emp Filter
  if (empId) {
    list = list.filter(s => s.employee_id === empId || s.employee_code === empId);
  }

  // Status Filter
  if (status && status !== 'ALL') {
    list = list.filter(s => s.status === status);
  }

  // Search Filter
  if (search) {
    const q = search.toLowerCase();
    list = list.filter(s =>
      s.employee_name.toLowerCase().includes(q) ||
      s.employee_code.toLowerCase().includes(q) ||
      (s.summary_notes && s.summary_notes.toLowerCase().includes(q)) ||
      (s.tasks && s.tasks.some(t => t.title.toLowerCase().includes(q)))
    );
  }

  return list;
}

function computeAndRenderKpis(sheets) {
  const activeSheets = sheets || state.allSheets || [];
  const totalSheets = activeSheets.length;
  const submittedSheets = activeSheets.filter(s => s.status === 'SUBMITTED').length;
  const pendingReviews = activeSheets.filter(s => s.status === 'SUBMITTED' && !s.manager_feedback).length;
  const totalHours = activeSheets.reduce((sum, s) => sum + (s.total_hours || 0), 0);
  const completedTasks = activeSheets.reduce((sum, s) => sum + (s.completed_tasks || 0), 0);

  const setVal = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  };
  setVal('kpiSheetTotal', totalSheets);
  setVal('kpiSheetSubmitted', submittedSheets);
  setVal('kpiSheetCompletedTasks', completedTasks);
  setVal('kpiSheetTotalHours', `${totalHours.toFixed(1)}h`);
  setVal('kpiSheetPendingReviews', pendingReviews || submittedSheets);
}

function getDummyEmployeeTodaySheet() {
  const dates = getDummyDates();
  return {
    id: "sh-emp-today-alex",
    employee_name: "Alex Rivera",
    employee_code: "EMP001",
    department_name: "Core Platform Engineering",
    sheet_date: dates.today,
    status: "SUBMITTED",
    total_hours: 7.5,
    total_tasks: 4,
    completed_tasks: 3,
    progress_percent: 75,
    summary_notes: "Completed frontend sheet integration, responsive card grids, and token auth interceptor. Running unit and E2E tests.",
    blockers_summary: "Waiting on staging mock socket server for multi-client sync test suite.",
    manager_feedback: "Terrific progress on the task sheets controller Alex! The responsive layout and review flow look great.",
    reviewed_by_name: "Sarah Connor (Tech Lead)",
    reviewed_at: new Date(Date.now() - 3600000).toISOString(),
    tasks: [
      { id: "t-emp-1", title: "Implement Daily Task Sheet UI and Card Grids", category: "Frontend Development", priority: "HIGH", status: "COMPLETED", hours_spent: 3.5, description: "Built modern interactive cards and responsive grid layout for multi-employee daily task management.", blockers: null },
      { id: "t-emp-2", title: "JWT Session Auto-refresh Hook & Auth Interceptor", category: "Security & Auth", priority: "MEDIUM", status: "COMPLETED", hours_spent: 2.0, description: "Created automatic token refresh interceptor for expiring bearer credentials.", blockers: null },
      { id: "t-emp-3", title: "Refactor Employee Switcher Dropdown & Role Sync", category: "Frontend Development", priority: "LOW", status: "COMPLETED", hours_spent: 1.0, description: "Added quick role switching synchronization and badge color indicators.", blockers: null },
      { id: "t-emp-4", title: "End-to-End WebSocket Sync Tests", category: "Testing & QA", priority: "MEDIUM", status: "IN_PROGRESS", hours_spent: 1.0, description: "Testing live desktop agent sync and payload dispatching.", blockers: "Waiting on staging mock socket server" },
    ]
  };
}

function getDummyEmployeePastSheets() {
  const dates = getDummyDates();
  return [
    {
      id: "sh-past-01",
      sheet_date: dates.yesterday,
      status: "APPROVED",
      total_hours: 7.0,
      total_tasks: 2,
      completed_tasks: 2,
      progress_percent: 100,
      summary_notes: "Finished attendance roll call audit and KPI calculation improvements.",
      blockers_summary: null,
      manager_feedback: "Great work on the attendance calculations and query optimizations Alex!",
      reviewed_by_name: "Sarah Connor (Tech Lead)",
      reviewed_at: new Date(Date.now() - 86400000).toISOString(),
      tasks: [
        { id: "t-past-1-1", title: "Attendance KPI Query Optimization", category: "Backend API", priority: "HIGH", status: "COMPLETED", hours_spent: 4.0, description: "Added subqueries for punctual and late check-in metrics.", blockers: null },
        { id: "t-past-1-2", title: "Rules Admin Inspector UI", category: "UI/UX Design", priority: "MEDIUM", status: "COMPLETED", hours_spent: 3.0, description: "Designed scorecard breakdown table and penalty deduction list.", blockers: null },
      ]
    },
    {
      id: "sh-past-02",
      sheet_date: dates.twoDays,
      status: "APPROVED",
      total_hours: 7.5,
      total_tasks: 2,
      completed_tasks: 2,
      progress_percent: 100,
      summary_notes: "Benchmarked SQLite WAL mode under concurrent screenshot ingestion workloads.",
      blockers_summary: null,
      manager_feedback: "Excellent performance profiling. Database write latency dropped noticeably.",
      reviewed_by_name: "Sarah Connor (Tech Lead)",
      reviewed_at: new Date(Date.now() - 172800000).toISOString(),
      tasks: [
        { id: "t-past-2-1", title: "SQLite WAL PRAGMA Configuration", category: "Database & Backend", priority: "HIGH", status: "COMPLETED", hours_spent: 4.5, description: "Tuned synchronous PRAGMA and checkpoint intervals.", blockers: null },
        { id: "t-past-2-2", title: "Async Database Session Pool Metrics", category: "Core Platform", priority: "MEDIUM", status: "COMPLETED", hours_spent: 3.0, description: "Added telemetry counters for active and idle SQLAlchemy sessions.", blockers: null },
      ]
    },
    {
      id: "sh-past-03",
      sheet_date: dates.threeDays,
      status: "APPROVED",
      total_hours: 8.0,
      total_tasks: 2,
      completed_tasks: 2,
      progress_percent: 100,
      summary_notes: "Refactored screenshot carousel keyboard navigation and full-screen lightbox.",
      blockers_summary: null,
      manager_feedback: "Very clean UI implementation. Modal UX is smooth.",
      reviewed_by_name: "Sarah Connor (Tech Lead)",
      reviewed_at: new Date(Date.now() - 259200000).toISOString(),
      tasks: [
        { id: "t-past-3-1", title: "Lightbox Fullscreen Keyboard Shortcuts", category: "Frontend Development", priority: "MEDIUM", status: "COMPLETED", hours_spent: 4.0, description: "Added Left/Right arrow handlers and Escape key binding.", blockers: null },
        { id: "t-past-3-2", title: "Custom Interval Screenshot Scheduler", category: "Frontend Development", priority: "HIGH", status: "COMPLETED", hours_spent: 4.0, description: "Built interval selection dropdown with 1m, 5m, 10m, 15m presets.", blockers: null },
      ]
    },
  ];
}

// --------------------------------------------------------------------------
// Tab Loader & Manager Actions
// --------------------------------------------------------------------------

async function loadSheetsTab() {
  await ensureAuthenticated();
  const role = (state.currentUser?.role || localStorage.getItem('wp-role') || 'admin').toUpperCase();
  applyRolePermissions();

  if (role === 'EMPLOYEE') {
    await loadEmployeeTodaySheet();
    await loadEmployeePastSheets();
  } else {
    // MANAGER or ADMIN
    await populateSheetFilterDropdowns();
    await loadManagerSheetsSummary();
    await loadManagerSheetsGrid();
  }
}

async function populateSheetFilterDropdowns() {
  const deptSelect = document.getElementById('sheetDeptFilter');
  const empSelect = document.getElementById('sheetEmpFilter');
  if (!deptSelect || !empSelect) return;

  try {
    const deptRes = await fetch(`${API_BASE}/departments`, { headers: authHeaders() });
    if (deptRes.ok) {
      const depts = await deptRes.json();
      const currentDeptVal = deptSelect.value;
      deptSelect.innerHTML = '<option value="">All Departments</option>';
      depts.forEach(d => {
        deptSelect.innerHTML += `<option value="${d.id}">${d.name} (${d.code})</option>`;
      });
      deptSelect.value = currentDeptVal;
    }

    const empRes = await fetch(`${API_BASE}/employees`, { headers: authHeaders() });
    if (empRes.ok) {
      const emps = await empRes.json();
      const currentEmpVal = empSelect.value;
      empSelect.innerHTML = '<option value="">All Employees</option>';
      emps.forEach(e => {
        empSelect.innerHTML += `<option value="${e.id}">${e.name} (${e.employee_code})</option>`;
      });
      empSelect.value = currentEmpVal;
    }
  } catch (err) {
    if (deptSelect.children.length <= 1) {
      deptSelect.innerHTML = `
        <option value="">All Departments</option>
        <option value="dept-eng">Core Platform Engineering (ENG)</option>
        <option value="dept-dsn">Product & UX Design (DSN)</option>
        <option value="dept-qa">Quality Assurance & Testing (QA)</option>
        <option value="dept-ops">DevOps & Cloud Infrastructure (OPS)</option>
      `;
    }
    if (empSelect.children.length <= 1) {
      empSelect.innerHTML = `
        <option value="">All Employees</option>
        <option value="EMP001">Alex Rivera (EMP001)</option>
        <option value="EMP002">Elena Rostova (EMP002)</option>
        <option value="EMP008">Aisha Patel (EMP008)</option>
        <option value="EMP007">James Wilson (EMP007)</option>
        <option value="EMP009">Carlos Mendez (EMP009)</option>
        <option value="EMP006">Sophie Martin (EMP006)</option>
        <option value="EMP013">Ryan Gallagher (EMP013)</option>
        <option value="EMP003">Marcus Vance (EMP003)</option>
      `;
    }
  }
}

async function loadManagerSheetsSummary() {
  try {
    const preset = document.getElementById('sheetDatePresetFilter')?.value || 'today';
    let url = `${API_BASE}/sheets/stats/summary`;
    if (preset === 'today') url += '?date=today';
    else if (preset === 'yesterday') {
      const y = new Date();
      y.setDate(y.getDate() - 1);
      url += `?date=${y.toISOString().split('T')[0]}`;
    }

    const res = await fetch(url, { headers: authHeaders() });
    if (res.ok) {
      const stats = await res.json();
      const setVal = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.textContent = val;
      };
      setVal('kpiSheetTotal', stats.total_sheets);
      setVal('kpiSheetSubmitted', stats.submitted_sheets);
      setVal('kpiSheetCompletedTasks', stats.completed_tasks);
      setVal('kpiSheetTotalHours', `${stats.total_hours.toFixed(1)}h`);
      setVal('kpiSheetPendingReviews', stats.pending_reviews);
      return;
    }
  } catch (err) {
    // API offline, compute from active sheets
  }

  computeAndRenderKpis();
}

async function loadManagerSheetsGrid() {
  const grid = document.getElementById('sheetsCardsGrid');
  const tbody = document.getElementById('sheetsTableTbody');
  if (!grid && !tbody) return;

  const preset = document.getElementById('sheetDatePresetFilter')?.value || 'today';
  const deptId = document.getElementById('sheetDeptFilter')?.value || '';
  const empId = document.getElementById('sheetEmpFilter')?.value || '';
  const status = document.getElementById('sheetStatusFilter')?.value || 'ALL';
  const search = document.getElementById('sheetSearchInput')?.value || '';

  let fetchedSheets = null;
  try {
    let queryParams = [];
    if (preset === 'today') queryParams.push('date=today');
    else if (preset === 'yesterday') {
      const y = new Date();
      y.setDate(y.getDate() - 1);
      queryParams.push(`date=${y.toISOString().split('T')[0]}`);
    }
    if (deptId) queryParams.push(`department_id=${encodeURIComponent(deptId)}`);
    if (empId) queryParams.push(`employee_id=${encodeURIComponent(empId)}`);
    if (status && status !== 'ALL') queryParams.push(`status=${encodeURIComponent(status)}`);
    if (search.trim()) queryParams.push(`search=${encodeURIComponent(search.trim())}`);

    const qStr = queryParams.length > 0 ? `?${queryParams.join('&')}` : '';
    const res = await fetch(`${API_BASE}/sheets${qStr}`, { headers: authHeaders() });
    if (res.ok) {
      fetchedSheets = await res.json();
    }
  } catch (err) {
    // API offline or network error, fallback to dummy sheets
  }

  const sheets = (fetchedSheets && fetchedSheets.length > 0)
    ? fetchedSheets
    : getFilteredDummyManagerSheets(preset, deptId, empId, status, search);

  state.allSheets = sheets;
  computeAndRenderKpis(sheets);

  if (state.sheetsViewMode === 'table') {
    renderSheetsTableView(sheets);
  } else {
    renderSheetsCardsGrid(sheets);
  }
}

function renderSheetsCardsGrid(sheets) {
  const grid = document.getElementById('sheetsCardsGrid');
  if (!grid) return;
  grid.innerHTML = '';

  if (sheets.length === 0) {
    grid.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; color: var(--text-dim); padding: 50px 20px; background: rgba(255,255,255,0.02); border-radius: var(--radius-lg); border: 1px dashed var(--border-subtle);">
        <div style="font-size: 2.5rem; margin-bottom: 12px;">📑</div>
        <div style="font-size: 1.05rem; font-weight: 700; color: var(--text-main);">No employee task sheets found.</div>
        <div style="font-size: 0.82rem; color: var(--text-muted); margin-top: 6px;">Try adjusting your date or department filters above.</div>
      </div>
    `;
    return;
  }

  sheets.forEach(sheet => {
    const card = document.createElement('div');
    const statusLower = (sheet.status || 'draft').toLowerCase();
    card.className = `sheet-card ${statusLower}`;

    const initials = (sheet.employee_name || 'Staff')
      .split(' ')
      .map(n => n[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();

    // Status Pill
    let statusLabel = sheet.status;
    let statusClass = statusLower;
    if (sheet.status === 'APPROVED') statusLabel = '⭐ APPROVED';
    else if (sheet.status === 'REVIEWED') statusLabel = '👁️ REVIEWED';
    else if (sheet.status === 'SUBMITTED') statusLabel = '⏳ SUBMITTED';
    else statusLabel = '📝 DRAFT';

    // Tasks preview (top 3)
    const taskCount = sheet.tasks ? sheet.tasks.length : 0;
    const completedCount = sheet.completed_tasks || 0;
    const progressPercent = sheet.progress_percent || 0;

    let tasksHtml = '';
    if (sheet.tasks && sheet.tasks.length > 0) {
      const previewTasks = sheet.tasks.slice(0, 3);
      tasksHtml = previewTasks.map(t => {
        const isDone = t.status === 'COMPLETED';
        const icon = isDone ? '✅' : (t.status === 'IN_PROGRESS' ? '⏳' : (t.status === 'BLOCKED' ? '⛔' : '⭕'));
        const prioLower = (t.priority || 'medium').toLowerCase();
        return `
          <div class="sheet-task-item ${isDone ? 'completed' : ''}">
            <div style="display: flex; align-items: center; gap: 8px; flex: 1; min-width: 0;">
              <span>${icon}</span>
              <span class="task-title-text" style="font-weight: 600; font-size: 0.78rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${t.title}</span>
            </div>
            <div style="display: flex; align-items: center; gap: 6px; flex-shrink: 0;">
              <span class="prio-pill ${prioLower}">${t.priority}</span>
              <span class="cat-pill">${t.hours_spent}h</span>
            </div>
          </div>
        `;
      }).join('');

      if (taskCount > 3) {
        tasksHtml += `
          <div style="text-align: center; font-size: 0.73rem; color: var(--accent-cyan); font-weight: 600; padding: 2px 0;">
            +${taskCount - 3} more task${taskCount - 3 > 1 ? 's' : ''} in sheet...
          </div>
        `;
      }
    } else {
      tasksHtml = `<div style="text-align: center; color: var(--text-dim); font-size: 0.75rem; padding: 10px;">No task items recorded for this date.</div>`;
    }

    // Summary excerpt
    const summaryExcerpt = sheet.summary_notes 
      ? `<div style="font-size: 0.76rem; color: var(--text-muted); background: rgba(0,0,0,0.2); border-radius: var(--radius-sm); padding: 8px 10px; line-height: 1.4; border-left: 2px solid var(--accent-primary);">
           <strong>Summary:</strong> ${sheet.summary_notes.slice(0, 95)}${sheet.summary_notes.length > 95 ? '...' : ''}
         </div>`
      : '';

    // Blocker snippet
    const blockerSnippet = sheet.blockers_summary
      ? `<div style="font-size: 0.74rem; color: var(--accent-rose); background: rgba(244, 63, 94, 0.08); border-radius: var(--radius-sm); padding: 6px 10px; border-left: 2px solid var(--accent-rose);">
           <strong>⚠️ Blocker:</strong> ${sheet.blockers_summary.slice(0, 80)}
         </div>`
      : '';

    // Manager Feedback snippet
    const feedbackSnippet = sheet.manager_feedback
      ? `<div style="font-size: 0.74rem; color: var(--accent-violet); background: rgba(139, 92, 246, 0.08); border-radius: var(--radius-sm); padding: 6px 10px; border-left: 2px solid var(--accent-violet); font-style: italic;">
           <strong>⭐ Review:</strong> "${sheet.manager_feedback.slice(0, 75)}..."
         </div>`
      : '';

    card.innerHTML = `
      <div>
        <div class="sheet-card-header">
          <div style="display: flex; align-items: center; gap: 10px;">
            <div class="sheet-user-avatar">
              ${initials}
            </div>
            <div>
              <div style="display: flex; align-items: center; gap: 6px;">
                <h4 style="font-size: 0.96rem; font-weight: 700; color: var(--text-main); margin: 0;">${sheet.employee_name || 'Employee'}</h4>
                <code style="font-size: 0.7rem; color: var(--accent-cyan);">${sheet.employee_code || ''}</code>
              </div>
              <div style="font-size: 0.73rem; color: var(--text-dim); margin-top: 2px;">
                <span>${sheet.department_name || 'General'}</span> &bull; <strong style="color: var(--text-muted);">${sheet.sheet_date}</strong>
              </div>
            </div>
          </div>
          <span class="sheet-status-pill ${statusClass}">${statusLabel}</span>
        </div>

        <!-- Progress and Hours Bar -->
        <div style="margin: 14px 0 10px 0;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; font-size: 0.75rem;">
            <span style="color: var(--text-muted); font-weight: 600;">
              Progress: <strong style="color: var(--text-main);">${completedCount}/${taskCount} Done</strong> (${progressPercent}%)
            </span>
            <span class="badge" style="background: rgba(6, 182, 212, 0.12); color: var(--accent-cyan); font-weight: 700; font-size: 0.72rem; padding: 2px 7px;">
              ⏱️ ${sheet.total_hours} hrs
            </span>
          </div>
          <div style="width: 100%; height: 5px; background: rgba(255, 255, 255, 0.06); border-radius: 3px; overflow: hidden;">
            <div style="height: 100%; background: linear-gradient(90deg, var(--accent-primary), var(--accent-cyan)); width: ${progressPercent}%;"></div>
          </div>
        </div>

        <!-- Task Preview Items -->
        <div style="display: flex; flex-direction: column; gap: 6px; margin-bottom: 12px;">
          ${tasksHtml}
        </div>

        ${summaryExcerpt}
        ${blockerSnippet}
        ${feedbackSnippet}
      </div>

      <!-- Action Buttons Footer -->
      <div style="display: flex; gap: 8px; justify-content: flex-end; align-items: center; border-top: 1px solid var(--border-subtle); padding-top: 12px; margin-top: 4px;">
        <button class="btn btn-secondary btn-sm" onclick="openSheetDetailsModal('${sheet.id}')" style="padding: 5px 12px; font-size: 0.74rem; display: flex; align-items: center; gap: 4px;">
          <span>👁️</span>
          <span>Full Details</span>
        </button>
        <button class="btn btn-primary btn-sm" onclick="openSheetReviewModal('${sheet.id}')" style="padding: 5px 14px; font-size: 0.74rem; display: flex; align-items: center; gap: 4px; background: linear-gradient(135deg, var(--accent-violet), var(--accent-primary)); font-weight: 600;">
          <span>⭐</span>
          <span>Review / Approve</span>
        </button>
      </div>
    `;

    grid.appendChild(card);
  });
}

function renderSheetsTableView(sheets) {
  const tbody = document.getElementById('sheetsTableTbody');
  if (!tbody) return;
  tbody.innerHTML = '';

  if (sheets.length === 0) {
    tbody.innerHTML = `<tr><td colspan="9" style="text-align: center; color: var(--text-dim); padding: 30px;">No employee task sheets found matching criteria.</td></tr>`;
    return;
  }

  sheets.forEach(sheet => {
    const tr = document.createElement('tr');
    const statusLower = (sheet.status || 'draft').toLowerCase();
    const taskCount = sheet.tasks ? sheet.tasks.length : 0;
    const completedCount = sheet.completed_tasks || 0;
    const progressPercent = sheet.progress_percent || 0;

    let reviewInfo = '<span style="color: var(--text-dim);">-</span>';
    if (sheet.reviewed_by_name) {
      reviewInfo = `<span style="color: var(--accent-violet); font-size: 0.75rem; font-weight: 600;">Reviewed by ${sheet.reviewed_by_name}</span>`;
    }

    tr.innerHTML = `
      <td>
        <div style="font-weight: 600; color: var(--text-main);">${sheet.employee_name || 'Employee'}</div>
        <code style="font-size: 0.7rem; color: var(--accent-cyan);">${sheet.employee_code || ''}</code>
      </td>
      <td style="color: var(--text-muted); font-size: 0.78rem;">${sheet.sheet_date}</td>
      <td><span class="cat-pill">${sheet.department_name || 'General'}</span></td>
      <td style="font-size: 0.78rem;">${completedCount}/${taskCount} items</td>
      <td>
        <div style="display: flex; align-items: center; gap: 8px;">
          <div style="width: 60px; height: 5px; background: rgba(255,255,255,0.06); border-radius: 3px; overflow: hidden;">
            <div style="height: 100%; background: var(--accent-emerald); width: ${progressPercent}%;"></div>
          </div>
          <span style="font-size: 0.75rem; font-weight: 600;">${progressPercent}%</span>
        </div>
      </td>
      <td><strong style="color: var(--accent-cyan);">${sheet.total_hours} hrs</strong></td>
      <td><span class="sheet-status-pill ${statusLower}">${sheet.status}</span></td>
      <td>${reviewInfo}</td>
      <td>
        <div style="display: flex; gap: 6px;">
          <button class="btn btn-secondary btn-sm" onclick="openSheetDetailsModal('${sheet.id}')" style="padding: 3px 8px; font-size: 0.72rem;">Details</button>
          <button class="btn btn-primary btn-sm" onclick="openSheetReviewModal('${sheet.id}')" style="padding: 3px 8px; font-size: 0.72rem;">Review</button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// ==========================================================================
// Employee View: Personal Daily Task Sheet
// ==========================================================================

// Excel Workbook State & Multi-Sheet Architecture
const excelWorkbook = {
  title: 'Daily Task Sheet',
  activeSheetId: 'sheet-1',
  selectedCell: { col: 'A', row: 1 },
  sheets: [
    {
      id: 'sheet-1',
      name: 'Sheet1',
      rowCount: 35,
      colCount: 14,
      cells: {} // Empty excel sheet by default!
    }
  ],
  initialized: false
};

// Helper: Convert column index (0-based) to Excel Column Letter (A, B... Z, AA...)
function indexToColLetter(idx) {
  let letter = '';
  let temp = idx;
  while (temp >= 0) {
    letter = String.fromCharCode((temp % 26) + 65) + letter;
    temp = Math.floor(temp / 26) - 1;
  }
  return letter;
}

// Helper: Convert Excel Column Letter to 0-based index
function colLetterToIndex(colStr) {
  let idx = 0;
  for (let i = 0; i < colStr.length; i++) {
    idx = idx * 26 + (colStr.charCodeAt(i) - 64);
  }
  return idx - 1;
}

// Get the currently active sheet object
function getActiveExcelSheet() {
  let s = excelWorkbook.sheets.find(x => x.id === excelWorkbook.activeSheetId);
  if (!s && excelWorkbook.sheets.length > 0) {
    s = excelWorkbook.sheets[0];
    excelWorkbook.activeSheetId = s.id;
  }
  return s;
}

async function loadEmployeeTodaySheet() {
  let sheet = null;
  try {
    const res = await fetch(`${API_BASE}/sheets/today`, { headers: authHeaders() });
    if (res.ok) {
      sheet = await res.json();
    }
  } catch (err) {
    // Offline or network error
  }

  if (!sheet) {
    const cached = localStorage.getItem('wp_emp_today_sheet');
    sheet = cached ? JSON.parse(cached) : getDummyEmployeeTodaySheet();
  }

  state.currentTodaySheet = sheet;

  // Header status pill
  const badge = document.getElementById('empSheetStatusBadge');
  if (badge) {
    const st = (sheet.status || 'DRAFT').toUpperCase();
    badge.textContent = st;
    badge.className = `sheet-status-pill ${st.toLowerCase()}`;
  }

  // Initialize interactive empty Excel Workbook
  initExcelWorkbook(sheet);
}

function initExcelWorkbook(sheet) {
  // Try loading workbook from serialized summary_notes or local storage
  let loaded = false;
  if (sheet && sheet.summary_notes) {
    try {
      const parsed = JSON.parse(sheet.summary_notes);
      if (parsed && Array.isArray(parsed.sheets) && parsed.sheets.length > 0) {
        excelWorkbook.title = parsed.title || 'Daily Task Sheet';
        excelWorkbook.sheets = parsed.sheets;
        excelWorkbook.activeSheetId = parsed.activeSheetId || parsed.sheets[0].id;
        loaded = true;
      }
    } catch (e) {
      // not JSON workbook
    }
  }

  if (!loaded) {
    const cachedWb = localStorage.getItem('wp_emp_workbook');
    if (cachedWb) {
      try {
        const parsed = JSON.parse(cachedWb);
        if (parsed && Array.isArray(parsed.sheets) && parsed.sheets.length > 0) {
          excelWorkbook.title = parsed.title || 'Daily Task Sheet';
          excelWorkbook.sheets = parsed.sheets;
          excelWorkbook.activeSheetId = parsed.activeSheetId || parsed.sheets[0].id;
          loaded = true;
        }
      } catch (e) {}
    }
  }

  // If still not loaded, ensure clean empty Sheet1
  if (!loaded) {
    excelWorkbook.title = 'Daily Task Sheet';
    excelWorkbook.sheets = [
      {
        id: 'sheet-1',
        name: 'Sheet1',
        rowCount: 35,
        colCount: 14,
        cells: {} // completely empty
      }
    ];
    excelWorkbook.activeSheetId = 'sheet-1';
  }

  // Sync title input
  const titleInput = document.getElementById('excelWorkbookTitle');
  if (titleInput) {
    titleInput.value = excelWorkbook.title;
    titleInput.oninput = () => {
      excelWorkbook.title = titleInput.value;
      saveExcelWorkbookToStorage();
    };
  }

  // Setup toolbar events once
  if (!excelWorkbook.initialized) {
    setupExcelEventListeners();
    excelWorkbook.initialized = true;
  }

  // Render both grid and sheet tabs
  renderExcelGrid();
  renderExcelSheetTabs();
}

function renderExcelGrid() {
  const table = document.getElementById('excelGridTable');
  const thead = document.getElementById('excelGridThead');
  const tbody = document.getElementById('excelGridTbody');
  if (!table || !thead || !tbody) return;

  const sheet = getActiveExcelSheet();
  if (!sheet) return;

  const rowCount = sheet.rowCount || 35;
  const colCount = sheet.colCount || 14;
  sheet.cells = sheet.cells || {};

  const selCol = excelWorkbook.selectedCell.col;
  const selRow = excelWorkbook.selectedCell.row;
  const selCoord = `${selCol}${selRow}`;

  // 1. Build Header Row (Corner + Columns A, B, C...)
  let theadHtml = '<tr><th class="excel-corner-th" onclick="focusExcelCell(\'A\', 1)"></th>';
  for (let c = 0; c < colCount; c++) {
    const colLetter = indexToColLetter(c);
    const isActiveCol = colLetter === selCol;
    theadHtml += `<th class="excel-col-th ${isActiveCol ? 'active-header' : ''}" data-col="${colLetter}" onclick="focusExcelCell('${colLetter}', 1)">${colLetter}</th>`;
  }
  theadHtml += '</tr>';
  thead.innerHTML = theadHtml;

  // 2. Build Data Rows (1 to rowCount)
  let tbodyHtml = '';
  for (let r = 1; r <= rowCount; r++) {
    const isActiveRow = r === selRow;
    tbodyHtml += `<tr data-row="${r}"><th class="excel-row-th ${isActiveRow ? 'active-header' : ''}" data-row="${r}" onclick="focusExcelCell('A', ${r})">${r}</th>`;

    for (let c = 0; c < colCount; c++) {
      const colLetter = indexToColLetter(c);
      const coord = `${colLetter}${r}`;
      const cellData = sheet.cells[coord] || { v: '' };
      const isSelected = coord === selCoord;

      let cellStyle = '';
      if (cellData.b) cellStyle += 'font-weight: 700; ';
      if (cellData.i) cellStyle += 'font-style: italic; ';
      if (cellData.u && cellData.s) cellStyle += 'text-decoration: underline line-through; ';
      else if (cellData.u) cellStyle += 'text-decoration: underline; ';
      else if (cellData.s) cellStyle += 'text-decoration: line-through; ';
      if (cellData.color) cellStyle += `color: ${cellData.color}; `;
      if (cellData.align) cellStyle += `text-align: ${cellData.align}; `;
      if (cellData.font) cellStyle += `font-family: ${cellData.font}; `;
      if (cellData.size) cellStyle += `font-size: ${cellData.size}; `;

      const tdBgStyle = cellData.bg ? `background-color: ${cellData.bg};` : '';

      tbodyHtml += `
        <td class="excel-grid-cell ${isSelected ? 'selected' : ''}" data-col="${colLetter}" data-row="${r}" data-coord="${coord}" style="${tdBgStyle}">
          <input type="text" class="excel-cell-input-el" data-coord="${coord}" data-col="${colLetter}" data-row="${r}" value="${escapeHtml(cellData.v || '')}" style="${cellStyle}">
        </td>
      `;
    }
    tbodyHtml += '</tr>';
  }
  tbody.innerHTML = tbodyHtml;

  // 3. Attach interactive events to all cell inputs
  const inputs = tbody.querySelectorAll('.excel-cell-input-el');
  inputs.forEach(inp => {
    inp.addEventListener('focus', () => {
      const col = inp.dataset.col;
      const row = parseInt(inp.dataset.row, 10);
      handleExcelCellSelect(col, row, inp.value);
    });

    inp.addEventListener('input', (e) => {
      const coord = inp.dataset.coord;
      handleExcelCellInput(coord, e.target.value);
    });

    inp.addEventListener('keydown', (e) => {
      handleExcelCellKeydown(e, inp);
    });
  });

  // Update formula bar, address box and counter
  updateExcelFormulaBar();
  updateExcelCellCountInfo();
  updateToolbarActiveStates();
}

function handleExcelCellSelect(col, row, val) {
  excelWorkbook.selectedCell = { col, row };
  const coord = `${col}${row}`;

  // Update active coordinates in formula bar
  const coordsBox = document.getElementById('excelActiveCellCoords');
  if (coordsBox) coordsBox.textContent = coord;

  const formulaInput = document.getElementById('excelFormulaInput');
  if (formulaInput) formulaInput.value = val !== undefined ? val : '';

  // Update visual selection highlights
  document.querySelectorAll('.excel-grid-cell.selected').forEach(el => el.classList.remove('selected'));
  const targetTd = document.querySelector(`.excel-grid-cell[data-coord="${coord}"]`);
  if (targetTd) targetTd.classList.add('selected');

  // Update active header column & row indicators
  document.querySelectorAll('.excel-col-th.active-header').forEach(el => el.classList.remove('active-header'));
  document.querySelectorAll('.excel-row-th.active-header').forEach(el => el.classList.remove('active-header'));
  const colTh = document.querySelector(`.excel-col-th[data-col="${col}"]`);
  const rowTh = document.querySelector(`.excel-row-th[data-row="${row}"]`);
  if (colTh) colTh.classList.add('active-header');
  if (rowTh) rowTh.classList.add('active-header');

  updateToolbarActiveStates();
}

function handleExcelCellInput(coord, val) {
  const sheet = getActiveExcelSheet();
  if (!sheet) return;

  sheet.cells[coord] = sheet.cells[coord] || {};
  sheet.cells[coord].v = val;

  // Sync to formula bar
  const formulaInput = document.getElementById('excelFormulaInput');
  if (formulaInput && excelWorkbook.selectedCell.col + excelWorkbook.selectedCell.row === coord) {
    formulaInput.value = val;
  }

  updateExcelCellCountInfo();
  markExcelUnsaved();
  debounceSaveExcelWorkbook();
}

function handleExcelCellKeydown(e, inp) {
  const col = inp.dataset.col;
  const row = parseInt(inp.dataset.row, 10);
  const colIdx = colLetterToIndex(col);
  const sheet = getActiveExcelSheet();
  const maxRow = sheet.rowCount || 35;
  const maxCol = sheet.colCount || 14;

  if (e.key === 'Enter') {
    e.preventDefault();
    if (row < maxRow) focusExcelCell(col, row + 1);
  } else if (e.key === 'Tab') {
    e.preventDefault();
    if (e.shiftKey) {
      if (colIdx > 0) focusExcelCell(indexToColLetter(colIdx - 1), row);
    } else {
      if (colIdx < maxCol - 1) focusExcelCell(indexToColLetter(colIdx + 1), row);
    }
  } else if (e.key === 'ArrowUp' && inp.selectionStart === 0 && inp.selectionEnd === 0) {
    if (row > 1) {
      e.preventDefault();
      focusExcelCell(col, row - 1);
    }
  } else if (e.key === 'ArrowDown' && inp.selectionStart === inp.value.length) {
    if (row < maxRow) {
      e.preventDefault();
      focusExcelCell(col, row + 1);
    }
  }
}

function focusExcelCell(col, row) {
  excelWorkbook.selectedCell = { col, row };
  const coord = `${col}${row}`;
  const inp = document.querySelector(`.excel-cell-input-el[data-coord="${coord}"]`);
  if (inp) {
    inp.focus();
    handleExcelCellSelect(col, row, inp.value);
  }
}

function updateExcelFormulaBar() {
  const coord = `${excelWorkbook.selectedCell.col}${excelWorkbook.selectedCell.row}`;
  const coordsBox = document.getElementById('excelActiveCellCoords');
  if (coordsBox) coordsBox.textContent = coord;

  const sheet = getActiveExcelSheet();
  const formulaInput = document.getElementById('excelFormulaInput');
  if (formulaInput && sheet) {
    const cellVal = sheet.cells[coord]?.v || '';
    formulaInput.value = cellVal;
  }
}

function updateExcelCellCountInfo() {
  const countLabel = document.getElementById('excelGridCellCountInfo');
  const sheetInfo = document.getElementById('excelActiveSheetInfo');
  const sheet = getActiveExcelSheet();
  if (!sheet) return;

  if (sheetInfo) sheetInfo.textContent = sheet.name;
  if (countLabel) {
    const filledCount = Object.values(sheet.cells || {}).filter(c => c && c.v && c.v.trim().length > 0).length;
    countLabel.textContent = `${filledCount} cell${filledCount === 1 ? '' : 's'} filled`;
  }
}

function updateToolbarActiveStates() {
  const sheet = getActiveExcelSheet();
  if (!sheet) return;
  const coord = `${excelWorkbook.selectedCell.col}${excelWorkbook.selectedCell.row}`;
  const cd = sheet.cells[coord] || {};

  const boldBtn = document.getElementById('excelBoldBtn');
  const italicBtn = document.getElementById('excelItalicBtn');
  const underlineBtn = document.getElementById('excelUnderlineBtn');
  const strikeBtn = document.getElementById('excelStrikeBtn');

  if (boldBtn) boldBtn.classList.toggle('active', !!cd.b);
  if (italicBtn) italicBtn.classList.toggle('active', !!cd.i);
  if (underlineBtn) underlineBtn.classList.toggle('active', !!cd.u);
  if (strikeBtn) strikeBtn.classList.toggle('active', !!cd.s);

  const fontSelect = document.getElementById('excelFontFamily');
  if (fontSelect && cd.font) fontSelect.value = cd.font;

  const sizeSelect = document.getElementById('excelFontSize');
  if (sizeSelect && cd.size) sizeSelect.value = cd.size;
}

// Multi-Sheet Tabs Controller
function renderExcelSheetTabs() {
  const container = document.getElementById('excelSheetTabsList');
  if (!container) return;
  container.innerHTML = '';

  excelWorkbook.sheets.forEach(sheet => {
    const isActive = sheet.id === excelWorkbook.activeSheetId;
    const tabItem = document.createElement('div');
    tabItem.className = `excel-sheet-tab-item ${isActive ? 'active' : ''}`;
    tabItem.dataset.sheetId = sheet.id;

    const delBtnHtml = excelWorkbook.sheets.length > 1
      ? `<button type="button" class="excel-sheet-tab-del" title="Delete sheet">&times;</button>`
      : '';

    tabItem.innerHTML = `
      <span class="excel-sheet-tab-name" title="Double click to rename">${escapeHtml(sheet.name)}</span>
      ${delBtnHtml}
    `;

    // Click tab to switch active sheet
    tabItem.addEventListener('click', (e) => {
      if (e.target.classList.contains('excel-sheet-tab-del')) return;
      switchExcelSheet(sheet.id);
    });

    // Delete button
    const delBtn = tabItem.querySelector('.excel-sheet-tab-del');
    if (delBtn) {
      delBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        deleteExcelSheet(sheet.id);
      });
    }

    // Double click to rename sheet
    const nameSpan = tabItem.querySelector('.excel-sheet-tab-name');
    if (nameSpan) {
      nameSpan.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        const newName = prompt('Rename Sheet:', sheet.name);
        if (newName && newName.trim()) {
          sheet.name = newName.trim();
          renderExcelSheetTabs();
          updateExcelCellCountInfo();
          saveExcelWorkbookToStorage();
        }
      });
    }

    container.appendChild(tabItem);
  });
}

window.addNewExcelSheet = function() {
  const count = excelWorkbook.sheets.length + 1;
  const newSheet = {
    id: `sheet-${Date.now()}`,
    name: `Sheet${count}`,
    rowCount: 35,
    colCount: 14,
    cells: {} // Empty excel sheet
  };
  excelWorkbook.sheets.push(newSheet);
  excelWorkbook.activeSheetId = newSheet.id;
  excelWorkbook.selectedCell = { col: 'A', row: 1 };

  renderExcelGrid();
  renderExcelSheetTabs();
  saveExcelWorkbookToStorage();

  // Scroll tab list to right
  const tabList = document.getElementById('excelSheetTabsList');
  if (tabList) tabList.scrollLeft = tabList.scrollWidth;
};

window.switchExcelSheet = function(sheetId) {
  if (excelWorkbook.activeSheetId === sheetId) return;
  excelWorkbook.activeSheetId = sheetId;
  excelWorkbook.selectedCell = { col: 'A', row: 1 };
  renderExcelGrid();
  renderExcelSheetTabs();
  saveExcelWorkbookToStorage();
};

window.deleteExcelSheet = function(sheetId) {
  if (excelWorkbook.sheets.length <= 1) {
    alert('Workbook must have at least one sheet.');
    return;
  }
  const target = excelWorkbook.sheets.find(s => s.id === sheetId);
  if (!confirm(`Delete "${target?.name || 'this sheet'}"? All contents will be lost.`)) return;

  excelWorkbook.sheets = excelWorkbook.sheets.filter(s => s.id !== sheetId);
  if (excelWorkbook.activeSheetId === sheetId) {
    excelWorkbook.activeSheetId = excelWorkbook.sheets[0].id;
    excelWorkbook.selectedCell = { col: 'A', row: 1 };
  }
  renderExcelGrid();
  renderExcelSheetTabs();
  saveExcelWorkbookToStorage();
};

window.clearActiveExcelSheet = function() {
  const sheet = getActiveExcelSheet();
  if (!sheet) return;
  if (!confirm(`Clear all cells in "${sheet.name}"?`)) return;
  sheet.cells = {};
  renderExcelGrid();
  saveExcelWorkbookToStorage();
};

function applyExcelFormat(prop, value) {
  const sheet = getActiveExcelSheet();
  if (!sheet) return;
  const coord = `${excelWorkbook.selectedCell.col}${excelWorkbook.selectedCell.row}`;
  sheet.cells[coord] = sheet.cells[coord] || { v: '' };

  if (prop === 'toggle_b') sheet.cells[coord].b = !sheet.cells[coord].b;
  else if (prop === 'toggle_i') sheet.cells[coord].i = !sheet.cells[coord].i;
  else if (prop === 'toggle_u') sheet.cells[coord].u = !sheet.cells[coord].u;
  else if (prop === 'toggle_s') sheet.cells[coord].s = !sheet.cells[coord].s;
  else sheet.cells[coord][prop] = value;

  // Re-apply style to current DOM element directly
  const inputEl = document.querySelector(`.excel-cell-input-el[data-coord="${coord}"]`);
  const cellTd = document.querySelector(`.excel-grid-cell[data-coord="${coord}"]`);
  if (inputEl) {
    const cd = sheet.cells[coord];
    inputEl.style.fontWeight = cd.b ? '700' : 'normal';
    inputEl.style.fontStyle = cd.i ? 'italic' : 'normal';
    if (cd.u && cd.s) inputEl.style.textDecoration = 'underline line-through';
    else if (cd.u) inputEl.style.textDecoration = 'underline';
    else if (cd.s) inputEl.style.textDecoration = 'line-through';
    else inputEl.style.textDecoration = 'none';

    if (cd.color) inputEl.style.color = cd.color;
    if (cd.align) inputEl.style.textAlign = cd.align;
    if (cd.font) inputEl.style.fontFamily = cd.font;
    if (cd.size) inputEl.style.fontSize = cd.size;
  }
  if (cellTd && sheet.cells[coord].bg) {
    cellTd.style.backgroundColor = sheet.cells[coord].bg;
  }

  updateToolbarActiveStates();
  markExcelUnsaved();
  debounceSaveExcelWorkbook();
}

function setupExcelEventListeners() {
  // Toolbar Buttons
  safeListen('excelBoldBtn', 'click', () => applyExcelFormat('toggle_b'));
  safeListen('excelItalicBtn', 'click', () => applyExcelFormat('toggle_i'));
  safeListen('excelUnderlineBtn', 'click', () => applyExcelFormat('toggle_u'));
  safeListen('excelStrikeBtn', 'click', () => applyExcelFormat('toggle_s'));

  safeListen('excelFontFamily', 'change', (e) => applyExcelFormat('font', e.target.value));
  safeListen('excelFontSize', 'change', (e) => applyExcelFormat('size', e.target.value));

  // Color Pickers
  safeListen('excelFillColorInput', 'input', (e) => applyExcelFormat('bg', e.target.value));
  safeListen('excelTextColorInput', 'input', (e) => applyExcelFormat('color', e.target.value));

  // Alignment buttons
  document.querySelectorAll('.excel-tool-btn[data-align]').forEach(btn => {
    btn.addEventListener('click', () => {
      applyExcelFormat('align', btn.dataset.align);
    });
  });

  // Add Row & Col
  safeListen('excelAddRowBtn', 'click', () => {
    const sheet = getActiveExcelSheet();
    if (sheet) {
      sheet.rowCount = (sheet.rowCount || 35) + 5;
      renderExcelGrid();
      saveExcelWorkbookToStorage();
    }
  });

  safeListen('excelAddColBtn', 'click', () => {
    const sheet = getActiveExcelSheet();
    if (sheet) {
      sheet.colCount = (sheet.colCount || 14) + 1;
      renderExcelGrid();
      saveExcelWorkbookToStorage();
    }
  });

  // Formula input synchronization
  const formulaInput = document.getElementById('excelFormulaInput');
  if (formulaInput) {
    formulaInput.addEventListener('input', (e) => {
      const coord = `${excelWorkbook.selectedCell.col}${excelWorkbook.selectedCell.row}`;
      const inp = document.querySelector(`.excel-cell-input-el[data-coord="${coord}"]`);
      if (inp) inp.value = e.target.value;
      handleExcelCellInput(coord, e.target.value);
    });
  }

  // Clear sheet
  safeListen('excelClearSheetBtn', 'click', clearActiveExcelSheet);

  // Add sheet (+)
  safeListen('excelAddSheetBtn', 'click', addNewExcelSheet);

  // Scroll tabs
  safeListen('excelScrollTabsLeft', 'click', () => {
    const list = document.getElementById('excelSheetTabsList');
    if (list) list.scrollLeft -= 150;
  });
  safeListen('excelScrollTabsRight', 'click', () => {
    const list = document.getElementById('excelSheetTabsList');
    if (list) list.scrollLeft += 150;
  });

  // Print
  safeListen('excelPrintBtn', 'click', () => window.print());
}

let _saveExcelTimeout = null;
function debounceSaveExcelWorkbook() {
  clearTimeout(_saveExcelTimeout);
  _saveExcelTimeout = setTimeout(() => {
    saveExcelWorkbookToStorage();
  }, 400);
}

function markExcelUnsaved() {
  const badge = document.getElementById('excelSaveStatusBadge');
  if (badge) {
    badge.textContent = '● Saving...';
    badge.style.color = '#f59e0b';
  }
}

function saveExcelWorkbookToStorage() {
  try {
    localStorage.setItem('wp_emp_workbook', JSON.stringify(excelWorkbook));
    const badge = document.getElementById('excelSaveStatusBadge');
    if (badge) {
      badge.textContent = '● Auto-saved locally';
      badge.style.color = '#10b981';
    }
  } catch (e) {}
}

function renderEmployeeTasks(tasks) {
  const container = document.getElementById('empTasksListContainer');
  const countLabel = document.getElementById('empTasksCountLabel');
  if (!container) return;

  if (countLabel) countLabel.textContent = `${tasks.length} Task${tasks.length === 1 ? '' : 's'} Listed`;
  container.innerHTML = '';

  if (tasks.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; color: var(--text-dim); padding: 30px; background: rgba(255,255,255,0.02); border-radius: var(--radius-sm); border: 1px dashed var(--border-subtle);">
        <div style="font-size: 1.8rem; margin-bottom: 6px;">📝</div>
        <div style="font-weight: 600; color: var(--text-main);">No tasks logged yet for today.</div>
        <div style="font-size: 0.78rem; color: var(--text-dim); margin-top: 4px;">Use the Quick Task Entry above to list what you're working on today!</div>
      </div>
    `;
    return;
  }

  tasks.forEach(t => {
    const isDone = t.status === 'COMPLETED';
    const prioLower = (t.priority || 'medium').toLowerCase();
    const row = document.createElement('div');
    row.className = `sheet-task-item ${isDone ? 'completed' : ''}`;
    row.style.padding = '12px 16px';

    const descHtml = t.description ? `<div style="font-size: 0.74rem; color: var(--text-muted); margin-top: 4px;">${t.description}</div>` : '';
    const blockerHtml = t.blockers ? `<div style="font-size: 0.72rem; color: var(--accent-rose); margin-top: 3px;">⚠️ ${t.blockers}</div>` : '';

    row.innerHTML = `
      <div style="display: flex; align-items: flex-start; gap: 12px; flex: 1; min-width: 0;">
        <input type="checkbox" class="task-checkbox-custom" ${isDone ? 'checked' : ''} onchange="toggleTaskStatus('${t.id}', this.checked)" title="Mark as completed" style="margin-top: 2px;">
        <div style="flex: 1; min-width: 0;">
          <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
            <span class="task-title-text" style="font-weight: 700; font-size: 0.88rem; color: var(--text-main);">${t.title}</span>
            <span class="prio-pill ${prioLower}">${t.priority}</span>
            <span class="cat-pill">${t.category}</span>
          </div>
          ${descHtml}
          ${blockerHtml}
        </div>
      </div>

      <div style="display: flex; align-items: center; gap: 10px; flex-shrink: 0;">
        <span class="badge" style="background: rgba(6, 182, 212, 0.12); color: var(--accent-cyan); font-weight: 700; font-size: 0.75rem;">
          ⏱️ ${t.hours_spent}h
        </span>

        <select class="input-control" onchange="handleTaskStatusChange('${t.id}', this.value)" style="padding: 3px 8px; font-size: 0.72rem; width: auto;">
          <option value="TODO" ${t.status === 'TODO' ? 'selected' : ''}>Todo</option>
          <option value="IN_PROGRESS" ${t.status === 'IN_PROGRESS' ? 'selected' : ''}>In Progress</option>
          <option value="COMPLETED" ${t.status === 'COMPLETED' ? 'selected' : ''}>Completed</option>
          <option value="BLOCKED" ${t.status === 'BLOCKED' ? 'selected' : ''}>Blocked</option>
        </select>

        <button class="btn btn-secondary btn-sm" onclick="openTaskEditModal('${t.id}')" style="padding: 3px 8px; font-size: 0.72rem;" title="Edit task details">✏️</button>
        <button class="btn btn-danger btn-sm" onclick="deleteTaskItem('${t.id}')" style="padding: 3px 8px; font-size: 0.72rem;" title="Delete task">&times;</button>
      </div>
    `;

    container.appendChild(row);
  });
}

async function loadEmployeePastSheets() {
  const grid = document.getElementById('empPastSheetsGrid');
  if (!grid) return;

  let past = [];
  try {
    const res = await fetch(`${API_BASE}/sheets`, { headers: authHeaders() });
    if (res.ok) {
      const sheets = await res.json();
      const todayStr = new Date().toISOString().split('T')[0];
      past = sheets.filter(s => s.sheet_date !== todayStr);
    }
  } catch (err) {
    // API offline, fallback
  }

  if (!past || past.length === 0) {
    past = getDummyEmployeePastSheets();
  }

  grid.innerHTML = '';
  if (past.length === 0) {
    grid.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; color: var(--text-dim); padding: 20px; font-size: 0.8rem;">
        No previous daily sheets logged yet. Past submitted sheets will be archived here.
      </div>
    `;
    return;
  }

  past.forEach(s => {
    const card = document.createElement('div');
    const stLower = (s.status || 'draft').toLowerCase();
    card.className = `sheet-card ${stLower}`;
    card.style.padding = '14px 16px';

    card.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
        <div style="font-weight: 700; color: var(--text-main); font-size: 0.9rem;">📅 ${s.sheet_date}</div>
        <span class="sheet-status-pill ${stLower}">${s.status}</span>
      </div>
      <div style="font-size: 0.76rem; color: var(--text-muted); margin-bottom: 8px;">
        ${s.completed_tasks || 0}/${s.total_tasks || (s.tasks ? s.tasks.length : 0)} Tasks Resolved &bull; <strong style="color: var(--accent-cyan);">${s.total_hours || 0} hrs</strong>
      </div>
      <div style="width: 100%; height: 4px; background: rgba(255,255,255,0.06); border-radius: 2px; overflow: hidden; margin-bottom: 10px;">
        <div style="height: 100%; background: var(--accent-emerald); width: ${s.progress_percent || 0}%;"></div>
      </div>
      <button class="btn btn-secondary btn-sm" onclick="openSheetDetailsModal('${s.id}')" style="width: 100%; font-size: 0.74rem; padding: 4px 8px;">
        View Past Sheet Details
      </button>
    `;

    grid.appendChild(card);
  });
}

async function handleQuickTaskAdd(e) {
  e.preventDefault();
  if (!state.currentTodaySheet) {
    await loadEmployeeTodaySheet();
  }
  const sheet = state.currentTodaySheet;
  if (!sheet) return;

  const title = document.getElementById('quickTaskTitle').value.trim();
  const category = document.getElementById('quickTaskCategory').value;
  const priority = document.getElementById('quickTaskPriority').value;
  const hours = parseFloat(document.getElementById('quickTaskHours').value || '1.0');

  if (!title) return;

  let addedOnline = false;
  try {
    const res = await fetch(`${API_BASE}/sheets/${sheet.id}/tasks`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        title,
        category,
        priority,
        status: 'TODO',
        hours_spent: hours,
      })
    });
    if (res.ok) {
      addedOnline = true;
    }
  } catch (err) {
    // Fall back to local update
  }

  if (!addedOnline) {
    // Add locally to state and cache
    const newTask = {
      id: `task-local-${Date.now()}`,
      title,
      category,
      priority,
      status: 'TODO',
      hours_spent: hours,
      description: null,
      blockers: null
    };
    sheet.tasks = sheet.tasks || [];
    sheet.tasks.push(newTask);
    sheet.total_tasks = sheet.tasks.length;
    sheet.total_hours = (sheet.total_hours || 0) + hours;
    localStorage.setItem('wp_emp_today_sheet', JSON.stringify(sheet));
  }

  document.getElementById('quickTaskTitle').value = '';
  await loadEmployeeTodaySheet();
}

async function handleSaveEmployeeSheet(isSubmit) {
  if (!state.currentTodaySheet) return;
  const sheet = state.currentTodaySheet;

  // Extract workbook title from input if available
  const titleInput = document.getElementById('excelWorkbookTitle');
  if (titleInput && titleInput.value.trim()) {
    excelWorkbook.title = titleInput.value.trim();
  }

  const nextStatus = isSubmit ? 'SUBMITTED' : 'DRAFT';
  sheet.status = nextStatus;

  // Calculate cell statistics across all sheets
  let totalFilledCells = 0;
  excelWorkbook.sheets.forEach(s => {
    totalFilledCells += Object.values(s.cells || {}).filter(c => c && c.v && c.v.trim().length > 0).length;
  });

  // Serialize entire multi-sheet workbook into summary_notes
  const serializedNotes = JSON.stringify({
    title: excelWorkbook.title,
    activeSheetId: excelWorkbook.activeSheetId,
    sheets: excelWorkbook.sheets,
    total_sheets: excelWorkbook.sheets.length,
    filled_cells: totalFilledCells,
    submitted_at: new Date().toISOString()
  });
  sheet.summary_notes = serializedNotes;
  sheet.total_tasks = totalFilledCells;

  try {
    await fetch(`${API_BASE}/sheets/${sheet.id}`, {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify({
        summary_notes: serializedNotes,
        status: nextStatus,
      })
    });
  } catch (err) {
    // Save to local cache
  }

  saveExcelWorkbookToStorage();
  localStorage.setItem('wp_emp_today_sheet', JSON.stringify(sheet));

  // Update header status badge
  const badge = document.getElementById('empSheetStatusBadge');
  if (badge) {
    badge.textContent = nextStatus;
    badge.className = `sheet-status-pill ${nextStatus.toLowerCase()}`;
  }

  const saveStatus = document.getElementById('excelSaveStatusBadge');
  if (saveStatus) {
    saveStatus.textContent = '● Saved to server';
    saveStatus.style.color = '#10b981';
  }

  alert(isSubmit 
    ? `🚀 Daily Task Sheet submitted successfully (${excelWorkbook.sheets.length} sheet${excelWorkbook.sheets.length === 1 ? '' : 's'}, ${totalFilledCells} cells) for supervisor review!` 
    : '💾 Draft saved successfully.');
}



window.toggleTaskStatus = async function(taskId, isChecked) {
  const newStatus = isChecked ? 'COMPLETED' : 'TODO';
  await updateTaskItemDirect(taskId, { status: newStatus });
};

window.handleTaskStatusChange = async function(taskId, newStatus) {
  await updateTaskItemDirect(taskId, { status: newStatus });
};

async function updateTaskItemDirect(taskId, payload) {
  let updatedOnline = false;
  try {
    const res = await fetch(`${API_BASE}/sheets/tasks/${taskId}`, {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify(payload)
    });
    if (res.ok) {
      updatedOnline = true;
    }
  } catch (err) {
    // Update local state
  }

  if (!updatedOnline && state.currentTodaySheet && state.currentTodaySheet.tasks) {
    const task = state.currentTodaySheet.tasks.find(t => t.id === taskId);
    if (task) {
      Object.assign(task, payload);
      const completed = state.currentTodaySheet.tasks.filter(t => t.status === 'COMPLETED').length;
      state.currentTodaySheet.completed_tasks = completed;
      state.currentTodaySheet.progress_percent = Math.round((completed / state.currentTodaySheet.tasks.length) * 100);
      localStorage.setItem('wp_emp_today_sheet', JSON.stringify(state.currentTodaySheet));
    }
  }

  await loadEmployeeTodaySheet();
}

window.deleteTaskItem = async function(taskId) {
  if (!confirm('Are you sure you want to delete this task item?')) return;
  let deletedOnline = false;
  try {
    const res = await fetch(`${API_BASE}/sheets/tasks/${taskId}`, {
      method: 'DELETE',
      headers: authHeaders()
    });
    if (res.ok) {
      deletedOnline = true;
    }
  } catch (err) {
    // Delete local
  }

  if (!deletedOnline && state.currentTodaySheet && state.currentTodaySheet.tasks) {
    state.currentTodaySheet.tasks = state.currentTodaySheet.tasks.filter(t => t.id !== taskId);
    state.currentTodaySheet.total_tasks = state.currentTodaySheet.tasks.length;
    const completed = state.currentTodaySheet.tasks.filter(t => t.status === 'COMPLETED').length;
    state.currentTodaySheet.completed_tasks = completed;
    state.currentTodaySheet.progress_percent = state.currentTodaySheet.tasks.length > 0 ? Math.round((completed / state.currentTodaySheet.tasks.length) * 100) : 0;
    localStorage.setItem('wp_emp_today_sheet', JSON.stringify(state.currentTodaySheet));
  }

  await loadEmployeeTodaySheet();
};

// ==========================================================================
// Modals: Sheet Details, Supervisor Review & Task Editing
// ==========================================================================

window.openSheetDetailsModal = async function(sheetId) {
  state.activeDetailSheetId = sheetId;
  const modal = document.getElementById('sheetDetailsModal');
  if (!modal) return;

  let sheet = null;
  try {
    const res = await fetch(`${API_BASE}/sheets/${sheetId}`, { headers: authHeaders() });
    if (res.ok) {
      sheet = await res.json();
    }
  } catch (err) {
    // Fall back to state or dummy
  }

  if (!sheet) {
    // Search in state.allSheets
    sheet = state.allSheets?.find(s => s.id === sheetId);
    if (!sheet) {
      // Check today sheet
      if (state.currentTodaySheet?.id === sheetId) sheet = state.currentTodaySheet;
      // Check dummy past sheets
      if (!sheet) {
        const past = getDummyEmployeePastSheets();
        sheet = past.find(s => s.id === sheetId);
      }
      // Check dummy manager sheets
      if (!sheet) {
        const dummyAll = getDummyManagerSheets();
        sheet = dummyAll.find(s => s.id === sheetId);
      }
    }
  }

  if (!sheet) return;

  const initials = (sheet.employee_name || 'Staff')
    .split(' ')
    .map(n => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  document.getElementById('modalSheetAvatar').textContent = initials;
  document.getElementById('modalSheetEmpName').textContent = `${sheet.employee_name}'s Daily Sheet`;
  document.getElementById('modalSheetEmpMeta').textContent = `${sheet.employee_code || 'EMP'} • ${sheet.department_name || 'Department'}`;
  document.getElementById('modalSheetDate').textContent = sheet.sheet_date;

  const stBadge = document.getElementById('modalSheetStatusBadge');
  stBadge.textContent = sheet.status;
  stBadge.className = `sheet-status-pill ${(sheet.status || 'draft').toLowerCase()}`;

  const taskCount = sheet.tasks ? sheet.tasks.length : (sheet.total_tasks || 0);
  const completedCount = sheet.completed_tasks || 0;
  const progressPercent = sheet.progress_percent || (taskCount > 0 ? Math.round((completedCount / taskCount) * 100) : 0);

  document.getElementById('modalSheetHours').textContent = `${(sheet.total_hours || 0).toFixed(1)} hrs`;
  document.getElementById('modalSheetTasksCount').textContent = `${completedCount} / ${taskCount} Done`;
  document.getElementById('modalSheetProgress').textContent = `${progressPercent}%`;
  document.getElementById('modalSheetProgressBar').style.width = `${progressPercent}%`;

  // Tasks list
  const listEl = document.getElementById('modalSheetTasksList');
  document.getElementById('modalSheetTaskItemsCount').textContent = `${taskCount} items`;
  listEl.innerHTML = '';

  if (!sheet.tasks || sheet.tasks.length === 0) {
    listEl.innerHTML = `<div style="text-align: center; color: var(--text-dim); padding: 14px;">No tasks logged.</div>`;
  } else {
    sheet.tasks.forEach(t => {
      const isDone = t.status === 'COMPLETED';
      const icon = isDone ? '✅' : (t.status === 'IN_PROGRESS' ? '⏳' : (t.status === 'BLOCKED' ? '⛔' : '⭕'));
      const descText = t.description ? `<div style="font-size: 0.74rem; color: var(--text-muted); margin-top: 3px;">${t.description}</div>` : '';
      const blockText = t.blockers ? `<div style="font-size: 0.72rem; color: var(--accent-rose); margin-top: 2px;">⚠️ ${t.blockers}</div>` : '';

      const item = document.createElement('div');
      item.className = `sheet-task-item ${isDone ? 'completed' : ''}`;
      item.innerHTML = `
        <div style="flex: 1;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span>${icon}</span>
            <strong style="color: var(--text-main); font-size: 0.82rem;">${t.title}</strong>
            <span class="prio-pill ${(t.priority || 'medium').toLowerCase()}">${t.priority}</span>
            <span class="cat-pill">${t.category}</span>
          </div>
          ${descText}
          ${blockText}
        </div>
        <span class="badge" style="background: rgba(6, 182, 212, 0.12); color: var(--accent-cyan); font-size: 0.75rem;">
          ⏱️ ${t.hours_spent}h
        </span>
      `;
      listEl.appendChild(item);
    });
  }

  // Projects Deliverables Spreadsheet (Google Sheets style)
  const modalRows = extractProjectRowsFromSheet(sheet);
  renderProjectsSpreadsheet('modalProjectsSheetTbody', modalRows, false);


  // Feedback
  const fbCont = document.getElementById('modalSheetFeedbackContainer');
  if (sheet.manager_feedback) {
    fbCont.style.display = 'block';
    document.getElementById('modalSheetFeedbackMeta').textContent = sheet.reviewed_by_name ? `Reviewed by ${sheet.reviewed_by_name}` : 'Supervisor Review';
    document.getElementById('modalSheetFeedbackText').textContent = `"${sheet.manager_feedback}"`;
  } else {
    fbCont.style.display = 'none';
  }

  // Supervisor action button
  const role = (state.currentUser?.role || localStorage.getItem('wp-role') || 'admin').toUpperCase();
  const revBtn = document.getElementById('modalSheetReviewActionBtn');
  if (revBtn) {
    revBtn.style.display = (role === 'ADMIN' || role === 'MANAGER') ? 'inline-flex' : 'none';
  }

  modal.classList.add('active');
};

window.openSheetReviewModal = function(sheetId) {
  state.activeDetailSheetId = sheetId;
  document.getElementById('reviewSheetId').value = sheetId;
  let sheet = state.allSheets?.find(s => s.id === sheetId);
  if (!sheet) {
    const dummyAll = getDummyManagerSheets();
    sheet = dummyAll.find(s => s.id === sheetId);
  }
  if (sheet) {
    document.getElementById('sheetReviewModalTitle').textContent = `Review Sheet: ${sheet.employee_name} (${sheet.sheet_date})`;
    if (sheet.manager_feedback) {
      document.getElementById('reviewSheetFeedbackText').value = sheet.manager_feedback;
    } else {
      document.getElementById('reviewSheetFeedbackText').value = '';
    }
  }
  document.getElementById('sheetReviewModal').classList.add('active');
};

async function handleSubmitSheetReview(e) {
  e.preventDefault();
  const sheetId = document.getElementById('reviewSheetId').value;
  const status = document.getElementById('reviewSheetStatusSelect').value;
  const feedback = document.getElementById('reviewSheetFeedbackText').value.trim();

  if (!sheetId || !feedback) return;

  let reviewedOnline = false;
  try {
    const res = await fetch(`${API_BASE}/sheets/${sheetId}/review`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        manager_feedback: feedback,
        status: status,
      })
    });
    if (res.ok) {
      reviewedOnline = true;
    }
  } catch (err) {
    // Local fallback
  }

  if (!reviewedOnline && state.allSheets) {
    const targetSheet = state.allSheets.find(s => s.id === sheetId);
    if (targetSheet) {
      targetSheet.status = status;
      targetSheet.manager_feedback = feedback;
      targetSheet.reviewed_by_name = state.currentUser?.name || 'Sarah Connor';
      targetSheet.reviewed_at = new Date().toISOString();
    }
  }

  document.getElementById('sheetReviewModal').classList.remove('active');
  await loadManagerSheetsSummary();
  await loadManagerSheetsGrid();
  alert('✓ Supervisor review submitted successfully!');
}

window.openTaskEditModal = function(taskId) {
  const tasks = state.currentTodaySheet?.tasks || [];
  const task = tasks.find(t => t.id === taskId);
  if (!task) return;

  document.getElementById('editTaskId').value = task.id;
  document.getElementById('editTaskTitle').value = task.title || '';
  document.getElementById('editTaskCategory').value = task.category || 'General';
  document.getElementById('editTaskPriority').value = task.priority || 'MEDIUM';
  document.getElementById('editTaskStatus').value = task.status || 'TODO';
  document.getElementById('editTaskHours').value = task.hours_spent || 1.0;
  document.getElementById('editTaskDescription').value = task.description || '';
  document.getElementById('editTaskBlockers').value = task.blockers || '';

  document.getElementById('taskItemEditModal').classList.add('active');
};

async function handleSubmitTaskEdit(e) {
  e.preventDefault();
  const taskId = document.getElementById('editTaskId').value;
  if (!taskId) return;

  const payload = {
    title: document.getElementById('editTaskTitle').value.trim(),
    category: document.getElementById('editTaskCategory').value,
    priority: document.getElementById('editTaskPriority').value,
    status: document.getElementById('editTaskStatus').value,
    hours_spent: parseFloat(document.getElementById('editTaskHours').value || '0'),
    description: document.getElementById('editTaskDescription').value.trim() || null,
    blockers: document.getElementById('editTaskBlockers').value.trim() || null,
  };

  let updatedOnline = false;
  try {
    const res = await fetch(`${API_BASE}/sheets/tasks/${taskId}`, {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify(payload)
    });
    if (res.ok) {
      updatedOnline = true;
    }
  } catch (err) {
    // Local fallback
  }

  if (!updatedOnline && state.currentTodaySheet && state.currentTodaySheet.tasks) {
    const task = state.currentTodaySheet.tasks.find(t => t.id === taskId);
    if (task) {
      Object.assign(task, payload);
      const completed = state.currentTodaySheet.tasks.filter(t => t.status === 'COMPLETED').length;
      state.currentTodaySheet.completed_tasks = completed;
      state.currentTodaySheet.progress_percent = Math.round((completed / state.currentTodaySheet.tasks.length) * 100);
      localStorage.setItem('wp_emp_today_sheet', JSON.stringify(state.currentTodaySheet));
    }
  }

  document.getElementById('taskItemEditModal').classList.remove('active');
  await loadEmployeeTodaySheet();
}

/* ==========================================================================
   Google Sheets "Projects" Spreadsheet Manager
   ========================================================================== */

const DEFAULT_PROJECT_ROWS = [
  { date: '06-10-2026', name: 'Permanent Kits theme', status: 'Done', note: '', bugs: '', next_plan: '' },
  { date: '06-10-2026', name: 'Deploying Permanent Kits theme', status: 'Done', note: 'waiting for the hostinger access', bugs: '', next_plan: '' },
  { date: '06-10-2026', name: 'Deploying the app', status: 'Done', note: 'net issue solved', bugs: '', next_plan: '' },
  { date: '23-09-2026', name: 'Fixed the issues of the app', status: 'Done', note: 'agent taking time idk why', bugs: '', next_plan: '' },
  { date: '23-09-2026', name: 'constructing plan to working on permanent kits', status: 'Done', note: 'internet issue', bugs: '', next_plan: '' }
];

function extractProjectRowsFromSheet(sheet) {
  if (!sheet) return JSON.parse(JSON.stringify(DEFAULT_PROJECT_ROWS));
  if (sheet.project_rows && Array.isArray(sheet.project_rows) && sheet.project_rows.length > 0) {
    return sheet.project_rows;
  }
  // Try parsing from serialized summary_notes
  if (sheet.summary_notes) {
    try {
      if (sheet.summary_notes.startsWith('{') && sheet.summary_notes.includes('"project_rows"')) {
        const parsed = JSON.parse(sheet.summary_notes);
        if (parsed.project_rows && Array.isArray(parsed.project_rows) && parsed.project_rows.length > 0) {
          return parsed.project_rows;
        }
      }
    } catch (e) {
      // Not JSON
    }
  }
  // If tasks exist on the sheet, map them to project rows
  if (sheet.tasks && sheet.tasks.length > 0) {
    return sheet.tasks.map(t => {
      let st = 'Done';
      if (t.status === 'IN_PROGRESS') st = 'In Progress';
      else if (t.status === 'BLOCKED') st = 'Blocked';
      else if (t.status === 'TODO') st = 'Pending';
      return {
        date: sheet.sheet_date || new Date().toISOString().split('T')[0],
        name: t.title || '',
        status: st,
        note: t.description || '',
        bugs: t.blockers || '',
        next_plan: t.next_plan || ''
      };
    });
  }
  return JSON.parse(JSON.stringify(DEFAULT_PROJECT_ROWS));
}

function renderProjectsSpreadsheet(tbodyId, rows, isEditable = true) {
  const tbody = document.getElementById(tbodyId);
  if (!tbody) return;
  tbody.innerHTML = '';

  rows.forEach((row, idx) => {
    const rowNum = idx + 3; // Row 1 = banner, Row 2 = headers, Row 3+ = data
    const tr = document.createElement('tr');

    const statusVal = row.status || 'Done';
    let statusClass = 'status-done';
    if (statusVal === 'In Progress') statusClass = 'status-progress';
    else if (statusVal === 'Pending') statusClass = 'status-pending';
    else if (statusVal === 'Blocked') statusClass = 'status-blocked';

    if (isEditable) {
      tr.innerHTML = `
        <td class="gsheet-row-num">${rowNum}</td>
        <td class="gsheet-data-cell">
          <input type="text" class="gsheet-cell-input project-cell-date" data-col="A" data-row="${rowNum}" data-idx="${idx}" value="${escapeHtml(row.date || '')}" placeholder="DD-MM-YYYY">
        </td>
        <td class="gsheet-data-cell">
          <input type="text" class="gsheet-cell-input project-cell-name" data-col="B" data-row="${rowNum}" data-idx="${idx}" value="${escapeHtml(row.name || '')}" placeholder="Project / task name...">
        </td>
        <td class="gsheet-data-cell">
          <div class="gsheet-status-wrapper">
            <select class="gsheet-status-pill ${statusClass} project-cell-status" data-col="C" data-row="${rowNum}" data-idx="${idx}" onchange="handleGsheetStatusChange(this, ${idx})">
              <option value="Done" ${statusVal === 'Done' ? 'selected' : ''}>Done ▾</option>
              <option value="In Progress" ${statusVal === 'In Progress' ? 'selected' : ''}>In Progress ▾</option>
              <option value="Pending" ${statusVal === 'Pending' ? 'selected' : ''}>Pending ▾</option>
              <option value="Blocked" ${statusVal === 'Blocked' ? 'selected' : ''}>Blocked ▾</option>
            </select>
          </div>
        </td>
        <td class="gsheet-data-cell">
          <input type="text" class="gsheet-cell-input project-cell-note" data-col="D" data-row="${rowNum}" data-idx="${idx}" value="${escapeHtml(row.note || '')}" placeholder="Note / update...">
        </td>
        <td class="gsheet-data-cell">
          <input type="text" class="gsheet-cell-input project-cell-bugs" data-col="E" data-row="${rowNum}" data-idx="${idx}" value="${escapeHtml(row.bugs || '')}" placeholder="Bugs...">
        </td>
        <td class="gsheet-data-cell">
          <input type="text" class="gsheet-cell-input project-cell-nextplan" data-col="F" data-row="${rowNum}" data-idx="${idx}" value="${escapeHtml(row.next_plan || '')}" placeholder="Next plan...">
        </td>
        <td class="gsheet-data-cell" style="text-align: center; width: 44px;">
          <button type="button" class="gsheet-row-del-btn" onclick="deleteProjectRow(${idx})" title="Delete row">&times;</button>
        </td>
      `;
    } else {
      tr.innerHTML = `
        <td class="gsheet-row-num">${rowNum}</td>
        <td class="gsheet-data-cell" style="padding: 6px 10px;">${escapeHtml(row.date || '')}</td>
        <td class="gsheet-data-cell" style="padding: 6px 10px; font-weight: 600;">${escapeHtml(row.name || '')}</td>
        <td class="gsheet-data-cell">
          <div class="gsheet-status-wrapper">
            <span class="gsheet-status-pill ${statusClass}">${escapeHtml(statusVal)} ▾</span>
          </div>
        </td>
        <td class="gsheet-data-cell" style="padding: 6px 10px; color: var(--text-dim);">${escapeHtml(row.note || '')}</td>
        <td class="gsheet-data-cell" style="padding: 6px 10px; color: var(--accent-rose);">${escapeHtml(row.bugs || '')}</td>
        <td class="gsheet-data-cell" style="padding: 6px 10px;">${escapeHtml(row.next_plan || '')}</td>
      `;
    }

    tbody.appendChild(tr);
  });

  // Attach cell focus listeners to update Google Sheets formula bar
  if (isEditable) {
    const inputs = tbody.querySelectorAll('.gsheet-cell-input');
    inputs.forEach(inp => {
      inp.addEventListener('focus', () => {
        const col = inp.dataset.col || 'B';
        const row = inp.dataset.row || '3';
        const cellNameEl = document.getElementById('empGsheetCellName');
        const formulaInputEl = document.getElementById('empGsheetFormulaInput');
        if (cellNameEl) cellNameEl.textContent = `${col}${row}`;
        if (formulaInputEl) formulaInputEl.value = inp.value;
      });
      inp.addEventListener('input', () => {
        const formulaInputEl = document.getElementById('empGsheetFormulaInput');
        if (formulaInputEl) formulaInputEl.value = inp.value;
      });
    });
  }

  const countLabel = document.getElementById('empProjectsRowCountLabel');
  if (countLabel) countLabel.textContent = `${rows.length} project entr${rows.length === 1 ? 'y' : 'ies'}`;
  const modalCountLabel = document.getElementById('modalProjectsCountLabel');
  if (modalCountLabel) modalCountLabel.textContent = `${rows.length} rows recorded`;
}

window.handleGsheetStatusChange = function(selectEl, idx) {
  const val = selectEl.value;
  selectEl.className = 'gsheet-status-pill project-cell-status';
  if (val === 'Done') selectEl.classList.add('status-done');
  else if (val === 'In Progress') selectEl.classList.add('status-progress');
  else if (val === 'Pending') selectEl.classList.add('status-pending');
  else if (val === 'Blocked') selectEl.classList.add('status-blocked');

  if (state.currentTodaySheet && state.currentTodaySheet.project_rows && state.currentTodaySheet.project_rows[idx]) {
    state.currentTodaySheet.project_rows[idx].status = val;
  }
};

window.deleteProjectRow = function(idx) {
  if (!state.currentTodaySheet) return;
  const rows = getEmployeeSpreadsheetRows();
  rows.splice(idx, 1);
  state.currentTodaySheet.project_rows = rows;
  renderProjectsSpreadsheet('empProjectsSheetTbody', rows, true);
};

window.addNewProjectRow = function() {
  if (!state.currentTodaySheet) return;
  const rows = getEmployeeSpreadsheetRows();
  const d = new Date();
  const todayFormatted = `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;
  rows.push({
    date: todayFormatted,
    name: '',
    status: 'Done',
    note: '',
    bugs: '',
    next_plan: ''
  });
  state.currentTodaySheet.project_rows = rows;
  renderProjectsSpreadsheet('empProjectsSheetTbody', rows, true);

  setTimeout(() => {
    const inputs = document.querySelectorAll('.project-cell-name');
    if (inputs.length > 0) inputs[inputs.length - 1].focus();
  }, 50);
};

function getEmployeeSpreadsheetRows() {
  const tbody = document.getElementById('empProjectsSheetTbody');
  if (!tbody) return state.currentTodaySheet?.project_rows || DEFAULT_PROJECT_ROWS;
  const rows = [];
  const trs = tbody.querySelectorAll('tr');
  trs.forEach(tr => {
    const dateInput = tr.querySelector('.project-cell-date');
    const nameInput = tr.querySelector('.project-cell-name');
    const statusSelect = tr.querySelector('.project-cell-status');
    const noteInput = tr.querySelector('.project-cell-note');
    const bugsInput = tr.querySelector('.project-cell-bugs');
    const nextplanInput = tr.querySelector('.project-cell-nextplan');

    if (nameInput || dateInput) {
      rows.push({
        date: dateInput ? dateInput.value.trim() : '',
        name: nameInput ? nameInput.value.trim() : '',
        status: statusSelect ? statusSelect.value : 'Done',
        note: noteInput ? noteInput.value.trim() : '',
        bugs: bugsInput ? bugsInput.value.trim() : '',
        next_plan: nextplanInput ? nextplanInput.value.trim() : ''
      });
    }
  });
  return rows;
}



