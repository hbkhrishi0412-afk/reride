# Quick Troubleshooting Reference

## 🔍 Quick Diagnostic (30 seconds)

**In Browser Console (F12):**
```javascript
// Quick Firebase check
fetch('/api/db-health').then(r => r.json()).then(d => 
  console.log(d.status === 'ok' ? '✅ Firebase OK' : '❌ Firebase Failed:', d.message)
);

// Check authentication
console.log('Token:', localStorage.getItem('reRideAccessToken') ? '✅' : '❌ Missing');
console.log('User:', JSON.parse(localStorage.getItem('reRideCurrentUser') || '{}').email || '❌ Missing');
```

**Or run full diagnostic:**
1. Open browser console (F12)
2. Copy contents of `public/diagnose-password-issue.js`
3. Paste and press Enter

---

## 📋 Checklist (2 minutes)

- [ ] **Firebase Connection**: Visit `/api/db-health` - should return `{"status":"ok"}`
- [ ] **Authentication**: Check `localStorage.getItem('reRideAccessToken')` - should exist
- [ ] **User Data**: Check `localStorage.getItem('reRideCurrentUser')` - should have email
- [ ] **Network**: Open Network tab, try password update, check for errors
- [ ] **Server Logs**: Check Vercel dashboard → Deployments → Functions → Logs

---

## 🚨 Common Issues & Quick Fixes

| Issue | Quick Check | Fix |
|-------|-------------|-----|
| "Server error" | Check `/api/db-health` | Fix Firebase connection |
| "Authentication expired" | Check token in localStorage | Log out and log in again |
| "User not found" | Verify email in user data | Check Firebase database |
| "Permission denied" | Check user role/status | Ensure updating own profile |
| Network timeout | Check Network tab | Verify API is reachable |

---

## 📚 Detailed Guides

- **Full Troubleshooting Guide**: See `PASSWORD_UPDATE_TROUBLESHOOTING.md`
- **Diagnostic Script**: See `public/diagnose-password-issue.js`
- **Test Script**: See `public/test-password-update.html` (if created)

---

## 🔗 Quick Links

- **Vercel Dashboard**: https://vercel.com/dashboard
- **Firebase Console**: https://console.firebase.google.com
- **Health Check**: `https://your-app.vercel.app/api/db-health`
- **Test Connection**: `https://your-app.vercel.app/api/system?action=test-connection`

---

## 💡 Pro Tips

1. **Always check server logs first** - they have the most detailed error messages
2. **Use browser Network tab** - see exact request/response
3. **Test with non-password fields first** - verify permissions work
4. **Check token expiration** - expired tokens cause auth errors
5. **Verify Firebase env vars** - most issues are configuration-related

---

**Need more help?** See `PASSWORD_UPDATE_TROUBLESHOOTING.md` for step-by-step instructions.


