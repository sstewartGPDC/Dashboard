/**
 * Excel template generation — ported from routes/data.js.
 * Uses XLSX.write(..., { type: 'array' }) to return a Uint8Array (Workers-safe).
 */
import * as XLSX from 'xlsx';

export const CIRCUITS = [
  'Alapaha','Alcovy','Appalachian','Atlanta','Atlantic','Augusta','Brunswick',
  'Chattahoochee','Cherokee','Clayton','Conasauga','Columbia','Cordele','Coweta',
  'Dekalb','Dougherty','Dublin','Eastern','Enotah','Flint','Griffin',
  'Lookout Mountain','Macon','Middle Georgia','Mountain','Northeastern','Northern',
  'Ocmulgee','Oconee','Ogeechee','Pataula','Paulding','Piedmont','Rockdale',
  'Rome','South Georgia','Southern','Southwestern','Tallapoosa','Tifton','Toombs',
  'Towaliga','Waycross','West Georgia','Western',
];

const EXAMPLE = {
  'Total Cases': [4200, 1800],
  'New Cases': [1100, 520],
  'Closed Cases': [850, 410],
  'State Attorneys (Filled)': [45, 18],
  'State Attorneys (Vacant)': [5, 2],
  'County Attorneys': [12, 6],
  'New Conflict Cases': [380, 140],
  'Total Contractors': [8, 4],
};

const FIELD_TO_COLUMNS = {
  totalCases: ['Total Cases'],
  newCases: ['New Cases'],
  closed: ['Closed Cases'],
  stateFilled: ['State Attorneys (Filled)'],
  stateVacant: ['State Attorneys (Vacant)'],
  countyAttorneys: ['County Attorneys'],
  conflictNew: ['New Conflict Cases'],
  conflictContractors: ['Total Contractors'],
  totalAttorneys: ['State Attorneys (Filled)', 'County Attorneys'],
  caseload: ['Total Cases', 'State Attorneys (Filled)', 'County Attorneys'],
  vacancyRate: ['State Attorneys (Filled)', 'State Attorneys (Vacant)'],
  activeRemaining: ['Total Cases', 'New Cases'],
};

function toBytes(wb) {
  return XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
}

