// WorkPulse Dashboard Controller

const API_BASE = '/api/v1';

const state = {
  activeTab: 'tab-overview',
  currentUser: null,
  token: null,
  employees: [],
  selectedEmpId: null,
  currentDeviceToken: null,
};

// Initial setup on DOM ready
document.addEventListener('DOMContentLoaded', async () => {
  setupTabs();
  setupEventListeners();
  await loginAs('admin');
  document.getElementById('todayDateLabel').textContent = new Date().toLocaleDateString(undefined, {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });
});

// Setup tab switches
function setupTabs() {
  const tabBtns = document.querySelectorAll('.tab-btn');
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetTab = btn.getAttribute('data-tab');
      switchTab(targetTab);
    });
  });
}

function switchTab(tabId) {
  state.activeTab = tabId;
  document.querySelectorAll('.tab-btn').forEach(b => {
    b.classList.toggle('active', b.getAttribute('data-tab') === tabId);
  });
  document.querySelectorAll('.tab-pane').forEach(p => {
    p.classList.toggle('active', p.id === tabId);
  });

  if (tabId === 'tab-overview') loadOverviewData();
  else if (tabId === 'tab-attendance') loadAttendanceRollCall();
  else if (tabId === 'tab-activity') loadActivityTab();
  else if (tabId === 'tab-screenshots') loadScreenshotsGallery();
  else if (tabId === 'tab-rules') loadRulesAndStars();
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

    // Update Header Pill
    const badge = document.getElementById('activeRoleBadge');
    badge.textContent = data.role;
    badge.className = `role-pill ${data.role.toLowerCase()}`;
    document.getElementById('activeUserName').textContent = data.name;

    await fetchEmployees();
    refreshAll();
  } catch (err) {
    console.error('Error logging in:', err);
  }
}

function setupEventListeners() {
  document.getElementById('switchUserSelect').addEventListener('change', (e) => {
    loginAs(e.target.value);
  });

  document.getElementById('refreshDataBtn').addEventListener('click', () => {
    refreshAll();
  });

  // Simulator Buttons
  document.getElementById('simulateOnTimeBtn').addEventListener('click', () => simulateCheckIn('ontime'));
  document.getElementById('simulateLateBtn').addEventListener('click', () => simulateCheckIn('late'));
  document.getElementById('simulateScreenshotBtn').addEventListener('click', simulateScreenshotCapture);

  // Filter Buttons
  document.getElementById('applyAttFilterBtn').addEventListener('click', loadAttendanceRollCall);
  document.getElementById('loadHeatmapBtn').addEventListener('click', renderHeatmapForSelected);

  // Evaluate Stars
  document.getElementById('evaluateStarsBtn').addEventListener('click', evaluateStarsNow);
  document.getElementById('purgeRetentionBtn').addEventListener('click', purgeRetentionNow);

  // Modal
  document.getElementById('closeModalBtn').addEventListener('click', () => {
    document.getElementById('screenshotModal').classList.remove('active');
  });
  document.getElementById('screenshotModal').addEventListener('click', (e) => {
    if (e.target.id === 'screenshotModal') {
      document.getElementById('screenshotModal').classList.remove('active');
    }
  });
}

