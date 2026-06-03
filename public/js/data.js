const CIRCUITS = [
  { circuit:"Alapaha", counties:["Atkinson","Berrien","Clinch","Cook","Lanier"] },
  { circuit:"Alcovy", counties:["Newton","Walton"] },
  { circuit:"Appalachian", counties:["Fannin","Gilmer","Pickens"] },
  { circuit:"Atlanta", counties:["Fulton"] },
  { circuit:"Atlantic", counties:["Bryan","Evans","Liberty","Long","McIntosh","Tattnall"] },
  { circuit:"Augusta", counties:["Burke","Richmond"] },
  { circuit:"Brunswick", counties:["Appling","Camden","Glynn","Jeff Davis","Wayne"] },
  { circuit:"Chattahoochee", counties:["Chattahoochee","Harris","Marion","Muscogee","Talbot","Taylor"] },
  { circuit:"Cherokee", counties:["Bartow","Gordon"] },
  { circuit:"Clayton", counties:["Clayton"] },
  { circuit:"Conasauga", counties:["Columbia"] },
  { circuit:"Columbia", counties:["Murray","Whitfield"] },
  { circuit:"Cordele", counties:["Ben Hill","Crisp","Dooly","Wilcox"] },
  { circuit:"Coweta", counties:["Coweta","Meriwether","Troup"] },
  { circuit:"Dekalb", counties:["DeKalb"] },
  { circuit:"Dougherty", counties:["Dougherty"] },
  { circuit:"Dublin", counties:["Johnson","Laurens","Treutlen","Twiggs"] },
  { circuit:"Eastern", counties:["Chatham"] },
  { circuit:"Enotah", counties:["Lumpkin","Towns","Union","White"] },
  { circuit:"Flint", counties:["Henry"] },
  { circuit:"Griffin", counties:["Fayette","Pike","Spalding","Upson"] },
  { circuit:"Lookout Mountain", counties:["Catoosa","Chattooga","Dade","Walker"] },
  { circuit:"Macon", counties:["Bibb","Crawford","Peach"] },
  { circuit:"Middle Georgia", counties:["Candler","Emanuel","Jefferson","Toombs","Washington"] },
  { circuit:"Mountain", counties:["Habersham","Rabun","Stephens"] },
  { circuit:"Northeastern", counties:["Dawson","Hall"] },
  { circuit:"Northern", counties:["Elbert","Franklin","Hart","Madison","Oglethorpe"] },
  { circuit:"Ocmulgee", counties:["Baldwin","Greene","Hancock","Jasper","Jones","Morgan","Putnam","Wilkinson"] },
  { circuit:"Oconee", counties:["Bleckley","Dodge","Montgomery","Pulaski","Telfair","Wheeler"] },
  { circuit:"Ogeechee", counties:["Bulloch","Effingham","Jenkins","Screven"] },
  { circuit:"Pataula", counties:["Clay","Early","Miller","Quitman","Randolph","Seminole","Terrell"] },
  { circuit:"Paulding", counties:["Paulding"] },
  { circuit:"Piedmont", counties:["Banks","Barrow","Jackson"] },
  { circuit:"Rockdale", counties:["Rockdale"] },
  { circuit:"Rome", counties:["Floyd"] },
  { circuit:"South Georgia", counties:["Baker","Calhoun","Decatur","Grady","Mitchell"] },
  { circuit:"Southern", counties:["Brooks","Colquitt","Echols","Lowndes","Thomas"] },
  { circuit:"Southwestern", counties:["Lee","Macon","Schley","Stewart","Sumter","Webster"] },
  { circuit:"Tallapoosa", counties:["Haralson","Polk"] },
  { circuit:"Tifton", counties:["Irwin","Tift","Turner","Worth"] },
  { circuit:"Toombs", counties:["Glascock","Lincoln","McDuffie","Taliaferro","Warren","Wilkes"] },
  { circuit:"Towaliga", counties:["Butts","Lamar","Monroe"] },
  { circuit:"Waycross", counties:["Bacon","Brantley","Charlton","Coffee","Pierce","Ware"] },
  { circuit:"West Georgia", counties:["Clarke","Oconee"] },
  { circuit:"Western", counties:["Carroll","Heard"] }
];

// ─── Field Label System ──────────────────────────────────────────────
// Allows users to customize dashboard labels (e.g., "State Attorneys" → "Staff Positions")
const DEFAULT_FIELD_LABELS = {
  total_cases: 'Total Cases',
  new_cases: 'New Cases',
  rollover_cases: 'Rollover Cases',
  closed_cases: 'Closed Cases',
  state_attorneys_filled: 'State Attorneys (Filled)',
  state_attorneys_vacant: 'State Attorneys (Vacant)',
  county_attorneys: 'County Attorneys',
  conflict_new_cases: 'Conflict New Cases',
  conflict_rollover_cases: 'Conflict Rollover Cases',
  total_contractors: 'Total Contractors'
};
let FIELD_LABELS = { ...DEFAULT_FIELD_LABELS };
function fieldLabel(key) {
  return FIELD_LABELS[key] || DEFAULT_FIELD_LABELS[key] || key;
}

// Start with empty metrics — data comes from the server after upload
let CIRCUIT_METRICS = new Map();
// Comparison period (prior fiscal year) for year-over-year, loaded on demand.
let CIRCUIT_METRICS_PRIOR = new Map();
let __hasData = false;

function emptyMetrics() {
  return {
    totalCases: 0, newCases: 0, closed: 0,
    stateFilled: 0, stateVacant: 0, countyAttorneys: 0,
    conflict: { newCases: 0, rolloverCases: 0, totalContractors: 0 },
    // Case types (weighted caseload)
    capitalCases: 0, felonyCases: 0, misdemeanorCases: 0, juvenileCases: 0, appealsCases: 0, probationCases: 0,
    // Support staff
    investigators: 0, socialWorkers: 0, paralegals: 0,
    // Financials
    annualBudget: 0, actualSpend: 0,
  };
}

// Default case weights for weighted caseload — relative to a misdemeanor (1.0).
// PLACEHOLDERS: replace with your agency's adopted standard (e.g. the 2023
// National Public Defense Workload Study hours-per-case figures).
const CASE_WEIGHTS = { capital: 40, felony: 4, misdemeanor: 1, juvenile: 2, appeals: 8, probation: 0.5 };

// Weighted case count for a metrics-or-aggregate object.
function weightedCaseCount(m) {
  if (!m) return 0;
  return (m.capitalCases || 0) * CASE_WEIGHTS.capital
    + (m.felonyCases || 0) * CASE_WEIGHTS.felony
    + (m.misdemeanorCases || 0) * CASE_WEIGHTS.misdemeanor
    + (m.juvenileCases || 0) * CASE_WEIGHTS.juvenile
    + (m.appealsCases || 0) * CASE_WEIGHTS.appeals
    + (m.probationCases || 0) * CASE_WEIGHTS.probation;
}

function initEmptyMetrics() {
  CIRCUIT_METRICS = new Map(CIRCUITS.map(c => [c.circuit, emptyMetrics()]));
  __hasData = false;
}

initEmptyMetrics();
