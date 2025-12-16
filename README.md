# 🚀 Engreene Backend

A comprehensive Node.js + Express backend for the Engreene marketplace platform, providing enhanced cart functionality, digital wallets, real-time messaging, and secure payment processing.

## ✨ Features

### 🔐 **Authentication & Authorization**
- Seamless Supabase authentication integration
- Role-based access (client/vendor)
- Anonymous messaging support
- JWT token validation

### 💰 **Digital Wallet System**
- Secure wallet creation for clients and vendors
- Payment method linking
- Escrow payment processing
- Automatic 10% commission handling

### 🛒 **Enhanced Cart & Wishlist**
- Multi-vendor cart organization
- Single payment for multiple vendors
- Automatic payment distribution
- Separate wishlist functionality

### 💬 **Real-time Messaging**
- Anonymous and authenticated messaging
- Automated vendor responses
- Response time tracking with reminders
- Online/offline status indicators

### 🔔 **Notification System**
- Real-time notifications via Socket.IO
- Vendor alerts for cart/wishlist additions
- Automated reminder system

### 🛡️ **Security & Performance**
- Helmet security middleware
- CORS protection
- Request validation
- Error handling and logging

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- Existing Supabase project
- Next.js frontend (existing)

### Installation
```bash
npm install
npm run dev
```

The server will start on `http://localhost:3001`

### Verify Installation
```bash
curl http://localhost:3001/health
```

**👉 For detailed setup instructions, see [QUICK_START.md](./QUICK_START.md)**

---

## 📚 Documentation

| Document | Description |
|----------|-------------|
| **[🚀 QUICK_START.md](./QUICK_START.md)** | Get running in under 10 minutes |
| **[🔗 INTEGRATION_GUIDE.md](./INTEGRATION_GUIDE.md)** | Complete frontend integration guide |
| **[📖 API_REFERENCE.md](./API_REFERENCE.md)** | Full API documentation |
| **[🗄️ DATABASE_SCHEMA.md](./DATABASE_SCHEMA.md)** | Database structure and migrations |
| **[🎨 FRONTEND_EXAMPLES.md](./FRONTEND_EXAMPLES.md)** | React/Next.js integration examples |

---

## 👨‍💻 Author

**Adeyemi Samuel Akitoye**

---