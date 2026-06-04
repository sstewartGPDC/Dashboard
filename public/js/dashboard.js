const ui = { circuit: "All", county: "All", q: "", caseType: "normal" };
const $ = (id) => document.getElementById(id);
const fmt = (n) => (n ?? 0).toLocaleString();
const pct = (n) => (n * 100).toFixed(1) + '%';
const getVacancyClass = (rate) => rate < 0.10 ? 'low' : rate < 0.20 ? 'medium' : 'high';

// ─── KPI Icon Map (SVG strings) ─────────────────────────────────────
const KPI_ICONS = {
  folder: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>',
  users: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
  briefcase: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>',
  globe: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
  alert: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
  'trending-up': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>',
  'trending-down': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 18 13.5 8.5 8.5 13.5 1 6"/><polyline points="17 18 23 18 23 12"/></svg>',
  dollar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>',
  percent: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="5" x2="5" y2="19"/><circle cx="6.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/></svg>',
  shield: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>',
  clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg>',
  hash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="9" x2="20" y2="9"/><line x1="4" y1="15" x2="20" y2="15"/><line x1="10" y1="3" x2="8" y2="21"/><line x1="16" y1="3" x2="14" y2="21"/></svg>',
};

function activeFiltersCount() { return (ui.circuit !== "All" ? 1 : 0) + (ui.county !== "All" ? 1 : 0) + (ui.q.trim() ? 1 : 0); }
function updateActivePill() { const pill = $("activeFilterPill"); const n = activeFiltersCount(); if (n > 0) { pill.classList.add("visible"); pill.textContent = `Active (${n})`; } else pill.classList.remove("visible"); }
function circuitMatchesSearch(c) { const q = ui.q.trim().toLowerCase(); return !q || c.circuit.toLowerCase().includes(q) || c.counties.some(cty => cty.toLowerCase().includes(q)); }
function getFilteredCircuits() { return CIRCUITS.filter(c => (ui.circuit === "All" || c.circuit === ui.circuit) && (ui.county === "All" || c.counties.includes(ui.county)) && circuitMatchesSearch(c)); }

function aggregateMetricsFrom(map, filteredCircuits) {
  const agg = {
    totalCases: 0, newCases: 0, closed: 0, stateFilled: 0, stateVacant: 0, countyAttorneys: 0,
    conflict: { totalCases: 0, newCases: 0, closed: 0, totalContractors: 0, rate: 0 },
    custodyRate: 0,
    capitalCases: 0, felonyCases: 0, misdemeanorCases: 0, juvenileCases: 0, appealsCases: 0, probationCases: 0,
    investigators: 0, socialWorkers: 0, paralegals: 0, annualBudget: 0, actualSpend: 0,
  };
  // Rates can't be summed — accumulate case-weighted numerators, divide at the end.
  let custodyW = 0, custodyN = 0, conflictW = 0, conflictN = 0;
  for (const c of filteredCircuits) {
    const m = map && map.get(c.circuit);
    if (!m) continue;
    agg.totalCases += m.totalCases; agg.newCases += m.newCases; agg.closed += m.closed;
    agg.stateFilled += m.stateFilled; agg.stateVacant += m.stateVacant;
    agg.countyAttorneys += m.countyAttorneys;
    agg.conflict.totalCases += m.conflict.totalCases || 0;
    agg.conflict.newCases += m.conflict.newCases;
    agg.conflict.closed += m.conflict.closed || 0;
    agg.conflict.totalContractors += m.conflict.totalContractors;
    if (m.custodyRate > 0) { custodyN += m.custodyRate * (m.totalCases || 1); custodyW += (m.totalCases || 1); }
    if ((m.conflict.rate || 0) > 0) { conflictN += m.conflict.rate * (m.totalCases || 1); conflictW += (m.totalCases || 1); }
    agg.capitalCases += m.capitalCases || 0; agg.felonyCases += m.felonyCases || 0;
    agg.misdemeanorCases += m.misdemeanorCases || 0; agg.juvenileCases += m.juvenileCases || 0;
    agg.appealsCases += m.appealsCases || 0; agg.probationCases += m.probationCases || 0;
    agg.investigators += m.investigators || 0; agg.socialWorkers += m.socialWorkers || 0;
    agg.paralegals += m.paralegals || 0;
    agg.annualBudget += m.annualBudget || 0; agg.actualSpend += m.actualSpend || 0;
  }
  // Stored as fractions (0–1) so the 'percent' card format renders them correctly.
  agg.custodyRate = custodyW > 0 ? (custodyN / custodyW) / 100 : 0;
  agg.conflict.rate = conflictW > 0 ? (conflictN / conflictW) / 100 : 0;
  return agg;
}
function aggregateMetrics(filteredCircuits) { return aggregateMetricsFrom(CIRCUIT_METRICS, filteredCircuits); }

function getActiveCategories(agg) {
  return {
    hasCases: agg.totalCases > 0 || agg.newCases > 0 || agg.closed > 0,
    hasAttorneys: agg.stateFilled > 0 || agg.countyAttorneys > 0 || agg.stateVacant > 0,
    hasConflict: agg.conflict.newCases > 0 || agg.conflict.totalContractors > 0,
  };
}

// Legacy KPI functions removed — all KPIs now rendered via chart engine as card type 'kpi'

