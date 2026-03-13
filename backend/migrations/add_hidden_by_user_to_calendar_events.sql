-- Add hidden_by_user flag to calendar_events
-- When a user promotes an iCal/synced event to a manual event via the + button,
-- the original synced event is marked hidden_by_user = 1 so that future syncs
-- don't re-show it as a duplicate.

ALTER TABLE calendar_events
  ADD COLUMN hidden_by_user TINYINT(1) NOT NULL DEFAULT 0;
