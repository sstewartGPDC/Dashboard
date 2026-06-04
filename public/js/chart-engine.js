// ─── Dynamic Chart Card Engine ──────────────────────────────────────
// Config-driven chart rendering system. Each chart card is defined by
// a JSON config and rendered dynamically from uploaded data fields.
// Supports: bar, donut, pie, ring, line, stat, kpi card types.
// Uses /api/dashboards for persistence with full CRUD + theme support.

// ─── Data Field Registry ────────────────────────────────────────────
// Maps field keys to labels + accessor functions for aggregated and
// per-circuit data. This is the bridge between configs and real data.

const CHART_FIELDS = {
  totalCases:          { label: 'Total Cases',       group: 'Cases',     getAgg: a => a.totalCases,       getCircuit: m => m.totalCases },
  newCases:            { label: 'New Cases',          group: 'Cases',     getAgg: a => a.newCases,         getCircuit: m => m.newCases },
  closed:              { label: 'Closed Cases',       group: 'Cases',     getAgg: a => a.closed,           getCircuit: m => m.closed },
  stateFilled:         { label: 'State Attorneys',    group: 'Attorneys', getAgg: a => a.stateFilled,      getCircuit: m => m.stateFilled },
  stateVacant:         { label: 'State Vacant',       group: 'Attorneys', getAgg: a => a.stateVacant,      getCircuit: m => m.stateVacant },
  countyAttorneys:     { label: 'County Attorneys',   group: 'Attorneys', getAgg: a => a.countyAttorneys,  getCircuit: m => m.countyAttorneys },
  conflictNew:         { label: 'Conflict Cases',     group: 'Conflict',  getAgg: a => a.conflict.newCases, getCircuit: m => m.conflict.newCases },
  conflictTotal:       { label: 'Total Conflict Cases', group: 'Conflict', getAgg: a => a.conflict.totalCases || 0, getCircuit: m => m.conflict.totalCases || 0 },
  conflictClosed:      { label: 'Closed Conflict Cases', group: 'Conflict', getAgg: a => a.conflict.closed || 0, getCircuit: m => m.conflict.closed || 0 },
  conflictRate:        { label: 'Conflict Rate',       group: 'Conflict',  getAgg: a => a.conflict.rate || 0, getCircuit: m => (m.conflict.rate || 0) / 100 },
  conflictContractors: { label: 'Contractors',        group: 'Conflict',  getAgg: a => a.conflict.totalContractors, getCircuit: m => m.conflict.totalContractors },
  custodyRate:         { label: 'Custody Rate',        group: 'Computed',  getAgg: a => a.custodyRate || 0, getCircuit: m => (m.custodyRate || 0) / 100 },
  // Computed
  totalAttorneys:      { label: 'Total Attorneys',    group: 'Attorneys', getAgg: a => a.stateFilled + a.countyAttorneys, getCircuit: m => m.stateFilled + m.countyAttorneys },
  caseload:            { label: 'Caseload / Attorney', group: 'Computed', getAgg: a => { const t = a.stateFilled + a.countyAttorneys; return t > 0 ? a.totalCases / t : 0; }, getCircuit: m => { const t = m.stateFilled + m.countyAttorneys; return t > 0 ? m.totalCases / t : 0; } },
  vacancyRate:         { label: 'Vacancy Rate',       group: 'Computed',  getAgg: a => { const t = a.stateFilled + a.stateVacant; return t > 0 ? a.stateVacant / t : 0; }, getCircuit: m => { const t = m.stateFilled + m.stateVacant; return t > 0 ? m.stateVacant / t : 0; } },
  activeRemaining:     { label: 'Active Remaining',   group: 'Computed',  getAgg: a => Math.max(a.totalCases - a.newCases, 0), getCircuit: m => Math.max(m.totalCases - m.newCases, 0) },

  // Case types
  capitalCases:        { label: 'Capital Cases',      group: 'Case Types', getAgg: a => a.capitalCases || 0,     getCircuit: m => m.capitalCases || 0 },
  felonyCases:         { label: 'Felony Cases',        group: 'Case Types', getAgg: a => a.felonyCases || 0,      getCircuit: m => m.felonyCases || 0 },
  misdemeanorCases:    { label: 'Misdemeanor Cases',   group: 'Case Types', getAgg: a => a.misdemeanorCases || 0, getCircuit: m => m.misdemeanorCases || 0 },
  juvenileCases:       { label: 'Juvenile Cases',      group: 'Case Types', getAgg: a => a.juvenileCases || 0,    getCircuit: m => m.juvenileCases || 0 },
  appealsCases:        { label: 'Appeals',             group: 'Case Types', getAgg: a => a.appealsCases || 0,     getCircuit: m => m.appealsCases || 0 },
  probationCases:      { label: 'Probation Cases',     group: 'Case Types', getAgg: a => a.probationCases || 0,   getCircuit: m => m.probationCases || 0 },

  // Support staff
  investigators:       { label: 'Investigators',       group: 'Support',   getAgg: a => a.investigators || 0,    getCircuit: m => m.investigators || 0 },
  socialWorkers:       { label: 'Social Workers',      group: 'Support',   getAgg: a => a.socialWorkers || 0,    getCircuit: m => m.socialWorkers || 0 },
  paralegals:          { label: 'Paralegals',          group: 'Support',   getAgg: a => a.paralegals || 0,       getCircuit: m => m.paralegals || 0 },
  supportRatio:        { label: 'Support per Attorney', group: 'Support',  getAgg: a => { const t = a.stateFilled + a.countyAttorneys; return t > 0 ? ((a.investigators || 0) + (a.socialWorkers || 0) + (a.paralegals || 0)) / t : 0; }, getCircuit: m => { const t = m.stateFilled + m.countyAttorneys; return t > 0 ? ((m.investigators || 0) + (m.socialWorkers || 0) + (m.paralegals || 0)) / t : 0; } },

  // Financials
  annualBudget:        { label: 'Annual Budget',       group: 'Financials', getAgg: a => a.annualBudget || 0,    getCircuit: m => m.annualBudget || 0 },
  actualSpend:         { label: 'Actual Spend',        group: 'Financials', getAgg: a => a.actualSpend || 0,     getCircuit: m => m.actualSpend || 0 },
  costPerCase:         { label: 'Cost per Case',       group: 'Financials', getAgg: a => a.totalCases > 0 ? (a.actualSpend || 0) / a.totalCases : 0, getCircuit: m => m.totalCases > 0 ? (m.actualSpend || 0) / m.totalCases : 0 },

  // Weighted caseload (uses CASE_WEIGHTS from data.js)
  weightedCaseload:    { label: 'Weighted Caseload / Attorney', group: 'Computed', getAgg: a => { const t = a.stateFilled + a.countyAttorneys; return t > 0 ? weightedCaseCount(a) / t : 0; }, getCircuit: m => { const t = m.stateFilled + m.countyAttorneys; return t > 0 ? weightedCaseCount(m) / t : 0; } },
};

// Color palette for charts
const CHART_COLORS = {
  gold:    { label: 'Warm',   css: 'gold' },
  danger:  { label: 'Red',    css: 'danger' },
  success: { label: 'Green',  css: 'success' },
  teal:    { label: 'Teal',   css: 'teal' },
  purple:  { label: 'Purple', css: 'purple' },
};

const SEGMENT_PALETTE = ['#c4714e', '#e2b77a', '#5fa87a', '#d45454', '#4ea8a0', '#7b9fcf', '#a78bda', '#e88c6a'];

// ─── Theme Presets ──────────────────────────────────────────────────

const THEME_PRESETS = {
  gpdc:     { label: 'GPDC', primary: '#B85C38', primaryDark: '#9a4a2e', background: '#f0eeeb', cardBg: '#ffffff', borderLight: '#eae7e3', textDark: '#1a1a1a', textLight: '#8a8a8a' },
  ocean:    { label: 'Ocean',      primary: '#2563eb', primaryDark: '#1d4ed8', background: '#f0f4ff', cardBg: '#ffffff', borderLight: '#e0e7ff', textDark: '#1e293b', textLight: '#64748b' },
  forest:   { label: 'Forest',     primary: '#16a34a', primaryDark: '#15803d', background: '#f0faf4', cardBg: '#ffffff', borderLight: '#dcfce7', textDark: '#1a2e1a', textLight: '#6b8a6b' },
  slate:    { label: 'Slate',      primary: '#475569', primaryDark: '#334155', background: '#f1f5f9', cardBg: '#ffffff', borderLight: '#e2e8f0', textDark: '#0f172a', textLight: '#94a3b8' },
  midnight: { label: 'Midnight',   primary: '#8b5cf6', primaryDark: '#7c3aed', background: '#1a1a2e', cardBg: '#25253e', borderLight: '#3b3b5c', textDark: '#e2e8f0', textLight: '#a0a0c0' },
};

function applyTheme(theme) {
  if (!theme) return;
  const root = document.documentElement;
  root.style.setProperty('--primary', theme.primary);
  root.style.setProperty('--primary-dark', theme.primaryDark);
  root.style.setProperty('--bg-light', theme.background);
  root.style.setProperty('--bg-white', theme.cardBg);
  root.style.setProperty('--border-light', theme.borderLight);
  root.style.setProperty('--text-dark', theme.textDark);
  root.style.setProperty('--text-light', theme.textLight);
  root.style.setProperty('--primary-subtle', theme.primary + '0f');
}

