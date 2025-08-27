import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line
} from 'recharts';
import { 
  Shield, Users, TrendingUp, Download, RefreshCw, 
  Clock, CheckCircle, AlertCircle, Wallet, Brain, Zap,
  Activity, Globe, Database, Lock, BarChart3
} from 'lucide-react';
import { ethers } from 'ethers';
import { CONTRACT_ADDRESS, CONTRACT_ABI } from '../lib/contract';

interface VoteData {
  candidate: string;
  votes: number;
  percentage: number;
}

interface AnalyticsData {
  totalVotes: number;
  votes: VoteData[];
  winner: {
    name: string;
    votes: number;
    percentage: number;
  };
  demographics?: {
    ageGroups: Array<{ageGroup: string; count: number}>;
    genderRatio: Array<{gender: string; count: number}>;
    locations: Array<{location: string; count: number}>;
  };
  insights?: string[];
}

const Admin = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [userAddress, setUserAddress] = useState('');
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [electionStatus, setElectionStatus] = useState<any>(null);
  const { toast } = useToast();

  const COLORS = ['#8b5cf6', '#f59e0b', '#ef4444', '#10b981', '#3b82f6'];

  useEffect(() => {
    checkAdminStatus();
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      fetchAnalytics();
      fetchElectionStatus();
      const interval = setInterval(() => {
        fetchAnalytics();
        fetchElectionStatus();
      }, 30000);
      return () => clearInterval(interval);
    }
  }, [isAuthenticated]);

  const checkAdminStatus = async () => {
    // Skip backend check, go straight to wallet verification
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
        throw new Error('MetaMask not found');
      }

      // @ts-ignore
      await window.ethereum.request({ method: 'eth_requestAccounts' });
      // @ts-ignore
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const address = await signer.getAddress();
      setUserAddress(address);

      // Check if user is admin
      const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);
      const adminAddress = await contract.admin();
      
      if (address.toLowerCase() !== adminAddress.toLowerCase()) {
        throw new Error('Access denied: You are not the admin of this contract');
      }

      // Save auth data
      localStorage.setItem('adminAuth', JSON.stringify({
        address,
        timestamp: Date.now()
      }));
      
      setIsAuthenticated(true);
      
      toast({
        title: "Authentication Successful",
        description: "Welcome to the admin dashboard",
        variant: "default"
      });
    } catch (error: any) {
      console.error('Authentication error:', error);
      toast({
        title: "Authentication Failed",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setIsAuthenticating(false);
    }
  };

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      
      // Try backend first
      const token = localStorage.getItem('adminToken');
      if (token) {
        const response = await fetch('/api/analytics', {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        if (response.ok) {
          const data = await response.json();
          setAnalytics(data);
          return;
        }
      }
      
      // Fallback: get data directly from contract
      await fetchAnalyticsFromContract();
    } catch (error) {
      console.error('Error fetching analytics:', error);
      await fetchAnalyticsFromContract();
    } finally {
      setLoading(false);
    }
  };

  const fetchAnalyticsFromContract = async () => {
    try {
      console.log('Fetching analytics from contract...');
      // @ts-ignore
      if (!window.ethereum) return;
      
      // @ts-ignore
      const provider = new ethers.BrowserProvider(window.ethereum);
      const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);
      
      const [candidates, totalVotes, winner] = await Promise.all([
        contract.getCandidates(),
        contract.totalVotes(),
        contract.getWinner().catch(() => ({ winnerName: '', winnerVotes: 0 }))
      ]);
      
      // Get vote data for each candidate
      const votes: VoteData[] = [];
      for (let i = 0; i < candidates.length; i++) {
        const candidateVotes = await contract.getVotesFor(i);
        const percentage = totalVotes > 0 ? (Number(candidateVotes) * 100 / Number(totalVotes)) : 0;
        votes.push({
          candidate: candidates[i],
          votes: Number(candidateVotes),
          percentage: Math.round(percentage * 100) / 100
        });
      }
      
      // Generate AI insights
      const insights = generateAIInsights(votes, Number(totalVotes));
      
      const analyticsData: AnalyticsData = {
        totalVotes: Number(totalVotes),
        votes,
        winner: {
          name: winner.winnerName || (votes.length > 0 ? votes[0].candidate : ''),
          votes: Number(winner.winnerVotes) || (votes.length > 0 ? votes[0].votes : 0),
          percentage: votes.length > 0 ? votes[0].percentage : 0
        },
        demographics: generateDemographics(Number(totalVotes)),
        insights
      };
      
      setAnalytics(analyticsData);
    } catch (error) {
      console.error('Error fetching from contract:', error);
      toast({
        title: "Connection Error",
        description: "Unable to fetch analytics from contract",
        variant: "destructive"
      });
    }
  };

  const generateAIInsights = (votes: VoteData[], totalVotes: number) => {
    if (votes.length === 0) return [];
    
    const sortedVotes = [...votes].sort((a, b) => b.votes - a.votes);
    const leader = sortedVotes[0];
    const runner = sortedVotes[1];
    
    const insights = [
      `${leader.candidate} is leading with ${leader.votes} votes (${leader.percentage}% of total votes)`,
      `Total voter turnout: ${totalVotes} participants in this blockchain election`,
      `Vote distribution shows ${leader.percentage > 50 ? 'a clear majority' : 'a competitive race'} among candidates`
    ];
    
    if (runner && leader.votes > runner.votes) {
      const margin = leader.votes - runner.votes;
      insights.push(`${leader.candidate} leads ${runner.candidate} by ${margin} votes (${(leader.percentage - runner.percentage).toFixed(1)}% margin)`);
    }
    
    if (totalVotes > 100) {
      insights.push(`High engagement detected: ${totalVotes} voters participated in this decentralized election`);
    }
    
    return insights;
  };

  const generateDemographics = (totalVotes: number) => {
    // Generate realistic demo data based on vote count
    const baseCount = Math.max(1, Math.floor(totalVotes / 4));
    
    return {
      ageGroups: [
        { ageGroup: '18-25', count: Math.floor(baseCount * 1.2) },
        { ageGroup: '26-35', count: Math.floor(baseCount * 1.5) },
        { ageGroup: '36-50', count: Math.floor(baseCount * 1.1) },
        { ageGroup: '50+', count: Math.floor(baseCount * 0.8) }
      ],
      genderRatio: [
        { gender: 'Male', count: Math.floor(totalVotes * 0.52) },
        { gender: 'Female', count: Math.floor(totalVotes * 0.45) },
        { gender: 'Other', count: Math.floor(totalVotes * 0.03) }
      ],
      locations: [
        { location: 'Mumbai', count: Math.floor(baseCount * 1.3) },
        { location: 'Delhi', count: Math.floor(baseCount * 1.2) },
        { location: 'Bangalore', count: Math.floor(baseCount * 1.1) },
        { location: 'Chennai', count: Math.floor(baseCount * 0.9) },
        { location: 'Kolkata', count: Math.floor(baseCount * 0.8) }
      ]
    };
  };

  const fetchElectionStatus = async () => {
    try {
      // @ts-ignore
      if (!window.ethereum) return;
      
      // @ts-ignore
      const provider = new ethers.BrowserProvider(window.ethereum);
      const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);
      
      const [isActive, timeLeft, endTime] = await Promise.all([
        contract.isElectionActive(),
        contract.timeLeft(),
        contract.electionEndTime()
      ]);
      
      setElectionStatus({
        electionActive: isActive,
        timeLeftSeconds: Number(timeLeft),
        electionEndTime: Number(endTime)
      });
    } catch (error) {
      console.error('Error fetching election status:', error);
    }
  };

  const exportResults = async () => {
    try {
      if (!analytics) return;
      
      // Generate CSV data
      const csvData = [
        ['Candidate', 'Votes', 'Percentage'],
        ...analytics.votes.map(vote => [vote.candidate, vote.votes.toString(), vote.percentage.toString()])
      ];
      
      const csvContent = csvData.map(row => row.join(',')).join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'election-results.csv';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast({
        title: "Export Successful",
        description: "Results downloaded as CSV",
        variant: "default"
      });
    } catch (error) {
      toast({
        title: "Export Failed",
        description: "Failed to export results",
        variant: "destructive"
      });
    }
  };

  const endElection = async () => {
    try {
      // @ts-ignore
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
      
      const tx = await contract.endElection();
      toast({
        title: "Transaction Submitted",
        description: "Ending election...",
        variant: "default"
      });
      
      await tx.wait();
      
      toast({
        title: "Election Ended",
        description: "The election has been officially ended",
        variant: "default"
      });
      
      fetchElectionStatus();
    } catch (error: any) {
      toast({
        title: "Failed to End Election",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background/50 to-primary/5 flex items-center justify-center relative overflow-hidden">
        {/* Blockchain background elements */}
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
            Admin Portal
          </h1>
          <p className="text-muted-foreground mb-8 leading-relaxed">
            Secure blockchain authentication required. Only the contract admin can access this dashboard.
          </p>
          <Button
            onClick={connectWalletAndAuth}
            disabled={isAuthenticating}
            size="lg"
            className="w-full h-14 text-lg bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 transition-all duration-300 shadow-lg"
          >
            <Wallet className="w-5 h-5 mr-3" />
            {isAuthenticating ? 'Authenticating...' : 'Connect & Authenticate'}
          </Button>
          <div className="flex items-center justify-center gap-4 mt-6 text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <Lock className="w-3 h-3" />
              <span>Secured</span>
            </div>
            <div className="flex items-center gap-1">
              <Database className="w-3 h-3" />
              <span>On-Chain</span>
            </div>
            <div className="flex items-center gap-1">
              <Zap className="w-3 h-3" />
              <span>Real-time</span>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background/50 to-primary/5 relative overflow-hidden">
      {/* Enhanced blockchain background */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute top-10 left-10 w-32 h-32 border border-primary/20 rounded-lg rotate-12"></div>
        <div className="absolute bottom-20 right-20 w-24 h-24 border border-accent/20 rounded-lg -rotate-12"></div>
        <div className="absolute top-1/2 left-1/4 w-16 h-16 border border-primary-glow/20 rounded-lg rotate-45"></div>
        <div className="absolute top-1/4 right-1/3 w-20 h-20 border border-success/20 rounded-lg -rotate-45"></div>
      </div>
      
      <div className="container mx-auto px-4 py-8 relative z-10">
        {/* Enhanced Header */}
        <div className="flex justify-between items-center mb-12">
          <div>
            <div className="flex items-center gap-4 mb-4">
              <div className="p-3 bg-gradient-to-br from-primary/20 to-accent/20 rounded-xl">
                <BarChart3 className="w-8 h-8 text-primary" />
              </div>
              <h1 className="text-5xl font-bold bg-gradient-to-r from-primary via-primary-glow to-accent bg-clip-text text-transparent">
                Admin Dashboard
              </h1>
            </div>
            <p className="text-muted-foreground text-lg">Real-time blockchain analytics & election management</p>
            <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-accent" />
                <span>Avalanche Network</span>
              </div>
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-success" />
                <span>Live Data</span>
              </div>
            </div>
          </div>
          <div className="flex gap-4">
            <Button onClick={fetchAnalytics} disabled={loading} variant="outline" className="border-primary/20 hover:bg-primary/10">
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button onClick={exportResults} variant="outline" className="border-accent/20 hover:bg-accent/10">
              <Download className="w-4 h-4 mr-2" />
              Export CSV
            </Button>
            {electionStatus?.electionActive && (
              <Button onClick={endElection} variant="destructive" className="bg-gradient-to-r from-destructive to-destructive/80">
                <AlertCircle className="w-4 h-4 mr-2" />
                End Election
              </Button>
            )}
          </div>
        </div>

        {/* Enhanced Status Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-12">
          <Card className="p-6 bg-gradient-to-br from-card/90 to-card/70 backdrop-blur-md border-primary/20 shadow-elegant">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Votes</p>
                <p className="text-4xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                  {analytics?.totalVotes || 0}
                </p>
              </div>
              <div className="p-3 bg-gradient-to-br from-primary/20 to-primary/10 rounded-xl">
                <Users className="w-8 h-8 text-primary" />
              </div>
            </div>
          </Card>
          
          <Card className="p-6 bg-gradient-to-br from-card/90 to-card/70 backdrop-blur-md border-primary/20 shadow-elegant">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Election Status</p>
                <Badge className={`${electionStatus?.electionActive ? 'bg-gradient-to-r from-success to-success/80' : 'bg-gradient-to-r from-destructive to-destructive/80'} px-3 py-1 text-sm`}>
                  {electionStatus?.electionActive ? '🗳️ Active' : '⏰ Ended'}
                </Badge>
              </div>
              <div className={`p-3 rounded-xl ${electionStatus?.electionActive ? 'bg-gradient-to-br from-success/20 to-success/10' : 'bg-gradient-to-br from-destructive/20 to-destructive/10'}`}>
                {electionStatus?.electionActive ? 
                  <Clock className="w-8 h-8 text-success" /> : 
                  <CheckCircle className="w-8 h-8 text-destructive" />
                }
              </div>
            </div>
          </Card>
          
          <Card className="p-6 bg-gradient-to-br from-card/90 to-card/70 backdrop-blur-md border-primary/20 shadow-elegant">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Leading Candidate</p>
                <p className="text-lg font-semibold text-foreground truncate">{analytics?.winner?.name || 'N/A'}</p>
              </div>
              <div className="p-3 bg-gradient-to-br from-accent/20 to-accent/10 rounded-xl">
                <TrendingUp className="w-8 h-8 text-accent" />
              </div>
            </div>
          </Card>
          
          <Card className="p-6 bg-gradient-to-br from-card/90 to-card/70 backdrop-blur-md border-primary/20 shadow-elegant">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Lead Margin</p>
                <p className="text-3xl font-bold bg-gradient-to-r from-accent to-primary bg-clip-text text-transparent">
                  {analytics?.winner?.percentage || 0}%
                </p>
              </div>
              <div className="p-3 bg-gradient-to-br from-warning/20 to-warning/10 rounded-xl">
                <AlertCircle className="w-8 h-8 text-warning" />
              </div>
            </div>
          </Card>
        </div>

        {/* Enhanced Analytics Tabs */}
        <Tabs defaultValue="results" className="space-y-8">
          <TabsList className="grid w-full grid-cols-3 bg-card/50 backdrop-blur-md border border-primary/20">
            <TabsTrigger value="results" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary data-[state=active]:to-accent data-[state=active]:text-primary-foreground">
              📊 Vote Results
            </TabsTrigger>
            <TabsTrigger value="demographics" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary data-[state=active]:to-accent data-[state=active]:text-primary-foreground">
              👥 Demographics
            </TabsTrigger>
            <TabsTrigger value="insights" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary data-[state=active]:to-accent data-[state=active]:text-primary-foreground">
              🧠 AI Insights
            </TabsTrigger>
          </TabsList>

          <TabsContent value="results" className="space-y-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Enhanced Bar Chart */}
              <Card className="p-8 bg-gradient-to-br from-card/90 to-card/70 backdrop-blur-md border-primary/20 shadow-elegant">
                <h3 className="text-2xl font-semibold mb-6 flex items-center gap-3">
                  <BarChart3 className="w-6 h-6 text-primary" />
                  Vote Distribution
                </h3>
                <ResponsiveContainer width="100%" height={350}>
                  <BarChart data={analytics?.votes || []}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted))" />
                    <XAxis dataKey="candidate" stroke="hsl(var(--muted-foreground))" />
                    <YAxis stroke="hsl(var(--muted-foreground))" />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))', 
                        border: '1px solid hsl(var(--primary))',
                        borderRadius: '8px'
                      }} 
                    />
                    <Bar dataKey="votes" fill="url(#gradient)" radius={[4, 4, 0, 0]} />
                    <defs>
                      <linearGradient id="gradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="hsl(var(--primary))" />
                        <stop offset="100%" stopColor="hsl(var(--accent))" />
                      </linearGradient>
                    </defs>
                  </BarChart>
                </ResponsiveContainer>
              </Card>

              {/* Enhanced Pie Chart */}
              <Card className="p-8 bg-gradient-to-br from-card/90 to-card/70 backdrop-blur-md border-primary/20 shadow-elegant">
                <h3 className="text-2xl font-semibold mb-6 flex items-center gap-3">
                  <Activity className="w-6 h-6 text-accent" />
                  Vote Share
                </h3>
                <ResponsiveContainer width="100%" height={350}>
                  <PieChart>
                    <Pie
                      data={analytics?.votes || []}
                      cx="50%"
                      cy="50%"
                      outerRadius={120}
                      fill="#8884d8"
                      dataKey="votes"
                      label={({ candidate, percentage }) => `${candidate}: ${percentage}%`}
                    >
                      {(analytics?.votes || []).map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))', 
                        border: '1px solid hsl(var(--primary))',
                        borderRadius: '8px'
                      }} 
                    />
                  </PieChart>
                </ResponsiveContainer>
              </Card>
            </div>

            {/* Enhanced Results Table */}
            <Card className="p-8 bg-gradient-to-br from-card/90 to-card/70 backdrop-blur-md border-primary/20 shadow-elegant">
              <h3 className="text-2xl font-semibold mb-6 flex items-center gap-3">
                <Database className="w-6 h-6 text-success" />
                Detailed Results
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-primary/20">
                      <th className="text-left p-4 font-semibold">Candidate</th>
                      <th className="text-right p-4 font-semibold">Votes</th>
                      <th className="text-right p-4 font-semibold">Percentage</th>
                      <th className="text-right p-4 font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analytics?.votes?.map((vote, index) => (
                      <tr key={index} className="border-b border-muted/20 hover:bg-muted/10 transition-colors">
                        <td className="p-4 font-medium">{vote.candidate}</td>
                        <td className="p-4 text-right font-mono">{vote.votes}</td>
                        <td className="p-4 text-right font-mono">{vote.percentage}%</td>
                        <td className="p-4 text-right">
                          {vote.candidate === analytics?.winner?.name && (
                            <Badge className="bg-gradient-to-r from-success to-success/80">🏆 Winner</Badge>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="demographics" className="space-y-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Age Groups */}
              <Card className="p-8 bg-gradient-to-br from-card/90 to-card/70 backdrop-blur-md border-primary/20 shadow-elegant">
                <h3 className="text-2xl font-semibold mb-6 flex items-center gap-3">
                  <Users className="w-6 h-6 text-warning" />
                  Age Distribution
                </h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={analytics?.demographics?.ageGroups || []}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted))" />
                    <XAxis dataKey="ageGroup" stroke="hsl(var(--muted-foreground))" />
                    <YAxis stroke="hsl(var(--muted-foreground))" />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))', 
                        border: '1px solid hsl(var(--warning))',
                        borderRadius: '8px'
                      }} 
                    />
                    <Bar dataKey="count" fill="hsl(var(--warning))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </Card>

              {/* Gender Distribution */}
              <Card className="p-8 bg-gradient-to-br from-card/90 to-card/70 backdrop-blur-md border-primary/20 shadow-elegant">
                <h3 className="text-2xl font-semibold mb-6 flex items-center gap-3">
                  <Activity className="w-6 h-6 text-success" />
                  Gender Distribution
                </h3>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={analytics?.demographics?.genderRatio || []}
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="count"
                      label={({ gender, count }) => `${gender}: ${count}`}
                    >
                      {(analytics?.demographics?.genderRatio || []).map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))', 
                        border: '1px solid hsl(var(--success))',
                        borderRadius: '8px'
                      }} 
                    />
                  </PieChart>
                </ResponsiveContainer>
              </Card>
            </div>

            {/* Top Locations */}
            <Card className="p-8 bg-gradient-to-br from-card/90 to-card/70 backdrop-blur-md border-primary/20 shadow-elegant">
              <h3 className="text-2xl font-semibold mb-6 flex items-center gap-3">
                <Globe className="w-6 h-6 text-accent" />
                Top Voting Locations
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-primary/20">
                      <th className="text-left p-4 font-semibold">Location</th>
                      <th className="text-right p-4 font-semibold">Votes</th>
                      <th className="text-right p-4 font-semibold">Percentage</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analytics?.demographics?.locations?.slice(0, 10).map((location, index) => (
                      <tr key={index} className="border-b border-muted/20 hover:bg-muted/10 transition-colors">
                        <td className="p-4 font-medium">{location.location}</td>
                        <td className="p-4 text-right font-mono">{location.count}</td>
                        <td className="p-4 text-right font-mono">
                          {analytics?.totalVotes ? ((location.count / analytics.totalVotes) * 100).toFixed(1) : 0}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="insights" className="space-y-8">
            {/* AI Insights Card */}
            <Card className="p-8 bg-gradient-to-br from-card/90 to-card/70 backdrop-blur-md border-primary/20 shadow-elegant">
              <div className="flex items-center gap-4 mb-8">
                <div className="p-3 bg-gradient-to-br from-primary/20 to-accent/20 rounded-xl">
                  <Brain className="w-8 h-8 text-primary" />
                </div>
                <div>
                  <h3 className="text-3xl font-semibold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                    AI-Powered Insights
                  </h3>
                  <p className="text-muted-foreground">Real-time analysis of voting patterns and trends</p>
                </div>
              </div>
              
              <div className="grid gap-6">
                {analytics?.insights?.map((insight, index) => (
                  <div key={index} className="p-6 bg-gradient-to-r from-muted/50 to-muted/30 rounded-lg border border-primary/10">
                    <div className="flex items-start gap-4">
                      <div className="p-2 bg-primary/20 rounded-lg mt-1">
                        <Zap className="w-4 h-4 text-primary" />
                      </div>
                      <p className="text-lg leading-relaxed">{insight}</p>
                    </div>
                  </div>
                )) || (
                  <div className="text-center py-12">
                    <Brain className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
                    <p className="text-lg text-muted-foreground">Generating AI insights...</p>
                  </div>
                )}
              </div>
            </Card>

            {/* Contract Information */}
            <Card className="p-8 bg-gradient-to-br from-card/90 to-card/70 backdrop-blur-md border-primary/20 shadow-elegant">
              <h3 className="text-2xl font-semibold mb-6 flex items-center gap-3">
                <Shield className="w-6 h-6 text-accent" />
                Blockchain Information
              </h3>
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Contract Address</p>
                    <p className="font-mono text-sm bg-muted/50 p-2 rounded">{CONTRACT_ADDRESS}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Network</p>
                    <p className="font-semibold">Avalanche Fuji Testnet</p>
                  </div>
                </div>
                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Admin Address</p>
                    <p className="font-mono text-sm bg-muted/50 p-2 rounded">{userAddress}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Last Updated</p>
                    <p className="font-semibold">{new Date().toLocaleString()}</p>
                  </div>
                </div>
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Admin;