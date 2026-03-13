-- First, let's find a valid user ID from your activeusers table
-- Run this to see available user IDs:

SELECT id, lagnname, Role FROM activeusers WHERE Active = 'y' AND Role = 'Admin' LIMIT 5;

-- OR if you want to use your own user ID, find it with:
-- SELECT id, lagnname FROM activeusers WHERE lagnname LIKE '%YOUR_NAME%';

-- Then use one of those IDs in the INSERT below
-- Replace 'YOUR_USER_ID_HERE' with an actual ID from the query above

INSERT INTO competitions (title, description, prize, rules, start_date, end_date, status, competition_type, metric_type, target_value, is_global, created_by) 
VALUES (
  'February ALP Challenge', 
  'Monthly competition to drive ALP performance', 
  '$500 bonus + recognition trophy', 
  '• Track your ALP from Feb 1-28\n• All active agents eligible\n• Must maintain good standing throughout the month', 
  '2025-02-01 00:00:00', 
  '2025-02-28 23:59:59', 
  'active', 
  'individual', 
  'alp', 
  5000.00, 
  true, 
  YOUR_USER_ID_HERE  -- Replace this with an actual user ID
);
