// Generate realistic demo spreadsheets for all 45 GPDC circuits.
// Run:  node demo/make-demo.mjs   (from the gpdc-dashboard folder)
import * as XLSX from 'xlsx';
import { fileURLToPath } from 'node:url';

const CIRCUITS = [
  'Alapaha','Alcovy','Appalachian','Atlanta','Atlantic','Augusta','Brunswick',
  'Chattahoochee','Cherokee','Clayton','Conasauga','Columbia','Cordele','Coweta',
  'Dekalb','Dougherty','Dublin','Eastern','Enotah','Flint','Griffin',
  'Lookout Mountain','Macon','Middle Georgia','Mountain','Northeastern','Northern',
  'Ocmulgee','Oconee','Ogeechee','Pataula','Paulding','Piedmont','Rockdale',
  'Rome','South Georgia','Southern','Southwestern','Tallapoosa','Tifton','Toombs',
  'Towaliga','Waycross','West Georgia','Western',
];

// Rough relative size (attorneys). Big metros high; rural low. Default 8.
const SIZE = {
  Atlanta: 52, Dekalb: 34, Clayton: 22, Eastern: 24, Augusta: 20, Macon: 18,
  Cherokee: 16, Northeastern: 16, Coweta: 15, Piedmont: 15, Dougherty: 14,
  Griffin: 13, Rome: 12, Brunswick: 12, Ocmulgee: 12, Western: 12, Flint: 11,
  Rockdale: 9, Paulding: 9, Tallapoosa: 8, 'Middle Georgia': 9, Southern: 11,
  Atlantic: 10, Conasauga: 10, 'Lookout Mountain': 9, Mountain: 7, Cordele: 7,
};

function circuitBase(name, i) {
  const filled = SIZE[name] || (5 + ((i * 3) % 9)); // 5–13 default
  // Spread caseload so the Scorecard shows a real over/under mix (≈95–205).
  const caseload = 95 + ((i * 23) % 110);
  const total = Math.round(filled * caseload);
  const newCases = Math.round(total * 0.32);
  return { filled, total, newCases };
}

const FIELDS = [
  ['Circuit', (r) => r.name],
  ['Total Cases', (r) => r.total],
  ['New Cases', (r) => r.newCases],
  ['Rollover Cases', (r) => r.total - r.newCases],
  ['Closed Cases', (r) => Math.round(r.newCases * 0.88)],
  ['State Attorneys (Filled)', (r) => r.filled],
  ['State Attorneys (Vacant)', (r) => r.vacant],
  ['County Attorneys', (r) => r.county],
  ['New Conflict Cases', (r) => Math.round(r.total * 0.08)],
  ['Rollover Conflict Cases', (r) => Math.round(r.total * 0.04)],
  ['Total Contractors', (r) => Math.max(1, Math.round(r.filled * 0.15))],
  ['Capital Cases', (r) => Math.max(0, Math.round(r.filled * 0.08))],
  ['Felony Cases', (r) => Math.round(r.total * 0.42)],
  ['Misdemeanor Cases', (r) => Math.round(r.total * 0.40)],
  ['Juvenile Cases', (r) => Math.round(r.total * 0.10)],
  ['Appeals', (r) => Math.round(r.total * 0.02)],
  ['Probation Cases', (r) => Math.round(r.total * 0.05)],
  ['Investigators', (r) => Math.max(1, Math.round(r.filled / 3))],
  ['Social Workers', (r) => Math.max(0, Math.round(r.filled / 6))],
  ['Paralegals', (r) => Math.max(1, Math.round(r.filled / 2.5))],
  ['Annual Budget', (r) => r.budget],
  ['Actual Spend', (r) => r.spend],
];

function buildRows(yearScale) {
  return CIRCUITS.map((name, i) => {
    const b = circuitBase(name, i);
    const filled = Math.max(3, Math.round(b.filled * yearScale.staff));
    const total = Math.round(b.total * yearScale.cases);
    const newCases = Math.round(b.newCases * yearScale.cases);
    const vacant = Math.round(filled * (0.05 + (i % 5) * 0.02));
    const county = Math.round(filled * 0.2);
    const positions = filled + vacant;
    const budget = positions * 150000 + county * 90000;
    const spend = Math.round(budget * (0.9 + (i % 7) * 0.015));
    return { name, filled, vacant, county, total, newCases, budget: Math.round(budget * yearScale.money), spend: Math.round(spend * yearScale.money) };
  });
}

function sheet(rows, cols) {
  const header = cols.map((c) => c[0]);
  const data = [header, ...rows.map((r) => cols.map((c) => c[1](r)))];
  const ws = XLSX.utils.aoa_to_sheet(data);
  ws['!cols'] = header.map((h) => ({ wch: Math.max(h.length + 2, 12) }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Circuit Data');
  return wb;
}

function write(wb, name) {
  XLSX.writeFile(wb, fileURLToPath(new URL('./' + name, import.meta.url)));
  console.log('wrote demo/' + name);
}

const fy25 = buildRows({ cases: 1, staff: 1, money: 1 });
const fy24 = buildRows({ cases: 0.92, staff: 0.97, money: 0.95 });

const pick = (...labels) => FIELDS.filter((f) => f[0] === 'Circuit' || labels.includes(f[0]));

// Full datasets (everything) for FY25 and FY24
write(sheet(fy25, FIELDS), 'GPDC_FY2025_All_Circuits.xlsx');
write(sheet(fy24, FIELDS), 'GPDC_FY2024_All_Circuits.xlsx');
// Partial slices (to demo merge: each only touches its own fields)
write(sheet(fy25, pick('Annual Budget', 'Actual Spend')), 'GPDC_Finance_Budget_FY2025.xlsx');
write(sheet(fy25, pick('State Attorneys (Filled)', 'State Attorneys (Vacant)', 'Investigators', 'Social Workers', 'Paralegals')), 'GPDC_Staffing_FY2025.xlsx');
