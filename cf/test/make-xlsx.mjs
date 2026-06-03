// Generate two sample .xlsx files (FY24, FY25) including the expanded metrics
// (case types, support staff, financials) so weighted caseload can be verified.
import * as XLSX from 'xlsx';
import { fileURLToPath } from 'node:url';

const HEADERS = ['Circuit','Total Cases','New Cases','Rollover Cases','Closed Cases',
  'State Attorneys (Filled)','State Attorneys (Vacant)','County Attorneys',
  'New Conflict Cases','Rollover Conflict Cases','Total Contractors',
  'Capital Cases','Felony Cases','Misdemeanor Cases','Juvenile Cases','Appeals','Probation Cases',
  'Investigators','Social Workers','Paralegals','Annual Budget','Actual Spend'];

// [total,new,roll,closed, filled,vac,county, cNew,cRoll,contractors,
//  capital,felony,misd,juv,appeals,prob, inv,social,para, budget,spend]
const BASE = {
  Atlanta: [4200,1100,3100,850, 45,5,12, 380,200,8, 6,1800,1900,420,80,1000, 12,6,18, 9500000,9200000],
  Augusta: [1800,520,1280,410, 18,2,6, 140,80,4, 2,760,820,160,30,420, 5,2,7, 4100000,3950000],
  Macon:   [900,300,600,250, 10,1,3, 70,40,2, 1,380,410,90,15,210, 3,1,4, 2100000,2050000],
};

function write(name, caseScale) {
  const rows = [HEADERS];
  for (const [circuit, v] of Object.entries(BASE)) {
    // Scale case counts (incl. case types) by caseScale; keep staff/budget steady.
    const scaledCases = v.map((x, i) => {
      const isCaseCol = (i >= 0 && i <= 4) || (i >= 7 && i <= 9) || (i >= 10 && i <= 16);
      const isStaffOrMoney = (i >= 5 && i <= 6) || (i >= 17);
      return isStaffOrMoney ? x : Math.round(x * caseScale);
    });
    rows.push([circuit, ...scaledCases]);
  }
  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Circuit Data');
  XLSX.writeFile(wb, fileURLToPath(new URL(name, import.meta.url)));
  console.log('wrote', name);
}

write('./fy24.xlsx', 1.0);
write('./fy25.xlsx', 1.12);
