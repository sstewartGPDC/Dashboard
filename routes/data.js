const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { parseExcelBuffer, getExcelHeaders, DEFAULT_MAPPINGS } = require('../lib/excel-parser');
const { audit } = require('../lib/security');
const router = express.Router();

// Multer config for file uploads
const uploadsDir = process.env.GPDC_UPLOADS_DIR || path.join(__dirname, '..', 'uploads');
const storage = multer.diskStorage({
  destination: uploadsDir,
  filename: (req, file, cb) => {
    const ts = Date.now();
    cb(null, `${ts}-${file.originalname}`);
  }
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } }); // 10MB max

const INSERT_CIRCUIT_SQL = `INSERT INTO circuit_data (upload_id, circuit, total_cases, new_cases, rollover_cases, closed_cases, state_attorneys_filled, state_attorneys_vacant, county_attorneys, conflict_new_cases, conflict_rollover_cases, total_contractors) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

// Insert an upload + all its circuit rows atomically; returns the upload id.
async function persistUpload(db, { userId, filename, isShared, rows }) {
  return db.tx(async (tx) => {
    const uploadResult = await tx.run(
      'INSERT INTO upload_history (user_id, filename, is_shared) VALUES (?, ?, ?) RETURNING id',
      [userId, filename, isShared ? 1 : 0]
    );
    const uploadId = uploadResult.lastID;
    for (const r of rows) {
      await tx.run(INSERT_CIRCUIT_SQL, [
        uploadId, r.circuit, r.total_cases, r.new_cases, r.rollover_cases, r.closed_cases,
        r.state_attorneys_filled, r.state_attorneys_vacant, r.county_attorneys,
        r.conflict_new_cases, r.conflict_rollover_cases, r.total_contractors,
      ]);
    }
    return uploadId;
  });
}

// GET /api/data — returns circuit metrics
router.get('/', requireAuth, async (req, res) => {
  try {
    const db = req.app.locals.db;
    const source = req.query.source || 'auto';
    let uploadId = null;
    let dataSource = 'sample';

    if (source === 'personal' || source === 'auto') {
      // Try user's latest personal upload
      const personal = await db.get('SELECT id FROM upload_history WHERE user_id = ? AND is_shared = 0 ORDER BY uploaded_at DESC LIMIT 1', [req.session.userId]);
      if (personal) {
        uploadId = personal.id;
        dataSource = 'personal';
      }
    }

    if ((source === 'shared' || (source === 'auto' && !uploadId))) {
      // Try latest shared upload
      const shared = await db.get('SELECT id FROM upload_history WHERE is_shared = 1 ORDER BY uploaded_at DESC LIMIT 1');
      if (shared) {
        uploadId = shared.id;
        dataSource = 'shared';
      }
    }

    if (!uploadId) {
      // No data in DB — return empty with sample flag
      return res.json({ ok: true, source: 'sample', circuits: [] });
    }

    const rows = await db.all('SELECT * FROM circuit_data WHERE upload_id = ?', [uploadId]);

    // Include custom field labels if the user has any
    let fieldLabels = null;
    const labelConfig = await db.get('SELECT config_json FROM dashboard_config WHERE user_id = ? AND config_key = ?', [req.session.userId, 'field_labels']);
    if (labelConfig) {
      try { fieldLabels = JSON.parse(labelConfig.config_json); } catch {}
    }

    res.json({ ok: true, source: dataSource, circuits: rows, fieldLabels });
  } catch (err) {
    console.error('Get data error:', err);
    res.status(500).json({ ok: false, error: 'Failed to load data' });
  }
});

// POST /api/data/upload — upload Excel file
router.post('/upload', requireAuth, upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ ok: false, error: 'No file uploaded' });
  }

  const isShared = req.body.shared === 'true' || req.body.shared === '1';
  // Only admins can upload as shared
  if (isShared && req.session.role !== 'admin') {
    return res.status(403).json({ ok: false, error: 'Only admins can upload shared data' });
  }

  const customMapping = req.body.mapping ? JSON.parse(req.body.mapping) : {};

  try {
    const fileBuffer = fs.readFileSync(req.file.path);
    const { rows } = parseExcelBuffer(fileBuffer, customMapping);

    if (!rows.length) {
      return res.status(400).json({ ok: false, error: 'No circuit data found in file' });
    }

    const db = req.app.locals.db;
    const uploadId = await persistUpload(db, {
      userId: req.session.userId,
      filename: req.file.originalname,
      isShared,
      rows,
    });

    // Clean up uploaded file
    fs.unlinkSync(req.file.path);

    await audit(db, req, 'data.upload', { uploadId, filename: req.file.originalname, rowCount: rows.length, shared: isShared });
    res.json({ ok: true, uploadId, rowCount: rows.length, source: isShared ? 'shared' : 'personal' });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ ok: false, error: 'Failed to parse Excel file: ' + err.message });
  }
});

// POST /api/data/preview-headers — get Excel column headers for mapping
router.post('/preview-headers', requireAuth, upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ ok: false, error: 'No file uploaded' });
  }
  try {
    const fileBuffer = fs.readFileSync(req.file.path);
    const { headers, sheetName, sheetNames } = getExcelHeaders(fileBuffer);
    // Don't delete file yet — user will re-submit for actual upload
    // Store the temp path in session for re-use
    res.json({ ok: true, headers, sheetName, sheetNames, tempFile: req.file.filename });
  } catch (err) {
    res.status(500).json({ ok: false, error: 'Failed to read Excel: ' + err.message });
  }
});

// POST /api/data/upload-mapped — upload with pre-uploaded temp file and mapping
router.post('/upload-mapped', requireAuth, async (req, res) => {
  const { tempFile, mapping, shared } = req.body;
  if (!tempFile) {
    return res.status(400).json({ ok: false, error: 'No temp file specified' });
  }

  const isShared = shared === true || shared === 'true';
  if (isShared && req.session.role !== 'admin') {
    return res.status(403).json({ ok: false, error: 'Only admins can upload shared data' });
  }

  // Guard against path traversal — only operate on a bare filename in uploadsDir.
  const safeName = path.basename(String(tempFile));
  const filePath = path.join(uploadsDir, safeName);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ ok: false, error: 'Temp file not found. Please re-upload.' });
  }

  try {
    const fileBuffer = fs.readFileSync(filePath);
    const customMapping = mapping || {};
    const { rows } = parseExcelBuffer(fileBuffer, customMapping);

    if (!rows.length) {
      return res.status(400).json({ ok: false, error: 'No circuit data found in file' });
    }

    const db = req.app.locals.db;
    const uploadId = await persistUpload(db, {
      userId: req.session.userId,
      filename: safeName,
      isShared,
      rows,
    });

    // Clean up
    fs.unlinkSync(filePath);

    await audit(db, req, 'data.upload', { uploadId, filename: safeName, rowCount: rows.length, shared: isShared });
    res.json({ ok: true, uploadId, rowCount: rows.length, source: isShared ? 'shared' : 'personal' });
  } catch (err) {
    console.error('Upload-mapped error:', err);
    res.status(500).json({ ok: false, error: 'Failed to process file: ' + err.message });
  }
});

// GET /api/data/uploads — upload history
router.get('/uploads', requireAuth, async (req, res) => {
  try {
    const db = req.app.locals.db;
    let uploads;
    if (req.session.role === 'admin') {
      uploads = await db.all(`SELECT uh.*, u.display_name as uploaded_by, (SELECT COUNT(*) FROM circuit_data WHERE upload_id = uh.id) as row_count FROM upload_history uh JOIN users u ON uh.user_id = u.id ORDER BY uh.uploaded_at DESC LIMIT 50`);
    } else {
      uploads = await db.all(`SELECT uh.*, u.display_name as uploaded_by, (SELECT COUNT(*) FROM circuit_data WHERE upload_id = uh.id) as row_count FROM upload_history uh JOIN users u ON uh.user_id = u.id WHERE uh.user_id = ? OR uh.is_shared = 1 ORDER BY uh.uploaded_at DESC LIMIT 50`, [req.session.userId]);
    }
    res.json({ ok: true, uploads });
  } catch (err) {
    console.error('Uploads history error:', err);
    res.status(500).json({ ok: false, error: 'Failed to load upload history' });
  }
});

// GET /api/data/column-mappings
router.get('/column-mappings', requireAuth, async (req, res) => {
  try {
    const db = req.app.locals.db;
    const mappings = await db.all('SELECT * FROM column_mappings WHERE user_id = ? ORDER BY created_at DESC', [req.session.userId]);
    // Also return the default expected fields
    res.json({ ok: true, mappings, expectedFields: Object.keys(DEFAULT_MAPPINGS) });
  } catch (err) {
    console.error('Column mappings error:', err);
    res.status(500).json({ ok: false, error: 'Failed to load column mappings' });
  }
});

// POST /api/data/column-mappings
router.post('/column-mappings', requireAuth, async (req, res) => {
  try {
    const { name, mapping } = req.body;
    if (!mapping) return res.status(400).json({ ok: false, error: 'Mapping required' });
    const db = req.app.locals.db;
    const result = await db.run('INSERT INTO column_mappings (user_id, mapping_name, mapping_json) VALUES (?, ?, ?) RETURNING id', [req.session.userId, name || 'Untitled', JSON.stringify(mapping)]);
    res.json({ ok: true, id: result.lastID });
  } catch (err) {
    console.error('Save column mapping error:', err);
    res.status(500).json({ ok: false, error: 'Failed to save column mapping' });
  }
});

// GET /api/data/template — downloadable Excel template with all 45 circuits and column guide
router.get('/template', requireAuth, (req, res) => {
  const XLSX_LIB = require('xlsx');

  const circuits = [
    'Alapaha','Alcovy','Appalachian','Atlanta','Atlantic','Augusta','Brunswick',
    'Chattahoochee','Cherokee','Clayton','Conasauga','Columbia','Cordele','Coweta',
    'Dekalb','Dougherty','Dublin','Eastern','Enotah','Flint','Griffin',
    'Lookout Mountain','Macon','Middle Georgia','Mountain','Northeastern','Northern',
    'Ocmulgee','Oconee','Ogeechee','Pataula','Paulding','Piedmont','Rockdale',
    'Rome','South Georgia','Southern','Southwestern','Tallapoosa','Tifton','Toombs',
    'Towaliga','Waycross','West Georgia','Western'
  ];

  const headers = ['Circuit','Total Cases','New Cases','Rollover Cases','Closed Cases',
    'State Attorneys (Filled)','State Attorneys (Vacant)','County Attorneys',
    'New Conflict Cases','Rollover Conflict Cases','Total Contractors'];

  // Sheet 1: Circuit Data with headers + example rows + all circuit names
  const dataRows = [headers];
  // Example rows
  dataRows.push(['Atlanta', 4200, 1100, 3100, 850, 45, 5, 12, 380, 200, 8]);
  dataRows.push(['Augusta', 1800, 520, 1280, 410, 18, 2, 6, 140, 80, 4]);
  // Rest of circuits with empty data
  circuits.forEach(c => {
    if (c !== 'Atlanta' && c !== 'Augusta') {
      dataRows.push([c, '', '', '', '', '', '', '', '', '', '']);
    }
  });

  const ws1 = XLSX_LIB.utils.aoa_to_sheet(dataRows);
  // Set column widths
  ws1['!cols'] = [
    { wch: 22 }, { wch: 14 }, { wch: 12 }, { wch: 16 }, { wch: 14 },
    { wch: 24 }, { wch: 24 }, { wch: 18 },
    { wch: 20 }, { wch: 24 }, { wch: 18 }
  ];

  // Sheet 2: Column Guide
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
    ['NOTES'],
    ['Only the "Circuit" column is required. Include whichever columns are relevant to your team.'],
    ['Column names do not need to match exactly — the dashboard will let you map them during upload.'],
    ['You can rename, reorder, or remove any optional columns.'],
    ['For HR: use State Attorneys (Filled/Vacant) to track vacancy rates.'],
    ['For Finance: use Total Contractors and County Attorneys to track contract staffing.'],
  ];

  const ws2 = XLSX_LIB.utils.aoa_to_sheet(guideRows);
  ws2['!cols'] = [{ wch: 28 }, { wch: 52 }, { wch: 12 }, { wch: 28 }];

  const wb = XLSX_LIB.utils.book_new();
  XLSX_LIB.utils.book_append_sheet(wb, ws1, 'Circuit Data');
  XLSX_LIB.utils.book_append_sheet(wb, ws2, 'Column Guide');

  const buf = XLSX_LIB.write(wb, { type: 'buffer', bookType: 'xlsx' });

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename="GPDC_Dashboard_Template.xlsx"');
  res.send(buf);
});

// GET /api/data/template-for-dashboard — downloadable Excel template based on dashboard card fields
router.get('/template-for-dashboard', requireAuth, (req, res) => {
  const XLSX_LIB = require('xlsx');

  // Parse field keys from query string (comma-separated)
  const fieldKeys = (req.query.fields || '').split(',').filter(Boolean);
  if (!fieldKeys.length) {
    return res.redirect('/api/data/template');
  }

  // Map chart field keys to the actual Excel columns needed
  const FIELD_TO_COLUMNS = {
    totalCases:          ['Total Cases'],
    newCases:            ['New Cases'],
    closed:              ['Closed Cases'],
    stateFilled:         ['State Attorneys (Filled)'],
    stateVacant:         ['State Attorneys (Vacant)'],
    countyAttorneys:     ['County Attorneys'],
    conflictNew:         ['New Conflict Cases'],
    conflictContractors: ['Total Contractors'],
    // Computed fields require their source columns
    totalAttorneys:      ['State Attorneys (Filled)', 'County Attorneys'],
    caseload:            ['Total Cases', 'State Attorneys (Filled)', 'County Attorneys'],
    vacancyRate:         ['State Attorneys (Filled)', 'State Attorneys (Vacant)'],
    activeRemaining:     ['Total Cases', 'New Cases'],
  };

  // Collect unique column names preserving order
  const seenCols = new Set();
  const columns = ['Circuit']; // always first
  seenCols.add('Circuit');
  for (const key of fieldKeys) {
    const cols = FIELD_TO_COLUMNS[key];
    if (cols) {
      for (const col of cols) {
        if (!seenCols.has(col)) {
          seenCols.add(col);
          columns.push(col);
        }
      }
    }
  }

  // If no data columns were mapped (unknown field keys), fall back to full template
  if (columns.length <= 1) {
    return res.redirect('/api/data/template');
  }

  const circuits = [
    'Alapaha','Alcovy','Appalachian','Atlanta','Atlantic','Augusta','Brunswick',
    'Chattahoochee','Cherokee','Clayton','Conasauga','Columbia','Cordele','Coweta',
    'Dekalb','Dougherty','Dublin','Eastern','Enotah','Flint','Griffin',
    'Lookout Mountain','Macon','Middle Georgia','Mountain','Northeastern','Northern',
    'Ocmulgee','Oconee','Ogeechee','Pataula','Paulding','Piedmont','Rockdale',
    'Rome','South Georgia','Southern','Southwestern','Tallapoosa','Tifton','Toombs',
    'Towaliga','Waycross','West Georgia','Western'
  ];

  const dataRows = [columns];
  // Example rows for Atlanta and Augusta
  const exampleData = {
    'Total Cases': [4200, 1800],
    'New Cases': [1100, 520],
    'Closed Cases': [850, 410],
    'State Attorneys (Filled)': [45, 18],
    'State Attorneys (Vacant)': [5, 2],
    'County Attorneys': [12, 6],
    'New Conflict Cases': [380, 140],
    'Total Contractors': [8, 4],
  };
  for (let i = 0; i < 2; i++) {
    const name = i === 0 ? 'Atlanta' : 'Augusta';
    const row = columns.map(col => {
      if (col === 'Circuit') return name;
      return exampleData[col] ? exampleData[col][i] : '';
    });
    dataRows.push(row);
  }
  // Remaining circuits with empty data
  circuits.forEach(c => {
    if (c !== 'Atlanta' && c !== 'Augusta') {
      const row = columns.map(col => col === 'Circuit' ? c : '');
      dataRows.push(row);
    }
  });

  const ws = XLSX_LIB.utils.aoa_to_sheet(dataRows);
  ws['!cols'] = columns.map(col => ({ wch: Math.max(col.length + 4, 14) }));

  const wb = XLSX_LIB.utils.book_new();
  XLSX_LIB.utils.book_append_sheet(wb, ws, 'Circuit Data');

  const buf = XLSX_LIB.write(wb, { type: 'buffer', bookType: 'xlsx' });

  const dashName = (req.query.name || 'Dashboard').replace(/[^a-zA-Z0-9_ -]/g, '');
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="GPDC_${dashName}_Template.xlsx"`);
  res.send(buf);
});

