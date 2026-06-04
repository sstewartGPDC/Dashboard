// ─── GPDC Dashboard App Boot ─────────────────────────────────────────
// This is the entry point. It checks auth, loads data, and initializes everything.

window.__userRole = 'user';
window.__userId = null;
window.__dataSource = 'none';
window.__freshUpload = false;

// ─── Dashboard Templates ────────────────────────────────────────────
const DASHBOARD_TEMPLATES = [
  {
    id: 'caseload',
    name: 'Caseload Overview',
    description: 'Track case volume, attorney workload, and case flow across circuits.',
    icon: 'folder',
    cards: [
      { id: 't1', type: 'kpi', title: 'Total Cases', width: 'small', field: 'totalCases', icon: 'folder', format: 'number', subtitle: 'Active cases statewide' },
      { id: 't2', type: 'kpi', title: 'New Cases', width: 'small', field: 'newCases', icon: 'plus', format: 'number', subtitle: 'Opened this period' },
      { id: 't3', type: 'kpi', title: 'Closed Cases', width: 'small', field: 'closed', icon: 'check', format: 'number', subtitle: 'Resolved this period' },
      { id: 't4', type: 'kpi', title: 'Caseload / Attorney', width: 'small', field: 'caseload', icon: 'trending-up', format: 'number', subtitle: 'Avg cases per attorney' },
      { id: 't5', type: 'bar', title: 'Top Circuits by Cases', subtitle: '10 highest-volume circuits', width: 'medium', field: 'totalCases', colorClass: 'gold', limit: 10, sort: 'desc' },
      { id: 't6', type: 'bar', title: 'Caseload per Attorney', subtitle: 'Highest cases-per-attorney ratio', width: 'medium', field: 'caseload', colorClass: 'danger', limit: 10, sort: 'desc' },
      { id: 't7', type: 'donut', title: 'Case Flow Breakdown', subtitle: 'New, closed, and remaining cases', width: 'medium', segments: [{ field: 'newCases', label: 'New Cases', color: '#c4714e' }, { field: 'closed', label: 'Closed', color: '#5fa87a' }, { field: 'activeRemaining', label: 'Remaining', color: '#e2b77a' }], centerLabel: 'Total' },
      { id: 't8', type: 'bar', title: 'Circuits by New Cases', subtitle: '10 busiest circuits', width: 'medium', field: 'newCases', colorClass: 'teal', limit: 10, sort: 'desc' },
    ]
  },
  {
    id: 'hr',
    name: 'Human Resources',
    description: 'Monitor attorney staffing levels, vacancy rates, and position distribution.',
    icon: 'users',
    cards: [
      { id: 't1', type: 'kpi', title: 'State Attorneys', width: 'small', field: 'stateFilled', icon: 'users', format: 'number', subtitle: 'GPDC employed' },
      { id: 't2', type: 'kpi', title: 'Vacancy Rate', width: 'small', field: 'vacancyRate', icon: 'alert', format: 'percent', subtitle: 'Unfilled state positions' },
      { id: 't3', type: 'kpi', title: 'County Attorneys', width: 'small', field: 'countyAttorneys', icon: 'briefcase', format: 'number', subtitle: 'County-funded positions' },
      { id: 't4', type: 'kpi', title: 'Total Attorneys', width: 'small', field: 'totalAttorneys', icon: 'globe', format: 'number', subtitle: 'All attorneys statewide' },
      { id: 't5', type: 'donut', title: 'Attorney Distribution', subtitle: 'State vs county positions', width: 'medium', segments: [{ field: 'stateFilled', label: 'State (GPDC)', color: '#c4714e' }, { field: 'countyAttorneys', label: 'County', color: '#e2b77a' }], centerLabel: 'Total' },
      { id: 't6', type: 'ring', title: 'Position Status', subtitle: 'Filled vs vacant state positions', width: 'medium', segments: [{ field: 'stateFilled', label: 'Filled', color: '#5fa87a' }, { field: 'stateVacant', label: 'Vacant', color: '#d45454' }], centerLabel: 'Vacancy' },
      { id: 't7', type: 'bar', title: 'Vacancies by Circuit', subtitle: 'Circuits with most unfilled positions', width: 'medium', field: 'stateVacant', colorClass: 'danger', limit: 10, sort: 'desc' },
    ]
  },
  {
    id: 'operations',
    name: 'Operations',
    description: 'Fleet vehicles, leases, and facility management across circuits. Upload operations data to populate.',
    icon: 'trending-up',
    cards: [
      { id: 't1', type: 'kpi', title: 'Fleet Vehicles', width: 'small', field: 'totalCases', icon: 'globe', format: 'number', subtitle: 'Upload operations data' },
      { id: 't2', type: 'kpi', title: 'Active Leases', width: 'small', field: 'newCases', icon: 'folder', format: 'number', subtitle: 'Upload operations data' },
      { id: 't3', type: 'kpi', title: 'Facilities', width: 'small', field: 'closed', icon: 'briefcase', format: 'number', subtitle: 'Upload operations data' },
      { id: 't4', type: 'kpi', title: 'Maintenance Items', width: 'small', field: 'conflictNew', icon: 'alert', format: 'number', subtitle: 'Upload operations data' },
      { id: 't5', type: 'bar', title: 'Vehicles by Circuit', subtitle: 'Upload operations data to populate', width: 'medium', field: 'totalCases', colorClass: 'gold', limit: 10, sort: 'desc' },
      { id: 't6', type: 'donut', title: 'Lease Status', subtitle: 'Upload operations data to populate', width: 'medium', segments: [{ field: 'newCases', label: 'Active', color: '#5fa87a' }, { field: 'closed', label: 'Expiring', color: '#d45454' }, { field: 'activeRemaining', label: 'Pending', color: '#e2b77a' }], centerLabel: 'Total' },
      { id: 't7', type: 'bar', title: 'Facilities by Circuit', subtitle: 'Upload operations data to populate', width: 'medium', field: 'closed', colorClass: 'teal', limit: 10, sort: 'desc' },
      { id: 't8', type: 'line', title: 'Monthly Lease Costs', subtitle: 'Upload operations data to populate', width: 'medium', field: 'newCases', colorClass: 'danger', limit: 20, sort: 'desc' },
    ]
  },
  {
    id: 'admin',
    name: 'Administration',
    description: 'Staff numbers, positions, and personnel across circuits. Upload admin data to populate.',
    icon: 'users',
    cards: [
      { id: 't1', type: 'kpi', title: 'Total Staff', width: 'small', field: 'totalAttorneys', icon: 'users', format: 'number', subtitle: 'All positions statewide' },
      { id: 't2', type: 'kpi', title: 'State Positions', width: 'small', field: 'stateFilled', icon: 'briefcase', format: 'number', subtitle: 'GPDC-funded positions' },
      { id: 't3', type: 'kpi', title: 'County Positions', width: 'small', field: 'countyAttorneys', icon: 'globe', format: 'number', subtitle: 'County-funded positions' },
      { id: 't4', type: 'kpi', title: 'Vacancy Rate', width: 'small', field: 'vacancyRate', icon: 'alert', format: 'percent', subtitle: 'Unfilled positions' },
      { id: 't5', type: 'donut', title: 'Staff Distribution', subtitle: 'State vs county positions', width: 'medium', segments: [{ field: 'stateFilled', label: 'State (GPDC)', color: '#c4714e' }, { field: 'countyAttorneys', label: 'County', color: '#e2b77a' }], centerLabel: 'Total' },
      { id: 't6', type: 'ring', title: 'Position Status', subtitle: 'Filled vs vacant', width: 'medium', segments: [{ field: 'stateFilled', label: 'Filled', color: '#5fa87a' }, { field: 'stateVacant', label: 'Vacant', color: '#d45454' }], centerLabel: 'Status' },
      { id: 't7', type: 'bar', title: 'Vacancies by Circuit', subtitle: 'Circuits with most unfilled roles', width: 'medium', field: 'stateVacant', colorClass: 'danger', limit: 10, sort: 'desc' },
      { id: 't8', type: 'bar', title: 'Staff by Circuit', subtitle: 'Headcount per circuit', width: 'medium', field: 'totalAttorneys', colorClass: 'gold', limit: 10, sort: 'desc' },
    ]
  },
  {
    id: 'finance',
    name: 'Finance',
    description: 'Attorney and contractor spend, staffing costs, and budget allocation. Upload finance data to populate.',
    icon: 'dollar',
    cards: [
      { id: 't1', type: 'kpi', title: 'Attorney Positions', width: 'small', field: 'totalAttorneys', icon: 'users', format: 'number', subtitle: 'Total funded positions' },
      { id: 't2', type: 'kpi', title: 'Vacant Positions', width: 'small', field: 'stateVacant', icon: 'alert', format: 'number', subtitle: 'Unfilled (cost savings)' },
      { id: 't3', type: 'kpi', title: 'Contractors', width: 'small', field: 'conflictContractors', icon: 'dollar', format: 'number', subtitle: 'Conflict contractors' },
      { id: 't4', type: 'kpi', title: 'Cost per Case', width: 'small', field: 'caseload', icon: 'trending-up', format: 'number', subtitle: 'Upload finance data' },
      { id: 't5', type: 'ring', title: 'Staffing Budget', subtitle: 'State, county, and contract positions', width: 'medium', segments: [{ field: 'stateFilled', label: 'State Attorneys', color: '#5fa87a' }, { field: 'stateVacant', label: 'Vacant Slots', color: '#d45454' }, { field: 'countyAttorneys', label: 'County', color: '#e2b77a' }], centerLabel: 'Total' },
      { id: 't6', type: 'bar', title: 'Contractor Use by Circuit', subtitle: 'Conflict contractor distribution', width: 'medium', field: 'conflictContractors', colorClass: 'teal', limit: 10, sort: 'desc' },
      { id: 't7', type: 'pie', title: 'Resource Allocation', subtitle: 'Cases vs contractors', width: 'medium', segments: [{ field: 'conflictNew', label: 'Conflict Cases', color: '#c4714e' }, { field: 'conflictContractors', label: 'Contractors', color: '#4ea8a0' }], centerLabel: 'Total' },
    ]
  }
];

