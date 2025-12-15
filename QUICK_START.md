# Quick Start Guide

## Goal
Get the backend running and integrated with your existing frontend in **under 10 minutes**.

---

## Step 1: Start the Backend (2 minutes)

```bash
# Navigate to backend directory
cd backend

# Install dependencies (if not already done)
npm install

# Start development server
npm run dev
```

**Expected Output:**
```
Server running on http://localhost:3001
Environment: development
Frontend URL: http://localhost:3000
Automation services initialized
```

**Test it works:**
```bash
curl http://localhost:3001/health
```

Should return:
```json
{
  "status": "OK",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "environment": "development"
}
```

---

## 🔧 Step 2: Test with Your Existing Auth (3 minutes)

### Get Your Supabase Token
In your existing frontend, open browser dev tools and run:
```javascript
// In your browser console on localhost:3000
console.log(JSON.parse(localStorage.getItem('sb-qqjsnezrnuafwgwhsrxi-auth-token'))?.access_token);
```

### Test Backend Authentication
```bash
# Replace YOUR_TOKEN with the token from above
curl -X POST http://localhost:3001/api/auth/validate \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "id": "your-user-id",
    "email": "your-email@example.com",
    "username": "your-username",
    "role": "client"
  }
}
```

**Success!** Your existing Supabase auth works with the backend.

---

## Step 3: Test Enhanced Cart (2 minutes)

### Add Item to Cart
```bash
# Use your token from Step 2
curl -X POST http://localhost:3001/api/cart/items \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "service_id": "any-service-id-from-your-db",
    "vendor_id": "any-vendor-id-from-your-db"
  }'
```

### View Cart
```bash
curl -X GET http://localhost:3001/api/cart \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Success!** Enhanced cart with vendor organization is working.

---

## Step 4: Test Anonymous Messaging (1 minute)

```bash
# Send anonymous message (no auth required)
curl -X POST http://localhost:3001/api/messages \
  -H "Content-Type: application/json" \
  -d '{
    "toUserId": "any-vendor-id-from-your-db",
    "content": "Hello! I am interested in your services."
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "id": "message-uuid",
    "content": "Hello! I am interested in your services.",
    "sender_name": "Alien",
    "created_at": "2024-01-15T10:30:00.000Z"
  }
}
```

**Success!** Anonymous messaging works (sender shows as "Alien").

---

## Step 5: Test Wallet Creation (1 minute)

```bash
# Create wallet for authenticated user
curl -X POST http://localhost:3001/api/wallets \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "id": "wallet-uuid",
    "user_id": "your-user-id",
    "user_type": "client",
    "balance": 0.00,
    "created_at": "2024-01-15T10:30:00.000Z"
  }
}
```

**Success!** Wallet system is working.

---

## Step 6: Add to Your Frontend (1 minute)

### Quick Integration Test
Add this to any page in your Next.js app:

```typescript
// pages/test-backend.tsx or app/test-backend/page.tsx
import { useAuth } from '@/context/AuthContext';
import { useState } from 'react';

export default function TestBackend() {
  const { session } = useAuth();
  const [result, setResult] = useState('');

  const testBackend = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/auth/validate', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session?.access_token}`,
          'Content-Type': 'application/json'
        }
      });
      
      const data = await response.json();
      setResult(JSON.stringify(data, null, 2));
    } catch (error) {
      setResult('Error: ' + error);
    }
  };

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Backend Integration Test</h1>
      
      <button 
        onClick={testBackend}
        className="bg-blue-500 text-white px-4 py-2 rounded mb-4"
      >
        Test Backend Connection
      </button>
      
      {result && (
        <pre className="bg-gray-100 p-4 rounded overflow-auto">
          {result}
        </pre>
      )}
    </div>
  );
}
```

Visit `http://localhost:3000/test-backend` and click the button.

**Success!** Your frontend can communicate with the backend.

---

##What You Just Accomplished

In under 10 minutes, you've:

✅ **Started the backend server**  
✅ **Verified Supabase auth integration**  
✅ **Tested enhanced cart functionality**  
✅ **Confirmed anonymous messaging works**  
✅ **Created a digital wallet**  
✅ **Connected frontend to backend**  

---

## Next Steps

### Immediate (Next 30 minutes)
1. **Add Wallet to Dashboard**: Copy the wallet component from `FRONTEND_EXAMPLES.md`
2. **Enhance Existing Cart**: Replace your cart logic with the enhanced version
3. **Add Messaging**: Add messaging component to vendor profiles

### This Week
1. **Real-time Features**: Add Socket.IO for live messaging
2. **Notifications**: Implement notification system
3. **Payment Flow**: Set up complete escrow payment process

### Advanced
1. **Vendor Dashboard**: Build vendor-specific features
2. **Analytics**: Add transaction and messaging analytics
3. **Mobile**: Extend to React Native or mobile web

---

## Troubleshooting

### Backend Won't Start
```bash
# Check if port 3001 is in use
lsof -i :3001

# Kill process if needed
kill -9 PID_NUMBER

# Try starting again
npm run dev
```

### Authentication Fails
1. Check your Supabase token is valid
2. Ensure your Supabase project is running
3. Verify environment variables in backend

### CORS Errors
The backend is configured for `http://localhost:3000`. If your frontend runs on a different port, update `backend/src/config/environment.ts`.

### Database Errors
The backend creates tables automatically. If you see database errors:
1. Check your Supabase connection
2. Ensure your database is accessible
3. Run `npm run db:health` to check connectivity

---

## Need Help?

1. **Check the logs**: Backend logs show detailed error information
2. **API Reference**: See `API_REFERENCE.md` for complete endpoint documentation
3. **Examples**: See `FRONTEND_EXAMPLES.md` for integration patterns
4. **Database**: See `DATABASE_SCHEMA.md` for data structure

---

## Author

**Adeyemi Samuel Akitoye**