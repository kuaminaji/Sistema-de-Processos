# Browser Extension Compatibility

## Known Issues

### Chrome Extension Errors

Some browser extensions (particularly PDF viewers and page translators) may inject scripts into web pages, which can cause console errors:

```
Uncaught (in promise) TypeError: Failed to fetch dynamically imported module: chrome-extension://...
Uncaught (in promise) Error: A listener indicated an asynchronous response by returning true, but the message channel closed before a response was received
```

**These errors are harmless and do not affect the application functionality.**

## Solution Implemented

The application now includes error suppression handlers in all HTML pages that:

1. Detect errors originating from browser extensions
2. Suppress them from the console to reduce noise
3. Log them as informational messages if needed

### Error Handler Code

```javascript
// Suppress browser extension errors
window.addEventListener('error', function(e) {
    if (e.filename && e.filename.indexOf('chrome-extension://') === 0) {
        e.preventDefault();
        return true;
    }
});

window.addEventListener('unhandledrejection', function(e) {
    if (e.reason && e.reason.message && 
        (e.reason.message.indexOf('chrome-extension://') !== -1 ||
         e.reason.message.indexOf('message channel closed') !== -1)) {
        e.preventDefault();
        return true;
    }
});
```

## Alternative Solutions

If you still see these errors or they cause issues:

### 1. Disable Problematic Extensions

Common extensions that may cause these errors:
- PDF viewers (Adobe Acrobat extension)
- Page translators
- Ad blockers (in rare cases)
- Screenshot tools

**To disable temporarily:**
1. Open Chrome Extensions (chrome://extensions/)
2. Disable the PDF viewer or other extensions
3. Reload the application

### 2. Use Incognito/Private Mode

Extensions are typically disabled in incognito mode by default.

### 3. Create a Dedicated Browser Profile

Create a clean Chrome profile without extensions for web development.

## Impact

**No impact on application functionality.** The errors are purely cosmetic and occur because:

1. Browser extensions try to inject scripts into the page
2. Content Security Policy (CSP) blocks some of these injections
3. The extension's async message handlers time out

The application continues to work normally despite these errors.

## Improved Security

The updated CSP configuration also improves security by:
- Restricting `connectSrc` to same-origin only
- Blocking plugins with `objectSrc: none`
- Restricting base URI and form actions
- Maintaining secure defaults for all directives