// Current data-source intent (from the toggle), defaulting to auto.
function currentSource() {
  const t = $('dataSourceToggle');
  return (t && t.value) || 'auto';
}

// Map a server circuit row to the in-app metrics shape.
function circuitRowToMetrics(row) {
  return {
    totalCases: row.total_cases || 0,
    newCases: row.new_cases || 0,
    closed: row.closed_cases || 0,
    stateFilled: row.state_attorneys_filled || 0,
    stateVacant: row.state_attorneys_vacant || 0,
    countyAttorneys: row.county_attorneys || 0,
    conflict: {
      newCases: row.conflict_new_cases || 0,
      rolloverCases: row.conflict_rollover_cases || 0,
      totalContractors: row.total_contractors || 0,
    },
    capitalCases: row.capital_cases || 0,
    felonyCases: row.felony_cases || 0,
    misdemeanorCases: row.misdemeanor_cases || 0,
    juvenileCases: row.juvenile_cases || 0,
    appealsCases: row.appeals_cases || 0,
    probationCases: row.probation_cases || 0,
    investigators: row.investigators || 0,
    socialWorkers: row.social_workers || 0,
    paralegals: row.paralegals || 0,
    annualBudget: row.annual_budget || 0,
    actualSpend: row.actual_spend || 0,
  };
}