// ─── Default Layout ─────────────────────────────────────────────────

const DEFAULT_CHART_LAYOUT = [
  { id: 'k1', type: 'kpi', title: 'Total Cases', width: 'small', field: 'totalCases', icon: 'folder', format: 'number', subtitle: 'Active cases statewide' },
  { id: 'k2', type: 'kpi', title: 'New Cases', width: 'small', field: 'newCases', icon: 'plus', format: 'number', subtitle: 'Opened this period' },
  { id: 'k3', type: 'kpi', title: 'State Attorneys', width: 'small', field: 'stateFilled', icon: 'users', format: 'number', subtitle: 'GPDC employed' },
  { id: 'k4', type: 'kpi', title: 'Vacancy Rate', width: 'small', field: 'vacancyRate', icon: 'alert', format: 'percent', subtitle: 'Unfilled state positions' },
  { id: 'c1', type: 'bar', title: 'Top Circuits by Cases', subtitle: '10 highest-volume circuits', width: 'medium', field: 'totalCases', colorClass: 'gold', limit: 10, sort: 'desc' },
  { id: 'c2', type: 'bar', title: 'Caseload per Attorney', subtitle: 'Highest cases-per-attorney ratio', width: 'medium', field: 'caseload', colorClass: 'danger', limit: 10, sort: 'desc' },
  { id: 'c3', type: 'donut', title: 'Attorney Distribution', subtitle: 'State vs county positions', width: 'medium', segments: [{ field: 'stateFilled', label: 'State (GPDC)', color: '#c4714e' }, { field: 'countyAttorneys', label: 'County', color: '#e2b77a' }], centerLabel: 'Total' },
  { id: 'c4', type: 'donut', title: 'Case Flow Breakdown', subtitle: 'New, closed, and remaining cases', width: 'medium', segments: [{ field: 'newCases', label: 'New Cases', color: '#c4714e' }, { field: 'closed', label: 'Closed', color: '#5fa87a' }, { field: 'activeRemaining', label: 'Remaining', color: '#e2b77a' }], centerLabel: 'Total' },
];

// ─── Chart Engine ───────────────────────────────────────────────────

