// ─── Data collection: template builder + in-app submission form ──────
// Sits on top of the merge engine (/api/templates + /api/data/submit).

const FIELD_CATALOG = [
  { group: 'Cases', fields: [['total_cases', 'Total Cases'], ['new_cases', 'New Cases'], ['rollover_cases', 'Rollover Cases'], ['closed_cases', 'Closed Cases'], ['custody_rate', 'Custody Rate (%)']] },
  { group: 'Case Types', fields: [['capital_cases', 'Capital Cases'], ['felony_cases', 'Felony Cases'], ['misdemeanor_cases', 'Misdemeanor Cases'], ['juvenile_cases', 'Juvenile Cases'], ['appeals_cases', 'Appeals'], ['probation_cases', 'Probation Cases']] },
  { group: 'Attorneys', fields: [['state_attorneys_filled', 'State Attorneys (Filled)'], ['state_attorneys_vacant', 'State Attorneys (Vacant)'], ['county_attorneys', 'County Attorneys']] },
  { group: 'Support Staff', fields: [['investigators', 'Investigators'], ['social_workers', 'Social Workers'], ['paralegals', 'Paralegals']] },
  { group: 'Conflict', fields: [['conflict_total_cases', 'Total Conflict Cases'], ['conflict_new_cases', 'New Conflict Cases'], ['conflict_rollover_cases', 'Rollover Conflict Cases'], ['conflict_closed_cases', 'Closed Conflict Cases'], ['conflict_rate', 'Conflict Rate (%)'], ['total_contractors', 'Total Contractors']] },
  { group: 'Financials', fields: [['annual_budget', 'Annual Budget'], ['actual_spend', 'Actual Spend']] },
];
const FIELD_LABEL_MAP = Object.fromEntries(FIELD_CATALOG.flatMap((g) => g.fields));
let __collectTemplates = [];

function _cbCurrentFY() {
  const d = new Date();
  return d.getMonth() >= 6 ? d.getFullYear() + 1 : d.getFullYear();
}
function cbPeriodOptions(cadence) {
  if (cadence === 'quarterly') return ['Q1', 'Q2', 'Q3', 'Q4'];
  if (cadence === 'monthly') return ['Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
  return ['annual'];
}
async function cbLoadTemplates() {
  try {
    const res = await fetch('api/templates');
    const data = await res.json();
    __collectTemplates = (data.ok && data.templates) ? data.templates : [];
  } catch (e) { console.error('load templates failed', e); __collectTemplates = []; }
  return __collectTemplates;
}
function _cbModal(innerHtml, id) {
  const old = document.getElementById(id);
  if (old) old.remove();
  const m = document.createElement('div');
  m.id = id;
  m.className = 'tpl-modal-overlay';
  m.innerHTML = innerHtml;
  document.body.appendChild(m);
  m.addEventListener('click', (e) => { if (e.target === m) m.remove(); });
  return m;
}

// ── Template builder (admin) ─────────────────────────────────────────
async function openTemplateBuilder() {
  await cbLoadTemplates();
  const m = _cbModal(`<div class="tpl-modal cb-modal">
    <div class="tpl-modal-head">
      <div><div class="tpl-modal-title">Collection Templates</div>
      <div class="tpl-modal-sub">Define what each team submits, and how often.</div></div>
      <button class="tpl-modal-close" id="cbClose">&times;</button>
    </div>
    <div id="cbBody"></div>
  </div>`, 'cbBuilderModal');
  m.querySelector('#cbClose').addEventListener('click', () => m.remove());
  cbRenderBuilderList();
}

function cbRenderBuilderList() {
  const body = document.getElementById('cbBody');
  if (!body) return;
  const rows = __collectTemplates.map((t) => `
    <div class="cb-tpl-row">
      <div class="cb-tpl-main">
        <div class="cb-tpl-name">${t.name}</div>
        <div class="cb-tpl-meta">${(t.fields || []).length} fields · ${t.cadence}${t.owner_role ? ' · ' + t.owner_role : ''}</div>
      </div>
      <div class="cb-tpl-actions">
        <button class="cb-btn-sm" data-status="${t.id}">Status</button>
        <button class="cb-btn-sm" data-edit="${t.id}">Edit</button>
        <button class="cb-btn-sm cb-danger" data-del="${t.id}">Delete</button>
      </div>
    </div>`).join('') || '<div class="cb-empty">No templates yet. Create your first one.</div>';
  body.innerHTML = `<div class="cb-tpl-list">${rows}</div>
    <button class="cb-btn-primary" id="cbNewBtn">+ New Template</button>`;
  body.querySelector('#cbNewBtn').addEventListener('click', () => cbShowForm(null));
  body.querySelectorAll('[data-edit]').forEach((b) => b.addEventListener('click', () => cbShowForm(__collectTemplates.find((t) => String(t.id) === b.dataset.edit))));
  body.querySelectorAll('[data-status]').forEach((b) => b.addEventListener('click', () => cbShowStatus(__collectTemplates.find((t) => String(t.id) === b.dataset.status))));
  body.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', async () => {
    if (!confirm('Delete this template?')) return;
    await fetch('api/templates/' + b.dataset.del, { method: 'DELETE' });
    await cbLoadTemplates(); cbRenderBuilderList();
  }));
}

