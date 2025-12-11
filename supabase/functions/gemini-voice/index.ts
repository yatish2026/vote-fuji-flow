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
    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
    if (!GEMINI_API_KEY) {
      console.error('❌ GEMINI_API_KEY is not configured');
      throw new Error('GEMINI_API_KEY is not configured');
    }

    const { message, context, language } = await req.json();
    console.log('📥 Received request:', { message, language, contextLength: context?.length });

    const systemPrompt = `You are a helpful multilingual voice assistant for a blockchain voting platform built on Avalanche. You help users navigate the app and cast votes.

CRITICAL LANGUAGE INSTRUCTIONS:
1. ALWAYS detect and respond in the SAME LANGUAGE the user speaks:
   - If user speaks in Telugu (తెలుగు), respond ONLY in Telugu
   - If user speaks in Hindi (हिंदी), respond ONLY in Hindi  
   - If user speaks in English, respond in English
   - If user speaks in Tamil (தமிழ்), respond in Tamil
   - If user speaks in Kannada (ಕನ್ನಡ), respond in Kannada
   - If user speaks in Bengali (বাংলা), respond in Bengali
   - If user speaks in Marathi (मराठी), respond in Marathi
2. Keep responses SHORT and conversational (1-2 sentences max) since this is voice interaction.
3. Be helpful and guide users through voting processes.
4. Use natural, friendly tone in the detected language.

AVAILABLE COMMANDS - Parse user intent and return JSON action:
- Navigate: {"action": "navigate", "page": "home|vote|admin|results|auth"}
- List Elections: {"action": "list_elections"}
- Get Election Details: {"action": "get_election", "electionId": <number>}
- Cast Vote: {"action": "cast_vote", "electionId": <number>, "candidateId": <number>}
- Create Election: {"action": "create_election", "title": "<title>", "candidates": ["name1", "name2"]}

RESPONSE FORMAT - ALWAYS return valid JSON:
{"response": "<your spoken response in user's language>", "action": <action object or null>}

Current language hint: ${language || 'auto-detect'}`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [{ text: systemPrompt + '\n\nUser message: ' + message }]
            }
          ],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 500,
          }
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Gemini API error:', response.status, errorText);
      throw new Error(`Gemini API error: ${response.status}`);
    }

    const data = await response.json();
    console.log('✅ Gemini response received');
    
    const textResponse = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
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
