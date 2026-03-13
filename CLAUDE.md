# Atlas - Arias Agencies Platform

## Overview
Full-stack sales force management platform for Arias Agencies. Handles production tracking, recruitment pipeline, daily activity reporting, team leaderboards, Discord bot integration, verification/compliance, and real-time notifications.

**Production URL:** https://agents.ariaslife.com
**Backend API:** https://atlas-celest-backend-3bb2fea96236.herokuapp.com/api
**Deployment:** Heroku (Procfile: `web: node server.js`)

---

## Tech Stack

| Layer | Tech |
|-------|------|
| Backend | Node.js / Express 4.18 |
| Frontend | React 18 / React Router 7 |
| Database | MySQL (ClearDB on Heroku) |
| WebSocket | `ws` library (notifications + voice) |
| Auth | JWT (`jsonwebtoken` + `bcryptjs`) |
| Email | Nodemailer (SMTP via mail.ariaslife.com) |
| SMS | Twilio |
| Payments | Stripe |
| AI | OpenAI (gpt-4o), Deepgram (STT), ElevenLabs (TTS) |
| Bot | Discord.js 14 |
| Scheduling | node-cron |
| Image Upload | Imgur (via backend proxy) |
| CSS | Vanilla CSS (no Tailwind/SCSS) |
| Icons | react-icons (Feather icons primarily) |

---

## Project Structure

```
atlas/
├── backend/
│   ├── app.js              # Express server entry point (port 5001)
│   ├── db.js               # MySQL connection pool (15 connections)
│   ├── wsVoice.js           # Voice WebSocket handler
│   ├── bot/                 # Discord bot (slash commands, leaderboards)
│   ├── routes/              # ~50 API route files
│   ├── services/            # Email, SMS, voice, AI services
│   ├── schedulers/          # Cron jobs (reminders, reports, sync)
│   ├── middleware/          # Auth middleware (verifyToken)
│   └── migrations/          # SQL migration files
├── frontend/
│   ├── src/
│   │   ├── App.js           # Main routing
│   │   ├── api.js           # Axios client with interceptors
│   │   ├── pages/           # Page-level components
│   │   ├── components/      # Reusable UI components
│   │   ├── context/         # React Context providers
│   │   └── utils/           # Utility functions
│   ├── server.js            # Static file server for production
│   └── public/              # Static assets, service worker
├── server.js                # Root production server
└── Procfile                 # Heroku: web: node server.js
```

---

## Database Schema (153 tables)

**Engine:** MySQL with `mysql` and `mysql2` libraries
**Timezone:** All timestamps in Eastern (America/New_York)
**Connection:** Pool with 15 connection limit, 60s timeout, 3s slow query warning

### Column Naming Quirks

These are legacy names used consistently throughout — do NOT rename:

| Column | Meaning | Notes |
|--------|---------|-------|
| `lagnname` | Full agent name | Not a typo — used everywhere |
| `clname` | Class/level name | Values: AGT, SA, GA, MGA, RGA, SGA |
| `agtnum` | Agent number | |
| `esid` | Employee/agent ID | Date type in activeusers, varchar elsewhere |
| `screen_name` | Display name | DB column is snake_case (not `screenName`) |
| `profpic` | Profile picture URL | |
| `Active` | Active status | String 'y'/'n', not boolean |
| `teamRole` | Team role | 'app' = admin |
| `rept_name` | Report name | |
| `rowcolor` | Row color | Present on nearly every table (legacy) |

### Core User & Auth Tables

**`activeusers`** — Primary user table (central FK target for most tables)
- PK: `id` (int, auto_increment)
- Identity: `lagnname`, `agtnum`, `clname`, `esid` (date), `email`, `phone`, `screen_name`
- Hierarchy: `sa`, `ga`, `mga`, `rga`, `reg_dir`, `rept_name`
- Auth: `Password` (bcrypt), `Role`, `teamRole`, `Active` (y/n), `LastLoggedIn`
- Profile: `profpic`, `header_pic`, `bio`, `discord_id`
- Integrations: `calendly_*`, `zoom_*`, `google_calendar_*`, `outlook_calendar_*`, `stripe_customer_id`
- Pipeline: `pipeline_id` → FK to `pipeline.id`
- Unique: (`lagnname`, `esid`), `discord_id`

**`user_tokens`** — JWT session tracking
- `user_id`, `token`, `valid` (tinyint), `created_at`, `expires_at`