function renderCircuitList(filteredCircuits) {
  $("circuitCount").textContent = `${filteredCircuits.length} circuits`;
  const list = $("circuitList");
  list.innerHTML = filteredCircuits.length === 0 ? '<div class="empty-state">No circuits match filters.</div>' : '';
  filteredCircuits.forEach(c => {
    const m = CIRCUIT_METRICS.get(c.circuit) || { totalCases: 0, conflict: { newCases: 0 } };
    const btn = document.createElement("button");
    btn.className = "circuit-item";
    btn.innerHTML = `<div class="circuit-item-header"><span class="circuit-name">${c.circuit}</span><span class="circuit-cases tabular">${fmt(m.totalCases)} cases</span></div><div class="circuit-counties">${c.counties.join(", ")}</div>`;
    btn.addEventListener("click", () => setCircuitFilter(c.circuit));
    list.appendChild(btn);
  });
}

// Column visibility state: col indices 1-6 (0=Circuit is always shown)
const tableColVisible = { 1: true, 2: true, 3: true, 4: true, 5: true, 6: true };

// Legacy dashboard visibility system removed — all cards managed by chart engine

function applyColumnVisibility() {
  const table = document.querySelector(".circuit-table");
  if (!table) return;
  for (let col = 1; col <= 6; col++) {
    const show = tableColVisible[col];
    table.querySelectorAll(`th:nth-child(${col + 1}), td:nth-child(${col + 1})`).forEach(el => {
      el.style.display = show ? "" : "none";
    });
  }
}

function renderCircuitTable(filteredCircuits) {
  const tbody = $("circuitTableBody");
  tbody.innerHTML = "";
  let totals = { total: 0, conflict: 0, state: 0, county: 0, attorneys: 0 };
  const countyTip = "County attorney data for this circuit is incomplete. Information is still being collected from county partners.";
  filteredCircuits.forEach(c => {
    const m = CIRCUIT_METRICS.get(c.circuit) || { totalCases: 0, newCases: 0, closed: 0, stateFilled: 0, countyAttorneys: 0, conflict: { newCases: 0, totalContractors: 0 } };
    const totalAtty = m.stateFilled + m.countyAttorneys;
    const stateCaseload = m.stateFilled > 0 ? (m.totalCases / m.stateFilled).toFixed(1) : "—";
    const countyDisplay = m.countyAttorneys === 0 ? `<span class="county-asterisk" data-tip="${countyTip}">*</span>` : fmt(m.countyAttorneys);
    totals.total += m.totalCases; totals.conflict += m.conflict.newCases; totals.state += m.stateFilled; totals.county += m.countyAttorneys; totals.attorneys += totalAtty;
    const tr = document.createElement("tr");
    tr.innerHTML = `<td><strong>${c.circuit}</strong></td><td class="text-right tabular">${fmt(m.totalCases)}</td><td class="text-right tabular">${fmt(m.conflict.newCases)}</td><td class="text-right tabular">${fmt(m.stateFilled)}</td><td class="text-right tabular">${countyDisplay}</td><td class="text-right tabular">${fmt(totalAtty)}</td><td class="text-right tabular">${stateCaseload}</td>`;
    tr.addEventListener("click", () => setCircuitFilter(c.circuit, true));
    tbody.appendChild(tr);
  });
  $("tableMeta").textContent = `${filteredCircuits.length} circuits • ${fmt(totals.state)} GPDC state attorneys • ${fmt(totals.county)} county attorneys`;
  applyColumnVisibility();
}

function renderConflictTable(filteredCircuits) {
  // Conflict data is now integrated into the main Circuit Overview table
}

function rerender() {
  updateActivePill();
  const fc = getFilteredCircuits();
  const agg = aggregateMetrics(fc);
  renderCircuitList(fc);
  renderCircuitTable(fc);
  if (window.__map && window.__gaCountiesGeoJSON) renderGAChoropleth(window.__map, window.__gaCountiesGeoJSON);
  if (!$("viewDashboard").classList.contains("hidden")) renderCharts();
}

function showNormalCases() { ui.caseType = "normal"; renderCircuitList(getFilteredCircuits()); }
function showConflictCases() { ui.caseType = "conflict"; renderCircuitList(getFilteredCircuits()); }

function setOptions(select, values) { select.innerHTML = values.map(v => `<option value="${v}">${v}</option>`).join(''); }
function refreshCountyOptions() { const counties = ui.circuit === "All" ? [...new Set(CIRCUITS.flatMap(c => c.counties))].sort() : (CIRCUITS.find(x => x.circuit === ui.circuit)?.counties || []).slice().sort(); setOptions($("countySelect"), ["All", ...counties]); }
function setCircuitFilter(circuitName, scrollTop = false) { ui.circuit = circuitName; $("circuitSelect").value = circuitName; refreshCountyOptions(); ui.county = "All"; $("countySelect").value = "All"; rerender(); if (scrollTop) window.scrollTo({ top: 0, behavior: "smooth" }); }

