-- One-time cleanup: trim trailing/leading whitespace and collapse internal spaces
-- in all name/hierarchy columns across activeusers and Daily_Activity

-- activeusers: lagnname, mga, rga, sa, ga, reg_dir, rept_name
UPDATE activeusers
SET lagnname = TRIM(lagnname)
WHERE lagnname != TRIM(lagnname) OR lagnname LIKE '%  %';

UPDATE activeusers
SET mga = TRIM(mga)
WHERE mga IS NOT NULL AND (mga != TRIM(mga) OR mga LIKE '%  %');

UPDATE activeusers
SET rga = TRIM(rga)
WHERE rga IS NOT NULL AND (rga != TRIM(rga) OR rga LIKE '%  %');

UPDATE activeusers
SET sa = TRIM(sa)
WHERE sa IS NOT NULL AND (sa != TRIM(sa) OR sa LIKE '%  %');

UPDATE activeusers
SET ga = TRIM(ga)
WHERE ga IS NOT NULL AND (ga != TRIM(ga) OR ga LIKE '%  %');

UPDATE activeusers
SET reg_dir = TRIM(reg_dir)
WHERE reg_dir IS NOT NULL AND (reg_dir != TRIM(reg_dir) OR reg_dir LIKE '%  %');

UPDATE activeusers
SET rept_name = TRIM(rept_name)
WHERE rept_name IS NOT NULL AND (rept_name != TRIM(rept_name) OR rept_name LIKE '%  %');

-- Daily_Activity: agent and MGA columns
UPDATE Daily_Activity
SET agent = TRIM(agent)
WHERE agent != TRIM(agent) OR agent LIKE '%  %';

UPDATE Daily_Activity
SET MGA = TRIM(MGA)
WHERE MGA IS NOT NULL AND (MGA != TRIM(MGA) OR MGA LIKE '%  %');

-- amore_data: MGA, RGA, Legacy, Tree columns
UPDATE amore_data
SET MGA = TRIM(MGA)
WHERE MGA IS NOT NULL AND (MGA != TRIM(MGA) OR MGA LIKE '%  %');

UPDATE amore_data
SET RGA = TRIM(RGA)
WHERE RGA IS NOT NULL AND (RGA != TRIM(RGA) OR RGA LIKE '%  %');

UPDATE amore_data
SET Legacy = TRIM(Legacy)
WHERE Legacy IS NOT NULL AND (Legacy != TRIM(Legacy) OR Legacy LIKE '%  %');

UPDATE amore_data
SET Tree = TRIM(Tree)
WHERE Tree IS NOT NULL AND (Tree != TRIM(Tree) OR Tree LIKE '%  %');

-- associates: lagnname and hierarchy columns
UPDATE associates
SET lagnname = TRIM(lagnname)
WHERE lagnname IS NOT NULL AND (lagnname != TRIM(lagnname) OR lagnname LIKE '%  %');

UPDATE associates
SET mga = TRIM(mga)
WHERE mga IS NOT NULL AND (mga != TRIM(mga) OR mga LIKE '%  %');

UPDATE associates
SET rga = TRIM(rga)
WHERE rga IS NOT NULL AND (rga != TRIM(rga) OR rga LIKE '%  %');

UPDATE associates
SET sa = TRIM(sa)
WHERE sa IS NOT NULL AND (sa != TRIM(sa) OR sa LIKE '%  %');

UPDATE associates
SET ga = TRIM(ga)
WHERE ga IS NOT NULL AND (ga != TRIM(ga) OR ga LIKE '%  %');

-- VIPs: hierarchy columns
UPDATE VIPs
SET mga = TRIM(mga)
WHERE mga IS NOT NULL AND (mga != TRIM(mga) OR mga LIKE '%  %');

UPDATE VIPs
SET rga = TRIM(rga)
WHERE rga IS NOT NULL AND (rga != TRIM(rga) OR rga LIKE '%  %');

UPDATE VIPs
SET sa = TRIM(sa)
WHERE sa IS NOT NULL AND (sa != TRIM(sa) OR sa LIKE '%  %');

UPDATE VIPs
SET ga = TRIM(ga)
WHERE ga IS NOT NULL AND (ga != TRIM(ga) OR ga LIKE '%  %');

-- MGAs: lagnname, rga columns
UPDATE MGAs
SET lagnname = TRIM(lagnname)
WHERE lagnname IS NOT NULL AND (lagnname != TRIM(lagnname) OR lagnname LIKE '%  %');

UPDATE MGAs
SET rga = TRIM(rga)
WHERE rga IS NOT NULL AND (rga != TRIM(rga) OR rga LIKE '%  %');

-- pnp: name_line column
UPDATE pnp
SET name_line = TRIM(name_line)
WHERE name_line IS NOT NULL AND (name_line != TRIM(name_line) OR name_line LIKE '%  %');

-- pending: LagnName and hierarchy columns
UPDATE pending
SET LagnName = TRIM(LagnName)
WHERE LagnName IS NOT NULL AND (LagnName != TRIM(LagnName) OR LagnName LIKE '%  %');

UPDATE pending
SET MGA = TRIM(MGA)
WHERE MGA IS NOT NULL AND (MGA != TRIM(MGA) OR MGA LIKE '%  %');