**`admin_logins`** — Separate admin credentials
- `Username`, `Password`, `Email`, `Screen_Name`, `Admin_Level`, `Agency`, `teamRole`

**`login_logs`** — Login audit trail
- `user_id` → FK `activeusers.id`, `timestamp`, `ip_address`, `user_agent`, `lagnname`

**`MGAs`** — Manager hierarchy (SA/GA/MGA/RGA level users)
- PK: `id`; Identity: `lagnname`, `agtnum`, `clname`, `esid`, `mga`, `rga`
- Unique: (`esid`, `lagnname`)

**`sgas`** — SGA (top-level organization) definitions
- `id`, `rept_name` (unique), `active`, `hide`, `is_default`

**`user_agencies`** — Multi-agency user access
- `user_id` → FK `activeusers.id`, `sga_id` → FK `sgas.id`; Unique: (`user_id`, `sga_id`)

**`user_selected_agency`** — Currently selected agency per user
- `user_id` → FK `activeusers.id`, `sga_id` → FK `sgas.id`

### Production & Sales Tables

**`Daily_Activity`** — Daily production tracking
- PK: `id`; `userId` (varchar), `reportDate` (date)
- HC (Health Care): `HC_Appt`, `HC_Sit`, `HC_Sale`, `HC_ALP`
- POS: `POS_Appt`, `POS_Sit`, `POS_Sale`, `POS_ALP`
- Referrals: `refAppt`, `refSit`, `refSale`, `refAlp`
- Vendor: `Vendor_Appt`, `Vendor_Sit`, `Vendor_Sale`, `Vendor_ALP`
- Totals: `calls`, `appts`, `sits`, `sales`, `alp`, `refs`
- Hierarchy: `agent`, `MGA`, `rga`, `SA`, `GA`, `Legacy`, `Tree`
- Unique: (`userId`, `reportDate`)

**`discord_sales`** — Sales logged via Discord bot or web app
- PK: `id`; `discord_user` (varchar), `guild_id`, `user_id` → FK `activeusers.id`
- Data: `alp` (decimal), `refs` (int), `lead_type`, `image_url`, `ts` (datetime)
- `submission_id` (unique, nullable — NULL for web-submitted sales)

**`Arias_ALP` / `Monthly_ALP` / `Weekly_ALP` / `Dlabik_ALP`** — ALP reporting by period
- Columns: `REPORT`, `SGA`, `MGA_NAME`, `LagnName`, `CTLNO`, `CL_Name`
- ALP levels: `LVL_1_GROSS/NET`, `LVL_2_GROSS/NET`, `LVL_2_F6_GROSS/NET`, `LVL_3_*`

**`VIPs`** — VIP agent recognition
- `lagnname`, `agtnum`, `cl_name`, `vip_month`, `softcode_date`, `count`, `gs`
- Hierarchy: `sa`, `ga`, `mga`, `reg_dir`, `rept_name`

**`Coded`** — Coded agents (production codes)
- `LagnName`, `AgtNum`, `PRODDATE`, `SA`, `GA`, `MGA`, `RGA`, `SGA`, `QCAT`, `PRODWK`

**`production_goals`** — User production goals
- `activeUserId` → FK `activeusers.id`, `year`, `month`, `goal_type`
- `target_value`, `current_value`; Unique: (`activeUserId`, `year`, `month`, `goal_type`)

**`commits`** — Agent commitments (hires/codes/vips)
- `userId` → FK `activeusers.id`, `type` (hires/codes/vips), `time_period` (month/week)
- `start`, `end`, `amount`, `lagnname`, `clname`

**`code_potential`** — Code potential tracking by org
- `org`, `recruiting_obj`, `codes_mtd`, `potential_vips`, `pending_agents`, `email_received_date`

### Recruiting & Pipeline Tables

**`pipeline`** — Recruitment pipeline (main table)
- PK: `id`; recruit info, stage tracking, `instagram`
- Linked via `activeusers.pipeline_id`

**`pipeline_stage_definitions`** — Custom pipeline stages per team
- `team_id` → FK `activeusers.id`, `stage_name`, `position_before/after`, `active`

**`pipeline_checklist_items`** — Checklist items within stages
- `team_id` → FK `activeusers.id`, `stage_name`, `item_name`, `item_type`, `active`

**`pipeline_checklist_progress`** — Completion tracking per recruit
- `recruit_id` → FK `pipeline.id`, `checklist_item_id` → FK `pipeline_checklist_items.id`
- `completed` (tinyint), `completed_by`, `completed_at`, `started_at`

