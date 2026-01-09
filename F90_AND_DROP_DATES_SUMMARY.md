# F90 Tab and Lead Drop Dates - Implementation Summary

## Overview
Implemented a new **F90 Tab** for tracking agents in their first 90 days and a **Lead Drop Dates Management System** for admins to configure when leads are distributed.

---

## 🎯 F90 Tab Features

### What It Does
- **Displays agents in their first 90 days** based on their ESID (employee start date)
- Calculates days since start automatically
- Filters out excluded agents
- Uses the same column structure as other allotment groups

### How It Works
1. **Date Calculation**: Parses ESID from `activeusers` table (supports both `YYYY-MM-DD` and `MM/DD/YYYY` formats)
2. **90-Day Filter**: Shows only agents where `0 <= days_since_start <= 90`
3. **Dynamic Count**: Tab badge shows real-time count of F90 agents
4. **Color-Coded**: Green theme (#10b981) to distinguish from other tabs

### UI Components
- **Tab Badge**: Shows "F90" with agent count
- **Header Badge**: "Agents in Days 1-90 based on ESID" info badge
- **Table**: Full allotment columns including:
  - MGA, Agent, Group placement
  - ALP, VIPs, Referrals
  - Retention, Lead preferences
  - System status and overrides

### Access
- **All Users**: Can view F90 tab
- **Admins**: Can manage overrides for F90 agents

---

## 📅 Lead Drop Dates Management System

### Database Schema
**Table**: `lead_drop_dates`
```sql
- id (INT, AUTO_INCREMENT, PRIMARY KEY)
- drop_date (DATE, NOT NULL)
- drop_name (VARCHAR, optional label)
- allotment_month (VARCHAR, YYYY-MM format)
- notes (TEXT, optional)
- is_active (BOOLEAN, default TRUE)
- created_by (INT, FK to activeusers)
- created_at, updated_at (TIMESTAMPS)
```

### Backend API Endpoints
All routes require authentication. Admin-only routes marked with 🔒.

#### 1. **GET /api/pnp/lead-drop-dates**
   - Fetch all active drop dates
   - Optional query param: `?month=YYYY-MM` (filter by allotment month)
   - **Access**: All authenticated users

#### 2. 🔒 **POST /api/pnp/lead-drop-dates**
   - Create new drop date
   - **Required**: `drop_date`, `allotment_month`
   - **Optional**: `drop_name`, `notes`
   - **Access**: Admin only

#### 3. 🔒 **PUT /api/pnp/lead-drop-dates/:id**
   - Update existing drop date
   - Can update any field including `is_active`
   - **Access**: Admin only

#### 4. 🔒 **DELETE /api/pnp/lead-drop-dates/:id**
   - Permanently delete drop date
   - **Access**: Admin only

### Frontend Components

#### LeadDropDatesModal
**Location**: `frontend/src/components/utilities/leads/LeadDropDatesModal.js`

**Features**:
- ✅ View all drop dates in sortable, filterable DataTable
- ✅ Add new drop dates with form validation
- ✅ Delete existing drop dates
- ✅ Filter by allotment month
- ✅ Displays formatted dates with weekday
- ✅ Shows drop name, notes, and actions

**UI Elements**:
- **Modal Header**: "Manage Lead Drop Dates" with close button
- **Add Button**: "+ Add Drop Date" (toggles form)
- **Add Form**:
  - Drop Date (date picker)
  - Drop Name (text, optional)
  - Allotment Month (month picker)
  - Notes (textarea, optional)
- **DataTable**: Sortable columns with inline delete actions

#### Integration in AllotmentTab
**Access Button**: 
- Located next to "⚙️ Settings" button in header
- **Label**: "📅 Drop Dates"
- **Color**: Green theme (#10b981)
- **Visibility**: Admin users only
- **Tooltip**: "Manage lead drop dates"

**State Management**:
```javascript
const [showDropDatesModal, setShowDropDatesModal] = useState(false);
```

---

## 🗂️ Files Created/Modified

### New Files
1. ✅ `backend/migrations/create_lead_drop_dates.sql` - Database schema
2. ✅ `frontend/src/components/utilities/leads/LeadDropDatesModal.js` - Modal component
3. ✅ `frontend/src/components/utilities/leads/LeadDropDatesModal.css` - Modal styles

### Modified Files
1. ✅ `frontend/src/components/utilities/leads/AllotmentTab.js`
   - Added F90 tab and filtering logic
   - Integrated LeadDropDatesModal
   - Added "📅 Drop Dates" button for admins

2. ✅ `backend/routes/pnp.js`
   - Added 4 new API endpoints for lead drop dates

3. ✅ `frontend/src/components/utils/DataTable.js`
   - Enhanced column filtering for comma-separated values
   - Added `filterSplitBy` property support

---

## 🚀 Usage Instructions

### For Admins: Managing Lead Drop Dates
1. **Navigate** to Allotment Tab
2. **Click** "📅 Drop Dates" button (next to Settings)
3. **View** all existing drop dates in the table
4. **Add New Drop Date**:
   - Click "+ Add Drop Date"
   - Select date, enter name (optional)
   - Choose allotment month
   - Add notes if needed
   - Click "Add Drop Date"
5. **Delete Drop Date**:
   - Click "Delete" button in Actions column
   - Confirm deletion

### For All Users: Viewing F90 Agents
1. **Navigate** to Allotment Tab
2. **Click** "F90" tab (green tab next to "6k Reup")
3. **View** all agents in their first 90 days
4. **Filter/Sort** as needed using column filters
5. **Export** data using action bar if needed

### ESID Requirements
- **Format**: YYYY-MM-DD or MM/DD/YYYY
- **Source**: `activeusers.esid` column
- **Calculation**: Automatic from current date

---

## 💡 Future Enhancements (Suggested)

### F90 Specific Features
- [ ] Show "Days Remaining" column (90 - days_since_start)
- [ ] Add "F90 Status" badge (e.g., "Day 15 of 90")
- [ ] Training milestone tracking
- [ ] First drop eligibility indicator

### Drop Dates Features
- [ ] Bulk import drop dates (CSV)
- [ ] Recurring drop schedule templates
- [ ] Calendar view of drop dates
- [ ] Email notifications before drops
- [ ] Link F90 tab to show "Days until next drop"
- [ ] Drop date history/audit log

### Integration
- [ ] Automatic F90 eligibility based on closest drop date
- [ ] Show drop schedule on F90 tab header
- [ ] Alert when F90 agent is approaching day 90

---

## 🧪 Testing Checklist

### F90 Tab
- [x] Tab displays correctly with count
- [x] Filters agents correctly (0-90 days)
- [x] Handles invalid/missing ESID gracefully
- [x] Shows proper columns and data
- [x] Excludes agents with overrides
- [x] Updates count dynamically

### Lead Drop Dates
- [x] Can fetch all drop dates
- [x] Can add new drop date
- [x] Can delete drop date
- [x] Date validation works
- [x] Modal opens/closes correctly
- [x] DataTable sorting/filtering works
- [x] Only admins can access management

### Integration
- [x] Button visible to admins only
- [x] Modal integrates with AllotmentTab
- [x] No console errors
- [x] Responsive design works

---

## 🐛 Known Issues
None currently identified.

---

## 📊 Database Migration Status
✅ **Migration Completed**: `create_lead_drop_dates.sql`
- Table created successfully
- Sample drop dates inserted
- Indexes applied

---

## 📝 Notes
- F90 calculation is client-side for real-time accuracy
- Drop dates are server-side managed for consistency
- All admin actions are logged (created_by FK)
- Drop dates can be soft-deleted (is_active = 0)
- ESID parsing supports multiple date formats for flexibility

