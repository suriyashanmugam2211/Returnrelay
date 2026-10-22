# ReturnRelay Demonstration Script

This script walks judges and evaluators through the exact 15-point demonstration workflow of ReturnRelay for the **Amazon Developer Relations — Build, Ship, Shape (Alexa+ Track)**.

---

## Prerequisites
1. Open the ReturnRelay web application in your browser.
2. Confirm the demo clock is set to **`2026-10-22`** (displayed in the top bar).
3. If previously tested, click **Reset Demo** in the top bar to restore clean initial seed data.

---

## 15-Point Demonstration Walkthrough

### Step 1: Inspect the Orders Dashboard
- Navigate to the **Simulated Orders** tab in the top navigation.
- Notice the 6 diverse simulated orders:
  - `ORD-84920`: ApexSound Pro Headphones (delivered Oct 8 — 14 days ago, within 30-day window).
  - `ORD-71932`: KitchenPulse Coffee Maker (delivered July 14 — 100 days ago, return expired, warranty active).
  - `ORD-58210`: AeroBreeze Desk Fan (delivered April 2025 — both return and warranty expired).
  - `ORD-93041` & `ORD-93042`: Pair of NordicTrail boots/shoes for ambiguity testing.
  - `ORD-62184`: LuminaGlow Light Strip (return expired 3 days ago, warranty active).

---

### Step 2: Initiate Conversational Resolution (Headphones)
- Navigate back to the **Alexa+ Assistant** tab.
- Send the prompt:
  ```text
  My headphones stopped working. Can you help me return them?
  ```

### Step 3: Observe `find_order` Tool Execution
- The agent calls `find_order(query: "headphones")`.
- Click the **Agentic Tool Traces** accordion under the response to expand:
  - Input: `{"query": "headphones"}`
  - Output: Matches `ORD-84920: ApexSound Pro ANC Wireless Headphones`.

### Step 4: Observe `check_eligibility` Tool Execution
- The agent automatically calls `check_eligibility(order_id: "ORD-84920")`.
- Tool calculation verifies:
  - Delivery date: Oct 8, 2026
  - Reference date: Oct 22, 2026 (14 days elapsed)
  - `returnEligible`: `true` (16 days remaining).

### Step 5: Explain Eligibility Decision
- The agent’s message clearly states that the purchase was delivered 14 days ago and is fully eligible for a full refund ($199.99) under the standard 30-day return policy.

### Step 6: Observe `create_case` Tool Execution
- The agent calls `create_case(order_id: "ORD-84920", case_type: "return", ...)`.
- Creates **Case ID `CASE-2026-1001`** in `pending_approval` status.

### Step 7: Review the Inline Approval Card
- Notice the high-contrast **Action Authorization Required** card displayed directly below the response.
- Details clearly indicate:
  - Case ID: `CASE-2026-1001`
  - Action: Standard Return Authorization
  - Policy Verification: Verified within 30-day window.

### Step 8: Explicit User Approval
- Click the green **Approve & Issue RMA** button on the card.
- The button updates immediately to **Approved**, displaying the generated Return Merchandise Authorization: `RMA-1001`.

### Step 9: Verify Case State in Cases Dashboard
- Click the **Resolution Cases** tab in the top navigation.
- Confirm `CASE-2026-1001` is now listed with status **Approved** and shows the generated RMA details.

### Step 10: Query Case Status via Natural Language
- Return to the **Alexa+ Assistant** tab.
- Ask the agent:
  ```text
  What is the status of CASE-2026-1001?
  ```

### Step 11: Observe `get_case_status` Execution
- The agent executes `get_case_status(case_id: "CASE-2026-1001")`.
- It retrieves the live database record and responds with the current status (**APPROVED**) and resolution notes.

### Step 12: Verify Activity Audit Trail
- Click the **Activity Audit** tab in the top bar.
- Review the chronological audit log showing:
  - `case_prepared` by Agent
  - `user_approved` by User
  - `status_queried` by Agent

---

### Step 13: Negative Test — Ineligible Return (Desk Fan)
- Return to the **Alexa+ Assistant** tab.
- Send the prompt:
  ```text
  I want to return the AeroBreeze desk fan that stopped spinning.
  ```
- The agent calls `find_order` -> `check_eligibility`.
- Policy engine identifies that both the 30-day return window and 180-day warranty have expired.
- The agent explains why the item is ineligible and safely **refuses** automated return creation.

---

### Step 14: Negative Test — Ambiguity Clarification (NordicTrail)
- Send the prompt:
  ```text
  I have an issue with my NordicTrail footwear and want to exchange it.
  ```
- The agent calls `find_order(query: "NordicTrail")`.
- Backend identifies two matching orders (`ORD-93041` Hiking Boots and `ORD-93042` Trail Running Shoes).
- The agent presents both candidate items and asks the user to clarify which order they need to resolve.

---

### Step 15: Repeatability & Database Reset
- Click **Reset Demo** in the top bar and confirm the dialog.
- The system returns to the clean initial seed state, clearing cases and logging a `system_reset` event.
