import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Mail, Send, Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const EmailService = ({ 
  electionTitle, 
  onEmailCollected, 
  disabled = false 
}) => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [voterName, setVoterName] = useState('');
  const [isValid, setIsValid] = useState(false);

  const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleEmailChange = (value) => {
    setEmail(value);
    setIsValid(validateEmail(value) && voterName.trim().length > 0);
  };

  const handleNameChange = (value) => {
    setVoterName(value);
    setIsValid(validateEmail(email) && value.trim().length > 0);
  };

  const handleSubmit = () => {
    if (!isValid) {
      toast({
        title: t('common.error'),
        description: t('voting.enterValidDetails'),
        variant: 'destructive'
      });
      return;
    }

    onEmailCollected(email, voterName);
    
    toast({
      title: t('common.success'),
      description: t('voting.emailRegistered'),
      variant: 'default'
    });
  };

  return (
    <Card className="p-6 bg-gradient-to-br from-primary/5 to-accent/5 border-primary/20">
      <div className="flex items-center gap-2 mb-4">
        <Mail className="w-5 h-5 text-primary" />
        <h3 className="text-lg font-semibold">{t('voting.emailNotifications')}</h3>
      </div>
      
      <p className="text-sm text-muted-foreground mb-4">
        {t('voting.emailDescription')}
      </p>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2">
            {t('voting.voterName')}
          </label>
          <Input
            value={voterName}
            onChange={(e) => handleNameChange(e.target.value)}
            placeholder={t('voting.voterNamePlaceholder')}
            disabled={disabled}
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">
            {t('voting.emailAddress')}
          </label>
          <Input
            type="email"
            value={email}
            onChange={(e) => handleEmailChange(e.target.value)}
            placeholder={t('voting.emailPlaceholder')}
            disabled={disabled}
          />
        </div>

        <Button
          onClick={handleSubmit}
          disabled={!isValid || disabled}
          className="w-full"
        >
          {isValid ? (
            <>
              <Check className="w-4 h-4 mr-2" />
              {t('voting.readyToVote')}
            </>
          ) : (
            <>
              <Send className="w-4 h-4 mr-2" />
              {t('voting.enterDetails')}
            </>
          )}
        </Button>
      </div>
    </Card>
  );
};

// Email sending service (would typically be a backend service)
export const sendElectionResults = async (
  email, 
  voterName, 
  electionTitle, 
  winner,
  allCandidates
) => {
  // This would typically call a backend API
  // For now, we'll simulate the email being sent
  console.log('Sending election results email to:', email);
  console.log('Election:', electionTitle);
  console.log('Winner:', winner);
  console.log('All results:', allCandidates);
  
  // Simulate API call
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        success: true,
        message: `Election results sent to ${email}`
      });
    }, 1000);
  });
};

export default EmailService;