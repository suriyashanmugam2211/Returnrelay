# ReturnRelay REST API Documentation

This document describes all REST API endpoints provided by the ReturnRelay backend server.

All routes are mounted under the `/api` prefix. Responses return JSON payloads with standard HTTP status codes (`200 OK`, `400 Bad Request`, `404 Not Found`, `500 Internal Server Error`).

---

## 1. System & Health

### `GET /api/health`
Checks server health, database connectivity, and active AI model provider status.

**Response `200 OK`**:
```json
{
  "status": "ok",
  "service": "ReturnRelay Backend API",
  "version": "1.0.0",
  "timestamp": "2026-10-22T06:20:00.000Z",
  "demoClockReferenceDate": "2026-10-22",
  "aiProvider": {
    "groqConfigured": true,
    "groqModel": "llama-3.3-70b-versatile",
    "activeMode": "groq"
  },
  "database": {
    "type": "sqlite",
    "status": "connected"
  },
  "simulationDisclaimer": "All order records, returns, and transactions are simulated demonstration data."
}
```

---

## 2. Simulated Orders

### `GET /api/orders`
Returns all simulated orders for the demonstration customer account.

**Response `200 OK`**:
```json
{
  "success": true,
  "count": 6,
  "orders": [
    {
      "id": "ORD-84920",
      "customerName": "Alex Morgan",
      "customerEmail": "alex.morgan@example.com",
      "productName": "ApexSound Pro ANC Wireless Headphones",
      "productCategory": "Electronics",
      "productSku": "APX-ANC-001",
      "priceCents": 19999,
      "currency": "USD",
      "purchaseDate": "2026-10-05",
      "deliveryDate": "2026-10-08",
      "orderStatus": "delivered",
      "returnWindowDays": 30,
      "warrantyWindowDays": 365,
      "policyNotes": "Demonstration Policy: 30-day standard return window..."
    }
  ]
}
```

### `GET /api/orders/:id`
Retrieves a specific order by ID and includes its live deterministic eligibility calculations evaluated against the demo clock.

**Parameters**:
- `:id` — Order ID (e.g. `ORD-84920`)

**Response `200 OK`**:
```json
{
  "success": true,
  "order": { ... },
  "eligibility": {
    "orderId": "ORD-84920",
    "referenceDate": "2026-10-22",
    "daysSinceDelivery": 14,
    "isDelivered": true,
    "returnEligible": true,
    "returnWindowExpires": "2026-11-07",
    "returnDaysRemaining": 16,
    "warrantyEligible": true,
    "recommendedAction": "return",
    "policySummary": "Eligible for standard return (16 days remaining in 30-day window)."
  }
}
```

---

## 3. Resolution Cases

### `GET /api/cases`
Returns all created return and warranty resolution cases.

**Response `200 OK`**:
```json
{
  "success": true,
  "count": 1,
  "cases": [
    {
      "id": "CASE-2026-1001",
      "orderId": "ORD-84920",
      "caseType": "return",
      "issueDescription": "Headphones stopped playing audio",
      "eligibilityDecision": "eligible",
      "policyReason": "Delivered 14 days ago (within 30-day return window).",
      "status": "pending_approval",
      "proposedAction": "Standard Return authorization for full refund ($199.99)...",
      "resolutionDetails": "Pending user review and explicit approval.",
      "createdAt": "2026-10-22T06:21:00.000Z",
      "updatedAt": "2026-10-22T06:21:00.000Z"
    }
  ]
}
```

### `GET /api/cases/:id`
Retrieves a specific case by Case ID, along with its full chronological audit event list.

### `GET /api/cases/:id/events`
Returns all audit events associated with a case.

---

## 4. User Authorizations & Approvals

### `POST /api/cases/:id/approve`
Explicit user authorization endpoint. Transitions a case from `pending_approval` to `approved`, creates a demo Return Merchandise Authorization (RMA) tracking code, and writes a tamper-proof audit event.

**Request Body**:
```json
{
  "notes": "User clicked Approve in ReturnRelay interface"
}
```

**Response `200 OK`**:
```json
{
  "success": true,
  "message": "Case CASE-2026-1001 successfully approved.",
  "case": {
    "id": "CASE-2026-1001",
    "status": "approved",
    "resolutionDetails": "Approved by user... Demonstration return authorization label generated (RMA-1001)."
  }
}
```

*Note: Duplicate approval attempts on an already approved case will return `400 Bad Request` with `Duplicate approval prevented`.*

### `POST /api/cases/:id/reject`
Explicit rejection endpoint. Transitions a case from `pending_approval` to `rejected` and logs a `user_rejected` audit event.

---

## 5. Conversational AI Agent

### `POST /api/chat`
Sends a natural language customer message to the multi-step resolution agent. The agent invokes backend tools (`find_order`, `check_eligibility`, `create_case`, `get_case_status`) in a continuous loop and returns structured traces.

**Request Body**:
```json
{
  "message": "My headphones stopped working. Can you help me return them?",
  "history": []
}
```

**Response `200 OK`**:
```json
{
  "success": true,
  "message": "I found your order ORD-84920... Prepared Case CASE-2026-1001...",
  "toolCalls": [
    {
      "id": "call_1",
      "toolName": "find_order",
      "input": { "query": "headphones" },
      "output": { "found": true, "order": { "id": "ORD-84920", ... } }
    },
    {
      "id": "call_2",
      "toolName": "check_eligibility",
      "input": { "order_id": "ORD-84920" },
      "output": { "returnEligible": true, "daysSinceDelivery": 14 }
    },
    {
      "id": "call_3",
      "toolName": "create_case",
      "input": { "order_id": "ORD-84920", "case_type": "return" },
      "output": { "caseId": "CASE-2026-1001", "requiresUserApproval": true }
    }
  ],
  "pendingApproval": {
    "caseId": "CASE-2026-1001",
    "orderId": "ORD-84920",
    "productName": "ApexSound Pro ANC Wireless Headphones",
    "caseType": "return",
    "proposedAction": "Standard Return authorization for full refund ($199.99)...",
    "policyReason": "Delivered 14 days ago (within 30-day window)."
  },
  "provider": "groq",
  "timestamp": "2026-10-22T06:22:00.000Z"
}
```

---

## 6. Demonstration Management

### `POST /api/demo/reset`
Restores the database to its deterministic initial seed state (clears all cases and case events, re-seeds default orders).

**Response `200 OK`**:
```json
{
  "success": true,
  "message": "Demonstration dataset successfully reset to initial deterministic state.",
  "ordersReset": 6,
  "casesCleared": 1,
  "timestamp": "2026-10-22T06:23:00.000Z"
}
```
