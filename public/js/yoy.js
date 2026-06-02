// ─── Year-over-Year comparison strip ─────────────────────────────────
// Self-contained: reads the current period (CIRCUIT_METRICS) and the
// comparison period (CIRCUIT_METRICS_PRIOR), computes statewide headline
// metrics, and renders a variance strip. Driven by the period/compare
// selectors wired in app.js. Does not touch the chart engine.

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