async function loadDataFromAPI(source) {
  try {
    const src = source || currentSource();
    const fyParam = window.__currentFY ? `&fy=${window.__currentFY}` : '';
    const url = `api/data?source=${src}${fyParam}`;
    const res = await fetch(url);
    const data = await res.json();

    if (!data.ok) return;

    window.__dataSource = data.source;
    // Pin the current fiscal year from the response (first load / latest).
    if (!window.__currentFY && data.fiscalYear) window.__currentFY = data.fiscalYear;

    // Apply custom field labels if provided
    if (data.fieldLabels) {
      FIELD_LABELS = { ...DEFAULT_FIELD_LABELS, ...data.fieldLabels };
    }

    const hasUploadedData = data.source !== 'sample' && data.circuits && data.circuits.length;

    // Circuits + Map views only make sense with data — hide their tabs until then.
    updateNavTabs(hasUploadedData);

    // Show/hide clear data button based on whether data exists
    const clearSection = $('clearDataSection');
    if (clearSection) clearSection.style.display = hasUploadedData ? '' : 'none';
    // Also toggle the header clear data button
    const clearBtnHeader = $('clearDataBtnHeader');
    if (clearBtnHeader) clearBtnHeader.style.display = hasUploadedData ? 'flex' : 'none';

    if (!hasUploadedData) {
      initEmptyMetrics();
      updateDataSourceBadge('none');
      showEmptyState(true);
    } else {
      const newMetrics = new Map();
      data.circuits.forEach(row => {
        newMetrics.set(row.circuit, circuitRowToMetrics(row));
      });

      CIRCUITS.forEach(c => {
        if (!newMetrics.has(c.circuit)) {
          newMetrics.set(c.circuit, emptyMetrics());
        }
      });

      const wasEmpty = !__hasData;
      CIRCUIT_METRICS = newMetrics;
      __hasData = true;
      updateDataSourceBadge(data.source);
      showEmptyState(false);

      // Show suggested cards only after a fresh upload (not on page load)
      if (wasEmpty && window.__freshUpload && typeof showSuggestedCardsModal === 'function') {
        showSuggestedCardsModal();
      }
      window.__freshUpload = false;
    }

    rerender();

    // Year-over-year: load the comparison period (if any) and render the strip.
    await refreshComparison(src);
    if (typeof renderYoY === 'function') renderYoY();
  } catch (err) {
    console.error('Failed to load data:', err);
    initEmptyMetrics();
    updateDataSourceBadge('none');
    showEmptyState(true);
    rerender();
  }
}

// Load the comparison (prior fiscal year) dataset into CIRCUIT_METRICS_PRIOR.
async function refreshComparison(source) {
  CIRCUIT_METRICS_PRIOR = new Map();
  if (!window.__compareFY) return;
  try {
    const src = source || currentSource();
    const res = await fetch(`api/data?source=${src}&fy=${window.__compareFY}`);
    const data = await res.json();
    if (data.ok && data.circuits && data.circuits.length) {
      const m = new Map();
      data.circuits.forEach(row => m.set(row.circuit, circuitRowToMetrics(row)));
      CIRCUIT_METRICS_PRIOR = m;
    }
  } catch (err) {
    console.error('Failed to load comparison period:', err);
  }
}

// Populate the period + compare selectors from available fiscal years.
async function loadPeriods() {
  const periodSel = $('periodSelect');
  const compareSel = $('compareSelect');
  const ctl = $('periodControls');
  if (!periodSel || !compareSel) return;
  try {
    const res = await fetch(`api/data/periods?source=${currentSource()}`);
    const data = await res.json();
    const all = (data.ok && data.periods) ? data.periods : [];
    // Annual periods only, de-duped by fiscal year, newest first.
    const seen = new Set();
    const years = [];
    all.forEach(p => {
      if (p.period === 'annual' && p.fiscalYear != null && !seen.has(p.fiscalYear)) {
        seen.add(p.fiscalYear);
        years.push(p);
      }
    });

    if (years.length === 0) { ctl.style.display = 'none'; return; }
    ctl.style.display = 'flex';

    if (!window.__currentFY) window.__currentFY = years[0].fiscalYear;
    // Comparison can't equal the current year.
    if (window.__compareFY === window.__currentFY) window.__compareFY = null;
    // Default the comparison to the immediately prior year, if present.
    if (window.__compareFY == null) {
      const prior = years.find(p => p.fiscalYear === window.__currentFY - 1);
      if (prior) window.__compareFY = prior.fiscalYear;
    }

    periodSel.innerHTML = years
      .map(p => `<option value="${p.fiscalYear}" ${p.fiscalYear === window.__currentFY ? 'selected' : ''}>${p.label}</option>`)
      .join('');
    compareSel.innerHTML = ['<option value="">No comparison</option>']
      .concat(years
        .filter(p => p.fiscalYear !== window.__currentFY)
        .map(p => `<option value="${p.fiscalYear}" ${p.fiscalYear === window.__compareFY ? 'selected' : ''}>${p.label}</option>`))
      .join('');
  } catch (err) {
    console.error('Failed to load periods:', err);
    if (ctl) ctl.style.display = 'none';
  }
}

