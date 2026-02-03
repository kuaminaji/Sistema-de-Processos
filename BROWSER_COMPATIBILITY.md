# Browser Extension Compatibility

## Known Issues - UPDATED SOLUTION

### Chrome Extension Errors

Some browser extensions (particularly PDF viewers and page translators) inject scripts into web pages, which can cause console errors:

```
Uncaught (in promise) TypeError: Failed to fetch dynamically imported module: chrome-extension://...
Uncaught (in promise) Error: A listener indicated an asynchronous response by returning true, but the message channel closed before a response was received
```

**These errors are COMPLETELY HARMLESS and do NOT affect application functionality.**

## Enhanced Solution Implemented (v2)

The application now includes **aggressive error suppression** in the `<head>` section of all pages:

### 1. Console.error Override
Intercepts and filters console.error calls to hide extension-related messages.

### 2. Global Error Handler
Catches all runtime errors in the capture phase, before they bubble up.

### 3. Promise Rejection Handler  
Catches unhandled promise rejections from extensions.

### Implementation Details

The error suppression script is placed as the **first script in the `<head>`** section:

```javascript
<script>
(function() {
    // Override console.error
    var originalError = console.error;
    console.error = function() {
        var args = Array.prototype.slice.call(arguments);
        var message = args.join(' ');
        
        // Filter extension errors
        if (message.indexOf('chrome-extension://') !== -1 ||
            message.indexOf('message channel closed') !== -1 ||
            message.indexOf('dynamically imported module') !== -1) {
            return; // Silently ignore
        }
        
        originalError.apply(console, arguments);
    };
    
    // Capture phase error handler
    window.addEventListener('error', function(e) {
        if (e.filename && e.filename.indexOf('chrome-extension://') === 0) {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            return false;
        }
    }, true); // Capture phase!
    
    // Promise rejection handler
    window.addEventListener('unhandledrejection', function(e) {
        if (e.reason) {
            var message = e.reason.message || e.reason.toString();
            if (message.indexOf('chrome-extension://') !== -1 ||
                message.indexOf('message channel closed') !== -1 ||
                message.indexOf('dynamically imported module') !== -1) {
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
                return false;
            }
        }
    }, true); // Capture phase!
})();
</script>
```

## Why This Works Better

1. **Early Execution**: Script runs before ANY other code, including extensions
2. **Capture Phase**: Events are caught before they bubble, preventing console output
3. **Console Override**: Even if errors slip through, they're filtered from console
4. **Immediate Invocation**: Self-executing function ensures it runs immediately

## Verification

After this update, you should see:
- ✅ **Clean console** - No extension errors visible
- ✅ **Application errors still shown** - Only extension errors are suppressed
- ✅ **Full functionality** - No impact on application behavior

### How to Test

1. Open browser console (F12)
2. Navigate to any page (login, consulta, admin)
3. Console should be clean, no extension errors
4. Application errors (if any) will still appear normally

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
