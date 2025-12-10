import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      console.error('❌ LOVABLE_API_KEY is not configured');
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    const { message, context, language } = await req.json();
    console.log('📥 Received request:', { message, language, contextLength: context?.length });

    const systemPrompt = `You are a helpful multilingual voice assistant for a blockchain voting platform built on Avalanche. You help users navigate the app and cast votes.

CRITICAL INSTRUCTIONS:
1. Respond in the SAME LANGUAGE the user speaks. If they speak Hindi, respond in Hindi. If they speak Tamil, respond in Tamil, etc.
2. Keep responses SHORT and conversational (1-2 sentences max) since this is voice interaction.
3. Be helpful and guide users through voting processes.

AVAILABLE COMMANDS - Parse user intent and return JSON action:
- Navigate: {"action": "navigate", "page": "home|vote|admin|results"}
- List Elections: {"action": "list_elections"}
- Get Election Details: {"action": "get_election", "electionId": <number>}
- Cast Vote: {"action": "cast_vote", "electionId": <number>, "candidateId": <number>}
- Create Election: {"action": "create_election", "title": "<title>", "candidates": ["name1", "name2"]}

RESPONSE FORMAT:
If user wants an action, respond with:
{"response": "<your spoken response in user's language>", "action": <action object or null>}

If just chatting, respond with:
{"response": "<your spoken response in user's language>", "action": null}

Current language hint: ${language || 'auto-detect'}`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: message }
        ],
        temperature: 0.7,
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ AI Gateway error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded', response: 'Too many requests. Please try again in a moment.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'Payment required', response: 'AI credits exhausted. Please add credits.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      throw new Error(`AI Gateway error: ${response.status}`);
    }

    const data = await response.json();
    console.log('✅ AI response received');
    
    const textResponse = data.choices?.[0]?.message?.content || '';
    console.log('📤 Raw response:', textResponse);

    // Try to parse as JSON, fallback to plain text
    let parsedResponse;
    try {
      const cleanedText = textResponse.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      parsedResponse = JSON.parse(cleanedText);
    } catch {
      parsedResponse = { response: textResponse, action: null };
    }

    return new Response(JSON.stringify(parsedResponse), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('❌ Error:', error);
    return new Response(
      JSON.stringify({ error: error.message, response: 'Sorry, I encountered an error. Please try again.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
