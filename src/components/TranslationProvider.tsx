import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';

interface TranslationContextType {
  currentLanguage: string;
  setLanguage: (lang: string) => void;
  translate: (text: string) => Promise<string>;
  isTranslating: boolean;
}

const TranslationContext = createContext<TranslationContextType | null>(null);

const TRANSLATION_API_KEY = import.meta.env.VITE_CLOUD_TRANSLATION_API_KEY || 'AIzaSyAiJPkISh7AB7fWsBKO_LbVgdEnrkIHqV4';

const SUPPORTED_LANGUAGES = [
  { code: 'en', name: 'English', native: 'English' },
  { code: 'te', name: 'Telugu', native: 'తెలుగు' },
  { code: 'hi', name: 'Hindi', native: 'हिंदी' },
  { code: 'ta', name: 'Tamil', native: 'தமிழ்' },
  { code: 'bn', name: 'Bengali', native: 'বাংলা' },
  { code: 'mr', name: 'Marathi', native: 'मराठी' },
  { code: 'kn', name: 'Kannada', native: 'ಕನ್ನಡ' },
  { code: 'gu', name: 'Gujarati', native: 'ગુજરાતી' },
  { code: 'pa', name: 'Punjabi', native: 'ਪੰਜਾਬੀ' },
  { code: 'ml', name: 'Malayalam', native: 'മലയാളം' },
];

export const TranslationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentLanguage, setCurrentLanguage] = useState(() => {
    return localStorage.getItem('app-language') || 'en';
  });
  const [isTranslating, setIsTranslating] = useState(false);
  const [cache, setCache] = useState<Record<string, string>>({});

  useEffect(() => {
    localStorage.setItem('app-language', currentLanguage);
  }, [currentLanguage]);

  const translate = useCallback(async (text: string): Promise<string> => {
    if (!text || currentLanguage === 'en') return text;

    const cacheKey = `${currentLanguage}:${text}`;
    if (cache[cacheKey]) return cache[cacheKey];

    setIsTranslating(true);
    try {
      const response = await fetch(
        `https://translation.googleapis.com/language/translate/v2?key=${TRANSLATION_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            q: text,
            target: currentLanguage,
            source: 'en',
            format: 'text'
          })
        }
      );

      if (!response.ok) {
        console.error('Translation API error:', await response.text());
        return text;
      }

      const data = await response.json();
      const translated = data.data?.translations?.[0]?.translatedText || text;
      
      setCache(prev => ({ ...prev, [cacheKey]: translated }));
      return translated;
    } catch (error) {
      console.error('Translation error:', error);
      return text;
    } finally {
      setIsTranslating(false);
    }
  }, [currentLanguage, cache]);

  const setLanguage = useCallback((lang: string) => {
    setCurrentLanguage(lang);
    setCache({}); // Clear cache on language change
  }, []);

  return (
    <TranslationContext.Provider value={{ currentLanguage, setLanguage, translate, isTranslating }}>
      {children}
    </TranslationContext.Provider>
  );
};

export const useTranslation = () => {
  const context = useContext(TranslationContext);
  if (!context) {
    throw new Error('useTranslation must be used within TranslationProvider');
  }
  return context;
};

export const LANGUAGES = SUPPORTED_LANGUAGES;
