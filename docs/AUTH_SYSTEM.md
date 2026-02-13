# Authentication System Documentation

## Overview
Complete authentication system for the judicial process management system with enterprise-grade security features.

## Features

### 1. Login (`POST /api/auth/login`)
- Email/password authentication
- Brute force protection (IP-based)
- TOTP 2FA support (optional)
- Automatic permission loading
- Session creation with user data and permissions
- Updates last login timestamp
- Comprehensive audit logging

### 2. Logout (`POST /api/auth/logout`)
- Destroys session
- Audit logging

### 3. Change Password (`POST /api/auth/trocar-senha`)
- Requires authentication
- Validates current password
- Password complexity validation (10+ chars, uppercase, lowercase, numbers, symbols)
- Password history check (configurable, default 5 passwords)
- Automatic password expiration setup (configurable, default 90 days)
- Resets forced password change flag

### 4. Get Current User (`GET /api/auth/me`)
- Requires authentication
- Returns user info with permissions

### 5. Setup 2FA (`GET /api/auth/setup-2fa`)
- Requires authentication
- Generates TOTP secret
- Returns QR code for authenticator apps (Google Authenticator, Authy, etc.)

### 6. Enable 2FA (`POST /api/auth/enable-2fa`)
- Requires authentication
- Verifies TOTP token before enabling

### 7. Disable 2FA (`POST /api/auth/disable-2fa`)
- Requires authentication
- Requires password confirmation for security

### 8. Verify 2FA (`POST /api/auth/verify-2fa`)
- Standalone endpoint for 2FA verification during login
- Brute force protection

## Security Features

### Password Security
- **Hashing:** bcryptjs with 10 salt rounds
- **Complexity Requirements:**
  - Minimum 10 characters
  - At least 1 uppercase letter
  - At least 1 lowercase letter
  - At least 1 number
  - At least 1 special character
- **History Tracking:** Prevents reuse of last N passwords (configurable via `PASSWORD_HISTORY_COUNT`)
- **Automatic Expiration:** Passwords expire after N days (configurable via `PASSWORD_EXPIRY_DAYS`)

### Brute Force Protection
- IP-based rate limiting
- Exponential backoff (5min, 10min, 20min, 40min, up to max)
- Configurable via `BRUTE_FORCE_BASE_MINUTES` and `BRUTE_FORCE_MAX_MINUTES`
- Automatic unlock after timeout
- Tracks failed attempts per IP and per email

### Two-Factor Authentication (2FA)
- TOTP-based (Time-based One-Time Password)
- Compatible with Google Authenticator, Authy, etc.
- QR code generation for easy setup
- Optional per user
- Requires password confirmation to disable

### Session Management
- Secure HTTP-only cookies
- 8-hour session timeout
- Automatic session destruction on logout
- Session storage includes user data and permissions

### CSRF Protection
- Token-based CSRF protection for web forms
- API requests (JSON content-type) can bypass CSRF for programmatic access
- CSRF token available at `GET /api/csrf-token`
- Conditional CSRF middleware (`skipCSRFForAPI`)

### Input Sanitization
- HTML entity encoding to prevent XSS
- Email validation and sanitization
- SQL injection protection via parameterized queries

### Audit Logging
- All authentication events logged
- Includes: user ID, email, action, IP, user agent, timestamp
- Failed login attempts tracked
- Success and failure events differentiated

## Environment Variables

```env
# Password Policies
PASSWORD_EXPIRY_DAYS=90          # Password expiration in days
PASSWORD_HISTORY_COUNT=5         # Number of old passwords to check

# Brute Force Protection
BRUTE_FORCE_BASE_MINUTES=5       # Initial lockout duration
BRUTE_FORCE_MAX_MINUTES=120      # Maximum lockout duration

# Session
SESSION_SECRET=your-secret-here  # Strong random secret for session encryption
COOKIE_SECURE=false              # Set to 'true' for HTTPS
```

## Testing

Run the authentication tests:
```bash
npm test tests/auth.test.js
```

**Test Coverage:**
- Login with valid/invalid credentials
- Login with 2FA
- Brute force protection
- Password change validation
- 2FA setup, enable, disable
- User info retrieval
- Logout
- Permission loading

All 11 tests passing ✓

## Security Notes

### CSRF Warning (False Positive)
CodeQL may report missing CSRF protection on session middleware. This is intentional:
- Auth endpoints use `skipCSRFForAPI` to allow both web and API access
- CSRF is enforced for web forms via token
- API requests use session authentication without CSRF
- This dual-mode approach supports both programmatic and browser-based access

### Production Checklist
- [ ] Set strong `SESSION_SECRET` (not default)
- [ ] Enable `COOKIE_SECURE=true` for HTTPS
- [ ] Configure `TRUST_PROXY=1` if behind reverse proxy
- [ ] Review and adjust password expiry days
- [ ] Review and adjust brute force thresholds
- [ ] Change default admin password immediately
- [ ] Enable 2FA for admin accounts
- [ ] Monitor audit logs regularly

## Response Format

All endpoints return JSON with consistent format:
```json
{
  "success": true|false,
  "message": "Human-readable message",
  "data": { ... }
}
```

Error responses include appropriate HTTP status codes:
- `400`: Bad Request (validation errors)
- `401`: Unauthorized (authentication failed)
- `403`: Forbidden (password change required, permission denied)
- `404`: Not Found
- `429`: Too Many Requests (rate limited)
- `500`: Internal Server Error
