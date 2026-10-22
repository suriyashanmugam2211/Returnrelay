import { Order, CaseRecord, CaseEvent, ChatMessage, HealthInfo } from './types.ts';

export async function fetchHealth(): Promise<HealthInfo> {
  const res = await fetch('/api/health');
  if (!res.ok) throw new Error('Health check failed');
  return res.json();
}

export async function fetchOrders(): Promise<Order[]> {
  const res = await fetch('/api/orders');
  if (!res.ok) throw new Error('Failed to load orders');
  const data = await res.json();
  return data.orders || [];
}

export async function fetchOrderById(id: string): Promise<{ order: Order; eligibility: Record<string, unknown> }> {
  const res = await fetch(`/api/orders/${encodeURIComponent(id)}`);
  if (!res.ok) throw new Error(`Failed to load order ${id}`);
  return res.json();
}

export async function fetchCases(): Promise<CaseRecord[]> {
  const res = await fetch('/api/cases');
  if (!res.ok) throw new Error('Failed to load cases');
  const data = await res.json();
  return data.cases || [];
}

export async function fetchCaseById(id: string): Promise<{ case: CaseRecord; events: CaseEvent[] }> {
  const res = await fetch(`/api/cases/${encodeURIComponent(id)}`);
  if (!res.ok) throw new Error(`Failed to load case ${id}`);
  return res.json();
}

export async function fetchCaseEvents(id: string): Promise<CaseEvent[]> {
  const res = await fetch(`/api/cases/${encodeURIComponent(id)}/events`);
  if (!res.ok) throw new Error(`Failed to load events for case ${id}`);
  const data = await res.json();
  return data.events || [];
}

export async function fetchAllEvents(): Promise<CaseEvent[]> {
  const res = await fetch('/api/events');
  if (!res.ok) throw new Error('Failed to load events');
  const data = await res.json();
  return data.events || [];
}

export async function sendChatMessage(
  message: string,
  history: { role: 'user' | 'assistant'; content: string }[]
): Promise<{
  message: string;
  toolCalls?: ChatMessage['toolCalls'];
  pendingApproval?: ChatMessage['pendingApproval'];
  provider?: string;
}> {
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, history }),
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || errData.message || 'Chat request failed');
  }
  return res.json();
}

export async function approveCaseAction(
  caseId: string,
  notes?: string
): Promise<{ success: boolean; message: string; case: CaseRecord }> {
  const res = await fetch(`/api/cases/${encodeURIComponent(caseId)}/approve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ notes }),
  });
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.message || 'Approval failed');
  }
  return data;
}

export async function rejectCaseAction(
  caseId: string,
  reason?: string
): Promise<{ success: boolean; message: string; case: CaseRecord }> {
  const res = await fetch(`/api/cases/${encodeURIComponent(caseId)}/reject`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason }),
  });
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.message || 'Rejection failed');
  }
  return data;
}

export async function resetDemoData(): Promise<{ message: string; ordersReset: number; casesCleared: number }> {
  const res = await fetch('/api/demo/reset', {
    method: 'POST',
  });
  if (!res.ok) throw new Error('Demo reset failed');
  return res.json();
}
