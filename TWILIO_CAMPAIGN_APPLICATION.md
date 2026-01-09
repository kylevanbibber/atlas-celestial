# Twilio SMS Campaign Application - Arias Life Onboarding Notifications

## Campaign Information

### Campaign Name
Arias Life Onboarding Notifications

### Campaign Description
Automated SMS notification system to help new insurance agents complete their licensing and onboarding process. Messages include reminders for pre-licensing course completion, appointment scheduling, document submission, and progress updates.

### Campaign Use Case
Account Notifications

### Sub Use Case
Customer Care

---

## Message Flow / Call to Action

### User Journey

1. **Opt-In Process:**
   - User visits onboarding registration page: `https://agents.ariaslife.com/onboarding/register`
   - User enters their mobile phone number
   - User checks the SMS opt-in checkbox with explicit consent language
   - User submits registration form
   - System sends initial welcome/confirmation SMS

2. **Message Types:**
   - Welcome message confirming enrollment
   - Pre-licensing course reminders (if not yet completed)
   - Progress check-ins based on onboarding stage
   - Appointment and deadline reminders
   - Document submission notifications
   - Completion confirmations

3. **Opt-Out Process:**
   - User can reply **STOP** to any message to unsubscribe
   - User receives confirmation message after opting out
   - User can also opt out via account settings in the portal

4. **Help Process:**
   - User can reply **HELP** to any message
   - System responds with support information and contact details

### Sample Message Flow

**Message 1 - Welcome (Sent immediately after opt-in):**
```
Welcome to Arias Life! We'll send you reminders and updates as you complete your onboarding. Reply STOP to opt out or HELP for assistance.
```

**Message 2 - Pre-Licensing Reminder (Sent 3 days after enrollment if course not started):**
```
Hi [Name]! Don't forget to start your pre-licensing course. Log in to your portal to enroll: https://agents.ariaslife.com/onboarding/home
```

**Message 3 - Progress Check-In (Sent when course is 50% complete):**
```
Great progress, [Name]! You're 50% through your course. Keep going - you're on track to finish by [Date].
```

**Message 4 - Appointment Reminder (Sent 24 hours before scheduled appointment):**
```
Reminder: Your background check appointment is tomorrow at [Time]. Location: [Address]. Questions? Contact your manager.
```

**Message 5 - Document Submission (Sent when documents are required):**
```
Action needed: Please upload your license documents to complete your onboarding. Visit: https://agents.ariaslife.com/onboarding/home
```

**Message 6 - Completion (Sent when onboarding is complete):**
```
Congratulations [Name]! You've completed onboarding. Welcome to the Arias Life team!
```

### Call to Action
Each message includes a clear call to action:
- Visit the onboarding portal
- Complete a specific task (enroll in course, upload documents, schedule appointment)
- Contact hiring manager for assistance
- Continue progress on current task

---

## Opt-In/Opt-Out

### Opt-In Method
**Double Opt-In via Web Form**

Users explicitly consent by:
1. Visiting the registration page: `https://agents.ariaslife.com/onboarding/register`
2. Entering their mobile phone number in the registration form
3. Checking a clearly labeled checkbox with consent language:
   > "I agree to receive text reminders and onboarding updates to this phone number."
4. Reading the disclosure text:
   > "By checking this box, you consent to receive automated text messages from Arias Life at the phone number provided. Message frequency varies. Message and data rates may apply. Reply STOP to opt out at any time. Reply HELP for help. View our Privacy Policy and Terms of Service."
5. Clicking the "Create Account" button to submit
6. Receiving an initial welcome/confirmation SMS

**Consent is explicit, affirmative, and documented.**

### Opt-In Confirmation
After registration, users receive an immediate welcome SMS confirming their enrollment and explaining how to opt out.

### Opt-Out Method
Users can opt out at any time by:
1. **Replying STOP** to any message (primary method)
2. Updating preferences in their account settings at `https://agents.ariaslife.com/onboarding/home`
3. Contacting their hiring manager

After opting out via STOP, users receive one final confirmation message:
```
You have been unsubscribed from Arias Life onboarding texts. You will not receive further messages. To re-subscribe, log in to your portal.
```

### Help Keyword
Users can reply **HELP** to any message to receive:
```
Arias Life Onboarding Help: For assistance, contact your hiring manager through your portal at https://agents.ariaslife.com/onboarding/home or call (888) 247-2748. Reply STOP to unsubscribe.
```

---

## Compliance

### Privacy Policy URL
`https://agents.ariaslife.com/privacy-policy`