function updateDataSourceBadge(source) {
  const badge = $('dataSourceBadge');
  if (!badge) return;
  if (source === 'none' || source === 'sample') {
    badge.textContent = 'No Data';
    badge.className = 'data-source-badge sample';
  } else if (source === 'shared') {
    badge.textContent = 'Shared Data';
    badge.className = 'data-source-badge shared';
  } else if (source === 'personal') {
    badge.textContent = 'My Data';
    badge.className = 'data-source-badge personal';
  }
}

// Show the Circuits + Map tabs only when data exists; if data goes away while
// on one of those views, fall back to the Dashboard view.
function updateNavTabs(hasData) {
  const circuits = $('tabCircuits');
  const map = $('tabMap');
  if (circuits) circuits.style.display = hasData ? '' : 'none';
  if (map) map.style.display = hasData ? '' : 'none';
  if (!hasData) {
    const onOther = ($('viewCircuits') && $('viewCircuits').classList.contains('active')) ||
                    ($('viewMap') && $('viewMap').classList.contains('active'));
    if (onOther && typeof showDashboardView === 'function') showDashboardView();
  }
}

function showEmptyState(show) {
  const banner = $('emptyStateBanner');
  const content = $('dashboardContent');
  if (banner) banner.classList.toggle('visible', show);
  if (content) content.classList.toggle('hidden', show);
}

// Reusable clear-data handler
async function handleClearData() {
  if (!confirm('Are you sure you want to clear all uploaded data? This cannot be undone.')) return;
  try {
    const res = await fetch('api/data/clear', { method: 'DELETE' });
    const data = await res.json();
    if (data.ok) {
      FIELD_LABELS = { ...DEFAULT_FIELD_LABELS };
      await loadDataFromAPI();
    } else {
      alert('Failed to clear data: ' + (data.error || 'Unknown error'));
    }
  } catch (err) {
    console.error('Clear data failed:', err);
    alert('Failed to clear data.');
  }
}

// Dropdown toggle helper
function setupDropdown(btnId, dropdownId) {
  const btn = $(btnId);
  const dropdown = $(dropdownId);
  if (!btn || !dropdown) return;
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    // Close other dropdowns
    document.querySelectorAll('.header-dropdown.open').forEach(d => {
      if (d !== dropdown) d.classList.remove('open');
    });
    dropdown.classList.toggle('open');
  });
}