function authHeaders() {
  return {
    'Authorization': `Bearer ${state.token}`,
    'Content-Type': 'application/json',
  };
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

function refreshAll() {
  switchTab(state.activeTab);
}

// 1. Overview Tab Data
async function loadOverviewData() {
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
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color: var(--text-dim);">No attendance recorded yet today. Click "Simulate Check-in" above!</td></tr>`;
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
  const select = document.getElementById('heatmapEmpSelect');
  if (select.value) {
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

  // Background desktop mockup grid
  ctx.fillStyle = '#090c15';
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
          ctx.fillStyle = ratio > 0.6 ? '#ffffff' : '#94a3b8';
          ctx.font = '10px Inter, sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(count.toString(), x + cellW / 2, y + cellH / 2);
        }
      } else {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
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
  try {
    const res = await fetch(`${API_BASE}/screenshots?page=1&limit=24`, { headers: authHeaders() });
    if (res.ok) {
      const data = await res.json();
      const grid = document.getElementById('screenshotsGalleryGrid');
      grid.innerHTML = '';
      if (!data.items || data.items.length === 0) {
        grid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: var(--text-dim); padding: 40px;">No screenshots captured yet. Click "Capture Screenshot" on top to test.</div>`;
        return;
      }
      data.items.forEach(ss => {
        const card = document.createElement('div');
        card.className = 'gallery-card';
        const dt = new Date(ss.captured_at).toLocaleString();
        card.innerHTML = `
          <div class="thumbnail-box">
            <img src="${ss.image_url}" alt="Screenshot" loading="lazy">
          </div>
          <div class="gallery-info">
            <div class="gallery-emp">${ss.employee_name || 'Employee'}</div>
            <div class="gallery-time">${dt} &bull; ${Math.round(ss.file_size_bytes / 1024)} KB</div>
          </div>
        `;
        card.addEventListener('click', () => {
          openScreenshotModal(ss.image_url, `${ss.employee_name} — ${dt}`);
        });
        grid.appendChild(card);
      });
    }
  } catch (err) {
    console.error('Error loading screenshots:', err);
  }
}

function openScreenshotModal(imgUrl, title) {
  const modal = document.getElementById('screenshotModal');
  document.getElementById('modalImage').src = imgUrl;
  document.getElementById('modalTitle').textContent = title;
  modal.classList.add('active');
}

// 5. Rules & Stars Tab
async function loadRulesAndStars() {
  try {
    const rulesRes = await fetch(`${API_BASE}/rules`, { headers: authHeaders() });
    if (rulesRes.ok) {
      const rules = await rulesRes.json();
      const container = document.getElementById('rulesListContainer');
      container.innerHTML = '';
      rules.forEach(r => {
        const div = document.createElement('div');
        div.style.marginBottom = '12px';
        div.innerHTML = `
          <div style="font-weight: 700; color: #fff;">${r.name} (${r.rule_type})</div>
          <pre style="background: rgba(0,0,0,0.3); padding: 8px; border-radius: 6px; font-size: 0.75rem; margin-top: 4px; overflow-x: auto;">${JSON.stringify(r.config_payload, null, 2)}</pre>
        `;
        container.appendChild(div);
      });
    }

    const starsRes = await fetch(`${API_BASE}/rules/stars`, { headers: authHeaders() });
    if (starsRes.ok) {
      const stars = await starsRes.json();
      const starsContainer = document.getElementById('starsListContainer');
      starsContainer.innerHTML = '';
      if (stars.length === 0) {
        starsContainer.innerHTML = '<span style="color: var(--text-dim);">No stars awarded yet today. Click "Evaluate Stars Today" to calculate.</span>';
        return;
      }
      stars.forEach(s => {
        const item = document.createElement('div');
        item.style.marginBottom = '8px';
        item.innerHTML = `⭐ <strong>${s.reason}</strong> &bull; Date: ${s.award_date}`;
        starsContainer.appendChild(item);
      });
    }
  } catch (err) {
    console.error('Error loading rules & stars:', err);
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

// 6. Windows Agent Simulator Implementation
async function getOrRegisterSimulatorDevice() {
  if (state.currentDeviceToken) return state.currentDeviceToken;

  const res = await fetch(`${API_BASE}/devices/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      employee_code: 'EMP001',
      device_identifier: 'DEV-SIMULATOR-001',
      hostname: 'ALEX-SIMULATED-PC',
      os_version: 'Windows 11 Pro 23H2',
      agent_version: '1.0.0-rust-sim'
    })
  });
  if (res.ok) {
    const data = await res.json();
    state.currentDeviceToken = data.api_token;
    return state.currentDeviceToken;
  }
  return null;
}

async function simulateCheckIn(type) {
  const token = await getOrRegisterSimulatorDevice();
  if (!token) {
    alert('Failed to register device token.');
    return;
  }

  const todayStr = new Date().toISOString().split('T')[0];
  const startTime = type === 'ontime' ? `${todayStr}T08:54:00Z` : `${todayStr}T09:25:00Z`;
  const endTime = type === 'ontime' ? `${todayStr}T09:00:00Z` : `${todayStr}T09:30:00Z`;

  const syncPayload = {
    system_events: [
      { event_type: 'BOOT', timestamp: `${todayStr}T08:30:00Z` },
      { event_type: 'LOGIN', timestamp: startTime }
    ],
    activity_batches: [
      {
        start_time: startTime,
        end_time: endTime,
        key_press_count: type === 'ontime' ? 340 : 120,
        mouse_click_count: 55,
        mouse_move_count: 850,
        active_seconds: 360,
        idle_seconds: 0
      }
    ],
    heatmap_batches: [
      {
        window_start: startTime,
        window_end: endTime,
        screen_width: 1920,
        screen_height: 1080,
        grid_cols: 20,
        grid_rows: 12,
        grid_matrix: {
          '1,2': 18, '2,2': 24, '3,5': 12, '5,8': 35, '6,8': 42,
          '4,10': 15, '7,15': 29, '8,15': 38, '0,0': 8
        }
      }
    ]
  };

  const res = await fetch(`${API_BASE}/agent/sync/batch`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Device-Token': token
    },
    body: JSON.stringify(syncPayload)
  });

  if (res.ok) {
    alert(`Simulated ${type === 'ontime' ? 'On-Time (PRESENT)' : 'Late Arrival (LATE)'} check-in successfully!`);
    refreshAll();
  }
}

async function simulateScreenshotCapture() {
  const token = await getOrRegisterSimulatorDevice();
  if (!token) return;

  // Generate mock WebP canvas screenshot
  const simCanvas = document.createElement('canvas');
  simCanvas.width = 1280;
  simCanvas.height = 720;
  const simCtx = simCanvas.getContext('2d');

  // Draw simulated desktop
  simCtx.fillStyle = '#0f172a';
  simCtx.fillRect(0, 0, 1280, 720);

  // Gradient window
  const grad = simCtx.createLinearGradient(100, 100, 1100, 600);
  grad.addColorStop(0, '#1e293b');
  grad.addColorStop(1, '#0f172a');
  simCtx.fillStyle = grad;
  simCtx.fillRect(80, 80, 1120, 540);

  // Code editor lines
  simCtx.fillStyle = '#38bdf8';
  simCtx.font = '24px monospace';
  simCtx.fillText('// WorkPulse Desktop Session Simulator', 120, 140);
  simCtx.fillStyle = '#a5b4fc';
  simCtx.fillText(`// Captured: ${new Date().toISOString()}`, 120, 180);

  for (let i = 0; i < 8; i++) {
    simCtx.fillStyle = i % 2 === 0 ? 'rgba(99, 102, 241, 0.4)' : 'rgba(16, 185, 129, 0.3)';
    simCtx.fillRect(120, 220 + i * 35, 300 + (i * 70 % 500), 18);
  }

  simCanvas.toBlob(async (blob) => {
    const formData = new FormData();
    formData.append('file', blob, 'desktop_capture.webp');
    formData.append('captured_at', new Date().toISOString());
    formData.append('width', '1280');
    formData.append('height', '720');

    const res = await fetch(`${API_BASE}/agent/screenshots/upload`, {
      method: 'POST',
      headers: { 'X-Device-Token': token },
      body: formData
    });

    if (res.ok) {
      alert('Simulated screenshot uploaded and compressed as WebP!');
      if (state.activeTab === 'tab-screenshots') loadScreenshotsGallery();
    }
  }, 'image/webp', 0.65);
}
