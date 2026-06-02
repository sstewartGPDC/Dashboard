const { app, BrowserWindow, Menu, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const net = require('net');

// ── Paths ────────────────────────────────────────────────────────────
const isDev = !app.isPackaged;
const appRoot = isDev
  ? path.join(__dirname, '..')
  : path.join(process.resourcesPath, 'app.asar');

const userDataPath = app.getPath('userData');
const dbDir = isDev ? path.join(appRoot, 'db') : path.join(userDataPath, 'db');
const uploadsDir = isDev ? path.join(appRoot, 'uploads') : path.join(userDataPath, 'uploads');

// ── Set env vars before requiring server ─────────────────────────────
process.env.GPDC_DB_DIR = dbDir;
process.env.GPDC_UPLOADS_DIR = uploadsDir;

// ── Ensure directories ───────────────────────────────────────────────
function ensureDirectories() {
  [dbDir, uploadsDir].forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  });
}

// ── Initialize database on first launch ──────────────────────────────
function initDatabase() {
  const targetDb = path.join(dbDir, 'database.sqlite');
  if (fs.existsSync(targetDb)) return; // already initialized

  console.log('First launch — initializing database...');
  const Database = require('better-sqlite3');
  const bcrypt = require('bcryptjs');

  const schemaPath = path.join(appRoot, 'db', 'schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf8');

  const db = new Database(targetDb);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(schema);

  // Seed default admin user
  const hash = bcrypt.hashSync('admin123', 10);
  db.prepare(
    'INSERT INTO users (username, password_hash, display_name, role) VALUES (?, ?, ?, ?)'
  ).run('admin', hash, 'Administrator', 'admin');

  db.close();
  console.log('Database initialized in', dbDir);
}

// ── Find a free port ─────────────────────────────────────────────────
function findFreePort(startPort = 3000) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.listen(startPort, '127.0.0.1', () => {
      const port = server.address().port;
      server.close(() => resolve(port));
    });
    server.on('error', () => {
      resolve(findFreePort(startPort + 1));
    });
  });
}

// ── Window ───────────────────────────────────────────────────────────
let mainWindow = null;
let serverPort = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: 'GPDC Dashboards',
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 15, y: 15 },
    backgroundColor: '#f5f3f0',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  mainWindow.loadURL(`http://127.0.0.1:${serverPort}`);

  // Open external links in default browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http') && !url.includes('127.0.0.1')) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// ── macOS menu ───────────────────────────────────────────────────────
function createMenu() {
  const template = [
    {
      label: app.name,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        { type: 'separator' },
        { role: 'close' },
      ],
    },
  ];

  // Add DevTools in development
  if (isDev) {
    template[2].submenu.push({ type: 'separator' }, { role: 'toggleDevTools' });
  }

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// ── App lifecycle ────────────────────────────────────────────────────
app.whenReady().then(async () => {
  ensureDirectories();
  initDatabase();
  createMenu();

  serverPort = await findFreePort(3000);
  process.env.PORT = String(serverPort);
  process.env.SESSION_SECRET = process.env.SESSION_SECRET || 'gpdc-electron-local-session';

  // Start Express server
  const { startServer } = require(path.join(appRoot, 'server.js'));
  await startServer(serverPort);
  console.log(`Express server started on port ${serverPort}`);

  createWindow();
});

// macOS: re-create window when dock icon is clicked
app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

// macOS convention: don't quit when all windows are closed
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
