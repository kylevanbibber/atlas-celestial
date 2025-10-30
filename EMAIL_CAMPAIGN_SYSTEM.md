# Email Campaign System Documentation

## Overview

The Email Campaign System allows administrators to create, manage, and send targeted email campaigns to users based on filter criteria. The system supports templates, dynamic variables, scheduled sending, and recipient preview.

## Features

- **Campaign Management**: Create, edit, and delete email campaigns
- **Template System**: Save and reuse email templates
- **Dynamic Variables**: Insert user-specific data (name, email, hierarchy info, etc.)
- **Recipient Filtering**: Filter recipients by clname, lagnname, ESID range
- **Recipient Preview**: Preview recipient list before sending
- **Scheduled Sending**: Send immediately or schedule for later
- **Send Tracking**: Track sent, failed, and pending emails
- **Admin/App User Only**: Only accessible to users with Role='Admin' or teamRole='app'

## System Architecture

### Backend Components

#### Database Tables

1. **email_templates** - Stores reusable email templates
2. **email_campaigns** - Stores campaign details and status
3. **email_recipients** - Tracks individual recipient status
4. **email_variables** - Defines available dynamic variables

#### Services

- **emailService.js** - Core email sending functionality using nodemailer
  - `sendEmail()` - Send basic email
  - `sendTemplateEmail()` - Send with variable replacement
  - `replaceVariables()` - Replace {{variable}} placeholders
  - `testConnection()` - Verify SMTP configuration

#### API Routes (`/api/email-campaigns`)

- `GET /` - List all campaigns
- `POST /` - Create new campaign
- `GET /:id` - Get campaign details
- `PUT /:id` - Update campaign
- `DELETE /:id` - Delete campaign
- `POST /:id/send` - Send campaign immediately
- `POST /:id/schedule` - Schedule campaign for later
- `GET /:id/recipients` - Get campaign recipients
- `POST /preview-recipients` - Preview filtered recipients
- `GET /templates/list` - List all templates
- `POST /templates` - Create new template
- `GET /variables` - Get available variables
- `GET /test-connection` - Test email configuration

#### Scheduled Job

- **process-email-campaigns.js** - Runs every 5 minutes via cron
- Automatically sends scheduled campaigns when their scheduled_at time arrives
- Updates campaign and recipient status
- Implements batch sending with rate limiting

### Frontend Components

#### Pages

- **EmailCampaigns.js** (`/utilities?section=email-campaigns`)
  - Main page with campaigns list and create tabs
  - Shows campaign status, recipient counts, send dates
  - Admin/App user access only

#### Components

1. **CampaignBuilder.js**
   - 3-step wizard for creating campaigns
   - Step 1: Email content (template selection, subject, body)
   - Step 2: Recipient filters (clname, lagnname, ESID)
   - Step 3: Send options (now or scheduled)

2. **VariablePicker.js**
   - Modal showing available variables
   - Categorized display (User Info, Hierarchy, Other)
   - Click to insert at cursor position

3. **RecipientPreviewModal.js**
   - Shows filtered recipient list
   - Displays count and user details
   - Confirms who will receive the email

## Setup Instructions

### 1. Database Migration

Run the SQL migration to create the required tables:

```bash
# Connect to your database and run:
mysql -u username -p database_name < backend/migrations/create_email_campaigns_tables.sql
```

Or execute directly in your database client.

### 2. Environment Variables

Add the following variables to your `.env` file:

```env
# SMTP Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
SMTP_FROM_NAME=Atlas Admin
SMTP_FROM_EMAIL=your-email@gmail.com
```

#### Gmail Setup (if using Gmail)

1. Enable 2-factor authentication on your Google account
2. Generate an App Password: https://myaccount.google.com/apppasswords
3. Use the app password as `SMTP_PASSWORD`

#### Other SMTP Providers

- **Outlook/Office 365**: `smtp.office365.com`, port 587
- **SendGrid**: `smtp.sendgrid.net`, port 587
- **Mailgun**: `smtp.mailgun.org`, port 587
- **AWS SES**: `email-smtp.us-east-1.amazonaws.com`, port 587

### 3. Server Restart

The email campaign scheduler starts automatically when the server starts. After adding environment variables:

```bash
# Restart your Node.js server
npm restart
# or
node app.js
```

### 4. Verify Configuration

Test your email configuration:

