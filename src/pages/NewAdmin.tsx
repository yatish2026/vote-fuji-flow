import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';
import {
  Shield, Users, TrendingUp, Download, RefreshCw,
  Clock, CheckCircle, AlertCircle, Wallet, Brain, Zap,
  Activity, Globe, Database, Lock, BarChart3, Plus, Trophy
} from 'lucide-react';
import { ethers } from 'ethers';
import { FACTORY_CONTRACT_ADDRESS, FACTORY_CONTRACT_ABI } from '@/lib/contract';
import { useTranslation } from 'react-i18next';
import { LanguageSelector } from '@/components/LanguageSelector';
import { VoiceControls } from '@/components/VoiceControls';
import ElectionManager from '@/components/ElectionManager';
import AIInsights from '@/components/AIInsights';

interface Election {
  id: number;
  title: string;
  description: string;
  startTime: number;
  endTime: number;
  active: boolean;
  candidatesCount: number;
  totalVotes: number;
}

interface VoteData {
  candidate: string;
  votes: number;
  percentage: number;
}

interface ElectionAnalytics {
  election: Election;
  candidates: Array<{
    id: number;
    name: string;
    votes: number;
  }>;
  winner?: {
    name: string;
    votes: number;
  };
}

const NewAdmin = () => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [userAddress, setUserAddress] = useState('');
  const [elections, setElections] = useState<Election[]>([]);
  const [selectedElectionId, setSelectedElectionId] = useState<number | null>(null);
  const [electionAnalytics, setElectionAnalytics] = useState<ElectionAnalytics | null>(null);
  const [loading, setLoading] = useState(false);

  const COLORS = ['#8b5cf6', '#f59e0b', '#ef4444', '#10b981', '#3b82f6'];

  useEffect(() => {
    checkAdminStatus();
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      fetchElections();
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (selectedElectionId !== null) {
      fetchElectionAnalytics(selectedElectionId);
    }
  }, [selectedElectionId]);

  const checkAdminStatus = async () => {
    const savedAuth = localStorage.getItem('adminAuth');
    if (savedAuth) {
      try {
        const authData = JSON.parse(savedAuth);
        if (authData.address && authData.timestamp > Date.now() - 24 * 60 * 60 * 1000) {
          setUserAddress(authData.address);
          setIsAuthenticated(true);
        } else {
          localStorage.removeItem('adminAuth');
        }
      } catch (error) {
        localStorage.removeItem('adminAuth');
      }
    }
  };

  const connectWalletAndAuth = async () => {
    try {
      setIsAuthenticating(true);

      // @ts-ignore
      if (!window.ethereum) {
        throw new Error('MetaMask wallet not found. Please install MetaMask extension.');
      }

      // Request account access
      // @ts-ignore
      await window.ethereum.request({ method: 'eth_requestAccounts' });
      
      // @ts-ignore
      const provider = new ethers.BrowserProvider(window.ethereum);
      
      // Check and switch to Fuji network
      try {
        const network = await provider.getNetwork();
        if (network.chainId !== 43113n) { // Fuji testnet
          // @ts-ignore
          await window.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: '0xa869' }], // 43113 in hex
          });
        }
      } catch (networkError: any) {
        if (networkError.code === 4902) {
          // Add Fuji network if not exists
          // @ts-ignore
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [{
              chainId: '0xa869',
              chainName: 'Avalanche Fuji Testnet',
              nativeCurrency: {
                name: 'AVAX',
                symbol: 'AVAX',
                decimals: 18,
              },
              rpcUrls: ['https://api.avax-test.network/ext/bc/C/rpc'],
              blockExplorerUrls: ['https://testnet.snowtrace.io/'],
            }],
          });
        } else {
          throw networkError;
        }
      }
      
      const signer = await provider.getSigner();
      const address = await signer.getAddress();
      setUserAddress(address);

      // Test contract connection
      const contract = new ethers.Contract(FACTORY_CONTRACT_ADDRESS, FACTORY_CONTRACT_ABI, provider);
      
      let adminAddress;
      try {
        adminAddress = await contract.admin();
      } catch (contractError: any) {
        console.error('Contract error:', contractError);
        throw new Error('Failed to connect to smart contract. Please check your network connection and try again.');
      }

      // Skip admin check in demo mode for hackathon
      const isDemoMode = import.meta.env.VITE_DEMO_MODE === 'true';
      
      if (!isDemoMode && address.toLowerCase() !== adminAddress.toLowerCase()) {
        throw new Error(`Access denied: You are not the admin of this contract. Admin address: ${adminAddress}`);
      }

      // Save auth data
      localStorage.setItem('adminAuth', JSON.stringify({
        address,
        demoMode: isDemoMode,
        timestamp: Date.now()
      }));

      setIsAuthenticated(true);

      toast({
        title: t('admin.authSuccess'),
        description: isDemoMode ? '🎯 Demo access granted for hackathon judges!' : 'Successfully authenticated as admin!',
        variant: "default"
      });
    } catch (error: any) {
      console.error('Authentication error:', error);
      let errorMessage = error.message;
      
      if (error.code === 4001) {
        errorMessage = 'User rejected the connection request.';
      } else if (error.code === -32002) {
        errorMessage = 'Connection request already pending. Please check MetaMask.';
      } else if (error.message?.includes('network')) {
        errorMessage = 'Network connection error. Please check your internet connection.';
      }
      
      toast({
        title: t('admin.authError'),
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setIsAuthenticating(false);
    }
  };

  const fetchElections = async () => {
    try {
      setLoading(true);
      
      // Load from cache immediately
      try {
        const cached = localStorage.getItem('admin-elections-cache');
        if (cached) {
          const { data, timestamp } = JSON.parse(cached);
          if (Date.now() - timestamp < 20000) { // 20 second cache
            setElections(data);
            if (data.length > 0 && selectedElectionId === null) {
              const mostRecentElection = data.reduce((prev: any, current: any) => 
                (prev.id > current.id) ? prev : current
              );
              setSelectedElectionId(mostRecentElection.id);
            }
            setLoading(false);
            // Continue with fresh fetch in background
            setTimeout(() => fetchFreshElections(), 50);
            return;
          }
        }
      } catch (cacheError) {
        console.log('Cache error:', cacheError);
      }

      await fetchFreshElections();
    } catch (error: any) {
      console.error('Error fetching elections:', error);
      setLoading(false);
    }
  };

  const fetchFreshElections = async () => {
    try {
      // @ts-ignore
      if (!window.ethereum) return;

      // @ts-ignore
      const provider = new ethers.BrowserProvider(window.ethereum);
      const contract = new ethers.Contract(FACTORY_CONTRACT_ADDRESS, FACTORY_CONTRACT_ABI, provider);

      const electionCount = await contract.electionCount();

      // Batch process for optimal performance
      const batchSize = 15;
      const electionsList: Election[] = [];
      
      for (let i = 0; i < Number(electionCount); i += batchSize) {
        const batch = [];
        const end = Math.min(i + batchSize, Number(electionCount));
        
        for (let j = i; j < end; j++) {
          batch.push(contract.elections(j).catch(() => null));
        }
        
        const results = await Promise.all(batch);
        results.forEach(election => {
          if (election) {
            electionsList.push({
              id: Number(election.id),
              title: election.title,
              description: election.description,
              startTime: Number(election.startTime),
              endTime: Number(election.endTime),
              active: election.active,
              candidatesCount: Number(election.candidatesCount),
              totalVotes: Number(election.totalVotes)
            });
          }
        });
      }

      setElections(electionsList);
      
      // Cache results
      localStorage.setItem('admin-elections-cache', JSON.stringify({
        data: electionsList,
        timestamp: Date.now()
      }));
      
      // Select most recent election if none selected
      if (electionsList.length > 0 && selectedElectionId === null) {
        const mostRecentElection = electionsList.reduce((prev, current) => 
          (prev.id > current.id) ? prev : current
        );
        setSelectedElectionId(mostRecentElection.id);
      }
    } catch (error: any) {
      console.error('Fresh fetch error:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchElectionAnalytics = async (electionId: number) => {
    try {
      // @ts-ignore
      if (!window.ethereum) return;

      // Check if the election exists in our elections list first
      const electionExists = elections.find(e => e.id === electionId);
      if (!electionExists) {
        console.warn(`Election with ID ${electionId} not found in elections list`);
        return;
      }

      // @ts-ignore
      const provider = new ethers.BrowserProvider(window.ethereum);
      const contract = new ethers.Contract(FACTORY_CONTRACT_ADDRESS, FACTORY_CONTRACT_ABI, provider);

      // Fetch election details
      const [title, description, startTime, endTime, active, candidatesCount, totalVotes] = 
        await contract.getElection(electionId);

      const election: Election = {
        id: electionId,
        title,
        description,
        startTime: Number(startTime),
        endTime: Number(endTime),
        active,
        candidatesCount: Number(candidatesCount),
        totalVotes: Number(totalVotes)
      };

      // Fetch candidates in parallel for better performance
      const candidatePromises = [];
      for (let i = 0; i < Number(candidatesCount); i++) {
        candidatePromises.push(
          contract.getCandidate(electionId, i).catch((error: any) => {
            console.error(`Error fetching candidate ${i}:`, error);
            return null;
          })
        );
      }

      const candidateResults = await Promise.all(candidatePromises);
      const candidates = candidateResults
        .filter(result => result !== null)
        .map(result => {
          const [candidateId, candidateName, candidateVotes] = result;
          return {
            id: Number(candidateId),
            name: candidateName,
            votes: Number(candidateVotes)
          };
        });

      let winner = undefined;
      if (!active && Number(totalVotes) > 0) {
        try {
          const [winnerName, winnerVotes] = await contract.getWinner(electionId);
          winner = { name: winnerName, votes: Number(winnerVotes) };
        } catch (error) {
          console.log('No winner yet or error fetching winner');
        }
      }

      setElectionAnalytics({
        election,
        candidates,
        winner
      });
    } catch (error) {
      console.error('Error fetching election analytics:', error);
      toast({
        title: t('common.error'),
        description: t('voting.fetchError'),
        variant: 'destructive'
      });
    }
  };

  const endElection = async (electionId: number) => {
    try {
      // @ts-ignore
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(FACTORY_CONTRACT_ADDRESS, FACTORY_CONTRACT_ABI, signer);

      const tx = await contract.endElection(electionId);
      toast({
        title: t('voting.voting'),
        description: t('admin.ending'),
        variant: "default"
      });

      await tx.wait();

      toast({
        title: t('common.success'),
        description: t('admin.electionEnded'),
        variant: "default"
      });

      fetchElections();
      if (selectedElectionId === electionId) {
        fetchElectionAnalytics(electionId);
      }
    } catch (error: any) {
      toast({
        title: t('common.error'),
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const exportResults = async () => {
    try {
      if (!electionAnalytics) return;

      const csvData = [
        ['Candidate', 'Votes', 'Percentage'],
        ...electionAnalytics.candidates.map(candidate => {
          const percentage = electionAnalytics.election.totalVotes > 0 
            ? (candidate.votes / electionAnalytics.election.totalVotes * 100).toFixed(2)
            : '0';
          return [candidate.name, candidate.votes.toString(), percentage];
        })
      ];

      const csvContent = csvData.map(row => row.join(',')).join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${electionAnalytics.election.title}-results.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: t('common.success'),
        description: t('admin.dataRefreshed'),
        variant: "default"
      });
    } catch (error) {
      toast({
        title: t('common.error'),
        description: t('voting.voteError'),
        variant: "destructive"
      });
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleString();
  };

  if (!isAuthenticated) {
    const isDemoMode = import.meta.env.VITE_DEMO_MODE === 'true';
    
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background/50 to-primary/5 flex items-center justify-center relative overflow-hidden">
        {/* Demo Mode Banner */}
        {isDemoMode && (
          <div className="absolute top-0 left-0 right-0 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-center py-2 px-4 z-10">
            <div className="flex items-center justify-center gap-2 text-sm font-medium">
              <Trophy className="w-4 h-4" />
              🎯 HACKATHON DEMO MODE - Any wallet can access admin features for judges!
            </div>
          </div>
        )}
        
        <div className="absolute top-4 right-4">
          <LanguageSelector />
        </div>
        
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-20 w-40 h-40 border-2 border-primary/30 rounded-lg rotate-12 animate-pulse"></div>
          <div className="absolute bottom-40 right-32 w-32 h-32 border-2 border-accent/30 rounded-lg -rotate-12"></div>
          <div className="absolute top-1/3 right-1/4 w-24 h-24 border-2 border-primary-glow/30 rounded-lg rotate-45"></div>
        </div>

        <Card className="max-w-md w-full mx-4 p-10 text-center bg-gradient-to-br from-card/90 to-card/70 backdrop-blur-xl border-primary/30 shadow-elegant">
          <div className="p-4 bg-gradient-to-br from-primary/20 to-accent/20 rounded-full w-24 h-24 mx-auto mb-8 flex items-center justify-center">
            <Shield className="w-12 h-12 text-primary" />
          </div>
          <h1 className="text-4xl font-bold mb-4 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            {t('admin.title')}
          </h1>
          <p className="text-muted-foreground mb-8 leading-relaxed">
            {isDemoMode 
              ? "🎯 Demo Mode Active: Connect any wallet to access admin features for hackathon judging!"
              : t('admin.authenticate')
            }
          </p>
          <Button
            onClick={connectWalletAndAuth}
            disabled={isAuthenticating}
            size="lg"
            className="w-full h-14 text-lg bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 transition-all duration-300 shadow-lg"
          >
            <Wallet className="w-5 h-5 mr-3" />
            {isAuthenticating ? t('admin.authenticating') : t('admin.authenticate')}
          </Button>
          <div className="flex items-center justify-center gap-4 mt-6 text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <Lock className="w-3 h-3" />
              <span>{t('admin.securityMetrics')}</span>
            </div>
            <div className="flex items-center gap-1">
              <Database className="w-3 h-3" />
              <span>{t('admin.blockchainIntegrity')}</span>
            </div>
            <div className="flex items-center gap-1">
              <Zap className="w-3 h-3" />
              <span>{t('voting.realTimeUpdates')}</span>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background/50 to-primary/5">
      {/* Demo Mode Banner for Main Dashboard */}
      {import.meta.env.VITE_DEMO_MODE === 'true' && (
        <div className="bg-gradient-to-r from-amber-500 to-orange-500 text-white text-center py-2 px-4">
          <div className="flex items-center justify-center gap-2 text-sm font-medium">
            <Trophy className="w-4 h-4" />
            🎯 HACKATHON DEMO MODE - Admin access granted for judging purposes | Connected: {userAddress.slice(0, 6)}...{userAddress.slice(-4)}
          </div>
        </div>
      )}
      
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              {t('admin.title')}
            </h1>
            <p className="text-muted-foreground mt-2">{t('elections.subtitle')}</p>
          </div>
          <div className="flex gap-4">
            <LanguageSelector />
            <VoiceControls />
            <Button onClick={fetchElections} disabled={loading} variant="outline">
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              {t('admin.refreshData')}
            </Button>
          </div>
        </div>

        <Tabs defaultValue="manage" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="manage">{t('elections.title')}</TabsTrigger>
            <TabsTrigger value="analytics">{t('admin.analytics')}</TabsTrigger>
          </TabsList>

          <TabsContent value="manage" className="space-y-6">
            <ElectionManager 
              onElectionSelect={(id) => setSelectedElectionId(id)}
              selectedElectionId={selectedElectionId}
              onElectionDeleted={() => {
                fetchElections();
                setElectionAnalytics(null);
                setSelectedElectionId(null);
              }}
            />
          </TabsContent>

          <TabsContent value="analytics" className="space-y-6">
            {elections.length > 0 && (
              <Card className="p-6">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-2xl font-semibold">{t('admin.analytics')}</h3>
                  <div className="flex gap-4">
                    <select
                      value={selectedElectionId || ''}
                      onChange={(e) => setSelectedElectionId(Number(e.target.value))}
                      className="px-3 py-2 border rounded-lg bg-background"
                    >
                      {elections.map((election) => (
                        <option key={election.id} value={election.id}>
                          {election.title}
                        </option>
                      ))}
                    </select>
                    <Button onClick={exportResults} variant="outline">
                      <Download className="w-4 h-4 mr-2" />
                      {t('admin.downloadReport')}
                    </Button>
                  </div>
                </div>

                {electionAnalytics && (
                  <div className="space-y-6">
                    {/* Election Status */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <Card className="p-4">
                        <div className="text-center">
                          <Users className="w-6 h-6 mx-auto mb-2 text-primary" />
                          <p className="text-2xl font-bold">{electionAnalytics.election.totalVotes}</p>
                          <p className="text-sm text-muted-foreground">{t('admin.totalVotes')}</p>
                        </div>
                      </Card>
                      <Card className="p-4">
                        <div className="text-center">
                          <CheckCircle className="w-6 h-6 mx-auto mb-2 text-success" />
                          <p className="text-2xl font-bold">
                            {electionAnalytics.election.active ? t('admin.active') : t('admin.ended')}
                          </p>
                          <p className="text-sm text-muted-foreground">{t('admin.electionStatus')}</p>
                        </div>
                      </Card>
                      <Card className="p-4">
                        <div className="text-center">
                          <BarChart3 className="w-6 h-6 mx-auto mb-2 text-accent" />
                          <p className="text-2xl font-bold">{electionAnalytics.candidates.length}</p>
                          <p className="text-sm text-muted-foreground">{t('elections.candidates')}</p>
                        </div>
                      </Card>
                      <Card className="p-4">
                        <div className="text-center">
                          {electionAnalytics.election.active ? (
                            <Button 
                              onClick={() => endElection(electionAnalytics.election.id)}
                              variant="destructive"
                              size="sm"
                            >
                              <AlertCircle className="w-4 h-4 mr-2" />
                              {t('admin.ended')}
                            </Button>
                          ) : (
                            <>
                              <Trophy className="w-6 h-6 mx-auto mb-2 text-warning" />
                              <p className="text-sm font-semibold">
                                {electionAnalytics.winner?.name || t('voting.noVotes')}
                              </p>
                            </>
                          )}
                        </div>
                      </Card>
                    </div>

                     {/* AI Insights */}
                     <AIInsights 
                       election={electionAnalytics.election}
                       candidates={electionAnalytics.candidates}
                       winner={electionAnalytics.winner}
                     />

                     {/* Vote Distribution Charts */}
                    {electionAnalytics.candidates.length > 0 && (
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <Card className="p-6">
                          <h4 className="text-lg font-semibold mb-4">{t('admin.voteDistribution')}</h4>
                          <ResponsiveContainer width="100%" height={300}>
                            <BarChart data={electionAnalytics.candidates}>
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis dataKey="name" />
                              <YAxis />
                              <Tooltip />
                              <Bar dataKey="votes" fill="#8b5cf6" />
                            </BarChart>
                          </ResponsiveContainer>
                        </Card>

                        <Card className="p-6">
                          <h4 className="text-lg font-semibold mb-4">{t('admin.voteDistribution')}</h4>
                          <ResponsiveContainer width="100%" height={300}>
                            <PieChart>
                              <Pie
                                data={electionAnalytics.candidates}
                                cx="50%"
                                cy="50%"
                                outerRadius={100}
                                fill="#8884d8"
                                dataKey="votes"
                                label={({ name, value }) => `${name}: ${value}`}
                              >
                                {electionAnalytics.candidates.map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                              </Pie>
                              <Tooltip />
                            </PieChart>
                          </ResponsiveContainer>
                        </Card>
                      </div>
                    )}

                    {/* Detailed Results */}
                    <Card className="p-6">
                      <h4 className="text-lg font-semibold mb-4">{t('voting.results')}</h4>
                      <div className="space-y-3">
                        {electionAnalytics.candidates
                          .sort((a, b) => b.votes - a.votes)
                          .map((candidate, index) => {
                            const percentage = electionAnalytics.election.totalVotes > 0 
                              ? (candidate.votes / electionAnalytics.election.totalVotes * 100)
                              : 0;
                            return (
                              <div key={candidate.id} className="flex justify-between items-center p-3 bg-muted/20 rounded-lg">
                                <div className="flex items-center gap-3">
                                  <span className="text-2xl font-bold text-muted-foreground">#{index + 1}</span>
                                  <span className="font-semibold">{candidate.name}</span>
                                  {index === 0 && !electionAnalytics.election.active && (
                                    <Badge variant="default">
                                      <Trophy className="w-3 h-3 mr-1" />
                                      {t('voting.winner')}
                                    </Badge>
                                  )}
                                </div>
                                <div className="text-right">
                                  <div className="text-lg font-bold">{candidate.votes}</div>
                                  <div className="text-sm text-muted-foreground">{percentage.toFixed(1)}%</div>
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    </Card>
                  </div>
                )}
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default NewAdmin;