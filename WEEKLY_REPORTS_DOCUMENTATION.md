# Weekly Production Reports Documentation

## Overview

The Weekly Production Reports system automatically sends comprehensive production summaries to all active MGAs, RGAs, SAs, and GAs every Monday at 9:00 AM ET.

## Features

### Automated Scheduling
- **Frequency**: Every Monday at 9:00 AM Eastern Time
- **Recipients**: All active users with `clname = 'MGA'`, `'RGA'`, `'SA'`, or `'GA'`
- **Requirement**: Users must have `Active = 'y'` and a valid email address

### Report Contents

Each weekly report includes:

1. **Codes MTD** (Month-To-Date)
   - Count of associates where SA, GA, MGA, or RGA = recipient's lagnname
   - PRODDATE within current month
   - **For RGAs**: Shows breakdown (uses `/mga-hierarchy/rga-rollup` and `/dataroutes/associates/multiple` endpoints):
     - **MGA Level**: Codes from all MGAs that roll up to this RGA (including first-year rollups)
     - **RGA Only**: Codes directly from the RGA (excluding MGA rollup)
     - **Total**: Sum of MGA + RGA codes

2. **Pending - Last 45 Days**
   - Count of pending cases from last 45 days
   - Where LagnName is NOT in associates table (not yet coded)

3. **Hire to Code Ratio (YTD)** *(MGA/RGA only)*
   - Total hires for the year / Total associates for the year
   - Not shown for SA/GA reports

4. **Hires MTD** *(MGA/RGA only)*
   - Sum of Total_Hires from amore_data
   - MGA = recipient's lagnname
   - MORE_Date in current month
   - Not shown for SA/GA reports
   - **For RGAs**: Shows breakdown (uses `/dataroutes/total-hires` endpoint):
     - **MGA Level**: Hires from all MGAs that roll up to this RGA
     - **RGA Only**: Hires directly from the RGA (excluding MGA rollup)
     - **Total**: Sum of MGA + RGA hires

5. **Team ALP MTD**
   - From Weekly_ALP table where REPORT = 'MTD Recap'
   - **For MGAs**: LVL_3_NET where CL_Name = 'MGA'
   - **For RGAs**: 
     - MGA Team ALP: SUM of LVL_3_NET where CL_Name = 'MGA' (across all entities)
     - RGA Team ALP: SUM of LVL_3_NET where CL_Name is blank/null (across all entities)
     - **Multi-Entity Handling**: RGAs with data from both NY and Main entities (different reportdates within a 3-day window) will have their values summed across both reports
   - **For SAs**: LVL_2_NET (SA Team ALP)
   - **For GAs**: LVL_3_NET (GA Team ALP)

6. **Personal Production MTD**
   - LVL_1_NET from same Weekly_ALP query
   - Individual production for the month

7. **Codes Last Month**
   - Count of associates from previous month
   - Same criteria as Codes MTD but for last month's date range

8. **VIPs Last Month**
   - Count of VIPs from previous month
   - From `VIPs` table where SA, GA, or MGA = recipient's lagnname
   - vip_month matches last month's year and month
   - **For RGAs**: Shows breakdown (uses `/dataroutes/vips/multiple` endpoint):
     - **MGA Level**: VIPs from all MGAs that roll up to this RGA (including first-year rollups)
     - **RGA Only**: VIPs directly from the RGA (excluding MGA rollup)
     - **Total**: Sum of MGA + RGA VIPs

9. **Retention (4-Month Rate)**
   - From PnP table using latest data per lagnname
   - **Level 1 (Personal)**: curr_mo_4mo_rate for agent_num ending in '-1'
   - **Level 2 (Team)**: curr_mo_4mo_rate for agent_num ending in '-2'
   - **Level 3 (Organization)**: curr_mo_4mo_rate for agent_num ending in '-3'
   - Uses flexible name matching (name_line = lagnname OR lagnname LIKE name_line + ' %')
   - Shows most recent PnP date for each level

## Email Format

The report is sent as a beautifully formatted HTML email with:
- Clean card-based layout
- Color-coded sections
- Highlighted metrics for easy scanning
- Warning styling for pending cases needing attention
- Responsive design

