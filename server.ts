import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { INITIAL_USERS, INITIAL_BILLS } from './src/data/initialData';
import { hashPassword, verifyPassword } from './src/utils/security';
import { Bill, User, UserRole } from './src/types/pos';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SERVER_SECRET = process.env.POS_SERVER_SECRET || 'prime_pos_owner_secret_salt_2026';
const DATA_DIR = path.resolve(__dirname, 'data');
const STORE_FILE = path.resolve(DATA_DIR, 'pos_server_store.json');
const AUDIT_FILE = path.resolve(DATA_DIR, 'deleted_bills_audit.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// -------------------------------------------------------------
// Server Persistence Layer
// -------------------------------------------------------------
interface ServerStore {
  bills: Bill[];
  users: User[];
}

function loadServerStore(): ServerStore {
  try {
    if (fs.existsSync(STORE_FILE)) {
      const content = fs.readFileSync(STORE_FILE, 'utf-8');
      const parsed = JSON.parse(content);
      return {
        bills: Array.isArray(parsed.bills) ? parsed.bills : [...INITIAL_BILLS],
        users: Array.isArray(parsed.users) ? parsed.users : [...INITIAL_USERS],
      };
    }
  } catch (err) {
    console.error('Error reading server store:', err);
  }
  return {
    bills: [...INITIAL_BILLS],
    users: [...INITIAL_USERS],
  };
}

function saveServerStore(store: ServerStore): void {
  try {
    fs.writeFileSync(STORE_FILE, JSON.stringify(store, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving server store:', err);
  }
}

function logDeletedBillAudit(auditEntry: Record<string, any>): void {
  try {
    let audits: any[] = [];
    if (fs.existsSync(AUDIT_FILE)) {
      const content = fs.readFileSync(AUDIT_FILE, 'utf-8');
      audits = JSON.parse(content);
    }
    audits.unshift(auditEntry);
    fs.writeFileSync(AUDIT_FILE, JSON.stringify(audits, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving audit log:', err);
  }
}

let store: ServerStore = loadServerStore();

// -------------------------------------------------------------
// Cryptographic Token Signing & Verification
// -------------------------------------------------------------
export interface TokenPayload {
  userId: string;
  username: string;
  role: UserRole;
  name: string;
  iat: number;
  exp: number;
}

export function createSessionToken(user: { id: string; username: string; role: UserRole; name: string }): string {
  const iat = Date.now();
  const exp = iat + 24 * 60 * 60 * 1000; // 24 hours
  const payload: TokenPayload = {
    userId: user.id,
    username: user.username,
    role: user.role,
    name: user.name,
    iat,
    exp,
  };
  const base64Payload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', SERVER_SECRET).update(base64Payload).digest('base64url');
  return `${base64Payload}.${signature}`;
}

export function verifySessionToken(token: string): { valid: boolean; payload?: TokenPayload; error?: string } {
  if (!token || typeof token !== 'string') {
    return { valid: false, error: 'Authorization token missing.' };
  }
  const parts = token.split('.');
  if (parts.length !== 2) {
    return { valid: false, error: 'Malformed authorization token.' };
  }
  const [base64Payload, signature] = parts;
  const expectedSig = crypto.createHmac('sha256', SERVER_SECRET).update(base64Payload).digest('base64url');
  if (signature !== expectedSig) {
    return { valid: false, error: 'Invalid cryptographic token signature.' };
  }
  try {
    const payload: TokenPayload = JSON.parse(Buffer.from(base64Payload, 'base64url').toString('utf-8'));
    if (Date.now() > payload.exp) {
      return { valid: false, error: 'Authorization token has expired. Please log in again.' };
    }
    return { valid: true, payload };
  } catch {
    return { valid: false, error: 'Corrupted token payload.' };
  }
}

// Helper: Extract date YYYY-MM-DD from ISO string in local timezone
function getBillDateString(isoString: string): string {
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// -------------------------------------------------------------
// Express Server Setup
// -------------------------------------------------------------
async function startServer() {
  const app = express();
  app.use(express.json({ limit: '10mb' }));

  // Parse arguments for port/host
  const args = process.argv.slice(2);
  let port = Number(process.env.PORT) || 3000;
  let host = process.env.HOST || '0.0.0.0';

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--port' && args[i + 1]) {
      port = Number(args[i + 1]) || port;
      i++;
    } else if (args[i].startsWith('--port=')) {
      port = Number(args[i].split('=')[1]) || port;
    } else if (args[i] === '--host' && args[i + 1]) {
      host = args[i + 1];
      i++;
    } else if (args[i].startsWith('--host=')) {
      host = args[i].split('=')[1] || host;
    }
  }

  // -------------------------------------------------------------
  // Auth Middleware
  // -------------------------------------------------------------
  function requireAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized: Missing or invalid Authorization header.',
      });
    }
    const token = authHeader.substring(7);
    const verification = verifySessionToken(token);
    if (!verification.valid || !verification.payload) {
      return res.status(401).json({
        success: false,
        error: verification.error || 'Unauthorized: Invalid token.',
      });
    }
    (req as any).user = verification.payload;
    next();
  }

  function requireOwner(req: express.Request, res: express.Response, next: express.NextFunction) {
    requireAuth(req, res, () => {
      const user = (req as any).user as TokenPayload;
      if (user.role !== 'owner') {
        return res.status(403).json({
          success: false,
          error: `Forbidden: Access restricted to authenticated Owner. Your role (${user.role.toUpperCase()}) cannot access this data or action.`,
        });
      }
      next();
    });
  }

  // -------------------------------------------------------------
  // API Routes
  // -------------------------------------------------------------

  // 1. Login
  app.post('/api/auth/login', (req, res) => {
    const { username, password } = req.body;
    if (!username) {
      return res.status(400).json({ success: false, error: 'Username is required.' });
    }
    const cleanUser = String(username).trim().toLowerCase();
    const cleanPass = String(password || '').trim();

    const user = store.users.find((u) => u.username.toLowerCase() === cleanUser);
    if (!user) {
      return res.status(401).json({ success: false, error: 'Invalid username or password.' });
    }
    if (!user.isActive) {
      return res.status(403).json({ success: false, error: 'This account has been disabled. Please contact the administrator.' });
    }

    const isMatch = verifyPassword(cleanPass, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ success: false, error: 'Invalid username or password.' });
    }

    const token = createSessionToken(user);
    return res.json({
      success: true,
      token,
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        role: user.role,
        isActive: user.isActive,
      },
    });
  });

  // 2. Quick login helper for demo/staff switching
  app.post('/api/auth/quick-login', (req, res) => {
    const { role } = req.body;
    const user = store.users.find((u) => u.role === role && u.isActive) || store.users.find((u) => u.role === role);
    if (!user) {
      return res.status(404).json({ success: false, error: `No active account for role: ${role}` });
    }
    const token = createSessionToken(user);
    return res.json({
      success: true,
      token,
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        role: user.role,
        isActive: user.isActive,
      },
    });
  });

  // 3. Verify session token
  app.get('/api/auth/verify', requireAuth, (req, res) => {
    const user = (req as any).user as TokenPayload;
    return res.json({
      success: true,
      user,
    });
  });

  // 4. Daily Sales & Reports (STRICTLY OWNER-ONLY)
  app.get('/api/reports/daily-sales', requireOwner, (req, res) => {
    const todayStr = getBillDateString(new Date().toISOString());
    const selectedDate = (req.query.date as string) || todayStr;

    // Filter bills for the given date in local timezone
    const matchingBills = store.bills.filter((b) => {
      const bDate = getBillDateString(b.paidAt);
      return bDate === selectedDate;
    });

    // Calculate metrics
    const totalSales = matchingBills.reduce((sum, b) => sum + b.grandTotal, 0);
    const totalOrders = matchingBills.length;
    const avgOrderValue = totalOrders > 0 ? Math.round(totalSales / totalOrders) : 0;
    const totalDiscount = matchingBills.reduce((sum, b) => sum + b.discountAmount, 0);
    const totalCGST = matchingBills.reduce((sum, b) => sum + b.cgstAmount, 0);
    const totalSGST = matchingBills.reduce((sum, b) => sum + b.sgstAmount, 0);
    const totalTax = totalCGST + totalSGST;
    const netTaxable = totalSales - totalTax;

    const cashBills = matchingBills.filter((b) => b.paymentMethod === 'cash');
    const upiBills = matchingBills.filter((b) => b.paymentMethod === 'upi');
    const cardBills = matchingBills.filter((b) => b.paymentMethod === 'card');

    const cashTotal = cashBills.reduce((s, b) => s + b.grandTotal, 0);
    const upiTotal = upiBills.reduce((s, b) => s + b.grandTotal, 0);
    const cardTotal = cardBills.reduce((s, b) => s + b.grandTotal, 0);

    // Top selling items for this date
    const itemCounts: Record<string, { qty: number; total: number; isVeg: boolean }> = {};
    matchingBills.forEach((b) => {
      b.items.forEach((it) => {
        if (!itemCounts[it.name]) {
          itemCounts[it.name] = { qty: 0, total: 0, isVeg: it.isVeg };
        }
        itemCounts[it.name].qty += it.quantity;
        itemCounts[it.name].total += it.price * it.quantity;
      });
    });

    const topItems = Object.entries(itemCounts)
      .sort((a, b) => b[1].qty - a[1].qty)
      .slice(0, 10);

    return res.json({
      success: true,
      date: selectedDate,
      bills: matchingBills,
      metrics: {
        totalSales,
        totalOrders,
        avgOrderValue,
        totalDiscount,
        totalCGST,
        totalSGST,
        totalTax,
        netTaxable,
        cashTotal,
        upiTotal,
        cardTotal,
        cashCount: cashBills.length,
        upiCount: upiBills.length,
        cardCount: cardBills.length,
      },
      topItems,
    });
  });

  // 5. Delete Bill (STRICTLY OWNER-ONLY)
  app.delete('/api/bills/:id', requireOwner, (req, res) => {
    const billId = req.params.id;
    const user = (req as any).user as TokenPayload;

    const billIndex = store.bills.findIndex((b) => b.id === billId);
    if (billIndex === -1) {
      return res.status(404).json({
        success: false,
        error: `Bill with ID "${billId}" not found.`,
      });
    }

    const billToDelete = store.bills[billIndex];

    // Remove bill from store
    store.bills.splice(billIndex, 1);
    saveServerStore(store);

    // Log audit trail for legal & accounting records
    logDeletedBillAudit({
      action: 'BILL_DELETED',
      billId: billToDelete.id,
      billNumber: billToDelete.billNumber,
      orderId: billToDelete.orderId,
      tableId: billToDelete.tableId,
      grandTotal: billToDelete.grandTotal,
      subtotal: billToDelete.subtotal,
      cgstAmount: billToDelete.cgstAmount,
      sgstAmount: billToDelete.sgstAmount,
      discountAmount: billToDelete.discountAmount,
      paymentMethod: billToDelete.paymentMethod,
      itemsCount: billToDelete.items.length,
      originalPaidAt: billToDelete.paidAt,
      originalCashier: billToDelete.cashierName,
      deletedAt: new Date().toISOString(),
      deletedByUsername: user.username,
      deletedByRole: user.role,
    });

    return res.json({
      success: true,
      message: `Bill ${billToDelete.billNumber} successfully deleted by Owner.`,
      deletedBill: {
        id: billToDelete.id,
        billNumber: billToDelete.billNumber,
        grandTotal: billToDelete.grandTotal,
      },
    });
  });

  // 6. Get all bills (for authenticated staff syncing/reprints)
  app.get('/api/bills', requireAuth, (req, res) => {
    const user = (req as any).user as TokenPayload;
    if (user.role === 'owner') {
      return res.json({ success: true, bills: store.bills });
    }
    // For non-owner staff, return bills metadata for printing without aggregate revenue metrics
    return res.json({ success: true, bills: store.bills });
  });

  // 7. Save / Settle a Bill
  app.post('/api/bills', requireAuth, (req, res) => {
    const newBill = req.body as Bill;
    if (!newBill || !newBill.id || !newBill.billNumber) {
      return res.status(400).json({ success: false, error: 'Invalid bill payload.' });
    }

    const existingIdx = store.bills.findIndex((b) => b.id === newBill.id);
    if (existingIdx >= 0) {
      store.bills[existingIdx] = newBill;
    } else {
      store.bills.unshift(newBill);
    }
    saveServerStore(store);
    return res.json({ success: true, bill: newBill });
  });

  // 8. Bulk Sync Bills (Preserve existing client records without loss)
  app.post('/api/bills/sync', requireAuth, (req, res) => {
    const { bills } = req.body;
    if (Array.isArray(bills)) {
      let count = 0;
      bills.forEach((b: Bill) => {
        if (b && b.id && !store.bills.some((existing) => existing.id === b.id)) {
          store.bills.push(b);
          count++;
        }
      });
      if (count > 0) {
        saveServerStore(store);
      }
    }
    return res.json({ success: true, totalBills: store.bills.length });
  });

  // -------------------------------------------------------------
  // Frontend Middleware / Static files
  // -------------------------------------------------------------
  if (process.env.NODE_ENV === 'production' && fs.existsSync(path.resolve(__dirname, 'dist'))) {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(port, host, () => {
    console.log(`Server listening on http://${host}:${port}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
