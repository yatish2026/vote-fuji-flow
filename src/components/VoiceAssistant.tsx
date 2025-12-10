import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Mic, MicOff, Loader2, Volume2, X } from 'lucide-react';
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
  const [isMinimized, setIsMinimized] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  
  const wsRef = useRef<WebSocket | null>(null);
  const recorderRef = useRef<AudioRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const functionCallBufferRef = useRef<{ [key: string]: { name: string; args: string } }>({});

  useEffect(() => {
    return () => {
      disconnect();
    };
  }, []);

  const handleFunctionCall = async (name: string, args: any, callId: string) => {
    console.log('Function call:', name, args);
    setStatusMessage(`Executing: ${name}...`);
    
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

      console.log('Function result:', result);
      setStatusMessage('');

      // Send function result back to OpenAI
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: 'conversation.item.create',
          item: {
            type: 'function_call_output',
            call_id: callId,
            output: JSON.stringify(result)
          }
        }));
        
        // Request response after function call
        wsRef.current.send(JSON.stringify({ type: 'response.create' }));
      }
    } catch (error: any) {
      console.error('Function call error:', error);
      setStatusMessage('');
      
      // Send error result back
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: 'conversation.item.create',
          item: {
            type: 'function_call_output',
            call_id: callId,
            output: JSON.stringify({ success: false, message: error.message })
          }
        }));
        wsRef.current.send(JSON.stringify({ type: 'response.create' }));
      }
    }
  };

  const navigateToPage = (args: any) => {
    const pageMap: { [key: string]: string } = {
      'home': '/',
      'admin': '/admin',
      'vote': '/vote',
      'auth': '/auth'
    };

    const path = pageMap[args.page];
    if (path) {
      navigate(path);
      toast({
        title: 'Navigation',
        description: `Navigated to ${args.page} page`
      });
      return { 
        success: true, 
        message: `Successfully navigated to ${args.page} page` 
      };
    }
    return { 
      success: false, 
      message: 'Invalid page specified' 
    };
  };

  const getElectionDetails = async (args: any) => {
    try {
      if (!window.ethereum) {
        return { success: false, message: 'Please connect your wallet first', election: null, candidates: [] };
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

      const candidateList = candidates.map(c => `ID ${c.id}: ${c.name}`).join(', ');

      return {
        success: true,
        message: `Election "${title}" has ${candidates.length} candidates: ${candidateList}. The election is currently ${active ? 'active' : 'inactive'}.`,
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
        return { success: false, message: 'Please connect your wallet first' };
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
        title: 'Election Created!',
        description: `"${args.title}" with ${args.candidates.length} candidates`
      });

      return { 
        success: true, 
        message: `Election "${args.title}" has been created successfully with candidates: ${args.candidates.join(', ')}` 
      };
    } catch (error: any) {
      console.error('Create election error:', error);
      return { 
        success: false, 
        message: error.reason || error.message || 'Failed to create election' 
      };
    }
  };

  const listElections = async () => {
    try {
      if (!window.ethereum) {
        return { success: false, message: 'Please connect your wallet first', elections: [] };
      }

      const provider = new ethers.BrowserProvider(window.ethereum);
      const contract = new ethers.Contract(FACTORY_CONTRACT_ADDRESS, FACTORY_CONTRACT_ABI, provider);

      const electionCount = await contract.electionCount();
      const elections = [];

      for (let i = 0; i < Number(electionCount); i++) {
        try {
          const election = await contract.getElection(i);
          elections.push({
            id: i,
            title: election[0],
            active: election[4]
          });
        } catch (error) {
          console.log('Error fetching election', i);
        }
      }

      if (elections.length === 0) {
        return { 
          success: true, 
          message: 'No elections found',
          elections: [] 
        };
      }

      const electionList = elections.map(e => `ID ${e.id}: ${e.title} (${e.active ? 'active' : 'inactive'})`).join(', ');

      return { 
        success: true, 
        message: `Found ${elections.length} elections: ${electionList}`,
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
        return { success: false, message: 'Please connect your wallet first' };
      }

      setStatusMessage('Casting your vote...');
      
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(FACTORY_CONTRACT_ADDRESS, FACTORY_CONTRACT_ABI, signer);

      // Get candidate name for confirmation
      let candidateName = '';
      try {
        const candidate = await contract.getCandidate(args.electionId, args.candidateId);
        candidateName = candidate[1];
      } catch (e) {
        console.log('Could not get candidate name');
      }

      const tx = await contract.vote(args.electionId, args.candidateId);
      await tx.wait();
      
      toast({
        title: '🗳️ Vote Cast Successfully!',
        description: candidateName ? `You voted for ${candidateName}` : 'Your vote has been recorded on the blockchain'
      });

      return { 
        success: true, 
        message: candidateName 
          ? `Vote successfully cast for ${candidateName}! Your vote has been permanently recorded on the blockchain.`
          : 'Vote successfully cast! Your vote has been recorded on the blockchain.'
      };
    } catch (error: any) {
      const message = error.reason || error.message || 'Failed to cast vote';
      toast({
        title: 'Vote Failed',
        description: message
      });
      return { 
        success: false,
        message: message
      };
    }
  };

  const connect = async () => {
    try {
      setIsConnecting(true);
      setStatusMessage('Requesting microphone access...');
      
      // Request microphone permission
      await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Initialize audio context
      audioContextRef.current = new AudioContext({ sampleRate: 24000 });
      
      setStatusMessage('Connecting to voice service...');
      
      // Connect to WebSocket
      const projectId = 'jydpniwgkjsncgyeqgkx';
      const wsUrl = `wss://${projectId}.supabase.co/functions/v1/realtime-voice`;
      
      console.log('Connecting to:', wsUrl);
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      const connectionTimeout = setTimeout(() => {
        if (ws.readyState !== WebSocket.OPEN) {
          console.error('Connection timeout');
          ws.close();
        toast({
          title: 'Connection Timeout',
          description: 'Unable to connect to voice service. Please try again.'
        });
        setIsConnecting(false);
        setStatusMessage('');
      }
    }, 15000);

    ws.onopen = () => {
        console.log('WebSocket connected to edge function');
        setStatusMessage('Initializing AI...');
      };

      ws.onmessage = async (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('Message type:', data.type);
          
          if (data.type === 'session.ready' || data.type === 'session.created') {
            clearTimeout(connectionTimeout);
            setIsConnected(true);
            setIsConnecting(false);
            setStatusMessage('');
            
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
              title: '🎤 Voice Assistant Active',
              description: 'Speak in any language to control the app'
            });
          } else if (data.type === 'response.audio.delta') {
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
            console.log('Voice transcript:', data.transcript);
            setTranscript(data.transcript);
          } else if (data.type === 'response.audio_transcript.delta') {
            setAssistantText(prev => prev + data.delta);
          } else if (data.type === 'response.audio_transcript.done') {
            // Keep the text visible for a moment before clearing
            setTimeout(() => setAssistantText(''), 3000);
          } else if (data.type === 'response.function_call_arguments.delta') {
            const callId = data.call_id;
            if (!functionCallBufferRef.current[callId]) {
              functionCallBufferRef.current[callId] = { name: data.name || '', args: '' };
            }
            if (data.name) {
              functionCallBufferRef.current[callId].name = data.name;
            }
            functionCallBufferRef.current[callId].args += data.delta;
          } else if (data.type === 'response.function_call_arguments.done') {
            const callId = data.call_id;
            const buffer = functionCallBufferRef.current[callId];
            const argsString = buffer?.args || data.arguments;
            const funcName = buffer?.name || data.name;
            
            try {
              const args = JSON.parse(argsString);
              await handleFunctionCall(funcName, args, callId);
            } catch (error) {
              console.error('Error parsing function args:', error, argsString);
            }
            delete functionCallBufferRef.current[callId];
          } else if (data.type === 'error') {
            console.error('Error from server:', data.error);
            toast({
              title: 'Error',
              description: typeof data.error === 'string' ? data.error : 'Voice service error'
            });
            setIsConnecting(false);
            setStatusMessage('');
          }
        } catch (error) {
          console.error('Error processing message:', error);
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        clearTimeout(connectionTimeout);
        toast({
          title: 'Connection Error',
          description: 'Failed to connect to voice assistant'
        });
        setIsConnecting(false);
        setStatusMessage('');
      };

      ws.onclose = () => {
        console.log('WebSocket closed');
        clearTimeout(connectionTimeout);
        setIsConnected(false);
        setIsConnecting(false);
        recorderRef.current?.stop();
        clearAudioQueue();
        setStatusMessage('');
      };

    } catch (error: any) {
      console.error('Connection error:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to start voice assistant'
      });
      setIsConnecting(false);
      setStatusMessage('');
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
    setStatusMessage('');
    functionCallBufferRef.current = {};
  };

  if (isMinimized) {
    return (
      <div className={`fixed bottom-6 right-6 z-50 ${className}`}>
        <Button
          onClick={() => setIsMinimized(false)}
          className={`rounded-full w-14 h-14 shadow-lg ${
            isConnected 
              ? 'bg-gradient-to-r from-green-500 to-emerald-500' 
              : 'bg-gradient-to-r from-primary to-accent'
          }`}
        >
          {isSpeaking ? (
            <Volume2 className="w-6 h-6 animate-pulse" />
          ) : (
            <Mic className="w-6 h-6" />
          )}
        </Button>
      </div>
    );
  }

  return (
    <div className={`fixed bottom-6 right-6 z-50 ${className}`}>
      <Card className="p-4 w-80 bg-card/95 backdrop-blur-sm border-2 border-primary/20 shadow-xl">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Volume2 className="w-5 h-5 text-primary" />
              <h3 className="font-semibold text-sm">Voice Assistant</h3>
            </div>
            <div className="flex items-center gap-1">
              {isSpeaking && (
                <div className="flex gap-0.5 mr-2">
                  <div className="w-1 h-3 bg-primary rounded-full animate-pulse" />
                  <div className="w-1 h-3 bg-primary rounded-full animate-pulse" style={{ animationDelay: '75ms' }} />
                  <div className="w-1 h-3 bg-primary rounded-full animate-pulse" style={{ animationDelay: '150ms' }} />
                </div>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => setIsMinimized(true)}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {statusMessage && (
            <div className="text-xs text-muted-foreground bg-muted/50 p-2 rounded animate-pulse">
              {statusMessage}
            </div>
          )}

          {(transcript || assistantText) && (
            <div className="space-y-2 text-sm max-h-32 overflow-y-auto">
              {transcript && (
                <div className="p-2 bg-primary/10 rounded">
                  <p className="font-medium text-xs text-muted-foreground mb-0.5">You:</p>
                  <p className="text-xs">{transcript}</p>
                </div>
              )}
              {assistantText && (
                <div className="p-2 bg-accent/10 rounded">
                  <p className="font-medium text-xs text-muted-foreground mb-0.5">Assistant:</p>
                  <p className="text-xs">{assistantText}</p>
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
                size="sm"
              >
                {isConnecting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Connecting...
                  </>
                ) : (
                  <>
                    <Mic className="w-4 h-4 mr-2" />
                    Start Voice Control
                  </>
                )}
              </Button>
            ) : (
              <Button
                onClick={disconnect}
                variant="outline"
                className="w-full border-destructive/50 text-destructive hover:bg-destructive/10"
                size="sm"
              >
                <MicOff className="w-4 h-4 mr-2" />
                Stop
              </Button>
            )}
          </div>

          <p className="text-[10px] text-muted-foreground text-center">
            {isConnected 
              ? '🎤 Listening... Speak in any language' 
              : 'Click to start voice commands'}
          </p>
        </div>
      </Card>
    </div>
  );
};

export default VoiceAssistant;
