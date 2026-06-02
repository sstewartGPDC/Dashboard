// ─── Phase 3/4 extras: data export, template gallery, lock mode ──────

// ── Data export (Excel / CSV) ────────────────────────────────────────
function gpdcDataRows() {
  const headers = ['Circuit', 'Total Cases', 'New Cases', 'Closed Cases',
    'State Attorneys (Filled)', 'State Attorneys (Vacant)', 'County Attorneys',
    'Conflict New Cases', 'Contractors', 'Caseload / Attorney', 'Vacancy Rate %'];
  const rows = [headers];
  CIRCUITS.forEach((c) => {
    const m = CIRCUIT_METRICS.get(c.circuit);
    if (!m) return;
    const att = m.stateFilled + m.countyAttorneys;
    const caseload = att > 0 ? Number((m.totalCases / att).toFixed(1)) : 0;
    const vt = m.stateFilled + m.stateVacant;
    const vac = vt > 0 ? Number(((m.stateVacant / vt) * 100).toFixed(1)) : 0;
    rows.push([
      c.circuit, m.totalCases, m.newCases, m.closed,
      m.stateFilled, m.stateVacant, m.countyAttorneys,
      m.conflict.newCases, m.conflict.totalContractors, caseload, vac,
    ]);
  });
  return rows;
}

function _gpdcDownload(content, type, filename) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function exportData(format) {
  if (typeof XLSX === 'undefined') { alert('Spreadsheet export is unavailable (library not loaded).'); return; }
  if (typeof CIRCUIT_METRICS === 'undefined' || !__hasData) { alert('No data to export yet. Upload data first.'); return; }
  const rows = gpdcDataRows();
  if (rows.length <= 1) { alert('No circuit data to export.'); return; }
  const fy = window.__currentFY ? 'FY' + String(window.__currentFY).slice(-2) : 'data';
  const stamp = (window.__exportDate || ''); // optional injected date
  const date = stamp || new Date().toISOString().slice(0, 10);
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = rows[0].map((h) => ({ wch: Math.max(String(h).length + 2, 12) }));
  if (format === 'csv') {
    _gpdcDownload(XLSX.utils.sheet_to_csv(ws), 'text/csv;charset=utf-8', `GPDC_${fy}_CircuitData_${date}.csv`);
  } else {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Circuit Data');
    XLSX.writeFile(wb, `GPDC_${fy}_CircuitData_${date}.xlsx`);
  }
}

// ── Template gallery ─────────────────────────────────────────────────
function openTemplateGallery() {
  if (typeof GALLERY_TEMPLATES === 'undefined') return;
  const sd = document.getElementById('dashboardSwitcherDropdown');
  if (sd) sd.classList.remove('open');
  const existing = document.getElementById('templateGalleryModal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'templateGalleryModal';
  modal.className = 'tpl-modal-overlay';
  modal.innerHTML = `<div class="tpl-modal">
    <div class="tpl-modal-head">
      <div>
        <div class="tpl-modal-title">Start from a template</div>
        <div class="tpl-modal-sub">Audience-ready dashboards — fully editable after you create them.</div>
      </div>
      <button class="tpl-modal-close" id="tplClose" aria-label="Close">&times;</button>
    </div>
    <div class="tpl-grid">${GALLERY_TEMPLATES.map((t) => `
      <button class="tpl-card" data-key="${t.key}">
        <div class="tpl-card-aud">${t.audience}</div>
        <div class="tpl-card-name">${t.name}</div>
        <div class="tpl-card-desc">${t.desc}</div>
        <div class="tpl-card-count">${t.layout.length} cards</div>
      </button>`).join('')}</div>
  </div>`;
  document.body.appendChild(modal);

  const close = () => modal.remove();
  modal.addEventListener('click', (e) => { if (e.target === modal) close(); });
  modal.querySelector('#tplClose').addEventListener('click', close);
  modal.querySelectorAll('.tpl-card').forEach((card) => {
    card.addEventListener('click', async () => {
      const tpl = GALLERY_TEMPLATES.find((t) => t.key === card.dataset.key);
      if (!tpl) return;
      card.classList.add('tpl-card-loading');
      try {
        const layout = JSON.parse(JSON.stringify(tpl.layout));
        const id = await chartEngine.createDashboard(tpl.name, layout);
        if (id) {
          await chartEngine.switchDashboard(id);
          const ni = document.getElementById('dashboardName');
          if (ni) ni.value = chartEngine._activeDashboardName;
        }
      } catch (err) {
        console.error('Template create failed:', err);
      }
      close();
    });
  });
}

// ── Lock / Present mode ──────────────────────────────────────────────
// Session-only read-only mode: hides editing chrome and disables hand-typed
// value edits. (Server-enforced per-dashboard lock + roles is a follow-up.)
let __dashLocked = false;

function applyLockUI() {
  const sec = document.getElementById('dashboardChartsSection');
  if (sec) sec.classList.toggle('dash-locked', __dashLocked);
  const lbl = document.getElementById('lockToggleLabel');
  if (lbl) lbl.textContent = __dashLocked ? 'Locked' : 'Lock';
  const btn = document.getElementById('lockToggleBtn');
  if (btn) {
    btn.classList.toggle('lock-active', __dashLocked);
    btn.title = __dashLocked ? 'Unlock to edit' : 'Lock editing (present mode)';
  }
  if (typeof chartEngine !== 'undefined') chartEngine.locked = __dashLocked;
}

function toggleLock() {
  __dashLocked = !__dashLocked;
  if (typeof chartEngine !== 'undefined') {
    chartEngine.locked = __dashLocked;
    chartEngine.render();
  }
  applyLockUI();
}
