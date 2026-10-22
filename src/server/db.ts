import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import {
  Order,
  CaseRecord,
  CaseEvent,
  CaseType,
  CaseStatus,
  EligibilityDecision,
  EventActor,
  CaseEventType,
} from './types.ts';
import { INITIAL_DEMO_ORDERS, getDemoReferenceDate } from './demoData.ts';

let dbInstance: DatabaseSync | null = null;

export function getDb(): DatabaseSync {
  if (dbInstance) {
    return dbInstance;
  }

  const dataDir = path.resolve(process.cwd(), 'data');
  if (!fs.existsSync(dataDir)) {
    try {
      fs.mkdirSync(dataDir, { recursive: true });
    } catch {
      // ignore
    }
  }

  const dbPath = path.join(dataDir, 'returnrelay.sqlite');
  try {
    dbInstance = new DatabaseSync(dbPath);
  } catch (err) {
    console.warn('Falling back to in-memory SQLite database:', err);
    dbInstance = new DatabaseSync(':memory:');
  }

  initSchema(dbInstance);
  return dbInstance;
}

function initSchema(db: DatabaseSync) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      customer_name TEXT NOT NULL,
      customer_email TEXT NOT NULL,
      product_name TEXT NOT NULL,
      product_category TEXT NOT NULL,
      product_sku TEXT NOT NULL,
      price_cents INTEGER NOT NULL,
      currency TEXT NOT NULL DEFAULT 'USD',
      purchase_date TEXT NOT NULL,
      delivery_date TEXT NOT NULL,
      order_status TEXT NOT NULL,
      return_window_days INTEGER NOT NULL DEFAULT 30,
      warranty_window_days INTEGER NOT NULL DEFAULT 365,
      policy_notes TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS cases (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL,
      case_type TEXT NOT NULL,
      issue_description TEXT NOT NULL,
      eligibility_decision TEXT NOT NULL,
      policy_reason TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending_approval',
      proposed_action TEXT NOT NULL,
      resolution_details TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (order_id) REFERENCES orders(id)
    );

    CREATE TABLE IF NOT EXISTS case_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      case_id TEXT NOT NULL,
      event_type TEXT NOT NULL,
      actor TEXT NOT NULL,
      summary TEXT NOT NULL,
      metadata_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Check if orders table is empty; if so, seed
  const countRow = db.prepare('SELECT COUNT(*) as count FROM orders').get() as { count: number };
  if (!countRow || countRow.count === 0) {
    seedOrders(db);
  }
}

