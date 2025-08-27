import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { Clock, Vote as VoteIcon, CheckCircle, Wallet } from 'lucide-react';
import { ethers } from 'ethers';
import { CONTRACT_ADDRESS, CONTRACT_ABI } from '../lib/contract';

interface Candidate {
  name: string;
  index: number;
}

interface ElectionStatus {
  electionActive: boolean;
  timeLeftSeconds: number;
  electionEndTime: number;
}

const Vote = () => {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [status, setStatus] = useState<ElectionStatus | null>(null);
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
      const response = await fetch('/api/candidates');
      const data = await response.json();
      const candidatesWithIndex = data.candidates.map((name: string, index: number) => ({
        name,
        index
      }));
      setCandidates(candidatesWithIndex);
    } catch (error) {
      console.error('Error fetching candidates:', error);
      toast({
        title: "Error",
        description: "Failed to fetch candidates",
        variant: "destructive"
      });
    }
  };

  const fetchElectionStatus = async () => {
    try {
      const response = await fetch('/api/status');
      const data = await response.json();
      setStatus(data);
    } catch (error) {
      console.error('Error fetching status:', error);
    }
  };

  const checkWalletConnection = async () => {
    try {
      // @ts-ignore
      if (window.ethereum) {
        // @ts-ignore
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
      // @ts-ignore
      if (!window.ethereum) {
        toast({
          title: "Wallet Required",
          description: "Please install MetaMask or Core Wallet",
          variant: "destructive"
        });
        return;
      }

      // @ts-ignore
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

  const checkVotingStatus = async (address: string) => {
    try {
      // @ts-ignore
      const provider = new ethers.BrowserProvider(window.ethereum);
      const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);
      const voted = await contract.hasVoted(address);
      setHasVoted(voted);
    } catch (error) {
      console.error('Error checking voting status:', error);
    }
  };

  const handleVote = async (candidateIndex: number) => {
    if (!voterName.trim()) {
      toast({
        title: "Name Required",
        description: "Please enter your name to vote",
        variant: "destructive"
      });
      return;
    }

    try {
      setVoting(true);
      
      // @ts-ignore
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
    } catch (error: any) {
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
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary/20">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-6xl font-bold mb-4 bg-gradient-to-r from-primary to-primary-glow bg-clip-text text-transparent">
            Avalanche Voting
          </h1>
          <p className="text-xl text-muted-foreground mb-8">
            Decentralized, transparent, and secure blockchain voting
          </p>
          
          {/* Election Status */}
          <Card className="max-w-2xl mx-auto p-6 bg-card/50 backdrop-blur-sm border-primary/20">
            <div className="flex items-center justify-center gap-4 mb-4">
              <Clock className="w-6 h-6 text-primary" />
              <div className="text-center">
                {status?.electionActive ? (
                  <>
                    <Badge className="bg-success text-success-foreground mb-2">Election Active</Badge>
                    <p className="text-lg font-semibold text-foreground">{timeLeft}</p>
                  </>
                ) : (
                  <Badge variant="destructive">Election Ended</Badge>
                )}
              </div>
            </div>
            {status?.electionActive && (
              <Progress value={getProgress()} className="w-full" />
            )}
          </Card>
        </div>

        {/* Wallet Connection */}
        {!connected ? (
          <Card className="max-w-md mx-auto p-8 text-center">
            <Wallet className="w-16 h-16 mx-auto mb-4 text-primary" />
            <h3 className="text-2xl font-semibold mb-4">Connect Your Wallet</h3>
            <p className="text-muted-foreground mb-6">
              Connect your wallet to participate in the election
            </p>
            <Button onClick={connectWallet} size="lg" className="w-full">
              Connect Wallet
            </Button>
          </Card>
        ) : hasVoted ? (
          <Card className="max-w-md mx-auto p-8 text-center bg-success/10 border-success/20">
            <CheckCircle className="w-16 h-16 mx-auto mb-4 text-success" />
            <h3 className="text-2xl font-semibold mb-4 text-success">Vote Recorded!</h3>
            <p className="text-muted-foreground">
              Thank you for participating in the election. Your vote has been securely recorded on the blockchain.
            </p>
          </Card>
        ) : status?.electionActive ? (
          <div className="max-w-4xl mx-auto">
            {/* Voter Name Input */}
            <Card className="p-6 mb-8">
              <h3 className="text-xl font-semibold mb-4">Enter Your Information</h3>
              <Input
                placeholder="Enter your full name"
                value={voterName}
                onChange={(e) => setVoterName(e.target.value)}
                className="max-w-md"
              />
            </Card>

            {/* Candidates */}
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {candidates.map((candidate) => (
                <Card key={candidate.index} className="p-6 hover:shadow-elegant transition-all duration-300 bg-card/50 backdrop-blur-sm">
                  <div className="text-center">
                    <div className="w-24 h-24 bg-gradient-to-br from-primary to-primary-glow rounded-full mx-auto mb-4 flex items-center justify-center">
                      <span className="text-2xl font-bold text-primary-foreground">
                        {candidate.name.split(' ').map(n => n[0]).join('')}
                      </span>
                    </div>
                    <h3 className="text-xl font-semibold mb-4">{candidate.name}</h3>
                    <Button
                      onClick={() => handleVote(candidate.index)}
                      disabled={voting}
                      className="w-full"
                      size="lg"
                    >
                      <VoteIcon className="w-4 h-4 mr-2" />
                      {voting ? 'Voting...' : 'Vote'}
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        ) : (
          <Card className="max-w-md mx-auto p-8 text-center">
            <h3 className="text-2xl font-semibold mb-4">Election Ended</h3>
            <p className="text-muted-foreground">
              The voting period has concluded. Results will be available shortly.
            </p>
          </Card>
        )}
      </div>
    </div>
  );
};

export default Vote;