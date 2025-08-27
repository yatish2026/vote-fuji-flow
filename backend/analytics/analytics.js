const { contract, retryContractCall } = require('../contract');

// Generate comprehensive analytics data
const generateAnalytics = async () => {
  try {
    console.log('Generating comprehensive analytics...');
    
    // Fetch basic election data
    const [candidates, totalVotes, isActive, winner] = await Promise.all([
      retryContractCall(() => contract.getCandidates()),
      retryContractCall(() => contract.totalVotes()),
      retryContractCall(() => contract.isElectionActive()),
      fetchWinner()
    ]);
    
    const totalVotesNumber = Number(totalVotes);
    
    // Get detailed vote data for each candidate
    const votes = [];
    for (let i = 0; i < candidates.length; i++) {
      const [candidateVotes, percentage] = await Promise.all([
        retryContractCall(() => contract.getVotesFor(i)),
        retryContractCall(() => contract.getVotePercentage(i))
      ]);
      
      votes.push({
        candidate: candidates[i],
        votes: Number(candidateVotes),
        percentage: Number(percentage),
        index: i
      });
    }
    
    // Sort by votes (descending)
    votes.sort((a, b) => b.votes - a.votes);
    
    // Generate demographic analytics from demo data if available
    const demographics = generateDemographicAnalytics(votes, totalVotesNumber);
    
    // Generate insights and narratives
    const insights = generateInsights(votes, totalVotesNumber, winner);
    
    return {
      totalVotes: totalVotesNumber,
      votes: votes,
      winner: winner,
      demographics: demographics,
      insights: insights,
      electionActive: isActive,
      chartData: {
        bar: votes.map(v => ({ label: v.candidate, value: v.votes })),
        pie: votes.map(v => ({ name: v.candidate, value: v.votes })),
        percentage: votes.map(v => ({ candidate: v.candidate, percentage: v.percentage }))
      },
      timestamp: new Date().toISOString()
    };
    
  } catch (error) {
    console.error('Error generating analytics:', error);
    throw error;
  }
};

// Fetch winner safely
const fetchWinner = async () => {
  try {
    const totalVotes = await retryContractCall(() => contract.totalVotes());
    if (Number(totalVotes) === 0) {
      return null;
    }
    
    const [winnerName, winnerVotes] = await retryContractCall(() => contract.getWinner());
    const winnerVotesNumber = Number(winnerVotes);
    const totalVotesNumber = Number(totalVotes);
    
    return {
      name: winnerName,
      votes: winnerVotesNumber,
      percentage: totalVotesNumber > 0 ? Math.round((winnerVotesNumber / totalVotesNumber) * 100) : 0
    };
  } catch (error) {
    console.warn('Could not fetch winner:', error.message);
    return null;
  }
};

