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
  Clock, CheckCircle, AlertCircle, Wallet 
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
    const token = localStorage.getItem('adminToken');
    if (token) {
      try {
        const response = await fetch('/api/analytics', {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (response.ok) {
          setIsAuthenticated(true);
        } else {
          localStorage.removeItem('adminToken');
        }
      } catch (error) {
        localStorage.removeItem('adminToken');
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
        throw new Error('Access denied: You are not the admin');
      }

      // Get nonce for signature
      const nonceResponse = await fetch('/api/admin/nonce');
      const { nonce } = await nonceResponse.json();

      // Sign the nonce
      const message = `Admin authentication nonce: ${nonce}`;
      const signature = await signer.signMessage(message);

      // Submit signature for verification
      const authResponse = await fetch('/api/admin/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address, signature, nonce })
      });

      if (!authResponse.ok) {
        throw new Error('Authentication failed');
      }

      const { token } = await authResponse.json();
      localStorage.setItem('adminToken', token);
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
      const token = localStorage.getItem('adminToken');
      const response = await fetch('/api/analytics', {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (!response.ok) throw new Error('Failed to fetch analytics');
      
      const data = await response.json();
      setAnalytics(data);
    } catch (error) {
      console.error('Error fetching analytics:', error);
      toast({
        title: "Error",
        description: "Failed to fetch analytics data",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchElectionStatus = async () => {
    try {
      const response = await fetch('/api/status');
      const data = await response.json();
      setElectionStatus(data);
    } catch (error) {
      console.error('Error fetching election status:', error);
    }
  };

  const exportResults = async () => {
    try {
      const token = localStorage.getItem('adminToken');
      const response = await fetch('/api/admin/export', {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (!response.ok) throw new Error('Export failed');
      
      const blob = await response.blob();
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
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary/20 flex items-center justify-center">
        <Card className="max-w-md w-full mx-4 p-8 text-center">
          <Shield className="w-16 h-16 mx-auto mb-6 text-primary" />
          <h1 className="text-3xl font-bold mb-4">Admin Access</h1>
          <p className="text-muted-foreground mb-8">
            Connect your wallet and verify admin privileges to access the dashboard
          </p>
          <Button
            onClick={connectWalletAndAuth}
            disabled={isAuthenticating}
            size="lg"
            className="w-full"
          >
            <Wallet className="w-4 h-4 mr-2" />
            {isAuthenticating ? 'Authenticating...' : 'Connect & Authenticate'}
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary/20">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-primary to-primary-glow bg-clip-text text-transparent">
              Admin Dashboard
            </h1>
            <p className="text-muted-foreground">Election analytics and management</p>
          </div>
          <div className="flex gap-4">
            <Button onClick={fetchAnalytics} disabled={loading} variant="outline">
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button onClick={exportResults} variant="outline">
              <Download className="w-4 h-4 mr-2" />
              Export CSV
            </Button>
            {electionStatus?.electionActive && (
              <Button onClick={endElection} variant="destructive">
                End Election
              </Button>
            )}
          </div>
        </div>

        {/* Status Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Votes</p>
                <p className="text-3xl font-bold">{analytics?.totalVotes || 0}</p>
              </div>
              <Users className="w-8 h-8 text-primary" />
            </div>
          </Card>
          
          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Election Status</p>
                <Badge className={electionStatus?.electionActive ? 'bg-success' : 'bg-destructive'}>
                  {electionStatus?.electionActive ? 'Active' : 'Ended'}
                </Badge>
              </div>
              {electionStatus?.electionActive ? 
                <Clock className="w-8 h-8 text-success" /> : 
                <CheckCircle className="w-8 h-8 text-destructive" />
              }
            </div>
          </Card>
          
          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Leading Candidate</p>
                <p className="text-lg font-semibold">{analytics?.winner?.name || 'N/A'}</p>
              </div>
              <TrendingUp className="w-8 h-8 text-accent" />
            </div>
          </Card>
          
          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Lead Margin</p>
                <p className="text-2xl font-bold">{analytics?.winner?.percentage || 0}%</p>
              </div>
              <AlertCircle className="w-8 h-8 text-warning" />
            </div>
          </Card>
        </div>

        {/* Analytics Tabs */}
        <Tabs defaultValue="results" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="results">Vote Results</TabsTrigger>
            <TabsTrigger value="demographics">Demographics</TabsTrigger>
            <TabsTrigger value="insights">Insights</TabsTrigger>
          </TabsList>

          <TabsContent value="results" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Bar Chart */}
              <Card className="p-6">
                <h3 className="text-xl font-semibold mb-4">Vote Distribution</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={analytics?.votes || []}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="candidate" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="votes" fill="#8b5cf6" />
                  </BarChart>
                </ResponsiveContainer>
              </Card>

              {/* Pie Chart */}
              <Card className="p-6">
                <h3 className="text-xl font-semibold mb-4">Vote Share</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={analytics?.votes || []}
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="votes"
                      label={({ candidate, percentage }) => `${candidate}: ${percentage}%`}
                    >
                      {(analytics?.votes || []).map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </Card>
            </div>

            {/* Results Table */}
            <Card className="p-6">
              <h3 className="text-xl font-semibold mb-4">Detailed Results</h3>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2">Candidate</th>
                      <th className="text-right p-2">Votes</th>
                      <th className="text-right p-2">Percentage</th>
                      <th className="text-right p-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analytics?.votes?.map((vote, index) => (
                      <tr key={index} className="border-b">
                        <td className="p-2 font-medium">{vote.candidate}</td>
                        <td className="p-2 text-right">{vote.votes}</td>
                        <td className="p-2 text-right">{vote.percentage}%</td>
                        <td className="p-2 text-right">
                          {vote.candidate === analytics?.winner?.name && (
                            <Badge className="bg-success">Winner</Badge>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="demographics" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Age Groups */}
              <Card className="p-6">
                <h3 className="text-xl font-semibold mb-4">Age Distribution</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={analytics?.demographics?.ageGroups || []}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="ageGroup" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="count" fill="#f59e0b" />
                  </BarChart>
                </ResponsiveContainer>
              </Card>

              {/* Gender Distribution */}
              <Card className="p-6">
                <h3 className="text-xl font-semibold mb-4">Gender Distribution</h3>
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
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </Card>
            </div>

            {/* Top Locations */}
            <Card className="p-6">
              <h3 className="text-xl font-semibold mb-4">Top Voting Locations</h3>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2">Location</th>
                      <th className="text-right p-2">Votes</th>
                      <th className="text-right p-2">Percentage</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analytics?.demographics?.locations?.slice(0, 10).map((location, index) => (
                      <tr key={index} className="border-b">
                        <td className="p-2 font-medium">{location.location}</td>
                        <td className="p-2 text-right">{location.count}</td>
                        <td className="p-2 text-right">
                          {((location.count / (analytics?.totalVotes || 1)) * 100).toFixed(1)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="insights" className="space-y-6">
            <Card className="p-6">
              <h3 className="text-xl font-semibold mb-4">Key Insights</h3>
              <div className="space-y-4">
                <div className="p-4 bg-primary/10 rounded-lg">
                  <h4 className="font-semibold text-primary mb-2">Election Summary</h4>
                  <p className="text-sm">
                    {analytics?.winner?.name} is leading with {analytics?.winner?.percentage}% 
                    ({analytics?.winner?.votes} votes) out of {analytics?.totalVotes} total votes cast.
                  </p>
                </div>
                
                <div className="p-4 bg-accent/10 rounded-lg">
                  <h4 className="font-semibold text-accent mb-2">Participation</h4>
                  <p className="text-sm">
                    Total participation: {analytics?.totalVotes} voters have cast their ballots.
                    The election is currently {electionStatus?.electionActive ? 'active' : 'concluded'}.
                  </p>
                </div>
                
                <div className="p-4 bg-success/10 rounded-lg">
                  <h4 className="font-semibold text-success mb-2">Transparency</h4>
                  <p className="text-sm">
                    All votes are recorded on the Avalanche blockchain, ensuring complete transparency 
                    and immutability. Voters can verify their participation through the blockchain explorer.
                  </p>
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