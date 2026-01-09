# AIL Appointments Sync Feature

## 🎯 Overview

This feature allows MGAs, RGAs, and SGAs to automatically sync recruit appointments to the AIL Agent Appointments portal with **live visualization** of the automation process.

## 📦 Installation

### 1. Install Backend Dependencies

```bash
cd backend
npm install puppeteer ws
```

### 2. Restart Backend Server

After installing dependencies, restart your backend server:
```bash
# Stop current server (Ctrl+C)
# Then start again
npm start
```

## 🚀 How to Use

### For MGAs/RGAs/SGAs:

1. **Navigate to Pipeline** (`/recruiting/pipeline`)
2. **Find a recruit** you want to sync
3. **Click the "Sync" button** in the "AIL Sync" column
4. **Enter your AIL credentials** in the modal
5. **Watch the live automation** as it:
   - Logs into AIL portal
   - Navigates to the form
   - Fills in the recruit data
   - Submits the appointment

## 🎬 What You'll See

The modal provides:
- 📺 **Live browser viewport** showing exactly what's happening
- 📊 **Status indicators** (In Progress, Success, Error)
- 📝 **Step-by-step updates** explaining each action
- 🔄 **Real-time screenshots** every 2 seconds

## 🔒 Security

- Credentials are **NEVER stored**
- Used only for the current session
- Transmitted securely over HTTPS
- Session data cleared after 5 minutes

## ⚙️ Configuration

### Adjusting Form Selectors

The AIL form selectors are in `/backend/routes/ail-sync.js`. If AIL changes their form structure, update these lines:

```javascript
// Example: Update field selectors
await page.type('#agentName', recruit.name);
await page.type('#email', recruit.email);
// etc...
```

### Headless Mode

For production, set Puppeteer to headless mode in `/backend/routes/ail-sync.js`:

```javascript
const browser = await puppeteer.launch({
  headless: true, // Change to true for production
  args: ['--no-sandbox']
});
```

## 🐛 Troubleshooting

### "Failed to start sync" error
- Check backend logs for Puppeteer errors
- Ensure Puppeteer is installed: `npm list puppeteer`
- Try reinstalling: `npm install puppeteer --force`

### Login fails
- Verify AIL credentials are correct
- Check if AIL requires 2FA (not currently supported)
- Check backend logs for specific error

### Screenshots not updating
- Check network tab for failed API calls
- Verify backend is running
- Check console for JavaScript errors

## 📋 Current Limitations

1. **Single recruit at a time** - Batch processing not yet implemented
2. **Manual credential entry** - Stored credentials coming in future update
3. **No 2FA support** - AIL two-factor authentication not supported yet
4. **Form structure dependent** - May need updates if AIL changes their forms

## 🔮 Future Enhancements

- [ ] Batch processing for multiple recruits
- [ ] Saved credentials (encrypted)
- [ ] Schedule automated syncs
- [ ] Sync history and logs
- [ ] Error retry logic
- [ ] 2FA support

## 📞 Support

If you encounter issues, check:
1. Backend console logs
2. Browser console (F12)
3. Network tab for failed requests

Contact development team if issues persist.

