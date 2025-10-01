import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Wallet, BarChart3, Users, CheckCircle, AlertCircle, ArrowLeft, LogOut, Loader2 } from 'lucide-react';
import { ethers } from 'ethers';
import ElectionManager from '@/components/ElectionManager';
import AIInsights from '@/components/AIInsights';
import { FACTORY_CONTRACT_ADDRESS, FACTORY_CONTRACT_ABI } from '@/lib/contract';
import { useTranslation } from 'react-i18next';

const NewAdmin = () => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [account, setAccount] = useState(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [selectedElectionId, setSelectedElectionId] = useState(null);
  const [networkName, setNetworkName] = useState('');
  const [selectedElection, setSelectedElection] = useState(null);
  const [candidates, setCandidates] = useState([]);
  const [winner, setWinner] = useState(null);
  const [loadingElection, setLoadingElection] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (isAdmin) {
      checkIfWalletIsConnected();
      if (window.ethereum) {
        window.ethereum.on('accountsChanged', handleAccountsChanged);
        window.ethereum.on('chainChanged', () => window.location.reload());
      }
    }
    return () => {
      if (window.ethereum) {
        window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
      }
    };
  }, [isAdmin]);

  const checkAuth = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        navigate('/auth');
        return;
      }

      // Check if user has admin role
      const { data: roles } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', session.user.id)
        .eq('role', 'admin')
        .single();

      if (!roles) {
        toast({
          title: 'Access Denied',
          description: 'You need admin privileges to access this page',
          variant: 'destructive',
        });
        navigate('/vote');
        return;
      }

      // Get profile
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();

      setProfile(profileData);
      setIsAdmin(true);
    } catch (error) {
      console.error('Auth check error:', error);
      navigate('/auth');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/auth');
  };

  const handleAccountsChanged = (accounts) => {
    if (accounts.length === 0) {
      setAccount(null);
      toast({
        title: t('wallet.disconnected'),
        description: t('wallet.pleaseConnect'),
        variant: 'default'
      });
    } else {
      setAccount(accounts[0]);
    }
  };

  const checkIfWalletIsConnected = async () => {
    try {
      if (!window.ethereum) {
        return;
      }

      const accounts = await window.ethereum.request({ method: 'eth_accounts' });
      
      if (accounts.length > 0) {
        setAccount(accounts[0]);
        await checkNetwork();
      }
    } catch (error) {
      console.error('Error checking wallet connection:', error);
    }
  };

  const checkNetwork = async () => {
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const network = await provider.getNetwork();
      setNetworkName(network.name === 'unknown' ? 'Avalanche Fuji' : network.name);
    } catch (error) {
      console.error('Error checking network:', error);
    }
  };

  const connectWallet = async () => {
    if (!window.ethereum) {
      toast({
        title: t('wallet.notInstalled'),
        description: t('wallet.installCore'),
        variant: 'destructive'
      });
      return;
    }

    try {
      setIsConnecting(true);
      const accounts = await window.ethereum.request({
        method: 'eth_requestAccounts'
      });

      setAccount(accounts[0]);
      await checkNetwork();

      toast({
        title: t('wallet.connected'),
        description: `${t('wallet.address')}: ${accounts[0].substring(0, 6)}...${accounts[0].substring(38)}`,
        variant: 'default'
      });
    } catch (error) {
      console.error('Error connecting wallet:', error);
      toast({
        title: t('common.error'),
        description: error.message || t('wallet.connectionFailed'),
        variant: 'destructive'
      });
    } finally {
      setIsConnecting(false);
    }
  };

  const disconnectWallet = () => {
    setAccount(null);
    setSelectedElectionId(null);
    setSelectedElection(null);
    toast({
      title: t('wallet.disconnected'),
      description: t('wallet.successfullyDisconnected'),
      variant: 'default'
    });
  };

  const handleElectionSelect = async (electionId) => {
    setSelectedElectionId(electionId);
    await fetchElectionDetails(electionId);
  };

  const fetchElectionDetails = async (electionId) => {
    try {
      setLoadingElection(true);
      const provider = new ethers.BrowserProvider(window.ethereum);
      const contract = new ethers.Contract(FACTORY_CONTRACT_ADDRESS, FACTORY_CONTRACT_ABI, provider);

      // Fetch election and candidates data
      const [electionResult, candidateResults, winnerResult] = await Promise.allSettled([
        contract.getElection(electionId),
        Promise.all(
          Array.from({ length: 10 }, (_, i) => 
            contract.getCandidate(electionId, i).catch(() => null)
          )
        ),
        contract.getWinner(electionId).catch(() => null)
      ]);

      if (electionResult.status === 'fulfilled') {
        const [title, description, startTime, endTime, active, candidatesCount, totalVotes] = electionResult.value;
        
        const electionData = {
          id: electionId,
          title,
          description,
          startTime: Number(startTime),
          endTime: Number(endTime),
          active,
          candidatesCount: Number(candidatesCount),
          totalVotes: Number(totalVotes)
        };
        
        setSelectedElection(electionData);

        // Process candidates
        const candidatesList = [];
        if (candidateResults.status === 'fulfilled') {
          candidateResults.value
            .filter(result => result !== null)
            .forEach((result) => {
              try {
                const [candidateId, candidateName, candidateVotes] = result;
                const fullName = candidateName.toString().trim();
                if (fullName) {
                  candidatesList.push({
                    id: Number(candidateId),
                    name: fullName,
                    votes: Number(candidateVotes)
                  });
                }
              } catch (err) {
                console.log('Error processing candidate');
              }
            });
        }
        setCandidates(candidatesList);

        // Process winner
        let winnerData = null;
        if (winnerResult.status === 'fulfilled' && winnerResult.value) {
          const [winnerName, winnerVotes] = winnerResult.value;
          winnerData = { name: winnerName, votes: Number(winnerVotes) };
          setWinner(winnerData);
        }
      }
    } catch (error) {
      console.error('Error fetching election details:', error);
      toast({
        title: t('common.error'),
        description: 'Failed to load election details',
        variant: 'destructive'
      });
    } finally {
      setLoadingElection(false);
    }
  };

  const handleBackToList = () => {
    setSelectedElectionId(null);
    setSelectedElection(null);
    setCandidates([]);
    setWinner(null);
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!account) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 py-12 px-4">
        <div className="container mx-auto max-w-md">
          <Card className="border-2 shadow-elegant">
            <CardHeader className="text-center space-y-4">
              <div className="mx-auto w-16 h-16 bg-gradient-to-r from-primary to-accent rounded-full flex items-center justify-center">
                <Wallet className="w-8 h-8 text-white" />
              </div>
              <CardTitle className="text-3xl bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                {t('admin.title')}
              </CardTitle>
              <CardDescription className="text-base">
                {t('admin.connectWallet')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {!window.ethereum ? (
                <div className="text-center space-y-4">
                  <AlertCircle className="w-12 h-12 mx-auto text-warning" />
                  <p className="text-muted-foreground">{t('wallet.notInstalled')}</p>
                  <Button
                    asChild
                    className="w-full bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90"
                  >
                    <a href="https://core.app/" target="_blank" rel="noopener noreferrer">
                      {t('wallet.installCore')}
                    </a>
                  </Button>
                </div>
              ) : (
                <Button
                  onClick={connectWallet}
                  disabled={isConnecting}
                  className="w-full bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 h-12 text-lg"
                >
                  <Wallet className="w-5 h-5 mr-2" />
                  {isConnecting ? t('wallet.connecting') : t('wallet.connect')}
                </Button>
              )}
              <div className="pt-4 space-y-2 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-success" />
                  <span>{t('admin.createElections')}</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-success" />
                  <span>{t('admin.manageVoting')}</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-success" />
                  <span>{t('admin.viewAnalytics')}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      {/* Header */}
      <div className="border-b border-border/50 bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                {t('admin.dashboard')}
              </h1>
              <p className="text-sm text-muted-foreground">{t('admin.subtitle')}</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right hidden md:block">
                <Badge variant="outline" className="mb-1">
                  {networkName || 'Avalanche Fuji'}
                </Badge>
                <p className="text-xs text-muted-foreground">
                  {account.substring(0, 6)}...{account.substring(38)}
                </p>
              </div>
              <Button
                onClick={disconnectWallet}
                variant="outline"
                size="sm"
                className="border-warning/50 text-warning hover:bg-warning/10"
              >
                <Wallet className="w-4 h-4 mr-2" />
                {t('wallet.disconnect')}
              </Button>
              <Button
                onClick={handleLogout}
                variant="outline"
                size="sm"
                className="border-destructive/50 text-destructive hover:bg-destructive/10"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Logout
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        {!selectedElectionId ? (
          <ElectionManager
            onElectionSelect={handleElectionSelect}
            selectedElectionId={selectedElectionId}
            onElectionDeleted={() => setSelectedElectionId(null)}
          />
        ) : (
          <div className="space-y-6">
            <Button 
              variant="outline" 
              onClick={handleBackToList}
              className="border-primary/20"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              {t('elections.backToElections')}
            </Button>

            {loadingElection ? (
              <Card className="p-12">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
                  <p className="mt-4 text-muted-foreground">{t('common.loading')}</p>
                </div>
              </Card>
            ) : selectedElection ? (
              <>
                {/* Election Details */}
                <Card className="p-8 bg-gradient-to-br from-card/90 to-card/70 backdrop-blur-xl border-primary/30">
                  <div className="text-center mb-6">
                    <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                      {selectedElection.title}
                    </h1>
                    <p className="text-muted-foreground text-lg">{selectedElection.description}</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="text-center p-4 bg-primary/10 rounded-lg">
                      <CheckCircle className="w-6 h-6 mx-auto mb-2 text-primary" />
                      <p className="text-sm text-muted-foreground">{t('admin.status')}</p>
                      <Badge variant={selectedElection.active ? 'default' : 'outline'}>
                        {selectedElection.active ? t('admin.active') : t('admin.ended')}
                      </Badge>
                    </div>
                    <div className="text-center p-4 bg-accent/10 rounded-lg">
                      <Users className="w-6 h-6 mx-auto mb-2 text-accent" />
                      <p className="text-sm text-muted-foreground">{t('elections.candidates')}</p>
                      <p className="font-semibold">{selectedElection.candidatesCount}</p>
                    </div>
                    <div className="text-center p-4 bg-success/10 rounded-lg">
                      <BarChart3 className="w-6 h-6 mx-auto mb-2 text-success" />
                      <p className="text-sm text-muted-foreground">{t('admin.totalVotes')}</p>
                      <p className="font-semibold">{selectedElection.totalVotes}</p>
                    </div>
                    <div className="text-center p-4 bg-primary-glow/10 rounded-lg">
                      <CheckCircle className="w-6 h-6 mx-auto mb-2 text-primary-glow" />
                      <p className="text-sm text-muted-foreground">{t('admin.winner')}</p>
                      <p className="font-semibold">{winner ? winner.name : '-'}</p>
                    </div>
                  </div>
                </Card>

                {/* Candidates Results */}
                <Card className="p-6">
                  <h3 className="text-2xl font-bold mb-6 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                    {t('voting.candidateResults')}
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {candidates.map((candidate) => {
                      const percentage = selectedElection.totalVotes > 0 
                        ? (candidate.votes / selectedElection.totalVotes) * 100 
                        : 0;
                      const isWinner = winner && winner.name === candidate.name;

                      return (
                        <Card 
                          key={candidate.id} 
                          className={`p-6 transition-all ${
                            isWinner 
                              ? 'border-2 border-primary bg-primary/5 shadow-elegant' 
                              : 'border border-border'
                          }`}
                        >
                          <div className="flex justify-between items-start mb-4">
                            <div>
                              <h4 className="font-semibold text-lg flex items-center gap-2">
                                {candidate.name}
                                {isWinner && (
                                  <Badge className="bg-gradient-to-r from-primary to-accent">
                                    {t('voting.winner')}
                                  </Badge>
                                )}
                              </h4>
                              <p className="text-sm text-muted-foreground">
                                {candidate.votes} {t('voting.candidateVotes')} ({percentage.toFixed(1)}%)
                              </p>
                            </div>
                          </div>
                          <div className="w-full bg-muted rounded-full h-3">
                            <div
                              className="bg-gradient-to-r from-primary to-accent h-3 rounded-full transition-all duration-500"
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                        </Card>
                      );
                    })}
                  </div>
                </Card>

                {/* AI Insights */}
                {selectedElection.totalVotes > 0 && (
                  <AIInsights 
                    election={selectedElection}
                    candidates={candidates}
                    winner={winner}
                  />
                )}
              </>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
};

export default NewAdmin;
