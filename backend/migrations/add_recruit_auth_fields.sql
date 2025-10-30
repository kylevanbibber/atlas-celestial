-- Migration: Add authentication fields to pipeline table
-- Date: 2025-10-08
-- Purpose: Add redeemed and password columns for recruit authentication

ALTER TABLE pipeline
ADD COLUMN redeemed TINYINT(1) DEFAULT 0 COMMENT 'Whether recruit has redeemed/activated their account',
ADD COLUMN password VARCHAR(255) DEFAULT NULL COMMENT 'Hashed password for recruit login';

