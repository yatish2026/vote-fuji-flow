const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../server');
const User = require('../models/User');

// Test database URL (use a separate test database)
const TEST_DB_URI = process.env.TEST_MONGO_URI || 'mongodb://localhost:27017/avalanche-voting-test';

describe('Government ID Authentication', () => {
  let testUser;
  let authToken;

  beforeAll(async () => {
    // Connect to test database
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(TEST_DB_URI);
    }
  });

  beforeEach(async () => {
    // Clean up database before each test
    await User.deleteMany({});
  });

  afterAll(async () => {
    // Clean up and close database connection
    await User.deleteMany({});
    await mongoose.connection.close();
  });

  describe('POST /api/auth/register', () => {
    it('should register a new voter successfully', async () => {
      const userData = {
        name: 'Test Voter',
        govtID: 'VOTER123456',
        role: 'voter'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(201);

      expect(response.body.message).toContain('registered successfully');
      expect(response.body.user.name).toBe(userData.name);
      expect(response.body.user.govtID).toBe(userData.govtID);
      expect(response.body.user.role).toBe(userData.role);
    });

    it('should register a new admin successfully', async () => {
      const userData = {
        name: 'Test Admin',
        govtID: 'ADMIN123456',
        role: 'admin'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(201);

      expect(response.body.message).toContain('Admin registered successfully');
      expect(response.body.user.role).toBe('admin');
    });

    it('should reject duplicate Government ID', async () => {
      const userData = {
        name: 'Test User 1',
        govtID: 'DUPLICATE123',
        role: 'voter'
      };

      // First registration
      await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(201);

      // Second registration with same govtID
      const duplicateUser = {
        name: 'Test User 2',
        govtID: 'DUPLICATE123',
        role: 'voter'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(duplicateUser)
        .expect(409);

      expect(response.body.error).toContain('already exists');
    });

    it('should validate required fields', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({})
        .expect(400);

      expect(response.body.error).toContain('required');
    });

    it('should validate Government ID format', async () => {
      const userData = {
        name: 'Test User',
        govtID: '123', // Too short
        role: 'voter'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(400);

      expect(response.body.error).toContain('between 5-50 characters');
    });

    it('should validate role field', async () => {
      const userData = {
        name: 'Test User',
        govtID: 'VALID123456',
        role: 'invalid_role'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(400);

      expect(response.body.error).toContain('voter" or "admin');
    });
  });

  describe('POST /api/auth/login', () => {
    beforeEach(async () => {
      // Create a test user
      testUser = new User({
        name: 'Test User',
        govtID: 'LOGIN123456',
        role: 'voter'
      });
      await testUser.save();
    });

    it('should login successfully with valid Government ID', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ govtID: 'LOGIN123456' })
        .expect(200);

      expect(response.body.message).toBe('Login successful');
      expect(response.body.token).toBeDefined();
      expect(response.body.user.govtID).toBe('LOGIN123456');
      expect(response.body.expiresIn).toBe(86400);

      authToken = response.body.token;
    });

    it('should reject invalid Government ID', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ govtID: 'INVALID123456' })
        .expect(401);

      expect(response.body.error).toContain('not found');
    });

    it('should validate Government ID format on login', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ govtID: '123' }) // Too short
        .expect(400);

      expect(response.body.error).toContain('between 5-50 characters');
    });
  });

  describe('GET /api/auth/profile', () => {
    beforeEach(async () => {
      // Create test user and get auth token
      testUser = new User({
        name: 'Profile Test User',
        govtID: 'PROFILE123456',
        role: 'voter'
      });
      await testUser.save();

      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({ govtID: 'PROFILE123456' });

      authToken = loginResponse.body.token;
    });

    it('should return user profile with valid token', async () => {
      const response = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.user.name).toBe('Profile Test User');
      expect(response.body.user.govtID).toBe('PROFILE123456');
      expect(response.body.user.role).toBe('voter');
    });

    it('should reject request without token', async () => {
      const response = await request(app)
        .get('/api/auth/profile')
        .expect(401);

      expect(response.body.error).toContain('authorization token');
    });

    it('should reject request with invalid token', async () => {
      const response = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', 'Bearer invalid_token')
        .expect(401);

      expect(response.body.error).toContain('Invalid or expired token');
    });
  });

  describe('Admin Routes', () => {
    let adminToken;

    beforeEach(async () => {
      // Create admin user
      const adminUser = new User({
        name: 'Test Admin',
        govtID: 'ADMINTEST123',
        role: 'admin'
      });
      await adminUser.save();

      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({ govtID: 'ADMINTEST123' });

      adminToken = loginResponse.body.token;

      // Create some test voters
      await User.create([
        { name: 'Voter 1', govtID: 'VOTER001', role: 'voter' },
        { name: 'Voter 2', govtID: 'VOTER002', role: 'voter' }
      ]);
    });

    it('should allow admin to get all users', async () => {
      const response = await request(app)
        .get('/api/auth/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.users).toHaveLength(3); // 2 voters + 1 admin
      expect(response.body.totalUsers).toBe(3);
    });

    it('should allow admin to filter users by role', async () => {
      const response = await request(app)
        .get('/api/auth/users?role=voter')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.users).toHaveLength(2);
      expect(response.body.users.every(u => u.role === 'voter')).toBe(true);
    });

    it('should deny non-admin access to user list', async () => {
      // Create voter user
      const voterUser = new User({
        name: 'Non Admin',
        govtID: 'NONADMIN123',
        role: 'voter'
      });
      await voterUser.save();

      const voterLogin = await request(app)
        .post('/api/auth/login')
        .send({ govtID: 'NONADMIN123' });

      const response = await request(app)
        .get('/api/auth/users')
        .set('Authorization', `Bearer ${voterLogin.body.token}`)
        .expect(403);

      expect(response.body.error).toContain('Admin role required');
    });
  });

  describe('Rate Limiting', () => {
    it('should apply rate limiting to registration', async () => {
      const userData = {
        name: 'Rate Limit Test',
        govtID: 'RATE123456',
        role: 'voter'
      };

      // Make multiple rapid requests (rate limit is 3 per minute for registration)
      const promises = Array(5).fill(null).map((_, i) => 
        request(app)
          .post('/api/auth/register')
          .send({
            ...userData,
            govtID: `RATE${i}${Date.now()}`
          })
      );

      const responses = await Promise.all(promises);
      
      // Some requests should be rate limited
      const rateLimited = responses.filter(r => r.status === 429);
      expect(rateLimited.length).toBeGreaterThan(0);
    });
  });
});

console.log('🧪 Government ID Authentication Tests Ready');