**`pipeline_checkin_log`** — Check-in history for recruits
- `recruit_id` → FK `pipeline.id`, `checkin_by` → FK `activeusers.id`
- `checkin_type`, `checkin_date`, `current_checklist_item_id`

**`pipeline_state_requirements`** — State-specific pipeline modifications
- `state`, `stage_name`, `item_name`, `target_item_name`, `action`

**`pipeline_attachments`** — Files attached to pipeline records
- `recruit_id` → FK `pipeline.id`, `checklist_item_id`, `uploaded_by`, `file_category`

**`recruits`** — Recruitment records
- `recruiting_agent`, `step`, `date_added`

**`Applicants`** — Job applicants
- `Applicant`, `Phone`, `Email`, `Aspects`, `CareerGoals`, `recruitingAgent`, `MGA`

**`recruiting_objectives`** — Monthly recruiting targets
- `org`, `year`, `month`; Unique: (`org`, `year`, `month`)

### Notification & Communication Tables

**`notifications`** — Notification records
- `user_id` → FK `activeusers.id`, `target_group` → FK `notification_groups.id`
- `title`, `message`, `type`, `link`

**`notification_reads`** — Read status per user per notification
- `notification_id` → FK `notifications.id`, `user_id` → FK `activeusers.id`
- Unique: (`notification_id`, `user_id`)

**`notification_groups`** — Named notification target groups
- `name` (unique), `description`

**`scheduled_notifications`** — Future-scheduled notifications
- `user_id`, `scheduled_for`, `is_sent`, `is_paused`, `target_group`

**`push_subscriptions`** — Web push endpoints
- `user_id`, `endpoint_hash` (unique), `subscription` (JSON)

**`email_batches`** — Email sending batches
- `source` (e.g., 'daily_reminder', 'weekly_report'), `subject`
- `total_count`, `sent_count`, `failed_count`, `started_at`, `completed_at`

**`email_log`** — Individual email records
- `batch_id` → FK `email_batches.id`, `recipient_email`, `recipient_name`
- `subject`, `source`, `status` (sent/failed), `error_message`, `sent_at`

**`email_preferences`** — User email opt-out settings
- `user_id`, `preference_type` (daily_reminder/weekly_report), `enabled` (tinyint)
- Unique: (`user_id`, `preference_type`)

**`email_campaigns`** — Marketing email campaigns
- `template_id` → FK `email_templates.id`, `created_by` → FK `activeusers.id`
- `name`, `subject`, `body`, `recipient_filter` (JSON), `status`, `scheduled_at`

**`email_templates`** / **`email_variables`** / **`email_recipients`** — Campaign support tables

### SMS & Text Campaign Tables

**`sms_balances`** — User SMS credit balances
- `user_id` → FK `activeusers.id`, `credits`

**`sms_credit_transactions`** — Credit purchase/usage history
- `user_id` → FK `activeusers.id`, `transaction_type`, `amount`, `created_at`

**`sms_messages`** — Individual SMS records
- `user_id` → FK `activeusers.id`, `pipeline_id`, `created_at`

**`sms_templates`** — Reusable SMS templates
- `user_id` → FK `activeusers.id`, `category`, `is_shared`

**`sms_auto_reload_settings`** — Auto-reload config per user
- `user_id` → FK `activeusers.id`, `enabled`; Unique: `user_id`

**`text_campaigns`** — Bulk SMS campaigns
- `created_by`, `status`

**`text_campaign_contacts`** — Campaign recipients
- `campaign_id` → FK `text_campaigns.id`, `phone_normalized`, `campaign_status`

**`text_campaign_messages`** — Sent/received messages
- `campaign_id` → FK `text_campaigns.id`, `contact_id` → FK `text_campaign_contacts.id`
- `direction`, `phone_number`

**`text_campaign_follow_ups`** — Automated follow-up steps
- `campaign_id`, `step_number`; Unique: (`campaign_id`, `step_number`)

**`text_campaign_dnc`** — Do-not-contact list
- `phone_normalized` (unique), `opted_out_at`

### Verification & Compliance Tables

**`verify`** / **`verify_client`** — Application verification records
**`verify_messages`** — Verification SMS/email messages
- `application_id`, `phone_number`, `message_type`

**`verify_email_logs`** — Verification email tracking

**`refvalidation`** — Referral validation
- `agent_id` → FK `activeusers.id`, `uuid` (unique)

**`refs`** — Referral records
- `assigned_to` → FK `activeusers.id`, `created_by` → FK `activeusers.id`

