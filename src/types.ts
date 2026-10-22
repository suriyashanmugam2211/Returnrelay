export interface Order {
  id: string;
  customerName: string;
  customerEmail: string;
  productName: string;
  productCategory: string;
  productSku: string;
  priceCents: number;
  currency: string;
  purchaseDate: string;
  deliveryDate: string;
  orderStatus: 'delivered' | 'shipped' | 'processing';
  returnWindowDays: number;
  warrantyWindowDays: number;
  policyNotes: string;
}

export type CaseType = 'return' | 'warranty_replacement' | 'warranty_repair';
export type CaseStatus = 'pending_approval' | 'approved' | 'rejected' | 'completed' | 'cancelled';
export type EligibilityDecision = 'eligible' | 'ineligible' | 'conditional';

export interface CaseRecord {
  id: string;
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

export interface CaseEvent {
  id: number;
  caseId: string;
  eventType: string;
  actor: 'agent' | 'user' | 'system';
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

export interface PendingApprovalData {
  caseId: string;
  orderId: string;
  productName: string;
  caseType: CaseType;
  issueDescription: string;
  proposedAction: string;
  policyReason: string;
}

export interface AssistantCommand {
  text: string;
  autoSend: boolean;
  timestamp: number;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  toolCalls?: ToolCallRecord[];
  pendingApproval?: PendingApprovalData;
  timestamp: string;
  provider?: string;
}

export interface HealthInfo {
  status: string;
  service: string;
  version: string;
  demoClockReferenceDate: string;
  aiProvider: {
    groqConfigured: boolean;
    groqModel: string;
    activeMode: 'groq' | 'local_rule_engine';
  };
  simulationDisclaimer: string;
}
