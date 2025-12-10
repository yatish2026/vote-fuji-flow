import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, upgrade, connection',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

serve(async (req) => {
  console.log('=== Realtime Voice Function Called ===');
  console.log('Method:', req.method);
  
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const upgrade = req.headers.get('upgrade') || '';
  
  if (upgrade.toLowerCase() !== 'websocket') {
    return new Response('Expected websocket', { status: 426, headers: corsHeaders });
  }

  try {
    const { socket: clientSocket, response } = Deno.upgradeWebSocket(req);

    let openaiWs: WebSocket | null = null;
    
    clientSocket.onopen = async () => {
      console.log('✅ Client WebSocket connected');
      
      const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
      if (!OPENAI_API_KEY) {
        console.error('❌ OPENAI_API_KEY not configured');
        clientSocket.send(JSON.stringify({ 
          type: 'error', 
          error: 'OPENAI_API_KEY not configured' 
        }));
        clientSocket.close();
        return;
      }

      try {
        // Get ephemeral token from OpenAI
        console.log('Requesting ephemeral token from OpenAI...');
        const tokenResponse = await fetch('https://api.openai.com/v1/realtime/sessions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${OPENAI_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'gpt-4o-realtime-preview-2024-12-17',
            voice: 'alloy',
            instructions: `You are a multilingual voice assistant for an election voting platform. 
You MUST respond in the SAME LANGUAGE the user speaks to you. If they speak Hindi, respond in Hindi. If they speak Tamil, respond in Tamil. If they speak any other language, respond in that language.

Your capabilities include:

**Navigation:**
- Navigate to different pages: home/landing page, admin page, vote page, auth/login page
- Use the navigate_to tool to change pages when user asks

**Election Management (Admin):**
- Create new elections by collecting: election name, description, candidate names, start time, and end time
- List and view all elections with their details

**Voting (Most Important):**
- When user wants to vote, first list available elections using list_elections
- Then get election details with get_election_details to show candidates
- Ask user which candidate they want to vote for by name
- Match the candidate name to the candidate ID and cast the vote using cast_vote
- ALWAYS confirm the vote was cast successfully

**General Help:**
- Answer questions about the platform in user's language
- Explain how to use features
- Provide guidance on election and voting processes

Always be conversational, clear, and confirm important actions. When a user says they want to vote, guide them through the entire process step by step.`,
            input_audio_transcription: {
              model: 'whisper-1'
            },
            turn_detection: {
              type: 'server_vad',
              threshold: 0.5,
              prefix_padding_ms: 300,
              silence_duration_ms: 800
            },
            tools: [
              {
                type: 'function',
                name: 'navigate_to',
                description: 'Navigate to a different page in the application.',
                parameters: {
                  type: 'object',
                  properties: {
                    page: { 
                      type: 'string', 
                      enum: ['home', 'admin', 'vote', 'auth'],
                      description: 'The page to navigate to'
                    }
                  },
                  required: ['page']
                }
              },
              {
                type: 'function',
                name: 'create_election',
                description: 'Create a new election with all required details.',
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
                description: 'Get list of all elections. Call this first when user wants to vote.',
                parameters: {
                  type: 'object',
                  properties: {},
                  required: []
                }
              },
              {
                type: 'function',
                name: 'get_election_details',
                description: 'Get detailed information about a specific election including all candidates and their IDs.',
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
                description: 'Cast a vote for a candidate. Use the candidate ID from get_election_details.',
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
            tool_choice: 'auto'
          }),
        });

        if (!tokenResponse.ok) {
          const errorText = await tokenResponse.text();
          console.error('❌ Failed to get ephemeral token:', errorText);
          clientSocket.send(JSON.stringify({ 
            type: 'error', 
            error: 'Failed to connect to OpenAI' 
          }));
          clientSocket.close();
          return;
        }

        const tokenData = await tokenResponse.json();
        const ephemeralKey = tokenData.client_secret?.value;
        
        if (!ephemeralKey) {
          console.error('❌ No ephemeral key in response');
          clientSocket.send(JSON.stringify({ 
            type: 'error', 
            error: 'Failed to get authentication token' 
          }));
          clientSocket.close();
          return;
        }

        console.log('✅ Got ephemeral token, connecting to OpenAI Realtime...');
        
        // Connect to OpenAI with ephemeral token
        const url = `wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-12-17`;
        openaiWs = new WebSocket(url, ['realtime', `openai-insecure-api-key.${ephemeralKey}`, 'openai-beta.realtime-v1']);

        openaiWs.onopen = () => {
          console.log('✅ Connected to OpenAI Realtime API');
          clientSocket.send(JSON.stringify({ type: 'session.ready' }));
        };

        openaiWs.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            console.log('OpenAI message type:', message.type);
            
            // Forward all messages to client
            clientSocket.send(event.data);
          } catch (error) {
            console.error('Error processing OpenAI message:', error);
          }
        };

        openaiWs.onerror = (error) => {
          console.error('❌ OpenAI WebSocket error:', error);
          clientSocket.send(JSON.stringify({ 
            type: 'error', 
            error: 'OpenAI connection error' 
          }));
        };

        openaiWs.onclose = (event) => {
          console.log('OpenAI connection closed:', event.code, event.reason);
          clientSocket.close();
        };

      } catch (error) {
        console.error('❌ Error connecting to OpenAI:', error);
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
        console.error('❌ Error forwarding to OpenAI:', error);
      }
    };

    clientSocket.onclose = () => {
      console.log('Client disconnected');
      openaiWs?.close();
    };

    clientSocket.onerror = (error) => {
      console.error('❌ Client socket error:', error);
      openaiWs?.close();
    };

    return response;
  } catch (error) {
    console.error('❌ WebSocket upgrade error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
