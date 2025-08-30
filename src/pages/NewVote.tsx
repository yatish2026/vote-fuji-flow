import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import ElectionManager from '@/components/ElectionManager';
import ElectionVoting from '@/components/ElectionVoting';

const NewVote = () => {
  const { t } = useTranslation();
  const [selectedElectionId, setSelectedElectionId] = useState<number | null>(null);

  const handleElectionSelect = (electionId: number) => {
    setSelectedElectionId(electionId);
  };

  const handleBackToElections = () => {
    setSelectedElectionId(null);
  };

  if (selectedElectionId !== null) {
    return (
      <ElectionVoting 
        electionId={selectedElectionId} 
        onBack={handleBackToElections}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background/50 to-primary/5">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent mb-2">
            {t('voting.title')}
          </h1>
          <p className="text-muted-foreground">{t('voting.selectElection')}</p>
        </div>
        <ElectionManager 
          onElectionSelect={handleElectionSelect}
          selectedElectionId={selectedElectionId}
        />
      </div>
    </div>
  );
};

export default NewVote;