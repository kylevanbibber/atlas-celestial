-- ============================================================================
-- HIERARCHY QUERY OPTIMIZATION INDEXES
-- ============================================================================
-- This file contains indexes to significantly improve hierarchy query performance
-- Run this file to add all recommended indexes at once
-- Expected performance improvement: 50-80% faster hierarchy queries
-- ============================================================================

-- Drop existing indexes if they exist (to avoid errors on re-run)
DROP INDEX IF EXISTS idx_mgas_rga_active_hide ON MGAs;
DROP INDEX IF EXISTS idx_mgas_legacy_active_hide ON MGAs;
DROP INDEX IF EXISTS idx_mgas_tree_active_hide ON MGAs;
DROP INDEX IF EXISTS idx_mgas_start ON MGAs;
DROP INDEX IF EXISTS idx_activeusers_sa_active ON activeusers;
DROP INDEX IF EXISTS idx_activeusers_ga_active ON activeusers;
DROP INDEX IF EXISTS idx_activeusers_mga_active ON activeusers;
DROP INDEX IF EXISTS idx_activeusers_rga_active ON activeusers;
DROP INDEX IF EXISTS idx_pnp_name_date ON pnp;
DROP INDEX IF EXISTS idx_licenses_lagnname ON licenses;
DROP INDEX IF EXISTS idx_licensed_states_userId ON licensed_states;
DROP INDEX IF EXISTS idx_usersinfo_lagnname_esid ON usersinfo;

-- ============================================================================
-- MGAs TABLE INDEXES
-- ============================================================================

-- For RGA hierarchy lookups (most common query)
-- Used in: searchByUserId, RGA rollup calculations, dashboard
CREATE INDEX idx_mgas_rga_active_hide ON MGAs(rga, active, hide);

-- For legacy hierarchy lookups
CREATE INDEX idx_mgas_legacy_active_hide ON MGAs(legacy, active, hide);

-- For tree hierarchy lookups
CREATE INDEX idx_mgas_tree_active_hide ON MGAs(tree, active, hide);

-- For first-year MGA calculations (RGA rollup)
CREATE INDEX idx_mgas_start ON MGAs(start, Active);

-- ============================================================================
-- ACTIVEUSERS TABLE INDEXES
-- ============================================================================

-- For SA downline queries
CREATE INDEX idx_activeusers_sa_active ON activeusers(sa, Active);

-- For GA downline queries
CREATE INDEX idx_activeusers_ga_active ON activeusers(ga, Active);

-- For MGA downline queries
CREATE INDEX idx_activeusers_mga_active ON activeusers(mga, Active);

-- For RGA downline queries
CREATE INDEX idx_activeusers_rga_active ON activeusers(rga, Active);

-- ============================================================================
-- PNP TABLE INDEXES
-- ============================================================================

-- For PNP data lookups by name and date
-- Used in: searchByUserId for getting latest PNP data
CREATE INDEX idx_pnp_name_date ON pnp(name_line, esid, date);

-- ============================================================================
-- LICENSE TABLES INDEXES
-- ============================================================================

-- For license lookups by lagnname (old licenses table)
CREATE INDEX idx_licenses_lagnname ON licenses(lagnname);

-- For license lookups by userId (new licensed_states table)
CREATE INDEX idx_licensed_states_userId ON licensed_states(userId);

-- ============================================================================
-- USERSINFO TABLE INDEXES
-- ============================================================================

-- For email lookups (used frequently in searchByUserId for upline emails)
CREATE INDEX idx_usersinfo_lagnname_esid ON usersinfo(lagnname, esid);

-- ============================================================================
-- VERIFICATION & STATS
-- ============================================================================

-- Run this query after creating indexes to verify they were created:
-- SHOW INDEXES FROM MGAs WHERE Key_name LIKE 'idx_%';
-- SHOW INDEXES FROM activeusers WHERE Key_name LIKE 'idx_%';
-- SHOW INDEXES FROM pnp WHERE Key_name LIKE 'idx_%';
-- SHOW INDEXES FROM licenses WHERE Key_name LIKE 'idx_%';
-- SHOW INDEXES FROM licensed_states WHERE Key_name LIKE 'idx_%';
-- SHOW INDEXES FROM usersinfo WHERE Key_name LIKE 'idx_%';

-- To see index usage statistics:
-- SELECT * FROM sys.schema_index_statistics WHERE object_schema = 'your_database_name';

