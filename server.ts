import express from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import dotenv from 'dotenv';
import {
  INITIAL_USERS,
  INITIAL_SETTINGS,
  INITIAL_TABLES,
  INITIAL_MENU_ITEMS,
  INITIAL_ORDERS,
  INITIAL_KOTS,
  INITIAL_BILLS,
} from './src/data/initialData';
import { hashPassword, verifyPassword } from './src/utils/security';
import { User, UserRole } from './src/types/pos';

dotenv.config();

const app = express();
const port = parseInt(process.env.PORT || '3000', 10);

app.use(express.json({ limit: '10mb' }));

// Database storage file path
const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_PATH = path.resolve(DATA_DIR, 'pos-db.json');

// Interface for persistent DB structure
interface PosDatabase {
  users: User[];
  sessions: Record<
    string,
    {
      userId: string;
      createdAt: string;
      expiresAt: string;
    }
  >;
  settings: any;
  tables: any[];
  menu: any[];
  categories: string[];
  subcategories: any[];
  orders: any[];
  kots: any[];
  bills: any[];
}

// Helper to ensure data directory exists and return current DB
function readDb(): PosDatabase {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  if (!fs.existsSync(DB_PATH)) {
    const initialDb: PosDatabase = {
      users: INITIAL_USERS.map((u) => ({
        ...u,
        passwordHash: u.passwordHash || hashPassword('123456'),
      })),
      sessions: {},
      settings: INITIAL_SETTINGS,
      tables: INITIAL_TABLES,
      menu: INITIAL_MENU_ITEMS,
      categories: [
        'Starters',
        'Chinese',
        'Beverages & Juices',
        'Main Course',
        'Main Course & Gravies',
        'South Indian & Breakfast',
        'Munchies & Soups',
        'Indian Appetizers',
        'Mushroom',
        'Mix Vegetable',
        'Paneer Main Course',
        'Veg Specials',
        'Veg Main Course',
        'Dal & Special Gravies',
        'Breads',
        'Breads & Rotis',
        'Rice',
        'Desserts',
        'Beverages',
      ],
      subcategories: [],
      orders: INITIAL_ORDERS,
      kots: INITIAL_KOTS,
      bills: INITIAL_BILLS,
    };
    fs.writeFileSync(DB_PATH, JSON.stringify(initialDb, null, 2), 'utf-8');
    return initialDb;
  }

  try {
    const raw = fs.readFileSync(DB_PATH, 'utf-8');
    const parsed = JSON.parse(raw);
    if (!parsed.users || !Array.isArray(parsed.users)) {
      parsed.users = INITIAL_USERS;
    }
    if (!parsed.sessions || typeof parsed.sessions !== 'object') {
      parsed.sessions = {};
    }
    return parsed;
  } catch (err) {
    console.error('[DB] Error parsing pos-db.json, recreating fallback:', err);
    const fallbackDb: PosDatabase = {
      users: INITIAL_USERS,
      sessions: {},
      settings: INITIAL_SETTINGS,
      tables: INITIAL_TABLES,
      menu: INITIAL_MENU_ITEMS,
      categories: ['Starters', 'Main Course', 'Beverages', 'Desserts'],
      subcategories: [],
      orders: INITIAL_ORDERS,
      kots: INITIAL_KOTS,
      bills: INITIAL_BILLS,
    };
    fs.writeFileSync(DB_PATH, JSON.stringify(fallbackDb, null, 2), 'utf-8');
    return fallbackDb;
  }
}

// Helper to write DB atomically
function writeDb(data: PosDatabase) {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error('[DB] Error writing pos-db.json:', err);
  }
}

// Sanitize user object for client responses (no raw passwords)
function sanitizeUser(user: User): User {
  return {
    id: user.id,
    username: user.username,
    name: user.name,
    passwordHash: user.passwordHash,
    role: user.role,
    isActive: typeof user.isActive === 'boolean' ? user.isActive : true,
    createdAt: user.createdAt,
  };
}