async function initApp() {
  // 1. Check authentication
  try {
    const res = await fetch('api/auth/me');
    const data = await res.json();
    if (!data.ok) {
      window.location.href = 'login.html';
      return;
    }
    window.__userRole = data.user.role;
    window.__userId = data.user.id;

    // Show user info in header
    const userEl = $('headerUserName');
    const displayName = data.user.displayName || data.user.username;
    if (userEl) userEl.textContent = displayName;

    // Set user avatar initial
    const avatarEl = $('headerUserAvatar');
    if (avatarEl) avatarEl.textContent = (displayName || '?').charAt(0).toUpperCase();

    // Show admin controls
    if (data.user.role === 'admin') {
      const badge = $('headerAdminBadge');
      if (badge) badge.style.display = 'inline';
      const manageBtn = $('manageUsersBtn');
      if (manageBtn) {
        manageBtn.style.display = 'flex';
        manageBtn.addEventListener('click', showUserManagement);
      }
      const mtBtn = $('manageTemplatesUploadBtn');
      if (mtBtn) mtBtn.style.display = 'inline-flex';
    }

    // Read-only viewers: lock the UI and hide all editing entry points. Data
    // writes are also blocked server-side (requireEditor).
    if (data.user.role === 'viewer') {
      document.body.classList.add('role-viewer');
      if (typeof chartEngine !== 'undefined') chartEngine.locked = true;
      const tabUpload = $('tabUpload');
      if (tabUpload) tabUpload.style.display = 'none';
      const lockBtn = $('lockToggleBtn');
      if (lockBtn) lockBtn.style.display = 'none';
    }
  } catch (err) {
    console.error('Auth check failed:', err);
    window.location.href = 'login.html';
    return;
  }

  // 2. Load data from API (latest period)
  await loadDataFromAPI();

  // 2a. Populate period/compare selectors, then reload so the YoY strip fills
  // (the first load ran before we knew which years exist).
  await loadPeriods();
  if (window.__compareFY) await loadDataFromAPI();

  // 2b. Load dashboards (uses /api/dashboards now)
  await chartEngine.loadDashboards();

  // 2c. Wire up dashboard name + switcher
  wireDashboardSwitcher();

  // 3. Initialize dashboard components
  initFilters();
  initMap();
  renderCharts();

  // 4. Wire up tab navigation
  $("tabDashboard").addEventListener("click", showDashboardView);
  $("tabCircuits").addEventListener("click", showCircuitsView);
  $("tabMap").addEventListener("click", showMapView);
  $("tabUpload").addEventListener("click", showUploadView);

  // Brand logo → home (Dashboard view)
  const brandLink = $('brandHomeLink');
  if (brandLink) {
    brandLink.addEventListener('click', (e) => {
      e.preventDefault();
      showDashboardView();
    });
  }

  // Home button → Dashboard view
  const homeBtn = $('headerHomeBtn');
  if (homeBtn) {
    homeBtn.addEventListener('click', (e) => {
      e.preventDefault();
      showDashboardView();
    });
  }

  // 5. Wire up table export buttons (Circuit Breakdown view)
  $("tableExportPng").addEventListener("click", exportTablePNG);
  $("tableExportPdf").addEventListener("click", exportTablePDF);

  // 6. Wire up upload
  $("uploadBtn").addEventListener("click", () => $("fileInput").click());
  $("fileInput").addEventListener("change", (e) => {
    if (e.target.files.length > 0) handleFileSelect(e.target.files[0]);
  });
  const emptyUploadBtn = $('emptyStateUploadBtn');
  if (emptyUploadBtn) {
    emptyUploadBtn.addEventListener('click', showUploadView);
  }
  // "Build from Scratch" — dismiss empty state, show dashboard with default cards
  const buildScratchBtn = $('emptyStateBuildBtn');
  if (buildScratchBtn) {
    buildScratchBtn.addEventListener('click', () => {
      showEmptyState(false);
      chartEngine.render();
    });
  }
  // "Choose a Template" — open template picker modal
  const templateBtn = $('emptyStateTemplateBtn');
  if (templateBtn) {
    templateBtn.addEventListener('click', () => {
      showTemplatePicker();
    });
  }

  // 6b. Dashboard template download (Excel matching current cards' fields)
  const templateDlBtn = $('dashboardTemplateDlBtn');
  if (templateDlBtn) {
    templateDlBtn.addEventListener('click', async () => {
      if (!chartEngine.layout || !chartEngine.layout.length) {
        alert('Add some cards to your dashboard first, then download a matching template.');
        return;
      }
      const fieldKeys = new Set();
      chartEngine.layout.forEach(card => {
        if (card.field) fieldKeys.add(card.field);
        if (card.segments) {
          card.segments.forEach(seg => { if (seg.field) fieldKeys.add(seg.field); });
        }
      });
      const fields = [...fieldKeys].join(',');
      const name = encodeURIComponent(chartEngine._activeDashboardName || 'Dashboard');
      try {
        const res = await fetch(`api/data/template-for-dashboard?fields=${fields}&name=${name}`);
        if (!res.ok) throw new Error('Download failed');
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `GPDC_${chartEngine._activeDashboardName || 'Dashboard'}_Template.xlsx`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      } catch (err) {
        console.error('Template download failed:', err);
        alert('Failed to download template. Please try again.');
      }
    });
  }

  // 6c. Generic template download (fetch+Blob for Electron compatibility)
  const genericTemplateBtn = $('downloadTemplateBtn');
  if (genericTemplateBtn) {
    genericTemplateBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      try {
        const res = await fetch('api/data/template');
        if (!res.ok) throw new Error('Download failed');
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'GPDC_Dashboard_Template.xlsx';
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      } catch (err) {
        console.error('Template download failed:', err);
        alert('Failed to download template.');
      }
    });
  }

  // 6d. Welcome page template link
  const welcomeTemplateLink = $('welcomeTemplateLink');
  if (welcomeTemplateLink) {
    welcomeTemplateLink.addEventListener('click', async (e) => {
      e.preventDefault();
      try {
        const res = await fetch('api/data/template');
        if (!res.ok) throw new Error('Download failed');
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'GPDC_Dashboard_Template.xlsx';
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      } catch (err) {
        console.error('Template download failed:', err);
        alert('Failed to download template.');
      }
    });
  }

  // 7. Data source toggle
  const sourceToggle = $('dataSourceToggle');
  if (sourceToggle) {
    sourceToggle.addEventListener('change', async (e) => {
      window.__currentFY = null;       // re-resolve latest for the new source
      window.__compareFY = null;
      await loadDataFromAPI(e.target.value);
      await loadPeriods();
      if (window.__compareFY) await loadDataFromAPI(e.target.value);
    });
  }

  // 7a. Period + comparison selectors (year-over-year)
  const periodSel = $('periodSelect');
  if (periodSel) {
    periodSel.addEventListener('change', async (e) => {
      window.__currentFY = parseInt(e.target.value, 10) || null;
      if (window.__compareFY === window.__currentFY) window.__compareFY = null;
      await loadPeriods();
      await loadDataFromAPI();
    });
  }
  const compareSel = $('compareSelect');
  if (compareSel) {
    compareSel.addEventListener('change', async (e) => {
      window.__compareFY = e.target.value ? parseInt(e.target.value, 10) : null;
      await loadDataFromAPI();
    });
  }

  // 7b. Data export (Excel / CSV)
  const xlsxBtn = $('exportXlsxBtn');
  if (xlsxBtn) xlsxBtn.addEventListener('click', () => { if (typeof exportData === 'function') exportData('xlsx'); });
  const csvBtn = $('exportCsvBtn');
  if (csvBtn) csvBtn.addEventListener('click', () => { if (typeof exportData === 'function') exportData('csv'); });

  // 7c. Templates gallery
  const tplBtn = $('dashboardTemplateBtn');
  if (tplBtn) tplBtn.addEventListener('click', (e) => { e.stopPropagation(); if (typeof openTemplateGallery === 'function') openTemplateGallery(); });

  // 7d. Lock / present mode
  const lockBtn = $('lockToggleBtn');
  if (lockBtn) lockBtn.addEventListener('click', () => { if (typeof toggleLock === 'function') toggleLock(); });

  // 7e. Data collection: submit form + template builder
  const submitFormBtn = $('submitFormBtn');
  if (submitFormBtn) submitFormBtn.addEventListener('click', () => { if (typeof openSubmitForm === 'function') openSubmitForm(); });
  const manageTplBtn = $('manageTemplatesUploadBtn');
  if (manageTplBtn) manageTplBtn.addEventListener('click', () => { if (typeof openTemplateBuilder === 'function') openTemplateBuilder(); });

  // 8. Header dropdowns
  setupDropdown('exportDropdownBtn', 'exportDropdown');
  setupDropdown('userDropdownBtn', 'userDropdown');
  // Close dropdowns on click outside
  document.addEventListener('click', (e) => {
    document.querySelectorAll('.header-dropdown.open').forEach(d => {
      if (!d.closest('.header-dropdown-wrap').contains(e.target)) {
        d.classList.remove('open');
      }
    });
  });

  // 9. Export buttons (header dropdown)
  $('exportPngBtn')?.addEventListener('click', () => {
    $('exportDropdown').classList.remove('open');
    showExportBar('png');
  });
  $('exportPdfBtn')?.addEventListener('click', () => {
    $('exportDropdown').classList.remove('open');
    showExportBar('pdf');
  });

  // 10. Export bar buttons
  $('exportBarPng')?.addEventListener('click', () => runExport('png'));
  $('exportBarPdf')?.addEventListener('click', () => runExport('pdf'));
  $('exportBarCancel')?.addEventListener('click', () => {
    $('exportBar').style.display = 'none';
  });

  // 11. Logout
  $('logoutBtn')?.addEventListener('click', async () => {
    await fetch('api/auth/logout', { method: 'POST' });
    window.location.href = 'login.html';
  });

  // 12. Clear data (both upload panel button and header dropdown button)
  $('clearDataBtn')?.addEventListener('click', handleClearData);
  $('clearDataBtnHeader')?.addEventListener('click', () => {
    $('userDropdown')?.classList.remove('open');
    handleClearData();
  });

  // 13. Card editor modal buttons (Done, Cancel, Close, Overlay)
  $('cardEditorDoneBtn')?.addEventListener('click', () => {
    chartEngine._closeSideEditor(false);
    chartEngine.render();
  });
  $('cardEditorCancelBtn')?.addEventListener('click', () => {
    chartEngine._closeSideEditor(true);
  });
  $('cardEditorClose')?.addEventListener('click', () => {
    chartEngine._closeSideEditor(false);
  });
  $('cardEditorOverlay')?.addEventListener('click', () => {
    chartEngine._closeSideEditor(true);
  });
}