function initFilters() {
  setOptions($("circuitSelect"), ["All", ...CIRCUITS.map(c => c.circuit).sort()]);
  refreshCountyOptions();
  $("circuitSelect").addEventListener("change", (e) => { ui.circuit = e.target.value; ui.county = "All"; refreshCountyOptions(); $("countySelect").value = "All"; rerender(); });
  $("countySelect").addEventListener("change", (e) => { ui.county = e.target.value; rerender(); });
  $("searchInput").addEventListener("input", (e) => { ui.q = e.target.value; rerender(); });
  $("resetBtn").addEventListener("click", () => { ui.circuit = "All"; ui.county = "All"; ui.q = ""; $("circuitSelect").value = "All"; refreshCountyOptions(); $("countySelect").value = "All"; $("searchInput").value = ""; rerender(); });
  // Upload button listeners are now in app.js (server-side upload with column mapping)
}

const COUNTY_TO_CIRCUIT = new Map(CIRCUITS.flatMap(c => c.counties.map(county => [county.trim().toLowerCase(), c.circuit])));
const normCountyName = (name) => String(name || "").replace(/\s+County$/i, "").trim().toLowerCase();

const MAP_METRICS = {
  NEW: { label: "New Cases", get: (cm, isConflict) => isConflict ? cm.conflict.newCases : cm.newCases },
  TOTAL: { label: "Total Cases", get: (cm, isConflict) => isConflict ? cm.conflict.newCases : cm.totalCases },
  TOTAL_ATTY: { label: "Total Attorneys", get: (cm) => cm.stateFilled + cm.countyAttorneys },
  STATE_ATTY: { label: "State Attorneys", get: (cm) => cm.stateFilled },
  COUNTY_ATTY: { label: "County Attorneys", get: (cm) => cm.countyAttorneys },
  CASELOAD: { label: "Caseload", get: (cm, isConflict) => { if (isConflict) { const con = cm.conflict.totalContractors; return con > 0 ? cm.conflict.newCases / con : null; } const atty = cm.stateFilled + cm.countyAttorneys; return atty > 0 ? cm.totalCases / atty : null; } }
};

let __mapMetricKey = "NEW", __mapDataType = "normal", __svgMapEl = null, __mapTooltip = null;

// FIPS code (the GA counties SVG path ids) → county slug.
const FIPS_TO_COUNTY = {
  '001':'appling','003':'atkinson','005':'bacon','007':'baker','009':'baldwin','011':'banks','013':'barrow','015':'bartow','017':'ben-hill','019':'berrien',
  '021':'bibb','023':'bleckley','025':'brantley','027':'brooks','029':'bryan','031':'bulloch','033':'burke','035':'butts','037':'calhoun','039':'camden',
  '043':'candler','045':'carroll','047':'catoosa','049':'charlton','051':'chatham','053':'chattahoochee','055':'chattooga','057':'cherokee','059':'clarke','061':'clay',
  '063':'clayton','065':'clinch','067':'cobb','069':'coffee','071':'colquitt','073':'columbia','075':'cook','077':'coweta','079':'crawford','081':'crisp',
  '083':'dade','085':'dawson','087':'decatur','089':'dekalb','091':'dodge','093':'dooly','095':'dougherty','097':'douglas','099':'early','101':'echols',
  '103':'effingham','105':'elbert','107':'emanuel','109':'evans','111':'fannin','113':'fayette','115':'floyd','117':'forsyth','119':'franklin','121':'fulton',
  '123':'gilmer','125':'glascock','127':'glynn','129':'gordon','131':'grady','133':'greene','135':'gwinnett','137':'habersham','139':'hall','141':'hancock',
  '143':'haralson','145':'harris','147':'hart','149':'heard','151':'henry','153':'houston','155':'irwin','157':'jackson','159':'jasper','161':'jeff-davis',
  '163':'jefferson','165':'jenkins','167':'johnson','169':'jones','171':'lamar','173':'lanier','175':'laurens','177':'lee','179':'liberty','181':'lincoln',
  '183':'long','185':'lowndes','187':'lumpkin','189':'mcduffie','191':'mcintosh','193':'macon','195':'madison','197':'marion','199':'meriwether','201':'miller',
  '205':'mitchell','207':'monroe','209':'montgomery','211':'morgan','213':'murray','215':'muscogee','217':'newton','219':'oconee','221':'oglethorpe','223':'paulding',
  '225':'peach','227':'pickens','229':'pierce','231':'pike','233':'polk','235':'pulaski','237':'putnam','239':'quitman','241':'rabun','243':'randolph',
  '245':'richmond','247':'rockdale','249':'schley','251':'screven','253':'seminole','255':'spalding','257':'stephens','259':'stewart','261':'sumter','263':'talbot',
  '265':'taliaferro','267':'tattnall','269':'taylor','271':'telfair','273':'terrell','275':'thomas','277':'tift','279':'toombs','281':'towns','283':'treutlen',
  '285':'troup','287':'turner','289':'twiggs','291':'union','293':'upson','295':'walker','297':'walton','299':'ware','301':'warren','303':'washington',
  '305':'wayne','307':'webster','309':'wheeler','311':'white','313':'whitfield','315':'wilcox','317':'wilkes','319':'wilkinson','321':'worth'
};
const _mapNorm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const NORM_COUNTY_TO_CIRCUIT = new Map(CIRCUITS.flatMap(c => c.counties.map(co => [_mapNorm(co), c.circuit])));
const NORM_COUNTY_TO_NAME = new Map(CIRCUITS.flatMap(c => c.counties.map(co => [_mapNorm(co), co.trim()])));
function fipsCircuit(fips) { const slug = FIPS_TO_COUNTY[fips]; return slug ? (NORM_COUNTY_TO_CIRCUIT.get(_mapNorm(slug)) || null) : null; }
function fipsCountyName(fips) { const slug = FIPS_TO_COUNTY[fips]; if (!slug) return fips; return NORM_COUNTY_TO_NAME.get(_mapNorm(slug)) || slug.replace(/(^|-)([a-z])/g, (m, a, b) => (a ? ' ' : '') + b.toUpperCase()); }
function _countyPaths(svg) { return Array.from(svg.querySelectorAll('path')).filter(p => p.id && FIPS_TO_COUNTY[p.id]); }

