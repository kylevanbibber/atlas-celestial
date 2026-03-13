-- Tracks which agents have had their "code pack eligible" notification sent
-- to their manager. Uses a separate table instead of a column on activeusers
-- so the main user table stays clean.
--
-- agent_id  → the activeusers.id of the newly activated agent
-- manager_id → the activeusers.id of the manager who was notified
-- notified_at → when the notification was sent
CREATE TABLE IF NOT EXISTS code_eligibility_notifications (
  agent_id    INT          NOT NULL,
  manager_id  INT          NULL,
  notified_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (agent_id),
  CONSTRAINT fk_cen_agent   FOREIGN KEY (agent_id)   REFERENCES activeusers(id),
  CONSTRAINT fk_cen_manager FOREIGN KEY (manager_id) REFERENCES activeusers(id)
);
