// ─── Dashboard Templates ─────────────────────────────────────────────
// Audience-ready prebuilt dashboards. Each is a layout array of card configs
// using the same card types the editor produces, so they're fully editable
// after creation. Lowers the "build from blank" barrier.

const SEG = (field, label, color) => ({ field, label, color });

const GALLERY_TEMPLATES = [
  {
    key: 'legislative',
    name: 'Legislative Budget Report',
    audience: 'External · General Assembly',
    desc: 'Headline caseload, staffing, and cost figures with year-over-year change — built to justify appropriations.',
    layout: [
      { id: 'l1', type: 'kpi', title: 'Total Cases', width: 'small', field: 'totalCases', icon: 'folder', format: 'number', subtitle: 'Statewide, this period' },
      { id: 'l2', type: 'kpi', title: 'Attorney Positions', width: 'small', field: 'totalAttorneys', icon: 'users', format: 'number', subtitle: 'Funded positions' },
      { id: 'l3', type: 'kpi', title: 'Vacant Positions', width: 'small', field: 'stateVacant', icon: 'alert', format: 'number', subtitle: 'Unfilled' },
      { id: 'l4', type: 'kpi', title: 'Caseload / Attorney', width: 'small', field: 'caseload', icon: 'trending-up', format: 'number', subtitle: 'Statewide average' },
      { id: 'l5', type: 'scorecard', title: 'Circuit Scorecard', subtitle: 'Caseload vs. standard', width: 'full', standard: 150 },
      { id: 'l6', type: 'compare', title: 'Total Cases — Year over Year', subtitle: 'Current vs. prior year', width: 'large', field: 'totalCases', limit: 10 },
      { id: 'l7', type: 'bar', title: 'Caseload by Circuit', subtitle: 'Cases per attorney', width: 'large', field: 'caseload', colorClass: 'gold', limit: 15, sort: 'desc' },
    ],
  },
  {
    key: 'caseload',
    name: 'Caseload Standards',
    audience: 'Internal & External',
    desc: 'Focused on caseload vs. the adopted maximum — which circuits are over the ethical limit, and the trend.',
    layout: [
      { id: 'c1', type: 'kpi', title: 'Caseload / Attorney', width: 'small', field: 'caseload', icon: 'trending-up', format: 'number', subtitle: 'Statewide average' },
      { id: 'c2', type: 'kpi', title: 'Total Cases', width: 'small', field: 'totalCases', icon: 'folder', format: 'number', subtitle: 'This period' },
      { id: 'c3', type: 'kpi', title: 'Attorneys', width: 'small', field: 'totalAttorneys', icon: 'users', format: 'number', subtitle: 'Funded positions' },
      { id: 'c4', type: 'scorecard', title: 'Circuit Scorecard', subtitle: 'Caseload vs. standard', width: 'full', standard: 150 },
      { id: 'c5', type: 'bar', title: 'Caseload by Circuit', subtitle: 'Highest first', width: 'large', field: 'caseload', colorClass: 'rust', limit: 20, sort: 'desc' },
      { id: 'c6', type: 'compare', title: 'Caseload — Year over Year', subtitle: 'Current vs. prior year', width: 'large', field: 'caseload', limit: 10 },
    ],
  },
  {
    key: 'staffing',
    name: 'Staffing & Vacancy',
    audience: 'Internal · HR & Leadership',
    desc: 'Filled vs. vacant positions, vacancy rate, and where the gaps are concentrated across circuits.',
    layout: [
      { id: 's1', type: 'kpi', title: 'Filled Positions', width: 'small', field: 'stateFilled', icon: 'check', format: 'number', subtitle: 'State attorneys' },
      { id: 's2', type: 'kpi', title: 'Vacant Positions', width: 'small', field: 'stateVacant', icon: 'alert', format: 'number', subtitle: 'Unfilled' },
      { id: 's3', type: 'kpi', title: 'Vacancy Rate', width: 'small', field: 'vacancyRate', icon: 'percent', format: 'percent', subtitle: 'Statewide' },
      { id: 's4', type: 'kpi', title: 'County Attorneys', width: 'small', field: 'countyAttorneys', icon: 'briefcase', format: 'number', subtitle: 'County-funded' },
      { id: 's5', type: 'ring', title: 'Staffing Mix', subtitle: 'Filled, vacant, county', width: 'medium', segments: [SEG('stateFilled', 'Filled', '#5fa87a'), SEG('stateVacant', 'Vacant', '#d45454'), SEG('countyAttorneys', 'County', '#e2b77a')], centerLabel: 'Positions' },
      { id: 's6', type: 'bar', title: 'Vacancy Rate by Circuit', subtitle: 'Highest first', width: 'large', field: 'vacancyRate', colorClass: 'rust', limit: 20, sort: 'desc' },
      { id: 's7', type: 'compare', title: 'Vacancy Rate — Year over Year', subtitle: 'Current vs. prior year', width: 'large', field: 'vacancyRate', limit: 10 },
    ],
  },
  {
    key: 'operations',
    name: 'Circuit Operations',
    audience: 'Internal · Operations',
    desc: 'Case flow — new, closed, and active — with per-circuit breakdowns for day-to-day management.',
    layout: [
      { id: 'o1', type: 'kpi', title: 'New Cases', width: 'small', field: 'newCases', icon: 'plus', format: 'number', subtitle: 'Opened this period' },
      { id: 'o2', type: 'kpi', title: 'Closed Cases', width: 'small', field: 'closed', icon: 'check', format: 'number', subtitle: 'Resolved this period' },
      { id: 'o3', type: 'kpi', title: 'Active Remaining', width: 'small', field: 'activeRemaining', icon: 'clock', format: 'number', subtitle: 'Carrying forward' },
      { id: 'o4', type: 'bar', title: 'New Cases by Circuit', subtitle: 'Highest first', width: 'large', field: 'newCases', colorClass: 'gold', limit: 15, sort: 'desc' },
      { id: 'o5', type: 'donut', title: 'Case Flow', subtitle: 'New vs. closed', width: 'medium', segments: [SEG('newCases', 'New', '#c4714e'), SEG('closed', 'Closed', '#5fa87a')], centerLabel: 'Cases' },
      { id: 'o6', type: 'scorecard', title: 'Circuit Scorecard', subtitle: 'Caseload vs. standard', width: 'full', standard: 150 },
    ],
  },
  {
    key: 'conflict',
    name: 'Conflict & Contract',
    audience: 'Internal · Conflict Division',
    desc: 'Conflict caseload and contractor utilization across circuits.',
    layout: [
      { id: 'k1', type: 'kpi', title: 'Conflict Cases', width: 'small', field: 'conflictNew', icon: 'shield', format: 'number', subtitle: 'New, this period' },
      { id: 'k2', type: 'kpi', title: 'Contractors', width: 'small', field: 'conflictContractors', icon: 'briefcase', format: 'number', subtitle: 'Conflict contractors' },
      { id: 'k3', type: 'bar', title: 'Contractors by Circuit', subtitle: 'Highest first', width: 'large', field: 'conflictContractors', colorClass: 'teal', limit: 15, sort: 'desc' },
      { id: 'k4', type: 'pie', title: 'Conflict Resource Mix', subtitle: 'Cases vs. contractors', width: 'medium', segments: [SEG('conflictNew', 'Conflict Cases', '#c4714e'), SEG('conflictContractors', 'Contractors', '#4ea8a0')], centerLabel: 'Total' },
      { id: 'k5', type: 'compare', title: 'Conflict Cases — Year over Year', subtitle: 'Current vs. prior year', width: 'large', field: 'conflictNew', limit: 10 },
    ],
  },
];
