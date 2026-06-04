// ─── Upload & Column Mapping ─────────────────────────────────────────

// Expected fields for mapping — all optional except circuit
const EXPECTED_FIELDS = [
  { key: 'circuit', label: 'Circuit', required: true, hint: 'Judicial circuit name (required)' },
  { key: 'total_cases', label: 'Total Cases', hint: 'Total active caseload' },
  { key: 'new_cases', label: 'New Cases', hint: 'Cases opened this period' },
  { key: 'rollover_cases', label: 'Rollover Cases', hint: 'Carried over from prior period' },
  { key: 'closed_cases', label: 'Closed Cases', hint: 'Cases resolved this period' },
  { key: 'custody_rate', label: 'Custody Rate (%)', hint: 'Percent of clients in custody' },
  { key: 'state_attorneys_filled', label: 'State Attorneys (Filled)', hint: 'GPDC-funded filled positions' },
  { key: 'state_attorneys_vacant', label: 'State Attorneys (Vacant)', hint: 'GPDC-funded vacant positions' },
  { key: 'county_attorneys', label: 'County Attorneys', hint: 'County-funded attorney count' },
  { key: 'conflict_total_cases', label: 'Total Conflict Cases', hint: 'Total conflict caseload' },
  { key: 'conflict_new_cases', label: 'New Conflict Cases', hint: 'Conflict division new cases' },
  { key: 'conflict_rollover_cases', label: 'Rollover Conflict Cases', hint: 'Conflict division rollover' },
  { key: 'conflict_closed_cases', label: 'Closed Conflict Cases', hint: 'Conflict cases resolved this period' },
  { key: 'conflict_rate', label: 'Conflict Rate (%)', hint: 'Percent of cases referred to conflict' },
  { key: 'total_contractors', label: 'Total Contractors', hint: 'Contract attorneys (CP/C3)' }
];

// Auto-detection aliases (same as original dashboard parser)
const FIELD_ALIASES = {
  circuit: ['Circuit', 'circuit'],
  total_cases: ['Total Cases', 'total_cases'],
  new_cases: ['New Cases', 'new_cases'],
  rollover_cases: ['Rollover Cases', 'Rolleover Cases', 'rollover_cases'],
  closed_cases: ['Closed Cases', 'closed_cases'],
  custody_rate: ['Custody Rate (%)', 'Custody Rate', 'custody_rate'],
  state_attorneys_filled: ['State Attorneys (Filled)', 'state_attorneys_filled'],
  state_attorneys_vacant: ['State Attorneys (Vacant)', 'state_attorneys_vacant'],
  county_attorneys: ['County Attorneys', 'county_attorneys'],
  conflict_total_cases: ['Total Conflict Cases', 'Conflict Total Cases', 'conflict_total_cases'],
  conflict_new_cases: ['New Conflict Cases', 'Conflict New Cases', 'conflict_new_cases'],
  conflict_rollover_cases: ['Rollover Conflict Cases', 'rollover_conflict_cases'],
  conflict_closed_cases: ['Closed Conflict Cases', 'Conflict Closed Cases', 'conflict_closed_cases'],
  conflict_rate: ['Conflict Rate (%)', 'Conflict Rate', 'conflict_rate'],
  total_contractors: ['Total C2 Contractors', 'Total Contractors (CP and C3)', 'total_contractors']
};

let _uploadTempFile = null;
let _uploadHeaders = [];
let _savedMappings = [];

function autoDetectMapping(headers) {
  const mapping = {};
  for (const field of EXPECTED_FIELDS) {
    const aliases = FIELD_ALIASES[field.key] || [];
    const headersLower = headers.map(h => h.toLowerCase().trim());
    for (const alias of aliases) {
      const idx = headersLower.indexOf(alias.toLowerCase().trim());
      if (idx !== -1) {
        mapping[field.key] = headers[idx];
        break;
      }
    }
  }
  return mapping;
}

// Invert the autoMap from { fieldKey: excelHeader } to { excelHeader: fieldKey }
function invertAutoMap(autoMap) {
  const inv = {};
  for (const [fieldKey, excelHeader] of Object.entries(autoMap)) {
    inv[excelHeader] = fieldKey;
  }
  return inv;
}

// Build grouped <optgroup> options for the dashboard field dropdown
function buildFieldOptions(selectedKey) {
  const groups = [
    { label: 'Required', fields: EXPECTED_FIELDS.filter(f => f.required) },
    { label: 'Cases', fields: EXPECTED_FIELDS.filter(f => ['total_cases','new_cases','rollover_cases','closed_cases','custody_rate'].includes(f.key)) },
    { label: 'Staffing', fields: EXPECTED_FIELDS.filter(f => ['state_attorneys_filled','state_attorneys_vacant','county_attorneys'].includes(f.key)) },
    { label: 'Conflict', fields: EXPECTED_FIELDS.filter(f => ['conflict_total_cases','conflict_new_cases','conflict_rollover_cases','conflict_closed_cases','conflict_rate','total_contractors'].includes(f.key)) },
  ];
  let html = '<option value="">— Skip —</option>';
  for (const g of groups) {
    html += `<optgroup label="${g.label}">`;
    for (const f of g.fields) {
      html += `<option value="${f.key}" ${f.key === selectedKey ? 'selected' : ''}>${f.label}${f.required ? ' *' : ''}</option>`;
    }
    html += '</optgroup>';
  }
  return html;
}

