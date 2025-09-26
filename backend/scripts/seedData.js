const mongoose = require('mongoose');
const User = require('../models/User');
require('dotenv').config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://shaikafiya9676:Afiya%40123456@cluster0.pqnhf.mongodb.net/conferenceDB';

const seedUsers = [
  // Sample Voters
  {
    name: 'Alice Johnson',
    govtID: 'VOTER001',
    role: 'voter'
  },
  {
    name: 'Bob Smith',
    govtID: 'VOTER002', 
    role: 'voter'
  },
  {
    name: 'Carol Williams',
    govtID: 'VOTER003',
    role: 'voter'
  },
  {
    name: 'David Brown',
    govtID: 'VOTER004',
    role: 'voter'
  },
  {
    name: 'Emma Davis',
    govtID: 'VOTER005',
    role: 'voter'
  },
  
  // Sample Admins
  {
    name: 'Admin User',
    govtID: 'ADMIN001',
    role: 'admin'
  },
  {
    name: 'Election Manager',
    govtID: 'ADMIN002',
    role: 'admin'
  }
];

const seedDatabase = async () => {
  try {
    console.log('🌱 Connecting to MongoDB...');
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB');

    // Clear existing data
    console.log('🧹 Clearing existing users...');
    await User.deleteMany({});

    // Insert seed data
    console.log('📝 Inserting seed users...');
    const createdUsers = await User.insertMany(seedUsers);

    console.log(`✅ Successfully created ${createdUsers.length} users:`);
    createdUsers.forEach(user => {
      console.log(`   - ${user.name} (${user.role}): ${user.govtID}`);
    });

    console.log('\n🧪 Test the system with these credentials:');
    console.log('   Voters: VOTER001, VOTER002, VOTER003, VOTER004, VOTER005');
    console.log('   Admins: ADMIN001, ADMIN002');
    
    console.log('\n📋 Example API calls:');
    console.log('curl -X POST http://localhost:3001/api/auth/login \\');
    console.log('  -H "Content-Type: application/json" \\');
    console.log('  -d \'{"govtID": "VOTER001"}\'');
    
    console.log('\ncurl -X POST http://localhost:3001/api/auth/login \\');
    console.log('  -H "Content-Type: application/json" \\');
    console.log('  -d \'{"govtID": "ADMIN001"}\'');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding database:', error);
    process.exit(1);
  }
};

// Run if called directly
if (require.main === module) {
  seedDatabase();
}

module.exports = { seedUsers, seedDatabase };