```bash
curl -X GET http://localhost:5001/api/email-campaigns/test-connection \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

## Usage Guide

### Creating a Campaign

1. Navigate to **Utilities** → **Email Campaigns** (admin/app users only)
2. Click **Create Campaign** tab
3. Follow the 3-step wizard:

#### Step 1: Email Content
- Enter campaign name
- (Optional) Select a template
- Write subject line (can include variables like `{{firstName}}`)
- Write email body (supports HTML)
- Click "Insert Variable" to add dynamic placeholders

#### Step 2: Recipients
- Add filters:
  - **CL Name**: e.g., "MGA, RGA" (comma-separated)
  - **Agent Name**: e.g., "SMITH JOHN" (comma-separated)
  - **ESID Range**: Min and/or Max values
- Click "Preview Recipients" to see who matches
- Must have at least one filter

#### Step 3: Send Options
- Choose "Send now" or "Schedule for later"
- If scheduling, select date and time
- Review summary
- Click "Send Now" or "Schedule"

### Using Templates

To create a template:

1. Create a campaign with your desired content
2. The template will be available in the dropdown for future campaigns

### Available Variables

Default variables (automatically available):

- `{{firstName}}` - User's first name
- `{{lastName}}` - User's last name
- `{{email}}` - User's email
- `{{clname}}` - Contract level name
- `{{lagnname}}` - Agent name
- `{{esid}}` - ESID number
- `{{phone}}` - Phone number
- `{{teamRole}}` - Team role

### Campaign Status

- **Draft**: Campaign created but not sent/scheduled
- **Scheduled**: Campaign scheduled for future sending
- **Sending**: Campaign is currently being sent
- **Sent**: Campaign successfully sent to all recipients
- **Failed**: Campaign encountered errors

### Recipient Status

- **Pending**: Email queued for sending
- **Sent**: Email successfully delivered
- **Failed**: Email delivery failed (see error message)

## Security Considerations

1. **Admin-Only Access**: All endpoints require admin role verification
2. **Parameterized Queries**: SQL injection prevention in filter queries
3. **Rate Limiting**: Built-in delays prevent SMTP rate limiting
4. **Email Validation**: Recipients must have valid email addresses
5. **Audit Trail**: All campaigns logged with creator info

## Troubleshooting

### Email Not Sending

1. Check SMTP configuration in `.env`
2. Test connection: `GET /api/email-campaigns/test-connection`
3. Check server logs for errors
4. Verify firewall allows SMTP port (usually 587 or 465)

### Gmail "Less Secure Apps" Error

- Use an App Password instead of your regular password
- Don't use "Less Secure Apps" (deprecated by Google)

### Scheduled Campaigns Not Sending

1. Verify server is running (scheduler needs active process)
2. Check campaign status is "scheduled"
3. Check scheduled_at time is in the past
4. Review server logs for cron job execution

### No Recipients Found

- Verify filter criteria matches actual user data
- Check that users have email addresses in activeusers table
- Use Preview Recipients to debug filters

## API Examples

### Create and Send Campaign

```javascript
// Create campaign
const campaign = await api.post('/email-campaigns', {
  name: 'Weekly Update',
  subject: 'Hello {{firstName}}!',
  body: 'This is a test email for {{lagnname}}',
  recipientFilter: {
    clname: ['MGA'],
    esidMin: 1000,
    esidMax: 2000
  }
});

// Send immediately
await api.post(`/email-campaigns/${campaign.data.campaignId}/send`);
```

### Schedule Campaign

```javascript
await api.post(`/email-campaigns/${campaignId}/schedule`, {
  scheduledAt: '2025-10-15T10:00:00'
});
```

### Preview Recipients

```javascript
const preview = await api.post('/email-campaigns/preview-recipients', {
  recipientFilter: {
    clname: ['RGA'],
    lagnname: ['SMITH JOHN', 'DOE JANE']
  }
});

console.log(`${preview.data.count} recipients will receive this email`);
```

## Database Schema

### email_templates
```sql
id, name, subject, body, variables (JSON), created_by, created_at, updated_at
```

### email_campaigns
```sql
id, template_id, name, subject, body, recipient_filter (JSON), 
status (draft/scheduled/sending/sent/failed), scheduled_at, sent_at, 
created_by, created_at, updated_at
```

### email_recipients
```sql
id, campaign_id, user_id, email, status (pending/sent/failed), 
sent_at, error_message, created_at
```

### email_variables
```sql
id, variable_key, variable_name, description, table_name, column_name, 
is_active, created_at
```

## Future Enhancements

- HTML email editor (WYSIWYG)
- A/B testing
- Email analytics (open rates, click tracking)
- Attachment support
- Unsubscribe functionality
- Email templates library
- Custom variable definitions
- Recipient list upload (CSV)
- Campaign duplication
- Email preview with sample data

## Support

For issues or questions, contact the development team or check server logs for detailed error messages.

