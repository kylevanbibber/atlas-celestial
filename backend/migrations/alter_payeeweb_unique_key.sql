-- Change unique key from (policy_number, queue_type, report_date)
-- to (policy_number, queue_type) so a policy only has one row per queue.
-- Daily runs update the existing row instead of creating duplicates.

ALTER TABLE payeeweb_business
  DROP INDEX uq_policy_queue_date,
  ADD UNIQUE KEY uq_policy_queue (policy_number, queue_type);
