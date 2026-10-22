/**
 * ReturnRelay Domain & API Type Definitions
 * Simulated demonstration data and agent workflow types
 */

export interface Order {
  id: string; // e.g. ORD-84920
  customerName: string;
  customerEmail: string;
  productName: string;
  productCategory: string;
  productSku: string;
  priceCents: number;
  currency: string;
  purchaseDate: string; // YYYY-MM-DD
  deliveryDate: string; // YYYY-MM-DD
  orderStatus: 'delivered' | 'shipped' | 'processing';
  returnWindowDays: number;
  warrantyWindowDays: number;
  policyNotes: string;
  itemImageUrl?: string;
}

export type CaseType = 'return' | 'warranty_replacement' | 'warranty_repair';

export type CaseStatus = 'pending_approval' | 'approved' | 'rejected' | 'completed' | 'cancelled';

export type EligibilityDecision = 'eligible' | 'ineligible' | 'conditional';

export interface EligibilityResult {
  orderId: string;
  referenceDate: string;
  daysSinceDelivery: number;
  isDelivered: boolean;
  returnEligible: boolean;
  returnWindowExpires: string;
  returnDaysRemaining: number;
  warrantyEligible: boolean;
  warrantyExpires: string;
  warrantyDaysRemaining: number;
  recommendedAction: CaseType | 'none';
  policySummary: string;
  detailedExplanation: string;
  options: {
    type: CaseType;
    allowed: boolean;
    reason: string;
  }[];
}

export interface CaseRecord {
  id: string; // CASE-YYYY-XXXX
  orderId: string;
  caseType: CaseType;
  issueDescription: string;
  eligibilityDecision: EligibilityDecision;
  policyReason: string;
  status: CaseStatus;
  proposedAction: string;
  resolutionDetails: string;
  createdAt: string;
  updatedAt: string;
  order?: Order;
}

export type EventActor = 'agent' | 'user' | 'system';

export type CaseEventType =
  | 'case_prepared'
  | 'user_approved'
  | 'user_rejected'
  | 'status_queried'
  | 'eligibility_checked'
  | 'system_reset';

export interface CaseEvent {
  id: number;
  caseId: string;
  eventType: CaseEventType;
  actor: EventActor;
  summary: string;
  metadataJson: string;
  createdAt: string;
}

export interface ToolCallRecord {
  id: string;
  toolName: string;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  timestamp: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  toolCalls?: ToolCallRecord[];
  pendingApproval?: {
    caseId: string;
    orderId: string;
    productName: string;
    caseType: CaseType;
    issueDescription: string;
    proposedAction: string;
    policyReason: string;
  };
  timestamp: string;
}
