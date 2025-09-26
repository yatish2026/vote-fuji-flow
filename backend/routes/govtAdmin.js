const express = require('express');
const { verifyGovtIDAdmin } = require('../middleware/auth');
const { contract, retryContractCall } = require('../contract');
const { generateAnalytics } = require('../analytics/analytics');
const User = require('../models/User');

const router = express.Router();

// GET /api/govt-admin/analytics - Get comprehensive analytics (Govt ID admin only)
router.get('/analytics', verifyGovtIDAdmin, async (req, res) => {
  try {
    console.log(`Govt ID Admin analytics requested by: ${req.user.name} (${req.user.govtID})`);
    
    const analytics = await generateAnalytics();
    
    res.json({
      ...analytics,
      requestedBy: {
        name: req.user.name,
        govtID: req.user.govtID,
        authType: 'govtID'
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error generating analytics:', error);
    res.status(500).json({ 
      error: 'Failed to generate analytics',
      details: error.message 
    });
  }
});

// GET /api/govt-admin/dashboard - Get admin dashboard data
router.get('/dashboard', verifyGovtIDAdmin, async (req, res) => {
  try {
    console.log(`Admin dashboard requested by: ${req.user.name}`);
    
    // Get blockchain election data
    const [isActive, totalVotes, candidates] = await Promise.all([
      retryContractCall(() => contract.isElectionActive()),
      retryContractCall(() => contract.totalVotes()),
      retryContractCall(() => contract.getCandidates())
    ]);
    
    // Get user statistics from MongoDB
    const [totalUsers, totalVoters, totalAdmins] = await Promise.all([
      User.countDocuments({}),
      User.countDocuments({ role: 'voter' }),
      User.countDocuments({ role: 'admin' })
    ]);
    
    // Get recent registrations
    const recentUsers = await User.find({})
      .sort({ createdAt: -1 })
      .limit(10)
      .select('name govtID role createdAt');
    
    res.json({
      election: {
        isActive,
        totalVotes: Number(totalVotes),
        candidatesCount: candidates.length,
        candidates
      },
      users: {
        total: totalUsers,
        voters: totalVoters,
        admins: totalAdmins,
        recent: recentUsers
      },
      admin: {
        name: req.user.name,
        govtID: req.user.govtID,
        loginTime: new Date().toISOString()
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Error fetching admin dashboard:', error);
    res.status(500).json({ 
      error: 'Failed to fetch dashboard data',
      details: error.message 
    });
  }
});

// POST /api/govt-admin/manage-election - Election management actions
router.post('/manage-election', verifyGovtIDAdmin, async (req, res) => {
  try {
    const { action } = req.body;
    
    console.log(`Election management action '${action}' by: ${req.user.name}`);
    
    switch (action) {
      case 'status':
        const [isActive, timeLeft, electionEnded] = await Promise.all([
          retryContractCall(() => contract.isElectionActive()),
          retryContractCall(() => contract.timeLeft()),
          retryContractCall(() => contract.electionEnded())
        ]);
        
        res.json({
          action: 'status',
          election: {
            isActive,
            timeLeft: Number(timeLeft),
            electionEnded
          },
          message: 'Election status retrieved successfully'
        });
        break;
        
      case 'end':
        // Note: This should be handled via wallet interaction in frontend
        // Backend can provide transaction data but not execute it
        res.json({
          action: 'end',
          message: 'Election end must be executed via blockchain wallet',
          instruction: 'Use your Core Wallet to call contract.endElection() function',
          requiredRole: 'Contract admin'
        });
        break;
        
      default:
        res.status(400).json({ error: 'Invalid action. Supported actions: status, end' });
    }
    
  } catch (error) {
    console.error('Error managing election:', error);
    res.status(500).json({ 
      error: 'Election management failed',
      details: error.message 
    });
  }
});

// GET /api/govt-admin/voter-analytics - Get voter statistics
router.get('/voter-analytics', verifyGovtIDAdmin, async (req, res) => {
  try {
    console.log(`Voter analytics requested by: ${req.user.name}`);
    
    // Get user registration trends (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const registrationTrends = await User.aggregate([
      {
        $match: {
          createdAt: { $gte: thirtyDaysAgo }
        }
      },
      {
        $group: {
          _id: {
            date: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
            role: "$role"
          },
          count: { $sum: 1 }
        }
      },
      {
        $sort: { "_id.date": 1 }
      }
    ]);
    
    // Get role distribution
    const roleDistribution = await User.aggregate([
      {
        $group: {
          _id: "$role",
          count: { $sum: 1 }
        }
      }
    ]);
    
    res.json({
      registrationTrends,
      roleDistribution,
      period: '30 days',
      requestedBy: req.user.name,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Error fetching voter analytics:', error);
    res.status(500).json({ 
      error: 'Failed to fetch voter analytics',
      details: error.message 
    });
  }
});

// POST /api/govt-admin/bulk-actions - Bulk user management actions
router.post('/bulk-actions', verifyGovtIDAdmin, async (req, res) => {
  try {
    const { action, userIds, filters } = req.body;
    
    console.log(`Bulk action '${action}' requested by: ${req.user.name}`);
    
    if (!action) {
      return res.status(400).json({ error: 'Action is required' });
    }
    
    let result;
    
    switch (action) {
      case 'count':
        const filter = {};
        if (filters?.role) filter.role = filters.role;
        
        result = await User.countDocuments(filter);
        res.json({
          action: 'count',
          count: result,
          filters,
          message: `Found ${result} users matching criteria`
        });
        break;
        
      case 'list':
        const listFilter = {};
        if (filters?.role) listFilter.role = filters.role;
        
        const users = await User.find(listFilter)
          .select('name govtID role createdAt')
          .limit(100)
          .sort({ createdAt: -1 });
          
        res.json({
          action: 'list',
          users,
          count: users.length,
          filters,
          message: `Listed ${users.length} users`
        });
        break;
        
      default:
        res.status(400).json({ error: 'Invalid bulk action' });
    }
    
  } catch (error) {
    console.error('Error performing bulk action:', error);
    res.status(500).json({ 
      error: 'Bulk action failed',
      details: error.message 
    });
  }
});

module.exports = router;