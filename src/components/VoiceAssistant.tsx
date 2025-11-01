import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Mic, MicOff, Loader2, Volume2 } from 'lucide-react';
import { AudioRecorder, encodeAudioForAPI, playAudioData, clearAudioQueue } from '@/utils/RealtimeAudio';
import { ethers } from 'ethers';
import { FACTORY_CONTRACT_ADDRESS, FACTORY_CONTRACT_ABI } from '@/lib/contract';

declare global {
  interface Window {
    ethereum?: any;
  }
}

interface VoiceAssistantProps {
  className?: string;
}

const VoiceAssistant = ({ className = '' }: VoiceAssistantProps) => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [assistantText, setAssistantText] = useState('');
  
  const wsRef = useRef<WebSocket | null>(null);
  const recorderRef = useRef<AudioRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const functionCallBufferRef = useRef<{ [key: string]: string }>({});

  useEffect(() => {
    return () => {
      disconnect();
    };
  }, []);

  const handleFunctionCall = async (name: string, args: any) => {
    console.log('Function call:', name, args);
    
    try {
      let result: any = { success: false, message: 'Function not implemented' };

      if (name === 'navigate_to') {
        result = navigateToPage(args);
      } else if (name === 'create_election') {
        result = await createElection(args);
      } else if (name === 'list_elections') {
        result = await listElections();
      } else if (name === 'get_election_details') {
        result = await getElectionDetails(args);
      } else if (name === 'cast_vote') {
        result = await castVote(args);
      }

      // Send function result back to OpenAI
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: 'conversation.item.create',
          item: {
            type: 'function_call_output',
            call_id: args.call_id || 'unknown',
            output: JSON.stringify(result)
          }
        }));
        
        // Request response after function call
        wsRef.current.send(JSON.stringify({ type: 'response.create' }));
      }
    } catch (error) {
      console.error('Function call error:', error);
    }
  };

  const navigateToPage = (args: any) => {
    try {
      const pageMap: { [key: string]: string } = {
        'home': '/',
        'admin': '/admin',
        'vote': '/vote',
        'auth': '/auth'
      };

      const path = pageMap[args.page];
      if (path) {
        navigate(path);
        return { 
          success: true, 
          message: `Navigated to ${args.page} page` 
        };
      }
      return { 
        success: false, 
        message: 'Invalid page specified' 
      };
    } catch (error: any) {
      return { 
        success: false, 
        message: error.message || 'Navigation failed' 
      };
    }
  };

  const getElectionDetails = async (args: any) => {
    try {
      if (!window.ethereum) {
        return { success: false, message: 'Wallet not found', election: null, candidates: [] };
      }

      const provider = new ethers.BrowserProvider(window.ethereum);
      const contract = new ethers.Contract(FACTORY_CONTRACT_ADDRESS, FACTORY_CONTRACT_ABI, provider);

      const election = await contract.getElection(args.electionId);
      const [title, description, startTime, endTime, active, candidatesCount, totalVotes] = election;

      const candidates = [];
      for (let i = 0; i < Number(candidatesCount); i++) {
        try {
          const candidate = await contract.getCandidate(args.electionId, i);
          candidates.push({
            id: Number(candidate[0]),
            name: candidate[1],
            votes: Number(candidate[2])
          });
        } catch (error) {
          console.log('Error fetching candidate', i);
        }
      }

      return {
        success: true,
        message: `Found election "${title}" with ${candidates.length} candidates`,
        election: {
          id: args.electionId,
          title,
          description,
          active,
          totalVotes: Number(totalVotes)
        },
        candidates
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message || 'Failed to get election details',
        election: null,
        candidates: []
      };
    }
  };

  const createElection = async (args: any) => {
    try {
      if (!window.ethereum) {
        return { success: false, message: 'Wallet not found' };
      }

      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(FACTORY_CONTRACT_ADDRESS, FACTORY_CONTRACT_ABI, signer);

      const startTimestamp = Math.floor(new Date(args.startTime).getTime() / 1000);
      const endTimestamp = Math.floor(new Date(args.endTime).getTime() / 1000);

      const tx = await contract.createElection(
        args.title,
        args.description,
        args.candidates,
        startTimestamp,
        endTimestamp
      );

      await tx.wait();
      
      toast({
        title: 'Success',
        description: `Election "${args.title}" created successfully!`
      });

      return { 
        success: true, 
        message: `Election "${args.title}" has been created successfully with ${args.candidates.length} candidates.` 
      };
    } catch (error: any) {
      console.error('Create election error:', error);
      return { 
        success: false, 
        message: error.message || 'Failed to create election' 
      };
    }
  };

  const listElections = async () => {
    try {
      if (!window.ethereum) {
        return { success: false, message: 'Wallet not found', elections: [] };
      }

      const provider = new ethers.BrowserProvider(window.ethereum);
      const contract = new ethers.Contract(FACTORY_CONTRACT_ADDRESS, FACTORY_CONTRACT_ABI, provider);

      const electionCount = await contract.electionCount();
      const elections = [];

      for (let i = 0; i < Number(electionCount); i++) {
        try {
          const election = await contract.elections(i);
          elections.push({
            id: Number(election.id),
            title: election.title,
            active: election.active
          });
        } catch (error) {
          console.log('Error fetching election', i);
        }
      }

      return { 
        success: true, 
        message: `Found ${elections.length} elections`,
        elections 
      };
    } catch (error: any) {
      return { 
        success: false, 
        message: error.message || 'Failed to list elections',
        elections: [] 
      };
    }
  };

  const castVote = async (args: any) => {
    try {
      if (!window.ethereum) {
        return { success: false, message: 'Wallet not found' };
      }

      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(FACTORY_CONTRACT_ADDRESS, FACTORY_CONTRACT_ABI, signer);

      const tx = await contract.vote(args.electionId, args.candidateId);
      await tx.wait();
      
      toast({
        title: 'Vote Cast',
        description: 'Your vote has been recorded successfully!'
      });

      return { 
        success: true, 
        message: 'Vote cast successfully' 
      };
    } catch (error: any) {
      return { 
        success: false, 
        message: error.message || 'Failed to cast vote' 
      };
    }
  };

  const connect = async () => {
    try {
      setIsConnecting(true);
      
      // Request microphone permission
      await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Initialize audio context
      audioContextRef.current = new AudioContext({ sampleRate: 24000 });
      
      // Connect to WebSocket
      const projectId = 'jydpniwgkjsncgyeqgkx';
      const wsUrl = `wss://${projectId}.supabase.co/functions/v1/realtime-voice`;
      
      console.log('Connecting to:', wsUrl);
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      let connectionTimeout = setTimeout(() => {
        if (ws.readyState !== WebSocket.OPEN) {
          console.error('Connection timeout');
          ws.close();
          toast({
            title: 'Connection Timeout',
            description: 'Unable to connect to voice service. Please try again.'
          });
          setIsConnecting(false);
        }
      }, 10000);

      ws.onopen = async () => {
        console.log('WebSocket connected');
        clearTimeout(connectionTimeout);
        setIsConnected(true);
        setIsConnecting(false);
        
        // Start recording
        recorderRef.current = new AudioRecorder((audioData) => {
          if (ws.readyState === WebSocket.OPEN) {
            const encoded = encodeAudioForAPI(audioData);
            ws.send(JSON.stringify({
              type: 'input_audio_buffer.append',
              audio: encoded
            }));
          }
        });
        
        await recorderRef.current.start();
        
        toast({
          title: 'Voice Assistant Active',
          description: 'You can now speak to control the application'
        });
      };

      ws.onmessage = async (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('Message type:', data.type);
          
          if (data.type === 'response.audio.delta') {
            setIsSpeaking(true);
            const binaryString = atob(data.delta);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
              bytes[i] = binaryString.charCodeAt(i);
            }
            if (audioContextRef.current) {
              await playAudioData(audioContextRef.current, bytes);
            }
          } else if (data.type === 'response.audio.done') {
            setIsSpeaking(false);
          } else if (data.type === 'conversation.item.input_audio_transcription.completed') {
            setTranscript(data.transcript);
          } else if (data.type === 'response.audio_transcript.delta') {
            setAssistantText(prev => prev + data.delta);
          } else if (data.type === 'response.audio_transcript.done') {
            setAssistantText('');
          } else if (data.type === 'response.function_call_arguments.delta') {
            const callId = data.call_id;
            if (!functionCallBufferRef.current[callId]) {
              functionCallBufferRef.current[callId] = '';
            }
            functionCallBufferRef.current[callId] += data.delta;
          } else if (data.type === 'response.function_call_arguments.done') {
            const callId = data.call_id;
            const argsString = functionCallBufferRef.current[callId] || data.arguments;
            try {
              const args = JSON.parse(argsString);
              await handleFunctionCall(data.name, { ...args, call_id: callId });
            } catch (error) {
              console.error('Error parsing function args:', error);
            }
            delete functionCallBufferRef.current[callId];
          } else if (data.type === 'error') {
            console.error('Error from server:', data.error);
            toast({
              title: 'Error',
              description: data.error
            });
          }
        } catch (error) {
          console.error('Error processing message:', error);
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        toast({
          title: 'Connection Error',
          description: 'Failed to connect to voice assistant'
        });
        setIsConnecting(false);
      };

      ws.onclose = () => {
        console.log('WebSocket closed');
        setIsConnected(false);
        setIsConnecting(false);
        recorderRef.current?.stop();
        clearAudioQueue();
      };

    } catch (error: any) {
      console.error('Connection error:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to start voice assistant'
      });
      setIsConnecting(false);
    }
  };

  const disconnect = () => {
    wsRef.current?.close();
    recorderRef.current?.stop();
    audioContextRef.current?.close();
    clearAudioQueue();
    setIsConnected(false);
    setTranscript('');
    setAssistantText('');
    functionCallBufferRef.current = {};
  };

  return (
    <div className={`fixed bottom-6 right-6 z-50 ${className}`}>
      <Card className="p-6 w-80 bg-card/95 backdrop-blur-sm border-2 border-primary/20 shadow-xl">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Volume2 className="w-5 h-5 text-primary" />
              <h3 className="font-semibold">Voice Assistant</h3>
            </div>
            {isSpeaking && (
              <div className="flex gap-1">
                <div className="w-1 h-4 bg-primary animate-pulse" />
                <div className="w-1 h-4 bg-primary animate-pulse delay-75" />
                <div className="w-1 h-4 bg-primary animate-pulse delay-150" />
              </div>
            )}
          </div>

          {(transcript || assistantText) && (
            <div className="space-y-2 text-sm max-h-40 overflow-y-auto">
              {transcript && (
                <div className="p-2 bg-primary/10 rounded">
                  <p className="font-medium text-xs text-muted-foreground mb-1">You:</p>
                  <p>{transcript}</p>
                </div>
              )}
              {assistantText && (
                <div className="p-2 bg-accent/10 rounded">
                  <p className="font-medium text-xs text-muted-foreground mb-1">Assistant:</p>
                  <p>{assistantText}</p>
                </div>
              )}
            </div>
          )}

          <div className="flex gap-2">
            {!isConnected ? (
              <Button
                onClick={connect}
                disabled={isConnecting}
                className="w-full bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90"
              >
                {isConnecting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Connecting...
                  </>
                ) : (
                  <>
                    <Mic className="w-4 h-4 mr-2" />
                    Start Voice Assistant
                  </>
                )}
              </Button>
            ) : (
              <Button
                onClick={disconnect}
                variant="outline"
                className="w-full border-destructive/50 text-destructive hover:bg-destructive/10"
              >
                <MicOff className="w-4 h-4 mr-2" />
                Stop Voice Assistant
              </Button>
            )}
          </div>

          <p className="text-xs text-muted-foreground text-center">
            {isConnected 
              ? 'Listening... Speak naturally to control the app' 
              : 'Click to start voice commands'}
          </p>
        </div>
      </Card>
    </div>
  );
};

export default VoiceAssistant;
