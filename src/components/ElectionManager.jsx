import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Calendar, Users, BarChart3, Clock, CheckCircle, AlertCircle, Trash2 } from 'lucide-react';
import { ethers } from 'ethers';
import { FACTORY_CONTRACT_ADDRESS, FACTORY_CONTRACT_ABI } from '@/lib/contract';
import { useTranslation } from 'react-i18next';

const ElectionManager = ({ onElectionSelect, selectedElectionId, onElectionDeleted }) => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [elections, setElections] = useState([]);
  const [loading, setLoading] = useState(false);
  const [walletConnected, setWalletConnected] = useState(false);
  const [currentNetwork, setCurrentNetwork] = useState('');

  useEffect(() => {
    checkWalletConnection();
    // Load cached data immediately, then fetch fresh data
    loadCachedElections();
    fetchElections();
  }, []);

  const checkWalletConnection = async () => {
    if (!window.ethereum) {
      setWalletConnected(false);
      toast({
        title: 'Wallet Not Found',
        description: 'Please install MetaMask or Core Wallet to use this feature',
        variant: 'destructive'
      });
      return;
    }

    try {
      const accounts = await window.ethereum.request({ method: 'eth_accounts' });
      setWalletConnected(accounts.length > 0);
      
      if (accounts.length > 0) {
        const chainId = await window.ethereum.request({ method: 'eth_chainId' });
        setCurrentNetwork(chainId);
      }
    } catch (error) {
      console.error('Error checking wallet:', error);
      setWalletConnected(false);
    }
  };

  const connectWallet = async () => {
    try {
      if (!window.ethereum) {
        toast({
          title: 'Wallet Not Found',
          description: 'Please install MetaMask or Core Wallet',
          variant: 'destructive'
        });
        return;
      }

      await window.ethereum.request({ method: 'eth_requestAccounts' });
      await checkWalletConnection();
      
      toast({
        title: 'Wallet Connected',
        description: 'Wallet connected successfully',
        variant: 'default'
      });

      // Fetch elections after connecting
      fetchElections();
    } catch (error) {
      console.error('Error connecting wallet:', error);
      toast({
        title: 'Connection Failed',
        description: error.message || 'Failed to connect wallet',
        variant: 'destructive'
      });
    }
  };

  const loadCachedElections = () => {
    try {
      const cached = localStorage.getItem('elections-cache');
      if (cached) {
        const { data, timestamp } = JSON.parse(cached);
        // Use cache if less than 30 seconds old
        if (Date.now() - timestamp < 30000) {
          setElections(data);
          return;
        }
      }
    } catch (error) {
      console.log('No cached elections found');
    }
  };

  const fetchElections = async () => {
    try {
      setLoading(true);
      
      if (!window.ethereum) {
        setLoading(false);
        return;
      }

      try {
        const provider = new ethers.BrowserProvider(window.ethereum);
        const contract = new ethers.Contract(FACTORY_CONTRACT_ADDRESS, FACTORY_CONTRACT_ABI, provider);

        const electionCount = await contract.electionCount();
        console.log('Election count:', Number(electionCount));

        // Use batch requests for maximum speed
        const batchSize = 10;
        const electionsList = [];
        
        for (let i = 0; i < Number(electionCount); i += batchSize) {
          const batch = [];
          const batchEnd = Math.min(i + batchSize, Number(electionCount));
          
          for (let j = i; j < batchEnd; j++) {
            batch.push(
              contract.elections(j).catch(() => null)
            );
          }
          
          const batchResults = await Promise.all(batch);
          
          batchResults.forEach((election, index) => {
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
        
        // Cache the results
        localStorage.setItem('elections-cache', JSON.stringify({
          data: electionsList,
          timestamp: Date.now()
        }));
        
        if (electionsList.length === 0) {
          toast({
            title: t('elections.noElections'),
            description: t('elections.createFirstElection'),
            variant: 'default'
          });
        }
      } catch (error) {
        console.error('Contract error:', error);
        
        let errorMsg = 'Unable to load elections. ';
        if (error.code === 'BAD_DATA' || error.message?.includes('could not decode')) {
          errorMsg += 'Please make sure you are connected to the correct blockchain network (Core Testnet) and your wallet is properly connected.';
        } else {
          errorMsg += 'Please check your wallet connection and network.';
        }
        
        // Don't show error if we have cached data
        if (elections.length === 0) {
          toast({
            title: t('common.error'),
            description: errorMsg,
            variant: 'destructive'
          });
        }
      }
    } catch (error) {
      console.error('Error fetching elections:', error);
    } finally {
      setLoading(false);
    }
  };

  // Contract function for creating elections - kept for reference
  const createElection = async (electionData) => {
    try {
      if (!window.ethereum) {
        toast({
          title: t('common.error'),
          description: 'Please install MetaMask or Core Wallet',
          variant: 'destructive'
        });
        return;
      }

      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(FACTORY_CONTRACT_ADDRESS, FACTORY_CONTRACT_ABI, signer);

      const startTimestamp = Math.floor(new Date(electionData.startTime).getTime() / 1000);
      const endTimestamp = Math.floor(new Date(electionData.endTime).getTime() / 1000);

      toast({
        title: 'Processing',
        description: 'Please confirm the transaction in your wallet...',
        variant: 'default'
      });

      const tx = await contract.createElection(
        electionData.title,
        electionData.description,
        electionData.candidates,
        startTimestamp,
        endTimestamp
      );

      toast({
        title: 'Transaction Submitted',
        description: 'Creating election on blockchain...',
        variant: 'default'
      });

      const receipt = await tx.wait();
      
      console.log('Election created successfully!', receipt);

      toast({
        title: 'Success!',
        description: 'Election created successfully',
        variant: 'default'
      });
      
      localStorage.removeItem('elections-cache');
      await fetchElections();
      setTimeout(() => fetchElections(), 2000);
      setTimeout(() => fetchElections(), 4000);
    } catch (error) {
      console.error('Error creating election:', error);
      let errorMessage = 'Failed to create election';
      
      if (error.code === 4001) {
        errorMessage = 'Transaction was rejected';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive'
      });
    }
  };

  const deleteElection = async (electionId, electionTitle) => {
    if (!window.confirm(`${t('elections.confirmDelete')} "${electionTitle}"?`)) {
      return;
    }

    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(FACTORY_CONTRACT_ADDRESS, FACTORY_CONTRACT_ABI, signer);

      const tx = await contract.deleteElection(electionId);
      
      toast({
        title: t('voting.voting'),
        description: t('elections.deletingElection'),
        variant: "default"
      });

      await tx.wait();

      toast({
        title: t('common.success'),
        description: t('elections.electionDeleted'),
        variant: "default"
      });

      fetchElections();
      onElectionDeleted?.();
    } catch (error) {
      console.error('Error deleting election:', error);
      toast({
        title: t('common.error'),
        description: error.message || t('elections.deleteElectionError'),
        variant: 'destructive'
      });
    }
  };

  const getElectionStatus = (election) => {
    const now = Math.floor(Date.now() / 1000);
    if (!election.active) return 'ended';
    if (now < election.startTime) return 'upcoming';
    if (now > election.endTime) return 'expired';
    return 'active';
  };

  const formatDate = (timestamp) => {
    return new Date(timestamp * 1000).toLocaleString();
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            {t('elections.title')}
          </h2>
          <p className="text-muted-foreground mt-2">{t('elections.subtitle')}</p>
          {walletConnected && currentNetwork && (
            <p className="text-xs text-muted-foreground mt-1">
              Network: {currentNetwork === '0x45c' ? 'Core Testnet' : currentNetwork}
            </p>
          )}
        </div>
        {!walletConnected && (
          <Button 
            onClick={connectWallet}
            className="bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90"
          >
            Connect Wallet
          </Button>
        )}
      </div>

      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <Card key={i} className="p-6">
              <div className="space-y-4">
                <div className="flex justify-between items-start">
                  <div className="h-6 bg-muted rounded-md w-3/4 animate-pulse"></div>
                  <div className="h-5 bg-muted rounded-full w-16 animate-pulse"></div>
                </div>
                <div className="h-4 bg-muted rounded w-full animate-pulse"></div>
                <div className="h-4 bg-muted rounded w-2/3 animate-pulse"></div>
                <div className="flex gap-4">
                  <div className="h-4 bg-muted rounded w-20 animate-pulse"></div>
                  <div className="h-4 bg-muted rounded w-24 animate-pulse"></div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {!loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {elections.map((election) => {
            const status = getElectionStatus(election);
            return (
              <Card
                key={election.id}
                className={`p-6 cursor-pointer transition-all duration-300 hover:shadow-lg border-2 ${
                  selectedElectionId === election.id 
                    ? 'border-primary bg-primary/5' 
                    : 'border-border hover:border-primary/30'
                }`}
                onClick={() => onElectionSelect(election.id)}
              >
                <div className="space-y-4">
                  <div className="flex justify-between items-start">
                    <h3 className="text-xl font-semibold truncate">{election.title}</h3>
                    <div className="flex items-center gap-2">
                      <Badge variant={
                        status === 'active' ? 'default' :
                        status === 'upcoming' ? 'secondary' :
                        status === 'ended' ? 'outline' : 'destructive'
                      }>
                        {status === 'active' && <><CheckCircle className="w-3 h-3 mr-1" /> {t('admin.active')}</>}
                        {status === 'upcoming' && <><Clock className="w-3 h-3 mr-1" /> {t('elections.upcoming')}</>}
                        {status === 'ended' && <><AlertCircle className="w-3 h-3 mr-1" /> {t('admin.ended')}</>}
                        {status === 'expired' && <><AlertCircle className="w-3 h-3 mr-1" /> {t('elections.expired')}</>}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteElection(election.id, election.title);
                        }}
                        className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                  
                  <p className="text-muted-foreground text-sm line-clamp-2">
                    {election.description}
                  </p>
                  
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Calendar className="w-4 h-4" />
                      <span>{formatDate(election.startTime)} - {formatDate(election.endTime)}</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-1">
                        <Users className="w-4 h-4" />
                        <span>{election.candidatesCount} {t('elections.candidates')}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <BarChart3 className="w-4 h-4" />
                        <span>{election.totalVotes} {t('admin.totalVotes')}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {elections.length === 0 && !loading && (
        <Card className="p-12 text-center">
          <div className="text-muted-foreground">
            <BarChart3 className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p className="text-lg mb-2">{t('elections.noElections')}</p>
            <p className="text-sm">{t('elections.createFirstElection')}</p>
          </div>
        </Card>
      )}
    </div>
  );
};

export default ElectionManager;