// Generate demographic analytics from demo data
const generateDemographicAnalytics = (votes, totalVotes) => {
  // Use demo data if available, otherwise generate sample data
  const demoData = global.demoData || generateDemoData(totalVotes);
  
  // Age group analysis
  const ageGroups = {};
  const genderRatio = {};
  const locations = {};
  
  demoData.forEach(record => {
    // Age groups
    const ageGroup = getAgeGroup(record.age);
    ageGroups[ageGroup] = (ageGroups[ageGroup] || 0) + 1;
    
    // Gender distribution
    genderRatio[record.gender] = (genderRatio[record.gender] || 0) + 1;
    
    // Location distribution
    locations[record.location] = (locations[record.location] || 0) + 1;
  });
  
  return {
    ageGroups: Object.entries(ageGroups).map(([ageGroup, count]) => ({
      ageGroup,
      count
    })),
    genderRatio: Object.entries(genderRatio).map(([gender, count]) => ({
      gender,
      count
    })),
    locations: Object.entries(locations)
      .map(([location, count]) => ({ location, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10) // Top 10 locations
  };
};

// Generate demo data for analytics
const generateDemoData = (totalVotes) => {
  const candidates = ['Modi', 'Gandhi', 'Kejriwal']; // Simplified names for demo
  const locations = [
    'Mumbai', 'Delhi', 'Bangalore', 'Hyderabad', 'Chennai', 
    'Kolkata', 'Pune', 'Ahmedabad', 'Jaipur', 'Surat',
    'Lucknow', 'Kanpur', 'Nagpur', 'Indore', 'Bhopal'
  ];
  const genders = ['Male', 'Female', 'Other'];
  
  const demoData = [];
  
  for (let i = 0; i < totalVotes; i++) {
    const voterAddress = `0x${Math.random().toString(16).substr(2, 40)}`;
    const age = Math.floor(Math.random() * 60) + 18; // 18-78 years
    const gender = genders[Math.floor(Math.random() * genders.length)];
    const location = locations[Math.floor(Math.random() * locations.length)];
    const candidateVoted = Math.floor(Math.random() * candidates.length);
    const timestamp = new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000); // Last 7 days
    
    demoData.push({
      voter_address: voterAddress,
      candidate_voted: candidateVoted,
      age: age,
      gender: gender,
      location: location,
      timestamp: timestamp.toISOString()
    });
  }
  
  return demoData;
};

// Determine age group from age
const getAgeGroup = (age) => {
  if (age >= 18 && age <= 25) return '18-25';
  if (age >= 26 && age <= 35) return '26-35';
  if (age >= 36 && age <= 50) return '36-50';
  return '50+';
};

// Generate insights and narratives
const generateInsights = (votes, totalVotes, winner) => {
  const insights = [];
  
  if (totalVotes === 0) {
    insights.push({
      type: 'info',
      title: 'No Votes Yet',
      message: 'The election is active but no votes have been cast yet.'
    });
    return insights;
  }
  
  // Winner insight
  if (winner) {
    insights.push({
      type: 'success',
      title: 'Current Leader',
      message: `${winner.name} is currently leading with ${winner.percentage}% of votes (${winner.votes} out of ${totalVotes} total votes).`
    });
  }
  
  // Participation insight
  insights.push({
    type: 'info',
    title: 'Voter Participation',
    message: `${totalVotes} voters have participated in this election so far.`
  });
  
  // Competition analysis
  if (votes.length >= 2) {
    const leader = votes[0];
    const runnerUp = votes[1];
    const margin = leader.votes - runnerUp.votes;
    const marginPercent = leader.percentage - runnerUp.percentage;
    
    if (marginPercent < 5) {
      insights.push({
        type: 'warning',
        title: 'Close Race',
        message: `The race is very close! ${leader.candidate} leads ${runnerUp.candidate} by only ${margin} votes (${marginPercent.toFixed(1)}%).`
      });
    } else if (marginPercent > 30) {
      insights.push({
        type: 'info',
        title: 'Decisive Lead',
        message: `${leader.candidate} has a commanding lead with a ${marginPercent.toFixed(1)}% margin over the nearest competitor.`
      });
    }
  }
  
  // Turnout analysis
  if (totalVotes < 10) {
    insights.push({
      type: 'warning',
      title: 'Low Turnout',
      message: 'Voter turnout is currently low. Encourage more participants to vote!'
    });
  } else if (totalVotes > 100) {
    insights.push({
      type: 'success',
      title: 'High Participation',
      message: 'Excellent voter turnout! The election has strong community participation.'
    });
  }
  
  return insights;
};

// Generate candidate-specific analytics
const generateCandidateAnalytics = async (candidateIndex) => {
  try {
    const [candidates, candidateVotes, totalVotes] = await Promise.all([
      retryContractCall(() => contract.getCandidates()),
      retryContractCall(() => contract.getVotesFor(candidateIndex)),
      retryContractCall(() => contract.totalVotes())
    ]);
    
    if (candidateIndex >= candidates.length) {
      throw new Error('Candidate not found');
    }
    
    const candidateName = candidates[candidateIndex];
    const votes = Number(candidateVotes);
    const totalVotesNumber = Number(totalVotes);
    const percentage = totalVotesNumber > 0 ? Math.round((votes / totalVotesNumber) * 100) : 0;
    
    // Generate narrative
    let narrative = '';
    if (totalVotesNumber === 0) {
      narrative = `${candidateName} has not received any votes yet as the election just started.`;
    } else if (percentage === 0) {
      narrative = `${candidateName} has not received any votes yet out of ${totalVotesNumber} total votes cast.`;
    } else if (percentage > 50) {
      narrative = `${candidateName} is leading decisively with ${percentage}% of votes (${votes} out of ${totalVotesNumber}).`;
    } else if (percentage > 30) {
      narrative = `${candidateName} is performing well with ${percentage}% of the vote share (${votes} votes).`;
    } else if (percentage > 10) {
      narrative = `${candidateName} has ${percentage}% of votes (${votes} votes) and is competing actively.`;
    } else {
      narrative = `${candidateName} currently has ${percentage}% of votes (${votes} votes) and may need to increase outreach.`;
    }
    
    return {
      candidate: candidateName,
      votes: votes,
      percentage: percentage,
      narrative: narrative,
      totalVotes: totalVotesNumber
    };
    
  } catch (error) {
    console.error('Error generating candidate analytics:', error);
    throw error;
  }
};

module.exports = {
  generateAnalytics,
  generateCandidateAnalytics,
  generateDemoData,
  generateDemographicAnalytics
};