function renderMappingUI(headers) {
  const container = $('uploadMappingArea');
  if (!container) return;

  const autoMap = autoDetectMapping(headers);
  const headerToField = invertAutoMap(autoMap);

  // GA fiscal year starts July 1 (FY2026 = Jul 2025–Jun 2026).
  const _now = new Date();
  const defaultFY = _now.getMonth() >= 6 ? _now.getFullYear() + 1 : _now.getFullYear();
  const fyOptions = [defaultFY + 1, defaultFY, defaultFY - 1, defaultFY - 2, defaultFY - 3];

  container.innerHTML = `
    <div class="mapping-header">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
      Map Your Columns
    </div>
    <p class="mapping-subtitle">We found ${headers.length} columns in your file. For each column, choose which dashboard field it maps to — or skip it.</p>
    <div class="mapping-grid">
      <div class="mapping-row mapping-row-header">
        <span class="mapping-col-header">Your Excel Column</span>
        <span class="mapping-col-header">Dashboard Field</span>
        <span></span>
      </div>
      ${headers.map(h => {
        const detectedKey = headerToField[h] || '';
        return `<div class="mapping-row">
          <div class="mapping-excel-col" title="${h}">${h}</div>
          <select class="mapping-select" data-header="${h}">
            ${buildFieldOptions(detectedKey)}
          </select>
          ${detectedKey ? '<span class="mapping-auto">auto</span>' : '<span class="mapping-auto-placeholder"></span>'}
        </div>`;
      }).join('')}
    </div>
    <div class="mapping-actions">
      <div class="mapping-period-row" style="display:flex;gap:14px;align-items:flex-end;margin-bottom:12px;flex-wrap:wrap;">
        <label style="display:flex;flex-direction:column;font-size:.82rem;gap:4px;">
          <span style="font-weight:600;">Fiscal Year</span>
          <select id="uploadFiscalYear" style="min-width:120px;padding:6px 8px;">
            ${fyOptions.map(y => `<option value="${y}"${y===defaultFY?' selected':''}>FY ${y}</option>`).join('')}
          </select>
        </label>
        <label style="display:flex;flex-direction:column;font-size:.82rem;gap:4px;">
          <span style="font-weight:600;">Period</span>
          <select id="uploadPeriod" style="min-width:120px;padding:6px 8px;">
            <option value="annual" selected>Annual</option>
            <option value="Q1">Q1</option>
            <option value="Q2">Q2</option>
            <option value="Q3">Q3</option>
            <option value="Q4">Q4</option>
          </select>
        </label>
      </div>
      ${window.__userRole === 'admin' ? '<label class="mapping-shared-label"><input type="checkbox" id="uploadShared" checked> Upload as shared data (visible to all team members)</label>' : ''}
      <div class="mapping-btn-row">
        <button class="upload-btn mapping-upload-btn" id="mappingUploadBtn">Upload & Apply</button>
        <button class="upload-btn mapping-cancel-btn" id="mappingCancelBtn">Cancel</button>
      </div>
    </div>
  `;
  container.style.display = 'block';

  // Enforce: each dashboard field can only be selected once
  const selects = container.querySelectorAll('.mapping-select');
  selects.forEach(sel => {
    sel.addEventListener('change', () => {
      const used = new Set();
      selects.forEach(s => { if (s.value) used.add(s.value); });
      // Disable already-used options in other selects
      selects.forEach(s => {
        [...s.options].forEach(opt => {
          if (opt.value && opt.value !== s.value) {
            opt.disabled = used.has(opt.value);
          }
        });
      });
    });
    // Trigger once to set initial state
    sel.dispatchEvent(new Event('change'));
  });

  $('mappingUploadBtn').addEventListener('click', submitMappedUpload);
  $('mappingCancelBtn').addEventListener('click', () => {
    container.style.display = 'none';
    _uploadTempFile = null;
  });
}

async function handleFileSelect(file) {
  if (!file) return;

  const status = $('uploadStatus');
  status.textContent = 'Reading file...';
  status.classList.add('visible');

  const formData = new FormData();
  formData.append('file', file);

  try {
    const res = await fetch('api/data/preview-headers', { method: 'POST', body: formData });
    const data = await res.json();
    if (!data.ok) {
      status.textContent = 'Error: ' + data.error;
      return;
    }
    _uploadTempFile = data.tempFile;
    _uploadHeaders = data.headers;
    status.textContent = `Found ${data.headers.length} columns in "${data.sheetName}"`;
    renderMappingUI(data.headers);
  } catch (err) {
    status.textContent = 'Error reading file';
    console.error(err);
  }
}

