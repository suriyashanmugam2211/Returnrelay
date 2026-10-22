# ReturnRelay Architecture & Design

## 1. System Overview

ReturnRelay is an agentic resolution platform designed to simulate an Amazon Alexa+ proactive customer service experience. Rather than serving as a simple conversational chatbot that generates ungrounded answers, ReturnRelay couples a conversational reasoning loop with deterministic backend business logic and explicit human-in-the-loop authorization.

```mermaid
graph TD
    User([Customer / Evaluator]) <--> UI[React SPA Interface]
    UI <--> Express[Express REST API /api]

    subgraph Backend Engine
        Express <--> Agent[Conversational AI Agent]
        Agent <--> ProviderService{Provider Router}
        ProviderService -->|GROQ_API_KEY| Groq[Groq LLM Llama-3.3]
        ProviderService -->|Fallback Mode| LocalEngine[Local Rule Engine]
        
        Agent <--> Tools[Validated Backend Tools]
        Tools <--> Rules[Deterministic Eligibility Engine]
        Tools <--> DB[(SQLite Database)]
        
        Express <--> AuthHandler[Approval & Rejection Handler]
        AuthHandler <--> DB
    end
```

---

## 2. Agentic Tool Workflow & Safety Guardrails

### A. The Tool-Calling Loop
When a customer sends a message (e.g. *"My headphones stopped working. Can you help me return them?"*), the agent coordinates a multi-turn workflow:

```mermaid
sequenceDiagram
    autonumber
    actor Customer
    participant UI as React Workspace
    participant Agent as Agent Service
    participant Tools as Backend Tools
    participant DB as SQLite DB

    Customer->>UI: "My headphones stopped working..."
    UI->>Agent: POST /api/chat
    Agent->>Tools: find_order("headphones")
    Tools->>DB: Query orders table
    DB-->>Tools: Order ORD-84920
    Tools-->>Agent: Order details (Delivered Oct 8, 2026)
    
    Agent->>Tools: check_eligibility("ORD-84920")
    Tools-->>Agent: Return eligible (14 days since delivery <= 30d window)
    
    Agent->>Tools: create_case("ORD-84920", "return", "Left ear cup dead")
    Tools->>DB: INSERT case (status: pending_approval)
    Tools->>DB: INSERT audit event (case_prepared)
    Tools-->>Agent: Case CASE-2026-1001 (requiresUserApproval: true)
    
    Agent-->>UI: Response with tool traces & pending approval card
    UI-->>Customer: Explains policy, displays inline Approval Card
    
    Customer->>UI: Clicks "Approve & Issue RMA"
    UI->>Tools: POST /api/cases/CASE-2026-1001/approve
    Tools->>DB: UPDATE status = 'approved', generate RMA
    Tools->>DB: INSERT audit event (user_approved)
    Tools-->>UI: Case approved (RMA-1001 issued)
```

### B. Core Guardrails
1. **Never Let the Model Guess Policies**: Eligibility is calculated by pure TypeScript functions in `src/server/eligibility.ts` based on fixed calendar dates (`calculateDaysBetween`). The model has no power to invent or override return dates.
2. **Ambiguity Prevention**: When a user mentions a product that matches multiple orders (e.g., `NordicTrail`), `find_order` returns `ambiguous: true` with all candidates. The agent is strictly instructed to seek customer clarification rather than picking one arbitrarily.
3. **Pending Approval Invariant**: The tool `create_case` will **only** insert records with `status = 'pending_approval'`. It cannot approve cases. Real database approval requires an explicit HTTP POST to `/api/cases/:id/approve` triggered by a physical user click.
4. **Duplicate Prevention**: If a case is already pending or approved for an order, re-invoking `create_case` identifies the existing case and returns its live status rather than polluting the database with duplicates.

---

## 3. Database Schema

ReturnRelay uses SQLite for persistent, deterministic data storage:

- **`orders`**: Stores simulated demo purchases with delivery dates, return window durations (e.g. 30 days), and warranty lengths (e.g. 365 or 730 days).
- **`cases`**: Stores prepared resolution actions, policy reasons, eligibility decisions, and approval statuses (`pending_approval`, `approved`, `rejected`).
- **`case_events`**: Append-only audit trail recording every state change, agent execution, user confirmation, or database reset.

---

## 4. Multi-Provider Fallback Architecture

To ensure ReturnRelay functions reliably across evaluation sandboxes without dependency on active paid external subscriptions:
1. **Groq Primary**: If `GROQ_API_KEY` is present, uses official `groq-sdk` with `llama-3.3-70b-versatile` function calling.
2. **Local Agentic Rule Engine**: If no API keys are provided or an external service suffers a rate limit, ReturnRelay executes an intelligent local rule-based agent loop that executes the exact same backend tools (`find_order`, `check_eligibility`, `create_case`, `get_case_status`) and produces genuine tool traces and approval cards!