// Auth Middleware: validates session token
function authMiddleware(
  req: express.Request & { user?: User; token?: string },
  res: express.Response,
  next: express.NextFunction
) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required. No active session token found.',
    });
  }

  const token = authHeader.substring(7).trim();
  if (!token) {
    return res.status(401).json({
      success: false,
      error: 'Invalid authorization token format.',
    });
  }

  const db = readDb();
  const session = db.sessions?.[token];

  if (!session) {
    return res.status(401).json({
      success: false,
      error: 'Invalid or expired session. Please log in.',
    });
  }

  // Check expiration (30 days validity)
  if (new Date(session.expiresAt).getTime() < Date.now()) {
    delete db.sessions[token];
    writeDb(db);
    return res.status(401).json({
      success: false,
      error: 'Session expired. Please log in again.',
    });
  }

  const user = db.users.find((u) => u.id === session.userId);
  if (!user) {
    delete db.sessions[token];
    writeDb(db);
    return res.status(401).json({
      success: false,
      error: 'User record not found for this session.',
    });
  }

  if (!user.isActive) {
    return res.status(403).json({
      success: false,
      error: 'This account has been disabled. Please contact the Owner.',
    });
  }

  req.user = user;
  req.token = token;
  next();
}

// Role Guard Middleware: requires Owner role
function requireOwner(
  req: express.Request & { user?: User },
  res: express.Response,
  next: express.NextFunction
) {
  if (req.user?.role !== 'owner') {
    return res.status(403).json({
      success: false,
      error: 'Permission Denied: ONLY the Restaurant Owner has access to this operation.',
    });
  }
  next();
}

// -------------------------------------------------------------
// Authentication Routes (/api/auth)
// -------------------------------------------------------------

// POST /api/auth/login
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || typeof username !== 'string' || !password || typeof password !== 'string') {
    return res.status(400).json({
      success: false,
      error: 'Username and password are required.',
    });
  }

  const cleanUsername = username.trim().toLowerCase();
  const cleanPassword = password.trim();

  const db = readDb();
  const foundUser = db.users.find((u) => u.username.toLowerCase() === cleanUsername);

  if (!foundUser) {
    return res.status(401).json({
      success: false,
      error: 'Invalid username or password.',
    });
  }

  if (!foundUser.isActive) {
    return res.status(403).json({
      success: false,
      error: 'This account has been disabled. Please contact the Owner.',
    });
  }

  const isValid = verifyPassword(cleanPassword, foundUser.passwordHash);
  if (!isValid) {
    return res.status(401).json({
      success: false,
      error: 'Invalid username or password.',
    });
  }

  // Create isolated session token (64 hex characters)
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

  if (!db.sessions) db.sessions = {};
  db.sessions[token] = {
    userId: foundUser.id,
    createdAt: new Date().toISOString(),
    expiresAt,
  };
  writeDb(db);

  return res.json({
    success: true,
    token,
    user: sanitizeUser(foundUser),
  });
});

// GET /api/auth/me
app.get('/api/auth/me', authMiddleware as any, (req: any, res) => {
  return res.json({
    success: true,
    user: sanitizeUser(req.user),
  });
});

// POST /api/auth/logout
app.post('/api/auth/logout', authMiddleware as any, (req: any, res) => {
  const token = req.token;
  if (token) {
    const db = readDb();
    if (db.sessions && db.sessions[token]) {
      delete db.sessions[token];
      writeDb(db);
    }
  }
  return res.json({ success: true, message: 'Logged out successfully.' });
});

// -------------------------------------------------------------
// Staff & User Management Routes (/api/users)
// -------------------------------------------------------------

// GET /api/users - Read list of users
app.get('/api/users', (req, res) => {
  const db = readDb();
  return res.json({
    success: true,
    users: db.users.map(sanitizeUser),
  });
});