function getCircuitMetricValue(circuitName, metricKey, isConflict) { const cm = CIRCUIT_METRICS.get(circuitName); return cm ? MAP_METRICS[metricKey].get(cm, isConflict) : null; }
function rampColor(t, isConflict) { return isConflict ? `hsl(168 ${40 + t * 20}% ${78 - t * 38}%)` : `hsl(${18 - t * 8} ${55 + t * 25}% ${78 - t * 35}%)`; }
function makeScale(values) { const nums = values.filter(v => typeof v === "number" && isFinite(v)); return { min: Math.min(...nums), max: Math.max(...nums), hasData: nums.length > 0 }; }
function colorForValue(v, scale, isConflict) { if (!scale.hasData || v == null) return "#e2e8f0"; if (scale.max === scale.min) return rampColor(0.5, isConflict); const t = (v - scale.min) / (scale.max - scale.min); return rampColor(Math.max(0, Math.min(1, t)), isConflict); }

// Color the SVG counties by the selected metric (choropleth). Same data path
// as before; renders into the website's Georgia SVG instead of Leaflet.
function renderGAChoropleth() {
  const svg = __svgMapEl;
  if (!svg) return;
  const isConflict = __mapDataType === "conflict";
  const paths = _countyPaths(svg);
  const vals = paths.map(p => { const c = fipsCircuit(p.id); return c ? getCircuitMetricValue(c, __mapMetricKey, isConflict) : null; });
  const scale = makeScale(vals);
  paths.forEach(p => {
    const circuit = fipsCircuit(p.id);
    const v = circuit ? getCircuitMetricValue(circuit, __mapMetricKey, isConflict) : null;
    const active = (ui.circuit === "All" || ui.circuit === circuit);
    p.dataset.circuit = circuit || "";
    p.setAttribute("fill", circuit ? colorForValue(v, scale, isConflict) : "#ececec");
    p.setAttribute("stroke", "#ffffff");
    p.setAttribute("stroke-width", "0.5");
    p.style.opacity = active ? "1" : "0.28";
  });
  renderMapLegend(scale, isConflict);
}

// Highlight the hovered county + its circuit siblings via CSS classes (glow +
// eased transition), matching the public site — no hard outline.
function setCircuitHover(path, on) {
  if (!__svgMapEl) return;
  path.classList.toggle("is-hovered", on);
  const circuit = path.dataset.circuit;
  if (!circuit) return;
  __svgMapEl.querySelectorAll('path.ga-county[data-circuit="' + circuit + '"]').forEach(p => {
    if (p !== path) p.classList.toggle("is-circuit", on);
  });
}

function hideMapTooltip() { if (__mapTooltip) __mapTooltip.style.opacity = "0"; }
function showMapTooltip(e, p) {
  if (!__mapTooltip) return;
  const circuit = fipsCircuit(p.id);
  const name = fipsCountyName(p.id);
  const isConflict = __mapDataType === "conflict";
  let html = `<strong>${name} County</strong><span>${circuit ? circuit + " Circuit" : "Unmapped"}</span>`;
  if (circuit && CIRCUIT_METRICS.get(circuit)) {
    const v = getCircuitMetricValue(circuit, __mapMetricKey, isConflict);
    const disp = v == null ? "—" : (__mapMetricKey === "CASELOAD" ? v.toFixed(1) : fmt(v));
    html += `<div class="ga-map-tip-metric">${MAP_METRICS[__mapMetricKey].label}: <b>${disp}</b></div>`;
  }
  __mapTooltip.innerHTML = html;
  __mapTooltip.style.left = (e.clientX + 14) + "px";
  __mapTooltip.style.top = (e.clientY + 14) + "px";
  __mapTooltip.style.opacity = "1";
}

function renderMapLegend(scale, isConflict) {
  const el = document.getElementById("gaMapLegend");
  if (!el) return;
  const swatches = [0, 0.25, 0.5, 0.75, 1].map(t => rampColor(t, isConflict));
  const dec = __mapMetricKey === "CASELOAD" ? 1 : 0;
  el.innerHTML = `<div class="ga-leg-title">${MAP_METRICS[__mapMetricKey].label}</div>`
    + `<div class="ga-leg-sub" style="color:${isConflict ? "#2a7d6e" : "#B85C38"}">${isConflict ? "Conflict" : "Circuit Office"}</div>`
    + `<div class="ga-leg-swatches">${swatches.map(c => `<span style="background:${c}"></span>`).join("")}</div>`
    + `<div class="ga-leg-range"><span>${scale.hasData ? scale.min.toFixed(dec) : "—"}</span><span>${scale.hasData ? scale.max.toFixed(dec) : "—"}</span></div>`;
}