### MORE (Recruiting Activity) Tables

**`MORE`** — Weekly recruiting activity by MGA (imported report)
- Sets/Shows for External, Internal, Personal categories
- Finals, Group Invites, Hires (PR and Non-PR)

**`AMORE`** / **`amore_data`** — Editable recruiting activity (agent-entered)
- Same structure as MORE, plus `on_time`, `bot_enter`, `userRole`
- `amore_data` is the current active table; `AMORE` is legacy

**`MORE_Goals`** — Recruiting activity goals
- `MGA`, `period_start`, `period_end`, `goal_type`, `target_value`, `actual_value`

**`MORE_Reports`** — Report type definitions

### Discord Integration Tables

**`discord_leaderboards`** — Scheduled leaderboard posts
- `manager_id` → FK `activeusers.id`, `guild_id`, `channel_id`
- `leaderboard_type`, `metric_type`, `cron_expr`, `data_period`, `scope`

**`discord_reminders`** — Scheduled Discord reminders
- `guild_id`, `channel_id`, `cron_expr`, `message`, `manager_id`

**`discord_motivation_calls`** — Scheduled voice channel motivation calls
- `manager_id` → FK `activeusers.id`, `guild_id`, `voice_channel_id`
- `youtube_playlist_url`, `cron_expr`, `volume`

**`guild_configs`** — Discord server configuration
- Unique: (`manager_id`, `guild_id`)

### Activity Feed & Social Tables

**`activity_feed_reactions`** — Reactions on feed events
- `event_id` (varchar), `user_id`, `reaction`
- Unique: (`event_id`, `user_id`, `reaction`)

### Calendar Tables

**`calendar_events`** — Calendar events
- `user_id` → FK `activeusers.id`, `title`, `start_time`, `end_time`
- `event_type` (personal/team/meeting/deadline/reminder/other)
- `visibility` (private/team/organization), `source` (manual/calendly/google/outlook/ical/system)
- `external_id`, `deleted_at` (soft delete)

**`calendar_ical_subscriptions`** — iCal feed subscriptions
- `user_id`, `url`, `label`, `color`, `visibility` (private/organization)

### Lead & Allotment Tables

**`allotment_settings`** — Monthly lead allotment configuration
- `target_month` (unique), `ref_months`, `alp_months`, `group_ref_requirements` (JSON)

**`allotment_issued`** — Leads issued to agents
- `agent_id` → FK `activeusers.id`, `drop_date_id`, `lead_type` (POS/HC/VN/Dcard)
- Unique: (`agent_id`, `drop_date_id`, `lead_type`)

**`allotment_overrides`** — Agent-level allotment overrides
- `agent_id` → FK `activeusers.id`, `target_month`, `override_type`

**`custom_allotment_groups`** / **`custom_allotment_group_members`** — Custom lead groups

**`lead_drop_dates`** — Scheduled lead drop dates
- `drop_date`, `allotment_month`, `is_active`, `created_by` → FK `activeusers.id`

**`leads`** / **`leads_released`** / **`lead_history`** — Lead management

### Training & Roleplay Tables

**`roleplay_sessions`** — AI roleplay training sessions
- `user_id`, `script_id`, `created_at`

**`roleplay_messages`** — Messages within roleplay sessions
- `session_id`, `created_at`

**`roleplay_scripts`** — Roleplay scenario definitions
- `created_by` → FK `users.id`

**`roleplay_analytics`** — Session performance analytics
- `session_id` → FK `roleplay_sessions.id`, `user_id` → FK `users.id`

**`checklist_progress`** — Pre-release checklist for agents
- `user_id` → FK `activeusers.id`; 50+ boolean/int progress fields

**`JA_Release`** — Junior Agent release tracking
- `user_id` → FK `activeusers.id` (unique), `passed` (y/n), `release_scheduled`

**`TrainingProgress`** — External training platform progress
- `Email` (unique), `ProductProgress`, `Logins`, `MGA`

### App Management Tables

**`app_updates`** — Release notes / app updates
- `type` (update/feature/bugfix), `priority`, `releaseId` → FK `app_releases.id`
- `authorId` → FK `activeusers.id`

**`app_feedback`** — Bug reports and feature requests
- `type` (bug/feature), `status`, `authorId` → FK `activeusers.id`

**`competitions`** — Team competitions
- `metric_type` (alp/calls/appointments/sales/codes/hires/refs/custom)
- `competition_type` (individual/team/group), `status`, `created_by` → FK `activeusers.id`

