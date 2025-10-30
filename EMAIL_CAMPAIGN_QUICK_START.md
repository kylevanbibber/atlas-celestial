# Email Campaign System - Quick Start Guide

## 🚀 5-Minute Setup

### Step 1: Run Database Migration (1 min)

Connect to your MySQL database and run:

```bash
mysql -u your_username -p your_database < backend/migrations/create_email_campaigns_tables.sql
```

Or use a database client (MySQL Workbench, phpMyAdmin, etc.) to execute the SQL file.

### Step 2: Configure SMTP (2 min)

Add these lines to your `.env` file:

```env
# For Gmail (recommended for testing)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
SMTP_FROM_NAME=Atlas Admin
SMTP_FROM_EMAIL=your-email@gmail.com
```

**Gmail App Password Setup:**
1. Go to https://myaccount.google.com/apppasswords
2. Generate an app password for "Mail"
3. Use the 16-character password as `SMTP_PASSWORD`

### Step 3: Restart Server (30 sec)

```bash
# Stop your current server (Ctrl+C)
# Then restart:
npm start
# or
node app.js
```

### Step 4: Verify Configuration (30 sec)

Test your SMTP connection:

```bash
# Using curl (replace YOUR_TOKEN with your admin JWT token)
curl -X GET http://localhost:5001/api/email-campaigns/test-connection \
  -H "Authorization: Bearer YOUR_TOKEN"
```

Or visit in browser after logging in as admin:
`http://localhost:5001/api/email-campaigns/test-connection`

Expected response:
```json
{
  "success": true,
  "message": "Email connection verified successfully"
}
```

### Step 5: Create Your First Campaign (1 min)

1. Login as an admin or app user
2. Go to **Utilities** → **Email Campaigns**
3. Click **Create Campaign** tab
4. Fill in:
   - Campaign name: "Test Email"
   - Subject: "Hello {{firstName}}!"
   - Body: "This is a test email for {{lagnname}}"
5. Add a filter (e.g., ESID Min: 1000, Max: 1100)
6. Click **Preview Recipients** to verify
7. Choose **Send now**
8. Click **Send Now**

Done! 🎉

---

## 📧 Sending Your First Real Campaign

### Example 1: Welcome Email to New MGAs

**Step 1: Email Content**
```
Name: New MGA Welcome
Subject: Welcome to the Team, {{firstName}}!
Body:
Hello {{firstName}} {{lastName}},

Welcome to our organization! We're excited to have you as part of the {{clname}} team under {{lagnname}}.

Your ESID is: {{esid}}

Best regards,
Atlas Admin
```

**Step 2: Recipients**
```
CL Name: MGA
```

**Step 3: Send**
- Choose "Send now" and click Send Now

### Example 2: Monthly Update to RGAs

**Step 1: Email Content**
```
Name: RGA Monthly Update
Subject: Monthly Update - {{lagnname}}
Body:
<h2>Monthly Update</h2>
<p>Dear {{firstName}},</p>
<p>Here's your monthly update for the {{clname}} level...</p>
<p>Contact: {{email}} | Phone: {{phone}}</p>
```

**Step 2: Recipients**
```
CL Name: RGA
```

**Step 3: Send**
- Choose "Schedule for later"
- Select date and time
- Click Schedule

### Example 3: Targeted Communication

**Step 1: Email Content**
```
Name: Q4 Goals Reminder
Subject: Q4 Goals - Action Required
Body:
Hi {{firstName}},

This is a reminder about your Q4 goals for {{lagnname}}.

Please review and confirm by end of week.

Thank you!
```

**Step 2: Recipients**
```
Agent Name: SMITH JOHN, DOE JANE, JOHNSON MIKE
ESID Min: 1000
ESID Max: 5000
```

**Step 3: Send**
- Send now or schedule

---

## 🔧 Troubleshooting

### "Email service not configured"
- Check your `.env` file has all SMTP variables
- Restart the server after adding variables

### "Connection test failed"
- For Gmail: Make sure you're using an App Password, not your regular password
- Check firewall allows port 587
- Verify SMTP_HOST and SMTP_PORT are correct

### "No recipients match the filters"
- Check your filter criteria
- Use Preview Recipients to debug
- Verify users have email addresses in database

### Scheduled emails not sending
- Make sure server is running (scheduler needs active process)
- Check campaign status is "scheduled" not "draft"
- Wait up to 5 minutes (cron runs every 5 min)
- Check server logs for errors

---

## 📝 Tips & Best Practices

### Variable Usage
- Always preview your email before sending
- Test variables with a small group first
- Use {{firstName}} instead of full name for personalization

### Recipient Filtering
- Start with specific filters for testing
- Use Preview Recipients to verify your filters
- Remember: filters use AND logic (all conditions must match)

### Scheduling
- Schedule during business hours for better engagement
- Consider time zones of your recipients
- Test with immediate send first, then schedule

### Templates
- Create templates for recurring emails
- Use clear, descriptive template names
- Update templates as needed (they're reusable)

### Testing
1. Always test with yourself first
2. Send to a small group before mass sending
3. Check spam folder if emails don't arrive
4. Verify variables are replaced correctly

---

## 📊 Monitoring Campaigns

After sending, check the Campaigns list to see:
- **Recipients**: Total number
- **Sent/Failed**: Delivery status
- **Status**: Overall campaign status
- **Sent At**: When campaign completed

Click on a campaign to see individual recipient status.

---

## 🆘 Need Help?

1. Check `EMAIL_CAMPAIGN_SYSTEM.md` for detailed documentation
2. Review server logs for error messages
3. Test SMTP connection endpoint
4. Verify database tables were created correctly

---

## ✅ Quick Checklist

- [ ] Database migration ran successfully
- [ ] SMTP variables added to .env
- [ ] Server restarted
- [ ] SMTP connection test passed
- [ ] Can access Utilities → Email Campaigns
- [ ] Test email sent and received
- [ ] Ready for production use!

---

**You're all set!** Start sending targeted emails to your users. 🚀