function initMap() {
  const container = document.getElementById("map");
  if (!container) return;
  if (!__mapTooltip) { __mapTooltip = document.createElement("div"); __mapTooltip.className = "ga-map-tooltip"; document.body.appendChild(__mapTooltip); }

  fetch("images/georgia-wiki.svg").then(r => r.text()).then(txt => {
    container.innerHTML = txt + '<div class="ga-map-legend" id="gaMapLegend"></div>';
    const svg = container.querySelector("svg");
    if (!svg) return;
    __svgMapEl = svg;
    svg.removeAttribute("width");
    svg.removeAttribute("height");
    svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
    svg.style.cssText = "width:100%;height:100%;display:block";
    _countyPaths(svg).forEach((p, i) => {
      p.removeAttribute("style");
      p.classList.add("ga-county", "ga-reveal");
      p.style.animationDelay = (i * 4) + "ms"; // staggered fade-in
      p.addEventListener("mousemove", (e) => showMapTooltip(e, p));
      p.addEventListener("mouseenter", () => setCircuitHover(p, true));
      p.addEventListener("mouseleave", () => { hideMapTooltip(); setCircuitHover(p, false); });
      p.addEventListener("click", () => { const c = fipsCircuit(p.id); if (c) { setCircuitFilter(c, true); showCircuitsView(); } });
    });
    window.__map = true;
    window.__gaCountiesGeoJSON = true;
    renderGAChoropleth();
  }).catch(err => { console.error("Map load failed", err); container.innerHTML = '<div style="padding:2rem;text-align:center;color:#6b6b6b">Failed to load map.</div>'; });

  document.getElementById("mapDataSelect").addEventListener("change", (e) => { __mapDataType = e.target.value; renderGAChoropleth(); });
  document.getElementById("mapMetricSelect").addEventListener("change", (e) => { __mapMetricKey = e.target.value; renderGAChoropleth(); });
  document.getElementById("mapResetBtn").addEventListener("click", () => { ui.circuit = "All"; const cs = document.getElementById("circuitSelect"); if (cs) cs.value = "All"; if (typeof refreshCountyOptions === "function") refreshCountyOptions(); ui.county = "All"; const cn = document.getElementById("countySelect"); if (cn) cn.value = "All"; rerender(); });
}

// ─── Charts Rendering ────────────────────────────────────────────────

function renderHBarChart(containerId, data, colorClass) {
  const el = $(containerId);
  if (!el) return;
  if (!data.length) { el.innerHTML = '<div class="empty-state">No data available</div>'; return; }
  const maxVal = Math.max(...data.map(d => d.value), 1);
  el.innerHTML = data.map((d, i) => {
    const pctW = Math.max((d.value / maxVal) * 100, 3);
    const displayVal = Number.isInteger(d.value) ? fmt(d.value) : d.value.toFixed(1);
    return `<div class="chart-bar-row" style="animation-delay: ${i * 30}ms">
      <div class="chart-bar-header">
        <span class="chart-bar-label" title="${d.label}">${d.label}</span>
        <span class="chart-bar-value">${displayVal}</span>
      </div>
      <div class="chart-bar-track">
        <div class="chart-bar-fill ${colorClass}" style="width: ${pctW}%"></div>
      </div>
    </div>`;
  }).join('');
}

function renderDonutChart(containerId, segments, centerValue, centerLabel) {
  const el = $(containerId);
  if (!el) return;
  const total = segments.reduce((s, seg) => s + seg.value, 0) || 1;

  // Build horizontal stacked bar segments
  const barSegs = segments.map((seg, i) => {
    const pctVal = (seg.value / total) * 100;
    if (pctVal <= 0) return '';
    const isFirst = i === 0;
    const isLast = i === segments.length - 1;
    const radius = segments.length === 1 ? '10px' : isFirst ? '10px 0 0 10px' : isLast ? '0 10px 10px 0' : '0';
    return `<div class="modern-bar-seg" style="width:${pctVal}%;background:${seg.color};border-radius:${radius};" title="${seg.label}: ${fmt(seg.value)} (${pctVal.toFixed(1)}%)"></div>`;
  }).join('');

  // Build legend items as clean metric rows
  const legend = segments.map(seg => {
    const pctVal = total > 0 ? ((seg.value / total) * 100) : 0;
    return `<div class="modern-legend-row">
      <div class="modern-legend-left">
        <div class="modern-legend-dot" style="background:${seg.color}"></div>
        <span class="modern-legend-label">${seg.label}</span>
      </div>
      <div class="modern-legend-right">
        <span class="modern-legend-value">${fmt(seg.value)}</span>
        <span class="modern-legend-pct">${pctVal.toFixed(1)}%</span>
      </div>
    </div>`;
  }).join('');

  el.innerHTML = `<div class="modern-proportion-chart">
    <div class="modern-bar-center">
      <div class="modern-center-value">${centerValue}</div>
      <div class="modern-center-label">${centerLabel}</div>
    </div>
    <div class="modern-bar-track">${barSegs}</div>
    <div class="modern-legend">${legend}</div>
  </div>`;
}

