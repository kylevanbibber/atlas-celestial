-- Grant App Admin Permissions
-- This script updates the teamRole to 'app' for users who need access to:
-- - Send verification emails early
-- - Resend verification emails
-- - Archive/unarchive applications
-- - Update client contact information

-- Update your user to have app admin permissions
-- Replace 'YOUR_EMAIL_HERE' with your actual email or use the user ID

-- Option 1: Update by email (recommended)
UPDATE activeusers 
SET teamRole = 'app' 
WHERE email = 'YOUR_EMAIL_HERE';

-- Option 2: Update by user ID
-- UPDATE activeusers 
-- SET teamRole = 'app' 
-- WHERE id = YOUR_USER_ID_HERE;

-- Option 3: Update by lagnname
-- UPDATE activeusers 
-- SET teamRole = 'app' 
-- WHERE lagnname = 'YOUR_LAGNNAME_HERE';

-- Verify the update
SELECT id, lagnname, email, teamRole, Role 
FROM activeusers 
WHERE teamRole = 'app' OR Role = 'Admin';