function cbShowForm(tpl) {
  const body = document.getElementById('cbBody');
  if (!body) return;
  const sel = new Set(tpl ? tpl.fields : []);
  const groups = FIELD_CATALOG.map((g) => `
    <div class="cb-fg"><div class="cb-fg-title">${g.group}</div>
      <div class="cb-fg-items">${g.fields.map(([k, l]) => `
        <label class="cb-chk"><input type="checkbox" value="${k}" ${sel.has(k) ? 'checked' : ''}> ${l}</label>`).join('')}</div>
    </div>`).join('');
  body.innerHTML = `
    <div class="cb-form">
      <div class="cb-row"><label>Name</label><input id="cbName" type="text" value="${tpl ? tpl.name.replace(/"/g, '&quot;') : ''}" placeholder="e.g. Finance — Annual Budget"></div>
      <div class="cb-row"><label>Owner / audience</label><input id="cbOwner" type="text" value="${tpl && tpl.owner_role ? tpl.owner_role.replace(/"/g, '&quot;') : ''}" placeholder="e.g. Finance, Circuit PD"></div>
      <div class="cb-row2">
        <div><label>Cadence</label><select id="cbCadence">
          <option value="annual" ${!tpl || tpl.cadence === 'annual' ? 'selected' : ''}>Annual</option>
          <option value="quarterly" ${tpl && tpl.cadence === 'quarterly' ? 'selected' : ''}>Quarterly</option>
          <option value="monthly" ${tpl && tpl.cadence === 'monthly' ? 'selected' : ''}>Monthly</option>
        </select></div>
        <div><label>Scope</label><select id="cbScope">
          <option value="circuit" ${!tpl || tpl.scope === 'circuit' ? 'selected' : ''}>Per circuit</option>
          <option value="statewide" ${tpl && tpl.scope === 'statewide' ? 'selected' : ''}>Statewide</option>
        </select></div>
      </div>
      <div class="cb-row"><label>Fields to collect</label><div class="cb-fields">${groups}</div></div>
      <div class="cb-form-actions">
        <button class="cb-btn-ghost" id="cbCancel">Cancel</button>
        <button class="cb-btn-primary" id="cbSave">${tpl ? 'Save changes' : 'Create template'}</button>
      </div>
    </div>`;
  body.querySelector('#cbCancel').addEventListener('click', cbRenderBuilderList);
  body.querySelector('#cbSave').addEventListener('click', async () => {
    const name = document.getElementById('cbName').value.trim();
    if (!name) { alert('Name is required'); return; }
    const fields = Array.from(body.querySelectorAll('.cb-chk input:checked')).map((i) => i.value);
    const payload = { name, ownerRole: document.getElementById('cbOwner').value.trim(), cadence: document.getElementById('cbCadence').value, scope: document.getElementById('cbScope').value, fields };
    const url = tpl ? 'api/templates/' + tpl.id : 'api/templates';
    const method = tpl ? 'PUT' : 'POST';
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const r = await res.json();
    if (!r.ok) { alert(r.error || 'Save failed'); return; }
    await cbLoadTemplates(); cbRenderBuilderList();
  });
}

