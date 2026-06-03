// ─── Year-over-Year comparison strip ─────────────────────────────────
// Self-contained: reads the current period (CIRCUIT_METRICS) and the
// comparison period (CIRCUIT_METRICS_PRIOR), computes statewide headline
// metrics, and renders a variance strip. Driven by the period/compare
// selectors wired in app.js. Does not touch the chart engine.

// Whether a rising value is good/bad/neutral, per chart field.
const YOY_FIELD_POLARITY = {
  totalCases: 'neutral', newCases: 'neutral', closed: 'goodUp',
  stateFilled: 'goodUp', stateVacant: 'badUp', countyAttorneys: 'neutral',
  totalAttorneys: 'goodUp', caseload: 'badUp', vacancyRate: 'badUp',
  activeRemaining: 'neutral', conflictNew: 'neutral', conflictContractors: 'neutral',
};

// Build a ▲▼ delta badge comparing cur vs prior, colored by polarity.
// Returns '' when there's no usable prior value.
function yoyDeltaBadge(cur, prior, polarity, suffix) {
  if (prior === 0 || prior == null || cur == null) return '';
  const change = (cur - prior) / Math.abs(prior);
  const up = change > 0.0005, down = change < -0.0005;
  const arrow = up ? '▲' : down ? '▼' : '–';
  let cls = 'yoy-flat';
  if (up || down) {
    const good = (polarity === 'goodUp' && up) || (polarity === 'badUp' && down);
    const bad = (polarity === 'badUp' && up) || (polarity === 'goodUp' && down);
    cls = good ? 'yoy-pos' : bad ? 'yoy-neg' : 'yoy-flat';
  }
  const pc = change * 100;
  const sign = pc > 0 ? '+' : '';
  return `<span class="kpi-delta ${cls}">${arrow} ${sign}${pc.toFixed(1)}%${suffix || ''}</span>`;
}

// Statewide aggregate over a CIRCUIT_METRICS-shaped Map.
function yoyAggregate(map) {
  const a = { totalCases: 0, newCases: 0, closed: 0, stateFilled: 0, stateVacant: 0, countyAttorneys: 0, conflictNew: 0, contractors: 0 };
  if (!map || !map.size) return a;
  for (const m of map.values()) {
    a.totalCases += m.totalCases || 0;
    a.newCases += m.newCases || 0;
    a.closed += m.closed || 0;
    a.stateFilled += m.stateFilled || 0;
    a.stateVacant += m.stateVacant || 0;
    a.countyAttorneys += m.countyAttorneys || 0;
    a.conflictNew += (m.conflict && m.conflict.newCases) || 0;
    a.contractors += (m.conflict && m.conflict.totalContractors) || 0;
  }
  return a;
}

// Derived headline metrics from an aggregate.
function yoyMetric(agg, key) {
  switch (key) {
    case 'totalCases': return agg.totalCases;
    case 'newCases': return agg.newCases;
    case 'closed': return agg.closed;
    case 'clearance': return agg.newCases > 0 ? agg.closed / agg.newCases : 0;
    case 'caseload': {
      const att = agg.stateFilled + agg.countyAttorneys;
      return att > 0 ? agg.totalCases / att : 0;
    }
    case 'vacancyRate': {
      const t = agg.stateFilled + agg.stateVacant;
      return t > 0 ? agg.stateVacant / t : 0;
    }
    default: return 0;
  }
}

// Headline tiles. polarity: 'goodUp' (increase is good → green),
// 'badUp' (increase is bad → red), 'neutral'.
const YOY_TILES = [
  { key: 'totalCases', label: 'Total Cases', fmt: 'int', polarity: 'neutral' },
  { key: 'newCases', label: 'New Cases', fmt: 'int', polarity: 'neutral' },
  { key: 'closed', label: 'Closed Cases', fmt: 'int', polarity: 'goodUp' },
  { key: 'clearance', label: 'Clearance Rate', fmt: 'pct', polarity: 'goodUp' },
  { key: 'caseload', label: 'Caseload / Attorney', fmt: 'dec1', polarity: 'badUp' },
  { key: 'vacancyRate', label: 'Vacancy Rate', fmt: 'pct', polarity: 'badUp' },
];

function yoyFmt(v, fmt) {
  if (fmt === 'pct') return (v * 100).toFixed(1) + '%';
  if (fmt === 'dec1') return v.toFixed(1);
  return Math.round(v).toLocaleString();
}

function yoyFyLabel(fy) {
  return fy ? 'FY' + String(fy).slice(-2) : '';
}

