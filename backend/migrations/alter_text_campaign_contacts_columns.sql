-- Alter text_campaign_contacts: replace generic columns with dedicated CSV columns
-- Run this AFTER the original create_text_campaigns_tables.sql

-- Step 1: Add new dedicated CSV columns
ALTER TABLE text_campaign_contacts
  ADD COLUMN policy_number VARCHAR(50) DEFAULT NULL AFTER campaign_id,
  ADD COLUMN policyholder_name VARCHAR(255) DEFAULT NULL AFTER policy_number,
  ADD COLUMN owner_name VARCHAR(255) DEFAULT NULL AFTER policyholder_name,
  ADD COLUMN primary_phone VARCHAR(30) DEFAULT NULL AFTER owner_name,
  ADD COLUMN secondary_phone VARCHAR(30) DEFAULT NULL AFTER primary_phone,
  ADD COLUMN address TEXT DEFAULT NULL AFTER secondary_phone,
  ADD COLUMN primary_agent VARCHAR(255) DEFAULT NULL AFTER address,
  ADD COLUMN primary_agent_mga VARCHAR(255) DEFAULT NULL AFTER primary_agent,
  ADD COLUMN policy_type VARCHAR(100) DEFAULT NULL AFTER primary_agent_mga,
  ADD COLUMN policy_status VARCHAR(100) DEFAULT NULL AFTER policy_type,
  ADD COLUMN import_date VARCHAR(50) DEFAULT NULL AFTER policy_status,
  ADD COLUMN inc_nto_date VARCHAR(50) DEFAULT NULL AFTER import_date,
  ADD COLUMN bill_control_number VARCHAR(100) DEFAULT NULL AFTER inc_nto_date,
  ADD COLUMN form_code VARCHAR(100) DEFAULT NULL AFTER bill_control_number,
  ADD COLUMN billing_mode VARCHAR(100) DEFAULT NULL AFTER form_code;

-- Step 2: Rename status -> campaign_status
ALTER TABLE text_campaign_contacts
  CHANGE COLUMN status campaign_status ENUM('pending', 'sent', 'failed', 'responded', 'closed') DEFAULT 'pending';

-- Step 3: Drop old generic columns
ALTER TABLE text_campaign_contacts
  DROP COLUMN name,
  DROP COLUMN phone,
  DROP COLUMN custom_fields;