The Privacy Policy is:
- Publicly accessible without login
- Clearly linked on the registration page
- Describes data collection, use, and sharing practices
- Explains SMS program details and opt-out rights
- Compliant with TCPA, CTIA, and carrier requirements

### Terms of Service URL
`https://agents.ariaslife.com/terms-of-service`

The Terms of Service include:
- SMS program terms and conditions
- Message frequency disclosure
- Opt-out instructions
- Supported carriers
- Standard rates disclosure
- User responsibilities

### Message Frequency
Message frequency varies based on user's onboarding stage and activity. Users may receive:
- **Average:** 2-5 messages per week during active onboarding
- **Maximum:** Up to 10 messages per week during peak onboarding periods
- **Minimum:** 0-1 messages per week for users who have completed most steps

Frequency is disclosed in:
- Opt-in consent text on registration page
- Privacy Policy
- Terms of Service
- Welcome message

### Standard Rates Disclosure
Clearly stated in multiple locations:
- Registration page: "Message and data rates may apply"
- Privacy Policy
- Terms of Service
- Help keyword response

### Supported Carriers
AT&T, T-Mobile, Verizon, Sprint, Boost Mobile, Cricket Wireless, MetroPCS, U.S. Cellular, Virgin Mobile, and other major U.S. carriers.

---

## Business Information

### Company Name
Arias Life

### Business Address
1234 Insurance Way, Suite 100
Grand Rapids, MI 49503
United States

### Contact Phone
(888) 247-2748

### Contact Email
support@ariaslife.com

### Industry
Insurance - Life Insurance Agent Onboarding and Training

### Business Description
Arias Life is a life insurance marketing organization that recruits, trains, and supports independent insurance agents. Our onboarding SMS program helps new agents complete their licensing and training requirements efficiently.

---

## Technical Details

### SMS Provider
Twilio

### Message Type
Transactional and Promotional (Account Notifications)

### Content Type
Text only (no MMS)

### Sender ID
Short code or 10DLC number (as assigned by Twilio)

### Daily Message Volume
Estimated 50-200 messages per day

### Total Subscribers
Estimated 100-500 active subscribers at any given time

---

## Sample Messages (Additional Examples)

### Enrollment Confirmation
```
Welcome to Arias Life, [Name]! Your onboarding portal is ready. Log in at https://agents.ariaslife.com/onboarding/home to get started. Reply STOP to opt out.
```

### Course Progress Update
```
Hi [Name]! You've spent 5 hours on your pre-licensing course. You're making great progress! Keep it up!
```

### Deadline Reminder
```
Reminder: Your expected course completion date is [Date]. You're on track! Need help? Contact your manager through your portal.
```

### Document Upload Request
```
Action needed: Please upload your state license to your onboarding portal. This is required to proceed. Visit: https://agents.ariaslife.com/onboarding/home
```

### Check-In Message (No Action Required)
```
Hi [Name]! Just checking in on your onboarding progress. Let your manager know if you need any assistance. Reply STOP to opt out.
```

### Appointment Scheduled
```
Your background check is scheduled for [Date] at [Time]. Location details are in your portal: https://agents.ariaslife.com/onboarding/home
```

---

## Compliance Certifications

- ✅ TCPA Compliant (Telephone Consumer Protection Act)
- ✅ CTIA Compliant (Cellular Telecommunications Industry Association)
- ✅ Carrier Guidelines Compliant (AT&T, T-Mobile, Verizon)
- ✅ GDPR Aware (for any international users)
- ✅ CCPA Compliant (California Consumer Privacy Act)
- ✅ CAN-SPAM Compliant (for any email communications)

---

## Attestation

I attest that:
1. All subscribers have provided explicit, written consent to receive SMS messages
2. Opt-in consent is obtained before sending any messages
3. Clear opt-out instructions are provided in every message
4. Privacy Policy and Terms of Service are publicly accessible
5. Message content is relevant to the user's onboarding process
6. We will honor all opt-out requests immediately
7. We will not share phone numbers with third parties for marketing purposes
8. All messages comply with TCPA, CTIA, and carrier requirements

---

## Additional Notes

- All message timestamps are logged for compliance
- Opt-in and opt-out actions are recorded in our database
- Users can view their message history in the onboarding portal
- Messages are only sent during reasonable hours (8 AM - 8 PM local time)
- No messages are sent on Sundays unless critical
- Message content is personalized based on user's onboarding stage
- System automatically stops sending messages when onboarding is complete

