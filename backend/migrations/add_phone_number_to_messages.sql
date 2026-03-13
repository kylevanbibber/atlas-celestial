-- Add phone_number column to track which phone a message was sent to / received from
ALTER TABLE text_campaign_messages
  ADD COLUMN phone_number VARCHAR(20) DEFAULT NULL AFTER contact_id;

-- Backfill: set existing messages to the contact's primary phone (phone_normalized)
UPDATE text_campaign_messages tcm
  JOIN text_campaign_contacts tcc ON tcm.contact_id = tcc.id
  SET tcm.phone_number = tcc.phone_normalized
  WHERE tcm.phone_number IS NULL;

-- Add an index for filtering messages by contact + phone
CREATE INDEX idx_tcm_contact_phone ON text_campaign_messages (contact_id, phone_number);
