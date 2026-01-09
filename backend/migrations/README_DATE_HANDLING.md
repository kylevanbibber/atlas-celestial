# Date Handling in Atlas Application

This document explains how dates are handled throughout the Atlas application to ensure consistency.

## The Problem

MySQL `TIMESTAMP` and `DATETIME` columns are stored in the server's local timezone (EST for this application). When dates are returned from the database without proper formatting, they can be misinterpreted by the frontend, causing timezone issues like:
- Check-ins showing "2hr ago" when just logged
- Incorrect sorting by date
- Time calculations being off

## The Solution

### Backend: Consistent Date Formatting

All dates returned from the database should use `DATE_FORMAT()` to ensure consistent formatting:

```sql
DATE_FORMAT(date_column, '%Y-%m-%d %H:%i:%s') as formatted_date
```

This returns dates in the format: `2025-01-15 14:30:45`

**Example:**
```sql
SELECT 
  p.id,
  DATE_FORMAT(p.date_added, '%Y-%m-%d %H:%i:%s') as date_added,
  DATE_FORMAT(pcl.checkin_date, '%Y-%m-%d %H:%i:%s') as last_checkin_date
FROM pipeline p
LEFT JOIN pipeline_checkin_log pcl ON pcl.recruit_id = p.id
```

### Frontend: Proper Date Parsing

When parsing dates from the backend, follow this pattern:

```javascript
const parseDateString = (dateStr) => {
  if (!dateStr) return null;
  
  // Database stores in EST, treat as local time (no 'Z' suffix)
  let isoString = dateStr;
  if (!isoString.includes('T')) {
    isoString = dateStr.replace(' ', 'T');
  }
  // Do NOT add 'Z' - the timestamp is in EST, not UTC
  
  const date = new Date(isoString);
  if (isNaN(date.getTime())) return null;
  
  return date;
};
```

**Key Points:**
1. Replace space with 'T' to make it ISO-format compatible
2. **DO NOT** add 'Z' suffix (which marks it as UTC)
3. JavaScript's `Date` constructor will treat it as local time

## Files Updated

### Backend
- `backend/routes/recruitment.js` - All recruit queries now format `checkin_date`
- `backend/routes/checkInTexts.js` - Check-in history and last check-in queries

### Frontend
- `frontend/src/components/recruiting/Pipeline/PipelineKanban.js` - Date parsing functions

## Examples

### Backend Query
```sql
-- CORRECT ✓
SELECT DATE_FORMAT(checkin_date, '%Y-%m-%d %H:%i:%s') as checkin_date
FROM pipeline_checkin_log

-- INCORRECT ✗ (will cause timezone issues)
SELECT checkin_date
FROM pipeline_checkin_log
```

### Frontend Parsing
```javascript
// CORRECT ✓
const date = parseDateString('2025-01-15 14:30:45');
// Result: Date object representing Jan 15, 2025 at 2:30 PM local time

// INCORRECT ✗ (may cause timezone shift)
const date = new Date('2025-01-15 14:30:45Z');
// Result: Date object treated as UTC, shifted by timezone offset
```

## Testing

To verify dates are working correctly:

1. **Log a check-in** - Should show "Just now" immediately
2. **Wait 1 hour** - Should show "1h ago"
3. **Compare with database** - Times should match your local timezone
4. **Check sorting** - Newest items should sort correctly

## Common Pitfalls

❌ **Don't do this:**
- Adding 'Z' suffix to date strings
- Using `new Date()` directly without parsing
- Forgetting `DATE_FORMAT()` in SQL queries
- Mixing UTC and local time

✅ **Do this:**
- Always use `DATE_FORMAT()` in backend queries
- Use `parseDateString()` helper in frontend
- Keep timezone handling consistent across the app
- Test with actual data after changes