// ── In-app submission form ───────────────────────────────────────────
async function openSubmitForm() {
  await cbLoadTemplates();
  if (!__collectTemplates.length) {
    alert(window.__userRole === 'admin' ? 'No templates yet — create one in Manage Templates first.' : 'No collection templates are available yet.');
    return;
  }
  const m = _cbModal(`<div class="tpl-modal cb-modal cb-modal-wide">
    <div class="tpl-modal-head">
      <div><div class="tpl-modal-title">Submit Data</div>
      <div class="tpl-modal-sub">Fill in your template — only these fields are written; everything else is untouched.</div></div>
      <button class="tpl-modal-close" id="sfClose">&times;</button>
    </div>
    <div class="cb-sf-controls">
      <div><label>Template</label><select id="sfTemplate">${__collectTemplates.map((t) => `<option value="${t.id}">${t.name}</option>`).join('')}</select></div>
      <div><label>Fiscal year</label><input id="sfFY" type="number" value="${_cbCurrentFY()}" style="width:90px"></div>
      <div><label>Period</label><select id="sfPeriod"></select></div>
      <div><label>Circuit</label><select id="sfCircuit"><option value="">All circuits</option>${CIRCUITS.map((c) => `<option value="${c.circuit}">${c.circuit}</option>`).join('')}</select></div>
    </div>
    <div id="sfGrid" class="cb-sf-grid"></div>
    <div class="cb-form-actions">
      <button class="cb-btn-ghost" id="sfCancel">Cancel</button>
      <button class="cb-btn-primary" id="sfSubmit">Submit</button>
    </div>
  </div>`, 'cbSubmitModal');
  const close = () => m.remove();
  m.querySelector('#sfClose').addEventListener('click', close);
  m.querySelector('#sfCancel').addEventListener('click', close);

  const tplSel = m.querySelector('#sfTemplate');
  const perSel = m.querySelector('#sfPeriod');
  const fyInp = m.querySelector('#sfFY');
  const circuitSel = m.querySelector('#sfCircuit');
  const syncPeriods = () => {
    const t = __collectTemplates.find((x) => String(x.id) === tplSel.value);
    perSel.innerHTML = cbPeriodOptions(t ? t.cadence : 'annual').map((p) => `<option value="${p}">${p === 'annual' ? 'Annual' : p}</option>`).join('');
  };
  const rebuild = () => cbBuildSubmitGrid(m);
  tplSel.addEventListener('change', () => { syncPeriods(); rebuild(); });
  perSel.addEventListener('change', rebuild);
  fyInp.addEventListener('change', rebuild);
  circuitSel.addEventListener('change', rebuild);
  m.querySelector('#sfSubmit').addEventListener('click', () => cbSubmit(m));
  syncPeriods();
  rebuild();
}

async function cbBuildSubmitGrid(m) {
  const grid = m.querySelector('#sfGrid');
  const t = __collectTemplates.find((x) => String(x.id) === m.querySelector('#sfTemplate').value);
  if (!t || !t.fields.length) { grid.innerHTML = '<div class="cb-empty">This template has no fields.</div>'; return; }
  const fy = m.querySelector('#sfFY').value;
  const period = m.querySelector('#sfPeriod').value;
  const onlyCircuit = m.querySelector('#sfCircuit').value;
  grid.innerHTML = '<div class="cb-empty">Loading current values…</div>';

  let existing = {};
  try {
    const res = await fetch(`api/data?source=shared&fy=${fy}&period=${encodeURIComponent(period)}`);
    const data = await res.json();
    (data.circuits || []).forEach((r) => { existing[r.circuit] = r; });
  } catch (e) { /* fresh period — no existing values */ }

  const circuits = onlyCircuit ? [onlyCircuit] : CIRCUITS.map((c) => c.circuit);
  const head = `<tr><th>Circuit</th>${t.fields.map((f) => `<th>${FIELD_LABEL_MAP[f] || f}</th>`).join('')}</tr>`;
  const rows = circuits.map((circ) => {
    const ex = existing[circ] || {};
    return `<tr><td class="cb-sf-circ">${circ}</td>${t.fields.map((f) => {
      const v = ex[f] != null && ex[f] !== 0 ? ex[f] : (ex[f] === 0 ? 0 : '');
      return `<td><input type="number" data-circ="${circ}" data-field="${f}" value="${v}"></td>`;
    }).join('')}</tr>`;
  }).join('');
  grid.innerHTML = `<table class="cb-sf-table"><thead>${head}</thead><tbody>${rows}</tbody></table>`;
}

