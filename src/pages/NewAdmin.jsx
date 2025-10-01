import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from '@/hooks/use-toast';
import { Wallet, BarChart3, Users, CheckCircle, AlertCircle } from 'lucide-react';
import { ethers } from 'ethers';
import ElectionManager from '@/components/ElectionManager';
import { useTranslation } from 'react-i18next';

const NewAdmin = () => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [account, setAccount] = useState(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [selectedElectionId, setSelectedElectionId] = useState(null);
  const [networkName, setNetworkName] = useState('');

  useEffect(() => {
    checkIfWalletIsConnected();
    if (window.ethereum) {
      window.ethereum.on('accountsChanged', handleAccountsChanged);
      window.ethereum.on('chainChanged', () => window.location.reload());
    }
    return () => {
      if (window.ethereum) {
        window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
      }
    };
  }, []);

  const handleAccountsChanged = (accounts) => {
    if (accounts.length === 0) {
      setAccount(null);
      toast({
        title: t('wallet.disconnected'),
        description: t('wallet.pleaseConnect'),
        variant: 'default'
      });
    } else {
      setAccount(accounts[0]);
    }
  };

  const checkIfWalletIsConnected = async () => {
    try {
      if (!window.ethereum) {
        return;
      }

      const accounts = await window.ethereum.request({ method: 'eth_accounts' });
      
      if (accounts.length > 0) {
        setAccount(accounts[0]);
        await checkNetwork();
      }
    } catch (error) {
      console.error('Error checking wallet connection:', error);
    }
  };

  const checkNetwork = async () => {
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const network = await provider.getNetwork();
      setNetworkName(network.name === 'unknown' ? 'Avalanche Fuji' : network.name);
    } catch (error) {
      console.error('Error checking network:', error);
    }
  };

  const connectWallet = async () => {
    if (!window.ethereum) {
      toast({
        title: t('wallet.notInstalled'),
        description: t('wallet.installCore'),
        variant: 'destructive'
      });
      return;
    }

    try {
      setIsConnecting(true);
      const accounts = await window.ethereum.request({
        method: 'eth_requestAccounts'
      });

      setAccount(accounts[0]);
      await checkNetwork();

      toast({
        title: t('wallet.connected'),
        description: `${t('wallet.address')}: ${accounts[0].substring(0, 6)}...${accounts[0].substring(38)}`,
        variant: 'default'
      });
    } catch (error) {
      console.error('Error connecting wallet:', error);
      toast({
        title: t('common.error'),
        description: error.message || t('wallet.connectionFailed'),
        variant: 'destructive'
      });
    } finally {
      setIsConnecting(false);
    }
  };

  const disconnectWallet = () => {
    setAccount(null);
    toast({
      title: t('wallet.disconnected'),
      description: t('wallet.successfullyDisconnected'),
      variant: 'default'
    });
  };

  if (!account) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 py-12 px-4">
        <div className="container mx-auto max-w-md">
          <Card className="border-2 shadow-elegant">
            <CardHeader className="text-center space-y-4">
              <div className="mx-auto w-16 h-16 bg-gradient-to-r from-primary to-accent rounded-full flex items-center justify-center">
                <Wallet className="w-8 h-8 text-white" />
              </div>
              <CardTitle className="text-3xl bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                {t('admin.title')}
              </CardTitle>
              <CardDescription className="text-base">
                {t('admin.connectWallet')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {!window.ethereum ? (
                <div className="text-center space-y-4">
                  <AlertCircle className="w-12 h-12 mx-auto text-warning" />
                  <p className="text-muted-foreground">{t('wallet.notInstalled')}</p>
                  <Button
                    asChild
                    className="w-full bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90"
                  >
                    <a href="https://core.app/" target="_blank" rel="noopener noreferrer">
                      {t('wallet.installCore')}
                    </a>
                  </Button>
                </div>
              ) : (
                <Button
                  onClick={connectWallet}
                  disabled={isConnecting}
                  className="w-full bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 h-12 text-lg"
                >
                  <Wallet className="w-5 h-5 mr-2" />
                  {isConnecting ? t('wallet.connecting') : t('wallet.connect')}
                </Button>
              )}
              <div className="pt-4 space-y-2 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-success" />
                  <span>{t('admin.createElections')}</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-success" />
                  <span>{t('admin.manageVoting')}</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-success" />
                  <span>{t('admin.viewAnalytics')}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      {/* Header */}
      <div className="border-b border-border/50 bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                {t('admin.dashboard')}
              </h1>
              <p className="text-sm text-muted-foreground">{t('admin.subtitle')}</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right hidden md:block">
                <Badge variant="outline" className="mb-1">
                  {networkName || 'Avalanche Fuji'}
                </Badge>
                <p className="text-xs text-muted-foreground">
                  {account.substring(0, 6)}...{account.substring(38)}
                </p>
              </div>
              <Button
                onClick={disconnectWallet}
                variant="outline"
                size="sm"
                className="border-destructive/50 text-destructive hover:bg-destructive/10"
              >
                <Wallet className="w-4 h-4 mr-2" />
                {t('wallet.disconnect')}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        <ElectionManager
          onElectionSelect={setSelectedElectionId}
          selectedElectionId={selectedElectionId}
          onElectionDeleted={() => setSelectedElectionId(null)}
        />
      </div>
    </div>
  );
};

export default NewAdmin;