// POST /api/users - Create new staff user (Owner ONLY)
app.post('/api/users', authMiddleware as any, requireOwner as any, (req: any, res) => {
  const { name, username, password, role } = req.body;

  if (!name || typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ success: false, error: 'Full name is required.' });
  }
  if (!username || typeof username !== 'string' || !username.trim()) {
    return res.status(400).json({ success: false, error: 'Username is required.' });
  }
  if (!password || typeof password !== 'string' || password.trim().length < 4) {
    return res
      .status(400)
      .json({ success: false, error: 'Password must be at least 4 characters long.' });
  }

  const validRoles: UserRole[] = ['owner', 'manager', 'cashier', 'waiter', 'kitchen'];
  if (!role || !validRoles.includes(role)) {
    return res.status(400).json({ success: false, error: 'Valid user role is required.' });
  }

  const cleanUsername = username.trim().toLowerCase();
  const db = readDb();

  if (db.users.some((u) => u.username.toLowerCase() === cleanUsername)) {
    return res.status(409).json({
      success: false,
      error: `Username "${username.trim()}" is already in use. Please choose another.`,
    });
  }

  const newUser: User = {
    id: `usr-${Date.now()}`,
    name: name.trim(),
    username: username.trim(),
    passwordHash: hashPassword(password.trim()),
    role,
    isActive: true,
    createdAt: new Date().toISOString(),
  };

  db.users.push(newUser);
  writeDb(db);

  return res.status(201).json({
    success: true,
    user: sanitizeUser(newUser),
  });
});

// PUT /api/users/:id - Edit staff name, username, role (Owner ONLY)
app.put('/api/users/:id', authMiddleware as any, requireOwner as any, (req: any, res) => {
  const userId = req.params.id;
  const { name, username, role } = req.body;

  if (!name || typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ success: false, error: 'Full name is required.' });
  }
  if (!username || typeof username !== 'string' || !username.trim()) {
    return res.status(400).json({ success: false, error: 'Username is required.' });
  }

  const validRoles: UserRole[] = ['owner', 'manager', 'cashier', 'waiter', 'kitchen'];
  if (!role || !validRoles.includes(role)) {
    return res.status(400).json({ success: false, error: 'Valid user role is required.' });
  }

  const cleanUsername = username.trim().toLowerCase();
  const db = readDb();

  const userIndex = db.users.findIndex((u) => u.id === userId);
  if (userIndex === -1) {
    return res.status(404).json({ success: false, error: 'Staff member record not found.' });
  }

  // Check username conflict with another user
  const conflict = db.users.find(
    (u) => u.id !== userId && u.username.toLowerCase() === cleanUsername
  );
  if (conflict) {
    return res.status(409).json({
      success: false,
      error: `Username "${username.trim()}" is already in use by another staff member.`,
    });
  }

  const targetUser = db.users[userIndex];

  // Prevent demoting the last active owner
  if (targetUser.role === 'owner' && role !== 'owner') {
    const otherOwners = db.users.filter((u) => u.role === 'owner' && u.isActive && u.id !== userId);
    if (otherOwners.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Cannot change the role of the only remaining active Owner.',
      });
    }
  }

  // Update staff user permanently in the database
  const updatedUser: User = {
    ...targetUser,
    name: name.trim(),
    username: username.trim(),
    role,
  };

  db.users[userIndex] = updatedUser;
  writeDb(db);

  return res.json({
    success: true,
    user: sanitizeUser(updatedUser),
  });
});

// PUT /api/users/:id/password - Reset staff password (Owner ONLY)
app.put(
  '/api/users/:id/password',
  authMiddleware as any,
  requireOwner as any,
  (req: any, res) => {
    const userId = req.params.id;
    const { password } = req.body;

    if (!password || typeof password !== 'string' || password.trim().length < 4) {
      return res
        .status(400)
        .json({ success: false, error: 'New password must be at least 4 characters long.' });
    }

    const db = readDb();
    const userIndex = db.users.findIndex((u) => u.id === userId);
    if (userIndex === -1) {
      return res.status(404).json({ success: false, error: 'User not found.' });
    }

    db.users[userIndex].passwordHash = hashPassword(password.trim());
    writeDb(db);

    return res.json({ success: true, message: 'Password updated successfully.' });
  }
);

