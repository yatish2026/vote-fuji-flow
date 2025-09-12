import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { 
  Brain, TrendingUp, Users, BarChart3, 
  Lightbulb, Target, AlertTriangle, Crown,
  RefreshCw, Mic, Volume2
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSpeech } from '@/hooks/useSpeech';

const AIInsights = ({ election, candidates, winner }) => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { speak } = useSpeech();
  const [insights, setInsights] = useState([]);
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    generateInsights();
  }, [election, candidates]);

  const generateInsights = async () => {
    setIsGenerating(true);
    
    // Simulate AI processing time
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    const totalVotes = election.totalVotes;
    const sortedCandidates = [...candidates].sort((a, b) => b.votes - a.votes);
    const leader = sortedCandidates[0];
    const runner = sortedCandidates[1];
    
    const generatedInsights = [];

    // Voter Turnout Analysis
    const expectedVotes = election.candidatesCount * 100; // Assume 100 votes per candidate as baseline
    const turnoutPercentage = totalVotes > 0 ? (totalVotes / expectedVotes) * 100 : 0;
    
    if (turnoutPercentage > 80) {
      generatedInsights.push({
        type: 'success',
        title: t('ai.highTurnout'),
        description: t('ai.excellentParticipation'),
        percentage: Math.round(turnoutPercentage),
        icon: Users
      });
    } else if (turnoutPercentage > 50) {
      generatedInsights.push({
        type: 'info',
        title: t('ai.moderateTurnout'),
        description: t('ai.goodParticipation'),
        percentage: Math.round(turnoutPercentage),
        icon: Users
      });
    } else {
      generatedInsights.push({
        type: 'warning',
        title: t('ai.lowTurnout'),
        description: t('ai.encourageParticipation'),
        percentage: Math.round(turnoutPercentage),
        icon: AlertTriangle
      });
    }

    // Competition Analysis
    if (totalVotes > 0 && sortedCandidates.length >= 2) {
      const leadMargin = leader.votes - runner.votes;
      const leadPercentage = (leadMargin / totalVotes) * 100;
      
      if (leadPercentage > 20) {
        generatedInsights.push({
          type: 'success',
          title: t('ai.clearLeader'),
          description: `${leader.name} ${t('ai.strongLead')}`,
          percentage: Math.round(leadPercentage),
          icon: Crown
        });
      } else if (leadPercentage > 10) {
        generatedInsights.push({
          type: 'info',
          title: t('ai.moderateLead'),
          description: `${leader.name} ${t('ai.aheadByMargin')}`,
          percentage: Math.round(leadPercentage),
          icon: TrendingUp
        });
      } else {
        generatedInsights.push({
          type: 'warning',
          title: t('ai.tightRace'),
          description: t('ai.veryCompetitive'),
          percentage: Math.round(leadPercentage),
          icon: Target
        });
      }
    }

    // Voting Pattern Analysis
    if (totalVotes > 0) {
      const voteDistribution = candidates.map(c => (c.votes / totalVotes) * 100);
      const maxVote = Math.max(...voteDistribution);
      const minVote = Math.min(...voteDistribution);
      const spread = maxVote - minVote;
      
      if (spread > 40) {
        generatedInsights.push({
          type: 'info',
          title: t('ai.polarizedVoting'),
          description: t('ai.clearPreferences'),
          percentage: Math.round(spread),
          icon: BarChart3
        });
      } else {
        generatedInsights.push({
          type: 'info',
          title: t('ai.balancedVoting'),
          description: t('ai.evenDistribution'),
          percentage: Math.round(spread),
          icon: BarChart3
        });
      }
    }

    // Time-based Insights
    const now = Math.floor(Date.now() / 1000);
    const electionDuration = election.endTime - election.startTime;
    const timeElapsed = now - election.startTime;
    const progressPercentage = Math.min((timeElapsed / electionDuration) * 100, 100);
    
    if (election.active && progressPercentage > 75) {
      generatedInsights.push({
        type: 'prediction',
        title: t('ai.finalStretch'),
        description: t('ai.criticalPeriod'),
        percentage: Math.round(progressPercentage),
        icon: Lightbulb
      });
    }

    // Prediction for active elections
    if (election.active && totalVotes > 10) {
      const confidenceScore = Math.min((totalVotes / 50) * 100, 95);
      generatedInsights.push({
        type: 'prediction',
        title: t('ai.prediction'),
        description: `${leader.name} ${t('ai.likelyToWin')}`,
        percentage: Math.round(confidenceScore),
        icon: Brain
      });
    }

    setInsights(generatedInsights);
    setIsGenerating(false);
  };

  const speakInsights = () => {
    const insightText = insights.map(insight => `${insight.title}: ${insight.description}`).join('. ');
    speak(insightText);
  };

  const getInsightColor = (type) => {
    switch (type) {
      case 'success': return 'border-green-500 bg-green-500/10';
      case 'warning': return 'border-yellow-500 bg-yellow-500/10';
      case 'info': return 'border-blue-500 bg-blue-500/10';
      case 'prediction': return 'border-purple-500 bg-purple-500/10';
      default: return 'border-gray-500 bg-gray-500/10';
    }
  };

  const getInsightBadgeVariant = (type) => {
    switch (type) {
      case 'success': return 'default';
      case 'warning': return 'destructive';
      case 'info': return 'secondary';
      case 'prediction': return 'outline';
      default: return 'outline';
    }
  };

  return (
    <Card className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-2">
          <Brain className="w-6 h-6 text-primary" />
          <h3 className="text-2xl font-semibold">{t('ai.insights')}</h3>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={speakInsights}
            variant="outline"
            size="sm"
            disabled={insights.length === 0}
          >
            <Volume2 className="w-4 h-4 mr-2" />
            {t('ai.speakInsights')}
          </Button>
          <Button
            onClick={generateInsights}
            variant="outline"
            size="sm"
            disabled={isGenerating}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${isGenerating ? 'animate-spin' : ''}`} />
            {t('ai.regenerate')}
          </Button>
        </div>
      </div>

      {isGenerating ? (
        <div className="space-y-4">
          <div className="flex items-center gap-3 p-4 bg-primary/10 rounded-lg">
            <Brain className="w-6 h-6 text-primary animate-pulse" />
            <div>
              <p className="font-semibold">{t('ai.analyzing')}</p>
              <p className="text-sm text-muted-foreground">{t('ai.generatingInsights')}</p>
            </div>
          </div>
        </div>
      ) : insights.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {insights.map((insight, index) => {
            const IconComponent = insight.icon;
            return (
              <Card key={index} className={`p-4 border-2 ${getInsightColor(insight.type)}`}>
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-full ${getInsightColor(insight.type)}`}>
                    <IconComponent className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-semibold">{insight.title}</h4>
                      <Badge variant={getInsightBadgeVariant(insight.type)}>
                        {insight.type}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">
                      {insight.description}
                    </p>
                    {insight.percentage && (
                      <div className="flex items-center gap-2">
                        <div className="text-xs text-muted-foreground">
                          {t('ai.confidence')}: {insight.percentage}%
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-8">
          <Brain className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">{t('ai.noInsights')}</p>
        </div>
      )}
    </Card>
  );
};

export default AIInsights;