// GET /api/data/config/:key — get user dashboard config
router.get('/config/:key', requireAuth, async (req, res) => {
  try {
    const db = req.app.locals.db;
    const row = await db.get('SELECT config_json FROM dashboard_config WHERE user_id = ? AND config_key = ?', [req.session.userId, req.params.key]);
    if (!row) return res.json({ ok: true, value: null });
    try {
      res.json({ ok: true, value: JSON.parse(row.config_json) });
    } catch {
      res.json({ ok: true, value: null });
    }
  } catch (err) {
    console.error('Get config error:', err);
    res.status(500).json({ ok: false, error: 'Failed to load config' });
  }
});

// POST /api/data/config — save user dashboard config
router.post('/config', requireAuth, async (req, res) => {
  try {
    const { key, value } = req.body;
    if (!key) return res.status(400).json({ ok: false, error: 'Config key required' });
    const db = req.app.locals.db;
    await db.run('INSERT INTO dashboard_config (user_id, config_key, config_json) VALUES (?, ?, ?) ON CONFLICT(user_id, config_key) DO UPDATE SET config_json = excluded.config_json, updated_at = CURRENT_TIMESTAMP', [req.session.userId, key, JSON.stringify(value)]);
    res.json({ ok: true });
  } catch (err) {
    console.error('Save config error:', err);
    res.status(500).json({ ok: false, error: 'Failed to save config' });
  }
});