// PUT /api/users/:id/status - Enable or disable staff account (Owner ONLY)
app.put('/api/users/:id/status', authMiddleware as any, requireOwner as any, (req: any, res) => {
  const userId = req.params.id;
  const db = readDb();
  const userIndex = db.users.findIndex((u) => u.id === userId);
  if (userIndex === -1) {
    return res.status(404).json({ success: false, error: 'User not found.' });
  }

  if (req.user?.id === userId) {
    return res.status(400).json({
      success: false,
      error: 'You cannot disable your own active account.',
    });
  }

  const target = db.users[userIndex];
  if (target.role === 'owner' && target.isActive) {
    const otherOwners = db.users.filter((u) => u.role === 'owner' && u.isActive && u.id !== userId);
    if (otherOwners.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Cannot disable the only active Owner account.',
      });
    }
  }

  target.isActive = !target.isActive;
  db.users[userIndex] = target;

  // Invalidate any active sessions for this disabled user
  if (!target.isActive && db.sessions) {
    for (const [sToken, sData] of Object.entries(db.sessions)) {
      if (sData.userId === userId) {
        delete db.sessions[sToken];
      }
    }
  }

  writeDb(db);

  return res.json({
    success: true,
    user: sanitizeUser(target),
  });
});

// DELETE /api/users/:id - Delete staff member (Owner ONLY)
app.delete('/api/users/:id', authMiddleware as any, requireOwner as any, (req: any, res) => {
  const userId = req.params.id;
  const db = readDb();

  if (req.user?.id === userId) {
    return res.status(400).json({
      success: false,
      error: 'You cannot delete your own active account.',
    });
  }

  const target = db.users.find((u) => u.id === userId);
  if (!target) {
    return res.status(404).json({ success: false, error: 'User not found.' });
  }

  if (target.role === 'owner') {
    const otherOwners = db.users.filter((u) => u.role === 'owner' && u.id !== userId);
    if (otherOwners.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Cannot delete the only remaining Owner.',
      });
    }
  }

  db.users = db.users.filter((u) => u.id !== userId);
  if (db.sessions) {
    for (const [sToken, sData] of Object.entries(db.sessions)) {
      if (sData.userId === userId) {
        delete db.sessions[sToken];
      }
    }
  }
  writeDb(db);

  return res.json({ success: true, message: 'User deleted successfully.' });
});

// -------------------------------------------------------------
// Full Sync Route (/api/sync)
// -------------------------------------------------------------
app.get('/api/sync', (req, res) => {
  const db = readDb();
  return res.json({
    success: true,
    users: db.users.map(sanitizeUser),
    settings: db.settings,
    tables: db.tables,
    menu: db.menu,
    categories: db.categories,
    subcategories: db.subcategories,
    orders: db.orders,
    kots: db.kots,
    bills: db.bills,
  });
});

app.post('/api/sync', authMiddleware as any, (req: any, res) => {
  const { tables, orders, kots, bills, settings, menu, categories, subcategories } = req.body;
  const db = readDb();

  if (Array.isArray(tables)) db.tables = tables;
  if (Array.isArray(orders)) db.orders = orders;
  if (Array.isArray(kots)) db.kots = kots;
  if (Array.isArray(bills)) db.bills = bills;
  if (settings && typeof settings === 'object') db.settings = { ...db.settings, ...settings };
  if (Array.isArray(menu)) db.menu = menu;
  if (Array.isArray(categories)) db.categories = categories;
  if (Array.isArray(subcategories)) db.subcategories = subcategories;

  writeDb(db);
  return res.json({ success: true });
});

// -------------------------------------------------------------
// Vite Dev Middleware or Static Serving
// -------------------------------------------------------------
async function setupVite() {
  const isProduction = process.env.NODE_ENV === 'production';

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true, host: '0.0.0.0', port },
      appType: 'spa',
    });
    app.use(vite.middlewares);
    console.info(`[Server] Vite middleware mounted for development on port ${port}`);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
    console.info(`[Server] Serving production static build from ${distPath}`);
  }

  app.listen(port, '0.0.0.0', () => {
    console.info(`[Server] Restaurant POS backend server running at http://0.0.0.0:${port}`);
  });
}

setupVite().catch((err) => {
  console.error('[Server] Fatal error starting server:', err);
  process.exit(1);
});
