const XLSX = require('xlsx');

// Default column mappings (matches the original dashboard's Excel parser)
const DEFAULT_MAPPINGS = {
  circuit: ['Circuit', 'circuit'],
  total_cases: ['Total Cases', 'total_cases'],
  rollover_cases: ['Rollover Cases', 'Rolleover Cases', 'rollover_cases'],
  new_cases: ['New Cases', 'new_cases'],
  closed_cases: ['Closed Cases', 'closed_cases'],
  state_attorneys_filled: ['State Attorneys (Filled)', 'state_attorneys_filled'],
  state_attorneys_vacant: ['State Attorneys (Vacant)', 'state_attorneys_vacant'],
  county_attorneys: ['County Attorneys', 'county_attorneys'],
  conflict_new_cases: ['New Conflict Cases', 'Conflict New Cases', 'conflict_new_cases'],
  conflict_rollover_cases: ['Rollover Conflict Cases', 'rollover_conflict_cases'],
  total_contractors: ['Total C2 Contractors', 'Total Contractors (CP and C3)', 'total_contractors']
};

/**
 * Get the value of a field from a row using a column mapping.
 * Tries the custom mapping first, then the default aliases.
 */
function getField(row, fieldName, customMapping) {
  // If custom mapping provides a column name for this field, try it first
  if (customMapping && customMapping[fieldName]) {
    const val = row[customMapping[fieldName]];
    if (val !== undefined && val !== null && val !== '') return val;
  }
  // Fall back to default column name aliases
  const aliases = DEFAULT_MAPPINGS[fieldName] || [];
  for (const alias of aliases) {
    if (row[alias] !== undefined && row[alias] !== null && row[alias] !== '') return row[alias];
  }
  return null;
}

/**
 * Parse an Excel file buffer and return circuit data rows.
 * @param {Buffer} fileBuffer - The Excel file contents
 * @param {Object} customMapping - Optional: { fieldName: "User's Column Name", ... }
 * @returns {{ rows: Array, headers: string[], sheetName: string }}
 */
function parseExcelBuffer(fileBuffer, customMapping = {}) {
  const workbook = XLSX.read(fileBuffer, { type: 'buffer' });

  // Find a sheet with "circuit" in name, or use first
  let sheetName = workbook.SheetNames.find(n => /circuit/i.test(n)) || workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const jsonRows = XLSX.utils.sheet_to_json(sheet);

  if (!jsonRows.length) {
    return { rows: [], headers: [], sheetName };
  }

  const headers = Object.keys(jsonRows[0]);
  const rows = [];

  for (const row of jsonRows) {
    const circuit = String(getField(row, 'circuit', customMapping) || '').trim();
    if (!circuit) continue;

    const rolloverCases = parseInt(getField(row, 'rollover_cases', customMapping)) || 0;
    const newCases = parseInt(getField(row, 'new_cases', customMapping)) || 0;
    const totalCasesRaw = parseInt(getField(row, 'total_cases', customMapping)) || 0;
    const totalCases = totalCasesRaw > 0 ? totalCasesRaw : rolloverCases + newCases;
    const closedCases = parseInt(getField(row, 'closed_cases', customMapping)) || 0;

    let stateFilled = parseInt(getField(row, 'state_attorneys_filled', customMapping)) || 0;
    let stateVacant = parseInt(getField(row, 'state_attorneys_vacant', customMapping)) || 0;

    // Handle vacancy rate if vacant count is 0 but rate is provided
    if (stateVacant === 0 && stateFilled > 0) {
      const vacRateStr = getField(row, 'state_vacancy_rate', customMapping);
      if (vacRateStr) {
        let vacRate = parseFloat(vacRateStr);
        if (vacRate > 1) vacRate = vacRate / 100;
        stateVacant = Math.round(stateFilled * vacRate / (1 - vacRate));
      }
    }

    const countyAttorneys = parseInt(getField(row, 'county_attorneys', customMapping)) || 0;
    const conflictNewCases = parseInt(getField(row, 'conflict_new_cases', customMapping)) || 0;
    const conflictRolloverCases = parseInt(getField(row, 'conflict_rollover_cases', customMapping)) || 0;
    const totalContractors = parseInt(getField(row, 'total_contractors', customMapping)) || 0;

    rows.push({
      circuit,
      total_cases: totalCases,
      new_cases: newCases,
      rollover_cases: rolloverCases,
      closed_cases: closedCases,
      state_attorneys_filled: stateFilled,
      state_attorneys_vacant: stateVacant,
      county_attorneys: countyAttorneys,
      conflict_new_cases: conflictNewCases,
      conflict_rollover_cases: conflictRolloverCases,
      total_contractors: totalContractors
    });
  }

  return { rows, headers, sheetName };
}

/**
 * Get just the headers from an Excel file (for column mapping preview).
 */
function getExcelHeaders(fileBuffer) {
  const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
  let sheetName = workbook.SheetNames.find(n => /circuit/i.test(n)) || workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const jsonRows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
  const headers = jsonRows.length > 0 ? jsonRows[0].map(h => String(h || '').trim()).filter(Boolean) : [];
  return { headers, sheetName, sheetNames: workbook.SheetNames };
}

module.exports = { parseExcelBuffer, getExcelHeaders, DEFAULT_MAPPINGS };