function renderStackedBarChart(containerId, data) {
  const el = $(containerId);
  if (!el) return;
  const maxVal = Math.max(...data.map(d => d.state + d.county), 1);
  el.innerHTML = data.map(d => {
    const total = d.state + d.county;
    const totalPctW = Math.max((total / maxVal) * 100, 4);
    const statePct = total > 0 ? (d.state / total) * 100 : 50;
    const countyPct = total > 0 ? (d.county / total) * 100 : 50;
    return `<div class="chart-bar-row">
      <div class="chart-bar-label" title="${d.label}">${d.label}</div>
      <div class="chart-stacked-track" style="width: ${totalPctW}%; flex: none;">
        <div class="chart-stacked-seg state" style="width: ${statePct}%">${d.state > 0 ? d.state : ''}</div>
        <div class="chart-stacked-seg county" style="width: ${countyPct}%">${d.county > 0 ? d.county : ''}</div>
      </div>
      <div class="chart-bar-value">${fmt(total)}</div>
    </div>`;
  }).join('');
}

// ─── Vertical Bar Chart (modern column style) ────────────────────
function renderVBarChart(containerId, data, colorClass) {
  const el = $(containerId);
  if (!el) return;
  if (!data.length) { el.innerHTML = '<div class="empty-state">No data available</div>'; return; }
  const maxVal = Math.max(...data.map(d => d.value), 1);
  const barHeight = 160; // px, matches CSS .vbar-chart-area height

  const bars = data.map((d, i) => {
    const pctH = Math.max((d.value / maxVal) * 100, 2);
    const displayVal = Number.isInteger(d.value) ? fmt(d.value) : d.value.toFixed(1);
    return `<div class="vbar-col" style="animation-delay: ${i * 30}ms">
      <div class="vbar-tooltip">${d.label}: ${displayVal}</div>
      <div class="vbar-bar ${colorClass}" style="height: ${pctH}%"></div>
    </div>`;
  }).join('');

  const labels = data.map((d, i) => {
    const short = d.label.length > 6 ? d.label.substring(0, 5) + '…' : d.label;
    return `<div class="vbar-label" title="${d.label}">${short}</div>`;
  }).join('');

  el.innerHTML = `<div class="vbar-chart">
    <div class="vbar-chart-area">${bars}</div>
    <div class="vbar-labels">${labels}</div>
  </div>`;
}

// ─── SVG Geometry Helpers ──────────────────────────────────────────
function polarToCartesian(cx, cy, r, angleDeg) {
  const rad = (angleDeg - 90) * Math.PI / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function describeArc(cx, cy, r, startAngle, endAngle) {
  if (endAngle - startAngle >= 359.99) {
    // Full circle — use two half-arcs
    const mid = polarToCartesian(cx, cy, r, startAngle + 180);
    const end = polarToCartesian(cx, cy, r, startAngle + 359.99);
    const start = polarToCartesian(cx, cy, r, startAngle);
    return `M ${start.x} ${start.y} A ${r} ${r} 0 1 1 ${mid.x} ${mid.y} A ${r} ${r} 0 1 1 ${end.x} ${end.y} Z`;
  }
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 0 ${end.x} ${end.y} L ${cx} ${cy} Z`;
}

// Color map for line/area charts (SVG stroke/fill colors per colorClass)
const SVG_COLORS = {
  gold:    { stroke: '#B85C38', fill: 'rgba(184, 92, 56, 0.12)' },
  danger:  { stroke: '#d45454', fill: 'rgba(212, 84, 84, 0.12)' },
  success: { stroke: '#2d8a56', fill: 'rgba(45, 138, 86, 0.12)' },
  teal:    { stroke: '#2a7d6e', fill: 'rgba(42, 125, 110, 0.12)' },
  purple:  { stroke: '#7b5ea7', fill: 'rgba(123, 94, 167, 0.12)' },
  blue:    { stroke: '#4a6fa5', fill: 'rgba(74, 111, 165, 0.12)' },
};

// ─── Pie Chart (SVG wedges) ───────────────────────────────────────
function renderPieChart(containerId, segments, centerValue, centerLabel) {
  const el = $(containerId);
  if (!el) return;
  const total = segments.reduce((s, seg) => s + seg.value, 0) || 1;
  const cx = 100, cy = 100, r = 88;
  let angle = 0;
  const gap = segments.length > 1 ? 1.5 : 0; // small gap between slices

  const paths = segments.map(seg => {
    const pctVal = seg.value / total;
    const sweep = Math.max(pctVal * 360 - gap, 0.5);
    if (sweep <= 0) return '';
    const path = describeArc(cx, cy, r, angle + gap / 2, angle + sweep);
    // Label at midpoint of arc
    const midAngle = angle + (pctVal * 360) / 2;
    const labelPos = polarToCartesian(cx, cy, r * 0.58, midAngle);
    const showLabel = pctVal >= 0.06;
    const label = showLabel
      ? `<text x="${labelPos.x}" y="${labelPos.y}" class="svg-pie-label">${(pctVal * 100).toFixed(0)}%</text>`
      : '';
    angle += pctVal * 360;
    return `<path d="${path}" fill="${seg.color}" class="svg-pie-wedge"><title>${seg.label}: ${fmt(seg.value)} (${(pctVal * 100).toFixed(1)}%)</title></path>${label}`;
  }).join('');

  const legend = segments.map(seg => {
    const pctVal = total > 0 ? ((seg.value / total) * 100) : 0;
    return `<div class="modern-legend-row">
      <div class="modern-legend-left">
        <div class="modern-legend-dot" style="background:${seg.color}"></div>
        <span class="modern-legend-label">${seg.label}</span>
      </div>
      <div class="modern-legend-right">
        <span class="modern-legend-value">${fmt(seg.value)}</span>
        <span class="modern-legend-pct">${pctVal.toFixed(1)}%</span>
      </div>
    </div>`;
  }).join('');

  el.innerHTML = `<div class="svg-chart-container">
    <svg class="svg-pie-svg" viewBox="0 0 200 200">${paths}</svg>
    <div class="modern-legend">${legend}</div>
  </div>`;
}

// ─── Donut Ring Chart (SVG stroke-dasharray) ──────────────────────
function renderSvgDonutChart(containerId, segments, centerValue, centerLabel) {
  const el = $(containerId);
  if (!el) return;
  const total = segments.reduce((s, seg) => s + seg.value, 0) || 1;
  const cx = 100, cy = 100, r = 72, strokeW = 24;
  const circumference = 2 * Math.PI * r;
  let offset = 0;
  const gapLen = segments.length > 1 ? 5 : 0;

  const circles = segments.map(seg => {
    const pctVal = seg.value / total;
    const dashLen = Math.max(pctVal * circumference - gapLen, 0);
    const circle = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${seg.color}" stroke-width="${strokeW}"
      stroke-dasharray="${dashLen} ${circumference}" stroke-dashoffset="${-offset}" stroke-linecap="round"
      class="svg-donut-segment"><title>${seg.label}: ${fmt(seg.value)} (${(pctVal * 100).toFixed(1)}%)</title></circle>`;
    offset += pctVal * circumference;
    return circle;
  }).join('');

  const legend = segments.map(seg => {
    const pctVal = total > 0 ? ((seg.value / total) * 100) : 0;
    return `<div class="modern-legend-row">
      <div class="modern-legend-left">
        <div class="modern-legend-dot" style="background:${seg.color}"></div>
        <span class="modern-legend-label">${seg.label}</span>
      </div>
      <div class="modern-legend-right">
        <span class="modern-legend-value">${fmt(seg.value)}</span>
        <span class="modern-legend-pct">${pctVal.toFixed(1)}%</span>
      </div>
    </div>`;
  }).join('');

  el.innerHTML = `<div class="svg-chart-container">
    <div class="svg-donut-wrap">
      <svg viewBox="0 0 200 200" style="transform: rotate(-90deg)">
        <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="var(--bg-light, #f0eeeb)" stroke-width="${strokeW}"/>
        ${circles}
      </svg>
      <div class="svg-donut-center">
        <div class="svg-donut-value">${centerValue}</div>
        <div class="svg-donut-label">${centerLabel}</div>
      </div>
    </div>
    <div class="modern-legend">${legend}</div>
  </div>`;
}

