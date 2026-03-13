-- SQL to add new 1st 6 month columns to the PnP database table
-- These columns should be added after cur_ytd_pct and before curr_mo_submit

ALTER TABLE pnp ADD COLUMN first_6_mo_grs_submit VARCHAR(50) AFTER cur_ytd_pct;
ALTER TABLE pnp ADD COLUMN first_6_mo_net_submit VARCHAR(50) AFTER first_6_mo_grs_submit;
ALTER TABLE pnp ADD COLUMN first_6_past12_grs VARCHAR(50) AFTER first_6_mo_net_submit;
ALTER TABLE pnp ADD COLUMN first_6_past12_net VARCHAR(50) AFTER first_6_past12_grs;
ALTER TABLE pnp ADD COLUMN first_6_ytd_grs VARCHAR(50) AFTER first_6_past12_net;
ALTER TABLE pnp ADD COLUMN first_6_ytd_net VARCHAR(50) AFTER first_6_ytd_grs;

-- Verify the table structure after adding columns
-- DESCRIBE pnp;
