# Instagram Handle Feature

## Overview
Added Instagram handle field to both the onboarding registration and the add recruit form. The field includes automatic validation and a clickable link to view the Instagram profile.

## Database Changes

### Migration File
`backend/migrations/add_instagram_to_pipeline.sql`

**Run this SQL to add the instagram column:**
```sql
-- Add instagram column to pipeline table
ALTER TABLE pipeline
ADD COLUMN instagram VARCHAR(255) NULL AFTER phone;

-- Add index for faster searches
CREATE INDEX idx_pipeline_instagram ON pipeline (instagram);
```

## Features

### 1. Onboarding Registration (`OnboardingRegister.js`)
- Added Instagram handle input field
- Automatically removes `@` symbol if user types it
- Shows clickable link to view profile on Instagram when handle is entered
- Field is optional and respects the `missingFields` logic for partial registrations

### 2. Add Recruit Modal (`AddRecruitModal.js`)
- Added Instagram handle input field in a new form row
- Same auto-removal of `@` symbol
- Same clickable Instagram profile link
- Field is optional

### 3. Backend Integration

#### Onboarding Routes (`backend/routes/onboarding.js`)
- Extracts `instagram` from request body
- Automatically removes `@` symbol on the backend as well
- Includes in both INSERT and UPDATE queries for pipeline table
- Handles null values properly

#### Recruitment Routes (`backend/routes/recruitment.js`)
- Added `instagram` to the POST `/recruits` endpoint
- Includes in INSERT query for new recruits
- Properly handles null values

## User Experience

### Input Behavior
1. User can type with or without `@` symbol
2. System automatically removes `@` if present
3. Stores clean username (e.g., "username" not "@username")

### Profile Link
When a handle is entered, displays:
```
View @username on Instagram
```
- Link opens in new tab
- Uses format: `https://instagram.com/{username}`
- Styled with primary color and underline

### Search Functionality
The database index on the `instagram` column allows for fast searching:
```sql
SELECT * FROM pipeline WHERE instagram LIKE '%search_term%';
```

## Testing Checklist

- [ ] Run migration SQL to add instagram column
- [ ] Test onboarding registration with Instagram handle
- [ ] Test onboarding registration without Instagram handle
- [ ] Test Add Recruit modal with Instagram handle
- [ ] Test Add Recruit modal without Instagram handle
- [ ] Verify `@` symbol is removed when typed
- [ ] Verify Instagram profile link works correctly
- [ ] Test existing recruits still load properly (null instagram values)
- [ ] Verify search functionality with the new index

## Notes

- Instagram handles are stored without the `@` symbol
- The field is optional (NULL allowed)
- The index improves search performance
- The feature is fully backward compatible with existing pipeline records




