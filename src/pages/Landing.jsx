import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Vote,
  Shield,
  Users,
  CheckCircle,
  BarChart3,
  Wallet,
  Globe,
  Lock,
  ArrowRight,
  Zap
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { LanguageSelector } from '@/components/LanguageSelector';
import { VoiceControls } from '@/components/VoiceControls';
import { useNavigate } from 'react-router-dom';

const Landing = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  // 🔹 Updated Features
  const features = [
    {
      icon: <Shield className="w-8 h-8" />,
      title: "Secure Elections",
      description: "Tamper-proof voting powered by Avalanche Blockchain"
    },
    {
      icon: <BarChart3 className="w-8 h-8" />,
      title: "Multi-Election Support",
      description: "Admin can create and manage multiple elections"
    },
    {
      icon: <Globe className="w-8 h-8" />,
      title: "Transparent Results",
      description: "Fully auditable and transparent public results"
    },
    {
      icon: <Wallet className="w-8 h-8" />,
      title: "Dual Login",
      description: "login with Voter ID/PAN + Web3 Wallet authentication"
    },
    {
      icon: <Users className="w-8 h-8" />,
      title: "Candidate Management",
      description: "Create, track, and fix candidate name issues"
    },
    {
      icon: <CheckCircle className="w-8 h-8" />,
      title: "Modern UI",
      description: "Smooth and responsive interface for voters & admins"
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background/50 to-primary/5">
      {/* Header */}
      <div className="container mx-auto px-4 py-6">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-primary to-accent rounded-xl flex items-center justify-center">
              <Vote className="w-6 h-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                BlockVote
              </h1>
              <p className="text-xs text-muted-foreground">{t('landing.subtitle')}</p>
            </div>
          </div>
          <div className="flex gap-4 items-center">
            <LanguageSelector />
            <VoiceControls />
            <Button onClick={() => navigate('/auth')} variant="outline">
              Login / Sign Up
            </Button>
          </div>
        </div>
      </div>

      {/* Hero Section */}
      <div className="container mx-auto px-4 py-16 text-center">
        <div className="max-w-4xl mx-auto space-y-8">
          <div className="space-y-4">
            <Badge variant="secondary" className="px-4 py-2">
              <Zap className="w-4 h-4 mr-2" />
              Powered by Avalanche
            </Badge>
            <h1 className="text-5xl md:text-7xl font-bold">
              <span className="bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">
                {t('landing.heroTitle')}
              </span>
            </h1>
            <p className="text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto">
              {t('landing.heroDescription')}
            </p>
          </div>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-6 justify-center items-center">
            <Card
              className="p-8 cursor-pointer hover:shadow-elegant transition-all duration-300 hover:scale-105 bg-gradient-to-br from-primary/10 to-accent/10 border-primary/20"
              onClick={() => navigate('/vote')}
            >
              <div className="text-center space-y-4">
                <div className="w-16 h-16 mx-auto bg-gradient-to-br from-primary to-primary-glow rounded-full flex items-center justify-center">
                  <Vote className="w-8 h-8 text-primary-foreground" />
                </div>
                <h3 className="text-2xl font-semibold">{t('landing.voterPortal')}</h3>
                <p className="text-muted-foreground">{t('landing.voterDescription')}</p>
                <Button className="bg-gradient-to-r from-primary to-primary-glow hover:from-primary/90 hover:to-primary-glow/90">
                  {t('landing.startVoting')}
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </Card>

            <Card
              className="p-8 cursor-pointer hover:shadow-elegant transition-all duration-300 hover:scale-105 bg-gradient-to-br from-accent/10 to-warning/10 border-accent/20"
              onClick={() => navigate('/admin')}
            >
              <div className="text-center space-y-4">
                <div className="w-16 h-16 mx-auto bg-gradient-to-br from-accent to-warning rounded-full flex items-center justify-center">
                  <Shield className="w-8 h-8 text-accent-foreground" />
                </div>
                <h3 className="text-2xl font-semibold">{t('landing.adminPortal')}</h3>
                <p className="text-muted-foreground">{t('landing.adminDescription')}</p>
                <Button variant="outline" className="border-accent text-accent hover:bg-accent hover:text-accent-foreground">
                  {t('landing.manageElections')}
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </Card>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="container mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">Key Features</h2>
          <p className="text-xl text-muted-foreground">Everything you need for secure blockchain voting</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, index) => (
            <Card key={index} className="p-6 text-center hover:shadow-lg transition-all duration-300">
              <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-primary/20 to-accent/20 rounded-full flex items-center justify-center text-primary">
                {feature.icon}
              </div>
              <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
              <p className="text-muted-foreground text-sm">{feature.description}</p>
            </Card>
          ))}
        </div>
      </div>

      {/* Avalanche Section */}
      <div className="container mx-auto px-4 py-16">
        <Card className="p-8 bg-gradient-to-br from-destructive/10 to-accent/10 border-destructive/20">
          <div className="text-center space-y-4">
            <div className="flex items-center justify-center gap-4">
              <div className="w-12 h-12 bg-destructive rounded-full flex items-center justify-center">
                <Lock className="w-6 h-6 text-destructive-foreground" />
              </div>
              <h3 className="text-2xl font-bold">Powered by Avalanche</h3>
            </div>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              {t('landing.avalancheDescription')}
            </p>
            <div className="flex flex-wrap justify-center gap-4 mt-6">
              <Badge variant="outline">⚡ Fast Transactions</Badge>
              <Badge variant="outline">🔒 Secure Network</Badge>
              <Badge variant="outline">🌍 Decentralized</Badge>
              <Badge variant="outline">💰 Low Fees</Badge>
            </div>
          </div>
        </Card>
      </div>

      {/* Footer */}
      <footer className="border-t border-border/50 py-8">
        <div className="container mx-auto px-4 text-center text-muted-foreground">
          <p>{t('landing.footer')}</p>
        </div>
      </footer>
    </div>
  );
};

export default Landing;