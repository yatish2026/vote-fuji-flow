import React from 'react';
import { Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useTranslation, LANGUAGES } from './TranslationProvider';

export const LanguageSwitcher: React.FC = () => {
  const { currentLanguage, setLanguage } = useTranslation();

  const currentLang = LANGUAGES.find(l => l.code === currentLanguage) || LANGUAGES[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Globe className="h-4 w-4" />
          <span className="hidden sm:inline">{currentLang.native}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {LANGUAGES.map((lang) => (
          <DropdownMenuItem
            key={lang.code}
            onClick={() => setLanguage(lang.code)}
            className={currentLanguage === lang.code ? 'bg-accent' : ''}
          >
            <span className="flex-1">{lang.native}</span>
            <span className="text-muted-foreground text-xs">{lang.name}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default LanguageSwitcher;