const chartEngine = {
  layout: null,
  _nextId: 100,
  _activeDashboardId: null,
  _activeDashboardName: null,
  _dashboards: [],
  _activeTheme: THEME_PRESETS.gpdc,
  _sideEditorOpen: false,
  _debounceTimer: null,
  _editSnapshot: null,
  _editingConfig: null,

  // Generate unique ID
  _genId() { return 'c' + (this._nextId++); },

  // ── Dashboard Persistence (CRUD via /api/dashboards) ──────────

  async loadDashboards() {
    try {
      const res = await fetch('api/dashboards');
      const data = await res.json();
      this._dashboards = Array.isArray(data) ? data : (data.dashboards || []);
      // Find the active dashboard, or fallback to first
      const active = this._dashboards.find(d => d.is_active) || this._dashboards[0];
      if (active) {
        await this.loadDashboard(active.id);
      } else {
        // No dashboards exist — create one with defaults
        const id = await this.createDashboard('Default Dashboard', JSON.parse(JSON.stringify(DEFAULT_CHART_LAYOUT)));
        if (id) await this.loadDashboard(id);
      }
    } catch (err) {
      console.error('Failed to load dashboards:', err);
      this.layout = JSON.parse(JSON.stringify(DEFAULT_CHART_LAYOUT));
      this._activeTheme = THEME_PRESETS.gpdc;
      applyTheme(this._activeTheme);
    }
  },

  async loadDashboard(id) {
    try {
      const res = await fetch('api/dashboards/' + id);
      const data = await res.json();
      const dash = data.dashboard || data;
      this._activeDashboardId = dash.id || id;
      this._activeDashboardName = dash.name || 'Dashboard';
      this.layout = Array.isArray(dash.layout) && dash.layout.length > 0
        ? dash.layout
        : JSON.parse(JSON.stringify(DEFAULT_CHART_LAYOUT));
      // Normalize legacy width values (old system used 'half'/'full', new uses small/medium/large/full)
      const widthMap = { half: 'medium', third: 'small' };
      this.layout.forEach(c => {
        if (c.width && widthMap[c.width]) c.width = widthMap[c.width];
        if (!c.width) c.width = c.type === 'kpi' ? 'small' : 'medium';
      });
      // Theme
      if (dash.theme && typeof dash.theme === 'object' && dash.theme.primary) {
        this._activeTheme = dash.theme;
      } else if (dash.theme && typeof dash.theme === 'string' && THEME_PRESETS[dash.theme]) {
        this._activeTheme = THEME_PRESETS[dash.theme];
      } else {
        this._activeTheme = THEME_PRESETS.gpdc;
      }
      applyTheme(this._activeTheme);
      // Keep IDs non-colliding
      const maxNum = Math.max(0, ...this.layout.map(c => parseInt(String(c.id).replace(/\D/g, '')) || 0));
      this._nextId = maxNum + 1;
    } catch (err) {
      console.error('Failed to load dashboard:', err);
      this.layout = JSON.parse(JSON.stringify(DEFAULT_CHART_LAYOUT));
      this._activeTheme = THEME_PRESETS.gpdc;
      applyTheme(this._activeTheme);
    }
  },

  async saveDashboard() {
    if (!this._activeDashboardId) return;
    try {
      await fetch('api/dashboards/' + this._activeDashboardId, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: this._activeDashboardName,
          layout: this.layout,
          theme: this._activeTheme
        })
      });
    } catch (err) {
      console.error('Failed to save dashboard:', err);
    }
  },

  async createDashboard(name, layout) {
    try {
      const res = await fetch('api/dashboards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name || 'New Dashboard',
          layout: layout || JSON.parse(JSON.stringify(DEFAULT_CHART_LAYOUT)),
          theme: this._activeTheme
        })
      });
      const data = await res.json();
      return data.id || (data.dashboard && data.dashboard.id) || null;
    } catch (err) {
      console.error('Failed to create dashboard:', err);
      return null;
    }
  },

  async deleteDashboard(id) {
    try {
      await fetch('api/dashboards/' + id, { method: 'DELETE' });
      this._dashboards = this._dashboards.filter(d => d.id !== id);
    } catch (err) {
      console.error('Failed to delete dashboard:', err);
    }
  },

  async renameDashboard(name) {
    this._activeDashboardName = name;
    await this.saveDashboard();
  },

  async switchDashboard(id) {
    try {
      await fetch('api/dashboards/' + id + '/activate', { method: 'POST' });
    } catch (err) {
      console.error('Failed to activate dashboard:', err);
    }
    await this.loadDashboard(id);
    this.render();
  },

  // ── Data Resolution ───────────────────────────────────────────

  _getAggregated() {
    const fc = getFilteredCircuits();
    return { agg: aggregateMetrics(fc), circuits: fc };
  },

  _resolveBarData(config) {
    const { circuits } = this._getAggregated();
    const fieldDef = CHART_FIELDS[config.field];
    if (!fieldDef) return [];
    const overrides = config.barOverrides || {};

    const data = circuits.map(c => {
      const m = CIRCUIT_METRICS.get(c.circuit) || emptyMetrics();
      // Check for manual override by circuit name
      const val = overrides[c.circuit] !== undefined ? overrides[c.circuit] : fieldDef.getCircuit(m);
      return { label: c.circuit, value: val };
    });

    // Filter out zeros for computed fields like caseload
    const filtered = config.field === 'caseload' || config.field === 'vacancyRate'
      ? data.filter(d => d.value > 0)
      : data;

    // Sort
    filtered.sort((a, b) => config.sort === 'asc' ? a.value - b.value : b.value - a.value);

    // Limit
    return filtered.slice(0, config.limit || 10);
  },

  _resolveDonutData(config) {
    const { agg } = this._getAggregated();
    const overrides = config.segmentOverrides || {};
    const segments = (config.segments || []).map((seg, i) => {
      // Check for override: keyed by segment index
      if (overrides[i] !== undefined && overrides[i] !== null) {
        return { label: seg.label, value: overrides[i], color: seg.color, isOverride: true };
      }
      const fieldDef = CHART_FIELDS[seg.field];
      const value = fieldDef ? fieldDef.getAgg(agg) : 0;
      return { label: seg.label, value, color: seg.color };
    });
    const total = segments.reduce((s, seg) => s + seg.value, 0);

    // Determine center value
    let centerValue;
    if (config.centerLabel === 'Vacancy') {
      const fieldDef = CHART_FIELDS.vacancyRate;
      centerValue = pct(fieldDef.getAgg(agg));
    } else {
      centerValue = fmt(total);
    }

    return { segments, centerValue, centerLabel: config.centerLabel || 'Total' };
  },

  _resolveStatData(config) {
    const { agg } = this._getAggregated();
    const fieldDef = CHART_FIELDS[config.field];
    if (!fieldDef) return { value: '\u2014', comparison: null };
    const raw = fieldDef.getAgg(agg);
    const value = config.format === 'percent' ? pct(raw) : fmt(raw);
    let comparison = null;
    if (config.comparison) {
      const compField = CHART_FIELDS[config.comparison.field];
      if (compField) {
        comparison = { label: config.comparison.label, value: fmt(compField.getAgg(agg)) };
      }
    }
    return { value, comparison };
  },

  _resolveKpiData(config) {
    // Check for manual value override first
    if (config.valueOverride !== undefined && config.valueOverride !== null) {
      const raw = config.valueOverride;
      const formattedValue = config.format === 'percent' ? (raw * (raw <= 1 ? 100 : 1)).toFixed(1) + '%' : fmt(raw);
      return { value: raw, formattedValue, isOverride: true };
    }
    const { agg } = this._getAggregated();
    const fieldDef = CHART_FIELDS[config.field];
    if (!fieldDef) return { value: 0, formattedValue: '\u2014' };
    const raw = fieldDef.getAgg(agg);
    const formattedValue = config.format === 'percent' ? pct(raw) : fmt(raw);
    return { value: raw, formattedValue };
  },

  // ── Card DOM Building ─────────────────────────────────────────

  _buildCard(config) {
    const panel = document.createElement('div');
    panel.className = 'chart-panel' + (config.type === 'kpi' ? ' chart-panel-kpi' : '');
    panel.dataset.chartId = config.id;
    panel.dataset.size = config.width || 'medium';

    // Header
    const header = document.createElement('div');
    header.className = 'chart-panel-header';

    const headerText = document.createElement('div');
    headerText.className = 'chart-panel-header-text';

    const title = document.createElement('div');
    title.className = 'chart-panel-title';
    title.textContent = config.title || 'Untitled';
    title.setAttribute('contenteditable', 'false');
    title.addEventListener('click', () => {
      title.setAttribute('contenteditable', 'true');
      title.focus();
    });
    title.addEventListener('blur', () => {
      title.setAttribute('contenteditable', 'false');
      const newTitle = title.textContent.trim();
      if (newTitle && newTitle !== config.title) {
        config.title = newTitle;
        this.saveDashboard();
      }
    });
    title.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); title.blur(); }
    });

    headerText.appendChild(title);

    // Subtitle in header (not for KPI — KPI renders subtitle inside the body)
    if (config.type !== 'kpi') {
      const subtitle = document.createElement('div');
      subtitle.className = 'chart-panel-subtitle';
      subtitle.textContent = config.subtitle || '';
      subtitle.setAttribute('contenteditable', 'false');
      subtitle.addEventListener('click', () => {
        subtitle.setAttribute('contenteditable', 'true');
        subtitle.focus();
      });
      subtitle.addEventListener('blur', () => {
        subtitle.setAttribute('contenteditable', 'false');
        const newSub = subtitle.textContent.trim();
        if (newSub !== config.subtitle) {
          config.subtitle = newSub;
          this.saveDashboard();
        }
      });
      subtitle.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); subtitle.blur(); }
      });
      headerText.appendChild(subtitle);
    }

    header.appendChild(headerText);

    // Toolbar
    const toolbar = document.createElement('div');
    toolbar.className = 'chart-card-toolbar';

    // Drag handle
    const dragHandle = document.createElement('button');
    dragHandle.className = 'chart-drag-handle';
    dragHandle.title = 'Drag to reorder';
    dragHandle.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><circle cx="9" cy="5" r="2"/><circle cx="15" cy="5" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="15" cy="12" r="2"/><circle cx="9" cy="19" r="2"/><circle cx="15" cy="19" r="2"/></svg>';
    dragHandle.addEventListener('mousedown', () => {
      panel.setAttribute('draggable', 'true');
    });
    toolbar.appendChild(dragHandle);

    const editBtn = document.createElement('button');
    editBtn.className = 'chart-toolbar-btn';
    editBtn.title = 'Configure chart';
    editBtn.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>';
    editBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this._openSideEditor(config);
    });

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'chart-toolbar-btn chart-toolbar-delete';
    deleteBtn.title = 'Remove chart';
    deleteBtn.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
    deleteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.removeCard(config.id);
    });

    const exportBtn = document.createElement('button');
    exportBtn.className = 'chart-toolbar-btn';
    exportBtn.title = 'Export card as image';
    exportBtn.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>';
    exportBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (typeof exportSingleCard === 'function') exportSingleCard(panel, config.title);
    });

    toolbar.appendChild(editBtn);
    toolbar.appendChild(exportBtn);
    toolbar.appendChild(deleteBtn);
    header.appendChild(toolbar);

    // Body
    const body = document.createElement('div');
    body.className = 'chart-panel-body';
    body.id = 'chartBody_' + config.id;

    panel.appendChild(header);
    panel.appendChild(body);

    // Resize handle (bottom-right corner, Apple Vision Pro style)
    const resizeHandle = document.createElement('div');
    resizeHandle.className = 'card-resize-handle';
    resizeHandle.title = 'Drag to resize';
    panel.appendChild(resizeHandle);

    return panel;
  },

  _renderCardContent(config) {
    const bodyId = 'chartBody_' + config.id;

    if (config.type === 'bar') {
      const data = this._resolveBarData(config);
      // Use vertical bar if 8 or fewer items, horizontal otherwise
      if (data.length <= 8) {
        renderVBarChart(bodyId, data, config.colorClass || 'gold');
      } else {
        renderHBarChart(bodyId, data, config.colorClass || 'gold');
      }
      this._wireBarValueEditing(bodyId, config);
    } else if (config.type === 'donut') {
      const { segments, centerValue, centerLabel } = this._resolveDonutData(config);
      renderDonutChart(bodyId, segments, centerValue, centerLabel);
      this._wireSegmentValueEditing(bodyId, config);
    } else if (config.type === 'pie') {
      const { segments, centerValue, centerLabel } = this._resolveDonutData(config);
      renderPieChart(bodyId, segments, centerValue, centerLabel);
      this._wireSegmentValueEditing(bodyId, config);
    } else if (config.type === 'ring') {
      const { segments, centerValue, centerLabel } = this._resolveDonutData(config);
      renderSvgDonutChart(bodyId, segments, centerValue, centerLabel);
      this._wireSegmentValueEditing(bodyId, config);
    } else if (config.type === 'line') {
      const data = this._resolveBarData(config);
      renderLineChart(bodyId, data, config.colorClass || 'gold');
    } else if (config.type === 'stat') {
      // Use override if set
      const hasOverride = config.valueOverride !== undefined && config.valueOverride !== null;
      let displayValue;
      if (hasOverride) {
        displayValue = config.format === 'percent' ? (config.valueOverride * (config.valueOverride <= 1 ? 100 : 1)).toFixed(1) + '%' : fmt(config.valueOverride);
      } else {
        displayValue = this._resolveStatData(config).value;
      }
      const { comparison } = this._resolveStatData(config);
      const el = document.getElementById(bodyId);
      if (!el) return;
      let html = '<div class="chart-stat-wrap">';
      html += '<div class="chart-stat-value editable-value" title="Click to edit">' + displayValue + '</div>';
      html += '<div class="chart-stat-label">' + (CHART_FIELDS[config.field]?.label || config.field) + '</div>';
      if (comparison) {
        html += '<div class="chart-stat-comparison">';
        html += '<span class="chart-stat-comp-value">' + comparison.value + '</span>';
        html += '<span class="chart-stat-comp-label">' + comparison.label + '</span>';
        html += '</div>';
      }
      html += '</div>';
      el.innerHTML = html;
      // Wire inline editing for stat value (disabled when locked)
      const statValEl = el.querySelector('.chart-stat-value');
      if (statValEl && !this.locked) {
        const self = this;
        statValEl.addEventListener('click', (e) => {
          e.stopPropagation();
          if (statValEl.querySelector('input')) return;
          const raw = statValEl.textContent.trim().replace(/,/g, '').replace(/%$/, '');
          const input = document.createElement('input');
          input.type = 'text';
          input.className = 'inline-value-input';
          input.value = raw;
          statValEl.textContent = '';
          statValEl.appendChild(input);
          input.focus();
          input.select();
          const commit = () => {
            const newVal = input.value.trim();
            if (newVal === '' || newVal === raw) { self._renderCardContent(config); return; }
            const num = parseFloat(newVal);
            if (isNaN(num)) { self._renderCardContent(config); return; }
            config.valueOverride = num;
            self.saveDashboard();
            self._renderCardContent(config);
          };
          input.addEventListener('blur', commit);
          input.addEventListener('keydown', (ev) => {
            if (ev.key === 'Enter') { ev.preventDefault(); input.blur(); }
            if (ev.key === 'Escape') { self._renderCardContent(config); }
          });
        });
      }
    } else if (config.type === 'kpi') {
      const { formattedValue } = this._resolveKpiData(config);
      const editCb = (newVal) => {
        if (newVal === null) {
          this._renderCardContent(config);
          return;
        }
        config.valueOverride = newVal;
        this.saveDashboard();
        this._renderCardContent(config);
      };
      renderKpiCard(bodyId, formattedValue, config.title, config.subtitle || '', config.icon || 'folder', config.format || 'number', this.locked ? null : editCb, this._fieldDelta(config));
    } else if (config.type === 'scorecard') {
      renderScorecard(bodyId, config);
    } else if (config.type === 'compare') {
      renderCompareCard(bodyId, config);
    } else if (config.type === 'equity') {
      renderEquityCard(bodyId, config);
    }
  },

  // Year-over-year delta badge for a field-bound card (KPI/stat). '' if no
  // comparison year, a hand-typed override, or no prior data.
  _fieldDelta(config) {
    if (!window.__compareFY) return '';
    if (config.valueOverride !== undefined && config.valueOverride !== null) return '';
    if (typeof yoyDeltaBadge !== 'function') return '';
    const fd = CHART_FIELDS[config.field];
    if (!fd) return '';
    if (typeof CIRCUIT_METRICS_PRIOR === 'undefined' || !CIRCUIT_METRICS_PRIOR.size) return '';
    const fc = getFilteredCircuits();
    const cur = fd.getAgg(aggregateMetricsFrom(CIRCUIT_METRICS, fc));
    const prior = fd.getAgg(aggregateMetricsFrom(CIRCUIT_METRICS_PRIOR, fc));
    const pol = (typeof YOY_FIELD_POLARITY !== 'undefined' && YOY_FIELD_POLARITY[config.field]) || 'neutral';
    return yoyDeltaBadge(cur, prior, pol, ' YoY');
  },

  // ── Inline Value Editing (segment charts) ─────────────────────

  _wireSegmentValueEditing(bodyId, config) {
    if (this.locked) return;
    const el = document.getElementById(bodyId);
    if (!el) return;
    const self = this;
    // Find legend value elements and make them editable
    const rows = el.querySelectorAll('.modern-legend-row');
    rows.forEach((row, idx) => {
      const valueEl = row.querySelector('.modern-legend-value');
      if (!valueEl) return;
      valueEl.classList.add('editable-value');
      valueEl.title = 'Click to edit';
      valueEl.addEventListener('click', (e) => {
        e.stopPropagation();
        if (valueEl.querySelector('input')) return;
        const raw = valueEl.textContent.trim().replace(/,/g, '');
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'inline-value-input inline-value-input-sm';
        input.value = raw;
        valueEl.textContent = '';
        valueEl.appendChild(input);
        input.focus();
        input.select();

        const commit = () => {
          const newVal = input.value.trim();
          if (newVal === '' || newVal === raw) {
            self._renderCardContent(config);
            return;
          }
          const num = parseFloat(newVal);
          if (isNaN(num)) {
            self._renderCardContent(config);
            return;
          }
          if (!config.segmentOverrides) config.segmentOverrides = {};
          config.segmentOverrides[idx] = num;
          self.saveDashboard();
          self._renderCardContent(config);
        };
        input.addEventListener('blur', commit);
        input.addEventListener('keydown', (ev) => {
          if (ev.key === 'Enter') { ev.preventDefault(); input.blur(); }
          if (ev.key === 'Escape') { self._renderCardContent(config); }
        });
      });
    });
  },

  _wireBarValueEditing(bodyId, config) {
    if (this.locked) return;
    const el = document.getElementById(bodyId);
    if (!el) return;
    const self = this;
    // For horizontal bar charts, make the value labels editable
    const valueEls = el.querySelectorAll('.chart-bar-value');
    valueEls.forEach((valueEl, idx) => {
      valueEl.classList.add('editable-value');
      valueEl.title = 'Click to edit';
      valueEl.addEventListener('click', (e) => {
        e.stopPropagation();
        if (valueEl.querySelector('input')) return;
        const raw = valueEl.textContent.trim().replace(/,/g, '');
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'inline-value-input inline-value-input-sm';
        input.value = raw;
        valueEl.textContent = '';
        valueEl.appendChild(input);
        input.focus();
        input.select();

        const commit = () => {
          const newVal = input.value.trim();
          if (newVal === '' || newVal === raw) {
            self._renderCardContent(config);
            return;
          }
          const num = parseFloat(newVal);
          if (isNaN(num)) {
            self._renderCardContent(config);
            return;
          }
          // Find the circuit label for this bar row
          const barRow = valueEl.closest('.chart-bar-row');
          const labelEl = barRow ? barRow.querySelector('.chart-bar-label') : null;
          const circuitName = labelEl ? labelEl.textContent.trim() : idx.toString();
          if (!config.barOverrides) config.barOverrides = {};
          config.barOverrides[circuitName] = num;
          self.saveDashboard();
          self._renderCardContent(config);
        };
        input.addEventListener('blur', commit);
        input.addEventListener('keydown', (ev) => {
          if (ev.key === 'Enter') { ev.preventDefault(); input.blur(); }
          if (ev.key === 'Escape') { self._renderCardContent(config); }
        });
      });
    });
  },

  // ── Side Editor Panel ─────────────────────────────────────────

  _openSideEditor(config) {
    const editorBody = document.getElementById('cardEditorBody');
    const editorPanel = document.getElementById('cardEditorPanel');
    const editorPreview = document.getElementById('cardEditorPreview');
    if (!editorBody || !editorPanel) return;

    // Snapshot for cancel/revert
    this._editSnapshot = JSON.parse(JSON.stringify(config));
    this._editingConfig = config;

    this._sideEditorOpen = true;
    editorPanel.classList.add('open');
    const overlay = document.getElementById('cardEditorOverlay');
    if (overlay) overlay.classList.add('open');

    // Highlight the card being edited
    document.querySelectorAll('.chart-panel').forEach(p => p.classList.remove('editing'));
    const cardEl = document.querySelector('[data-chart-id="' + config.id + '"]');
    if (cardEl) cardEl.classList.add('editing');

    // Build preview
    if (editorPreview) {
      this._updateEditorPreview(config);
    }

    let html = '<div class="editor-form">';

    // Title
    html += '<div class="editor-row">';
    html += '<label>Title</label>';
    html += '<input type="text" data-edit="title" value="' + this._escAttr(config.title || '') + '">';
    html += '</div>';

    // Type picker (visual icon buttons)
    html += '<div class="editor-row">';
    html += '<label>Type</label>';
    html += '<div class="editor-type-grid">';
    const types = [
      { key: 'kpi',   label: 'KPI',        icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 6h16M4 12h10M4 18h6"/></svg>' },
      { key: 'bar',   label: 'Bar',         icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>' },
      { key: 'line',  label: 'Line',        icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="4 18 8 12 12 15 16 8 20 11"/></svg>' },
      { key: 'donut', label: 'Proportion',  icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="12" x2="21" y2="12"/></svg>' },
      { key: 'pie',   label: 'Pie',         icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.21 15.89A10 10 0 1 1 8 2.83"/><path d="M22 12A10 10 0 0 0 12 2v10z"/></svg>' },
      { key: 'ring',  label: 'Donut',       icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/></svg>' },
      { key: 'stat',  label: 'Stat',        icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20V10"/><path d="M18 20V4"/><path d="M6 20v-4"/></svg>' },
    ];
    types.forEach(t => {
      const active = config.type === t.key ? ' active' : '';
      html += '<button class="editor-type-btn' + active + '" data-type-val="' + t.key + '" title="' + t.label + '">';
      html += t.icon;
      html += '<span>' + t.label + '</span>';
      html += '</button>';
    });
    html += '</div></div>';

    // Size picker (4 visual buttons)
    html += '<div class="editor-row">';
    html += '<label>Size</label>';
    html += '<div class="editor-size-grid">';
    const sizes = [
      { key: 'small',  label: '1 col' },
      { key: 'medium', label: '2 col' },
      { key: 'large',  label: '3 col' },
      { key: 'full',   label: '4 col' },
    ];
    sizes.forEach(s => {
      const active = (config.width || 'medium') === s.key ? ' active' : '';
      html += '<button class="editor-size-btn' + active + '" data-size-val="' + s.key + '">' + s.label + '</button>';
    });
    html += '</div></div>';

    // ── Type-specific fields ──
    html += this._buildTypeSpecificFields(config);

    html += '</div>'; // end .editor-form
    editorBody.innerHTML = html;

    // ── Wire up events ──
    this._wireSideEditorEvents(editorBody, config);
  },

  _updateEditorPreview(config) {
    const previewArea = document.getElementById('cardEditorPreview');
    if (!previewArea) return;
    const previewId = 'previewBody_' + config.id;
    // Build a mini card clone
    const panel = document.createElement('div');
    panel.className = 'chart-panel' + (config.type === 'kpi' ? ' chart-panel-kpi' : '');
    panel.dataset.size = 'medium';
    panel.style.background = 'var(--bg-white)';
    panel.style.width = '420px';
    panel.style.maxWidth = '100%';

    if (config.type !== 'kpi') {
      const header = document.createElement('div');
      header.className = 'chart-panel-header';
      header.innerHTML = '<div class="chart-panel-header-text"><div class="chart-panel-title">' + (config.title || 'Untitled') + '</div><div class="chart-panel-subtitle">' + (config.subtitle || '') + '</div></div>';
      panel.appendChild(header);
    }

    const body = document.createElement('div');
    body.className = 'chart-panel-body';
    body.id = previewId;
    panel.appendChild(body);

    previewArea.innerHTML = '';
    previewArea.appendChild(panel);

    // Render chart content into preview
    const previewConfig = Object.assign({}, config, { _previewBodyId: previewId });
    requestAnimationFrame(() => {
      this._renderPreviewContent(previewConfig);
    });
  },

  _renderPreviewContent(config) {
    const bodyId = config._previewBodyId || ('chartBody_' + config.id);

    if (config.type === 'bar') {
      const data = this._resolveBarData(config);
      if (data.length <= 8) {
        renderVBarChart(bodyId, data, config.colorClass || 'gold');
      } else {
        renderHBarChart(bodyId, data, config.colorClass || 'gold');
      }
    } else if (config.type === 'donut') {
      const { segments, centerValue, centerLabel } = this._resolveDonutData(config);
      renderDonutChart(bodyId, segments, centerValue, centerLabel);
    } else if (config.type === 'pie') {
      const { segments, centerValue, centerLabel } = this._resolveDonutData(config);
      renderPieChart(bodyId, segments, centerValue, centerLabel);
    } else if (config.type === 'ring') {
      const { segments, centerValue, centerLabel } = this._resolveDonutData(config);
      renderSvgDonutChart(bodyId, segments, centerValue, centerLabel);
    } else if (config.type === 'line') {
      const data = this._resolveBarData(config);
      renderLineChart(bodyId, data, config.colorClass || 'gold');
    } else if (config.type === 'stat') {
      const { value, comparison } = this._resolveStatData(config);
      const el = document.getElementById(bodyId);
      if (!el) return;
      let html = '<div class="chart-stat-wrap">';
      html += '<div class="chart-stat-value">' + value + '</div>';
      html += '<div class="chart-stat-label">' + (CHART_FIELDS[config.field]?.label || config.field) + '</div>';
      if (comparison) {
        html += '<div class="chart-stat-comparison">';
        html += '<span class="chart-stat-comp-value">' + comparison.value + '</span>';
        html += '<span class="chart-stat-comp-label">' + comparison.label + '</span>';
        html += '</div>';
      }
      html += '</div>';
      el.innerHTML = html;
    } else if (config.type === 'kpi') {
      const { formattedValue } = this._resolveKpiData(config);
      renderKpiCard(bodyId, formattedValue, config.title, config.subtitle || '', config.icon || 'folder', config.format || 'number');
    } else if (config.type === 'scorecard') {
      renderScorecard(bodyId, config);
    } else if (config.type === 'compare') {
      renderCompareCard(bodyId, config);
    } else if (config.type === 'equity') {
      renderEquityCard(bodyId, config);
    }
  },

  _buildTypeSpecificFields(config) {
    let html = '';
    const isBarLike = config.type === 'bar' || config.type === 'line';
    const isSegmented = config.type === 'donut' || config.type === 'pie' || config.type === 'ring';

    if (isBarLike || config.type === 'stat') {
      html += '<div class="editor-row"><label>Data Field</label><select data-edit="field">';
      Object.entries(CHART_FIELDS).forEach(([key, f]) => {
        html += '<option value="' + key + '"' + (config.field === key ? ' selected' : '') + '>' + f.label + '</option>';
      });
      html += '</select></div>';
    }

    if (isBarLike) {
      html += '<div class="editor-row"><label>Color</label><select data-edit="colorClass">';
      Object.entries(CHART_COLORS).forEach(([key, c]) => {
        html += '<option value="' + key + '"' + (config.colorClass === key ? ' selected' : '') + '>' + c.label + '</option>';
      });
      html += '</select></div>';

      html += '<div class="editor-row"><label>Show Top</label><select data-edit="limit">';
      [5, 10, 15, 20, 45].forEach(n => {
        html += '<option value="' + n + '"' + ((config.limit || 10) === n ? ' selected' : '') + '>' + n + ' circuits</option>';
      });
      html += '</select></div>';

      html += '<div class="editor-row"><label>Sort</label><select data-edit="sort">';
      html += '<option value="desc"' + (config.sort !== 'asc' ? ' selected' : '') + '>Highest First</option>';
      html += '<option value="asc"' + (config.sort === 'asc' ? ' selected' : '') + '>Lowest First</option>';
      html += '</select></div>';
    }

    if (isSegmented) {
      html += '<div class="editor-row"><label>Center Label</label><input type="text" data-edit="centerLabel" value="' + this._escAttr(config.centerLabel || 'Total') + '"></div>';

      html += '<div class="editor-segments-header"><label>Segments</label><button class="editor-add-seg" type="button">+ Add</button></div>';
      html += '<div class="editor-segments" id="sideEditSegments">';
      (config.segments || []).forEach((seg, i) => {
        html += this._segmentEditRow(seg, i);
      });
      html += '</div>';
    }

    if (config.type === 'stat') {
      html += '<div class="editor-row"><label>Format</label><select data-edit="format">';
      html += '<option value="number"' + (config.format !== 'percent' ? ' selected' : '') + '>Number</option>';
      html += '<option value="percent"' + (config.format === 'percent' ? ' selected' : '') + '>Percent</option>';
      html += '</select></div>';
    }

    if (config.type === 'kpi') {
      html += '<div class="editor-row"><label>Data Field</label><select data-edit="field">';
      Object.entries(CHART_FIELDS).forEach(([key, f]) => {
        html += '<option value="' + key + '"' + (config.field === key ? ' selected' : '') + '>' + f.label + '</option>';
      });
      html += '</select></div>';

      html += '<div class="editor-row"><label>Format</label><select data-edit="format">';
      html += '<option value="number"' + (config.format !== 'percent' ? ' selected' : '') + '>Number</option>';
      html += '<option value="percent"' + (config.format === 'percent' ? ' selected' : '') + '>Percent</option>';
      html += '</select></div>';

      html += '<div class="editor-row"><label>Subtitle</label><input type="text" data-edit="subtitle" value="' + this._escAttr(config.subtitle || '') + '"></div>';

      // Icon picker
      const iconNames = ['folder', 'users', 'briefcase', 'globe', 'check', 'alert', 'trending-up', 'trending-down', 'dollar', 'percent', 'shield', 'clock', 'plus'];
      html += '<div class="editor-row"><label>Icon</label>';
      html += '<div class="editor-icon-grid">';
      iconNames.forEach(name => {
        const active = (config.icon || 'folder') === name ? ' active' : '';
        const iconSvg = (typeof KPI_ICONS !== 'undefined' && KPI_ICONS[name]) ? KPI_ICONS[name] : '';
        html += '<button class="editor-icon-btn' + active + '" data-icon-val="' + name + '" title="' + name + '">' + iconSvg + '</button>';
      });
      html += '</div></div>';

      // Show reset button if value has been manually overridden
      if (config.valueOverride !== undefined && config.valueOverride !== null) {
        html += '<div class="editor-row"><button class="editor-reset-override-btn" data-reset="valueOverride">Reset Value to Data</button></div>';
      }
    }

    if (config.type === 'compare') {
      html += '<div class="editor-row"><label>Data Field</label><select data-edit="field">';
      Object.entries(CHART_FIELDS).forEach(([key, f]) => {
        html += '<option value="' + key + '"' + (config.field === key ? ' selected' : '') + '>' + f.label + '</option>';
      });
      html += '</select></div>';
      html += '<div class="editor-row"><label>Show Top</label><select data-edit="limit">';
      [5, 8, 10, 15, 20].forEach(n => {
        html += '<option value="' + n + '"' + (Number(config.limit || 8) === n ? ' selected' : '') + '>' + n + ' circuits</option>';
      });
      html += '</select></div>';
    }

    if (config.type === 'equity') {
      html += '<div class="editor-row"><label>Data Field</label><select data-edit="field">';
      Object.entries(CHART_FIELDS).forEach(([key, f]) => {
        html += '<option value="' + key + '"' + ((config.field || 'caseload') === key ? ' selected' : '') + '>' + f.label + '</option>';
      });
      html += '</select></div>';
      html += '<div class="editor-row"><div class="editor-hint">Compares every circuit to the statewide average for this metric, and reports the disparity ratio (highest &divide; lowest).</div></div>';
    }

    if (config.type === 'scorecard') {
      html += '<div class="editor-row"><label>Caseload Type</label><select data-edit="weighted">';
      html += '<option value=""' + (!config.weighted ? ' selected' : '') + '>Raw (cases / attorney)</option>';
      html += '<option value="1"' + (config.weighted ? ' selected' : '') + '>Weighted (by case type)</option>';
      html += '</select></div>';
      html += '<div class="editor-row"><label>Standard (max / attorney)</label><input type="number" min="1" step="1" data-edit="standard" value="' + (Number(config.standard) || (config.weighted ? 400 : 150)) + '"></div>';
      html += '<div class="editor-row"><div class="editor-hint">Circuits above this caseload are flagged red. Weighted mode uses case-type counts &times; weights; set the standard to your agency&rsquo;s adopted maximum.</div></div>';
    }

    // Reset overrides button for segment charts
    if (isSegmented && config.segmentOverrides && Object.keys(config.segmentOverrides).length > 0) {
      html += '<div class="editor-row"><button class="editor-reset-override-btn" data-reset="segmentOverrides">Reset Values to Data</button></div>';
    }

    // Reset overrides button for bar charts
    if (isBarLike && config.barOverrides && Object.keys(config.barOverrides).length > 0) {
      html += '<div class="editor-row"><button class="editor-reset-override-btn" data-reset="barOverrides">Reset Values to Data</button></div>';
    }

    return html;
  },

  _wireSideEditorEvents(container, config) {
    const self = this;

    // Title input
    const titleInput = container.querySelector('[data-edit="title"]');
    if (titleInput) {
      titleInput.addEventListener('input', () => {
        config.title = titleInput.value;
        self._debouncedSaveAndRender(config);
      });
    }

    // Type buttons
    container.querySelectorAll('[data-type-val]').forEach(btn => {
      btn.addEventListener('click', () => {
        const newType = btn.dataset.typeVal;
        if (newType === config.type) return;
        // Reset type-specific fields
        if (newType === 'bar' || newType === 'line') {
          config.field = config.field || 'totalCases';
          config.colorClass = config.colorClass || 'gold';
          config.limit = config.limit || 10;
          config.sort = config.sort || 'desc';
          delete config.segments;
          delete config.centerLabel;
          delete config.icon;
        } else if (newType === 'donut' || newType === 'pie' || newType === 'ring') {
          config.segments = config.segments || [
            { field: 'stateFilled', label: 'State', color: SEGMENT_PALETTE[0] },
            { field: 'countyAttorneys', label: 'County', color: SEGMENT_PALETTE[1] }
          ];
          config.centerLabel = config.centerLabel || 'Total';
          delete config.field;
          delete config.colorClass;
          delete config.icon;
        } else if (newType === 'stat') {
          config.field = config.field || 'totalCases';
          config.format = config.format || 'number';
          delete config.segments;
          delete config.centerLabel;
          delete config.colorClass;
          delete config.icon;
        } else if (newType === 'kpi') {
          config.field = config.field || 'totalCases';
          config.format = config.format || 'number';
          config.icon = config.icon || 'folder';
          config.subtitle = config.subtitle || '';
          config.width = config.width || 'small';
          delete config.segments;
          delete config.centerLabel;
          delete config.colorClass;
        }
        config.type = newType;

        // Update type buttons active state in-place
        container.querySelectorAll('[data-type-val]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        // Rebuild only the type-specific fields section (not the whole editor)
        const typeFieldsHtml = self._buildTypeSpecificFields(config);
        // Find and replace the type-specific content (everything after the size grid row)
        const editorForm = container.querySelector('.editor-form');
        if (editorForm) {
          // Remove old type-specific rows (everything after the size row)
          const allRows = editorForm.querySelectorAll('.editor-row, .editor-segments-header, .editor-segments');
          let pastSize = false;
          const toRemove = [];
          allRows.forEach(row => {
            if (pastSize) toRemove.push(row);
            if (row.querySelector('.editor-size-grid')) pastSize = true;
          });
          toRemove.forEach(r => r.remove());

          // Append new type-specific fields
          const tempDiv = document.createElement('div');
          tempDiv.innerHTML = typeFieldsHtml;
          while (tempDiv.firstChild) {
            editorForm.appendChild(tempDiv.firstChild);
          }

          // Re-wire events for the new fields
          self._wireTypeSpecificEvents(editorForm, config);
        }

        // Update the card in the grid without full render
        const cardEl = document.querySelector('[data-chart-id="' + config.id + '"]');
        if (cardEl) {
          // Update card class for KPI styling
          cardEl.className = 'chart-panel' + (config.type === 'kpi' ? ' chart-panel-kpi' : '') + ' editing';
          // Re-render card content
          self._renderCardContent(config);
        }

        // Update the modal preview
        self._updateEditorPreview(config);
        self.saveDashboard();
      });
    });

    // Size buttons
    container.querySelectorAll('[data-size-val]').forEach(btn => {
      btn.addEventListener('click', () => {
        const newSize = btn.dataset.sizeVal;
        config.width = newSize;
        container.querySelectorAll('[data-size-val]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        // Update the card DOM
        const cardEl = document.querySelector('[data-chart-id="' + config.id + '"]');
        if (cardEl) cardEl.dataset.size = newSize;
        self._debouncedSaveAndRender(config);
      });
    });

    // Standard select/input fields
    container.querySelectorAll('[data-edit]').forEach(input => {
      if (input.dataset.edit === 'title') return; // already wired
      const event = input.tagName === 'SELECT' ? 'change' : 'input';
      input.addEventListener(event, () => {
        const key = input.dataset.edit;
        let val = input.value;
        if (key === 'limit') val = parseInt(val);
        config[key] = val;
        self._debouncedSaveAndRender(config);
      });
    });

    // Icon buttons (KPI)
    container.querySelectorAll('[data-icon-val]').forEach(btn => {
      btn.addEventListener('click', () => {
        config.icon = btn.dataset.iconVal;
        container.querySelectorAll('[data-icon-val]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        self._debouncedSaveAndRender(config);
      });
    });

    // Segment editing for segmented types
    if (config.type === 'donut' || config.type === 'pie' || config.type === 'ring') {
      this._wireSegmentEditing(container, config);
    }

    // Reset override buttons
    container.querySelectorAll('[data-reset]').forEach(btn => {
      btn.addEventListener('click', () => {
        const key = btn.dataset.reset;
        delete config[key];
        self.saveDashboard();
        self._renderCardContent(config);
        if (self._sideEditorOpen) {
          self._updateEditorPreview(config);
        }
        // Remove the reset button itself
        const row = btn.closest('.editor-row');
        if (row) row.remove();
      });
    });
  },

  // Re-wire just type-specific fields after a type change (not title/type/size)
  _wireTypeSpecificEvents(container, config) {
    const self = this;

    // Standard select/input fields (field, colorClass, limit, sort, format, centerLabel, subtitle)
    container.querySelectorAll('[data-edit]').forEach(input => {
      if (input.dataset.edit === 'title') return; // title already wired
      // Remove old listeners by cloning
      const clone = input.cloneNode(true);
      input.parentNode.replaceChild(clone, input);
      const event = clone.tagName === 'SELECT' ? 'change' : 'input';
      clone.addEventListener(event, () => {
        const key = clone.dataset.edit;
        let val = clone.value;
        if (key === 'limit') val = parseInt(val);
        config[key] = val;
        self._debouncedSaveAndRender(config);
      });
    });

    // Icon buttons (KPI)
    container.querySelectorAll('[data-icon-val]').forEach(btn => {
      const clone = btn.cloneNode(true);
      btn.parentNode.replaceChild(clone, btn);
      clone.addEventListener('click', () => {
        config.icon = clone.dataset.iconVal;
        container.querySelectorAll('[data-icon-val]').forEach(b => b.classList.remove('active'));
        clone.classList.add('active');
        self._debouncedSaveAndRender(config);
      });
    });

    // Segment editing
    if (config.type === 'donut' || config.type === 'pie' || config.type === 'ring') {
      this._wireSegmentEditing(container, config);
    }
  },

  _debouncedSaveAndRender(config) {
    clearTimeout(this._debounceTimer);
    this._debounceTimer = setTimeout(() => {
      this.saveDashboard();
      this._renderCardContent(config);
      // Also update the modal preview
      if (this._sideEditorOpen) {
        this._updateEditorPreview(config);
      }
    }, 250);
  },

  _closeSideEditor(revert) {
    if (revert && this._editSnapshot && this._editingConfig) {
      // Restore the snapshot onto the config
      const config = this._editingConfig;
      Object.keys(config).forEach(k => { if (k !== 'id') delete config[k]; });
      Object.assign(config, JSON.parse(JSON.stringify(this._editSnapshot)));
      this.saveDashboard();
      this.render();
    }

    const editorPanel = document.getElementById('cardEditorPanel');
    const editorBody = document.getElementById('cardEditorBody');
    const editorPreview = document.getElementById('cardEditorPreview');
    if (editorPanel) editorPanel.classList.remove('open');
    if (editorBody) editorBody.innerHTML = '';
    if (editorPreview) editorPreview.innerHTML = '';
    const overlay = document.getElementById('cardEditorOverlay');
    if (overlay) overlay.classList.remove('open');
    this._sideEditorOpen = false;
    this._editSnapshot = null;
    this._editingConfig = null;
    document.querySelectorAll('.chart-panel.editing').forEach(p => p.classList.remove('editing'));
  },

  _escAttr(str) {
    return String(str).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  },

  // ── Segment Editing (shared by side editor) ───────────────────

  _segmentEditRow(seg, idx) {
    return '<div class="chart-edit-seg-row" data-seg-idx="' + idx + '">'
      + '<input type="color" value="' + seg.color + '" data-seg-field="color" class="chart-edit-color">'
      + '<select data-seg-field="field">' + Object.entries(CHART_FIELDS).map(function(entry) {
          var k = entry[0], f = entry[1];
          return '<option value="' + k + '"' + (seg.field === k ? ' selected' : '') + '>' + f.label + '</option>';
        }).join('') + '</select>'
      + '<input type="text" value="' + seg.label + '" data-seg-field="label" placeholder="Label" class="chart-edit-seg-label">'
      + '<button class="chart-edit-remove-seg" type="button" title="Remove">&times;</button>'
      + '</div>';
  },

  _wireSegmentEditing(container, config) {
    const self = this;
    const updateSegments = () => {
      self.saveDashboard();
      self._renderCardContent(config);
    };

    const segContainer = container.querySelector('#sideEditSegments');
    if (!segContainer) return;

    // Delegate events on segment container
    segContainer.addEventListener('change', (e) => {
      const row = e.target.closest('[data-seg-idx]');
      if (!row) return;
      const idx = parseInt(row.dataset.segIdx);
      const field = e.target.dataset.segField;
      if (field && config.segments[idx]) {
        config.segments[idx][field] = e.target.value;
        updateSegments();
      }
    });

    segContainer.addEventListener('input', (e) => {
      const row = e.target.closest('[data-seg-idx]');
      if (!row) return;
      const idx = parseInt(row.dataset.segIdx);
      const field = e.target.dataset.segField;
      if (field && config.segments[idx]) {
        config.segments[idx][field] = e.target.value;
        updateSegments();
      }
    });

    segContainer.addEventListener('click', (e) => {
      if (e.target.classList.contains('chart-edit-remove-seg')) {
        const row = e.target.closest('[data-seg-idx]');
        if (!row) return;
        const idx = parseInt(row.dataset.segIdx);
        if (config.segments.length > 1) {
          config.segments.splice(idx, 1);
          segContainer.innerHTML = config.segments.map((s, i) => self._segmentEditRow(s, i)).join('');
          updateSegments();
        }
      }
    });

    // Add segment button
    const addBtn = container.querySelector('.editor-add-seg');
    if (addBtn) {
      addBtn.addEventListener('click', () => {
        const nextColor = SEGMENT_PALETTE[config.segments.length % SEGMENT_PALETTE.length];
        config.segments.push({ field: 'totalCases', label: 'New Segment', color: nextColor });
        segContainer.innerHTML = config.segments.map((s, i) => self._segmentEditRow(s, i)).join('');
        updateSegments();
      });
    }
  },

  // ── Suggested Layout Generation ───────────────────────────────

  generateSuggestedLayout() {
    const { agg } = this._getAggregated();
    const layout = [];
    let idCounter = 1;
    const nextId = () => 'sg' + (idCounter++);

    // Always include totalCases and newCases KPIs
    layout.push({ id: nextId(), type: 'kpi', title: 'Total Cases', width: 'small', field: 'totalCases', icon: 'folder', format: 'number', subtitle: 'Active cases statewide' });
    layout.push({ id: nextId(), type: 'kpi', title: 'New Cases', width: 'small', field: 'newCases', icon: 'plus', format: 'number', subtitle: 'Opened this period' });

    // If attorneys data is present
    if (agg.stateFilled > 0 || agg.countyAttorneys > 0) {
      layout.push({ id: nextId(), type: 'kpi', title: 'State Attorneys', width: 'small', field: 'stateFilled', icon: 'users', format: 'number', subtitle: 'GPDC employed' });
      layout.push({ id: nextId(), type: 'kpi', title: 'Vacancy Rate', width: 'small', field: 'vacancyRate', icon: 'alert', format: 'percent', subtitle: 'Unfilled state positions' });
    }

    // Always include top circuits bar chart
    layout.push({ id: nextId(), type: 'bar', title: 'Top Circuits by Cases', subtitle: '10 highest-volume circuits', width: 'medium', field: 'totalCases', colorClass: 'gold', limit: 10, sort: 'desc' });

    // If attorneys: distribution donut
    if (agg.stateFilled > 0 || agg.countyAttorneys > 0) {
      layout.push({ id: nextId(), type: 'donut', title: 'Attorney Distribution', subtitle: 'State vs county positions', width: 'medium', segments: [{ field: 'stateFilled', label: 'State (GPDC)', color: '#c4714e' }, { field: 'countyAttorneys', label: 'County', color: '#e2b77a' }], centerLabel: 'Total' });
    }

    // If custody-rate data is present
    if (agg.custodyRate > 0) {
      layout.push({ id: nextId(), type: 'kpi', title: 'Custody Rate', width: 'small', field: 'custodyRate', icon: 'percent', format: 'percent', subtitle: 'Clients in custody (case-weighted)' });
    }

    // If conflict data is present
    if (agg.conflict && (agg.conflict.newCases > 0 || agg.conflict.totalCases > 0)) {
      layout.push({ id: nextId(), type: 'kpi', title: 'Conflict Cases', width: 'small', field: 'conflictNew', icon: 'shield', format: 'number', subtitle: 'Conflict division cases' });
    }
    if (agg.conflict && agg.conflict.rate > 0) {
      layout.push({ id: nextId(), type: 'kpi', title: 'Conflict Rate', width: 'small', field: 'conflictRate', icon: 'percent', format: 'percent', subtitle: 'Cases referred to conflict (case-weighted)' });
    }

    // If cases: case flow donut
    if (agg.totalCases > 0) {
      layout.push({ id: nextId(), type: 'donut', title: 'Case Flow Breakdown', subtitle: 'New, closed, and remaining cases', width: 'medium', segments: [{ field: 'newCases', label: 'New Cases', color: '#c4714e' }, { field: 'closed', label: 'Closed', color: '#5fa87a' }, { field: 'activeRemaining', label: 'Remaining', color: '#e2b77a' }], centerLabel: 'Total' });
    }

    return layout;
  },

  // ── Card Resize (Apple Vision Pro style) ─────────────────────

  _wireResize(panel, config) {
    const handle = panel.querySelector('.card-resize-handle');
    if (!handle) return;
    const self = this;

    handle.addEventListener('mousedown', (e) => {
      e.preventDefault();
      e.stopPropagation();

      const grid = panel.closest('.dashboard-cards-grid');
      if (!grid) return;

      // Calculate single column width from the grid
      const gridRect = grid.getBoundingClientRect();
      const gridStyle = getComputedStyle(grid);
      const gap = parseFloat(gridStyle.gap) || 24;
      const colWidth = (gridRect.width - gap * 3) / 4;

      const startX = e.clientX;
      const startWidth = panel.getBoundingClientRect().width;
      const sizeMap = ['small', 'medium', 'large', 'full'];

      panel.classList.add('resizing');

      const onMouseMove = (ev) => {
        const deltaX = ev.clientX - startX;
        const newWidth = startWidth + deltaX;

        // Determine which column span is closest
        let bestSpan = 1;
        for (let span = 1; span <= 4; span++) {
          const spanWidth = colWidth * span + gap * (span - 1);
          if (newWidth >= spanWidth - colWidth / 2) {
            bestSpan = span;
          }
        }

        const newSize = sizeMap[bestSpan - 1];
        if (panel.dataset.size !== newSize) {
          panel.dataset.size = newSize;
        }
      };

      const onMouseUp = () => {
        panel.classList.remove('resizing');
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);

        // Persist the new size
        const newSize = panel.dataset.size;
        if (newSize !== config.width) {
          config.width = newSize;
          self.saveDashboard();
          self._renderCardContent(config);

          // Sync side editor size buttons if open
          if (self._sideEditorOpen && self._editingConfig === config) {
            const editorBody = document.getElementById('cardEditorBody');
            if (editorBody) {
              editorBody.querySelectorAll('[data-size-val]').forEach(btn => {
                btn.classList.toggle('active', btn.dataset.sizeVal === newSize);
              });
            }
          }
        }
      };

      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    });
  },

  // ── Drag & Drop ───────────────────────────────────────────────

  _wireDragAndDrop(grid) {
    let dragSrcId = null;

    const getChartCards = () => grid.querySelectorAll('.chart-panel[data-chart-id]');

    getChartCards().forEach(card => {
      card.addEventListener('dragstart', (e) => {
        dragSrcId = card.dataset.chartId;
        card.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', dragSrcId);
      });

      card.addEventListener('dragend', () => {
        card.classList.remove('dragging');
        card.removeAttribute('draggable');
        getChartCards().forEach(c => c.classList.remove('drag-over'));
      });

      card.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        if (card.dataset.chartId !== dragSrcId) {
          card.classList.add('drag-over');
        }
      });

      card.addEventListener('dragleave', () => {
        card.classList.remove('drag-over');
      });

      card.addEventListener('drop', (e) => {
        e.preventDefault();
        card.classList.remove('drag-over');
        const targetId = card.dataset.chartId;
        if (!dragSrcId || dragSrcId === targetId) return;

        // Swap positions in layout array
        const srcIdx = this.layout.findIndex(c => c.id === dragSrcId);
        const tgtIdx = this.layout.findIndex(c => c.id === targetId);
        if (srcIdx === -1 || tgtIdx === -1) return;

        // Move src to tgt position
        const [moved] = this.layout.splice(srcIdx, 1);
        this.layout.splice(tgtIdx, 0, moved);

        this.saveDashboard();
        this.render();
        dragSrcId = null;
      });
    });
  },

  // ── Main Render ───────────────────────────────────────────────

  render() {
    const container = document.getElementById('dashboardChartsSection');
    if (!container || !this.layout) return;

    // Close side editor
    this._closeSideEditor();

    // Clear container (no section title — handled by page layout)
    container.innerHTML = '';

    // Create chart grid (4-column)
    const grid = document.createElement('div');
    grid.className = 'dashboard-cards-grid';
    container.appendChild(grid);

    // Build each card
    this.layout.forEach(config => {
      const card = this._buildCard(config);
      grid.appendChild(card);
      this._wireResize(card, config);
      // Render chart content after DOM insertion
      requestAnimationFrame(() => this._renderCardContent(config));
    });

    // Wire drag-and-drop reordering
    this._wireDragAndDrop(grid);

    // Add "Add Card" button with type picker
    const addWrap = document.createElement('div');
    addWrap.className = 'chart-add-wrap';
    addWrap.innerHTML = ''
      + '<button class="chart-add-btn" id="chartAddBtn">'
      +   '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>'
      +   '<span>Add Card</span>'
      + '</button>'
      + '<div class="chart-add-picker" id="chartAddPicker">'
      +   '<div class="chart-add-picker-title">Choose Card Type</div>'
      +   '<button class="chart-add-option" data-type="kpi">'
      +     '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6h16M4 12h10M4 18h6"/></svg>'
      +     '<div>'
      +       '<div class="chart-add-option-label">KPI Card</div>'
      +       '<div class="chart-add-option-desc">Key metric with icon</div>'
      +     '</div>'
      +   '</button>'
      +   '<button class="chart-add-option" data-type="bar">'
      +     '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>'
      +     '<div>'
      +       '<div class="chart-add-option-label">Bar Chart</div>'
      +       '<div class="chart-add-option-desc">Rank circuits by any metric</div>'
      +     '</div>'
      +   '</button>'
      +   '<button class="chart-add-option" data-type="line">'
      +     '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 18 8 12 12 15 16 8 20 11"/></svg>'
      +     '<div>'
      +       '<div class="chart-add-option-label">Line Chart</div>'
      +       '<div class="chart-add-option-desc">Trend across circuits</div>'
      +     '</div>'
      +   '</button>'
      +   '<button class="chart-add-option" data-type="pie">'
      +     '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.21 15.89A10 10 0 1 1 8 2.83"/><path d="M22 12A10 10 0 0 0 12 2v10z"/></svg>'
      +     '<div>'
      +       '<div class="chart-add-option-label">Pie Chart</div>'
      +       '<div class="chart-add-option-desc">Visualize proportions as wedges</div>'
      +     '</div>'
      +   '</button>'
      +   '<button class="chart-add-option" data-type="ring">'
      +     '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/></svg>'
      +     '<div>'
      +       '<div class="chart-add-option-label">Donut Chart</div>'
      +       '<div class="chart-add-option-desc">Ring chart with center value</div>'
      +     '</div>'
      +   '</button>'
      +   '<button class="chart-add-option" data-type="donut">'
      +     '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="12" x2="21" y2="12"/></svg>'
      +     '<div>'
      +       '<div class="chart-add-option-label">Proportion</div>'
      +       '<div class="chart-add-option-desc">Stacked bar with metrics</div>'
      +     '</div>'
      +   '</button>'
      +   '<button class="chart-add-option" data-type="stat">'
      +     '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20V10"/><path d="M18 20V4"/><path d="M6 20v-4"/></svg>'
      +     '<div>'
      +       '<div class="chart-add-option-label">Stat Card</div>'
      +       '<div class="chart-add-option-desc">Display a single key metric</div>'
      +     '</div>'
      +   '</button>'
      +   '<button class="chart-add-option" data-type="scorecard">'
      +     '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>'
      +     '<div>'
      +       '<div class="chart-add-option-label">Circuit Scorecard</div>'
      +       '<div class="chart-add-option-desc">Caseload vs. standard, flags over-max circuits</div>'
      +     '</div>'
      +   '</button>'
      +   '<button class="chart-add-option" data-type="compare">'
      +     '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="7" y1="20" x2="7" y2="10"/><line x1="11" y1="20" x2="11" y2="4"/><line x1="15" y1="20" x2="15" y2="13"/><line x1="19" y1="20" x2="19" y2="7"/></svg>'
      +     '<div>'
      +       '<div class="chart-add-option-label">Year-over-Year</div>'
      +       '<div class="chart-add-option-desc">Current vs. prior year, grouped bars</div>'
      +     '</div>'
      +   '</button>'
      +   '<button class="chart-add-option" data-type="equity">'
      +     '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v18"/><path d="M3 7h7l-3.5 5a3.5 3.5 0 0 0 7 0L10 7"/><path d="M21 7h-7l3.5 5a3.5 3.5 0 0 0 7 0L17.5 12"/></svg>'
      +     '<div>'
      +       '<div class="chart-add-option-label">Equity Analysis</div>'
      +       '<div class="chart-add-option-desc">Per-circuit disparity vs. statewide average</div>'
      +     '</div>'
      +   '</button>'
      + '</div>';
    const addBtn = addWrap.querySelector('#chartAddBtn');
    const picker = addWrap.querySelector('#chartAddPicker');
    addBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      picker.classList.toggle('open');
    });
    picker.querySelectorAll('.chart-add-option').forEach(opt => {
      opt.addEventListener('click', (e) => {
        e.stopPropagation();
        picker.classList.remove('open');
        this.addCard(opt.dataset.type);
      });
    });
    grid.appendChild(addWrap);

    // Update customize dropdown checkboxes
    this._updateCustomizeDropdown();
  },

  // ── Card CRUD ─────────────────────────────────────────────────

  addCard(type) {
    const id = this._genId();
    let newCard;
    const segDefaults = {
      segments: [
        { field: 'stateFilled', label: 'Segment A', color: SEGMENT_PALETTE[0] },
        { field: 'countyAttorneys', label: 'Segment B', color: SEGMENT_PALETTE[1] }
      ],
      centerLabel: 'Total'
    };
    const barDefaults = { field: 'totalCases', colorClass: 'gold', limit: 10, sort: 'desc' };

    if (type === 'kpi') {
      newCard = { id, type: 'kpi', title: 'New KPI', width: 'small', field: 'totalCases', icon: 'folder', format: 'number', subtitle: '' };
    } else if (type === 'donut') {
      newCard = { id, type: 'donut', title: 'New Proportion Chart', subtitle: 'Click to configure', width: 'medium', ...segDefaults };
    } else if (type === 'pie') {
      newCard = { id, type: 'pie', title: 'New Pie Chart', subtitle: 'Click to configure', width: 'medium', ...segDefaults };
    } else if (type === 'ring') {
      newCard = { id, type: 'ring', title: 'New Donut Chart', subtitle: 'Click to configure', width: 'medium', ...segDefaults };
    } else if (type === 'line') {
      newCard = { id, type: 'line', title: 'New Line Chart', subtitle: 'Click to configure', width: 'medium', ...barDefaults };
    } else if (type === 'stat') {
      newCard = { id, type: 'stat', title: 'New Stat Card', subtitle: 'Click to configure', width: 'medium', field: 'totalCases', format: 'number' };
    } else if (type === 'scorecard') {
      newCard = { id, type: 'scorecard', title: 'Circuit Scorecard', subtitle: 'Caseload vs. standard', width: 'full', standard: 150 };
    } else if (type === 'compare') {
      newCard = { id, type: 'compare', title: 'Year-over-Year', subtitle: 'Current vs. prior year', width: 'large', field: 'totalCases', limit: 8 };
    } else if (type === 'equity') {
      newCard = { id, type: 'equity', title: 'Equity Analysis', subtitle: 'Per-circuit disparity', width: 'full', field: 'caseload' };
    } else {
      newCard = { id, type: 'bar', title: 'New Bar Chart', subtitle: 'Click to configure', width: 'medium', ...barDefaults };
    }
    this.layout.push(newCard);
    this.saveDashboard();
    this.render();

    // Auto-open side editor for the new card
    requestAnimationFrame(() => {
      this._openSideEditor(newCard);
    });
  },

  removeCard(id) {
    const idx = this.layout.findIndex(c => c.id === id);
    if (idx === -1) return;
    this.layout.splice(idx, 1);
    this.saveDashboard();
    this.render();
  },

  updateCard(id, changes) {
    const card = this.layout.find(c => c.id === id);
    if (!card) return;
    Object.assign(card, changes);
    this.saveDashboard();
    this._renderCardContent(card);
  },

  resetToDefaults() {
    this.layout = JSON.parse(JSON.stringify(DEFAULT_CHART_LAYOUT));
    this.saveDashboard();
    this.render();
  },

  // ── Theme Methods ─────────────────────────────────────────────

  setTheme(presetName) {
    const theme = THEME_PRESETS[presetName];
    if (!theme) return;
    this._activeTheme = theme;
    applyTheme(this._activeTheme);
    this.saveDashboard();
  },

  setCustomTheme(themeObj) {
    if (!themeObj || !themeObj.primary) return;
    this._activeTheme = themeObj;
    applyTheme(this._activeTheme);
    this.saveDashboard();
  },

  // ── Customize Dropdown Integration ────────────────────────────

  _updateCustomizeDropdown() {
    const list = document.getElementById('customizeChartsList');
    if (!list) return;
    list.innerHTML = this.layout.map(config => {
      return '<label><input type="checkbox" data-chart-vis="' + config.id + '" checked> ' + config.title + '</label>';
    }).join('');

    // Wire checkbox events
    list.querySelectorAll('input[data-chart-vis]').forEach(cb => {
      cb.addEventListener('change', function() {
        const id = this.dataset.chartVis;
        const panel = document.querySelector('[data-chart-id="' + id + '"]');
        if (panel) panel.style.display = this.checked ? '' : 'none';
      });
    });
  }
};

// Close type picker on outside click
document.addEventListener('click', (e) => {
  const picker = document.getElementById('chartAddPicker');
  if (picker) picker.classList.remove('open');
});
