import Groq from 'groq-sdk';
import { executeTool, AGENT_TOOLS_DEFINITIONS } from './tools.ts';
import { ToolCallRecord, CaseType } from './types.ts';
import { getDemoReferenceDate } from './demoData.ts';

const SYSTEM_INSTRUCTION = `
You are ReturnRelay, an AI-powered conversational return and warranty resolution agent simulating an Amazon Alexa+ experience.

Core Rules & Behavior:
1. All orders, customer accounts, and transactions are SIMULATED DEMONSTRATION DATA. Never represent them as real Amazon or live retailer transactions.
2. The current demonstration reference date is ${getDemoReferenceDate()}.
3. ALWAYS use backend tools to find orders and check eligibility. NEVER invent order details, dates, or policy outcomes.
4. When a user mentions a product or issue:
   - First, call "find_order" to identify the order.
   - If multiple orders match (ambiguous), DO NOT guess. Present the options and ask the user to clarify.
   - If an order is found, call "check_eligibility" to determine whether standard return, warranty replacement, or warranty repair is valid.
   - Clearly explain the eligibility rules based on the tool result.
   - If eligible and the user wants to proceed, call "create_case".
5. IMPORTANT APPROVAL CONTRACT:
   - When "create_case" is called, the case begins in "pending_approval" status.
   - Explicitly inform the user of their new Case ID.
   - Tell them: "I've prepared your case for review. Please review the details and click 'Approve' or 'Reject' below to finalize."
   - Do NOT say the return or refund is completed until the user clicks approve.
6. When asked for status (e.g. "What's the status of CASE-2026-1001?"), call "get_case_status".
7. Be polite, concise, and professional.
`;

export interface AgentRunResult {
  message: string;
  toolCalls: ToolCallRecord[];
  pendingApproval?: {
    caseId: string;
    orderId: string;
    productName: string;
    caseType: CaseType;
    issueDescription: string;
    proposedAction: string;
    policyReason: string;
  };
  provider: 'groq' | 'local_rule_engine';
}

/**
 * Main conversational agent runner.
 * Tries Groq -> Local Rule Engine fallback.
 */
export async function runAgentConversation(
  history: { role: 'user' | 'assistant'; content: string }[],
  userMessage: string
): Promise<AgentRunResult> {
  const groqKey = process.env.GROQ_API_KEY?.trim();

  // 1. Try Groq if key provided and valid
  if (groqKey && !groqKey.startsWith('MY_') && groqKey !== 'gsk_your_groq_api_key_here') {
    try {
      return await runGroqAgent(history, userMessage, groqKey);
    } catch (err) {
      console.warn('Groq agent call failed, falling back to local engine:', err);
    }
  }

  // 2. Fallback: Local Agentic Rule Engine
  return await runLocalAgenticEngine(history, userMessage);
}

/**
 * Groq tool-calling agent implementation
 */
