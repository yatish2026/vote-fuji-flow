const request = require('supertest');
const jwt = require('jsonwebtoken');

// Mock ethers before importing modules that use it
jest.mock('ethers', () => ({
  JsonRpcProvider: jest.fn(() => ({
    getBlockNumber: jest.fn(() => Promise.resolve(12345)),
  })),
  Contract: jest.fn(() => ({
    getCandidates: jest.fn(() => Promise.resolve(['Modi', 'Gandhi', 'Kejriwal'])),
    totalVotes: jest.fn(() => Promise.resolve(100)),
    isElectionActive: jest.fn(() => Promise.resolve(true)),
    timeLeft: jest.fn(() => Promise.resolve(3600)),
    electionEndTime: jest.fn(() => Promise.resolve(Math.floor(Date.now() / 1000) + 3600)),
    getVotesFor: jest.fn((index) => Promise.resolve([40, 35, 25][index] || 0)),
    getVotePercentage: jest.fn((index) => Promise.resolve([40, 35, 25][index] || 0)),
    getWinner: jest.fn(() => Promise.resolve(['Modi', 40])),
    admin: jest.fn(() => Promise.resolve('0x1234567890123456789012345678901234567890')),
    hasVoted: jest.fn(() => Promise.resolve(false)),
    getVoterName: jest.fn(() => Promise.resolve('Test Voter'))
  })),
  verifyMessage: jest.fn(() => '0x1234567890123456789012345678901234567890'),
  isAddress: jest.fn(() => true)
}));

const app = require('../server');

