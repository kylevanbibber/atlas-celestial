# Progressive Loading Debug Guide

## 🔍 Troubleshooting Progressive Loading

If licenses and PNP data are not loading, follow these steps:

---

## Step 1: Check Browser Console

Open your browser console (F12) and look for these logs:

### **Expected Logs (Working):**

```javascript
⏱️ [FRONTEND] Progressive Loading Started at 2:45:32 PM

🚀 [FRONTEND Stage 1/3] Fetching hierarchy structure for DOE JOHN...
✅ [FRONTEND Stage 1/3] Response received after 145ms
   ⏱️  Backend processing: 102ms
   ⏱️  Network latency: 43ms
   ⏱️  Total elapsed: 145ms
🎨 [FRONTEND Stage 1/3] UI rendering triggered after 2ms
   👥 45 team members ready to display
   🔍 Hierarchy structure: { totalUsers: 45, allIds: [...], sampleUser: {...} }
   ⏱️  Time to interactive: 147ms

🚀 [FRONTEND Stage 2/3] Fetching licenses for 46 users...
   📤 Request payload: { userIds: [92, 123, 456, ...] }
✅ [FRONTEND Stage 2/3] Response received after 225ms
   📥 License response received: { success: true, data: {...} }
   ⏱️  Backend processing: 187ms
   ⏱️  Network latency: 38ms
   ⏱️  Total elapsed since start: 372ms
🎨 [FRONTEND Stage 2/3] UI updated with licenses after 3ms
   📜 42 users have license data

🚀 [FRONTEND Stage 3/3] Fetching PNP data for 46 users...
   📤 Request payload: { users: [{id: 92, lagnname: "...", esid: "..."}] }
✅ [FRONTEND Stage 3/3] Response received after 458ms
   📥 PNP response received: { success: true, data: {...} }
   ⏱️  Backend processing: 421ms
   ⏱️  Network latency: 37ms
   ⏱️  Total elapsed since start: 833ms
🎨 [FRONTEND Stage 3/3] UI updated with PNP data after 2ms
   📊 38 users have PNP data
   💾 Complete hierarchy cached

🎉 [FRONTEND] Progressive Loading Complete!
```

---

## Step 2: Common Issues & Solutions

### **Issue 1: Stage 2 Never Starts**

**Symptoms:**
```javascript
✅ [FRONTEND Stage 1/3] Response received after 145ms
// ... no Stage 2 logs
```

**Causes:**
1. `hierarchyInfo.allIds` is empty
2. JavaScript error in Stage 2 code
3. API route not mounted

**Solution:**
```javascript
// Check if allIds is populated
console.log('allIds:', hierarchyInfo.allIds);
// Should show: [92, 123, 456, ...]

// If empty, check Stage 1 response
console.log('Stage 1 response:', resp.data);
```

---

### **Issue 2: Stage 2 Fails with Error**

**Symptoms:**
```javascript
🚀 [FRONTEND Stage 2/3] Fetching licenses for 46 users...
❌ License fetch failed: Error: Request failed with status code 404
   Error details: { message: "...", response: {...}, status: 404 }
```

**Causes:**
1. Route `/auth/hierarchy/licenses` not found (404)
2. Route not properly mounted in backend
3. Authentication issue

**Solutions:**

**Check if route is mounted:**
```javascript
// In backend/app.js, verify:
const authRoutes = require("./routes/auth");
app.use("/api/auth", authRoutes);
```

**Test the endpoint directly:**
```bash
curl -X POST http://localhost:3001/api/auth/hierarchy/licenses \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"userIds": [92, 123]}'
```

---

### **Issue 3: Stage 2 Returns Empty Data**

**Symptoms:**
```javascript
✅ [FRONTEND Stage 2/3] Response received after 225ms
   📥 License response received: { success: true, data: {} }
⚠️ License fetch unsuccessful, using data without licenses
   Response: { success: true, data: {} }
```

**Causes:**
1. No licenses in database for these users
2. Query filtering out all results
3. Wrong userId format

**Solutions:**

**Check database:**
```sql
SELECT * FROM licensed_states WHERE userId IN (92, 123, 456) LIMIT 10;
```

**Check backend logs:**
```javascript
// Should see:
🚀 [Stage 2: Licenses] Starting license fetch for 46 users
   ⏱️  Querying licenses for 46 users...
   ⏱️  License query complete: 187ms
✅ [Stage 2: Licenses] Complete - 187ms total
   📊 Returned licenses for 42 users
```

---

### **Issue 4: Data Loads But Doesn't Display**

**Symptoms:**
- Console shows all 3 stages complete
- UI doesn't show licenses or PNP data

**Causes:**
1. Component not using `loadingStages` correctly
2. Data structure mismatch
3. Component not re-rendering

**Solutions:**

**Check component code:**
```javascript
// ❌ Wrong - doesn't check loading state
{user.licenses?.map(l => <span>{l.state}</span>)}

// ✅ Correct - checks loading state
{loadingStages.licenses ? (
  <LicenseSkeleton />
) : user.licenses?.length > 0 ? (
  user.licenses.map(l => <span key={l.id}>{l.state}</span>)
) : (
  <span>No licenses</span>
)}
```

**Check data structure:**
```javascript
// Log the user object after Stage 2
useEffect(() => {
  if (!loadingStages.licenses && hierarchyData?.raw?.[0]) {
    console.log('First user after licenses loaded:', hierarchyData.raw[0]);
    console.log('Has licenses?', hierarchyData.raw[0].licenses);
  }
}, [loadingStages.licenses, hierarchyData]);
```

---

### **Issue 5: Stages Never Complete (Stuck Loading)**

