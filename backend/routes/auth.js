const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { verifyGovtIDAuth, verifyGovtIDAdmin } = require('../middleware/auth');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'avalanche-voting-secret-key-change-in-production';

// Input validation helpers
const validateGovtID = (govtID) => {
  if (!govtID || typeof govtID !== 'string') {
    return { isValid: false, error: 'Government ID is required' };
  }
  
  const trimmed = govtID.trim();
  if (trimmed.length < 5 || trimmed.length > 50) {
    return { isValid: false, error: 'Government ID must be between 5-50 characters' };
  }
  
  // Basic alphanumeric validation
  if (!/^[a-zA-Z0-9\-_]+$/.test(trimmed)) {
    return { isValid: false, error: 'Government ID can only contain letters, numbers, hyphens, and underscores' };
  }
  
  return { isValid: true, value: trimmed };
};

const validateName = (name) => {
  if (!name || typeof name !== 'string') {
    return { isValid: false, error: 'Name is required' };
  }
  
  const trimmed = name.trim();
  if (trimmed.length < 2 || trimmed.length > 100) {
    return { isValid: false, error: 'Name must be between 2-100 characters' };
  }
  
  return { isValid: true, value: trimmed };
};

const validateRole = (role) => {
  if (!role || typeof role !== 'string') {
    return { isValid: false, error: 'Role is required' };
  }
  
  const validRoles = ['voter', 'admin'];
  if (!validRoles.includes(role)) {
    return { isValid: false, error: 'Role must be either "voter" or "admin"' };
  }
  
  return { isValid: true, value: role };
};

// Rate limiting
const rateLimitMap = new Map();
const rateLimit = (windowMs = 60000, maxRequests = 5) => {
  return (req, res, next) => {
    const key = req.ip || 'unknown';
    const now = Date.now();
    
    if (!rateLimitMap.has(key)) {
      rateLimitMap.set(key, []);
    }
    
    const requests = rateLimitMap.get(key);
    const validRequests = requests.filter(time => now - time < windowMs);
    
    if (validRequests.length >= maxRequests) {
      return res.status(429).json({ error: 'Too many requests. Please try again later.' });
    }
    
    validRequests.push(now);
    rateLimitMap.set(key, validRequests);
    next();
  };
};

// POST /api/auth/register - Register new user with Government ID
router.post('/register', rateLimit(60000, 3), async (req, res) => {
  try {
    const { name, govtID, role } = req.body;
    
    // Validate inputs
    const nameValidation = validateName(name);
    if (!nameValidation.isValid) {
      return res.status(400).json({ error: nameValidation.error });
    }
    
    const govtIDValidation = validateGovtID(govtID);
    if (!govtIDValidation.isValid) {
      return res.status(400).json({ error: govtIDValidation.error });
    }
    
    const roleValidation = validateRole(role);
    if (!roleValidation.isValid) {
      return res.status(400).json({ error: roleValidation.error });
    }
    
    // Check if user already exists
    const existingUser = await User.findOne({ govtID: govtIDValidation.value });
    if (existingUser) {
      return res.status(409).json({ error: 'User with this Government ID already exists' });
    }
    
    // Create new user
    const newUser = new User({
      name: nameValidation.value,
      govtID: govtIDValidation.value,
      role: roleValidation.value
    });
    
    await newUser.save();
    
    console.log(`✅ New ${roleValidation.value} registered: ${nameValidation.value} (ID: ${govtIDValidation.value})`);
    
    res.status(201).json({
      message: `${roleValidation.value === 'admin' ? 'Admin' : 'Voter'} registered successfully`,
      user: {
        id: newUser._id,
        name: newUser.name,
        govtID: newUser.govtID,
        role: newUser.role
      }
    });
    
  } catch (error) {
    console.error('Registration error:', error);
    
    // Handle mongoose validation errors
    if (error.name === 'ValidationError') {
      const validationErrors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({ error: `Validation failed: ${validationErrors.join(', ')}` });
    }
    
    // Handle duplicate key errors
    if (error.code === 11000) {
      return res.status(409).json({ error: 'User with this Government ID already exists' });
    }
    
    res.status(500).json({ error: 'Registration failed. Please try again.' });
  }
});

// POST /api/auth/login - Login with Government ID only
router.post('/login', rateLimit(60000, 10), async (req, res) => {
  try {
    const { govtID } = req.body;
    
    // Validate Government ID
    const govtIDValidation = validateGovtID(govtID);
    if (!govtIDValidation.isValid) {
      return res.status(400).json({ error: govtIDValidation.error });
    }
    
    // Find user by Government ID
    const user = await User.findOne({ govtID: govtIDValidation.value });
    if (!user) {
      return res.status(401).json({ error: 'Invalid Government ID. User not found.' });
    }
    
    // Generate JWT token
    const token = jwt.sign(
      {
        userId: user._id,
        govtID: user.govtID,
        role: user.role,
        authType: 'govtID',
        timestamp: Date.now()
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );
    
    console.log(`🔐 User logged in: ${user.name} (${user.role}) - ID: ${user.govtID}`);
    
    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        name: user.name,
        govtID: user.govtID,
        role: user.role
      },
      expiresIn: 86400 // 24 hours in seconds
    });
    
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed. Please try again.' });
  }
});

// GET /api/auth/profile - Get user profile (requires authentication)
router.get('/profile', verifyGovtIDAuth, (req, res) => {
  try {
    res.json({
      user: {
        id: req.user._id,
        name: req.user.name,
        govtID: req.user.govtID,
        role: req.user.role,
        createdAt: req.user.createdAt,
        updatedAt: req.user.updatedAt
      }
    });
  } catch (error) {
    console.error('Profile fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// GET /api/auth/users - Get all users (admin only)
router.get('/users', verifyGovtIDAdmin, async (req, res) => {
  try {
    const { role, limit = 50, skip = 0 } = req.query;
    
    const filter = {};
    if (role && ['voter', 'admin'].includes(role)) {
      filter.role = role;
    }
    
    const users = await User.find(filter)
      .select('-__v') // Exclude version field
      .limit(parseInt(limit))
      .skip(parseInt(skip))
      .sort({ createdAt: -1 });
    
    const totalUsers = await User.countDocuments(filter);
    
    res.json({
      users: users.map(user => ({
        id: user._id,
        name: user.name,
        govtID: user.govtID,
        role: user.role,
        createdAt: user.createdAt
      })),
      totalUsers,
      currentPage: Math.floor(skip / limit) + 1,
      totalPages: Math.ceil(totalUsers / limit)
    });
    
  } catch (error) {
    console.error('Users fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// DELETE /api/auth/users/:id - Delete user (admin only)
router.delete('/users/:id', verifyGovtIDAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    await User.findByIdAndDelete(id);
    
    console.log(`🗑️ User deleted by admin ${req.user.name}: ${user.name} (${user.govtID})`);
    
    res.json({
      message: 'User deleted successfully',
      deletedUser: {
        name: user.name,
        govtID: user.govtID,
        role: user.role
      }
    });
    
  } catch (error) {
    console.error('User deletion error:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

module.exports = router;