async function cbSubmit(m) {
  const t = __collectTemplates.find((x) => String(x.id) === m.querySelector('#sfTemplate').value);
  if (!t) return;
  const fy = parseInt(m.querySelector('#sfFY').value, 10) || _cbCurrentFY();
  const period = m.querySelector('#sfPeriod').value || 'annual';
  const byCirc = {};
  m.querySelectorAll('#sfGrid input[data-circ]').forEach((inp) => {
    const v = inp.value.trim();
    if (v === '') return;
    (byCirc[inp.dataset.circ] = byCirc[inp.dataset.circ] || { circuit: inp.dataset.circ })[inp.dataset.field] = Number(v);
  });
  const rows = Object.values(byCirc);
  if (!rows.length) { alert('Enter at least one value.'); return; }
  const btn = m.querySelector('#sfSubmit');
  btn.disabled = true; btn.textContent = 'Submitting…';
  try {
    const res = await fetch('api/data/submit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ templateId: t.id, fiscalYear: fy, period, shared: true, rows }) });
    const r = await res.json();
    if (!r.ok) { alert(r.error || 'Submit failed'); btn.disabled = false; btn.textContent = 'Submit'; return; }
    m.remove();
    if (typeof loadDataFromAPI === 'function') await loadDataFromAPI();
    alert(`Submitted ${r.rowCount} circuit row(s) for FY${String(fy).slice(-2)} ${period === 'annual' ? '' : period}.`);
  } catch (e) {
    alert('Submit failed: ' + e.message); btn.disabled = false; btn.textContent = 'Submit';
  }
}

// ── Collection status board ──────────────────────────────────────────
function cbShowStatus(tpl) {
  if (!tpl) return;
  const m = _cbModal(`<div class="tpl-modal cb-modal cb-modal-wide">
    <div class="tpl-modal-head">
      <div><div class="tpl-modal-title">${tpl.name} — Status</div>
      <div class="tpl-modal-sub">Who has submitted, and who's outstanding.</div></div>
      <button class="tpl-modal-close" id="stClose">&times;</button>
    </div>
    <div class="cb-sf-controls">
      <div><label>Fiscal year</label><input id="stFY" type="number" value="${_cbCurrentFY()}" style="width:90px"></div>
      <div><label>Period</label><select id="stPeriod">${cbPeriodOptions(tpl.cadence).map((p) => `<option value="${p}">${p === 'annual' ? 'Annual' : p}</option>`).join('')}</select></div>
    </div>
    <div id="stBody" style="padding:0 1.5rem 1.5rem"></div>
  </div>`, 'cbStatusModal');
  m.querySelector('#stClose').addEventListener('click', () => m.remove());
  const refresh = () => cbRenderStatus(tpl);
  m.querySelector('#stFY').addEventListener('change', refresh);
  m.querySelector('#stPeriod').addEventListener('change', refresh);
  refresh();
}

async function cbRenderStatus(tpl) {
  const m = document.getElementById('cbStatusModal');
  if (!m) return;
  const body = m.querySelector('#stBody');
  const fy = m.querySelector('#stFY').value;
  const period = m.querySelector('#stPeriod').value;
  body.innerHTML = '<div class="cb-empty">Loading…</div>';
  let d;
  try {
    const res = await fetch(`api/templates/${tpl.id}/status?fy=${fy}&period=${encodeURIComponent(period)}`);
    d = await res.json();
  } catch (e) { body.innerHTML = '<div class="cb-empty">Failed to load status.</div>'; return; }
  if (!d.ok) { body.innerHTML = '<div class="cb-empty">' + (d.error || 'Failed') + '</div>'; return; }

  const pct = d.expectedCount ? Math.round((d.submittedCount / d.expectedCount) * 100) : 0;
  const submittedHtml = d.submitted.map((s) => `<div class="cb-st-row cb-st-done"><span class="cb-st-circ">✓ ${s.circuit}</span><span class="cb-st-by">${s.by || ''}</span></div>`).join('');
  const outstandingHtml = d.outstanding.map((cir) => `<div class="cb-st-row cb-st-out"><span class="cb-st-circ">○ ${cir}</span></div>`).join('');
  const recentHtml = (d.recent || []).map((r) => `<div class="cb-st-recent"><b>${r.email || 'someone'}</b> · ${r.count} circuit(s) · ${(r.at || '').replace('T', ' ').slice(0, 16)}</div>`).join('') || '<div class="cb-empty" style="text-align:left;padding:0.4rem 0">No submissions yet for this period.</div>';

  body.innerHTML = `
    <div class="cb-st-summary">
      <div class="cb-st-bignum">${d.submittedCount} <span>of ${d.expectedCount} submitted</span></div>
      <div class="cb-st-bar"><div class="cb-st-bar-fill" style="width:${pct}%"></div></div>
    </div>
    <div class="cb-st-cols">
      <div><div class="cb-st-col-title">Submitted (${d.submitted.length})</div><div class="cb-st-list">${submittedHtml || '<div class="cb-empty" style="padding:0.4rem 0">None yet.</div>'}</div></div>
      <div><div class="cb-st-col-title">Outstanding (${d.outstanding.length})</div><div class="cb-st-list">${outstandingHtml || '<div class="cb-empty" style="padding:0.4rem 0">All in.</div>'}</div></div>
    </div>
    <div class="cb-st-recent-wrap"><div class="cb-st-col-title">Recent submissions</div>${recentHtml}</div>`;
}