**Symptoms:**
```javascript
🚀 [FRONTEND Stage 2/3] Fetching licenses for 46 users...
// ... never gets to "Response received"
```

**Causes:**
1. API request timeout
2. Backend hanging/crashed
3. Network issue
4. Infinite await without resolution

**Solutions:**

**Check Network tab:**
- Open DevTools → Network
- Look for `/auth/hierarchy/licenses` request
- Check status (pending, 500, timeout)

**Check backend is running:**
```bash
# Should show server running
netstat -ano | findstr :3001
```

**Add timeout to request:**
```javascript
api.post('/auth/hierarchy/licenses', { userIds }, { timeout: 10000 })
  .then(...)
  .catch(error => {
    if (error.code === 'ECONNABORTED') {
      console.error('Request timeout - backend may be overloaded');
    }
  });
```

---

## Step 3: Debug Commands

### **Check Current State:**

```javascript
// In browser console
window.__USER_HIERARCHY_DEBUG__.logCacheStatus()
```

### **Force Refresh:**

```javascript
// Clear cache and reload
window.__USER_HIERARCHY_DEBUG__.clearCache()
location.reload()
```

### **Check Loading Stages:**

```javascript
// Add to your component
useEffect(() => {
  console.log('Current loading stages:', loadingStages);
}, [loadingStages]);
```

### **Check Hierarchy Data:**

```javascript
// Add to your component
useEffect(() => {
  console.log('Current hierarchy data:', hierarchyData);
}, [hierarchyData]);
```

---

## Step 4: Verify Backend Routes

### **Check auth.js routes are exported:**

```javascript
// At the end of backend/routes/auth.js
module.exports = router;
```

### **Check routes are mounted:**

```javascript
// In backend/app.js
const authRoutes = require("./routes/auth");
app.use("/api/auth", authRoutes);  // ← This must be present
```

### **Test routes manually:**

**Stage 1 (Structure):**
```bash
curl -X POST http://localhost:3001/api/auth/searchByUserId \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"userId": 92}'
```

**Stage 2 (Licenses):**
```bash
curl -X POST http://localhost:3001/api/auth/hierarchy/licenses \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"userIds": [92]}'
```

**Stage 3 (PNP):**
```bash
curl -X POST http://localhost:3001/api/auth/hierarchy/pnp \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"users": [{"id": 92, "lagnname": "DOE JOHN", "esid": "2020-01-01"}]}'
```

---

## Step 5: Check Database

### **Verify licenses exist:**

```sql
SELECT COUNT(*) FROM licensed_states;
-- Should return > 0

SELECT userId, COUNT(*) as license_count 
FROM licensed_states 
GROUP BY userId 
LIMIT 10;
-- Should show users with licenses
```

### **Verify PNP data exists:**

```sql
SELECT COUNT(*) FROM pnp;
-- Should return > 0

SELECT name_line, esid, date, curr_mo_4mo_rate 
FROM pnp 
LIMIT 10;
-- Should show PNP records
```

### **Check indexes are created:**

```sql
SHOW INDEXES FROM licensed_states WHERE Key_name = 'idx_licensed_states_userId';
SHOW INDEXES FROM pnp WHERE Key_name = 'idx_pnp_name_date';
```

---

## Step 6: Emergency Rollback

If progressive loading is causing issues and you need to revert:

### **Option 1: Use old endpoint temporarily**

```javascript
// In useUserHierarchy.js, comment out progressive loading
// and use old endpoint:

const resp = await api.post('/auth/searchByUserId', { userId: user.userId });
const hierarchy = resp.data?.success ? resp.data.data : [];

const hierarchyInfo = {
  raw: hierarchy,
  // ... rest of structure
  licensesLoaded: true,  // ← Mark as loaded
  pnpLoaded: true        // ← Mark as loaded
};

setHierarchyData(hierarchyInfo);
setLoadingStages({ structure: false, licenses: false, pnp: false });
return hierarchyInfo;
```

### **Option 2: Disable progressive loading flag**

```javascript
// Add a flag to disable progressive loading
const USE_PROGRESSIVE_LOADING = false;

if (!USE_PROGRESSIVE_LOADING) {
  // Use old synchronous loading...
}
```

---

## Common Error Messages & Solutions

### **"Cannot read property 'map' of undefined"**

**Cause:** `hierarchyData.raw` is undefined

**Solution:**
```javascript
// Always use optional chaining
{hierarchyData?.raw?.map(user => ...)}
```

### **"Request failed with status code 401"**

**Cause:** Authentication token expired or invalid

**Solution:**
```javascript
// Logout and login again
window.__AUTH__.logout()
```

### **"Network Error"**

**Cause:** Backend not running or wrong URL

**Solution:**
```bash
# Check backend is running
cd backend
npm start

# Check .env has correct API URL
REACT_APP_API_URL=http://localhost:3001/api
```

---

## Success Criteria

You know it's working when you see:

✅ All 3 stages complete in console  
✅ Loading indicators appear and disappear  
✅ Licenses appear after ~400ms  
✅ PNP data appears after ~800ms  
✅ No errors in console  
✅ Backend logs show all 3 stages  

---

## Still Not Working?

1. **Share your console logs** - Copy the entire progressive loading sequence
2. **Share backend logs** - Copy the Stage 1, 2, 3 logs from Node.js
3. **Check Network tab** - Screenshot the `/auth/hierarchy/licenses` request
4. **Share component code** - Show how you're using `useUserHierarchy`

---

**Created:** December 2024  
**Purpose:** Debug progressive loading issues  
**Updated:** After each troubleshooting session

