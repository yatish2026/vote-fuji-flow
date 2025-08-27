const { ethers } = require('ethers');
const { CONTRACT_ADDRESS, CONTRACT_ABI, FUJI_RPC_URL } = require('../contract');

// Integration test script for Avalanche Fuji connection
async function runIntegrationTests() {
  console.log('🚀 Starting Avalanche Voting Platform Integration Tests\n');
  
  try {
    // Test 1: RPC Connection
    console.log('1. Testing Avalanche Fuji RPC connection...');
    const provider = new ethers.JsonRpcProvider(FUJI_RPC_URL);
    const blockNumber = await provider.getBlockNumber();
    console.log(`   ✅ Connected to Avalanche Fuji - Latest Block: ${blockNumber}\n`);
    
    // Test 2: Contract Connection
    console.log('2. Testing smart contract connection...');
    const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);
    console.log(`   📋 Contract Address: ${CONTRACT_ADDRESS}\n`);
    
    // Test 3: Fetch Candidates
    console.log('3. Fetching candidates from contract...');
    const candidates = await contract.getCandidates();
    console.log(`   👥 Candidates: ${candidates.join(', ')}`);
    console.log(`   📊 Total Candidates: ${candidates.length}\n`);
    
    // Test 4: Election Status
    console.log('4. Checking election status...');
    const [isActive, timeLeft, endTime, totalVotes] = await Promise.all([
      contract.isElectionActive(),
      contract.timeLeft(),
      contract.electionEndTime(),
      contract.totalVotes()
    ]);
    
    console.log(`   🗳️  Election Active: ${isActive}`);
    console.log(`   ⏰ Time Left: ${timeLeft} seconds`);
    console.log(`   📅 End Time: ${new Date(Number(endTime) * 1000).toISOString()}`);
    console.log(`   🗳️  Total Votes: ${totalVotes}\n`);
    
    // Test 5: Vote Results
    console.log('5. Fetching vote results...');
    const results = [];
    for (let i = 0; i < candidates.length; i++) {
      const [votes, percentage] = await Promise.all([
        contract.getVotesFor(i),
        contract.getVotePercentage(i)
      ]);
      
      results.push({
        candidate: candidates[i],
        votes: Number(votes),
        percentage: Number(percentage)
      });
    }
    
    console.log('   📊 Current Results:');
    results.forEach(result => {
      console.log(`      ${result.candidate}: ${result.votes} votes (${result.percentage}%)`);
    });
    console.log('');
    
    // Test 6: Admin Address
    console.log('6. Fetching admin address...');
    const adminAddress = await contract.admin();
    console.log(`   👤 Admin Address: ${adminAddress}\n`);
    
    // Test 7: Winner (if votes exist)
    if (Number(totalVotes) > 0) {
      console.log('7. Fetching current winner...');
      try {
        const [winnerName, winnerVotes] = await contract.getWinner();
        console.log(`   🏆 Current Winner: ${winnerName} with ${winnerVotes} votes\n`);
      } catch (error) {
        console.log(`   ⚠️  Winner not available: ${error.message}\n`);
      }
    } else {
      console.log('7. No votes cast yet, skipping winner check\n');
    }
    
    // Test 8: API Endpoints Simulation
    console.log('8. Simulating API endpoint responses...');
    
    // Simulate /api/candidates
    const candidatesAPI = {
      candidates: candidates,
      count: candidates.length,
      timestamp: new Date().toISOString()
    };
    console.log('   GET /api/candidates:', JSON.stringify(candidatesAPI, null, 2), '\n');
    
    // Simulate /api/status
    const statusAPI = {
      electionActive: isActive,
      timeLeftSeconds: Number(timeLeft),
      electionEndTime: Number(endTime),
      currentTime: Math.floor(Date.now() / 1000)
    };
    console.log('   GET /api/status:', JSON.stringify(statusAPI, null, 2), '\n');
    
    // Simulate /api/results
    const resultsAPI = {
      totalVotes: Number(totalVotes),
      votes: results,
      winner: results.length > 0 ? results.reduce((max, r) => r.votes > max.votes ? r : max, results[0]) : null
    };
    console.log('   GET /api/results:', JSON.stringify(resultsAPI, null, 2), '\n');
    
    console.log('🎉 All integration tests passed successfully!');
    console.log('\n📋 Summary:');
    console.log(`   - RPC Connection: ✅ Connected to block ${blockNumber}`);
    console.log(`   - Contract: ✅ ${candidates.length} candidates found`);
    console.log(`   - Election Status: ${isActive ? '🟢 Active' : '🔴 Ended'}`);
    console.log(`   - Total Votes: ${totalVotes}`);
    console.log(`   - Admin: ${adminAddress.substring(0, 6)}...${adminAddress.substring(38)}`);
    
  } catch (error) {
    console.error('❌ Integration test failed:', error.message);
    console.error('\n🔍 Troubleshooting:');
    console.error('   1. Check if Avalanche Fuji RPC is accessible');
    console.error('   2. Verify contract address and ABI are correct');
    console.error('   3. Ensure the contract is deployed and accessible');
    console.error('   4. Check network connectivity');
    process.exit(1);
  }
}

// Run the tests
if (require.main === module) {
  runIntegrationTests().then(() => {
    console.log('\n✨ Integration tests completed successfully!');
    process.exit(0);
  }).catch(error => {
    console.error('\n💥 Integration tests failed:', error);
    process.exit(1);
  });
}

module.exports = { runIntegrationTests };