# Amazon Developer Relations: Build, Ship, Shape — Hackathon Submission

## 1. Project Overview

- **Project Title:** ReturnRelay
- **Track:** Alexa+ (Simulated Experience)
- **Tagline:** Explainable, tool-using conversational resolution agent bringing proactive customer care to product returns and warranties.

---

## 2. Problem Statement
Handling e-commerce returns and warranty claims is traditionally one of the most frustrating customer service touchpoints:
1. Customers struggle to locate specific order IDs, delivery dates, and return window policies buried across multiple emails and account portals.
2. Standard chatbots produce hallucinated policies, offer vague boilerplate advice, or lack backend authorization to initiate cases.
3. Automated systems often execute irreversible actions (e.g. initiating returns, deducting restocking fees) without clear explanations or explicit customer sign-off.

---

## 3. The ReturnRelay Solution
ReturnRelay simulates a next-generation **Amazon Alexa+** conversational agent that transforms returns and warranty claims into an explainable, multi-step dialogue:
- **Natural Language Inquiry:** Customers simply describe what happened (*"My headphones stopped working"*).
- **Tool-Grounded Identification:** The agent runs server-validated tools to pinpoint the exact order and inspect delivery status.
- **Deterministic Policy Verification:** Return and warranty windows are calculated from immutable calendar dates and store policies—never hallucinated by an LLM.
- **Two-Phase Human Authorization:** Rather than making assumptions, the agent prepares a pending case and requires explicit user review and approval before generating an RMA tracking number.
- **Tamper-Evident Audit Logging:** Every agent tool invocation, policy check, customer approval, and rejection is permanently recorded in an SQLite audit trail.

---

## 4. Key Features
1. **Multi-Turn Agentic Tool Loop:** Coordinates `find_order`, `check_eligibility`, `create_case`, `get_case_status`, and `list_orders`.
2. **Ambiguity & Disambiguation Handling:** Safely detects when a user query matches multiple items and asks for clarification instead of guessing.
3. **Deterministic Application Clock:** Evaluates returns against a configurable reference date (`2026-10-22`) for 100% reproducible testing.
4. **Interactive Inline Authorization Cards:** Displays proposed resolutions, refund amounts, and policy justifications directly in the chat stream with explicit Approve/Reject controls.
5. **Multi-Provider Fallback Architecture:** Supports live Groq LLM inference (`llama-3.3-70b-versatile`), Gemini API (`gemini-2.5-flash`), and an intelligent Local Rule Engine that operates out-of-the-box without requiring API keys.
6. **Unified Full-Stack Express & React Workspace:** Serves REST APIs and responsive UI from a single unified server.

---

## 5. Technology Stack
- **Frontend:** React 19, TypeScript, Tailwind CSS, Lucide Icons, Vite
- **Backend:** Node.js 22, Express, TypeScript (TSX runner)
- **Validation:** Zod schemas for all tool parameters and API payloads
- **Persistence:** SQLite (`node:sqlite` DatabaseSync) with deterministic seed data and append-only audit events
- **AI Tool Integration:** Groq SDK (`groq-sdk`), `@google/genai` SDK, and deterministic Local Rule Engine
- **Testing:** Vitest automated test suite covering search, eligibility, approval invariants, and error cases

---

## 6. Simulated Alexa+ Architecture Disclaimer
> **Important Compliance Notice:**
> ReturnRelay is an independent prototype created for the Amazon Developer Relations *Build, Ship, Shape* hackathon. It is a simulated Alexa+ experience built inside a web application. It does not use official Amazon Alexa+ private APIs, live Alexa hardware devices, or live Amazon retail accounts. All customer names, order records, and return authorizations are simulated demonstration data.

---

## 7. 3-Minute Timed Demo Video Script

| Time | Scene | Dialogue / Action |
| :--- | :--- | :--- |
| **0:00 - 0:30** | Opening Shell & Problem | *"Welcome to ReturnRelay, an agentic resolution assistant simulating an Amazon Alexa+ proactive customer experience. Returning products or navigating warranty claims shouldn't require digging through order emails or dealing with hallucinating chatbots. Let's see how an agentic workflow solves this."* |
| **0:30 - 1:15** | Happy Path: Headphones Return | *Ask: 'My headphones stopped working. Can you help me return them?' The agent uses `find_order` to locate ORD-84920, then calls `check_eligibility` against our fixed demo clock. It verifies the item was delivered 14 days ago and qualifies for a full refund under the 30-day policy. It creates Case CASE-2026-1001 in pending status."* |
| **1:15 - 1:45** | Explicit Human-in-the-Loop Approval | *Show the inline Approval Card: "Notice that ReturnRelay does not automatically finalize the return. It presents the exact proposed refund ($199.99) and policy reason, and waits for explicit user confirmation. When I click 'Approve & Issue RMA', the backend atomically updates the database and issues demo tracking code RMA-1001."* |
| **1:45 - 2:15** | Case Status & Audit Trail | *Ask: 'What is the status of CASE-2026-1001?' The agent uses `get_case_status` to pull live database records. Switch to the Activity Audit tab to show the tamper-evident chronological event log.* |
| **2:15 - 2:45** | Ambiguity & Ineligible Guardrails | *Demonstrate negative cases: Ask about 'NordicTrail footwear' — the agent recognizes 2 matching orders and asks for clarification. Then try returning the expired desk fan — the agent explains why both return and warranty windows have closed and refuses automated return creation.* |
| **2:45 - 3:00** | Conclusion & Out-of-the-Box Setup | *"ReturnRelay runs locally with zero external configuration required thanks to its built-in deterministic local agent and SQLite database, while supporting live Groq and Gemini models. Thank you!"* |

---

## 8. Final Submission Checklist
- [x] Web application runs locally on port 3000 via `npm run dev`
- [x] All 14 Vitest backend tests passing (`npm test`)
- [x] Zero TypeScript compilation errors (`npm run build` and `npm run lint`)
- [x] Deterministic seed orders and application clock documented
- [x] Explicit Approve and Reject endpoints with duplicate prevention
- [x] Real tool execution traces visible to the user
- [x] Simulation disclaimer prominently displayed
- [x] Complete README with Windows and Mac run instructions
