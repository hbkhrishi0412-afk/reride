# ReRide API Documentation

Complete API reference for the ReRide Vehicle Marketplace Platform.

## Base URL

```
Production: https://your-domain.vercel.app/api
Development: http://localhost:3001/api
```

## Authentication

Most endpoints require authentication using a JWT Bearer token.

### Authentication Header

```
Authorization: Bearer <jwt_token>
```

### Getting a Token

1. **Register** a new user: `POST /api/users?action=register`
2. **Login** with credentials: `POST /api/users?action=login`
3. Receive JWT token in response

### Token Refresh

```http
POST /api/users?action=refresh
Authorization: Bearer <refresh_token>
```

---

## Response Format

### Success Response

```json
{
  "success": true,
  "data": { ... }
}
```

### Error Response

```json
{
  "success": false,
  "reason": "Error description",
  "error": "Detailed error message"
}
```

### Status Codes

- `200` - Success
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `500` - Internal Server Error
- `503` - Service Unavailable

---

## Endpoints

### Users

#### Register User

```http
POST /api/users?action=register
Content-Type: application/json
```

**Request Body:**
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "mobile": "9876543210",
  "password": "SecurePassword123!",
  "role": "customer"
}
```

**Response:**
```json
{
  "success": true,
  "user": {
    "id": "user-id",
    "name": "John Doe",
    "email": "john@example.com",
    "role": "customer"
  },
  "token": "jwt_access_token",
  "refreshToken": "jwt_refresh_token"
}
```

#### Login

```http
POST /api/users?action=login
Content-Type: application/json
```

**Request Body:**
```json
{
  "email": "john@example.com",
  "password": "SecurePassword123!",
  "role": "customer"
}
```

**Response:**
```json
{
  "success": true,
  "user": {
    "id": "user-id",
    "name": "John Doe",
    "email": "john@example.com",
    "role": "customer"
  },
  "token": "jwt_access_token",
  "refreshToken": "jwt_refresh_token"
}
```

#### Get User Profile

```http
GET /api/users?action=profile
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "user": {
    "id": "user-id",
    "name": "John Doe",
    "email": "john@example.com",
    "mobile": "9876543210",
    "role": "customer",
    "plan": "free"
  }
}
```

#### Update User Profile

```http
PUT /api/users?action=profile
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "name": "John Updated",
  "mobile": "9876543211"
}
```

#### Get All Users (Admin Only)

```http
GET /api/users
Authorization: Bearer <admin_token>
```

**Query Parameters:**
- `role` (optional) - Filter by role: `customer`, `seller`, `admin`
- `limit` (optional) - Number of results (default: 50)
- `offset` (optional) - Pagination offset

---

### Vehicles

#### List Vehicles

```http
GET /api/vehicles
```

**Query Parameters:**
- `category` (optional) - Filter by category: `four-wheeler`, `two-wheeler`, `three-wheeler`, `commercial`, `farm`, `construction`
- `make` (optional) - Filter by make (e.g., "Maruti Suzuki")
- `model` (optional) - Filter by model (e.g., "Swift")
- `minPrice` (optional) - Minimum price
- `maxPrice` (optional) - Maximum price
- `city` (optional) - Filter by city
- `state` (optional) - Filter by state
- `fuelType` (optional) - Filter by fuel type
- `transmission` (optional) - Filter by transmission
- `limit` (optional) - Number of results (default: 30)
- `page` (optional) - Page number (default: 1)
- `sortBy` (optional) - Sort field: `price`, `year`, `mileage`, `createdAt`
- `sortOrder` (optional) - Sort order: `asc`, `desc`

**Response:**
```json
{
  "success": true,
  "vehicles": [
    {
      "id": 1,
      "category": "four-wheeler",
      "make": "Maruti Suzuki",
      "model": "Swift",
      "year": 2020,
      "price": 650000,
      "mileage": 25000,
      "city": "Mumbai",
      "state": "MH",
      "images": ["url1", "url2"],
      "sellerEmail": "seller@example.com",
      "status": "published"
    }
  ],
  "total": 100,
  "page": 1,
  "limit": 30
}
```

#### Get Vehicle Details

```http
GET /api/vehicles/:id
```

**Response:**
```json
{
  "success": true,
  "vehicle": {
    "id": 1,
    "category": "four-wheeler",
    "make": "Maruti Suzuki",
    "model": "Swift",
    "variant": "ZXi",
    "year": 2020,
    "price": 650000,
    "mileage": 25000,
    "images": ["url1", "url2"],
    "description": "Well maintained car",
    "features": ["Power Steering", "AC"],
    "engine": "1197 cc",
    "transmission": "Manual",
    "fuelType": "Petrol",
    "fuelEfficiency": "20 km/l",
    "color": "White",
    "sellerEmail": "seller@example.com",
    "sellerName": "John Seller",
    "city": "Mumbai",
    "state": "MH",
    "status": "published",
    "certifiedInspection": { ... }
  }
}
```

#### Create Vehicle Listing

```http
POST /api/vehicles
Authorization: Bearer <seller_token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "category": "four-wheeler",
  "make": "Maruti Suzuki",
  "model": "Swift",
  "variant": "ZXi",
  "year": 2020,
  "price": 650000,
  "mileage": 25000,
  "images": ["base64_image1", "base64_image2"],
  "description": "Well maintained car",
  "features": ["Power Steering", "AC"],
  "engine": "1197 cc",
  "transmission": "Manual",
  "fuelType": "Petrol",
  "fuelEfficiency": "20 km/l",
  "color": "White",
  "city": "Mumbai",
  "state": "MH"
}
```

**Response:**
```json
{
  "success": true,
  "vehicle": {
    "id": 123,
    ...vehicle_data
  }
}
```

#### Update Vehicle Listing

```http
PUT /api/vehicles/:id
Authorization: Bearer <seller_token>
Content-Type: application/json
```

**Request Body:** (same as create, with fields to update)

#### Delete Vehicle Listing

```http
DELETE /api/vehicles/:id
Authorization: Bearer <seller_token>
```

#### Get Vehicle Data (Brands, Models, Variants)

```http
GET /api/vehicles?type=data
```

**Response:**
```json
{
  "FOUR_WHEELER": [
    {
      "name": "Maruti Suzuki",
      "models": [
        {
          "name": "Swift",
          "variants": ["LXi", "VXi", "ZXi"]
        }
      ]
    }
  ],
  "TWO_WHEELER": [ ... ]
}
```

---

### Conversations & Messages

#### Get Conversations

```http
GET /api/conversations
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "conversations": [
    {
      "id": "conv-id",
      "vehicleId": 123,
      "vehicleTitle": "Maruti Swift 2020",
      "participants": ["user1@example.com", "user2@example.com"],
      "lastMessage": {
        "text": "Is this still available?",
        "timestamp": "2024-01-15T10:30:00Z"
      },
      "unreadCount": 2
    }
  ]
}
```

#### Get Messages

```http
GET /api/conversations/:id/messages
Authorization: Bearer <token>
```

**Query Parameters:**
- `limit` (optional) - Number of messages (default: 50)
- `before` (optional) - Get messages before this timestamp

**Response:**
```json
{
  "success": true,
  "messages": [
    {
      "id": "msg-id",
      "text": "Is this still available?",
      "senderEmail": "buyer@example.com",
      "timestamp": "2024-01-15T10:30:00Z",
      "type": "text",
      "isRead": false
    }
  ]
}
```

#### Send Message

```http
POST /api/conversations/:id/messages
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "text": "Is this still available?",
  "type": "text"
}
```

**Response:**
```json
{
  "success": true,
  "message": {
    "id": "msg-id",
    "text": "Is this still available?",
    "senderEmail": "buyer@example.com",
    "timestamp": "2024-01-15T10:30:00Z"
  }
}
```

#### Create Conversation

```http
POST /api/conversations
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "vehicleId": 123,
  "initialMessage": "Hi, I'm interested in this vehicle"
}
```

---

### Notifications

#### Get Notifications

```http
GET /api/notifications
Authorization: Bearer <token>
```

**Query Parameters:**
- `unread` (optional) - Filter unread only: `true`/`false`
- `limit` (optional) - Number of results (default: 50)

**Response:**
```json
{
  "success": true,
  "notifications": [
    {
      "id": "notif-id",
      "type": "message",
      "title": "New Message",
      "message": "You have a new message from John",
      "recipientEmail": "user@example.com",
      "isRead": false,
      "timestamp": "2024-01-15T10:30:00Z",
      "link": "/conversations/123"
    }
  ]
}
```

#### Mark Notification as Read

```http
PUT /api/notifications/:id/read
Authorization: Bearer <token>
```

#### Mark All Notifications as Read

```http
PUT /api/notifications/read-all
Authorization: Bearer <token>
```

---

### Business (Payments & Plans)

#### Get Subscription Plans

```http
GET /api/business?type=plans
```

**Response:**
```json
{
  "success": true,
  "plans": [
    {
      "id": "free",
      "name": "Free",
      "price": 0,
      "features": ["5 listings", "Basic support"],
      "duration": "monthly"
    },
    {
      "id": "pro",
      "name": "Pro",
      "price": 999,
      "features": ["Unlimited listings", "Priority support"],
      "duration": "monthly"
    }
  ]
}
```

#### Get Plan Details

```http
GET /api/business?type=plans&planId=pro
```

#### Create Payment

```http
POST /api/business?type=payments
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "planId": "pro",
  "amount": 999,
  "paymentMethod": "razorpay"
}
```

---

### Admin

All admin endpoints require admin role.

#### Get Admin Dashboard Stats

```http
GET /api/admin?action=stats
Authorization: Bearer <admin_token>
```

**Response:**
```json
{
  "success": true,
  "stats": {
    "totalUsers": 1000,
    "totalVehicles": 500,
    "totalSales": 200,
    "revenue": 50000
  }
}
```

#### Get All Users (Admin)

```http
GET /api/admin?action=users
Authorization: Bearer <admin_token>
```

#### Update User (Admin)

```http
PUT /api/admin?action=users
Authorization: Bearer <admin_token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "userId": "user-id",
  "updates": {
    "role": "seller",
    "isActive": true
  }
}
```

#### Get All Vehicles (Admin)

```http
GET /api/admin?action=vehicles
Authorization: Bearer <admin_token>
```

#### Toggle Vehicle Status (Admin)

```http
PUT /api/admin?action=vehicles
Authorization: Bearer <admin_token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "vehicleId": 123,
  "status": "published" // or "unpublished", "sold"
}
```

---

### Content

#### Get FAQs

```http
GET /api/content/faqs
```

**Response:**
```json
{
  "success": true,
  "faqs": [
    {
      "id": "faq-id",
      "question": "How do I list my vehicle?",
      "answer": "Click on 'Sell Car' and fill in the details...",
      "category": "selling"
    }
  ]
}
```

#### Create FAQ (Admin)

```http
POST /api/content/faqs
Authorization: Bearer <admin_token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "question": "How do I list my vehicle?",
  "answer": "Click on 'Sell Car' and fill in the details...",
  "category": "selling"
}
```

---

### System

#### Health Check

```http
GET /api/db-health
```

**Response:**
```json
{
  "status": "healthy",
  "database": "connected",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

#### Test Connection

```http
GET /api/system/test-connection
```

---

### AI (Gemini)

#### Generate AI Response

```http
POST /api/ai/gemini
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "payload": {
    "model": "gemini-2.5-flash",
    "contents": "What is the best car for city driving?",
    "config": {
      "responseMimeType": "application/json"
    }
  }
}
```

**Response:**
```json
{
  "success": true,
  "response": "AI generated response..."
}
```

---

## Error Handling

### Common Error Responses

#### 401 Unauthorized

```json
{
  "success": false,
  "reason": "Authentication required.",
  "error": "Invalid or expired authentication token"
}
```

#### 403 Forbidden

```json
{
  "success": false,
  "reason": "Forbidden. Admin access required.",
  "error": "This endpoint requires administrator privileges."
}
```

#### 400 Bad Request

```json
{
  "success": false,
  "reason": "Validation error",
  "error": "Email is required"
}
```

#### 404 Not Found

```json
{
  "success": false,
  "reason": "Resource not found",
  "error": "Vehicle with id 123 not found"
}
```

#### 500 Internal Server Error

```json
{
  "success": false,
  "reason": "Internal server error",
  "error": "An unexpected error occurred"
}
```

---

## Rate Limiting

API endpoints are rate-limited to prevent abuse:

- **Authentication endpoints**: 5 requests per minute per IP
- **General endpoints**: 100 requests per minute per IP
- **Admin endpoints**: 200 requests per minute per authenticated user

Rate limit headers are included in responses:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1640000000
```

---

## WebSocket (Real-time)

### Connection

```javascript
import io from 'socket.io-client';

const socket = io('https://your-domain.vercel.app', {
  auth: {
    token: 'your_jwt_token'
  }
});
```

### Events

#### Join Conversation

```javascript
socket.emit('join-conversation', { conversationId: 'conv-id' });
```

#### Send Message

```javascript
socket.emit('send-message', {
  conversationId: 'conv-id',
  text: 'Hello!'
});
```

#### Receive Message

```javascript
socket.on('new-message', (message) => {
  console.log('New message:', message);
});
```

#### Typing Indicator

```javascript
// Start typing
socket.emit('typing', { conversationId: 'conv-id', isTyping: true });

// Stop typing
socket.emit('typing', { conversationId: 'conv-id', isTyping: false });

// Receive typing status
socket.on('user-typing', (data) => {
  console.log('User typing:', data);
});
```

---

## Pagination

List endpoints support pagination:

**Query Parameters:**
- `page` - Page number (default: 1)
- `limit` - Items per page (default: 30, max: 100)

**Response includes:**
```json
{
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 30,
    "total": 100,
    "totalPages": 4,
    "hasNext": true,
    "hasPrev": false
  }
}
```

---

## Filtering & Sorting

### Filtering

Most list endpoints support filtering via query parameters:

```
GET /api/vehicles?category=four-wheeler&minPrice=500000&maxPrice=1000000&city=Mumbai
```

### Sorting

Use `sortBy` and `sortOrder` parameters:

```
GET /api/vehicles?sortBy=price&sortOrder=asc
```

Available sort fields:
- `price` - Sort by price
- `year` - Sort by year
- `mileage` - Sort by mileage
- `createdAt` - Sort by creation date

---

## File Uploads

### Upload Image

```http
POST /api/upload/image
Authorization: Bearer <token>
Content-Type: multipart/form-data
```

**Form Data:**
- `file` - Image file (max 5MB)
- `type` (optional) - Image type: `vehicle`, `profile`, `document`

**Response:**
```json
{
  "success": true,
  "url": "https://storage.supabase.co/...",
  "publicUrl": "https://..."
}
```

---

## Best Practices

1. **Always include Authorization header** for protected endpoints
2. **Handle errors gracefully** - Check `success` field in responses
3. **Use pagination** for large datasets
4. **Implement retry logic** for failed requests
5. **Cache responses** when appropriate
6. **Validate input** before sending requests
7. **Use WebSocket** for real-time features instead of polling

---

## SDK Examples

### JavaScript/TypeScript

```typescript
const API_BASE = 'https://your-domain.vercel.app/api';

async function getVehicles(filters = {}) {
  const params = new URLSearchParams(filters);
  const response = await fetch(`${API_BASE}/vehicles?${params}`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  return response.json();
}

async function createVehicle(vehicleData) {
  const response = await fetch(`${API_BASE}/vehicles`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(vehicleData)
  });
  return response.json();
}
```

---

## Support

For API support:
1. Check this documentation
2. Review error messages in responses
3. Check [Troubleshooting Guide](./README.md#troubleshooting)
4. Open an issue on GitHub

---

*Last Updated: 2024*
*API Version: 1.0*




