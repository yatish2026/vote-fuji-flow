import { useState, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useToast } from './use-toast';

interface UseSpeechReturn {
  speak: (text: string) => void;
  startListening: (onResult: (transcript: string) => void) => void;
  stopListening: () => void;
  isListening: boolean;
  isSpeaking: boolean;
  isSupported: boolean;
}

export const useSpeech = (): UseSpeechReturn => {
  const { i18n, t } = useTranslation();
  const { toast } = useToast();
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  // Language mapping for speech services
  const getLanguageCode = (langCode: string): string => {
    const languageMap: Record<string, string> = {
      'en': 'en-US',
      'hi': 'hi-IN',
      'ta': 'ta-IN',
      'te': 'te-IN',
      'kn': 'kn-IN',
      'mr': 'mr-IN',
      'bn': 'bn-IN'
    };
    return languageMap[langCode] || 'en-US';
  };

  // Check if speech APIs are supported
  const isSupported = typeof window !== 'undefined' &&
    'speechSynthesis' in window &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

  // Text-to-Speech function
  const speak = useCallback((text: string) => {
    if (!isSupported || !text.trim()) return;

    // Stop any current speech
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = getLanguageCode(i18n.language);
    utterance.rate = 0.9;
    utterance.pitch = 1;
    utterance.volume = 1;

    utterance.onstart = () => {
      setIsSpeaking(true);
    };

    utterance.onend = () => {
      setIsSpeaking(false);
      utteranceRef.current = null;
    };

    utterance.onerror = (event) => {
      console.error('Speech synthesis error:', event);
      setIsSpeaking(false);
      toast({
        title: t('common.error'),
        description: 'Failed to speak text',
        variant: 'destructive'
      });
    };

    utteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  }, [i18n.language, isSupported, t, toast]);

  // Speech-to-Text function
  const startListening = useCallback((onResult: (transcript: string) => void) => {
    if (!isSupported) {
      toast({
        title: t('common.error'),
        description: t('common.speechNotSupported'),
        variant: 'destructive'
      });
      return;
    }

    // Stop any current recognition
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }

    // @ts-ignore
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();

    recognition.lang = getLanguageCode(i18n.language);
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setIsListening(true);
      toast({
        title: t('common.voiceCommands'),
        description: t('common.listeningForVoice'),
      });
    };

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript.trim();
      console.log('Voice transcript:', transcript);
      onResult(transcript);
    };

    recognition.onerror = (event) => {
      console.error('Speech recognition error:', event);
      setIsListening(false);
      toast({
        title: t('common.error'),
        description: `Speech recognition error: ${event.error}`,
        variant: 'destructive'
      });
    };

    recognition.onend = () => {
      setIsListening(false);
      recognitionRef.current = null;
    };

    recognitionRef.current = recognition;
    recognition.start();
  }, [i18n.language, isSupported, t, toast]);

  // Stop listening function
  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    setIsListening(false);
  }, []);

  return {
    speak,
    startListening,
    stopListening,
    isListening,
    isSpeaking,
    isSupported
  };
};