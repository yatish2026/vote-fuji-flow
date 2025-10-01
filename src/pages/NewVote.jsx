import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import ElectionManager from '@/components/ElectionManager';
import ElectionVoting from '@/components/ElectionVoting';
import { LanguageSelector } from '@/components/LanguageSelector';
import { VoiceControls } from '@/components/VoiceControls';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Wallet, LogOut } from 'lucide-react';

const NewVote = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [selectedElectionId, setSelectedElectionId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [walletConnected, setWalletConnected] = useState(false);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        navigate('/auth');
        return;
      }

      setUser(session.user);

      // Check if profile exists
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();

      if (profileError || !profileData) {
        toast({
          title: 'Profile Required',
          description: 'Please complete your profile first',
          variant: 'destructive',
        });
        navigate('/auth');
        return;
      }

      setProfile(profileData);
      setWalletConnected(!!profileData.wallet_address);
    } catch (error) {
      console.error('Auth check error:', error);
      navigate('/auth');
    } finally {
      setLoading(false);
    }
  };

  const handleConnectWallet = async () => {
    if (typeof window.ethereum === 'undefined') {
      toast({
        title: 'MetaMask not found',
        description: 'Please install MetaMask to connect your wallet',
        variant: 'destructive',
      });
      return;
    }

    try {
      const accounts = await window.ethereum.request({ 
        method: 'eth_requestAccounts' 
      });
      const walletAddress = accounts[0];

      const { error } = await supabase
        .from('profiles')
        .update({ wallet_address: walletAddress })
        .eq('id', user.id);

      if (error) throw error;

      setProfile({ ...profile, wallet_address: walletAddress });
      setWalletConnected(true);

      toast({
        title: 'Wallet Connected',
        description: 'Your wallet has been connected successfully',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/auth');
  };

  const handleElectionSelect = (electionId) => {
    if (!walletConnected) {
      toast({
        title: 'Wallet Required',
        description: 'Please connect your wallet before voting',
        variant: 'destructive',
      });
      return;
    }
    setSelectedElectionId(electionId);
  };

  const handleBackToElections = () => {
    setSelectedElectionId(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

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
            {profile && (
              <p className="text-sm text-muted-foreground mt-2">
                Welcome, {profile.full_name}
              </p>
            )}
          </div>
          <div className="flex gap-4 items-center">
            {!walletConnected ? (
              <Button onClick={handleConnectWallet} variant="outline">
                <Wallet className="mr-2 h-4 w-4" />
                Connect Wallet
              </Button>
            ) : (
              <div className="text-sm text-green-600 flex items-center gap-2">
                <Wallet className="h-4 w-4" />
                Wallet Connected
              </div>
            )}
            <LanguageSelector />
            <VoiceControls />
            <Button onClick={handleLogout} variant="ghost" size="icon">
              <LogOut className="h-4 w-4" />
            </Button>
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