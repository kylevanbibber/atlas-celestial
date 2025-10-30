# Pipeline Progression Logic

This document defines the complete business logic for pipeline stage progression and checklist item completion based on agent status in the system.

## Training Stage - Checklist Items (in order)

1. **Attend Training** (item_order = 1)
2. **Activate Agent Number** (item_order = 2) - *System controlled*
3. **Receive First Lead Pack** (item_order = 3)
4. **Attend and Pass Release Call** (item_order = 4)
5. **Receive Release Pack** (item_order = 5)

---

## Group 1: Pending Agents (No items completed)

**Criteria:**
- `activeusers.pending = 1`
- `activeusers.Active = 'y'`
- `activeusers.managerActive = 'y'`
- `activeusers.released = 0`

**Pipeline Stage:** Training  
**Checklist Items Completed:** None

**Description:** New agents who have not yet been activated in the system. They are in the Training stage but have not completed any checklist items.

---

## Group 2: Activated Agents (Items 1-2 completed)

**Criteria:**
- `activeusers.pending = 0`
- `activeusers.released = 0`
- `activeusers.Active = 'y'`
- `activeusers.managerActive = 'y'`
- **AND ONE OF:**
  - NOT in `leads_released` table
  - OR in `leads_released` with `type = '1st Pack'` and `sent = 0`

**Pipeline Stage:** Training  
**Checklist Items Completed:**
- ✅ Attend Training
- ✅ Activate Agent Number

**Description:** Agents who have been activated (no longer pending) but have not yet received their first lead pack. They are ready for or awaiting their first pack.

---

## Group 3: First Pack Sent (Items 1-3 completed)

**Criteria:**
- `activeusers.Active = 'y'`
- `activeusers.managerActive = 'y'`
- `leads_released.type = '1st Pack'` and `sent = 1`
- **AND ONE OF:**
  - NOT in `JA_Release` table
  - OR `JA_Release.passed IS NULL`
  - OR `JA_Release.passed != 'y'`

**Pipeline Stage:** Training  
**Checklist Items Completed:**
- ✅ Attend Training
- ✅ Activate Agent Number
- ✅ Receive First Lead Pack

**Description:** Agents who have received their first lead pack and are working towards passing their release call. They have not yet passed their release call.

---

## Group 4: Passed Release, Awaiting Second Pack (Items 1-4 completed)

**Criteria:**
- `activeusers.Active = 'y'`
- `activeusers.managerActive = 'y'`
- `JA_Release.passed = 'y'`
- `leads_released.type = '2nd Pack'` and `sent = 0`

**Pipeline Stage:** Training  
**Checklist Items Completed:**
- ✅ Attend Training
- ✅ Activate Agent Number
- ✅ Receive First Lead Pack
- ✅ Attend and Pass Release Call
- ❌ Receive Release Pack (NOT completed)

**Description:** Agents who have successfully passed their release call and are waiting to receive their second lead pack (release pack). This is the final step before completing Training.

---

## Group 5: Second Pack Sent - Move to Career Path (All items completed)

**Criteria:**
- `activeusers.Active = 'y'`
- `activeusers.managerActive = 'y'`
- `JA_Release.passed = 'y'`
- `leads_released.type = '2nd Pack'` and `sent = 1`

**Pipeline Stage:** **Career Path** (promoted from Training)  
**Training Checklist Items Completed:**
- ✅ Attend Training
- ✅ Activate Agent Number
- ✅ Receive First Lead Pack
- ✅ Attend and Pass Release Call
- ✅ Receive Release Pack

**Description:** Agents who have completed all Training requirements including receiving their release pack. They are automatically promoted to the Career Path stage, indicating they are now fully released and building their business.

---

## Exclusion Criteria

Agents are **removed** from the pipeline if they meet ANY of the following criteria:

- `activeusers.clname != 'AGT'` (only AGT agents are tracked)
- `activeusers.Role = 'Trainee'`
- `activeusers.Active = 'n'`
- `activeusers.managerActive = 'n'`
- `activeusers.esid < DATE_SUB(NOW(), INTERVAL 60 DAY)` (ESID older than 60 days)

---

## Automation Rules

### System-Controlled Items

The following items are **system-controlled** and cannot be manually checked:
- **Activate Agent Number** - Automatically completed when `pending` changes from 1 to 0

### Stage Progression

- **Training → Career Path**: Automatically occurs when GROUP 5 criteria are met (2nd pack sent)
- All prior stage items (Overview, Final Decision, Licensing, On-boarding) are auto-completed for agents in Training

---

## Implementation

The pipeline progression is managed by:
1. **SQL Scripts:**
   - `reorganize_training_pipeline.sql` - Full sync/reorganization of all agents
   - `cleanup_inactive_pipeline_agents.sql` - Removes ineligible agents
   
2. **Python Automation:**
   - `processors/pipeline_automation.py` - Handles real-time updates when agent status changes
   - `processors/associates_processor.py` - Triggers automation when pending status changes
   - `processors/pending_processor.py` - Processes pending agent updates

3. **Backend API:**
   - `routes/recruitment.js` - Handles manual checklist item updates and auto-completion logic

