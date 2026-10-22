import { describe, it, expect, beforeEach } from 'vitest';
import {
  getAllOrders,
  getOrderById,
  searchOrders,
  getAllCases,
  getCaseById,
  approveCase,
  rejectCase,
  resetDemoDatabase,
} from '../src/server/db.ts';
import { evaluateEligibility, calculateDaysBetween } from '../src/server/eligibility.ts';
import { executeTool } from '../src/server/tools.ts';

describe('ReturnRelay Deterministic Business Rules & Tools', () => {
  beforeEach(() => {
    resetDemoDatabase();
  });

  // 1. Order Search Success & Failure
  it('successfully finds an existing order by exact ID', () => {
    const order = getOrderById('ORD-84920');
    expect(order).not.toBeNull();
    expect(order?.productName).toContain('ApexSound');
    expect(order?.orderStatus).toBe('delivered');
  });

  it('successfully searches orders by keyword', () => {
    const results = searchOrders('headphones');
    expect(results.length).toBe(1);
    expect(results[0].id).toBe('ORD-84920');
  });

  it('handles search failure gracefully for non-existent order', () => {
    const results = searchOrders('nonexistent-gadget-xyz');
    expect(results.length).toBe(0);
  });

  // 2. Ambiguity Detection
  it('detects ambiguity when multiple similar orders match', async () => {
    const toolResult = await executeTool('find_order', { query: 'NordicTrail' });
    expect(toolResult.success).toBe(true);
    expect(toolResult.data.ambiguous).toBe(true);
    expect(toolResult.data.matchCount).toBe(2);
    expect(toolResult.data.message).toContain('Found 2 similar orders');
  });

  // 3. Eligibility Calculations
  it('correctly calculates days between dates', () => {
    const days = calculateDaysBetween('2026-10-08', '2026-10-22');
    expect(days).toBe(14);
  });

  it('evaluates inside-window return eligibility correctly (ORD-84920)', () => {
    const order = getOrderById('ORD-84920')!;
    const eligibility = evaluateEligibility(order, 'Headphones stopped playing sound', 'auto', '2026-10-22');

    expect(eligibility.isDelivered).toBe(true);
    expect(eligibility.daysSinceDelivery).toBe(14);
    expect(eligibility.returnEligible).toBe(true);
    expect(eligibility.returnDaysRemaining).toBe(16);
    expect(eligibility.recommendedAction).toBe('return');
  });

  it('evaluates return expired but warranty active (ORD-71932 Coffee Maker)', () => {
    const order = getOrderById('ORD-71932')!;
    const eligibility = evaluateEligibility(order, 'Water pump is malfunctioning', 'auto', '2026-10-22');

    expect(eligibility.isDelivered).toBe(true);
    expect(eligibility.daysSinceDelivery).toBe(100);
    expect(eligibility.returnEligible).toBe(false);
    expect(eligibility.warrantyEligible).toBe(true);
    expect(eligibility.recommendedAction).toBe('warranty_replacement');
  });

  it('evaluates completely ineligible item (ORD-58210 Desk Fan)', () => {
    const order = getOrderById('ORD-58210')!;
    const eligibility = evaluateEligibility(order, 'Fan blade broken', 'auto', '2026-10-22');

    expect(eligibility.returnEligible).toBe(false);
    expect(eligibility.warrantyEligible).toBe(false);
    expect(eligibility.recommendedAction).toBe('none');
  });

  // 4. Case Creation & Tool Execution
  it('creates a case with status pending_approval for eligible order', async () => {
    const result = await executeTool('create_case', {
      order_id: 'ORD-84920',
      case_type: 'return',
      issue_description: 'Left ear cup stopped working completely.',
    });

    expect(result.success).toBe(true);
    expect(result.data.caseId).toBeDefined();
    expect(result.data.status).toBe('pending_approval');
    expect(result.data.requiresUserApproval).toBe(true);

    const saved = getCaseById(String(result.data.caseId));
    expect(saved).not.toBeNull();
    expect(saved?.status).toBe('pending_approval');
  });

  it('prevents case creation for ineligible product under demo policy', async () => {
    const result = await executeTool('create_case', {
      order_id: 'ORD-58210',
      case_type: 'return',
      issue_description: 'Broken fan motor',
    });

    expect(result.success).toBe(false);
    expect(result.data.eligible).toBe(false);
    expect(result.data.message).toContain('rejected');
  });

  // 5. Approval, Rejection, and Duplicate Prevention
  it('approves a pending case and records audit event', async () => {
    const createRes = await executeTool('create_case', {
      order_id: 'ORD-84920',
      case_type: 'return',
      issue_description: 'Sound issue',
    });
    const caseId = String(createRes.data.caseId);

    const approveRes = approveCase(caseId, 'User clicked approve in demo UI');
    expect(approveRes.success).toBe(true);
    expect(approveRes.case?.status).toBe('approved');

    // Duplicate approval attempt must fail
    const duplicateRes = approveCase(caseId, 'Attempting duplicate approval');
    expect(duplicateRes.success).toBe(false);
    expect(duplicateRes.message).toContain('Duplicate approval prevented');
  });

  it('rejects a pending case properly', async () => {
    const createRes = await executeTool('create_case', {
      order_id: 'ORD-84920',
      case_type: 'return',
      issue_description: 'Changed my mind',
    });
    const caseId = String(createRes.data.caseId);

    const rejectRes = rejectCase(caseId, 'Customer decided to keep the product');
    expect(rejectRes.success).toBe(true);
    expect(rejectRes.case?.status).toBe('rejected');
  });

  // 6. Case Status Lookup Tool
  it('retrieves saved status and history via get_case_status tool', async () => {
    const createRes = await executeTool('create_case', {
      order_id: 'ORD-84920',
      case_type: 'return',
      issue_description: 'ANC crackling noise',
    });
    const caseId = String(createRes.data.caseId);

    const statusRes = await executeTool('get_case_status', { case_id: caseId });
    expect(statusRes.success).toBe(true);
    expect(statusRes.data.found).toBe(true);
    const caseData = statusRes.data.case as { status: string; id: string };
    expect(caseData.id).toBe(caseId);
    expect(caseData.status).toBe('pending_approval');
  });

  // 7. Tool Argument Validation (Zod)
  it('rejects invalid tool arguments cleanly', async () => {
    // Missing required query
    const badFind = await executeTool('find_order', {});
    expect(badFind.success).toBe(false);

    // Missing required case_type
    const badCase = await executeTool('create_case', { order_id: 'ORD-84920' });
    expect(badCase.success).toBe(false);
  });
});