export function buildFullTemplate() {
  const headers = ['Circuit','Total Cases','New Cases','Rollover Cases','Closed Cases',
    'State Attorneys (Filled)','State Attorneys (Vacant)','County Attorneys',
    'New Conflict Cases','Rollover Conflict Cases','Total Contractors',
    'Capital Cases','Felony Cases','Misdemeanor Cases','Juvenile Cases','Appeals','Probation Cases',
    'Investigators','Social Workers','Paralegals','Annual Budget','Actual Spend'];

  const dataRows = [headers];
  dataRows.push(['Atlanta', 4200, 1100, 3100, 850, 45, 5, 12, 380, 200, 8, 6, 1800, 1900, 420, 80, 1000, 12, 6, 18, 9500000, 9200000]);
  dataRows.push(['Augusta', 1800, 520, 1280, 410, 18, 2, 6, 140, 80, 4, 2, 760, 820, 160, 30, 420, 5, 2, 7, 4100000, 3950000]);
  CIRCUITS.forEach((c) => {
    if (c !== 'Atlanta' && c !== 'Augusta') dataRows.push([c, ...Array(headers.length - 1).fill('')]);
  });

  const ws1 = XLSX.utils.aoa_to_sheet(dataRows);
  ws1['!cols'] = headers.map((h) => ({ wch: Math.max(h.length + 3, 12) }));

  const guideRows = [
    ['Column Name', 'Description', 'Required?', 'Example Values'],
    ['Circuit', 'Name of the judicial circuit', 'YES', 'Atlanta, Augusta, Alapaha'],
    ['Total Cases', 'Total active cases in the circuit', 'No', '4200, 1800'],
    ['New Cases', 'Cases opened during this reporting period', 'No', '1100, 520'],
    ['Rollover Cases', 'Cases carried over from the prior period', 'No', '3100, 1280'],
    ['Closed Cases', 'Cases resolved during this reporting period', 'No', '850, 410'],
    ['State Attorneys (Filled)', 'GPDC state-funded attorney positions that are filled', 'No', '45, 18'],
    ['State Attorneys (Vacant)', 'GPDC state-funded attorney positions that are vacant', 'No', '5, 2'],
    ['County Attorneys', 'County-funded attorney count (non-GPDC)', 'No', '12, 6'],
    ['New Conflict Cases', 'New cases assigned to the Conflict Division', 'No', '380, 140'],
    ['Rollover Conflict Cases', 'Conflict Division cases from prior period', 'No', '200, 80'],
    ['Total Contractors', 'Contract attorneys (CP and C3)', 'No', '8, 4'],
    [],
    ['CASE TYPES — used for weighted caseload vs. standard'],
    ['Capital Cases', 'Death-penalty cases (highest weight)', 'No', '6, 2'],
    ['Felony Cases', 'Felony cases', 'No', '1800, 760'],
    ['Misdemeanor Cases', 'Misdemeanor cases', 'No', '1900, 820'],
    ['Juvenile Cases', 'Juvenile delinquency cases', 'No', '420, 160'],
    ['Appeals', 'Appellate cases', 'No', '80, 30'],
    ['Probation Cases', 'Probation / revocation cases', 'No', '1000, 420'],
    [],
    ['SUPPORT STAFF'],
    ['Investigators', 'Investigator FTEs', 'No', '12, 5'],
    ['Social Workers', 'Social workers / mitigation specialists', 'No', '6, 2'],
    ['Paralegals', 'Paralegal FTEs', 'No', '18, 7'],
    [],
    ['FINANCIALS'],
    ['Annual Budget', 'Annual budget for the circuit (dollars)', 'No', '9500000'],
    ['Actual Spend', 'Actual expenditures (dollars)', 'No', '9200000'],
    [],
    ['NOTES'],
    ['Only the "Circuit" column is required. Include whichever columns are relevant to your team.'],
    ['Column names do not need to match exactly — the dashboard will let you map them during upload.'],
    ['You can rename, reorder, or remove any optional columns.'],
    ['Case-type columns enable weighted caseload; support-staff and financial columns enable staffing ratios and cost-per-case.'],
  ];
  const ws2 = XLSX.utils.aoa_to_sheet(guideRows);
  ws2['!cols'] = [{ wch: 28 }, { wch: 52 }, { wch: 12 }, { wch: 28 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws1, 'Circuit Data');
  XLSX.utils.book_append_sheet(wb, ws2, 'Column Guide');
  return toBytes(wb);
}

/** Returns Uint8Array, or null if no recognized fields (caller should fall back). */
export function buildDashboardTemplate(fieldKeys) {
  const seen = new Set(['Circuit']);
  const columns = ['Circuit'];
  for (const key of fieldKeys) {
    for (const col of FIELD_TO_COLUMNS[key] || []) {
      if (!seen.has(col)) { seen.add(col); columns.push(col); }
    }
  }
  if (columns.length <= 1) return null;

  const dataRows = [columns];
  for (let i = 0; i < 2; i++) {
    const name = i === 0 ? 'Atlanta' : 'Augusta';
    dataRows.push(columns.map((col) => (col === 'Circuit' ? name : (EXAMPLE[col] ? EXAMPLE[col][i] : ''))));
  }
  CIRCUITS.forEach((c) => {
    if (c !== 'Atlanta' && c !== 'Augusta') dataRows.push(columns.map((col) => (col === 'Circuit' ? c : '')));
  });

  const ws = XLSX.utils.aoa_to_sheet(dataRows);
  ws['!cols'] = columns.map((col) => ({ wch: Math.max(col.length + 4, 14) }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Circuit Data');
  return toBytes(wb);
}

// Field key → spreadsheet column label (mirrors the parser's primary aliases).
const FIELD_LABEL = {
  total_cases: 'Total Cases', new_cases: 'New Cases', rollover_cases: 'Rollover Cases', closed_cases: 'Closed Cases', custody_rate: 'Custody Rate (%)',
  state_attorneys_filled: 'State Attorneys (Filled)', state_attorneys_vacant: 'State Attorneys (Vacant)', county_attorneys: 'County Attorneys',
  conflict_total_cases: 'Total Conflict Cases', conflict_new_cases: 'New Conflict Cases', conflict_rollover_cases: 'Rollover Conflict Cases', conflict_closed_cases: 'Closed Conflict Cases', conflict_rate: 'Conflict Rate (%)', total_contractors: 'Total Contractors',
  capital_cases: 'Capital Cases', felony_cases: 'Felony Cases', misdemeanor_cases: 'Misdemeanor Cases', juvenile_cases: 'Juvenile Cases', appeals_cases: 'Appeals', probation_cases: 'Probation Cases',
  investigators: 'Investigators', social_workers: 'Social Workers', paralegals: 'Paralegals', annual_budget: 'Annual Budget', actual_spend: 'Actual Spend',
};

// Build a template Excel for a specific set of metric fields (a collection
// template): Circuit column + the chosen fields + all 45 circuits pre-listed.
export function buildFieldsTemplate(fields) {
  const cols = ['Circuit', ...fields.map((f) => FIELD_LABEL[f]).filter(Boolean)];
  const dataRows = [cols];
  CIRCUITS.forEach((c) => dataRows.push([c, ...Array(cols.length - 1).fill('')]));
  const ws = XLSX.utils.aoa_to_sheet(dataRows);
  ws['!cols'] = cols.map((c) => ({ wch: Math.max(c.length + 3, 12) }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Circuit Data');
  return toBytes(wb);
}