// ─── Circuit Scorecard ───────────────────────────────────────────────
// Per-circuit caseload vs a configurable standard, benchmark-colored, with an
// optional year-over-year column. The headline metric for external reporting.
function scorecardRows(weighted) {
  const fc = getFilteredCircuits();
  const priorOn = !!window.__compareFY && typeof CIRCUIT_METRICS_PRIOR !== 'undefined' && CIRCUIT_METRICS_PRIOR.size;
  const wcount = (typeof weightedCaseCount === 'function') ? weightedCaseCount : () => 0;
  return fc.map((c) => {
    const m = CIRCUIT_METRICS.get(c.circuit) || emptyMetrics();
    const att = m.stateFilled + m.countyAttorneys;
    const cases = weighted ? wcount(m) : m.totalCases;
    const caseload = att > 0 ? cases / att : 0;
    let priorCaseload = null;
    if (priorOn) {
      const pm = CIRCUIT_METRICS_PRIOR.get(c.circuit);
      if (pm) {
        const pa = pm.stateFilled + pm.countyAttorneys;
        const pcases = weighted ? wcount(pm) : pm.totalCases;
        priorCaseload = pa > 0 ? pcases / pa : null;
      }
    }
    return { circuit: c.circuit, cases, attorneys: att, caseload, priorCaseload };
  }).filter((r) => r.attorneys > 0 || r.cases > 0);
}

function renderScorecard(bodyId, config) {
  const el = document.getElementById(bodyId);
  if (!el) return;
  const weighted = !!config.weighted;
  const defaultStd = weighted ? 400 : 150;
  const std = Number(config.standard) > 0 ? Number(config.standard) : defaultStd;
  const rows = scorecardRows(weighted).sort((a, b) => b.caseload - a.caseload);
  if (!rows.length) { el.innerHTML = '<div class="empty-state">No circuit data. Upload data to populate the scorecard.</div>'; return; }
  const over = rows.filter((r) => r.caseload > std).length;
  const compareOn = !!window.__compareFY && typeof CIRCUIT_METRICS_PRIOR !== 'undefined' && CIRCUIT_METRICS_PRIOR.size;
  const caseHdr = weighted ? 'Wtd Cases' : 'Cases';
  const loadHdr = weighted ? 'Wtd Caseload' : 'Caseload';
  const unit = weighted ? 'weighted units / attorney' : 'cases / attorney';

  const body = rows.map((r) => {
    const ratio = std > 0 ? r.caseload / std : 0;
    const cls = r.caseload > std ? 'sc-over' : ratio >= 0.85 ? 'sc-warn' : 'sc-ok';
    const flag = r.caseload > std ? '<span class="sc-flag">OVER</span>' : '';
    const deltaCell = compareOn
      ? `<td class="sc-delta">${r.priorCaseload ? yoyDeltaBadge(r.caseload, r.priorCaseload, 'badUp', '') : '<span class="yoy-flat">—</span>'}</td>`
      : '';
    return `<tr>
      <td class="sc-circuit">${r.circuit}</td>
      <td>${fmt(Math.round(r.cases))}</td>
      <td>${fmt(r.attorneys)}</td>
      <td class="sc-caseload ${cls}">${r.caseload.toFixed(1)} ${flag}</td>
      <td class="sc-bar"><div class="sc-bar-track"><div class="sc-bar-fill ${cls}" style="width:${Math.min(ratio * 100, 100).toFixed(0)}%"></div></div></td>
      ${deltaCell}
    </tr>`;
  }).join('');

  el.innerHTML = `
    <div class="sc-summary"><span class="sc-summary-num ${over > 0 ? 'sc-over' : 'sc-ok'}">${over}</span> of ${rows.length} circuits over the standard of ${fmt(std)} ${unit}${weighted ? '' : ''}</div>
    <div class="sc-table-wrap"><table class="sc-table">
      <thead><tr><th>Circuit</th><th>${caseHdr}</th><th>Attys</th><th>${loadHdr}</th><th>vs Standard</th>${compareOn ? '<th>YoY</th>' : ''}</tr></thead>
      <tbody>${body}</tbody>
    </table></div>`;
}