async function submitMappedUpload() {
  if (!_uploadTempFile) return;

  // Build mapping: { fieldKey: excelColumnName }
  const mapping = {};
  document.querySelectorAll('.mapping-select').forEach(sel => {
    if (sel.value && sel.dataset.header) {
      mapping[sel.value] = sel.dataset.header; // fieldKey → Excel header name
    }
  });

  if (!mapping.circuit) {
    alert('Please map at least one column to "Circuit" (required).');
    return;
  }

  const isShared = $('uploadShared')?.checked || false;
  const fiscalYear = $('uploadFiscalYear')?.value || undefined;
  const period = $('uploadPeriod')?.value || 'annual';
  const btn = $('mappingUploadBtn');
  btn.disabled = true;
  btn.textContent = 'Uploading...';

  try {
    const res = await fetch('api/data/upload-mapped', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tempFile: _uploadTempFile, mapping, shared: isShared, fiscalYear, period })
    });
    const data = await res.json();
    if (data.ok) {
      $('uploadStatus').textContent = `✓ Uploaded ${data.rowCount} circuits successfully`;
      $('uploadStatus').classList.add('visible');
      $('uploadMappingArea').style.display = 'none';
      _uploadTempFile = null;
      // Reload data — mark as fresh upload so onboarding modal can trigger
      window.__freshUpload = true;
      await loadDataFromAPI(data.source);
    } else {
      alert('Upload error: ' + data.error);
    }
  } catch (err) {
    console.error(err);
    alert('Upload failed');
  }
  btn.disabled = false;
  btn.textContent = 'Upload & Apply';
}

// Legacy client-side upload (fallback if server is down)
function handleExcelUpload(file) {
  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: 'array' });
      const sheetName = workbook.SheetNames.find(n => n.toLowerCase().includes('circuit')) || workbook.SheetNames[0];
      const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);
      const newMetrics = new Map();

      rows.forEach(row => {
        const circuitName = row['Circuit'] || row['circuit'];
        if (!circuitName) return;
        const circuit = CIRCUITS.find(c => c.circuit.toLowerCase() === circuitName.toLowerCase());
        if (!circuit) return;

        let stateVacancyRate = parseFloat(row['State Vacancy Rate'] || row['state_vacancy_rate'] || 0);
        if (stateVacancyRate > 1) stateVacancyRate = stateVacancyRate / 100;

        const stateFilled = parseInt(row['State Attorneys (Filled)'] || row['state_attorneys_filled'] || 0);
        const stateVacant = parseInt(row['State Attorneys (Vacant)'] || row['state_attorneys_vacant'] || 0);
        const rolloverCasesRaw = parseInt(row['Rollover Cases'] || row['Rolleover Cases'] || row['rollover_cases'] || row['Rollover'] || row['rollover'] || 0);
        const newCases = parseInt(row['New Cases'] || row['new_cases'] || 0);
        const totalCasesRaw = parseInt(row['Total Cases'] || row['total_cases'] || 0);
        const rolloverCases = rolloverCasesRaw > 0 ? rolloverCasesRaw : Math.max(0, totalCasesRaw - newCases);
        const totalCases = rolloverCases + newCases;
        const conflictNewCases = parseInt(row['New Conflict Cases'] || row['Conflict New Cases'] || row['conflict_new_cases'] || 0);
        const rolloverConflict = parseInt(row['Rollover Conflict Cases'] || row['rollover_conflict_cases'] || 0);
        const totalContractors = parseInt(row['Total C2 Contractors'] || row['Total Contractors (CP and C3)'] || row['total_contractors'] || 0);

        newMetrics.set(circuit.circuit, {
          totalCases, newCases,
          closed: parseInt(row['Closed Cases'] || row['closed_cases'] || 0),
          stateFilled, stateVacant,
          countyAttorneys: parseInt(row['County Attorneys'] || row['county_attorneys'] || 0),
          conflict: { newCases: conflictNewCases, rolloverCases: rolloverConflict, totalContractors }
        });
      });

      if (newMetrics.size > 0) {
        CIRCUIT_METRICS = newMetrics;
        CIRCUITS.forEach(c => {
          if (!CIRCUIT_METRICS.has(c.circuit)) {
            CIRCUIT_METRICS.set(c.circuit, { totalCases: 0, newCases: 0, closed: 0, stateFilled: 0, stateVacant: 0, countyAttorneys: 0, conflict: { newCases: 0, totalContractors: 0 } });
          }
        });
        rerender();
        const status = $('uploadStatus');
        status.classList.add('visible');
        setTimeout(() => status.classList.remove('visible'), 3000);
      }
    } catch (err) { console.error(err); alert('Error reading Excel file.'); }
  };
  reader.readAsArrayBuffer(file);
}
