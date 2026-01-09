# TextMagic Inbound SMS Webhook Setup

## Overview
This guide explains how to configure TextMagic to send incoming SMS messages (replies from recruits) to your Atlas application.

## What You Need
- TextMagic account credentials (already configured in `backend/services/textmagic.js`)
- Access to TextMagic dashboard
- Your Atlas backend URL (e.g., `https://api.ariaslife.com` or your production URL)

## Webhook Endpoint
The webhook endpoint is already created and ready to receive incoming messages:

**Endpoint:** `POST /api/recruitment/sms/webhook/inbound`

**Full URL:** `https://your-backend-url.com/api/recruitment/sms/webhook/inbound`

## Setup Steps

### 1. Log into TextMagic Dashboard
1. Go to https://my.textmagic.com/online/
2. Log in with your credentials:
   - Username: `kylevanbibber`
   - API Key: (from account settings)

### 2. Configure Webhook
1. Navigate to **Settings** → **Webhooks** → **Callbacks**
2. Click **"Add New Callback"**
3. Configure the callback:
   - **Event Type:** Select **"Incoming Message"**
   - **Callback URL:** Enter your webhook URL:
     ```
     https://your-backend-url.com/api/recruitment/sms/webhook/inbound
     ```
   - **HTTP Method:** POST
   - **Format:** JSON
4. Click **"Save"**

### 3. Test the Webhook
1. Send a text message to your TextMagic number from your phone
2. Check your backend logs for:
   ```
   [TextMagic Webhook] Received inbound message: {...}
   [TextMagic Webhook] Matched to pipeline recruit: 123 John Doe
   [TextMagic Webhook] Inbound message stored successfully
   ```
3. Open the recruit's details in Atlas and click the "Texts" tab
4. You should see the incoming message with a green "Reply" badge

## Webhook Payload Format
TextMagic sends the following data:
```json
{
  "id": "12345678",
  "sender": "+19015551234",
  "receiver": "+19015559999",
  "text": "Thanks! I'll complete the onboarding today.",
  "receivedAt": "2025-11-19T15:30:00Z",
  "firstName": "John",
  "lastName": "Doe"
}
```

## How It Works

### 1. Incoming Message Flow
```
Recruit sends text
    ↓
TextMagic receives it
    ↓
TextMagic calls webhook
    ↓
Atlas matches phone number to pipeline recruit
    ↓
Message stored in sms_messages table
    ↓
Message appears in Texts tab
```

### 2. Phone Number Matching
The system tries to match the sender's phone number with pipeline recruits using:
- Exact match
- Last 10 digits match (handles different formats)
- Partial match

If no match is found, the message is still stored but with `pipeline_id = NULL`.

### 3. Database Storage
Inbound messages are stored in the `sms_messages` table with:
- `direction = 'inbound'`
- `user_id = NULL` (no Atlas user sent it)
- `from_number = recruit's phone`
- `to_number = your TextMagic number`
- `pipeline_id = matched recruit ID`
- `cost_credits = 0` (inbound messages are free)

## UI Display

### Outbound Messages (sent by you)
- Blue left border
- Shows sender's name and avatar
- Shows delivery status (✓ or ✓✓)
- "To: phone number"

### Inbound Messages (replies from recruits)
- Green left border
- Light blue background
- Green avatar
- "Reply" badge
- No delivery status
- "From: phone number"

## Troubleshooting

### Messages Not Appearing
1. **Check webhook is configured:**
   - Log into TextMagic dashboard
   - Verify webhook URL is correct
   - Ensure "Incoming Message" event is selected

2. **Check backend logs:**
   ```bash
   # Look for webhook logs
   grep "TextMagic Webhook" backend.log
   ```

3. **Test webhook manually:**
   ```bash
   curl -X POST https://your-backend-url.com/api/recruitment/sms/webhook/inbound \
     -H "Content-Type: application/json" \
     -d '{
       "id": "test123",
       "sender": "+19015551234",
       "receiver": "+19015559999",
       "text": "Test message",
       "receivedAt": "2025-11-19T15:30:00Z"
     }'
   ```

### Phone Number Not Matching
1. **Check pipeline.phone format:**
   - Should be stored consistently (e.g., with or without +1)
   - System handles various formats but consistency helps

2. **Check backend logs:**
   ```
   [TextMagic Webhook] No pipeline recruit found for phone: +19015551234
   ```

3. **Manually verify:**
   ```sql
   SELECT id, recruit_first, recruit_last, phone 
   FROM pipeline 
   WHERE phone LIKE '%9015551234%';
   ```

## Security Considerations

### Webhook Authentication (Optional Enhancement)
Currently, the webhook endpoint is public. For production, consider:

1. **IP Whitelist:** Only allow TextMagic IPs
2. **Signature Verification:** Verify TextMagic's webhook signature
3. **API Key:** Require a secret key in headers

### Rate Limiting
The endpoint has no rate limiting. Consider adding rate limiting in production.

## Database Migration
Before using inbound SMS, run the migration:

```bash
mysql -u your_user -p your_database < backend/migrations/add_inbound_sms_support.sql
```

This adds:
- `from_number` column
- `direction` column (outbound/inbound)
- Makes `user_id` nullable
- Adds appropriate indexes

## Support
If you encounter issues:
1. Check backend logs
2. Verify webhook configuration in TextMagic
3. Test with a manual curl request
4. Check database for stored messages

