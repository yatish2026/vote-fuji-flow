import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Mic, MicOff, Volume2, VolumeX, Loader2, X, MessageCircle, Square, Languages } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { ethers } from 'ethers';
import { supabase } from '@/integrations/supabase/client';

declare global {
  interface Window {
    ethereum?: any;
    webkitSpeechRecognition?: any;
    SpeechRecognition?: any;
  }
}

interface SpeechRecognitionEvent {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEvent {
  error: string;
}

interface SpeechRecognition {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

// Contract ABI for voting functions
const CONTRACT_ABI = [
  "function getElectionCount() view returns (uint256)",
  "function getElectionDetails(uint256) view returns (string, uint256, uint256, bool, address)",
  "function getCandidates(uint256) view returns (tuple(string name, uint256 voteCount)[])",
  "function vote(uint256 electionId, uint256 candidateId)",
  "function createElection(string memory title, string[] memory candidateNames, uint256 durationInMinutes)",
  "function electionCount() view returns (uint256)",
  "function getElection(uint256) view returns (string, string, uint256, uint256, bool, uint256, uint256)",
  "function getCandidate(uint256, uint256) view returns (uint256, string, uint256)"
];

const CONTRACT_ADDRESS = "0x1549f7Ddd4fCE6109F448A1C6dFDF0694d3a5fbd";

// Supported languages
const LANGUAGES = [
  { code: 'te-IN', name: 'Telugu', native: 'తెలుగు' },
  { code: 'hi-IN', name: 'Hindi', native: 'हिंदी' },
  { code: 'en-US', name: 'English', native: 'English' },
  { code: 'ta-IN', name: 'Tamil', native: 'தமிழ்' },
  { code: 'kn-IN', name: 'Kannada', native: 'ಕನ್ನಡ' },
];

interface VoiceAssistantProps {
  className?: string;
}

export const VoiceAssistant: React.FC<VoiceAssistantProps> = ({ className }) => {
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isMinimized, setIsMinimized] = useState(true);
  const [transcript, setTranscript] = useState('');
  const [response, setResponse] = useState('');
  const [selectedLanguage, setSelectedLanguage] = useState('te-IN'); // Default to Telugu
  const [showLanguageMenu, setShowLanguageMenu] = useState(false);
  
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const synthRef = useRef<SpeechSynthesisUtterance | null>(null);
  const isListeningRef = useRef(false);
  const isProcessingRef = useRef(false);
  
  const { toast } = useToast();
  const navigate = useNavigate();

  // Keep refs in sync
  useEffect(() => {
    isListeningRef.current = isListening;
  }, [isListening]);

  useEffect(() => {
    isProcessingRef.current = isProcessing;
  }, [isProcessing]);

  // Initialize Speech Recognition with selected language
  const initRecognition = useCallback(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = selectedLanguage;

      console.log('🎤 Speech recognition initialized with language:', selectedLanguage);

      recognitionRef.current.onresult = (event: SpeechRecognitionEvent) => {
        let finalTranscript = '';
        let interimTranscript = '';
        
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          if (result.isFinal) {
            finalTranscript += result[0].transcript;
          } else {
            interimTranscript += result[0].transcript;
          }
        }
        
        console.log('📝 Transcript:', { final: finalTranscript, interim: interimTranscript });
        
        if (finalTranscript) {
          setTranscript(finalTranscript);
          processVoiceCommand(finalTranscript);
        } else if (interimTranscript) {
          setTranscript(interimTranscript);
        }
      };

      recognitionRef.current.onerror = (event: SpeechRecognitionErrorEvent) => {
        console.error('Speech recognition error:', event.error);
        if (event.error !== 'no-speech' && event.error !== 'aborted') {
          toast({ title: 'Voice Error', description: event.error });
        }
      };

