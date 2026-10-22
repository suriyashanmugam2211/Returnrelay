import { z } from 'zod';
import {
  getAllOrders,
  getOrderById,
  searchOrders,
  getAllCases,
  getCaseById,
  getCaseEvents,
  insertCase,
  findExistingCaseForOrder,
  recordEvent,
} from './db.ts';
import { evaluateEligibility } from './eligibility.ts';
import { CaseType } from './types.ts';

// -------------------------------------------------------------
// Tool Argument Validation Schemas (Zod)
// -------------------------------------------------------------

export const FindOrderSchema = z.object({
  query: z
    .string()
    .min(1, 'Query string is required')
    .describe('Order ID (e.g. ORD-84920) or product keyword (e.g. headphones, coffee maker, boots)'),
});

export const CheckEligibilitySchema = z.object({
  order_id: z.string().min(1, 'Order ID is required').describe('The simulated order ID (e.g. ORD-84920)'),
  issue_description: z
    .string()
    .optional()
    .describe('Description of the issue (e.g. stopped working, defect, wrong size)'),
  requested_action: z
    .enum(['return', 'warranty', 'auto'])
    .optional()
    .default('auto')
    .describe('Desired resolution action or auto to let policy recommend'),
});

export const CreateCaseSchema = z.object({
  order_id: z.string().min(1, 'Order ID is required').describe('The simulated order ID to create a case for'),
  case_type: z
    .enum(['return', 'warranty_replacement', 'warranty_repair'])
    .describe('The type of case to prepare'),
  issue_description: z
    .string()
    .min(3, 'Issue description must be at least 3 characters')
    .describe('Detailed customer explanation of the issue or return reason'),
});

export const GetCaseStatusSchema = z.object({
  case_id: z.string().min(1, 'Case ID is required').describe('The case identifier (e.g. CASE-2026-1001)'),
});

export const ListOrdersSchema = z.object({
  limit: z.number().optional().default(10),
});

export const ListCasesSchema = z.object({
  limit: z.number().optional().default(10),
});

// -------------------------------------------------------------
// Tool Definitions for LLM (OpenAI / Groq format & Gemini format)
// -------------------------------------------------------------

export const AGENT_TOOLS_DEFINITIONS = [
  {
    name: 'find_order',
    description:
      'Search simulated orders by order ID (e.g. ORD-84920) or product description/keywords (e.g. "headphones", "boots"). Returns matching order details. If multiple orders match, returns ambiguity details so you can ask the user to clarify.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'The order ID or product keyword to search for',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'check_eligibility',
    description:
      'Check whether a simulated order is eligible for a standard return, warranty replacement, or warranty repair according to deterministic store policies and delivery dates. Never guess eligibility; always call this tool.',
    parameters: {
      type: 'object',
      properties: {
        order_id: {
          type: 'string',
          description: 'The simulated order ID to check (e.g. ORD-84920)',
        },
        issue_description: {
          type: 'string',
          description: 'Optional description of the product issue',
        },
        requested_action: {
          type: 'string',
          enum: ['return', 'warranty', 'auto'],
          description: 'Desired resolution action (return, warranty, or auto)',
        },
      },
      required: ['order_id'],
    },
  },
  {
    name: 'create_case',
    description:
      'Prepare a return or warranty case for a verified eligible order. Note: The created case begins in pending_approval status and requires explicit user confirmation in the UI. It does not automatically approve.',
    parameters: {
      type: 'object',
      properties: {
        order_id: {
          type: 'string',
          description: 'The simulated order ID to create the case for',
        },
        case_type: {
          type: 'string',
          enum: ['return', 'warranty_replacement', 'warranty_repair'],
          description: 'The type of case to create',
        },
        issue_description: {
          type: 'string',
          description: 'Detailed explanation of why the product is being returned or claimed',
        },
      },
      required: ['order_id', 'case_type', 'issue_description'],
    },
  },
  {
    name: 'get_case_status',
    description: 'Retrieve the current saved status, policy decision, and event history of a ReturnRelay case by case ID.',
    parameters: {
      type: 'object',
      properties: {
        case_id: {
          type: 'string',
          description: 'The unique case ID (e.g. CASE-2026-1001)',
        },
      },
      required: ['case_id'],
    },
  },
  {
    name: 'list_orders',
    description: 'List all available simulated orders in the demonstration customer profile.',
    parameters: {
      type: 'object',
      properties: {
        limit: {
          type: 'number',
          description: 'Maximum number of orders to return',
        },
      },
    },
  },
  {
    name: 'list_cases',
    description: 'List existing ReturnRelay cases and their current approval/fulfillment statuses.',
    parameters: {
      type: 'object',
      properties: {
        limit: {
          type: 'number',
          description: 'Maximum number of cases to return',
        },
      },
    },
  },
];

