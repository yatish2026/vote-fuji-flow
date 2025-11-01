import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, upgrade, connection',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const upgrade = req.headers.get('upgrade') || '';
  if (upgrade.toLowerCase() !== 'websocket') {
    return new Response('Expected websocket', { status: 426, headers: corsHeaders });
  }

  const { socket: clientSocket, response } = Deno.upgradeWebSocket(req);

  let openaiWs: WebSocket | null = null;
  
  clientSocket.onopen = async () => {
    console.log('Client connected');
    
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    if (!OPENAI_API_KEY) {
      clientSocket.send(JSON.stringify({ 
        type: 'error', 
        error: 'OPENAI_API_KEY not configured' 
      }));
      clientSocket.close();
      return;
    }

    try {
      const url = 'wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-10-01';
      openaiWs = new WebSocket(url, {
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'OpenAI-Beta': 'realtime=v1'
        }
      });

      openaiWs.onopen = () => {
        console.log('Connected to OpenAI');
      };

      openaiWs.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          console.log('OpenAI message type:', message.type);
          
          // Send session.update after session.created
          if (message.type === 'session.created') {
            const sessionConfig = {
              type: 'session.update',
              session: {
                modalities: ['text', 'audio'],
                instructions: `You are a helpful voice assistant for an election voting platform. 

Your capabilities include:

**Navigation:**
- Navigate to different pages: home/landing page, admin page, vote page, auth/login page
- Use the navigate_to tool to change pages

**Election Management (Admin):**
- Create new elections by collecting: election name, description, candidate names, start time, and end time
- Ask for each detail one at a time systematically
- List and view all elections with their details

**Voting:**
- Help users view active elections
- Show candidates in each election
- Cast votes for selected candidates
- Confirm all voting actions

**General Help:**
- Answer questions about the platform
- Explain how to use features
- Provide guidance on election and voting processes

Always be conversational, clear, and confirm important actions before executing them. When users ask to go somewhere or do something, help them navigate and accomplish their goals.`,
                voice: 'alloy',
                input_audio_format: 'pcm16',
                output_audio_format: 'pcm16',
                input_audio_transcription: {
                  model: 'whisper-1'
                },
                turn_detection: {
                  type: 'server_vad',
                  threshold: 0.5,
                  prefix_padding_ms: 300,
                  silence_duration_ms: 1000
                },
                tools: [
                  {
                    type: 'function',
                    name: 'navigate_to',
                    description: 'Navigate to a different page in the application. Use this when user wants to go to a different page.',
                    parameters: {
                      type: 'object',
                      properties: {
                        page: { 
                          type: 'string', 
                          enum: ['home', 'admin', 'vote', 'auth'],
                          description: 'The page to navigate to: home (landing page), admin (election management), vote (voting page), auth (login/register)'
                        }
                      },
                      required: ['page']
                    }
                  },
                  {
                    type: 'function',
                    name: 'create_election',
                    description: 'Create a new election with all required details. Tell the user you are creating the election.',
                    parameters: {
                      type: 'object',
                      properties: {
                        title: { type: 'string', description: 'Election title/name' },
                        description: { type: 'string', description: 'Election description' },
                        candidates: { 
                          type: 'array', 
                          items: { type: 'string' },
                          description: 'Array of candidate names'
                        },
                        startTime: { type: 'string', description: 'Start date and time in ISO format' },
                        endTime: { type: 'string', description: 'End date and time in ISO format' }
                      },
                      required: ['title', 'description', 'candidates', 'startTime', 'endTime']
                    }
                  },
                  {
                    type: 'function',
                    name: 'list_elections',
                    description: 'Get list of all elections. Tell the user you are fetching the elections.',
                    parameters: {
                      type: 'object',
                      properties: {},
                      required: []
                    }
                  },
                  {
                    type: 'function',
                    name: 'get_election_details',
                    description: 'Get detailed information about a specific election including candidates.',
                    parameters: {
                      type: 'object',
                      properties: {
                        electionId: { type: 'number', description: 'Election ID' }
                      },
                      required: ['electionId']
                    }
                  },
                  {
                    type: 'function',
                    name: 'cast_vote',
                    description: 'Cast a vote for a candidate in an election. Tell the user you are recording their vote.',
                    parameters: {
                      type: 'object',
                      properties: {
                        electionId: { type: 'number', description: 'Election ID' },
                        candidateId: { type: 'number', description: 'Candidate ID to vote for' }
                      },
                      required: ['electionId', 'candidateId']
                    }
                  }
                ],
                tool_choice: 'auto',
                temperature: 0.8,
                max_response_output_tokens: 'inf'
              }
            };
            
            openaiWs?.send(JSON.stringify(sessionConfig));
            console.log('Session configuration sent');
          }
          
          // Forward all messages to client
          clientSocket.send(event.data);
        } catch (error) {
          console.error('Error processing OpenAI message:', error);
        }
      };

      openaiWs.onerror = (error) => {
        console.error('OpenAI WebSocket error:', error);
        clientSocket.send(JSON.stringify({ 
          type: 'error', 
          error: 'OpenAI connection error' 
        }));
      };

      openaiWs.onclose = () => {
        console.log('OpenAI connection closed');
        clientSocket.close();
      };

    } catch (error) {
      console.error('Error connecting to OpenAI:', error);
      clientSocket.send(JSON.stringify({ 
        type: 'error', 
        error: error.message 
      }));
      clientSocket.close();
    }
  };

  clientSocket.onmessage = (event) => {
    try {
      if (openaiWs && openaiWs.readyState === WebSocket.OPEN) {
        openaiWs.send(event.data);
      }
    } catch (error) {
      console.error('Error forwarding to OpenAI:', error);
    }
  };

  clientSocket.onclose = () => {
    console.log('Client disconnected');
    openaiWs?.close();
  };

  clientSocket.onerror = (error) => {
    console.error('Client socket error:', error);
    openaiWs?.close();
  };

  return response;
});
