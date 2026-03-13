const express = require("express");
const path = require("path");
const app = express();
const PORT = process.env.PORT || 3000;

// Add cache control headers
app.use((req, res, next) => {
  // For HTML files - no cache (always get latest)
  if (req.path.endsWith('.html') || req.path === '/') {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }
  // For JS/CSS files with hashes - cache aggressively (they're versioned)
  else if (/\.(js|css)$/.test(req.path) && /\.[a-f0-9]{8}\./.test(req.path)) {
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  }
  // For other static assets - moderate caching
  else if (/\.(jpg|jpeg|png|gif|ico|svg|woff|woff2|ttf|eot)$/.test(req.path)) {
    res.setHeader('Cache-Control', 'public, max-age=86400'); // 1 day
  }
  
  next();
});

// Serve static files from the build folder
app.use(express.static(path.join(__dirname, "build"), {
  etag: true,
  lastModified: true,
  setHeaders: (res, filePath) => {
    // Extra safety: ensure index.html is never cached
    if (filePath.endsWith('index.html')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    }
  }
}));

// Catch-all route to serve index.html for any route
app.get("*", (req, res) => {
  // Always set no-cache headers for the HTML
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.sendFile(path.join(__dirname, "build", "index.html"));
});

app.listen(PORT, () => {
  console.log(`Frontend running on port ${PORT}`);
  console.log(`Cache control enabled for optimal performance`);
});
