# Firebase Write Operations Test Endpoint

## Overview
A test endpoint has been created to verify that Firebase Realtime Database write operations (CREATE, UPDATE, MODIFY, DELETE) are working correctly in production.

## Endpoint
**URL**: `/api/utils/test-firebase-writes` or `/api/test-firebase-writes`

**Method**: `POST`

**Authentication**: Not required (but should be protected in production)

## How to Use

### Option 1: Using curl
```bash
curl -X POST https://your-app.vercel.app/api/utils/test-firebase-writes \
  -H "Content-Type: application/json"
```

### Option 2: Using JavaScript/Fetch
```javascript
fetch('https://your-app.vercel.app/api/utils/test-firebase-writes', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
})
.then(response => response.json())
.then(data => {
  console.log('Test Results:', data);
})
.catch(error => {
  console.error('Error:', error);
});
```

### Option 3: Using Postman/Browser
1. Open your browser's developer console (F12)
2. Go to the Console tab
3. Paste and run:
```javascript
fetch('/api/utils/test-firebase-writes', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' }
})
.then(r => r.json())
.then(console.log)
.catch(console.error);
```

## What It Tests

The endpoint performs 4 sequential tests:

1. **CREATE** - Creates a test document in Firebase
2. **UPDATE** - Updates the entire document
3. **MODIFY** - Partially updates specific fields
4. **DELETE** - Deletes the test document

Each test:
- Performs the operation
- Verifies the result
- Reports success or failure with error details

## Response Format

### Success Response (All Tests Passed)
```json
{
  "success": true,
  "message": "All 4 Firebase write operation tests passed!",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "results": {
    "create": { "success": true, "testId": "test_1705315800000" },
    "update": { "success": true },
    "modify": { "success": true },
    "delete": { "success": true }
  },
  "summary": {
    "total": 4,
    "passed": 4,
    "failed": 0,
    "testId": "test_1705315800000",
    "collection": "test_firebase_writes"
  }
}
```

### Partial Success Response (Some Tests Failed)
```json
{
  "success": false,
  "message": "2/4 tests passed",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "results": {
    "create": { "success": true, "testId": "test_1705315800000" },
    "update": { "success": false, "error": "Update verification failed" },
    "modify": { "success": false, "error": "Skipped: UPDATE test failed" },
    "delete": { "success": true }
  },
  "summary": {
    "total": 4,
    "passed": 2,
    "failed": 2,
    "testId": "test_1705315800000",
    "collection": "test_firebase_writes"
  }
}
```

### Error Response
```json
{
  "success": false,
  "message": "Firebase write operations test failed",
  "error": "Error message here",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

## Test Collection

The test creates documents in a collection called `test_firebase_writes` with IDs like `test_1705315800000`. 

**Note**: These are test documents and can be safely ignored or cleaned up in Firebase Console if needed.

## Troubleshooting

### All Tests Fail
- Check Firebase Admin SDK initialization
- Verify `FIREBASE_SERVICE_ACCOUNT_KEY` is set correctly
- Verify `FIREBASE_DATABASE_URL` is set correctly
- Check Vercel function logs for detailed error messages

### CREATE Test Fails
- Firebase Admin SDK might not be initialized
- Database connection issue
- Check logs for permission errors

### UPDATE/MODIFY Tests Fail
- Update operation might be failing silently
- Check logs for the specific error message
- Verify the test document was created successfully

### DELETE Test Fails
- Delete operation might not be working
- Document might not exist (if CREATE failed)
- Check logs for specific error message

## Checking Logs

After running the test, check Vercel function logs:

1. Go to Vercel Dashboard → Your Project → Deployments
2. Click on the latest deployment
3. Go to the Functions tab
4. Look for logs with:
   - `🧪 Testing Firebase write operations...`
   - `📋 Test 1: CREATE - Creating test document...`
   - `✅ CREATE test passed: ...`
   - `❌ CREATE test failed: ...`

## Next Steps

1. **Deploy** the updated code to Vercel
2. **Run the test** endpoint
3. **Check the results** - All 4 tests should pass
4. **Review logs** if any tests fail
5. **Fix any issues** based on error messages

## Security Note

This endpoint is for testing/debugging purposes. In production, you may want to:
- Add authentication (require admin role)
- Rate limit the endpoint
- Or remove it entirely after testing

## Example Usage After Deployment

```bash
# Test locally (if running dev server)
curl -X POST http://localhost:5173/api/utils/test-firebase-writes

# Test in production
curl -X POST https://reride-2-xxx.vercel.app/api/utils/test-firebase-writes
```





