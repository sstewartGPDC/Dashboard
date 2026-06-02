// Generate two sample .xlsx files (FY24, FY25) with different numbers so
// year-over-year separation is visible in the POC verification.
import * as XLSX from 'xlsx';
import { fileURLToPath } from 'node:url';

const HEADERS = ['Circuit','Total Cases','New Cases','Rollover Cases','Closed Cases','State Attorneys (Filled)','State Attorneys (Vacant)','County Attorneys','New Conflict Cases','Rollover Conflict Cases','Total Contractors'];

function write(name, scale) {
  const rows = [
    HEADERS,
    ['Atlanta', 4200*scale|0, 1100*scale|0, 3100*scale|0, 850*scale|0, 45, 5, 12, 380, 200, 8],
    ['Augusta', 1800*scale|0, 520*scale|0, 1280*scale|0, 410*scale|0, 18, 2, 6, 140, 80, 4],
    ['Macon',   900*scale|0,  300*scale|0, 600*scale|0,  250*scale|0, 10, 1, 3, 70,  40,  2],
  ];
  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Circuit Data');
  XLSX.writeFile(wb, fileURLToPath(new URL(name, import.meta.url)));
  console.log('wrote', name);
}

write('./fy24.xlsx', 1.0);   // FY24 baseline
write('./fy25.xlsx', 1.12);  // FY25: ~12% higher caseload