## Admin Controls

### Testing Individual Reports

1. Navigate to: **Utilities → Email Campaigns → Weekly Reports tab**
2. Enter an agent's lagnname (e.g., "SMITH JOHN")
3. Click "Send Test Report"
4. View the generated data before sending
5. Test email is sent to the agent's registered email address

### Manual Trigger

Admins can manually send all weekly reports:
1. Go to Weekly Reports tab
2. Click "Send All Reports Now"
3. Confirm the action
4. All reports are sent asynchronously
5. Check server logs for progress

### API Endpoints

```javascript
// Test single report
POST /api/email-campaigns/test-weekly-report
Body: { lagnname: "SMITH JOHN" }

// Trigger all reports
POST /api/email-campaigns/send-all-weekly-reports
```

## Implementation Details

### Files Created

1. **Backend Service**
   - `atlas/backend/services/weeklyReportEmailService.js`
   - Core logic for report generation and email formatting

2. **Scheduler**
   - `atlas/backend/scripts/weekly-report-scheduler.js`
   - Cron job configured for Monday 9 AM ET

3. **API Routes**
   - Added to `atlas/backend/routes/emailCampaigns.js`
   - Test and manual trigger endpoints

4. **Frontend Interface**
   - `atlas/frontend/src/pages/admin/EmailCampaigns.js`
   - Admin testing interface in Weekly Reports tab

### Database Tables Used

- `activeusers` - Recipient list and user info
- `associates` - Codes data
- `pending` - Pending cases data
- `amore_data` - Hires data
- `Weekly_ALP` - ALP and personal production data (reportdate is VARCHAR)
- `pnp` - Retention/persistency data (4-month rates)
- `VIPs` - VIP data (vip_month is datetime)

### Hire to Code Calculation

The hire to code ratio uses the same sophisticated rolling window calculation as the Scorecard:

```
For each week in the year:
  1. Sum codes from previous 13 weeks (weeks -1 to -13)
  2. Sum hires from 4-17 weeks prior (weeks -4 to -17)
  3. Calculate weekly ratio: hires / codes
  
YTD Ratio = Average of all weekly ratios for completed weeks
```

This accounts for the typical 4-week lag between hiring and coding.

## Error Handling

- Individual email failures are logged but don't stop the batch
- Success/failure counts are reported in logs
- 200ms delay between emails to avoid rate limiting
- Graceful handling of missing data (displays 0 or "—")

## Monitoring

Check server logs for:
- Schedule execution: "Weekly Report Email Job Starting"
- Individual sends: "Report sent to [name] at [email]"
- Completion summary: "X sent, Y failed out of Z total"
- Errors: Full error stack traces logged

## Configuration

### Schedule
Modify cron expression in `weekly-report-scheduler.js`:
```javascript
cron.schedule('0 9 * * 1', ...) // minute hour * * day-of-week
```

### Timezone
Set in scheduler options:
```javascript
{
  timezone: 'America/New_York' // Eastern Time
}
```

### Email Styling
Modify HTML template in `formatWeeklyReportEmail()` function.

## Future Enhancements

Potential additions:
- Customizable report sections
- Weekly vs. monthly frequency options
- PDF attachment support
- Historical comparison (this week vs. last week)
- Team rankings or benchmarking
- Graphical charts embedded in email

## Troubleshooting

### Reports Not Sending

1. Check if scheduler is initialized (server logs on startup)
2. Verify cron expression syntax
3. Check timezone configuration
4. Confirm SMTP settings are correct

### Missing Data in Reports

1. Verify database table names and column names
2. Check date range calculations
3. Ensure user has correct lagnname format
4. Verify user is in activeusers with correct clname

### Email Delivery Issues

1. Check spam/junk folders
2. Verify email addresses in activeusers table
3. Test SMTP connection: `/api/email-campaigns/test-connection`
4. Review emailService.js logs

## Support

For issues or questions:
1. Check server logs for detailed error messages
2. Test with a single user first using the test interface
3. Verify all database queries return expected data
4. Contact system administrator if SMTP issues persist

