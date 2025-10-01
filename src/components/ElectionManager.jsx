import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Calendar, Users, BarChart3, Clock, CheckCircle, AlertCircle, Trash2 } from 'lucide-react';
import { ethers } from 'ethers';
import { FACTORY_CONTRACT_ADDRESS, FACTORY_CONTRACT_ABI } from '@/lib/contract';
import { useTranslation } from 'react-i18next';

const ElectionManager = ({ onElectionSelect, selectedElectionId, onElectionDeleted }) => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [elections, setElections] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newElection, setNewElection] = useState({
    title: '',
    description: '',
    candidates: ['', ''],
    startTime: '',
    endTime: ''
  });

  useEffect(() => {
    // Load cached data immediately, then fetch fresh data
    loadCachedElections();
    fetchElections();
  }, []);

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
        // Don't show error if we have cached data
        if (elections.length === 0) {
          toast({
            title: t('common.error'),
            description: 'Unable to load elections. Please check your connection.',
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

  const createElection = async () => {
    try {
      // Check wallet connection first
      if (!window.ethereum) {
        toast({
          title: t('common.error'),
          description: 'Please install MetaMask or Core Wallet',
          variant: 'destructive'
        });
        return;
      }

      // Validate form inputs
      if (!newElection.title.trim() || !newElection.description.trim()) {
        toast({
          title: t('common.error'),
          description: 'Please fill in all required fields',
          variant: 'destructive'
        });
        return;
      }

      const validCandidates = newElection.candidates.filter(c => c.trim());
      if (validCandidates.length < 2) {
        toast({
          title: t('common.error'),
          description: 'Please add at least 2 candidates',
          variant: 'destructive'
        });
        return;
      }

      if (!newElection.startTime || !newElection.endTime) {
        toast({
          title: t('common.error'),
          description: 'Please set start and end times',
          variant: 'destructive'
        });
        return;
      }

      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(FACTORY_CONTRACT_ADDRESS, FACTORY_CONTRACT_ABI, signer);

      const startTimestamp = Math.floor(new Date(newElection.startTime).getTime() / 1000);
      const endTimestamp = Math.floor(new Date(newElection.endTime).getTime() / 1000);

      if (startTimestamp <= Math.floor(Date.now() / 1000)) {
        toast({
          title: t('common.error'),
          description: 'Start time must be in the future',
          variant: 'destructive'
        });
        return;
      }

      if (endTimestamp <= startTimestamp) {
        toast({
          title: t('common.error'),
          description: 'End time must be after start time',
          variant: 'destructive'
        });
        return;
      }

      console.log('Creating election with:', {
        title: newElection.title,
        description: newElection.description,
        candidates: validCandidates,
        startTime: startTimestamp,
        endTime: endTimestamp
      });

      toast({
        title: 'Processing',
        description: 'Please confirm the transaction in your wallet...',
        variant: 'default'
      });

      const tx = await contract.createElection(
        newElection.title,
        newElection.description,
        validCandidates,
        startTimestamp,
        endTimestamp
      );

      toast({
        title: 'Transaction Submitted',
        description: 'Creating election on blockchain...',
        variant: 'default'
      });

      await tx.wait();

      toast({
        title: 'Success!',
        description: 'Election created successfully',
        variant: 'default'
      });

      setShowCreateDialog(false);
      setNewElection({
        title: '',
        description: '',
        candidates: ['', ''],
        startTime: '',
        endTime: ''
      });
      
      // Clear cache and refetch
      localStorage.removeItem('elections-cache');
      setTimeout(() => {
        fetchElections();
      }, 1000);
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

  const addCandidateField = () => {
    setNewElection(prev => ({
      ...prev,
      candidates: [...prev.candidates, '']
    }));
  };

  const removeCandidateField = (index) => {
    if (newElection.candidates.length > 2) {
      setNewElection(prev => ({
        ...prev,
        candidates: prev.candidates.filter((_, i) => i !== index)
      }));
    }
  };

  const updateCandidate = (index, value) => {
    setNewElection(prev => ({
      ...prev,
      candidates: prev.candidates.map((c, i) => i === index ? value : c)
    }));
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
        </div>
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button className="bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90">
              <Plus className="w-4 h-4 mr-2" />
              {t('elections.createElection')}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{t('elections.createNewElection')}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">{t('elections.electionTitle')}</label>
                <Input
                  value={newElection.title}
                  onChange={(e) => setNewElection(prev => ({ ...prev, title: e.target.value }))}
                  placeholder={t('elections.titlePlaceholder')}
                />
              </div>
              <div>
                <label className="text-sm font-medium">{t('elections.electionDescription')}</label>
                <Textarea
                  value={newElection.description}
                  onChange={(e) => setNewElection(prev => ({ ...prev, description: e.target.value }))}
                  placeholder={t('elections.descriptionPlaceholder')}
                  rows={3}
                />
              </div>
              <div>
                <label className="text-sm font-medium">{t('elections.candidates')}</label>
                {newElection.candidates.map((candidate, index) => (
                  <div key={index} className="flex gap-2 mt-2">
                    <Input
                      value={candidate}
                      onChange={(e) => updateCandidate(index, e.target.value)}
                      placeholder={`${t('elections.candidate')} ${index + 1}`}
                    />
                    {newElection.candidates.length > 2 && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => removeCandidateField(index)}
                      >
                        -
                      </Button>
                    )}
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addCandidateField}
                  className="mt-2"
                >
                  <Plus className="w-3 h-3 mr-1" />
                  {t('elections.addCandidate')}
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">{t('elections.startTime')}</label>
                  <Input
                    type="datetime-local"
                    value={newElection.startTime}
                    onChange={(e) => setNewElection(prev => ({ ...prev, startTime: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">{t('elections.endTime')}</label>
                  <Input
                    type="datetime-local"
                    value={newElection.endTime}
                    onChange={(e) => setNewElection(prev => ({ ...prev, endTime: e.target.value }))}
                  />
                </div>
              </div>
              <Button 
                onClick={createElection} 
                className="w-full bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90"
                type="button"
              >
                {t('elections.createElection')}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
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