describe('Avalanche Voting API', () => {
  
  describe('Public Endpoints', () => {
    
    test('GET /api/health should return server status', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect(200);
      
      expect(response.body).toHaveProperty('status', 'ok');
      expect(response.body).toHaveProperty('network', 'avalanche-fuji');
      expect(response.body).toHaveProperty('timestamp');
    });
    
    test('GET /api/candidates should return candidates list', async () => {
      const response = await request(app)
        .get('/api/candidates')
        .expect(200);
      
      expect(response.body).toHaveProperty('candidates');
      expect(response.body.candidates).toEqual(['Modi', 'Gandhi', 'Kejriwal']);
      expect(response.body).toHaveProperty('count', 3);
    });
    
    test('GET /api/status should return election status', async () => {
      const response = await request(app)
        .get('/api/status')
        .expect(200);
      
      expect(response.body).toHaveProperty('electionActive', true);
      expect(response.body).toHaveProperty('timeLeftSeconds');
      expect(response.body).toHaveProperty('electionEndTime');
    });
    
    test('GET /api/results should return voting results', async () => {
      const response = await request(app)
        .get('/api/results')
        .expect(200);
      
      expect(response.body).toHaveProperty('totalVotes', 100);
      expect(response.body).toHaveProperty('votes');
      expect(response.body.votes).toHaveLength(3);
      expect(response.body).toHaveProperty('winner');
      expect(response.body.winner.name).toBe('Modi');
    });
    
    test('GET /api/candidate/:index/analytics should return candidate analytics', async () => {
      const response = await request(app)
        .get('/api/candidate/0/analytics')
        .expect(200);
      
      expect(response.body).toHaveProperty('candidate', 'Modi');
      expect(response.body).toHaveProperty('votes', 40);
      expect(response.body).toHaveProperty('percentage', 40);
      expect(response.body).toHaveProperty('narrative');
    });
    
    test('GET /api/candidate/invalid should return 400', async () => {
      await request(app)
        .get('/api/candidate/invalid/analytics')
        .expect(400);
    });
    
  });
  
  describe('Admin Authentication', () => {
    
    test('POST /api/admin/nonce should generate nonce', async () => {
      const response = await request(app)
        .post('/api/admin/nonce')
        .expect(200);
      
      expect(response.body).toHaveProperty('nonce');
      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('expiresIn', 300);
    });
    
    test('POST /api/admin/auth should authenticate admin', async () => {
      // First get a nonce
      const nonceResponse = await request(app)
        .post('/api/admin/nonce');
      
      const { nonce } = nonceResponse.body;
      
      const response = await request(app)
        .post('/api/admin/auth')
        .send({
          address: '0x1234567890123456789012345678901234567890',
          signature: 'mock-signature',
          nonce: nonce
        })
        .expect(200);
      
      expect(response.body).toHaveProperty('token');
      expect(response.body).toHaveProperty('address');
    });
    
    test('POST /api/admin/auth should reject invalid signature', async () => {
      const nonceResponse = await request(app)
        .post('/api/admin/nonce');
      
      const { nonce } = nonceResponse.body;
      
      // Mock ethers.verifyMessage to return different address
      const ethers = require('ethers');
      ethers.verifyMessage.mockReturnValueOnce('0xdifferentaddress');
      
      await request(app)
        .post('/api/admin/auth')
        .send({
          address: '0x1234567890123456789012345678901234567890',
          signature: 'invalid-signature',
          nonce: nonce
        })
        .expect(401);
    });
    
  });
  
  describe('Admin Protected Endpoints', () => {
    let adminToken;
    
    beforeAll(async () => {
      // Create a valid admin token
      adminToken = jwt.sign(
        { 
          address: '0x1234567890123456789012345678901234567890', 
          role: 'admin' 
        },
        process.env.JWT_SECRET || 'avalanche-voting-secret-key-change-in-production',
        { expiresIn: '1h' }
      );
    });
    
    test('GET /api/analytics should return analytics with valid token', async () => {
      const response = await request(app)
        .get('/api/analytics')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      
      expect(response.body).toHaveProperty('totalVotes');
      expect(response.body).toHaveProperty('votes');
      expect(response.body).toHaveProperty('demographics');
      expect(response.body).toHaveProperty('insights');
    });
    
    test('GET /api/analytics should reject invalid token', async () => {
      await request(app)
        .get('/api/analytics')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);
    });
    
    test('GET /api/analytics should reject missing token', async () => {
      await request(app)
        .get('/api/analytics')
        .expect(401);
    });
    
    test('GET /api/admin/voter/:address should return voter info', async () => {
      const response = await request(app)
        .get('/api/admin/voter/0x1234567890123456789012345678901234567890')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      
      expect(response.body).toHaveProperty('address');
      expect(response.body).toHaveProperty('name');
      expect(response.body).toHaveProperty('hasVoted');
    });
    
    test('GET /api/admin/export should return CSV', async () => {
      const response = await request(app)
        .get('/api/admin/export')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      
      expect(response.headers['content-type']).toContain('text/csv');
      expect(response.text).toContain('Candidate,Votes,Percentage');
    });
    
  });
  
  describe('Error Handling', () => {
    
    test('GET /api/nonexistent should return 404', async () => {
      await request(app)
        .get('/api/nonexistent')
        .expect(404);
    });
    
    test('Rate limiting should work', async () => {
      // Make multiple requests to trigger rate limiting
      const promises = Array(15).fill().map(() => 
        request(app).post('/api/admin/nonce')
      );
      
      const responses = await Promise.allSettled(promises);
      const rateLimited = responses.some(r => 
        r.status === 'fulfilled' && r.value.status === 429
      );
      
      expect(rateLimited).toBe(true);
    });
    
  });
  
});

describe('Analytics Module', () => {
  const { generateAnalytics } = require('../analytics/analytics');
  
  test('generateAnalytics should return comprehensive data', async () => {
    const analytics = await generateAnalytics();
    
    expect(analytics).toHaveProperty('totalVotes');
    expect(analytics).toHaveProperty('votes');
    expect(analytics).toHaveProperty('demographics');
    expect(analytics).toHaveProperty('insights');
    expect(analytics).toHaveProperty('chartData');
    expect(analytics.votes).toHaveLength(3);
    expect(analytics.demographics).toHaveProperty('ageGroups');
    expect(analytics.demographics).toHaveProperty('genderRatio');
    expect(analytics.demographics).toHaveProperty('locations');
  });
  
});