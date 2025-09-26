# Government ID Authentication Integration Guide

## Overview

This system adds Government ID authentication alongside your existing Core Wallet blockchain authentication. Both systems work independently and users can choose their preferred login method.

## 🔧 Backend Setup Complete

### Files Added:
- `/models/User.js` - MongoDB User model
- `/config/database.js` - MongoDB connection
- `/middleware/auth.js` - Govt ID authentication middleware  
- `/routes/auth.js` - Registration & login routes
- `/routes/govtAdmin.js` - Admin-specific routes for Govt ID users

### Database Schema:
```javascript
{
  name: String (2-100 chars),
  govtID: String (5-50 chars, unique),
  role: 'voter' | 'admin',
  timestamps: true
}
```

## 🚀 API Endpoints

### Authentication
```bash
# Register new user
POST /api/auth/register
{
  "name": "John Doe",
  "govtID": "ID123456789",
  "role": "voter" // or "admin"
}

# Login with Govt ID (no password needed)
POST /api/auth/login
{
  "govtID": "ID123456789"
}

# Get user profile (requires auth token)
GET /api/auth/profile
Authorization: Bearer <token>
```

### Admin Management  
```bash
# Get all users (admin only)
GET /api/auth/users?role=voter&limit=50

# Admin dashboard
GET /api/govt-admin/dashboard

# Admin analytics  
GET /api/govt-admin/analytics
```

## 🔐 Security Features

1. **Input Validation**: All inputs validated with proper error messages
2. **Rate Limiting**: Prevents brute force attacks  
3. **JWT Tokens**: 24-hour expiry, secure signing
4. **Role-Based Access**: Separate admin/voter permissions
5. **Unique Govt IDs**: Database-level uniqueness constraints

## 🔄 Integration with Existing Core Wallet System

Your existing Core Wallet authentication remains 100% intact:
- All existing `/api/admin/*` routes work as before
- Blockchain voting functionality unchanged
- Smart contract interactions preserved

## 📱 Frontend Integration Examples

### Registration Component
```jsx
import { useState } from 'react';

const GovtIDRegister = () => {
  const [formData, setFormData] = useState({
    name: '',
    govtID: '',
    role: 'voter'
  });

  const handleRegister = async (e) => {
    e.preventDefault();
    
    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      
      const data = await response.json();
      
      if (response.ok) {
        alert('Registration successful!');
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch (error) {
      alert('Registration failed');
    }
  };

  return (
    <form onSubmit={handleRegister}>
      <input
        type="text"
        placeholder="Full Name"
        value={formData.name}
        onChange={(e) => setFormData({...formData, name: e.target.value})}
        required
      />
      <input
        type="text"
        placeholder="Government ID"
        value={formData.govtID}
        onChange={(e) => setFormData({...formData, govtID: e.target.value})}
        required
      />
      <select
        value={formData.role}
        onChange={(e) => setFormData({...formData, role: e.target.value})}
      >
        <option value="voter">Voter</option>
        <option value="admin">Admin</option>
      </select>
      <button type="submit">Register</button>
    </form>
  );
};
```

### Login Component  
```jsx
const GovtIDLogin = () => {
  const [govtID, setGovtID] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ govtID })
      });
      
      const data = await response.json();
      
      if (response.ok) {
        // Store token in localStorage
        localStorage.setItem('govtAuthToken', data.token);
        localStorage.setItem('govtUser', JSON.stringify(data.user));
        
        alert('Login successful!');
        // Redirect based on role
        if (data.user.role === 'admin') {
          window.location.href = '/govt-admin-dashboard';
        } else {
          window.location.href = '/voter-dashboard';
        }
      } else {
        alert(`Login failed: ${data.error}`);
      }
    } catch (error) {
      alert('Login failed');
    }
  };

  return (
    <form onSubmit={handleLogin}>
      <input
        type="text"
        placeholder="Enter your Government ID"
        value={govtID}
        onChange={(e) => setGovtID(e.target.value)}
        required
      />
      <button type="submit">Login with Govt ID</button>
    </form>
  );
};
```

### Dual Authentication Choice Component
```jsx
const LoginChoice = () => {
  return (
    <div className="login-options">
      <h2>Choose Login Method</h2>
      
      <div className="login-buttons">
        <button 
          onClick={() => window.location.href = '/govt-id-login'}
          className="govt-login-btn"
        >
          🆔 Login with Government ID
        </button>
        
        <button 
          onClick={() => window.location.href = '/core-wallet-login'}
          className="wallet-login-btn"
        >
          🔗 Login with Core Wallet
        </button>
      </div>
    </div>
  );
};
```

### Protected Route Helper
```jsx
const useGovtAuth = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('govtAuthToken');
    if (token) {
      // Verify token and get user profile
      fetch('/api/auth/profile', {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      .then(res => res.json())
      .then(data => {
        if (data.user) {
          setUser(data.user);
        } else {
          localStorage.removeItem('govtAuthToken');
          localStorage.removeItem('govtUser');
        }
        setLoading(false);
      })
      .catch(() => {
        localStorage.removeItem('govtAuthToken');
        localStorage.removeItem('govtUser');
        setLoading(false);
      });
    } else {
      setLoading(false);
    }
  }, []);

  return { user, loading };
};
```

## 🧪 Testing the System

### Test Registration:
```bash
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Voter",
    "govtID": "TEST123456",
    "role": "voter"
  }'
```

### Test Login:
```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "govtID": "TEST123456"
  }'
```

### Test Admin Registration:
```bash
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Admin",
    "govtID": "ADMIN123456", 
    "role": "admin"
  }'
```

## 📊 Environment Variables

Add to your `.env` file:
```env
# MongoDB Connection (already provided)
MONGO_URI=mongodb+srv://shaikafiya9676:Afiya%40123456@cluster0.pqnhf.mongodb.net/conferenceDB

# JWT Secret (change this in production!)
JWT_SECRET=avalanche-voting-secret-key-change-in-production
```

## 🔒 Production Security Checklist

1. **Change JWT_SECRET** to a strong, random secret
2. **Enable HTTPS** for all API communication
3. **Add request logging** for audit trails
4. **Implement proper CORS** settings
5. **Add API documentation** using Swagger/OpenAPI
6. **Set up monitoring** for failed login attempts
7. **Add backup strategies** for MongoDB

## 🚀 Next Steps

1. **Frontend Integration**: Add the Government ID login components to your React app
2. **Route Protection**: Implement role-based route guards
3. **UI/UX**: Design consistent login flow between Core Wallet and Govt ID
4. **Testing**: Create comprehensive test cases for both auth systems
5. **Deployment**: Set up production MongoDB and secure environment variables

Your blockchain voting platform now supports dual authentication while maintaining all existing Core Wallet functionality! 🎉