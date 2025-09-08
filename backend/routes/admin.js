const express = require('express');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { ethers } = require('ethers');
const { contract, retryContractCall, getSigner } = require('../contract');
const { generateAnalytics, generateDemoData } = require('../analytics/analytics');

const router = express.Router();

// In-memory storage for nonces (in production, use Redis)
const nonces = new Map();
const JWT_SECRET = process.env.JWT_SECRET || 'avalanche-voting-secret-key-change-in-production';

// Middleware to verify admin JWT token
const verifyAdminToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No valid authorization token provided' });
  }
  
  const token = authHeader.substring(7);
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.admin = decoded;
    next();
  } catch (error) {
    console.error('Token verification failed:', error.message);
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

// Rate limiting for sensitive endpoints
const rateLimitMap = new Map();
const rateLimit = (windowMs = 60000, maxRequests = 10) => {
  return (req, res, next) => {
    const key = req.ip || 'unknown';
    const now = Date.now();
    
    if (!rateLimitMap.has(key)) {
      rateLimitMap.set(key, []);
    }
    
    const requests = rateLimitMap.get(key);
    const validRequests = requests.filter(time => now - time < windowMs);
    
    if (validRequests.length >= maxRequests) {
      return res.status(429).json({ error: 'Too many requests' });
    }
    
    validRequests.push(now);
    rateLimitMap.set(key, validRequests);
    next();
  };
};

// POST /api/admin/nonce - Generate nonce for signature
router.post('/nonce', rateLimit(60000, 5), (req, res) => {
  try {
    const nonce = crypto.randomBytes(32).toString('hex');
    const expiry = Date.now() + 300000; // 5 minutes
    
    nonces.set(nonce, { expiry, used: false });
    
    // Clean up expired nonces
    for (const [key, value] of nonces.entries()) {
      if (Date.now() > value.expiry) {
        nonces.delete(key);
      }
    }
    
    console.log(`Generated nonce for admin authentication: ${nonce.substring(0, 8)}...`);
    
    res.json({ 
      nonce,
      message: `Admin authentication nonce: ${nonce}`,
      expiresIn: 300 // seconds
    });
  } catch (error) {
    console.error('Error generating nonce:', error);
    res.status(500).json({ error: 'Failed to generate nonce' });
  }
});

// POST /api/admin/auth - Authenticate admin with signature
router.post('/auth', rateLimit(60000, 3), async (req, res) => {
  try {
    const { address, signature, nonce } = req.body;
    
    if (!address || !signature || !nonce) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    // Verify nonce
    const nonceData = nonces.get(nonce);
    if (!nonceData) {
      return res.status(400).json({ error: 'Invalid nonce' });
    }
    
    if (Date.now() > nonceData.expiry) {
      nonces.delete(nonce);
      return res.status(400).json({ error: 'Nonce expired' });
    }
    
    if (nonceData.used) {
      return res.status(400).json({ error: 'Nonce already used' });
    }
    
    // Mark nonce as used
    nonceData.used = true;
    
    // Verify signature
    const message = `Admin authentication nonce: ${nonce}`;
    const recoveredAddress = ethers.verifyMessage(message, signature);
    
    if (recoveredAddress.toLowerCase() !== address.toLowerCase()) {
      return res.status(401).json({ error: 'Invalid signature' });
    }
    
    // Check if address is admin (skip in demo mode for hackathon)
    const isDemoMode = process.env.DEMO_MODE === 'true';
    
    if (!isDemoMode) {
      const adminAddress = await retryContractCall(() => contract.admin());
      if (address.toLowerCase() !== adminAddress.toLowerCase()) {
        return res.status(403).json({ error: 'Access denied: Not admin address' });
      }
    } else {
      console.warn(`⚠️  DEMO MODE: Allowing admin access for address: ${address}`);
    }
    
    // Generate JWT token
    const token = jwt.sign(
      { 
        address: address.toLowerCase(), 
        role: 'admin',
        demoMode: isDemoMode,
        timestamp: Date.now()
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );
    
    // Clean up used nonce
    nonces.delete(nonce);
    
    console.log(`Admin authenticated: ${address}${isDemoMode ? ' (DEMO MODE)' : ''}`);
    
    res.json({ 
      token,
      address: address.toLowerCase(),
      demoMode: isDemoMode,
      expiresIn: 86400 // 24 hours in seconds
    });
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
});

// GET /api/admin/analytics - Get comprehensive analytics (admin only)
router.get('/analytics', verifyAdminToken, async (req, res) => {
  try {
    console.log(`Admin analytics requested by: ${req.admin.address}`);
    
    const analytics = await generateAnalytics();
    
    res.json({
      ...analytics,
      requestedBy: req.admin.address,
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

// GET /api/admin/voter/:address - Get voter information (admin only)
router.get('/voter/:address', verifyAdminToken, async (req, res) => {
  try {
    const voterAddress = req.params.address;
    
    if (!ethers.isAddress(voterAddress)) {
      return res.status(400).json({ error: 'Invalid address format' });
    }
    
    console.log(`Fetching voter info for: ${voterAddress}`);
    
    const [voterName, hasVoted] = await Promise.all([
      retryContractCall(() => contract.getVoterName(voterAddress)),
      retryContractCall(() => contract.hasVoted(voterAddress))
    ]);
    
    res.json({
      address: voterAddress.toLowerCase(),
      name: voterName || 'Not provided',
      hasVoted: hasVoted,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching voter info:', error);
    res.status(500).json({ 
      error: 'Failed to fetch voter information',
      details: error.message 
    });
  }
});

// POST /api/admin/end-election - End election (admin only)
router.post('/end-election', verifyAdminToken, async (req, res) => {
  try {
    console.log(`Election end requested by admin: ${req.admin.address}`);
    
    // Check if election is still active
    const isActive = await retryContractCall(() => contract.isElectionActive());
    if (!isActive) {
      return res.status(400).json({ error: 'Election is already ended' });
    }
    
    // For security, this endpoint expects the admin to handle the transaction client-side
    // We'll return the transaction data instead of executing it
    const signer = getSigner();
    if (!signer) {
      return res.status(400).json({ 
        error: 'Admin private key not configured. Please end election from frontend.',
        instruction: 'Use your wallet to call contract.endElection() directly'
      });
    }
    
    // If private key is available (development only), execute the transaction
    console.warn('WARNING: Using server-side private key for admin transaction. This should only be used in development!');
    
    const contractWithSigner = contract.connect(signer);
    const tx = await contractWithSigner.endElection();
    
    console.log(`Election end transaction submitted: ${tx.hash}`);
    
    res.json({
      message: 'Election end transaction submitted',
      transactionHash: tx.hash,
      status: 'pending'
    });
    
    // Wait for confirmation in background
    tx.wait().then(() => {
      console.log(`Election ended successfully. Transaction confirmed: ${tx.hash}`);
    }).catch(error => {
      console.error('Transaction failed:', error);
    });
    
  } catch (error) {
    console.error('Error ending election:', error);
    res.status(500).json({ 
      error: 'Failed to end election',
      details: error.message 
    });
  }
});

// GET /api/admin/export - Export results as CSV (admin only)
router.get('/export', verifyAdminToken, async (req, res) => {
  try {
    console.log(`Results export requested by: ${req.admin.address}`);
    
    // Get comprehensive data for export
    const [candidates, totalVotes] = await Promise.all([
      retryContractCall(() => contract.getCandidates()),
      retryContractCall(() => contract.totalVotes())
    ]);
    
    const totalVotesNumber = Number(totalVotes);
    
    // Get vote data for each candidate
    const voteData = [];
    for (let i = 0; i < candidates.length; i++) {
      const [votes, percentage] = await Promise.all([
        retryContractCall(() => contract.getVotesFor(i)),
        retryContractCall(() => contract.getVotePercentage(i))
      ]);
      
      voteData.push({
        candidate: candidates[i],
        votes: Number(votes),
        percentage: Number(percentage)
      });
    }
    
    // Generate CSV content
    let csvContent = 'Candidate,Votes,Percentage\n';
    voteData.forEach(data => {
      csvContent += `"${data.candidate}",${data.votes},${data.percentage}%\n`;
    });
    
    csvContent += `\nTotal Votes,${totalVotesNumber},100%\n`;
    csvContent += `Export Date,${new Date().toISOString()}\n`;
    csvContent += `Exported By,${req.admin.address}\n`;
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="election-results.csv"');
    res.send(csvContent);
    
  } catch (error) {
    console.error('Error exporting results:', error);
    res.status(500).json({ 
      error: 'Failed to export results',
      details: error.message 
    });
  }
});

// POST /api/admin/upload-demo - Upload demo demographic data (admin only)
router.post('/upload-demo', verifyAdminToken, async (req, res) => {
  try {
    const { demoData } = req.body;
    
    if (!demoData || !Array.isArray(demoData)) {
      return res.status(400).json({ error: 'Invalid demo data format' });
    }
    
    console.log(`Demo data upload by admin: ${req.admin.address}, records: ${demoData.length}`);
    
    // Store demo data in memory (in production, use database)
    global.demoData = demoData;
    
    res.json({
      message: 'Demo data uploaded successfully',
      recordsCount: demoData.length,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Error uploading demo data:', error);
    res.status(500).json({ 
      error: 'Failed to upload demo data',
      details: error.message 
    });
  }
});

module.exports = router;