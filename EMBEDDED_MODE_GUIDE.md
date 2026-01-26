# Embedded Mode Guide

This guide explains how to embed individual pages from your React app into external applications (like PHP apps).

## Overview

The embedded mode allows you to display specific pages (like Scorecard) without the header, sidebar, or other navigation elements. This is perfect for:
- Embedding in iframes within other applications
- Opening in popup windows
- Integrating specific features into external systems

## How It Works

When you add `?embedded=true` or `?standalone=true` to any URL, the app will:
1. Hide the header and navigation
2. Remove extra padding/margins
3. Display only the page content
4. Still maintain full functionality and authentication

## URL Format

```
https://your-domain.com/[page]?embedded=true&mode=[iframe|popup]
```

### Parameters

- **`embedded=true`** or **`standalone=true`** (required) - Enables embedded mode
- **`mode=iframe`** or **`mode=popup`** (optional) - Styling mode (default: iframe)

## Example URLs

### Scorecard Page
```
http://localhost:3000/production?section=scorecard&embedded=true
```

### Production Overview
```
http://localhost:3000/production?embedded=true
```

### Dashboard
```
http://localhost:3000/dashboard?embedded=true
```

### Recruiting Pipeline
```
http://localhost:3000/recruiting?section=pipeline&embedded=true
```

### With Popup Mode
```
http://localhost:3000/production?section=scorecard&embedded=true&mode=popup
```

## Integration Examples

### 1. iFrame Embedding (Recommended)

```html
<!DOCTYPE html>
<html>
<head>
    <title>My PHP App - Scorecard</title>
    <style>
        .embedded-container {
            width: 100%;
            height: 800px;
            border: none;
            overflow: hidden;
        }
    </style>
</head>
<body>
    <h1>Agent Scorecard</h1>
    
    <!-- Embed the React app scorecard -->
    <iframe 
        src="http://localhost:3000/production?section=scorecard&embedded=true" 
        class="embedded-container"
        frameborder="0"
        allowfullscreen
    ></iframe>
</body>
</html>
```

### 2. Popup Window

```html
<!DOCTYPE html>
<html>
<head>
    <title>My PHP App</title>
    <script>
        function openScorecard() {
            const url = 'http://localhost:3000/production?section=scorecard&embedded=true&mode=popup';
            const windowName = 'Scorecard';
            const windowFeatures = 'width=1200,height=800,menubar=no,toolbar=no,location=no,status=no';
            
            window.open(url, windowName, windowFeatures);
        }
    </script>
</head>
<body>
    <h1>My App</h1>
    <button onclick="openScorecard()">View Scorecard</button>
</body>
</html>
```

### 3. PHP Integration with Session Sharing

```php
<?php
session_start();

// Get the authentication token from your PHP session
$reactAuthToken = $_SESSION['react_auth_token'];
$reactAppUrl = 'http://localhost:3000';

// Build the embedded URL
$embeddedUrl = $reactAppUrl . '/production?section=scorecard&embedded=true';
?>

<!DOCTYPE html>
<html>
<head>
    <title>Dashboard - Scorecard</title>
    <style>
        iframe {
            width: 100%;
            height: 900px;
            border: 1px solid #ddd;
            border-radius: 8px;
        }
    </style>
</head>
<body>
    <h2>Agent Performance Scorecard</h2>
    
    <iframe 
        src="<?php echo htmlspecialchars($embeddedUrl); ?>" 
        id="scorecard-frame"
    ></iframe>
    
    <script>
        // Optional: Send authentication token to iframe if needed
        window.addEventListener('message', function(event) {
            if (event.origin === '<?php echo $reactAppUrl; ?>') {
                // Handle messages from the React app
                console.log('Message from React app:', event.data);
            }
        });
    </script>
</body>
</html>
```

### 4. Dynamic Page Loading

```php
<?php
// Map of available pages
$availablePages = [
    'scorecard' => '/production?section=scorecard',
    'dashboard' => '/dashboard',
    'production' => '/production',
    'recruiting' => '/recruiting',
    'reports' => '/production?section=reports'
];

// Get page from URL parameter
$page = $_GET['page'] ?? 'scorecard';
$pageUrl = $availablePages[$page] ?? $availablePages['scorecard'];

// Build embedded URL
$embeddedUrl = 'http://localhost:3000' . $pageUrl . '&embedded=true';
?>

<!DOCTYPE html>
<html>
<head>
    <title>Atlas Dashboard</title>
    <style>
        body { margin: 0; padding: 20px; font-family: Arial, sans-serif; }
        .nav { margin-bottom: 20px; }
        .nav a { margin-right: 15px; padding: 10px 15px; background: #007bff; color: white; text-decoration: none; border-radius: 4px; }
        .nav a:hover { background: #0056b3; }
        iframe { width: 100%; height: calc(100vh - 100px); border: 1px solid #ddd; }
    </style>
</head>
<body>
    <div class="nav">
        <a href="?page=dashboard">Dashboard</a>
        <a href="?page=scorecard">Scorecard</a>
        <a href="?page=production">Production</a>
        <a href="?page=recruiting">Recruiting</a>
        <a href="?page=reports">Reports</a>
    </div>
    
    <iframe src="<?php echo htmlspecialchars($embeddedUrl); ?>"></iframe>
</body>
</html>
```