// ─── Line Chart (SVG polyline + area fill) ────────────────────────
function renderLineChart(containerId, data, colorClass) {
  const el = $(containerId);
  if (!el) return;
  if (!data.length) { el.innerHTML = '<div class="empty-state">No data available</div>'; return; }

  const colors = SVG_COLORS[colorClass] || SVG_COLORS.gold;
  const pad = { top: 24, right: 16, bottom: 44, left: 8 };
  const w = 400, h = 200;
  const plotW = w - pad.left - pad.right;
  const plotH = h - pad.top - pad.bottom;

  const maxVal = Math.max(...data.map(d => d.value), 1);
  const minVal = Math.min(...data.map(d => d.value), 0);
  const range = maxVal - minVal || 1;

  // Map data to coordinates
  const points = data.map((d, i) => {
    const x = pad.left + (data.length > 1 ? (i / (data.length - 1)) * plotW : plotW / 2);
    const y = pad.top + plotH - ((d.value - minVal) / range) * plotH;
    return { x, y, ...d };
  });

  const polyline = points.map(p => `${p.x},${p.y}`).join(' ');

  // Area fill polygon (line + bottom edge)
  const areaPath = `${points.map(p => `${p.x},${p.y}`).join(' ')} ${points[points.length - 1].x},${pad.top + plotH} ${points[0].x},${pad.top + plotH}`;

  // Grid lines — solid, subtle (matching reference)
  const gridLines = [0, 0.25, 0.5, 0.75, 1].map(pct => {
    const y = pad.top + plotH - pct * plotH;
    const val = minVal + pct * range;
    const displayVal = Number.isInteger(val) ? fmt(Math.round(val)) : val.toFixed(1);
    return `<line x1="${pad.left}" y1="${y}" x2="${pad.left + plotW}" y2="${y}" class="svg-line-grid"/>
      <text x="${pad.left - 4}" y="${y + 3}" class="svg-line-yval">${displayVal}</text>`;
  }).join('');

  // Data point circles with tooltip group
  const dots = points.map(p => {
    const displayVal = Number.isInteger(p.value) ? fmt(p.value) : p.value.toFixed(1);
    return `<g class="svg-line-dot-group">
      <circle cx="${p.x}" cy="${p.y}" r="4" fill="white" stroke="${colors.stroke}" stroke-width="2.5" class="svg-line-dot"><title>${p.label}: ${displayVal}</title></circle>
    </g>`;
  }).join('');

  // X-axis labels (abbreviated, every Nth if too many)
  const maxLabels = 10;
  const step = Math.max(1, Math.ceil(data.length / maxLabels));
  const xLabels = points.map((p, i) => {
    if (i % step !== 0 && i !== points.length - 1) return '';
    const short = p.label.length > 8 ? p.label.substring(0, 7) + '…' : p.label;
    return `<text x="${p.x}" y="${pad.top + plotH + 18}" class="svg-line-xlabel" transform="rotate(-30 ${p.x} ${pad.top + plotH + 18})">${short}</text>`;
  }).join('');

  // SVG gradient for area fill
  const gradId = 'lineGrad_' + containerId;
  const areaGradient = `<defs>
    <linearGradient id="${gradId}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${colors.stroke}" stop-opacity="0.15"/>
      <stop offset="100%" stop-color="${colors.stroke}" stop-opacity="0.01"/>
    </linearGradient>
  </defs>`;

  el.innerHTML = `<div class="svg-line-wrap">
    <svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid meet">
      ${areaGradient}
      ${gridLines}
      <polygon points="${areaPath}" fill="url(#${gradId})"/>
      <polyline points="${polyline}" fill="none" stroke="${colors.stroke}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="svg-line-path"/>
      ${dots}
      ${xLabels}
    </svg>
  </div>`;
}