export function seedOrders(db: DatabaseSync = getDb()) {
  const insertStmt = db.prepare(`
    INSERT OR REPLACE INTO orders (
      id, customer_name, customer_email, product_name, product_category,
      product_sku, price_cents, currency, purchase_date, delivery_date,
      order_status, return_window_days, warranty_window_days, policy_notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const o of INITIAL_DEMO_ORDERS) {
    insertStmt.run(
      o.id,
      o.customerName,
      o.customerEmail,
      o.productName,
      o.productCategory,
      o.productSku,
      o.priceCents,
      o.currency,
      o.purchaseDate,
      o.deliveryDate,
      o.orderStatus,
      o.returnWindowDays,
      o.warrantyWindowDays,
      o.policyNotes
    );
  }
}

function mapOrderRow(row: Record<string, unknown>): Order {
  return {
    id: String(row.id),
    customerName: String(row.customer_name),
    customerEmail: String(row.customer_email),
    productName: String(row.product_name),
    productCategory: String(row.product_category),
    productSku: String(row.product_sku),
    priceCents: Number(row.price_cents),
    currency: String(row.currency || 'USD'),
    purchaseDate: String(row.purchase_date),
    deliveryDate: String(row.delivery_date),
    orderStatus: row.order_status as Order['orderStatus'],
    returnWindowDays: Number(row.return_window_days),
    warrantyWindowDays: Number(row.warranty_window_days),
    policyNotes: String(row.policy_notes),
  };
}

function mapCaseRow(row: Record<string, unknown>, order?: Order): CaseRecord {
  return {
    id: String(row.id),
    orderId: String(row.order_id),
    caseType: row.case_type as CaseType,
    issueDescription: String(row.issue_description),
    eligibilityDecision: row.eligibility_decision as EligibilityDecision,
    policyReason: String(row.policy_reason),
    status: row.status as CaseStatus,
    proposedAction: String(row.proposed_action),
    resolutionDetails: String(row.resolution_details),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    order,
  };
}

function mapEventRow(row: Record<string, unknown>): CaseEvent {
  return {
    id: Number(row.id),
    caseId: String(row.case_id),
    eventType: row.event_type as CaseEventType,
    actor: row.actor as EventActor,
    summary: String(row.summary),
    metadataJson: String(row.metadata_json),
    createdAt: String(row.created_at),
  };
}

export function getAllOrders(): Order[] {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM orders ORDER BY purchase_date DESC').all() as Record<string, unknown>[];
  return rows.map(mapOrderRow);
}

export function getOrderById(id: string): Order | null {
  const db = getDb();
  const row = db.prepare('SELECT * FROM orders WHERE id = ?').get(id.toUpperCase().trim()) as Record<string, unknown> | undefined;
  if (!row) return null;
  return mapOrderRow(row);
}

export function searchOrders(query: string): Order[] {
  const db = getDb();
  const q = query.trim().toLowerCase();
  if (!q) return getAllOrders();

  // 1. Direct ID match
  const directMatch = getOrderById(q);
  if (directMatch) return [directMatch];

  // 2. Keyword search on product name, sku, category
  const all = getAllOrders();
  const matches = all.filter(o => {
    return (
      o.id.toLowerCase().includes(q) ||
      o.productName.toLowerCase().includes(q) ||
      o.productCategory.toLowerCase().includes(q) ||
      o.productSku.toLowerCase().includes(q)
    );
  });

  return matches;
}

export function getAllCases(): CaseRecord[] {
  const db = getDb();
  const rows = db.prepare(`
    SELECT c.*, o.product_name, o.product_category, o.purchase_date, o.delivery_date, o.customer_name
    FROM cases c
    LEFT JOIN orders o ON c.order_id = o.id
    ORDER BY c.created_at DESC
  `).all() as Record<string, unknown>[];

  return rows.map(r => {
    const order = r.order_id ? getOrderById(String(r.order_id)) || undefined : undefined;
    return mapCaseRow(r, order);
  });
}

export function getCaseById(id: string): CaseRecord | null {
  const db = getDb();
  const row = db.prepare('SELECT * FROM cases WHERE id = ?').get(id.trim()) as Record<string, unknown> | undefined;
  if (!row) return null;
  const order = getOrderById(String(row.order_id)) || undefined;
  return mapCaseRow(row, order);
}

export function getCaseEvents(caseId: string): CaseEvent[] {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM case_events WHERE case_id = ? ORDER BY id ASC').all(caseId.trim()) as Record<string, unknown>[];
  return rows.map(mapEventRow);
}

export function getAllEvents(): CaseEvent[] {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM case_events ORDER BY id DESC LIMIT 50').all() as Record<string, unknown>[];
  return rows.map(mapEventRow);
}

export function insertCase(data: {
  orderId: string;
  caseType: CaseType;
  issueDescription: string;
  eligibilityDecision: EligibilityDecision;
  policyReason: string;
  proposedAction: string;
  resolutionDetails?: string;
}): CaseRecord {
  const db = getDb();
  const countRow = db.prepare('SELECT COUNT(*) as count FROM cases').get() as { count: number };
  const nextNum = (countRow ? countRow.count : 0) + 1001;
  const year = new Date().getFullYear();
  const caseId = `CASE-${year}-${nextNum}`;
  const now = new Date().toISOString();

  const insertStmt = db.prepare(`
    INSERT INTO cases (
      id, order_id, case_type, issue_description, eligibility_decision,
      policy_reason, status, proposed_action, resolution_details, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, 'pending_approval', ?, ?, ?, ?)
  `);

  insertStmt.run(
    caseId,
    data.orderId,
    data.caseType,
    data.issueDescription,
    data.eligibilityDecision,
    data.policyReason,
    data.proposedAction,
    data.resolutionDetails || 'Pending explicit user approval in the ReturnRelay interface.',
    now,
    now
  );

  // Record audit event
  recordEvent({
    caseId,
    eventType: 'case_prepared',
    actor: 'agent',
    summary: `Prepared ${data.caseType} case for simulated order ${data.orderId}: ${data.proposedAction}`,
    metadata: {
      orderId: data.orderId,
      caseType: data.caseType,
      policyReason: data.policyReason,
    },
  });

  return getCaseById(caseId)!;
}

export function findExistingCaseForOrder(orderId: string, caseType?: CaseType): CaseRecord | null {
  const db = getDb();
  let query = "SELECT * FROM cases WHERE order_id = ? AND status IN ('pending_approval', 'approved')";
  const params: string[] = [orderId];
  if (caseType) {
    query += ' AND case_type = ?';
    params.push(caseType);
  }
  query += ' ORDER BY created_at DESC LIMIT 1';

  const row = db.prepare(query).get(...params) as Record<string, unknown> | undefined;
  if (!row) return null;
  return mapCaseRow(row, getOrderById(orderId) || undefined);
}

export function recordEvent(data: {
  caseId: string;
  eventType: CaseEventType;
  actor: EventActor;
  summary: string;
  metadata?: Record<string, unknown>;
}): CaseEvent {
  const db = getDb();
  const now = new Date().toISOString();
  const stmt = db.prepare(`
    INSERT INTO case_events (case_id, event_type, actor, summary, metadata_json, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const result = stmt.run(
    data.caseId,
    data.eventType,
    data.actor,
    data.summary,
    JSON.stringify(data.metadata || {}),
    now
  );

  const eventId = Number(result.lastInsertRowid);
  const row = db.prepare('SELECT * FROM case_events WHERE id = ?').get(eventId) as Record<string, unknown>;
  return mapEventRow(row);
}

export function approveCase(caseId: string, notes?: string): { success: boolean; case?: CaseRecord; message: string } {
  const db = getDb();
  const existing = getCaseById(caseId);
  if (!existing) {
    return { success: false, message: `Case ${caseId} not found.` };
  }

  if (existing.status !== 'pending_approval') {
    return {
      success: false,
      case: existing,
      message: `Case ${caseId} cannot be approved because its current status is '${existing.status}'. Duplicate approval prevented.`,
    };
  }

  const now = new Date().toISOString();
  const resolutionDetails = notes
    ? `Approved by user: ${notes}`
    : `Approved by user on ${now}. Demonstration return authorization label generated (RMA-${caseId.slice(-4)}).`;

  db.prepare(`
    UPDATE cases
    SET status = 'approved',
        resolution_details = ?,
        updated_at = ?
    WHERE id = ?
  `).run(resolutionDetails, now, caseId);

  recordEvent({
    caseId,
    eventType: 'user_approved',
    actor: 'user',
    summary: `User explicitly approved ${existing.caseType} case for order ${existing.orderId}.`,
    metadata: {
      previousStatus: 'pending_approval',
      newStatus: 'approved',
      resolutionDetails,
    },
  });

  const updated = getCaseById(caseId)!;
  return { success: true, case: updated, message: `Case ${caseId} successfully approved.` };
}

export function rejectCase(caseId: string, reason?: string): { success: boolean; case?: CaseRecord; message: string } {
  const db = getDb();
  const existing = getCaseById(caseId);
  if (!existing) {
    return { success: false, message: `Case ${caseId} not found.` };
  }

  if (existing.status !== 'pending_approval') {
    return {
      success: false,
      case: existing,
      message: `Case ${caseId} cannot be rejected because its current status is '${existing.status}'.`,
    };
  }

  const now = new Date().toISOString();
  const rejectionDetails = reason
    ? `Rejected by user: ${reason}`
    : `Rejected by user on ${now}. Demonstration case cancelled per customer request.`;

  db.prepare(`
    UPDATE cases
    SET status = 'rejected',
        resolution_details = ?,
        updated_at = ?
    WHERE id = ?
  `).run(rejectionDetails, now, caseId);

  recordEvent({
    caseId,
    eventType: 'user_rejected',
    actor: 'user',
    summary: `User explicitly rejected ${existing.caseType} case for order ${existing.orderId}.`,
    metadata: {
      previousStatus: 'pending_approval',
      newStatus: 'rejected',
      rejectionDetails,
    },
  });

  const updated = getCaseById(caseId)!;
  return { success: true, case: updated, message: `Case ${caseId} successfully rejected.` };
}

export function resetDemoDatabase(): { message: string; ordersReset: number; casesCleared: number } {
  const db = getDb();
  const caseCount = (db.prepare('SELECT COUNT(*) as c FROM cases').get() as { c: number }).c;
  
  db.exec(`
    DELETE FROM case_events;
    DELETE FROM cases;
    DELETE FROM orders;
  `);

  seedOrders(db);

  recordEvent({
    caseId: 'SYSTEM',
    eventType: 'system_reset',
    actor: 'system',
    summary: 'Demonstration dataset reset to initial state. All demo cases cleared.',
    metadata: {
      referenceDate: getDemoReferenceDate(),
      ordersCount: INITIAL_DEMO_ORDERS.length,
    },
  });

  return {
    message: 'Demonstration dataset successfully reset to initial deterministic state.',
    ordersReset: INITIAL_DEMO_ORDERS.length,
    casesCleared: caseCount,
  };
}