// ─── Dashboard Switcher Wiring ─────────────────────────────────────

function _formatTimeAgo(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now - date;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return diffMin + 'm ago';
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return diffH + 'h ago';
  const diffD = Math.floor(diffH / 24);
  if (diffD < 30) return diffD + 'd ago';
  return date.toLocaleDateString();
}

function wireDashboardSwitcher() {
  const nameInput = $('dashboardName');
  const switcherBtn = $('dashboardSwitcherBtn');
  const switcherDropdown = $('dashboardSwitcherDropdown');
  const switcherList = $('dashboardSwitcherList');
  const newBtn = $('dashboardNewBtn');

  if (!nameInput || !switcherBtn || !switcherDropdown) return;

  // Set the current dashboard name
  if (chartEngine._activeDashboardName) {
    nameInput.value = chartEngine._activeDashboardName;
  }

  // Rename on blur
  nameInput.addEventListener('blur', () => {
    const newName = nameInput.value.trim();
    if (newName && newName !== chartEngine._activeDashboardName) {
      chartEngine.renameDashboard(newName);
    }
  });
  nameInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); nameInput.blur(); }
  });

  // Toggle dropdown
  switcherBtn.addEventListener('click', async (e) => {
    e.stopPropagation();
    const isOpen = switcherDropdown.classList.contains('open');
    document.querySelectorAll('.dashboard-switcher-dropdown.open').forEach(d => d.classList.remove('open'));

    if (!isOpen) {
      try {
        const res = await fetch('api/dashboards');
        const data = await res.json();
        chartEngine._dashboards = Array.isArray(data) ? data : (data.dashboards || []);
      } catch (err) {
        console.error('Failed to fetch dashboards:', err);
      }
      _renderSwitcherList();
      switcherDropdown.classList.add('open');
    }
  });

  // Close dropdown on outside click
  document.addEventListener('click', (e) => {
    if (!switcherDropdown.contains(e.target) && e.target !== switcherBtn) {
      switcherDropdown.classList.remove('open');
    }
  });

  // New dashboard button — inline input instead of prompt()
  if (newBtn) {
    newBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      // Replace the button with an inline input
      const inputWrap = document.createElement('div');
      inputWrap.className = 'switcher-new-input-wrap';
      inputWrap.innerHTML = '<input type="text" class="switcher-new-input" placeholder="Dashboard name\u2026" value="New Dashboard" autofocus><button class="switcher-new-create-btn">Create</button>';
      newBtn.style.display = 'none';
      newBtn.parentElement.appendChild(inputWrap);

      const input = inputWrap.querySelector('.switcher-new-input');
      const createBtn = inputWrap.querySelector('.switcher-new-create-btn');
      input.focus();
      input.select();

      const doCreate = async () => {
        const name = input.value.trim();
        if (!name) { inputWrap.remove(); newBtn.style.display = ''; return; }
        const id = await chartEngine.createDashboard(name);
        if (id) {
          await chartEngine.switchDashboard(id);
          nameInput.value = chartEngine._activeDashboardName;
          try {
            const res = await fetch('api/dashboards');
            const data = await res.json();
            chartEngine._dashboards = Array.isArray(data) ? data : (data.dashboards || []);
          } catch (err) { /* ignore */ }
        }
        inputWrap.remove();
        newBtn.style.display = '';
        switcherDropdown.classList.remove('open');
      };

      createBtn.addEventListener('click', doCreate);
      input.addEventListener('keydown', (ev) => {
        if (ev.key === 'Enter') doCreate();
        if (ev.key === 'Escape') { inputWrap.remove(); newBtn.style.display = ''; }
      });
    });
  }

  function _renderSwitcherList() {
    if (!switcherList) return;
    const dashboards = chartEngine._dashboards || [];
    if (dashboards.length === 0) {
      switcherList.innerHTML = '<div style="padding:0.75rem 1rem;color:#9ca3af;font-size:0.8rem;">No saved dashboards</div>';
      return;
    }
    switcherList.innerHTML = dashboards.map(d => {
      const isActive = d.id === chartEngine._activeDashboardId;
      const cardCount = (d.layout && Array.isArray(d.layout)) ? d.layout.length : (d.card_count || 0);
      const timeAgo = _formatTimeAgo(d.updated_at || d.created_at);
      const metaParts = [];
      if (cardCount > 0) metaParts.push(cardCount + ' card' + (cardCount !== 1 ? 's' : ''));
      if (timeAgo) metaParts.push(timeAgo);
      const metaStr = metaParts.join(' \u00b7 ');

      return `<button class="dashboard-switcher-item${isActive ? ' active' : ''}" data-dash-id="${d.id}">
        <div class="switcher-item-info">
          <span class="switcher-item-name">${d.name || 'Untitled'}</span>
          ${metaStr ? '<span class="switcher-item-meta">' + metaStr + '</span>' : ''}
        </div>
        ${isActive ? '<span class="dashboard-switcher-active-badge">Active</span>' : '<button class="dashboard-switcher-delete" data-delete-id="' + d.id + '" title="Delete">&times;</button>'}
      </button>`;
    }).join('');

    // Wire click to switch
    switcherList.querySelectorAll('.dashboard-switcher-item').forEach(item => {
      item.addEventListener('click', async (e) => {
        if (e.target.classList.contains('dashboard-switcher-delete')) return;
        const id = parseInt(item.dataset.dashId);
        if (id === chartEngine._activeDashboardId) {
          switcherDropdown.classList.remove('open');
          return;
        }
        switcherDropdown.classList.remove('open');
        await chartEngine.switchDashboard(id);
        nameInput.value = chartEngine._activeDashboardName;
      });
    });

    // Wire delete buttons
    switcherList.querySelectorAll('.dashboard-switcher-delete').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const id = parseInt(btn.dataset.deleteId);
        if (!confirm('Delete this dashboard?')) return;
        await chartEngine.deleteDashboard(id);
        _renderSwitcherList();
      });
    });
  }
}

