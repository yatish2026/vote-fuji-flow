const jwt = require('jsonwebtoken');
const User = require('../models/User');

const JWT_SECRET = process.env.JWT_SECRET || 'avalanche-voting-secret-key-change-in-production';

// Middleware to verify Govt ID authentication
const verifyGovtIDAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No authorization token provided' });
    }
    
    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Find user in database
    const user = await User.findById(decoded.userId);
    if (!user) {
      return res.status(401).json({ error: 'Invalid token - user not found' });
    }
    
    req.user = user;
    next();
  } catch (error) {
    console.error('Govt ID Auth verification failed:', error.message);
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

// Middleware to verify admin role (for Govt ID users)
const verifyGovtIDAdmin = async (req, res, next) => {
  try {
    await verifyGovtIDAuth(req, res, () => {
      if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Access denied: Admin role required' });
      }
      next();
    });
  } catch (error) {
    return res.status(401).json({ error: 'Authentication failed' });
  }
};

// Middleware to verify voter role (for Govt ID users)
const verifyGovtIDVoter = async (req, res, next) => {
  try {
    await verifyGovtIDAuth(req, res, () => {
      if (req.user.role !== 'voter') {
        return res.status(403).json({ error: 'Access denied: Voter role required' });
      }
      next();
    });
  } catch (error) {
    return res.status(401).json({ error: 'Authentication failed' });
  }
};

module.exports = {
  verifyGovtIDAuth,
  verifyGovtIDAdmin,
  verifyGovtIDVoter
};