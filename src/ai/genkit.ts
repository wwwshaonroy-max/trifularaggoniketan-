import 'server-only';
import { googleAI } from '@genkit-ai/googleai';
import { genkit } from 'genkit';

const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENAI_API_KEY;

if (!apiKey) {
  console.error("CRITICAL ERROR: GEMINI_API_KEY is not defined in the environment variables.");
}

export const ai = genkit({
  plugins: [googleAI({ apiKey: apiKey || '' })],
  model: 'googleai/gemini-3.5-flash',
});