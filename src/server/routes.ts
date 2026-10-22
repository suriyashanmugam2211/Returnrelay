import { Router, Request, Response } from 'express';
import { z } from 'zod';
import {
  getAllOrders,
  getOrderById,
  getAllCases,
  getCaseById,
  getCaseEvents,
  getAllEvents,
  approveCase,
  rejectCase,
  resetDemoDatabase,
} from './db.ts';
import { evaluateEligibility } from './eligibility.ts';
import { runAgentConversation } from './agent.ts';
import { getDemoReferenceDate } from './demoData.ts';

export const apiRouter = Router();

// -------------------------------------------------------------
// GET /api/health
// -------------------------------------------------------------
apiRouter.get('/health', (_req: Request, res: Response) => {
  const groqConfigured = Boolean(
    process.env.GROQ_API_KEY &&
      !process.env.GROQ_API_KEY.startsWith('MY_') &&
      process.env.GROQ_API_KEY !== 'gsk_your_groq_api_key_here'
  );

  res.json({
    status: 'ok',
    service: 'ReturnRelay Backend API',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    demoClockReferenceDate: getDemoReferenceDate(),
    aiProvider: {
      groqConfigured,
      groqModel: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
      activeMode: groqConfigured ? 'groq' : 'local_rule_engine',
    },
    database: {
      type: 'sqlite',
      status: 'connected',
    },
    simulationDisclaimer: 'All order records, returns, and transactions are simulated demonstration data.',
  });
});

// -------------------------------------------------------------
// GET /api/orders
// -------------------------------------------------------------
apiRouter.get('/orders', (_req: Request, res: Response) => {
  try {
    const orders = getAllOrders();
    res.json({
      success: true,
      count: orders.length,
      orders,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ success: false, error: message });
  }
});

// -------------------------------------------------------------
// GET /api/orders/:id
// -------------------------------------------------------------
apiRouter.get('/orders/:id', (req: Request, res: Response) => {
  try {
    const order = getOrderById(req.params.id);
    if (!order) {
      res.status(404).json({ success: false, error: `Order ${req.params.id} not found.` });
      return;
    }
    const eligibility = evaluateEligibility(order);
    res.json({
      success: true,
      order,
      eligibility,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ success: false, error: message });
  }
});

// -------------------------------------------------------------
// GET /api/cases
// -------------------------------------------------------------
apiRouter.get('/cases', (_req: Request, res: Response) => {
  try {
    const cases = getAllCases();
    res.json({
      success: true,
      count: cases.length,
      cases,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ success: false, error: message });
  }
});

// -------------------------------------------------------------
// GET /api/cases/:id
// -------------------------------------------------------------
apiRouter.get('/cases/:id', (req: Request, res: Response) => {
  try {
    const c = getCaseById(req.params.id);
    if (!c) {
      res.status(404).json({ success: false, error: `Case ${req.params.id} not found.` });
      return;
    }
    const events = getCaseEvents(c.id);
    res.json({
      success: true,
      case: c,
      events,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ success: false, error: message });
  }
});

// -------------------------------------------------------------
// GET /api/cases/:id/events
// -------------------------------------------------------------
apiRouter.get('/cases/:id/events', (req: Request, res: Response) => {
  try {
    const events = getCaseEvents(req.params.id);
    res.json({
      success: true,
      caseId: req.params.id,
      count: events.length,
      events,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ success: false, error: message });
  }
});

// -------------------------------------------------------------
// GET /api/events (All recent activity events)
// -------------------------------------------------------------
apiRouter.get('/events', (_req: Request, res: Response) => {
  try {
    const events = getAllEvents();
    res.json({
      success: true,
      count: events.length,
      events,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ success: false, error: message });
  }
});

// -------------------------------------------------------------
// POST /api/chat
// -------------------------------------------------------------
const ChatPayloadSchema = z.object({
  message: z.string().min(1, 'Message cannot be empty'),
  history: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string(),
      })
    )
    .optional()
    .default([]),
});

apiRouter.post('/chat', async (req: Request, res: Response) => {
  try {
    const parsed = ChatPayloadSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        error: 'Invalid chat request payload',
        details: parsed.error.issues,
      });
      return;
    }

    const { message, history } = parsed.data;
    const agentResult = await runAgentConversation(history, message);

    res.json({
      success: true,
      message: agentResult.message,
      toolCalls: agentResult.toolCalls,
      pendingApproval: agentResult.pendingApproval,
      provider: agentResult.provider,
      timestamp: new Date().toISOString(),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({
      success: false,
      error: 'Agent conversation failed',
      details: message,
    });
  }
});

// -------------------------------------------------------------
// POST /api/cases/:id/approve
// -------------------------------------------------------------
const ApprovePayloadSchema = z.object({
  notes: z.string().optional(),
});

apiRouter.post('/cases/:id/approve', (req: Request, res: Response) => {
  try {
    const parsed = ApprovePayloadSchema.safeParse(req.body || {});
    const notes = parsed.success ? parsed.data.notes : undefined;

    const result = approveCase(req.params.id, notes);
    if (!result.success) {
      res.status(result.message.includes('not found') ? 404 : 400).json({
        success: false,
        message: result.message,
        case: result.case,
      });
      return;
    }

    res.json({
      success: true,
      message: result.message,
      case: result.case,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ success: false, error: message });
  }
});

// -------------------------------------------------------------
// POST /api/cases/:id/reject
// -------------------------------------------------------------
const RejectPayloadSchema = z.object({
  reason: z.string().optional(),
});

apiRouter.post('/cases/:id/reject', (req: Request, res: Response) => {
  try {
    const parsed = RejectPayloadSchema.safeParse(req.body || {});
    const reason = parsed.success ? parsed.data.reason : undefined;

    const result = rejectCase(req.params.id, reason);
    if (!result.success) {
      res.status(result.message.includes('not found') ? 404 : 400).json({
        success: false,
        message: result.message,
        case: result.case,
      });
      return;
    }

    res.json({
      success: true,
      message: result.message,
      case: result.case,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ success: false, error: message });
  }
});

// -------------------------------------------------------------
// POST /api/demo/reset
// -------------------------------------------------------------
apiRouter.post('/demo/reset', (_req: Request, res: Response) => {
  try {
    const result = resetDemoDatabase();
    res.json({
      success: true,
      message: result.message,
      ordersReset: result.ordersReset,
      casesCleared: result.casesCleared,
      timestamp: new Date().toISOString(),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ success: false, error: message });
  }
});
