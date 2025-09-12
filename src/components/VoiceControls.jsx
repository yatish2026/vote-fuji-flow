import { useState } from 'react';
import { Mic, MicOff, Volume2, VolumeX } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { useSpeech } from '@/hooks/useSpeech';
import { useToast } from '@/hooks/use-toast';

export const VoiceControls = ({ onVoiceCommand, compact = false }) => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { speak, startListening, stopListening, isListening, isSpeaking, isSupported } = useSpeech();
  const [lastSpokenText, setLastSpokenText] = useState('');

  const handleVoiceCommand = (transcript) => {
    console.log('Processing voice command:', transcript);
    
    // Convert to lowercase for easier matching
    const command = transcript.toLowerCase();
    
    // Basic command processing
    if (command.includes('vote') || command.includes('मत') || command.includes('ভোট') || command.includes('ಮತ') || command.includes('मत') || command.includes('வோட்')) {
      // Extract candidate name after "vote for" or similar phrases
      const votePatterns = [
        /vote\s+for\s+(.+)/i,
        /(.+)\s+को\s+वोट/i, // Hindi: "X को वोट"
        /(.+)\s+কে\s+ভোট/i, // Bengali: "X কে ভোট"
        /(.+)\s+ಗೆ\s+ಮತ/i, // Kannada: "X ಗೆ ಮತ"
        /(.+)\s+ला\s+मत/i, // Marathi: "X ला मत"
        /(.+)\s+க்கு\s+வோட்/i, // Tamil: "X க்கு வோட்"
      ];
      
      for (const pattern of votePatterns) {
        const match = transcript.match(pattern);
        if (match) {
          const candidateName = match[1].trim();
          toast({
            title: t('common.voiceCommands'),
            description: `${t('voice.votingFor')} ${candidateName}`,
          });
          onVoiceCommand?.(`VOTE:${candidateName}`);
          return;
        }
      }
      
      toast({
        title: t('common.voiceCommands'),
        description: t('common.voiceCommandsHelp'),
      });
    } else if (command.includes('result') || command.includes('परिणाम') || command.includes('ফলাফল') || command.includes('ಫಲಿತಾಂಶ') || command.includes('निकाल') || command.includes('முடிவு')) {
      toast({
        title: t('common.voiceCommands'),
        description: t('voice.showingResults'),
      });
      onVoiceCommand?.('SHOW_RESULTS');
    } else if (command.includes('insight') || command.includes('analysis') || command.includes('ai') || command.includes('विश्लेषण') || command.includes('বিশ্লেষণ') || command.includes('ವಿಶ್ಲೇಷಣೆ') || command.includes('विश्लेषण') || command.includes('பகுப்பாய்வு')) {
      toast({
        title: t('common.voiceCommands'),
        description: t('voice.showingInsights'),
      });
      onVoiceCommand?.('SHOW_AI_INSIGHTS');
    } else if (command.includes('connect') || command.includes('कनेक्ट') || command.includes('সংযুক্ত') || command.includes('ಸಂಪರ್ಕ') || command.includes('कनेक्ट') || command.includes('இணை')) {
      toast({
        title: t('common.voiceCommands'),
        description: t('voice.connectingWallet'),
      });
      onVoiceCommand?.('CONNECT_WALLET');
    } else if (command.includes('admin') || command.includes('प्रशासन') || command.includes('প্রশাসন') || command.includes('ನಿರ್ವಾಹಕ') || command.includes('प्रशासक') || command.includes('நிர্வாகி')) {
      toast({
        title: t('common.voiceCommands'),
        description: t('voice.openingAdmin'),
      });
      onVoiceCommand?.('OPEN_ADMIN');
    } else if (command.includes('create') || command.includes('बनाएं') || command.includes('তৈরি') || command.includes('ರಚಿಸಿ') || command.includes('तयार') || command.includes('உருவாக்கு')) {
      toast({
        title: t('common.voiceCommands'),
        description: t('voice.creatingElection'),
      });
      onVoiceCommand?.('CREATE_ELECTION');
    } else {
      // If no specific command recognized, just pass the transcript
      onVoiceCommand?.(transcript);
    }
  };

  const handleStartListening = () => {
    if (!isSupported) {
      toast({
        title: t('common.error'),
        description: t('common.speechNotSupported'),
        variant: 'destructive'
      });
      return;
    }
    
    startListening(handleVoiceCommand);
  };

  const handleSpeak = (text) => {
    const textToSpeak = text || lastSpokenText || t('common.voiceCommandsHelp');
    speak(textToSpeak);
    setLastSpokenText(textToSpeak);
  };

  if (!isSupported) {
    return null;
  }

  if (compact) {
    return (
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleStartListening}
          disabled={isListening}
          className="h-8 w-8 p-0 hover:bg-accent"
          title={t('common.voiceCommands')}
        >
          {isListening ? (
            <MicOff className="h-4 w-4 text-destructive animate-pulse" />
          ) : (
            <Mic className="h-4 w-4" />
          )}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => handleSpeak()}
          disabled={isSpeaking}
          className="h-8 w-8 p-0 hover:bg-accent"
          title={t('common.speakText')}
        >
          {isSpeaking ? (
            <VolumeX className="h-4 w-4 text-primary animate-pulse" />
          ) : (
            <Volume2 className="h-4 w-4" />
          )}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 p-4 border border-border rounded-lg bg-card">
      <h3 className="text-sm font-medium text-foreground">{t('common.voiceCommands')}</h3>
      <div className="flex items-center gap-2">
        <Button
          variant={isListening ? "destructive" : "default"}
          size="sm"
          onClick={isListening ? stopListening : handleStartListening}
          disabled={!isSupported}
          className="flex items-center gap-2"
        >
          {isListening ? (
            <>
              <MicOff className="h-4 w-4" />
              Stop Listening
            </>
          ) : (
            <>
              <Mic className="h-4 w-4" />
              Start Voice Commands
            </>
          )}
        </Button>
        
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleSpeak()}
          disabled={isSpeaking}
          className="flex items-center gap-2"
        >
          {isSpeaking ? (
            <>
              <VolumeX className="h-4 w-4" />
              Speaking...
            </>
          ) : (
            <>
              <Volume2 className="h-4 w-4" />
              {t('common.speakText')}
            </>
          )}
        </Button>
      </div>
      
      <p className="text-xs text-muted-foreground">
        {t('common.voiceCommandsHelp')}
      </p>
      
      {isListening && (
        <div className="flex items-center gap-2 text-sm text-primary animate-pulse">
          <div className="h-2 w-2 bg-primary rounded-full animate-ping" />
          {t('common.listeningForVoice')}
        </div>
      )}
    </div>
  );
};