      recognitionRef.current.onend = () => {
        console.log('🔚 Recognition ended, isListening:', isListeningRef.current);
        if (isListeningRef.current && !isProcessingRef.current) {
          try {
            recognitionRef.current?.start();
          } catch (e) {
            console.log('Recognition restart skipped');
          }
        }
      };
    }
  }, [selectedLanguage, toast]);

  // Re-initialize when language changes
  useEffect(() => {
    initRecognition();
    // Load voices
    window.speechSynthesis.getVoices();

    return () => {
      recognitionRef.current?.stop();
      window.speechSynthesis.cancel();
    };
  }, [initRecognition]);

  // Speak response in detected language
  const speak = useCallback((text: string, lang: string = selectedLanguage) => {
    if (!text) return;
    
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang;
    utterance.rate = 0.9; // Slightly slower for clarity
    utterance.pitch = 1.0;
    
    const voices = window.speechSynthesis.getVoices();
    const langCode = lang.split('-')[0];
    
    // Try to find best voice for the language
    let voice = voices.find(v => v.lang === lang);
    if (!voice) voice = voices.find(v => v.lang.startsWith(langCode));
    if (!voice) voice = voices.find(v => v.lang.startsWith('en'));
    if (!voice && voices.length > 0) voice = voices[0];
    
    if (voice) {
      utterance.voice = voice;
      console.log('🔊 Using voice:', voice.name, voice.lang);
    }
    
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = (e) => {
      console.error('Speech error:', e);
      setIsSpeaking(false);
    };
    
    synthRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  }, [selectedLanguage]);

  // Process voice command with Gemini
  const processVoiceCommand = useCallback(async (text: string) => {
    if (!text.trim() || isProcessingRef.current) return;
    
    setIsProcessing(true);
    console.log('🎤 Processing:', text, 'Language:', selectedLanguage);

    try {
      const { data, error } = await supabase.functions.invoke('gemini-voice', {
        body: { message: text, language: selectedLanguage }
      });

      if (error) throw error;

      console.log('🤖 Response:', data);
      const responseText = data.response || '';
      setResponse(responseText);
      
      // Detect language from response for TTS
      let ttsLang = selectedLanguage;
      if (/[\u0C00-\u0C7F]/.test(responseText)) ttsLang = 'te-IN'; // Telugu
      else if (/[\u0900-\u097F]/.test(responseText)) ttsLang = 'hi-IN'; // Hindi
      else if (/[\u0B80-\u0BFF]/.test(responseText)) ttsLang = 'ta-IN'; // Tamil
      else if (/[\u0C80-\u0CFF]/.test(responseText)) ttsLang = 'kn-IN'; // Kannada
      else if (/[\u0980-\u09FF]/.test(responseText)) ttsLang = 'bn-IN'; // Bengali
      else if (/[a-zA-Z]/.test(responseText)) ttsLang = 'en-US'; // English
      
      console.log('🗣️ TTS Language:', ttsLang);
      speak(responseText, ttsLang);

      if (data.action) {
        await executeAction(data.action);
      }

    } catch (error) {
      console.error('❌ Error processing command:', error);
      const errorMsg = selectedLanguage.startsWith('te') 
        ? 'క్షమించండి, ప్రాసెస్ చేయడంలో సమస్య. మళ్ళీ ప్రయత్నించండి.'
        : selectedLanguage.startsWith('hi')
        ? 'क्षमा करें, प्रोसेस करने में समस्या हुई। कृपया पुनः प्रयास करें।'
        : 'Sorry, I had trouble processing that. Please try again.';
      setResponse(errorMsg);
      speak(errorMsg, selectedLanguage);
    } finally {
      setIsProcessing(false);
    }
  }, [selectedLanguage, speak]);

  // Execute parsed action
  const executeAction = useCallback(async (action: any) => {
    console.log('⚡ Executing action:', action);

    switch (action.action) {
      case 'navigate':
        const routes: Record<string, string> = {
          'home': '/',
          'vote': '/vote',
          'admin': '/admin',
          'results': '/vote',
          'auth': '/auth'
        };
        const route = routes[action.page] || '/';
        navigate(route);
        toast({ title: `Navigating to ${action.page}` });
        break;

      case 'list_elections':
        await listElections();
        break;

      case 'get_election':
        await getElectionDetails(action.electionId);
        break;

      case 'cast_vote':
        await castVote(action.electionId, action.candidateId);
        break;

      case 'create_election':
        await createElection(action.title, action.candidates);
        break;
    }
  }, [navigate, toast]);

  // Blockchain functions
  const getContract = useCallback(async (needSigner = false) => {
    if (!window.ethereum) {
      throw new Error('Please install MetaMask');
    }
    const provider = new ethers.BrowserProvider(window.ethereum);
    if (needSigner) {
      const signer = await provider.getSigner();
      return new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
    }
    return new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);
  }, []);

  const listElections = useCallback(async () => {
    try {
      const contract = await getContract();
      let count;
      try {
        count = await contract.getElectionCount();
      } catch {
        count = await contract.electionCount();
      }
      
      const elections: string[] = [];
      for (let i = 0; i < Number(count); i++) {
        try {
          let title;
          try {
            const details = await contract.getElectionDetails(i);
            title = details[0];
          } catch {
            const election = await contract.getElection(i);
            title = election[0];
          }
          elections.push(`${i + 1}. ${title}`);
        } catch (e) {
          console.log('Error fetching election', i);
        }
      }
      
      const message = elections.length > 0 
        ? `Found ${elections.length} elections: ${elections.join(', ')}`
        : 'No elections found.';
      
      speak(message, selectedLanguage);
      setResponse(message);
    } catch (error) {
      console.error('Error listing elections:', error);
      const msg = 'Could not fetch elections. Make sure your wallet is connected.';
      speak(msg);
      setResponse(msg);
    }
  }, [getContract, speak, selectedLanguage]);

  const getElectionDetails = useCallback(async (electionId: number) => {
    try {
      const contract = await getContract();
      let title, candidateList;
      
      try {
        const details = await contract.getElectionDetails(electionId);
        title = details[0];
        const candidates = await contract.getCandidates(electionId);
        candidateList = candidates.map((c: any, i: number) => 
          `${i + 1}. ${c.name} with ${c.voteCount} votes`
        ).join(', ');
      } catch {
        const election = await contract.getElection(electionId);
        title = election[0];
        const candidatesCount = Number(election[5]);
        const candidates = [];
        for (let i = 0; i < candidatesCount; i++) {
          const c = await contract.getCandidate(electionId, i);
          candidates.push(`${i + 1}. ${c[1]} with ${c[2]} votes`);
        }
        candidateList = candidates.join(', ');
      }
      
      const message = `Election: ${title}. Candidates: ${candidateList}`;
      speak(message, selectedLanguage);
      setResponse(message);
    } catch (error) {
      console.error('Error getting election:', error);
      const msg = 'Could not fetch election details.';
      speak(msg);
      setResponse(msg);
    }
  }, [getContract, speak, selectedLanguage]);

  const castVote = useCallback(async (electionId: number, candidateId: number) => {
    try {
      const contract = await getContract(true);
      toast({ title: 'Casting vote...' });
      
      const tx = await contract.vote(electionId, candidateId);
      await tx.wait();
      
      const message = 'Your vote has been cast successfully!';
      speak(message, selectedLanguage);
      setResponse(message);
      toast({ title: 'Vote Cast!', description: 'Transaction confirmed.' });
    } catch (error: any) {
      console.error('Error casting vote:', error);
      const errMsg = error.reason || 'Failed to cast vote.';
      speak(errMsg);
      setResponse(errMsg);
      toast({ title: 'Vote Failed', description: errMsg });
    }
  }, [getContract, speak, selectedLanguage, toast]);

  const createElection = useCallback(async (title: string, candidates: string[]) => {
    try {
      const contract = await getContract(true);
      toast({ title: 'Creating election...' });
      
      const tx = await contract.createElection(title, candidates, 60);
      await tx.wait();
      
      const message = `Election "${title}" created successfully!`;
      speak(message, selectedLanguage);
      setResponse(message);
      toast({ title: 'Election Created!', description: message });
    } catch (error: any) {
      console.error('Error creating election:', error);
      const errMsg = 'Failed to create election.';
      speak(errMsg);
      setResponse(errMsg);
      toast({ title: 'Creation Failed', description: error.reason || 'Unknown error' });
    }
  }, [getContract, speak, selectedLanguage, toast]);

  // Start listening
  const startListening = useCallback(() => {
    setTranscript('');
    setResponse('');
    try {
      recognitionRef.current?.start();
      setIsListening(true);
      const greeting = selectedLanguage.startsWith('te') 
        ? 'నేను వింటున్నాను. మీకు ఎలా సహాయం చేయగలను?'
        : selectedLanguage.startsWith('hi')
        ? 'मैं सुन रहा हूं। मैं आपकी कैसे मदद कर सकता हूं?'
        : 'I\'m listening. How can I help you?';
      speak(greeting, selectedLanguage);
    } catch (e) {
      console.error('Failed to start recognition:', e);
    }
  }, [selectedLanguage, speak]);

  // Stop listening
  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    setIsListening(false);
  }, []);

  // Stop speaking
  const stopSpeaking = useCallback(() => {
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
  }, []);

  // Change language
  const changeLanguage = useCallback((langCode: string) => {
    setSelectedLanguage(langCode);
    setShowLanguageMenu(false);
    
    // Stop current listening and reinitialize
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
    }
    
    const lang = LANGUAGES.find(l => l.code === langCode);
    toast({ title: `Language changed to ${lang?.native || langCode}` });
  }, [isListening, toast]);

  const isSupported = 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;
  const currentLang = LANGUAGES.find(l => l.code === selectedLanguage);

  if (!isSupported) {
    return null;
  }

  if (isMinimized) {
    return (
      <Button
        onClick={() => setIsMinimized(false)}
        style={{ position: 'fixed', bottom: '32px', right: '32px', zIndex: 9999 }}
        className="h-20 w-20 rounded-full bg-primary shadow-lg hover:bg-primary/90"
        size="icon"
      >
        <MessageCircle className="h-10 w-10" />
      </Button>
    );
  }

  return (
    <div 
      style={{ position: 'fixed', bottom: '32px', right: '32px', zIndex: 9999 }}
      className={`w-96 rounded-xl border bg-card shadow-2xl ${className}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b p-4">
        <div className="flex items-center gap-3">
          <div className={`h-3 w-3 rounded-full ${isListening ? 'bg-green-500 animate-pulse' : 'bg-muted-foreground/50'}`} />
          <span className="font-semibold text-base">Voice Assistant</span>
        </div>
        <div className="flex items-center gap-2">
          {/* Language Selector */}
          <div className="relative">
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-8 px-2 text-xs"
              onClick={() => setShowLanguageMenu(!showLanguageMenu)}
            >
              <Languages className="h-4 w-4 mr-1" />
              {currentLang?.native}
            </Button>
            {showLanguageMenu && (
              <div className="absolute right-0 top-full mt-1 bg-card border rounded-lg shadow-lg py-1 min-w-[120px] z-50">
                {LANGUAGES.map(lang => (
                  <button
                    key={lang.code}
                    className={`w-full text-left px-3 py-2 text-sm hover:bg-muted ${
                      selectedLanguage === lang.code ? 'bg-primary/10 font-medium' : ''
                    }`}
                    onClick={() => changeLanguage(lang.code)}
                  >
                    {lang.native}
                  </button>
                ))}
              </div>
            )}
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setIsMinimized(true)}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="p-5 space-y-4">
        {transcript && (
          <div className="rounded-lg bg-muted/50 p-4">
            <p className="text-sm text-muted-foreground mb-1">You said:</p>
            <p className="text-base">{transcript}</p>
          </div>
        )}

        {isProcessing && (
          <div className="flex items-center gap-3 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-base">Processing...</span>
          </div>
        )}

        {response && !isProcessing && (
          <div className="rounded-lg bg-primary/10 p-4">
            <p className="text-sm text-muted-foreground mb-1">Assistant:</p>
            <p className="text-base">{response}</p>
          </div>
        )}

        {/* Controls */}
        <div className="flex items-center justify-center gap-4">
          {/* Start Button */}
          <Button
            onClick={startListening}
            size="lg"
            className="rounded-full bg-green-600 hover:bg-green-700"
            style={{ height: '64px', width: '64px' }}
            disabled={isListening}
          >
            <Mic className="h-7 w-7" />
          </Button>

          {/* Stop Button */}
          <Button
            onClick={stopListening}
            size="lg"
            className="rounded-full bg-destructive hover:bg-destructive/90"
            style={{ height: '64px', width: '64px' }}
            disabled={!isListening}
          >
            <Square className="h-6 w-6" />
          </Button>

          {/* Mute Speaker Button */}
          <Button
            onClick={stopSpeaking}
            size="lg"
            variant="outline"
            className="rounded-full"
            style={{ height: '64px', width: '64px' }}
            disabled={!isSpeaking}
          >
            {isSpeaking ? <VolumeX className="h-7 w-7" /> : <Volume2 className="h-7 w-7" />}
          </Button>
        </div>

        <p className="text-center text-sm text-muted-foreground">
          {isListening 
            ? selectedLanguage.startsWith('te') 
              ? '🎤 వింటున్నాను... ఇప్పుడు మాట్లాడండి!'
              : selectedLanguage.startsWith('hi')
              ? '🎤 सुन रहा हूं... अब बोलिए!'
              : '🎤 Listening... Speak now!'
            : selectedLanguage.startsWith('te')
              ? 'మైక్ నొక్కి ప్రారంభించండి'
              : selectedLanguage.startsWith('hi')
              ? 'माइक दबाकर शुरू करें'
              : 'Tap mic to start'
          }
        </p>
      </div>
    </div>
  );
};

export default VoiceAssistant;