async function runGroqAgent(
  history: { role: 'user' | 'assistant'; content: string }[],
  userMessage: string,
  apiKey: string
): Promise<AgentRunResult> {
  const groq = new Groq({ apiKey });
  const model = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';

  const toolCallsCollected: ToolCallRecord[] = [];
  let pendingApprovalData: AgentRunResult['pendingApproval'] = undefined;

  // Build Groq tools payload
  const tools = AGENT_TOOLS_DEFINITIONS.map(t => ({
    type: 'function' as const,
    function: {
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    },
  }));

  const messages: Groq.Chat.ChatCompletionMessageParam[] = [
    { role: 'system', content: SYSTEM_INSTRUCTION },
    ...history.map(m => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    })),
    { role: 'user', content: userMessage },
  ];

  let iterations = 0;
  const maxIterations = 6;

  while (iterations < maxIterations) {
    iterations++;

    const response = await groq.chat.completions.create({
      model,
      messages,
      tools,
      tool_choice: 'auto',
      temperature: 0.1,
    });

    const choice = response.choices[0];
    if (!choice || !choice.message) {
      throw new Error('Groq returned empty response');
    }

    const assistantMsg = choice.message;
    messages.push(assistantMsg);

    // If no tool calls requested, we have the final assistant answer
    if (!assistantMsg.tool_calls || assistantMsg.tool_calls.length === 0) {
      return {
        message: assistantMsg.content || '',
        toolCalls: toolCallsCollected,
        pendingApproval: pendingApprovalData,
        provider: 'groq',
      };
    }

    // Execute each tool call
    for (const tc of assistantMsg.tool_calls) {
      const toolName = tc.function.name;
      let args: Record<string, unknown> = {};
      try {
        args = JSON.parse(tc.function.arguments || '{}');
      } catch {
        args = {};
      }

      const execResult = await executeTool(toolName, args);

      const record: ToolCallRecord = {
        id: tc.id,
        toolName,
        input: args,
        output: execResult.data,
        timestamp: new Date().toISOString(),
      };
      toolCallsCollected.push(record);

      if (toolName === 'create_case' && execResult.success && execResult.data.caseId && execResult.data.requiresUserApproval) {
        pendingApprovalData = {
          caseId: String(execResult.data.caseId),
          orderId: String(execResult.data.orderId),
          productName: String(execResult.data.productName),
          caseType: execResult.data.caseType as CaseType,
          issueDescription: String(args.issue_description || 'Product issue reported'),
          proposedAction: String(execResult.data.proposedAction),
          policyReason: String(execResult.data.policyReason),
        };
      }

      messages.push({
        role: 'tool',
        tool_call_id: tc.id,
        content: JSON.stringify(execResult.data),
      });
    }
  }

  return {
    message: 'I have processed your request. Please review the case information above.',
    toolCalls: toolCallsCollected,
    pendingApproval: pendingApprovalData,
    provider: 'groq',
  };
}


/**
 * Local Agentic Engine (fallback when no API keys are configured)
 * Deterministically executes the actual backend tools in multi-step sequence
 * matching the user prompt's conversational flow.
 */