// DELETE /api/data/clear — remove user's uploaded data and return to empty state
router.delete('/clear', requireAuth, async (req, res) => {
  try {
    const db = req.app.locals.db;
    const userId = req.session.userId;
    const role = req.session.role;

    await db.tx(async (tx) => {
      // Get the user's personal uploads
      const personalUploads = await tx.all('SELECT id FROM upload_history WHERE user_id = ? AND is_shared = 0', [userId]);
      for (const u of personalUploads) {
        await tx.run('DELETE FROM circuit_data WHERE upload_id = ?', [u.id]);
      }
      await tx.run('DELETE FROM upload_history WHERE user_id = ? AND is_shared = 0', [userId]);

      // Admins can also clear shared data
      if (role === 'admin') {
        const sharedUploads = await tx.all('SELECT id FROM upload_history WHERE is_shared = 1');
        for (const u of sharedUploads) {
          await tx.run('DELETE FROM circuit_data WHERE upload_id = ?', [u.id]);
        }
        await tx.run('DELETE FROM upload_history WHERE is_shared = 1');
      }

      // Also clear custom field labels
      await tx.run('DELETE FROM dashboard_config WHERE user_id = ? AND config_key = ?', [userId, 'field_labels']);
    });

    await audit(db, req, 'data.clear', { clearedShared: role === 'admin' });
    res.json({ ok: true });
  } catch (err) {
    console.error('Clear data error:', err);
    res.status(500).json({ ok: false, error: 'Failed to clear data' });
  }
});

module.exports = router;
