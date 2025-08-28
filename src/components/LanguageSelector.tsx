import { Globe } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';

const languages = [
  { code: 'en', name: 'English', native: 'English' },
  { code: 'hi', name: 'Hindi', native: 'हिंदी' },
  { code: 'ta', name: 'Tamil', native: 'தமிழ்' },
  { code: 'te', name: 'Telugu', native: 'తెలుగు' },
  { code: 'kn', name: 'Kannada', native: 'ಕನ್ನಡ' },
  { code: 'mr', name: 'Marathi', native: 'मराठी' },
  { code: 'bn', name: 'Bengali', native: 'বাংলা' },
];

interface LanguageSelectorProps {
  compact?: boolean;
}

export const LanguageSelector = ({ compact = false }: LanguageSelectorProps) => {
  const { i18n, t } = useTranslation();

  const handleLanguageChange = (languageCode: string) => {
    i18n.changeLanguage(languageCode);
    localStorage.setItem('selectedLanguage', languageCode);
  };

  if (compact) {
    return (
      <Button
        variant="ghost"
        size="sm"
        onClick={() => {
          const currentIndex = languages.findIndex(lang => lang.code === i18n.language);
          const nextIndex = (currentIndex + 1) % languages.length;
          handleLanguageChange(languages[nextIndex].code);
        }}
        className="h-8 w-8 p-0 hover:bg-accent"
        title={t('common.selectLanguage')}
      >
        <Globe className="h-4 w-4" />
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Globe className="h-4 w-4 text-muted-foreground" />
      <Select value={i18n.language} onValueChange={handleLanguageChange}>
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder={t('common.selectLanguage')} />
        </SelectTrigger>
        <SelectContent className="bg-background border border-border">
          {languages.map((language) => (
            <SelectItem 
              key={language.code} 
              value={language.code}
              className="hover:bg-accent focus:bg-accent"
            >
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{language.native}</span>
                <span className="text-xs text-muted-foreground">({language.name})</span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};