async function runLocalAgenticEngine(
  history: { role: 'user' | 'assistant'; content: string }[],
  userMessage: string
): Promise<AgentRunResult> {
  const toolCallsCollected: ToolCallRecord[] = [];
  let pendingApprovalData: AgentRunResult['pendingApproval'] = undefined;
  const lowerMsg = userMessage.toLowerCase();

  // 1. Check for Case Status inquiry (e.g. "What's the status of CASE-2026-1001?" or "CASE-2026-...")
  const caseIdMatch = userMessage.match(/CASE-\d{4}-\d{4}/i);
  if (caseIdMatch || lowerMsg.includes('case status') || lowerMsg.includes('my case')) {
    const caseId = caseIdMatch ? caseIdMatch[0].toUpperCase() : 'CASE-2026-1001';
    const toolRes = await executeTool('get_case_status', { case_id: caseId });
    toolCallsCollected.push({
      id: `tool_${Date.now()}_status`,
      toolName: 'get_case_status',
      input: { case_id: caseId },
      output: toolRes.data,
      timestamp: new Date().toISOString(),
    });

    if (toolRes.data.found && toolRes.data.case) {
      const c = toolRes.data.case as Record<string, unknown>;
      return {
        message: `I retrieved the live status for **${c.id}**:\n\n` +
          `• **Product:** ${c.productName} (${c.orderId})\n` +
          `• **Case Type:** ${String(c.caseType).replace('_', ' ').toUpperCase()}\n` +
          `• **Current Status:** **${String(c.status).toUpperCase()}**\n` +
          `• **Proposed Action:** ${c.proposedAction}\n` +
          `• **Resolution Details:** ${c.resolutionDetails}\n\n` +
          `Audit history contains ${c.eventCount} recorded events. You can view the full activity timeline in the Activity tab.`,
        toolCalls: toolCallsCollected,
        provider: 'local_rule_engine',
      };
    } else {
      return {
        message: `I searched for case **${caseId}**, but it was not found in our records. Please verify the Case ID or check the Cases dashboard.`,
        toolCalls: toolCallsCollected,
        provider: 'local_rule_engine',
      };
    }
  }

  // 2. Check for "list orders" or "my orders"
  if (lowerMsg.includes('list orders') || lowerMsg.includes('show orders') || lowerMsg.includes('what orders do i have')) {
    const listRes = await executeTool('list_orders', {});
    toolCallsCollected.push({
      id: `tool_${Date.now()}_orders`,
      toolName: 'list_orders',
      input: {},
      output: listRes.data,
      timestamp: new Date().toISOString(),
    });

    const orders = (listRes.data.orders as Array<Record<string, unknown>>) || [];
    const listText = orders
      .map(o => `• **${o.id}**: ${o.productName} (${o.category}) - Purchased ${o.purchaseDate}, Delivered ${o.deliveryDate}`)
      .join('\n');

    return {
      message: `Here are the simulated orders in your demonstration account:\n\n${listText}\n\nLet me know which item you need assistance with!`,
      toolCalls: toolCallsCollected,
      provider: 'local_rule_engine',
    };
  }

  // 3. Product Resolution workflow:
  // Identify candidate search keyword from message
  let searchKeyword = '';
  if (lowerMsg.includes('headphone') || lowerMsg.includes('apexsound')) {
    searchKeyword = 'headphones';
  } else if (lowerMsg.includes('coffee') || lowerMsg.includes('kitchenpulse')) {
    searchKeyword = 'coffee';
  } else if (lowerMsg.includes('fan') || lowerMsg.includes('aerobreeze')) {
    searchKeyword = 'fan';
  } else if (lowerMsg.includes('boots') || lowerMsg.includes('shoes') || lowerMsg.includes('nordictrail')) {
    // If the user specified boots vs shoes:
    if (lowerMsg.includes('hiking') || lowerMsg.includes('dark olive') || lowerMsg.includes('ord-93041')) {
      searchKeyword = 'ORD-93041';
    } else if (lowerMsg.includes('running') || lowerMsg.includes('slate black') || lowerMsg.includes('ord-93042')) {
      searchKeyword = 'ORD-93042';
    } else {
      searchKeyword = 'NordicTrail'; // Triggers ambiguity!
    }
  } else if (lowerMsg.includes('light') || lowerMsg.includes('luminaglow') || lowerMsg.includes('strip')) {
    searchKeyword = 'light';
  } else {
    // Check if an order ID was directly typed (e.g. ORD-84920)
    const directOrd = userMessage.match(/ORD-\d{5}/i);
    if (directOrd) {
      searchKeyword = directOrd[0].toUpperCase();
    } else {
      searchKeyword = userMessage.trim().split(' ')[0];
    }
  }

  // Step 1: find_order
  const findRes = await executeTool('find_order', { query: searchKeyword });
  toolCallsCollected.push({
    id: `tool_${Date.now()}_find`,
    toolName: 'find_order',
    input: { query: searchKeyword },
    output: findRes.data,
    timestamp: new Date().toISOString(),
  });

  if (!findRes.data.found) {
    return {
      message: `I could not find any simulated order matching "${searchKeyword}". You can check your available orders in the Orders tab or tell me the exact Order ID (e.g. ORD-84920).`,
      toolCalls: toolCallsCollected,
      provider: 'local_rule_engine',
    };
  }

  // Handle Ambiguity test scenario
  if (findRes.data.ambiguous) {
    const matches = findRes.data.matches as Array<{ id: string; productName: string; purchaseDate: string }>;
    const optionsText = matches.map(m => `• **${m.id}**: ${m.productName} (Ordered ${m.purchaseDate})`).join('\n');
    return {
      message: `I found multiple simulated orders matching "${searchKeyword}":\n\n${optionsText}\n\nCould you please specify which item you are referring to? (e.g., "The hiking boots" or order ID **${matches[0].id}**).`,
      toolCalls: toolCallsCollected,
      provider: 'local_rule_engine',
    };
  }

  const orderData = findRes.data.order as Record<string, unknown>;
  const orderId = String(orderData.id);
  const productName = String(orderData.productName);

  // Step 2: check_eligibility
  const eligRes = await executeTool('check_eligibility', {
    order_id: orderId,
    issue_description: userMessage,
    requested_action: lowerMsg.includes('warranty') ? 'warranty' : 'auto',
  });

  toolCallsCollected.push({
    id: `tool_${Date.now()}_elig`,
    toolName: 'check_eligibility',
    input: { order_id: orderId, issue_description: userMessage },
    output: eligRes.data,
    timestamp: new Date().toISOString(),
  });

  const eligData = eligRes.data;
  const returnEligible = Boolean(eligData.returnEligible);
  const warrantyEligible = Boolean(eligData.warrantyEligible);
  const recommendedAction = (eligData.recommendedAction as CaseType) || 'return';

  // Scenario A: Completely Ineligible (e.g. Desk Fan)
  if (!returnEligible && !warrantyEligible) {
    return {
      message: `I checked the policy for your **${productName}** (${orderId}).\n\n` +
        `❌ **Resolution Ineligible:**\n` +
        `• Delivery Date: ${eligData.deliveryDate} (${eligData.daysSinceDelivery} days ago)\n` +
        `• 30-Day Return Window expired on: ${eligData.returnWindowExpires}\n` +
        `• Limited Warranty coverage expired on: ${eligData.warrantyExpires}\n\n` +
        `Because both demonstration coverage periods have elapsed, automatic returns or warranty replacements cannot be prepared. However, customer support is available for manual troubleshooting assistance.`,
      toolCalls: toolCallsCollected,
      provider: 'local_rule_engine',
    };
  }

  // Scenario B: Eligible for Return or Warranty -> Create Case
  const caseTypeToCreate: CaseType = returnEligible ? 'return' : 'warranty_replacement';
  const issueDesc = userMessage.length > 5 ? userMessage : 'Customer reported item issue or defect.';

  const caseRes = await executeTool('create_case', {
    order_id: orderId,
    case_type: caseTypeToCreate,
    issue_description: issueDesc,
  });

  toolCallsCollected.push({
    id: `tool_${Date.now()}_case`,
    toolName: 'create_case',
    input: { order_id: orderId, case_type: caseTypeToCreate, issue_description: issueDesc },
    output: caseRes.data,
    timestamp: new Date().toISOString(),
  });

  if (caseRes.data.isDuplicate) {
    return {
      message: `I checked your **${productName}** (${orderId}).\n\n` +
        `A case has already been created for this order:\n` +
        `• **Case ID:** ${caseRes.data.caseId}\n` +
        `• **Current Status:** ${String(caseRes.data.status).toUpperCase()}\n\n` +
        `You can review this case in the Cases tab or approve it in the approval section.`,
      toolCalls: toolCallsCollected,
      provider: 'local_rule_engine',
    };
  }

  if (caseRes.success && caseRes.data.caseId) {
    const caseId = String(caseRes.data.caseId);
    pendingApprovalData = {
      caseId,
      orderId,
      productName,
      caseType: caseTypeToCreate,
      issueDescription: issueDesc,
      proposedAction: String(caseRes.data.proposedAction),
      policyReason: String(caseRes.data.policyReason),
    };

    let eligibilityExplanation = '';
    if (caseTypeToCreate === 'return') {
      eligibilityExplanation = `Good news! Your item was delivered on ${eligData.deliveryDate} (${eligData.daysSinceDelivery} days ago) and is well within the 30-day return window (valid through ${eligData.returnWindowExpires}, with ${eligData.returnDaysRemaining} days remaining).`;
    } else {
      eligibilityExplanation = `The standard 30-day return window closed on ${eligData.returnWindowExpires}. However, your item is actively covered under the manufacturer warranty through ${eligData.warrantyExpires} (${eligData.warrantyDaysRemaining} days remaining).`;
    }

    return {
      message: `I located your order for **${productName}** (${orderId}).\n\n` +
        `${eligibilityExplanation}\n\n` +
        `I have prepared Case **${caseId}** for a **${caseTypeToCreate === 'return' ? 'Standard Return (Full Refund)' : 'Manufacturer Warranty Replacement'}**.\n\n` +
        `⚠️ **Action Required:** As simulated Alexa+ policy requires deliberate user authorization, the case is currently **PENDING APPROVAL**. Please review the proposed action on the card below and click **Approve** or **Reject** to confirm.`,
      toolCalls: toolCallsCollected,
      pendingApproval: pendingApprovalData,
      provider: 'local_rule_engine',
    };
  }

  return {
    message: `I found your order for **${productName}** (${orderId}). ${String(caseRes.data.message || 'Could not prepare case.')}`,
    toolCalls: toolCallsCollected,
    provider: 'local_rule_engine',
  };
}
