# White Screen / Syntax Error Fix

## Problem
Users sometimes see a white screen with the error:
```
Uncaught SyntaxError: Unexpected token '<'
```

This error appears in a JavaScript file like `main.061ad268.js:1`

## Root Cause
The browser is trying to load a JavaScript file but receiving HTML instead. This happens when:

1. **Stale Cache** - Browser cached old HTML that references JS bundles that no longer exist
2. **Deployment Mismatch** - New deployment updated JS files but user has cached old HTML
3. **404 Returns HTML** - JavaScript file doesn't exist, server returns HTML error page
4. **CDN/Proxy Issues** - Intermediary caching serving wrong content

## Solutions Implemented

### 1. Automatic Recovery (frontend/public/index.html)
Added JavaScript that detects chunk loading errors and automatically:
- Clears all caches
- Reloads the page once
- If problem persists, shows user-friendly error with instructions

### 2. Cache Control Headers (frontend/server.js)
Updated server to send proper cache headers:
- **HTML files**: `no-cache` (always get fresh version)
- **Hashed JS/CSS**: `max-age=31536000, immutable` (cache forever, they're versioned)
- **Other assets**: `max-age=86400` (1 day)

### 3. Meta Tags (frontend/public/index.html)
Added cache control meta tags:
```html
<meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate" />
<meta http-equiv="Pragma" content="no-cache" />
<meta http-equiv="Expires" content="0" />
```

## How It Works

### Automatic Recovery Flow
1. User visits site, gets syntax error
2. JavaScript error handler detects it's a chunk loading error
3. Script clears all caches and reloads (once)
4. If error persists, shows user-friendly error message with manual fix instructions

### Cache Strategy
- **HTML**: Never cached → users always get latest HTML with correct JS references
- **Versioned assets**: Cached forever → fast loading, no unnecessary requests
- **This prevents**: Old HTML pointing to non-existent JS files

## User Instructions (if needed)

If users still see the error, tell them to:

### Option 1: Hard Refresh
- **Windows**: `Ctrl + Shift + R`
- **Mac**: `Cmd + Shift + R`

### Option 2: Clear Cache
1. Open browser settings
2. Go to "Privacy & Security"
3. Click "Clear browsing data"
4. Select "Cached images and files"
5. Click "Clear data"

### Option 3: Incognito/Private Window
- Try opening the site in an incognito/private window
- If it works there, the issue is cached data in normal browser

## Deployment Best Practices

To minimize this issue:

### 1. Deploy Process
```bash
# Build the app
npm run build

# Deploy BOTH the HTML and static assets together
# Never deploy HTML before assets are ready
```

### 2. Use a CDN with proper invalidation
If using a CDN (like Cloudflare):
- Set HTML files to `no-cache`
- Purge cache after deployments
- Use versioned asset URLs (Create React App does this by default)

### 3. Rolling Deployments
For zero-downtime deployments:
1. Deploy new assets first
2. Wait for them to be available
3. Then update the HTML

## Testing

### Test the fix works:
1. Deploy a new version
2. Open site in browser
3. Deploy another version (change something)
4. Refresh the page
5. Should load new version without errors

### Test auto-recovery:
1. Open DevTools console
2. Simulate chunk error: `throw new Error('Unexpected token <')`
3. Should see automatic reload attempt
4. Check sessionStorage for 'chunk-error-reload'

## Monitoring

Watch for these in logs/analytics:
- Frequency of chunk loading errors
- User agent patterns (specific browsers?)
- Time patterns (after deployments?)
- Geographic patterns (CDN issues?)

## Additional Notes

### Why not use Service Workers?
- Service workers can make caching issues worse
- We're intentionally NOT using them for HTML
- The cleanup script in index.html removes old OneSignal service workers

### Why hash-based filenames help
Create React App automatically generates filenames like:
- `main.061ad268.js` ← hash changes when content changes
- This means old HTML never references files that don't exist
- Cache forever strategy works because files are immutable

### Future Enhancements
- Add Sentry or similar to track these errors
- Add version checking (compare deployed version vs loaded version)
- Add "New version available" notification instead of hard reload