## Authentication

### Option 1: Shared Session (Recommended)
If both apps are on the same domain, they can share cookies/sessions naturally.

### Option 2: Token in URL
```
http://localhost:3000/production?section=scorecard&embedded=true&token=YOUR_JWT_TOKEN
```

Then in your React app, check for the token parameter and authenticate:
```javascript
const searchParams = new URLSearchParams(window.location.search);
const token = searchParams.get('token');
if (token) {
  // Authenticate with this token
  localStorage.setItem('authToken', token);
}
```

### Option 3: PostMessage Communication
```javascript
// In PHP app
window.addEventListener('load', function() {
  const iframe = document.getElementById('scorecard-frame');
  iframe.contentWindow.postMessage({
    type: 'AUTH_TOKEN',
    token: '<?php echo $token; ?>'
  }, 'http://localhost:3000');
});

// In React app (App.js or AuthContext)
window.addEventListener('message', function(event) {
  if (event.origin === 'http://your-php-app.com') {
    if (event.data.type === 'AUTH_TOKEN') {
      // Authenticate with the token
      login(event.data.token);
    }
  }
});
```

## Available Pages

All pages support embedded mode:

| Page | URL Path | Query Parameters |
|------|----------|------------------|
| Dashboard | `/dashboard` | `embedded=true` |
| Production | `/production` | `embedded=true` |
| Production - Scorecard | `/production` | `section=scorecard&embedded=true` |
| Production - Leaderboard | `/production` | `section=leaderboard&embedded=true` |
| Production - Reports | `/production` | `section=reports&embedded=true` |
| Recruiting | `/recruiting` | `embedded=true` |
| Recruiting - Pipeline | `/recruiting` | `section=pipeline&embedded=true` |
| Resources | `/resources` | `embedded=true` |
| Utilities | `/utilities` | `embedded=true` |

## Responsive iFrame Height

To make the iframe automatically resize to content:

```html
<iframe 
    id="atlas-frame"
    src="http://localhost:3000/production?section=scorecard&embedded=true" 
    style="width: 100%; border: none;"
></iframe>

<script>
    // Listen for height changes from the React app
    window.addEventListener('message', function(event) {
        if (event.origin === 'http://localhost:3000') {
            if (event.data.type === 'RESIZE') {
                document.getElementById('atlas-frame').style.height = event.data.height + 'px';
            }
        }
    });
</script>
```

Then in your React app, send height updates:
```javascript
// Add to your page component
useEffect(() => {
  const sendHeight = () => {
    const height = document.documentElement.scrollHeight;
    window.parent.postMessage({ type: 'RESIZE', height }, '*');
  };
  
  sendHeight();
  window.addEventListener('resize', sendHeight);
  
  return () => window.removeEventListener('resize', sendHeight);
}, []);
```

## Styling Tips

### Remove Scrollbars
```css
body.embedded-mode {
  overflow: hidden;
}
```

### Full Screen
```html
<iframe 
    src="..." 
    style="position: fixed; top: 0; left: 0; width: 100%; height: 100vh; border: none;"
></iframe>
```

### With Shadow/Border
```css
iframe {
  border: 1px solid #e0e0e0;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  border-radius: 8px;
}
```

## Troubleshooting

### Issue: Blank page in iframe
**Solution:** Check browser console for CORS errors. Ensure your backend allows the origin.

### Issue: Authentication not working
**Solution:** Ensure cookies are being sent with iframe requests. You may need `SameSite=None; Secure` on cookies.

### Issue: Page too small/wrong size
**Solution:** Add `width: 100%; height: 800px;` (or desired height) to the iframe.

### Issue: Can't click buttons
**Solution:** Ensure the iframe doesn't have `pointer-events: none` CSS.

## Security Considerations

1. **Validate Origins:** Always validate the origin when using postMessage
2. **Use HTTPS:** In production, always use HTTPS
3. **Token Expiration:** Implement token expiration and refresh logic
4. **CSP Headers:** Configure Content Security Policy to allow iframe embedding from specific domains
5. **X-Frame-Options:** Set appropriate X-Frame-Options headers in your backend

## Production Deployment

When deploying to production, update URLs:

```php
<?php
// Development
$reactAppUrl = 'http://localhost:3000';

// Production
$reactAppUrl = 'https://agents.ariaslife.com';

// Build embedded URL
$embeddedUrl = $reactAppUrl . '/production?section=scorecard&embedded=true';
?>
```

## Need Help?

Contact your development team if you need:
- Custom authentication integration
- Additional pages in embedded mode
- Specific styling requirements
- Performance optimization

