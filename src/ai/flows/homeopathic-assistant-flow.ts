'use server';

import { ai } from '../genkit';
import { z } from 'zod';

const HomeopathicAssistantInputSchema = z.object({
  caseData: z.string().describe('The complete case data of the patient.'),
});
export type HomeopathicAssistantInput = z.infer<typeof HomeopathicAssistantInputSchema>;

const RemedySuggestionSchema = z.object({
  remedyName: z.string(),
  potency: z.string(),
  justification: z.string(),
});

const HomeopathicAssistantOutputSchema = z.object({
  keySymptoms: z.array(z.string()),
  remedySuggestions: z.array(RemedySuggestionSchema),
});
export type HomeopathicAssistantOutput = z.infer<typeof HomeopathicAssistantOutputSchema>;

const homeopathicAssistantPrompt = ai.definePrompt({
  name: 'homeopathicAssistantPrompt',
  input: { schema: HomeopathicAssistantInputSchema },
  output: { schema: HomeopathicAssistantOutputSchema },
  config: {
    temperature: 0.2,
  },
  prompt: `You are an expert homeopathic doctor's assistant. Analyze the following patient case data in Bengali.
  
Identify the key guiding symptoms (strange, rare, peculiar).
Then, suggest the most likely homeopathic remedies based on classical homeopathic principles.
Provide a justification for each remedy in Bengali.

Patient Case Data:
{{{caseData}}}
`,
});

export const analyzeHomeopathicCase = ai.defineFlow(
  {
    name: 'analyzeHomeopathicCase',
    inputSchema: HomeopathicAssistantInputSchema,
    outputSchema: HomeopathicAssistantOutputSchema,
  },
  async (input: HomeopathicAssistantInput) => {
    const { output } = await homeopathicAssistantPrompt(input);
    if (!output) {
      throw new Error('AI did not return any analysis.');
    }
    return output;
  }
);
