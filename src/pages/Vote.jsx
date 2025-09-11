import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { LanguageSelector } from '@/components/LanguageSelector';
import { VoiceControls } from '@/components/VoiceControls';
import { useSpeech } from '@/hooks/useSpeech';
import { Clock, Vote as VoteIcon, CheckCircle, Wallet, Shield, Zap, Globe, Activity } from 'lucide-react';
import { ethers } from 'ethers';
import { CONTRACT_ADDRESS, CONTRACT_ABI } from '../lib/contract';

const Vote = () => {
  const { t } = useTranslation();
  const { speak } = useSpeech();
  console.log('Vote component rendering...');
  const [candidates, setCandidates] = useState([]);
  const [status, setStatus] = useState(null);
  const [voterName, setVoterName] = useState('');
  const [hasVoted, setHasVoted] = useState(false);
  const [voting, setVoting] = useState(false);
  const [connected, setConnected] = useState(false);
  const [userAddress, setUserAddress] = useState('');
  const [timeLeft, setTimeLeft] = useState('');
  const { toast } = useToast();

  useEffect(() => {
    fetchCandidates();
    fetchElectionStatus();
    checkWalletConnection();
    
    const interval = setInterval(fetchElectionStatus, 10000); // Update every 10 seconds
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (status && status.timeLeftSeconds > 0) {
      const timer = setInterval(() => {
        const now = Math.floor(Date.now() / 1000);
        const remaining = status.electionEndTime - now;
        
        if (remaining <= 0) {
          setTimeLeft('Election Ended');
          return;
        }
        
        const hours = Math.floor(remaining / 3600);
        const minutes = Math.floor((remaining % 3600) / 60);
        const seconds = remaining % 60;
        
        setTimeLeft(`${hours}h ${minutes}m ${seconds}s`);
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [status]);

  const fetchCandidates = async () => {
    try {
      console.log('Fetching candidates...');
      const response = await fetch('/api/candidates');
      console.log('Candidates response:', response.status);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        console.error('Backend not responding - fetching candidates from contract');
        await fetchCandidatesFromContract();
        return;
      }
      
      const data = await response.json();
      const candidatesWithIndex = data.candidates.map((name, index) => ({
        name,
        index
      }));
      setCandidates(candidatesWithIndex);
    } catch (error) {
      console.error('Error fetching candidates:', error);
      await fetchCandidatesFromContract();
    }
  };

  const fetchCandidatesFromContract = async () => {
    try {
      console.log('Fetching candidates directly from contract...');
      if (window.ethereum) {
        const provider = new ethers.BrowserProvider(window.ethereum);
        const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);
        
        const candidateNames = await contract.getCandidates();
        const candidatesWithIndex = candidateNames.map((name, index) => ({
          name,
          index
        }));
        
        console.log('Contract candidates:', candidatesWithIndex);
        setCandidates(candidatesWithIndex);
      }
    } catch (error) {
      console.error('Error fetching candidates from contract:', error);
      toast({
        title: "Error",
        description: "Failed to fetch candidates from contract",
        variant: "destructive"
      });
    }
  };

  const fetchElectionStatus = async () => {
    try {
      console.log('Fetching election status...');
      const response = await fetch('/api/status');
      console.log('Status response:', response.status, response.headers.get('content-type'));
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        console.error('Backend not responding with JSON - likely not running');
        // Fallback: try to get status directly from contract
        await fetchStatusFromContract();
        return;
      }
      
      const data = await response.json();
      console.log('Status data:', data);
      setStatus(data);
    } catch (error) {
      console.error('Error fetching status:', error);
      // Fallback: try to get status directly from contract
      await fetchStatusFromContract();
    }
  };

  const fetchStatusFromContract = async () => {
    try {
      console.log('Fetching status directly from contract...');
      if (window.ethereum) {
        const provider = new ethers.BrowserProvider(window.ethereum);
        const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);
        
        const [isActive, timeLeft, endTime] = await Promise.all([
          contract.isElectionActive(),
          contract.timeLeft(),
          contract.electionEndTime()
        ]);
        
        const statusData = {
          electionActive: isActive,
          timeLeftSeconds: Number(timeLeft),
          electionEndTime: Number(endTime)
        };
        
        console.log('Contract status:', statusData);
        setStatus(statusData);
      }
    } catch (error) {
      console.error('Error fetching from contract:', error);
      toast({
        title: "Connection Error",
        description: "Unable to connect to the election contract. Please check your wallet connection.",
        variant: "destructive"
      });
    }
  };

  const checkWalletConnection = async () => {
    try {
      if (window.ethereum) {
        const provider = new ethers.BrowserProvider(window.ethereum);
        const accounts = await provider.listAccounts();
        
        if (accounts.length > 0) {
          setConnected(true);
          setUserAddress(accounts[0].address);
          checkVotingStatus(accounts[0].address);
        }
      }
    } catch (error) {
      console.error('Error checking wallet connection:', error);
    }
  };

  const connectWallet = async () => {
    try {
      if (!window.ethereum) {
        toast({
          title: "Wallet Required",
          description: "Please install MetaMask or Core Wallet",
          variant: "destructive"
        });
        return;
      }

      await window.ethereum.request({ method: 'eth_requestAccounts' });
      checkWalletConnection();
      toast({
        title: "Wallet Connected",
        description: "Successfully connected to your wallet",
        variant: "default"
      });
    } catch (error) {
      console.error('Error connecting wallet:', error);
      toast({
        title: "Connection Failed",
        description: "Failed to connect wallet",
        variant: "destructive"
      });
    }
  };

  const checkVotingStatus = async (address) => {
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);
      const voted = await contract.hasVoted(address);
      setHasVoted(voted);
    } catch (error) {
      console.error('Error checking voting status:', error);
    }
  };

  const handleVoiceCommand = (command) => {
    console.log('Voice command received:', command);
    
    if (command.startsWith('VOTE:')) {
      const candidateName = command.replace('VOTE:', '').trim().toLowerCase();
      const candidate = candidates.find(c => 
        c.name.toLowerCase().includes(candidateName) || 
        candidateName.includes(c.name.toLowerCase())
      );
      
      if (candidate) {
        handleVote(candidate.index);
      } else {
        speak(t('voting.candidateNotFound', { name: candidateName }));
      }
    } else if (command === 'SHOW_RESULTS') {
      window.location.href = '/admin';
    } else if (command === 'CONNECT_WALLET') {
      connectWallet();
    }
  };

  const handleVote = async (candidateIndex) => {
    if (!voterName.trim()) {
      toast({
        title: t('voting.enterName'),
        description: t('voting.enterName'),
        variant: "destructive"
      });
      return;
    }

    try {
      setVoting(true);
      
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);

      const tx = await contract.vote(candidateIndex, voterName);
      toast({
        title: "Transaction Submitted",
        description: "Your vote is being processed...",
        variant: "default"
      });

      await tx.wait();
      
      setHasVoted(true);
      toast({
        title: "Vote Successful!",
        description: `Your vote for ${candidates[candidateIndex]?.name} has been recorded`,
        variant: "default"
      });
    } catch (error) {
      console.error('Error voting:', error);
      toast({
        title: "Vote Failed",
        description: error.message || "Failed to submit vote",
        variant: "destructive"
      });
    } finally {
      setVoting(false);
    }
  };

  const getProgress = () => {
    if (!status || status.timeLeftSeconds <= 0) return 0;
    const totalTime = status.electionEndTime - (status.electionEndTime - status.timeLeftSeconds);
    return Math.max(0, Math.min(100, ((totalTime - status.timeLeftSeconds) / totalTime) * 100));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background/50 to-primary/5 relative overflow-hidden">
      {/* Blockchain-themed background elements */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute top-10 left-10 w-32 h-32 border border-primary/20 rounded-lg rotate-12"></div>
        <div className="absolute bottom-20 right-20 w-24 h-24 border border-accent/20 rounded-lg -rotate-12"></div>
        <div className="absolute top-1/2 left-1/4 w-16 h-16 border border-primary-glow/20 rounded-lg rotate-45"></div>
      </div>
      
      <div className="container mx-auto px-4 py-8 relative z-10">
        {/* Enhanced Header */}
        {/* Language and Voice Controls Header */}
        <div className="flex justify-between items-center mb-8">
          <LanguageSelector />
          <VoiceControls onVoiceCommand={handleVoiceCommand} compact={true} />
        </div>

        <div className="text-center mb-12">
          <div className="flex items-center justify-center gap-4 mb-6">
            <div className="p-3 bg-gradient-to-br from-primary to-primary-glow rounded-xl">
              <Shield className="w-8 h-8 text-primary-foreground" />
            </div>
            <h1 className="text-6xl font-bold bg-gradient-to-r from-primary via-primary-glow to-accent bg-clip-text text-transparent">
              {t('voting.title')}
            </h1>
            <div className="p-3 bg-gradient-to-br from-accent to-primary rounded-xl">
              <Zap className="w-8 h-8 text-primary-foreground" />
            </div>
          </div>
          <p className="text-xl text-muted-foreground mb-4">
            {t('voting.subtitle')}
          </p>
          <div className="flex items-center justify-center gap-6 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Globe className="w-4 h-4 text-accent" />
              <span>Avalanche C-Chain</span>
            </div>
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-success" />
              <span>Real-time Results</span>
            </div>
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-primary" />
              <span>Blockchain Verified</span>
            </div>
          </div>
          
          {/* Enhanced Election Status */}
          <Card className="max-w-3xl mx-auto mt-8 p-8 bg-gradient-to-r from-card/80 to-card/60 backdrop-blur-md border-primary/20 shadow-elegant">
            <div className="flex items-center justify-center gap-6 mb-6">
              <Clock className="w-8 h-8 text-primary animate-pulse" />
              <div className="text-center">
                {status?.electionActive ? (
                  <>
                    <Badge className="bg-gradient-to-r from-success to-success/80 text-success-foreground mb-3 px-4 py-2 text-lg">
                      🗳️ Election Active
                    </Badge>
                    <p className="text-2xl font-bold text-foreground bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                      {timeLeft}
                    </p>
                    <p className="text-sm text-muted-foreground mt-2">Time remaining to cast your vote</p>
                  </>
                ) : (
                  <>
                    <Badge variant="destructive" className="mb-3 px-4 py-2 text-lg">
                      ⏰ Election Ended
                    </Badge>
                    <p className="text-lg text-muted-foreground">Results are being finalized</p>
                  </>
                )}
              </div>
            </div>
            {status?.electionActive && (
              <div className="space-y-2">
                <Progress value={getProgress()} className="w-full h-3 bg-muted" />
                <p className="text-xs text-center text-muted-foreground">
                  Election Progress • Contract: {CONTRACT_ADDRESS.slice(0, 6)}...{CONTRACT_ADDRESS.slice(-4)}
                </p>
              </div>
            )}
          </Card>
        </div>

        {/* Enhanced Wallet Connection */}
        {!connected ? (
          <Card className="max-w-md mx-auto p-8 text-center bg-gradient-to-br from-card/90 to-card/70 backdrop-blur-md border-accent/20 shadow-elegant">
            <div className="p-4 bg-gradient-to-br from-primary/20 to-accent/20 rounded-full w-24 h-24 mx-auto mb-6 flex items-center justify-center">
              <Wallet className="w-12 h-12 text-accent" />
            </div>
            <h3 className="text-2xl font-semibold mb-4 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              Connect Web3 Wallet
            </h3>
            <p className="text-muted-foreground mb-6">
              Secure blockchain authentication required for voting
            </p>
            <Button onClick={connectWallet} size="lg" className="w-full bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 transition-all duration-300">
              <Wallet className="w-5 h-5 mr-2" />
              Connect Wallet
            </Button>
            <p className="text-xs text-muted-foreground mt-4">
              Supports MetaMask, Core Wallet, and other Web3 wallets
            </p>
          </Card>
        ) : hasVoted ? (
          <Card className="max-w-md mx-auto p-8 text-center bg-gradient-to-br from-success/10 to-success/5 border-success/30 backdrop-blur-md shadow-glow">
            <div className="p-4 bg-gradient-to-br from-success/20 to-success/30 rounded-full w-24 h-24 mx-auto mb-6 flex items-center justify-center">
              <CheckCircle className="w-12 h-12 text-success" />
            </div>
            <h3 className="text-2xl font-semibold mb-4 text-success">Vote Recorded!</h3>
            <p className="text-muted-foreground mb-4">
              Your vote has been permanently recorded on the Avalanche blockchain
            </p>
            <div className="p-4 bg-muted/50 rounded-lg">
              <p className="text-sm text-muted-foreground">
                Transaction Hash: <br />
                <span className="font-mono text-xs">{userAddress.slice(0, 20)}...</span>
              </p>
            </div>
          </Card>
        ) : status?.electionActive ? (
          <div className="max-w-5xl mx-auto">
            {/* Enhanced Voter Input */}
            <Card className="p-8 mb-8 bg-gradient-to-r from-card/90 to-card/70 backdrop-blur-md border-primary/20 shadow-elegant">
              <h3 className="text-2xl font-semibold mb-6 flex items-center gap-3">
                <div className="p-2 bg-gradient-to-br from-primary/20 to-accent/20 rounded-lg">
                  <VoteIcon className="w-6 h-6 text-primary" />
                </div>
                Voter Information
              </h3>
              <div className="flex flex-col md:flex-row gap-4 items-end">
                <div className="flex-1">
                  <label className="text-sm font-medium text-muted-foreground mb-2 block">
                    Full Name (Recorded on blockchain)
                  </label>
                  <Input
                    placeholder="Enter your full name"
                    value={voterName}
                    onChange={(e) => setVoterName(e.target.value)}
                    className="h-12 bg-background/50 border-primary/20 focus:border-primary"
                  />
                </div>
                <div className="text-sm text-muted-foreground">
                  <p>Wallet: {userAddress.slice(0, 6)}...{userAddress.slice(-4)}</p>
                </div>
              </div>
            </Card>

            {/* Enhanced Candidates Grid */}
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              {candidates.map((candidate) => (
                <Card key={candidate.index} className="group p-8 hover:shadow-glow transition-all duration-500 bg-gradient-to-br from-card/90 to-card/70 backdrop-blur-md border-primary/20 hover:border-accent/40 hover:scale-105">
                  <div className="text-center">
                    <div className="relative mb-6">
                      <div className="w-32 h-32 bg-gradient-to-br from-primary via-primary-glow to-accent rounded-full mx-auto flex items-center justify-center shadow-elegant group-hover:shadow-glow transition-all duration-500">
                        <span className="text-4xl font-bold text-primary-foreground">
                          {candidate.name.split(' ').map(n => n[0]).join('')}
                        </span>
                      </div>
                      <div className="absolute -bottom-2 -right-2 p-2 bg-accent rounded-full border-4 border-background">
                        <Shield className="w-4 h-4 text-accent-foreground" />
                      </div>
                    </div>
                    <h3 className="text-2xl font-semibold mb-6 bg-gradient-to-r from-foreground to-muted-foreground bg-clip-text text-transparent">
                      {candidate.name}
                    </h3>
                    <Button
                      onClick={() => handleVote(candidate.index)}
                      disabled={voting}
                      className="w-full h-14 text-lg font-semibold bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 transition-all duration-300 shadow-lg hover:shadow-glow"
                      size="lg"
                    >
                      <VoteIcon className="w-5 h-5 mr-3" />
                      {voting ? 'Processing Vote...' : 'Cast Vote'}
                    </Button>
                    <p className="text-xs text-muted-foreground mt-3">
                      Candidate #{candidate.index + 1}
                    </p>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        ) : (
          <Card className="max-w-md mx-auto p-8 text-center bg-gradient-to-br from-muted/50 to-muted/30 backdrop-blur-md">
            <div className="p-4 bg-muted rounded-full w-24 h-24 mx-auto mb-6 flex items-center justify-center">
              <Clock className="w-12 h-12 text-muted-foreground" />
            </div>
            <h3 className="text-2xl font-semibold mb-4">Election Concluded</h3>
            <p className="text-muted-foreground mb-6">
              The voting period has ended. Results are being finalized on the blockchain.
            </p>
            <Button variant="outline" className="w-full" onClick={() => window.location.href = '/admin'}>
              View Results
            </Button>
          </Card>
        )}

        {/* Blockchain Info Footer */}
        <div className="mt-16 text-center">
          <div className="flex items-center justify-center gap-8 text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-success rounded-full animate-pulse"></div>
              <span>Live on Avalanche</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-primary rounded-full"></div>
              <span>Fuji Testnet</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-accent rounded-full"></div>
              <span>Powered by Web3</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Vote;