// ─── Suggested Cards (Onboarding after first upload) ───────────────
let __suggestionsShown = false;

function showSuggestedCardsModal() {
  if (__suggestionsShown) return;
  __suggestionsShown = true;

  const suggested = chartEngine.generateSuggestedLayout();
  if (!suggested || suggested.length === 0) return;

  const modal = $('onboardingModal');
  const content = $('onboardingContent');
  if (!modal || !content) return;

  // Build preview cards
  const previewCards = suggested.map((card, i) => {
    const typeLabel = card.type === 'kpi' ? 'KPI'
      : card.type === 'bar' ? 'Bar Chart'
      : card.type === 'donut' ? 'Proportion'
      : card.type === 'pie' ? 'Pie Chart'
      : card.type === 'ring' ? 'Donut Chart'
      : card.type === 'line' ? 'Line Chart'
      : 'Card';
    const sizeLabel = card.width === 'small' ? '1 col' : card.width === 'large' ? '3 col' : card.width === 'full' ? 'Full' : '2 col';
    return `<label class="onboarding-card-preview" data-card-idx="${i}">
      <input type="checkbox" checked data-sg-idx="${i}">
      <div class="onboarding-card-preview-inner">
        <div class="onboarding-card-type">${typeLabel} &middot; ${sizeLabel}</div>
        <div class="onboarding-card-title">${card.title}</div>
        ${card.subtitle ? `<div class="onboarding-card-subtitle">${card.subtitle}</div>` : ''}
      </div>
    </label>`;
  }).join('');

  content.innerHTML = `
    <div class="onboarding-header">
      <h2>Your Dashboard is Ready</h2>
      <p>We've prepared some starter cards based on your data. Select the ones you'd like to include.</p>
    </div>
    <div class="onboarding-cards-preview">${previewCards}</div>
    <div class="onboarding-actions">
      <button class="onboarding-btn primary" id="onboardingAccept">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
        Build Dashboard
      </button>
      <button class="onboarding-btn secondary" id="onboardingSkip">Start Empty</button>
    </div>
  `;

  modal.classList.add('visible');

  // Accept — build with selected cards
  $('onboardingAccept').addEventListener('click', async () => {
    const selected = [];
    content.querySelectorAll('input[data-sg-idx]').forEach(cb => {
      if (cb.checked) {
        selected.push(suggested[parseInt(cb.dataset.sgIdx)]);
      }
    });
    modal.classList.remove('visible');
    if (selected.length > 0) {
      chartEngine.layout = selected;
      chartEngine._nextId = selected.length + 1;
      await chartEngine.saveDashboard();
      chartEngine.render();
    }
  });

  // Skip — empty dashboard
  $('onboardingSkip').addEventListener('click', () => {
    modal.classList.remove('visible');
    chartEngine.layout = [];
    chartEngine.saveDashboard();
    chartEngine.render();
  });

  // Close on background click
  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.classList.remove('visible');
  });
}