**`presentations`** / **`presentation_slides`** — Presentation builder

**`resources`** — Shared file resources

**`onedrive_reports`** / **`report_versions`** / **`report_access_logs`** — Report management
- `category_id` → FK `file_categories.id`

### Misc / Utility Tables

**`user_navigation_history`** — Page visit tracking per user
**`user_search_history`** — Search query history
**`agent_search_history`** / **`agent_search_summary`** — Agent profile view tracking
**`date_overrides`** — Custom month start/end date overrides
**`licensed_states`** — Agent licensed states
**`signatures`** — Document signatures per user
**`team_custom`** — Team customization settings (colors, branding)
**`layout_config`** — User-specific table column layout preferences
**`process_runs`** — Background process execution tracking
**`wall_of_records`** — Achievement records display
**`weekly_report_runs`** / **`weekly_report_recipients`** — Weekly report tracking
**`password_reset_tokens`** / **`reset_codes`** — Password reset
**`pending` / `pending_commit`** — Pending agent actions

### Key Foreign Key Relationships

`activeusers.id` is the central FK target — referenced by 40+ tables including:
`discord_sales`, `commits`, `production_goals`, `Daily_Activity` (via userId), `notifications`, `login_logs`, `pipeline_checklist_items`, `email_campaigns`, `sms_*`, `competitions`, `refs`, `refvalidation`, `allotment_*`, `user_agencies`, and more.

Other important FK chains:
- `email_log.batch_id` → `email_batches.id`
- `email_campaigns.template_id` → `email_templates.id`
- `email_recipients.campaign_id` → `email_campaigns.id`
- `pipeline_checklist_progress.recruit_id` → `pipeline.id`
- `pipeline_checklist_progress.checklist_item_id` → `pipeline_checklist_items.id`
- `text_campaign_contacts.campaign_id` → `text_campaigns.id`
- `text_campaign_messages.contact_id` → `text_campaign_contacts.id`
- `notification_reads.notification_id` → `notifications.id`
- `presentation_slides.presentation_id` → `presentations.id`
- `sga_alternative_names.sga_id` → `sgas.id`
- `user_agencies.sga_id` → `sgas.id`

---

## Authentication

### Middleware
- **`verifyToken`** — Main auth middleware. Checks Bearer header, `auth_token` cookie, or `x-access-token` header. Sets `req.userId`.
- **`verifyAdmin`** — Checks Role='Admin'/'SuperAdmin' or teamRole='app'
- **`verifyStaff`** — Admin or clname in SA/GA/MGA/RGA/SGA
- **`authMiddleware`** — Alias used in some route files (same as verifyToken)

### Roles
- **User roles by `clname`:** AGT (Agent), SA, GA, MGA, RGA, SGA
- **Admin:** `Role` = 'Admin'/'SuperAdmin' or `teamRole` = 'app'
- **Impersonation:** Supported via `X-Impersonated-User-Id` header

---

## API Patterns

### Response Format
```json
{ "success": true, "message": "...", "data": { ... } }
```

### Route Mounting
All routes at `/api/*`:
- `/api/auth/*` — Login, register, password reset
- `/api/users/*` — User management
- `/api/admin/*` — Admin functions
- `/api/dailyActivity/*` — Daily activity CRUD
- `/api/discord/*` — Discord/sales integration
- `/api/notifications/*` — Notifications + push + email preferences
- `/api/activity-feed/*` — Activity feed events
- `/api/verify/*` — Verification/compliance
- `/api/recruitment/*` — Pipeline/hiring
- `/api/upload/imgur` — Image upload proxy
- `/api/email-campaigns/*` — Email marketing
- `/api/text-campaigns/*` — SMS campaigns

### Express Route Ordering Gotcha
Literal routes MUST come before parameterized routes. Example:
```js
router.get('/stats', handler);      // This MUST come first
router.get('/:id', handler);        // This catches everything otherwise
```

---

## Real-Time (WebSocket)

### Notification WebSocket (`/ws/notifications`)
```js
// Auth: { type: 'auth', token: 'jwt...' }
// Server broadcasts: { type: 'notification', notification: {...} }
// Sale events: { type: 'new_close', event: {...} }
```

### Key Global
```js
global.notificationManager  // NotificationManager instance
  .broadcastAll(data)        // Send to all connected users
  .sendToUser(userId, data)  // Send to specific user
```

### Frontend Handling
- `NotificationContext.js` — Listens for WebSocket events
- `window.showInPageNotification()` — Shows toast notifications
- `new_close` events trigger toast + sale sound + feed update