// ─── Year-over-Year comparison card (grouped bars) ───────────────────
function renderCompareCard(bodyId, config) {
  const el = document.getElementById(bodyId);
  if (!el) return;
  if (!window.__compareFY || typeof CIRCUIT_METRICS_PRIOR === 'undefined' || !CIRCUIT_METRICS_PRIOR.size) {
    el.innerHTML = '<div class="empty-state">Pick a “Compare” year in the toolbar to show year-over-year bars.</div>';
    return;
  }
  const fd = typeof CHART_FIELDS !== 'undefined' && CHART_FIELDS[config.field || 'totalCases'];
  if (!fd) { el.innerHTML = '<div class="empty-state">Unknown metric.</div>'; return; }

  const fc = getFilteredCircuits();
  let rows = fc.map((c) => {
    const m = CIRCUIT_METRICS.get(c.circuit) || emptyMetrics();
    const pm = CIRCUIT_METRICS_PRIOR.get(c.circuit);
    return { label: c.circuit, cur: fd.getCircuit(m), prior: pm ? fd.getCircuit(pm) : 0 };
  }).filter((r) => r.cur > 0 || r.prior > 0);
  rows.sort((a, b) => b.cur - a.cur);
  rows = rows.slice(0, config.limit || 8);
  if (!rows.length) { el.innerHTML = '<div class="empty-state">No data.</div>'; return; }

  const maxVal = Math.max(1, ...rows.map((r) => Math.max(r.cur, r.prior)));
  const curLbl = yoyFyLabel(window.__currentFY);
  const priLbl = yoyFyLabel(window.__compareFY);
  const bars = rows.map((r) => {
    const ch = Math.max((r.cur / maxVal) * 100, 1.5);
    const ph = Math.max((r.prior / maxVal) * 100, 1.5);
    const short = r.label.length > 6 ? r.label.slice(0, 5) + '…' : r.label;
    return `<div class="cmp-group" title="${r.label} — ${priLbl}: ${fmt(r.prior)}, ${curLbl}: ${fmt(r.cur)}">
      <div class="cmp-bars">
        <div class="cmp-bar cmp-prior" style="height:${ph}%"></div>
        <div class="cmp-bar cmp-cur" style="height:${ch}%"></div>
      </div>
      <div class="cmp-label">${short}</div>
    </div>`;
  }).join('');

  el.innerHTML = `
    <div class="cmp-legend"><span class="cmp-key cmp-prior"></span>${priLbl}<span class="cmp-key cmp-cur"></span>${curLbl}</div>
    <div class="cmp-chart">${bars}</div>`;
}

function renderYoY() {
  const strip = document.getElementById('yoyStrip');
  if (!strip) return;

  const hasCompare = !!window.__compareFY;
  const cur = typeof CIRCUIT_METRICS !== 'undefined' ? CIRCUIT_METRICS : null;
  const prior = typeof CIRCUIT_METRICS_PRIOR !== 'undefined' ? CIRCUIT_METRICS_PRIOR : null;
  const curAgg = yoyAggregate(cur);

  // Hide unless we have a comparison selected, prior data, and current data.
  if (!hasCompare || !prior || !prior.size || curAgg.totalCases === 0) {
    strip.style.display = 'none';
    strip.innerHTML = '';
    return;
  }
  const priorAgg = yoyAggregate(prior);

  const tiles = YOY_TILES.map((t) => {
    const c = yoyMetric(curAgg, t.key);
    const p = yoyMetric(priorAgg, t.key);
    let deltaHtml = '<span class="yoy-tile-delta yoy-flat">— no prior</span>';
    if (p !== 0) {
      const change = (c - p) / Math.abs(p); // fractional change
      const pctChange = (change * 100);
      const up = change > 0.0005;
      const down = change < -0.0005;
      const arrow = up ? '▲' : down ? '▼' : '–';
      // Color by polarity.
      let cls = 'yoy-flat';
      if (up || down) {
        const good = (t.polarity === 'goodUp' && up) || (t.polarity === 'badUp' && down);
        const bad = (t.polarity === 'badUp' && up) || (t.polarity === 'goodUp' && down);
        cls = good ? 'yoy-pos' : bad ? 'yoy-neg' : 'yoy-flat';
      }
      const sign = pctChange > 0 ? '+' : '';
      deltaHtml = `<span class="yoy-tile-delta ${cls}">${arrow} ${sign}${pctChange.toFixed(1)}%`
        + `<span class="yoy-delta-prior">vs ${yoyFmt(p, t.fmt)}</span></span>`;
    }
    return `<div class="yoy-tile">
        <div class="yoy-tile-label">${t.label}</div>
        <div class="yoy-tile-value">${yoyFmt(c, t.fmt)}</div>
        ${deltaHtml}
      </div>`;
  }).join('');

  strip.innerHTML = `
    <div class="yoy-strip-head">
      <span class="yoy-strip-title">Year over Year</span>
      <span class="yoy-strip-sub">${yoyFyLabel(window.__currentFY)} vs ${yoyFyLabel(window.__compareFY)} · statewide</span>
    </div>
    <div class="yoy-tiles">${tiles}</div>`;
  strip.style.display = '';
}