// -------------------------------------------------------------
// Tool Execution Engine
// -------------------------------------------------------------

export async function executeTool(toolName: string, rawArgs: unknown): Promise<{ success: boolean; data: Record<string, unknown> }> {
  try {
    switch (toolName) {
      case 'find_order': {
        const parsed = FindOrderSchema.parse(rawArgs);
        const results = searchOrders(parsed.query);

        if (results.length === 0) {
          return {
            success: true,
            data: {
              found: false,
              query: parsed.query,
              message: `No simulated orders matching "${parsed.query}" were found in your demo account.`,
            },
          };
        }

        if (results.length > 1) {
          return {
            success: true,
            data: {
              found: true,
              ambiguous: true,
              matchCount: results.length,
              matches: results.map(o => ({
                id: o.id,
                productName: o.productName,
                purchaseDate: o.purchaseDate,
                deliveryDate: o.deliveryDate,
                price: `$${(o.priceCents / 100).toFixed(2)}`,
              })),
              message: `Found ${results.length} similar orders matching "${parsed.query}". Please specify the order ID or specific item you want to address.`,
            },
          };
        }

        const match = results[0];
        return {
          success: true,
          data: {
            found: true,
            ambiguous: false,
            order: {
              id: match.id,
              productName: match.productName,
              productCategory: match.productCategory,
              productSku: match.productSku,
              purchaseDate: match.purchaseDate,
              deliveryDate: match.deliveryDate,
              orderStatus: match.orderStatus,
              price: `$${(match.priceCents / 100).toFixed(2)}`,
              returnWindowDays: match.returnWindowDays,
              warrantyWindowDays: match.warrantyWindowDays,
              policyNotes: match.policyNotes,
            },
            message: `Found order ${match.id} for "${match.productName}".`,
          },
        };
      }

      case 'check_eligibility': {
        const parsed = CheckEligibilitySchema.parse(rawArgs);
        const order = getOrderById(parsed.order_id);

        if (!order) {
          return {
            success: false,
            data: {
              found: false,
              orderId: parsed.order_id,
              error: `Order with ID "${parsed.order_id}" does not exist in simulated data.`,
            },
          };
        }

        const eligibility = evaluateEligibility(order, parsed.issue_description, parsed.requested_action);

        return {
          success: true,
          data: {
            orderId: order.id,
            productName: order.productName,
            deliveryDate: order.deliveryDate,
            daysSinceDelivery: eligibility.daysSinceDelivery,
            returnEligible: eligibility.returnEligible,
            returnWindowExpires: eligibility.returnWindowExpires,
            returnDaysRemaining: eligibility.returnDaysRemaining,
            warrantyEligible: eligibility.warrantyEligible,
            warrantyExpires: eligibility.warrantyExpires,
            warrantyDaysRemaining: eligibility.warrantyDaysRemaining,
            recommendedAction: eligibility.recommendedAction,
            policySummary: eligibility.policySummary,
            detailedExplanation: eligibility.detailedExplanation,
            options: eligibility.options,
          },
        };
      }

      case 'create_case': {
        const parsed = CreateCaseSchema.parse(rawArgs);
        const order = getOrderById(parsed.order_id);

        if (!order) {
          return {
            success: false,
            data: {
              error: `Order ${parsed.order_id} not found. Cannot create case.`,
            },
          };
        }

        // Run deterministic eligibility check
        const eligibility = evaluateEligibility(order, parsed.issue_description, parsed.case_type === 'return' ? 'return' : 'warranty');

        const option = eligibility.options.find(o => o.type === parsed.case_type);
        if (!option || !option.allowed) {
          return {
            success: false,
            data: {
              eligible: false,
              orderId: order.id,
              productName: order.productName,
              caseType: parsed.case_type,
              reason: option ? option.reason : 'Requested case type is not permitted under demo policy.',
              message: `Case creation rejected: Item is not eligible for ${parsed.case_type}. ${option?.reason || ''}`,
            },
          };
        }

        // Check for duplicate pending/approved case
        const existing = findExistingCaseForOrder(order.id, parsed.case_type);
        if (existing) {
          return {
            success: true,
            data: {
              isDuplicate: true,
              caseId: existing.id,
              status: existing.status,
              message: `A ${existing.caseType} case (${existing.id}) for order ${order.id} is already in state: ${existing.status}. Duplicate case creation prevented.`,
            },
          };
        }

        const proposedAction =
          parsed.case_type === 'return'
            ? `Standard Return authorization for full refund ($${(order.priceCents / 100).toFixed(2)}) upon carrier drop-off.`
            : parsed.case_type === 'warranty_replacement'
            ? `Manufacturer Warranty Replacement unit with expedited delivery.`
            : `Manufacturer Warranty Authorized Repair service.`;

        const newCase = insertCase({
          orderId: order.id,
          caseType: parsed.case_type as CaseType,
          issueDescription: parsed.issue_description,
          eligibilityDecision: 'eligible',
          policyReason: option.reason,
          proposedAction,
          resolutionDetails: 'Pending user review and explicit approval.',
        });

        return {
          success: true,
          data: {
            caseId: newCase.id,
            orderId: order.id,
            productName: order.productName,
            caseType: newCase.caseType,
            status: newCase.status,
            proposedAction: newCase.proposedAction,
            policyReason: newCase.policyReason,
            requiresUserApproval: true,
            message: `Case ${newCase.id} successfully prepared. It is currently PENDING approval. The user must review and click "Approve" or "Reject" to finalize.`,
          },
        };
      }

      case 'get_case_status': {
        const parsed = GetCaseStatusSchema.parse(rawArgs);
        const c = getCaseById(parsed.case_id);

        if (!c) {
          return {
            success: true,
            data: {
              found: false,
              caseId: parsed.case_id,
              message: `Case ID "${parsed.case_id}" was not found. Please verify the case ID.`,
            },
          };
        }

        const events = getCaseEvents(c.id);

        // Record a status queried event for audit trail
        recordEvent({
          caseId: c.id,
          eventType: 'status_queried',
          actor: 'agent',
          summary: `Agent retrieved status for case ${c.id}: ${c.status}`,
        });

        return {
          success: true,
          data: {
            found: true,
            case: {
              id: c.id,
              orderId: c.orderId,
              productName: c.order?.productName || 'Simulated Product',
              caseType: c.caseType,
              status: c.status,
              issueDescription: c.issueDescription,
              policyReason: c.policyReason,
              proposedAction: c.proposedAction,
              resolutionDetails: c.resolutionDetails,
              createdAt: c.createdAt,
              updatedAt: c.updatedAt,
              eventCount: events.length,
              latestEvent: events[events.length - 1]?.summary || 'None',
            },
          },
        };
      }

      case 'list_orders': {
        const orders = getAllOrders();
        return {
          success: true,
          data: {
            count: orders.length,
            orders: orders.map(o => ({
              id: o.id,
              productName: o.productName,
              category: o.productCategory,
              purchaseDate: o.purchaseDate,
              deliveryDate: o.deliveryDate,
              status: o.orderStatus,
              price: `$${(o.priceCents / 100).toFixed(2)}`,
            })),
          },
        };
      }

      case 'list_cases': {
        const cases = getAllCases();
        return {
          success: true,
          data: {
            count: cases.length,
            cases: cases.map(c => ({
              id: c.id,
              orderId: c.orderId,
              productName: c.order?.productName || 'Simulated Product',
              caseType: c.caseType,
              status: c.status,
              createdAt: c.createdAt,
            })),
          },
        };
      }

      default:
        return {
          success: false,
          data: {
            error: `Unknown tool name: ${toolName}`,
          },
        };
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      data: {
        error: `Tool execution error in ${toolName}: ${message}`,
      },
    };
  }
}