---

## Key Services & Utilities

### Backend
| Service | File | Purpose |
|---------|------|---------|
| Email | `services/emailService.js` | SMTP via Nodemailer, batch tracking |
| SMS | `services/twilio.js` | Twilio SMS/MMS |
| Image Upload | `routes/upload.js` | Imgur proxy (multer, 10MB limit) |
| Daily Activity Sync | `routes/discord.js` → `updateDailyActivityFromDiscordSales()` | Syncs discord_sales to Daily_Activity |
| Weekly Reports | `services/weeklyReportEmailService.js` | Weekly production email |
| Daily Reminders | `schedulers/dailyActivityReminderScheduler.js` | Daily activity reminder email |

### Frontend
| Utility | File | Purpose |
|---------|------|---------|
| API Client | `api.js` | Axios with auth interceptors |
| Imgur Upload | `utils/imgurUploader.js` | `uploadImageToImgur(file)` |
| Date Utils | `utils/dateUtils.js` | Date formatting/navigation |
| Export | `utils/exportUtils.js` | Excel/CSV export |
| Theme | `utils/themeManager.js` | Dark/light mode |

### React Contexts
| Context | Purpose |
|---------|---------|
| `AuthContext` | User auth state, login/logout, role checks |
| `NotificationContext` | WebSocket connection, notification state, toast |
| `ThemeContext` | Dark/light mode |
| `TeamStyleContext` | Team branding/colors |
| `AgencyContext` | Multi-agency support |
| `HeaderContext` | Header state management |

---

## Coding Conventions

### General
- **No over-engineering** — Keep changes minimal and focused
- **Match existing patterns** — Look at surrounding code before writing
- **Vanilla CSS** — No CSS frameworks; use CSS variables for theming
- **CSS variables** — `--card-bg`, `--text-primary`, `--text-secondary`, `--border-color`, `--bg-secondary`
- **Icons** — Use `react-icons/fi` (Feather Icons) as primary icon set
- **No unnecessary comments/docstrings** — Only add where logic isn't obvious

### Backend
- Use `verifyToken` middleware on all authenticated routes
- Return `{ success: true/false, ... }` response format
- Use parameterized queries (`?` placeholders) — never string interpolation for SQL
- Timestamps in Eastern: `new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })`
- DB queries: prefer `db.query()` with promise wrapper

### Frontend
- Functional components with hooks (no class components)
- State management via React Context (no Redux)
- API calls via `api.get/post/put/delete()` from `api.js`
- CSS files co-located with components (ComponentName.css)
- Mobile-first responsive design with `@media` queries

---

## Environment Variables

### Required
- `DB_HOST`, `DB_USER`, `DB_PASS`, `DB_NAME` — MySQL
- `JWT_SECRET` — Token signing
- `FRONTEND_URL` — CORS origin (default: https://agents.ariaslife.com)

### Services
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD` — Email
- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER` — SMS
- `STRIPE_SECRET_KEY` — Payments
- `OPENAI_API_KEY` — AI chat
- `DEEPGRAM_API_KEY` — Speech-to-text
- `ELEVENLABS_API_KEY` — Text-to-speech
- `DISCORD_TOKEN`, `DISCORD_BOT_ID` — Discord bot
- `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` — Web push

### Feature Flags
- `DISABLE_SCHEDULERS=true` — Disable all cron jobs
- `NODE_ENV=production` — Enables schedulers, disables dev shortcuts

---

## Common Gotchas

1. **`screen_name` not `screenName`** — DB column is snake_case; JS property access must match
2. **`Active` is a string** — Uses `'y'`/`'n'`, not boolean true/false
3. **Route ordering matters** — `/stats` must be defined before `/:id` in Express
4. **Eastern time everywhere** — All dates/timestamps use America/New_York timezone
5. **`lagnname` is not a typo** — It's the legacy column name for agent full name
6. **Onboarding users are different** — They use the `pipeline` table, not `activeusers`, and have a separate auth flow
7. **`clname` determines hierarchy** — AGT < SA < GA < MGA < RGA < SGA (agent levels)
8. **Admin check variations** — Check both `Role` field AND `teamRole === 'app'`
9. **Mixed case in DB** — Some columns are camelCase (`userId`, `reportDate`), others snake_case (`screen_name`, `lead_type`). Match what exists.
10. **Image uploads go through Imgur** — Frontend uploads via `uploadImageToImgur()` → backend proxy → Imgur API