// ─── KPI Card Renderer ──────────────────────────────────────────────
function renderKpiCard(containerId, value, label, subtitle, iconName, format, editCallback, deltaHtml) {
  const el = $(containerId);
  if (!el) return;
  const iconSvg = KPI_ICONS[iconName] || KPI_ICONS.folder;
  el.innerHTML = `<div class="kpi-card-dynamic">
    <div class="kpi-icon-dynamic">${iconSvg}</div>
    <div class="kpi-value-dynamic${editCallback ? ' editable-value' : ''}" title="${editCallback ? 'Click to edit' : ''}">${value}</div>
    <div class="kpi-label-dynamic">${label}</div>
    ${deltaHtml ? `<div class="kpi-delta-wrap">${deltaHtml}</div>` : ''}
    ${subtitle ? `<div class="kpi-subtitle-dynamic">${subtitle}</div>` : ''}
  </div>`;
  // Wire inline editing if callback provided
  if (editCallback) {
    const valueEl = el.querySelector('.kpi-value-dynamic');
    if (valueEl) {
      valueEl.addEventListener('click', (e) => {
        e.stopPropagation();
        if (valueEl.querySelector('input')) return; // already editing
        const currentText = valueEl.textContent.trim();
        // Strip formatting (commas, %) to get raw number
        const raw = currentText.replace(/,/g, '').replace(/%$/, '');
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'inline-value-input';
        input.value = raw;
        valueEl.textContent = '';
        valueEl.appendChild(input);
        input.focus();
        input.select();

        const commit = () => {
          const newVal = input.value.trim();
          if (newVal === '' || newVal === raw) {
            // Cancel — re-render
            editCallback(null);
            return;
          }
          const num = parseFloat(newVal);
          if (isNaN(num)) {
            editCallback(null);
            return;
          }
          editCallback(num);
        };
        input.addEventListener('blur', commit);
        input.addEventListener('keydown', (ev) => {
          if (ev.key === 'Enter') { ev.preventDefault(); input.blur(); }
          if (ev.key === 'Escape') { editCallback(null); }
        });
      });
    }
  }
}

function renderCharts() {
  // Delegate to the dynamic chart engine (chart-engine.js)
  if (typeof chartEngine !== 'undefined' && chartEngine.layout) {
    chartEngine.render();
  }
}

// ─── View Switching ──────────────────────────────────────────────────

function hideAllViews() {
  $("viewDashboard").classList.add("hidden");
  $("viewCircuits").classList.remove("active");
  $("viewMap").classList.remove("active");
  $("viewUpload").classList.remove("active");
  ["tabDashboard", "tabCircuits", "tabMap"].forEach(id => {
    const el = $(id);
    if (el) el.classList.remove("active");
  });
  $("tabUpload").classList.remove("active-upload");
  // Close any open dropdowns
  document.querySelectorAll('.header-dropdown.open').forEach(d => d.classList.remove('open'));
  // Hide export bar when switching views
  const exportBar = $("exportBar");
  if (exportBar) exportBar.style.display = 'none';
}

function showDashboardView() {
  hideAllViews();
  $("viewDashboard").classList.remove("hidden");
  $("tabDashboard").classList.add("active");
  renderCharts();
  // Re-show empty state if no data has been uploaded
  if (!__hasData) showEmptyState(true);
}

function showCircuitsView() {
  hideAllViews();
  $("viewCircuits").classList.add("active");
  $("tabCircuits").classList.add("active");
}

function showMapView() {
  hideAllViews();
  $("viewMap").classList.add("active");
  $("tabMap").classList.add("active");
  // Re-color with the latest data/filter each time the map is opened.
  renderGAChoropleth();
}

function showUploadView() {
  hideAllViews();
  $("viewUpload").classList.add("active");
  $("tabUpload").classList.add("active-upload");
}

// Customize dropdown now managed via chart engine's _updateCustomizeDropdown()

// Init calls and event listeners moved to app.js