// ─── Template Picker ────────────────────────────────────────────────
function showTemplatePicker() {
  const modal = $('onboardingModal');
  const content = $('onboardingContent');
  if (!modal || !content) return;

  content.classList.add('template-picker-wide');

  const tilesHtml = DASHBOARD_TEMPLATES.map(tmpl => {
    const iconSvg = (typeof KPI_ICONS !== 'undefined' && KPI_ICONS[tmpl.icon]) ? KPI_ICONS[tmpl.icon] : '';
    const cardCount = tmpl.cards.length;
    const badgeText = cardCount + ' card' + (cardCount !== 1 ? 's' : '');

    return '<button class="template-tile" data-template-id="' + tmpl.id + '">'
      + '<div class="template-tile-icon">' + iconSvg + '</div>'
      + '<div class="template-tile-name">' + tmpl.name + '</div>'
      + '<div class="template-tile-desc">' + tmpl.description + '</div>'
      + '<div class="template-tile-badge">' + badgeText + '</div>'
      + '</button>';
  }).join('');

  content.innerHTML = ''
    + '<div class="onboarding-header">'
    + '  <h2>Choose a Dashboard Template</h2>'
    + '  <p>Pick a pre-built layout to get started. You can customize any template after it\'s applied.</p>'
    + '</div>'
    + '<div class="template-picker-grid">' + tilesHtml + '</div>';

  modal.classList.add('visible');

  // Wire tile click handlers
  content.querySelectorAll('.template-tile').forEach(tile => {
    tile.addEventListener('click', async () => {
      const templateId = tile.dataset.templateId;
      const template = DASHBOARD_TEMPLATES.find(t => t.id === templateId);
      if (!template) return;

      const cards = JSON.parse(JSON.stringify(template.cards));
      chartEngine.layout = cards;
      chartEngine._nextId = cards.length + 1;
      await chartEngine.saveDashboard();
      showEmptyState(false);
      chartEngine.render();

      modal.classList.remove('visible');
      content.classList.remove('template-picker-wide');
    });
  });

  // Close on background click
  const bgHandler = (e) => {
    if (e.target === modal) {
      modal.classList.remove('visible');
      content.classList.remove('template-picker-wide');
      modal.removeEventListener('click', bgHandler);
    }
  };
  modal.addEventListener('click', bgHandler);
}

// Export bar helpers
function showExportBar(format) {
  const bar = $('exportBar');
  if (!bar) return;
  bar.style.display = '';
  bar.dataset.format = format;
  const input = $('exportTitle');
  if (input) input.value = '';
  input?.focus();
}

function runExport(format) {
  const title = $('exportTitle')?.value || '';
  $('exportBar').style.display = 'none';
  exportCurrentView(format, title);
}

// Simple user management modal for admins
async function showUserManagement() {
  const res = await fetch('api/auth/users');
  const data = await res.json();
  if (!data.ok) return;

  const modal = document.createElement('div');
  modal.className = 'modal-overlay active';
  modal.id = 'userMgmtModal';
  modal.innerHTML = `
    <div class="modal-content" style="max-width:500px;padding:2rem;">
      <h3 style="margin-bottom:1rem;font-family:'Ubuntu',sans-serif;color:var(--gpdc-navy);">Manage Team</h3>
      <div id="userList" style="margin-bottom:1.5rem;">
        ${data.users.map(u => `<div style="display:flex;align-items:center;justify-content:space-between;padding:0.5rem 0;border-bottom:1px solid var(--gpdc-border);">
          <div><strong>${u.display_name || u.username}</strong> <span style="font-size:0.75rem;color:#6b7280;">(${u.role})</span></div>
          <span style="font-size:0.75rem;color:#9ca3af;">${u.username}</span>
        </div>`).join('')}
      </div>
      <h4 style="margin-bottom:0.75rem;font-size:0.875rem;">Add New User</h4>
      <div style="display:grid;gap:0.5rem;">
        <input type="text" id="newUsername" placeholder="Username" style="padding:0.5rem;border:1px solid var(--gpdc-border);border-radius:6px;font-family:'Manrope',sans-serif;">
        <input type="text" id="newDisplayName" placeholder="Display Name" style="padding:0.5rem;border:1px solid var(--gpdc-border);border-radius:6px;font-family:'Manrope',sans-serif;">
        <input type="password" id="newPassword" placeholder="Password" style="padding:0.5rem;border:1px solid var(--gpdc-border);border-radius:6px;font-family:'Manrope',sans-serif;">
        <select id="newRole" style="padding:0.5rem;border:1px solid var(--gpdc-border);border-radius:6px;font-family:'Manrope',sans-serif;">
          <option value="user">User</option>
          <option value="admin">Admin</option>
        </select>
        <button id="addUserBtn" class="upload-btn" style="margin-top:0.25rem;">Add User</button>
      </div>
      <button id="closeUserMgmt" style="position:absolute;top:1rem;right:1rem;background:none;border:none;font-size:1.5rem;cursor:pointer;color:#6b7280;">&times;</button>
    </div>
  `;
  document.body.appendChild(modal);

  $('closeUserMgmt').addEventListener('click', () => modal.remove());
  modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });

  $('addUserBtn').addEventListener('click', async () => {
    const username = $('newUsername').value.trim();
    const password = $('newPassword').value;
    const displayName = $('newDisplayName').value.trim();
    const role = $('newRole').value;
    if (!username || !password) return alert('Username and password required');

    const res = await fetch('api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password, displayName: displayName || username, role })
    });
    const result = await res.json();
    if (result.ok) {
      modal.remove();
      showUserManagement(); // Refresh
    } else {
      alert(result.error || 'Failed to create user');
    }
  });
}

// Boot
initApp();
