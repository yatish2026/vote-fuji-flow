import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Calendar, Users, BarChart3, Clock, CheckCircle, AlertCircle } from 'lucide-react';
import { ethers } from 'ethers';
import { FACTORY_CONTRACT_ADDRESS, FACTORY_CONTRACT_ABI } from '@/lib/contract';
import { useTranslation } from 'react-i18next';

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

interface ElectionManagerProps {
  onElectionSelect: (electionId: number) => void;
  selectedElectionId?: number;
}

const ElectionManager: React.FC<ElectionManagerProps> = ({ onElectionSelect, selectedElectionId }) => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [elections, setElections] = useState<Election[]>([]);
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
    fetchElections();
  }, []);

  const fetchElections = async () => {
    try {
      setLoading(true);
      // @ts-ignore
      if (!window.ethereum) {
        toast({
          title: t('common.error'),
          description: t('voting.connectWalletFirst'),
          variant: 'destructive'
        });
        return;
      }

      // @ts-ignore
      const provider = new ethers.BrowserProvider(window.ethereum);
      const contract = new ethers.Contract(FACTORY_CONTRACT_ADDRESS, FACTORY_CONTRACT_ABI, provider);

      const electionCount = await contract.electionCount();
      const electionsList: Election[] = [];

      for (let i = 0; i < Number(electionCount); i++) {
        const election = await contract.elections(i);
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

      setElections(electionsList);
    } catch (error: any) {
      console.error('Error fetching elections:', error);
      toast({
        title: t('common.error'),
        description: t('voting.fetchError'),
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const createElection = async () => {
    try {
      if (!newElection.title.trim() || !newElection.description.trim()) {
        toast({
          title: t('common.error'),
          description: t('elections.fillAllFields'),
          variant: 'destructive'
        });
        return;
      }

      const validCandidates = newElection.candidates.filter(c => c.trim());
      if (validCandidates.length < 2) {
        toast({
          title: t('common.error'),
          description: t('elections.minimumCandidates'),
          variant: 'destructive'
        });
        return;
      }

      // @ts-ignore
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(FACTORY_CONTRACT_ADDRESS, FACTORY_CONTRACT_ABI, signer);

      const startTimestamp = Math.floor(new Date(newElection.startTime).getTime() / 1000);
      const endTimestamp = Math.floor(new Date(newElection.endTime).getTime() / 1000);

      if (startTimestamp <= Math.floor(Date.now() / 1000)) {
        toast({
          title: t('common.error'),
          description: t('elections.startTimeFuture'),
          variant: 'destructive'
        });
        return;
      }

      if (endTimestamp <= startTimestamp) {
        toast({
          title: t('common.error'),
          description: t('elections.endTimeAfterStart'),
          variant: 'destructive'
        });
        return;
      }

      const tx = await contract.createElection(
        newElection.title,
        newElection.description,
        validCandidates,
        startTimestamp,
        endTimestamp
      );

      toast({
        title: t('voting.voting'),
        description: t('elections.creatingElection'),
        variant: 'default'
      });

      await tx.wait();

      toast({
        title: t('common.success'),
        description: t('elections.electionCreated'),
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
      
      fetchElections();
    } catch (error: any) {
      console.error('Error creating election:', error);
      toast({
        title: t('common.error'),
        description: error.message || t('elections.createElectionError'),
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

  const removeCandidateField = (index: number) => {
    if (newElection.candidates.length > 2) {
      setNewElection(prev => ({
        ...prev,
        candidates: prev.candidates.filter((_, i) => i !== index)
      }));
    }
  };

  const updateCandidate = (index: number, value: string) => {
    setNewElection(prev => ({
      ...prev,
      candidates: prev.candidates.map((c, i) => i === index ? value : c)
    }));
  };

  const getElectionStatus = (election: Election) => {
    const now = Math.floor(Date.now() / 1000);
    if (!election.active) return 'ended';
    if (now < election.startTime) return 'upcoming';
    if (now > election.endTime) return 'expired';
    return 'active';
  };

  const formatDate = (timestamp: number) => {
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
              <Button onClick={createElection} className="w-full">
                {t('elections.createElection')}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

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