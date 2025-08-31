import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import ElectionManager from '@/components/ElectionManager';
import ElectionVoting from '@/components/ElectionVoting';
import { LanguageSelector } from '@/components/LanguageSelector';
import { VoiceControls } from '@/components/VoiceControls';

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
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent mb-2">
              {t('voting.title')}
            </h1>
            <p className="text-muted-foreground">{t('voting.selectElection')}</p>
          </div>
          <div className="flex gap-4">
            <LanguageSelector />
            <VoiceControls />
          </div>
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