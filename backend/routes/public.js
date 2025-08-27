const express = require('express');
const { contract, retryContractCall } = require('../contract');
const { generateAnalytics } = require('../analytics/analytics');

const router = express.Router();

// GET /api/candidates - Get list of candidates
router.get('/candidates', async (req, res) => {
  try {
    console.log('Fetching candidates from contract...');
    const candidates = await retryContractCall(() => contract.getCandidates());
    
    res.json({
      candidates: candidates,
      count: candidates.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching candidates:', error);
    res.status(500).json({ 
      error: 'Failed to fetch candidates',
      details: error.message 
    });
  }
});

// GET /api/status - Get election status and timing
router.get('/status', async (req, res) => {
  try {
    console.log('Fetching election status...');
    
    // Fetch all status data in parallel
    const [isActive, timeLeft, endTime, electionEnded] = await Promise.all([
      retryContractCall(() => contract.isElectionActive()),
      retryContractCall(() => contract.timeLeft()),
      retryContractCall(() => contract.electionEndTime()),
      retryContractCall(() => contract.electionEnded())
    ]);

    const timeLeftNumber = Number(timeLeft);
    const endTimeNumber = Number(endTime);
    
    res.json({
      electionActive: isActive,
      electionEnded: electionEnded,
      timeLeftSeconds: timeLeftNumber,
      electionEndTime: endTimeNumber,
      currentTime: Math.floor(Date.now() / 1000),
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching election status:', error);
    res.status(500).json({ 
      error: 'Failed to fetch election status',
      details: error.message 
    });
  }
});

// GET /api/results - Get voting results and winner
router.get('/results', async (req, res) => {
  try {
    console.log('Fetching election results...');
    
    // Get candidates first
    const candidates = await retryContractCall(() => contract.getCandidates());
    const totalVotes = await retryContractCall(() => contract.totalVotes());
    const totalVotesNumber = Number(totalVotes);
    
    // Get vote counts and percentages for each candidate
    const votes = [];
    const votesCountPromises = candidates.map((_, index) => 
      retryContractCall(() => contract.getVotesFor(index))
    );
    const percentagePromises = candidates.map((_, index) => 
      retryContractCall(() => contract.getVotePercentage(index))
    );
    
    const [votesCounts, percentages] = await Promise.all([
      Promise.all(votesCountPromises),
      Promise.all(percentagePromises)
    ]);
    
    // Build votes array
    for (let i = 0; i < candidates.length; i++) {
      votes.push({
        candidate: candidates[i],
        votes: Number(votesCounts[i]),
        percentage: Number(percentages[i]),
        index: i
      });
    }
    
    // Get winner (if election has votes)
    let winner = null;
    if (totalVotesNumber > 0) {
      try {
        const [winnerName, winnerVotes] = await retryContractCall(() => contract.getWinner());
        const winnerVotesNumber = Number(winnerVotes);
        const winnerPercentage = totalVotesNumber > 0 ? 
          Math.round((winnerVotesNumber / totalVotesNumber) * 100) : 0;
        
        winner = {
          name: winnerName,
          votes: winnerVotesNumber,
          percentage: winnerPercentage
        };
      } catch (error) {
        console.warn('Could not fetch winner (possibly no votes yet):', error.message);
      }
    }
    
    // Sort votes by vote count (descending)
    votes.sort((a, b) => b.votes - a.votes);
    
    res.json({
      totalVotes: totalVotesNumber,
      votes: votes,
      winner: winner,
      raw: {
        votesCount: votesCounts.map(v => Number(v)),
        totalVotes: totalVotesNumber
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching results:', error);
    res.status(500).json({ 
      error: 'Failed to fetch results',
      details: error.message 
    });
  }
});

// GET /api/candidate/:index/analytics - Get analytics for specific candidate
router.get('/candidate/:index/analytics', async (req, res) => {
  try {
    const candidateIndex = parseInt(req.params.index);
    
    if (isNaN(candidateIndex) || candidateIndex < 0) {
      return res.status(400).json({ error: 'Invalid candidate index' });
    }
    
    console.log(`Fetching analytics for candidate ${candidateIndex}...`);
    
    // Get candidate data
    const [candidates, candidateVotes, candidatePercentage, totalVotes] = await Promise.all([
      retryContractCall(() => contract.getCandidates()),
      retryContractCall(() => contract.getVotesFor(candidateIndex)),
      retryContractCall(() => contract.getVotePercentage(candidateIndex)),
      retryContractCall(() => contract.totalVotes())
    ]);
    
    if (candidateIndex >= candidates.length) {
      return res.status(404).json({ error: 'Candidate not found' });
    }
    
    const candidateName = candidates[candidateIndex];
    const votes = Number(candidateVotes);
    const percentage = Number(candidatePercentage);
    const totalVotesNumber = Number(totalVotes);
    
    // Get narrative from contract (if available)
    let narrative = '';
    try {
      narrative = await retryContractCall(() => contract.getCandidateAnalytics(candidateIndex));
    } catch (error) {
      console.warn('Could not fetch candidate narrative:', error.message);
      // Generate fallback narrative
      if (totalVotesNumber > 0) {
        const position = votes === 0 ? 'last' : percentage > 50 ? 'first' : percentage > 30 ? 'second' : 'third';
        narrative = `${candidateName} is currently in ${position} place with ${percentage}% of the vote (${votes} votes out of ${totalVotesNumber} total).`;
      } else {
        narrative = `${candidateName} has not received any votes yet.`;
      }
    }
    
    // Calculate competitive metrics
    let trailingByVotes = 0;
    let leadingByPercent = 0;
    
    if (totalVotesNumber > 0) {
      // Get all candidates' votes to calculate margins
      const allVotesPromises = candidates.map((_, index) => 
        retryContractCall(() => contract.getVotesFor(index))
      );
      const allVotes = await Promise.all(allVotesPromises);
      const allVotesNumbers = allVotes.map(v => Number(v));
      
      const maxVotes = Math.max(...allVotesNumbers);
      trailingByVotes = maxVotes - votes;
      
      if (votes === maxVotes) {
        // This candidate is leading
        const secondHighest = Math.max(...allVotesNumbers.filter(v => v !== maxVotes));
        leadingByPercent = totalVotesNumber > 0 ? 
          Math.round(((votes - secondHighest) / totalVotesNumber) * 100) : 0;
      }
    }
    
    res.json({
      candidate: candidateName,
      index: candidateIndex,
      votes: votes,
      percentage: percentage,
      narrative: narrative,
      trailingByVotes: trailingByVotes,
      leadingByPercent: leadingByPercent,
      totalVotes: totalVotesNumber,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching candidate analytics:', error);
    res.status(500).json({ 
      error: 'Failed to fetch candidate analytics',
      details: error.message 
    });
  }
});

module.exports = router;