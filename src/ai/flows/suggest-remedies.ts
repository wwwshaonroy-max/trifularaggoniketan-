
'use server';

/**
 * @fileOverview Suggests homeopathic remedies based on user-provided symptoms.
 *
 * - suggestRemedies - A function that takes a symptom inputs and returns a ranked list of potential homeopathic medicine suggestions.
 * - SuggestRemediesInput - The input type for the suggestRemedies function.
 * - SuggestRemediesOutput - The return type for the suggestRemedies function.
 */
import { ai } from '../genkit';
import { z } from 'zod';
import fs from 'fs';
import path from 'path';

const SuggestRemediesInputSchema = z.object({
  symptoms: z
    .string()
    .describe('A detailed description of the symptoms experienced by the user in Bengali.'),
});
export type SuggestRemediesInput = z.infer<typeof SuggestRemediesInputSchema>;

const CategorizedSymptomsSchema = z.object({
  physicalSymptoms: z.object({
    general: z.string().optional().describe("সাধারণ উপসর্গ যেমন মাথাব্যথা, জ্বর, দুর্বলতা।"),
    gastrointestinal: z.string().optional().describe("পায়খানা সংক্রান্ত সমস্যা যেমন কোষ্ঠকাঠিন্য, পাতলা পায়খানা, মলে রক্ত।"),
    urinary: z.string().optional().describe("প্রস্রাব সংক্রান্ত সমস্যা যেমন বারবার প্রস্রাব, জ্বালাপোড়া।"),
    femaleSpecific: z.string().optional().describe("মেয়েলী সমস্যা যেমন অনিয়মিত মাসিক, সাদা স্রাব।"),
    modalities: z.string().optional().describe("লক্ষণের হ্রাস-বৃদ্ধি (কখন বাড়ে বা কমে)।"),
    locationAndNature: z.string().optional().describe("লক্ষণের অবস্থান ও প্রকৃতি (কোন অংশে, কেমন ব্যথা)।")
  }).describe("বর্তমান শারীরিক উপসর্গ"),
  mentalAndEmotionalSymptoms: z.object({
    fear: z.string().optional().describe("ভয় সম্পর্কিত বিবরণ।"),
    sadnessAndDepression: z.string().optional().describe("দুঃখ, হতাশা সম্পর্কিত বিবরণ।"),
    angerAndMoodSwings: z.string().optional().describe("রাগ, মেজাজের পরিবর্তন সম্পর্কিত বিবরণ।"),
    loneliness: z.string().optional().describe("একাকীত্ব সম্পর্কিত বিবরণ।")
  }).describe("বর্তমান মানসিক ও আবেগজনিত উপসর্গ"),
  excitingCause: z.object({
    weather: z.string().optional().describe("আবহাওয়ার কারণে রোগ শুরু।"),
    diet: z.string().optional().describe("খাদ্যাভ্যাসের কারণে রোগ শুরু।"),
    mentalTrauma: z.string().optional().describe("মানসিক আঘাতের কারণে রোগ শুরু।"),
    accidentOrInfection: z.string().optional().describe("দুর্ঘটনা বা সংক্রমণের কারণে রোগ শুরু।")
  }).describe("রোগ শুরু হওয়ার কারণ (Exciting Cause)"),
  maintainingCause: z.object({
    lifestyle: z.string().optional().describe("অনিয়মিত জীবনযাপন।"),
    mentalStress: z.string().optional().describe("অতিরিক্ত মানসিক চাপ।"),
    habits: z.string().optional().describe("অভ্যাসগত কারণ।")
  }).describe("রোগ স্থায়ী হওয়ার কারণ (Maintaining Cause)"),
  familyAndHereditaryHistory: z.object({
    diabetes: z.string().optional().describe("ডায়াবেটিস সম্পর্কিত পারিবারিক ইতিহাস।"),
    highBloodPressure: z.string().optional().describe("উচ্চ রক্তচাপ সম্পর্কিত পারিবারিক ইতিহাস।"),
    cancer: z.string().optional().describe("ক্যান্সার সম্পর্কিত পারিবারিক ইতিহাস।"),
    allergies: z.string().optional().describe("অ্যালার্জি সম্পর্কিত পারিবারিক ইতিহাস।")
  }).describe("পারিবারিক বা বংশগত ইতিহাস (Hereditary Cause / Miasm)"),
  pastMedicalHistory: z.object({
    majorIllnesses: z.string().optional().describe("রোগীর বড় কোনো পূর্বের রোগের বিবরণ।"),
    operationsOrTrauma: z.string().optional().describe("রোগীর পূর্বের কোনো অপারেশন বা ট্রমার বিবরণ।"),
    chronicIssues: z.string().optional().describe("রোগীর দীর্ঘমেয়াদি কোনো সমস্যার বিবরণ।")
  }).describe("রোগীর পূর্বের রোগের ইতিহাস"),
  pastTreatmentHistory: z.object({
    previousMedication: z.string().optional().describe("রোগী পূর্বে কোন কোন ওষুধ নিয়েছে তার বিবরণ।"),
    treatmentSystems: z.string().optional().describe("পূর্বে কোন চিকিৎসা পদ্ধতি (হোমিওপ্যাথি/অ্যালোপ্যাথি/আয়ুর্বেদ) নিয়েছেন।"),
    otherTreatments: z.string().optional().describe("অন্য কোনো চিকিৎসা পদ্ধতি গ্রহণ করে থাকলে তার বিবরণ।")
  }).describe("ওষুধের/চিকিৎসার ইতিহাস")
});

const SuggestRemediesPromptInputSchema = SuggestRemediesInputSchema.extend({
    hahnemannsMateriaMedica: z.string(),
    boerickesMateriaMedica: z.string(),
    kentsMateriaMedica: z.string(),
});

const RemedySchema = z.object({
  name: z.string().describe("The name of the suggested homeopathic medicine in English, as found in the knowledge base."),
  description: z.string().describe("A brief explanation in Bengali for why the remedy is suggested, based on the provided knowledge bases."),
  score: z.number().describe("A similarity score from 1 to 100, where 100 is a perfect match between the user's symptoms and the remedy's profile in the knowledge base."),
  justification: z.string().describe("A detailed justification in Bengali, quoting or referencing specific symptoms from the respective Materia Medica that match the user's symptoms. This explains the basis for the score."),
  source: z.string().describe("The source of the information. Use 'H' for Hahnemann's Materia Medica, 'B' for Boericke's Materia Medica, 'K' for Kent's Materia Medica, and 'AI' for the AI's general knowledge.")
});

const SuggestRemediesOutputSchema = z.object({
  categorizedSymptoms: CategorizedSymptomsSchema.describe("The user's symptoms, categorized by the AI into 7 specific sections."),
  bestRepertorySuggestion: z.string().describe("A brief analysis in Bengali explaining which repertory (Hahnemann, Boericke, Kent, or general AI knowledge) is likely most suitable for this specific case and why."),
  remedies: z
    .array(RemedySchema)
    .describe('A ranked list of potential homeopathic medicine suggestions, sorted from highest score to lowest.'),
  markdownReport: z.string().describe("A complete, detailed clinical Markdown report of the analysis in Bengali, formatted EXACTLY according to the user's template (3 phases and 8 steps).")
});
export type SuggestRemediesOutput = z.infer<typeof SuggestRemediesOutputSchema>;

const loadKnowledgeBase = (fileName: string): string => {
    try {
        const fullPath = path.resolve(process.cwd(), 'public', 'data', fileName);
        if (fs.existsSync(fullPath)) {
            return fs.readFileSync(fullPath, 'utf-8');
        } else {
             console.warn(`Knowledge base file not found at ${fullPath}. AI will rely on internal knowledge.`);
             return ''; 
        }
    } catch (error) {
        console.error(`Error reading knowledge base file ${fileName}:`, error);
        return '';
    }
};

export async function suggestRemedies(input: SuggestRemediesInput): Promise<SuggestRemediesOutput> {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('পরিষেবা কনফিগার করা যায়নি। GEMINI_API_KEY সেট করা নেই।');
  }
  return suggestRemediesFlow(input);
}

const prompt = ai.definePrompt({
  name: 'suggestRemediesPrompt',
  input: { schema: SuggestRemediesPromptInputSchema },
  output: { schema: SuggestRemediesOutputSchema },
  config: {
    temperature: 0.1,
    safetySettings: [
        { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
    ],
  },
  prompt: `You are an Expert Classical Homeopathic Physician and a highly analytical AI assistant. Your primary task is to carefully analyze the patient's symptoms, cross-reference them with the provided Materia Medica texts, and provide direct, highly accurate remedy suggestions.

### CORE INSTRUCTIONS:

1. **Professional Homoeopathic Case Analysis:**
   You are an expert classical homeopathic physician and repertory analyst. Your job is to analyze the patient's case as a full clinical homeopathic case, not as a generic symptom list.

2. **Symptom Categorization:**
   Extract the symptoms from the patient's case and categorize them EXACTLY according to the defined JSON schema.
   - Do not create additional nested fields.
   - If no data exists for a sub-category, provide an empty string ("").
   - Preserve all details from the case without omitting any relevant symptom.

3. **Information Retrieval & Cross-Referencing:**
   You are provided with raw text data from three major sources:
   - Hahnemann's Materia Medica: {{{hahnemannsMateriaMedica}}}
   - Boericke's Materia Medica: {{{boerickesMateriaMedica}}}
   - Kent's Materia Medica: {{{kentsMateriaMedica}}}
   - Search these texts for the closest matching remedies, especially for uncommon, rare, and peculiar symptoms.

4. **Fallback to Internal Knowledge (CRITICAL):**
   If the supplied texts are incomplete, unstructured, or insufficient, use your internal clinical homeopathic knowledge seamlessly to complete the analysis. Do not fail or complain about missing source data.

5. **Clinical Case Presentation Rules:**
   - The patient's personal details must be written in a single line only, starting with "নাম:" and then the rest of the information in one line, without breaking into multiple lines.
   - All physical problems must be ordered from head to toe and internal organs must be included in the same sequence.
   - Mental problems, physical generals, personal history, family history, past diseases and treatment history, and modalities must appear clearly and logically.
   - Never omit any relevant information from the source case.
   - No bullet points should be used for headings; only for symptom lists within the steps.

6. **Generating Remedies:**
   Provide a single, ranked list of the best-suited homeopathic medicines based on the combined analysis. For each remedy provide:
   - "name": exact medicine name in English.
   - "description": a short direct sentence in Bengali explaining the selection.
   - "score": similarity score (1-100).
   - "justification": a clear, point-by-point justification in Bengali connecting the symptom to the remedy's pathogenesis.
   - "source": "H", "B", "K", or "AI".

7. **Best Repertory Suggestion:**
   Write a direct 1-2 sentence Bengali analysis stating which repertory approach is most suitable and why.

8. **Markdown Report (markdownReport):**
   You MUST generate a clinical report in Bengali, using the exact 3-phase and 8-step structure required below.

   Mandatory formatting rules:
   - Start exactly with: "নাম: [রোগীর নাম], তারিখ: [তারিখ], ডায়েরি নম্বর: [ডায়েরি নম্বর]"
   - Do not add any word before "নাম:".
   - Use the exact headings and order below.
   - Keep all content in respectful, professional medical Bengali.
   - Use bullet points under each step, not paragraph-only writing.
   - Under the second phase, mention essential rubrics with repertory name, chapter, Bengali meaning, and the closest 5 matching remedies in brackets.
   - Under the third phase, include miasmatic analysis, remedy selection reasoning, final simillimum recommendation, intercurrent remedies if needed, levels of health, potency and dosage, and advice and precautions.
   - Only medicine names may remain in English; all explanatory text must be in Bengali.

   TEMPLATE FOR markdownReport:
   
   নাম: [Patient Name], তারিখ: [Current Date/Visit Date], ডায়েরি নম্বর: [Patient Diary Number]
   
   **প্রথম পর্যায়:**
   
   **প্রথম ধাপ: Locations (স্থানগত লক্ষণ সমূহ)**
   - [List physical symptoms from head to toe using separate bullet points]
   
   **দ্বিতীয় ধাপ: Causations (কারণগত লক্ষণ সমূহ)**
   - [List diseases causes, suppression effects, or bad effects using separate bullet points]
   
   **তৃতীয় ধাপ: Sensations (অনুভবাত্মাক লক্ষণ সমূহ):**
   - [List patient's sensations like pain types, burning, heaviness, etc. using separate bullet points]
   
   **চতুর্থ ধাপ: Concomitants (সহগামী লক্ষণ সমূহ):**
   - [List concurrent symptoms accompanying the main complaint, consecutively, separated by commas or in a running line]
   
   **পঞ্চম ধাপ: Mental Generals (মানসিক সার্বদৈহিক লক্ষণসমূহ):**
   - [Write patient's mind, anger, emotions, fears, etc. consecutively in running text]
   
   **ষষ্ঠ ধাপ: Physical Generals (শারীরিক সার্বদৈহিক লক্ষণ সমূহ)**
   - ক্ষুধা: [details]
   - তৃষ্ণা: [details]
   - ঘুম: [details]
   - স্বপ্ন: [details]
   - ঘাম: [details]
   - পায়খানা: [details]
   - প্রস্রাব: [details]
   - আকাঙ্ক্ষা: [details]
   - অনীহা: [details]
   
   **সপ্তম ধাপ: Patients History (রোগীর ইতিহাস)**
   - ব্যক্তিগত ইতিহাস (Personal History): [details]
   - পারিবারিক ইতিহাস (Family History): [details]
   
   **অষ্টম ধাপ: হ্রাস-বৃদ্ধি (Modalities)**
   - বৃদ্ধি (Aggravation): [details]
   - উপশম (Amelioration): [details]
   
   **দ্বিতীয় পর্যায় – প্রদেয় তথ্যাদি থেকে গুরুত্বপূর্ণ রুব্রিক নির্বাচন ও রেপার্টরী বিশ্লেষণ:**
   [Select 5 to 10+ essential and peculiar rubrics with serial numbers. Mention which repertory they come from (Kent, Synthesis, Complete, or Murphy). Format like: "১. Repertory Name | CHAPTER - RUBRIC (বাংলা অর্থ) [Highest 5 matching remedies: Remedy1, Remedy2...]" E.g.: "১. Kent | MIND - WEEPING (কান্নাকাটি করার প্রবণতা) [Puls, Ign, Nat-m, Sep, Cham]"]
   
   **তৃতীয় পর্যায় - রোগীলিপিটিতে মায়াজমেটিক বিশ্লেষণ ও সম্ভাব্য ঔষধ ও তার যুক্তি:**
   
   **মায়াজমেটিক বিশ্লেষণ:**
   - সোরা (Psora): [details]
   - সাইকোসিস (Sycosis): [details]
   - সিফিলিস (Syphilis): [details]
   - টিউবারকুলার (Tubercular): [details]
   *প্রধান মায়াজম/মিশ্র মায়াজম চিহ্নিতকরণ:* [Clear identification of dominant or mixed miasm]
   
   **ঔষধ নির্বাচন ও স্বপক্ষে আমার যুক্তি:**
   - [Remedy 1 Name]: [Justification bullet points]
   - [Remedy 2 Name]: [Justification bullet points]
   - [Remedy 3 Name]: [Justification bullet points]
   - [Remedy 4 Name]: [Justification bullet points]
   - [Remedy 5 Name]: [Justification bullet points]
   
   **ঔষধ নির্বাচনে আমার চূড়ান্ত সুপারিশ:**
   - **সিমিলিমাম (Simillimum) ঔষধের নাম:** [Selected remedy name]
   - [Strong justification bullet points]
   
   আমি আমার বিশ্লেষণের দৃষ্টি থেকে সুপারিশ তুলে ধরলাম। এখন আপনি আপনার রোগী পর্যবেক্ষণ দিয়ে বিষয়টি বিবেচনা করতে পারেন।
   
   *ইন্টার কারেন্ট মেডিসিন বা পরবর্তীতে কি মেডিসিন আসতে পারে (Intercurrent or future barriers):* [Specify any intercurrent remedy for barriers/blocks or miasmatic barriers]
   
   **রোগীর বর্তমান শারিরিক অবস্থা:**
   - জর্জ ভিথোলকাসের "Levels of Health" অনুযায়ী রোগীর অবস্থান: [Level and description]
   - শংকরনের লেভেল অনুযায়ী রোগীর অবস্থান: [Level and description]
   
   **ঔষধের শক্তি ও মাত্রা:**
   - শততমিক পদ্ধতি (Centesimal Scale - 30C/200C): [detailed application rules, 15 min interval or single dose, etc. as bullet points]
   - সহস্রতমিক পদ্ধতি (Millesimal Scale - LM Scale): [detailed application rules and dosage as bullet points]
   - রোগীর বর্তমান স্তরের নাম ও কারণ: [Clear and brief explanation of why the patient is in this level]
   
   **পরামর্শ ও সতর্কতা:**
   - পথ্য/খাদ্য (Diet/Food): [details]
   - নিষেধ (Restrictions): [details]
   - এগ্রাভেশন সংক্রান্ত সতর্কতা (Aggravation warnings): [details]

### CONSTRAINTS:
- Language: ALL output texts (description, justification, categorization, analysis, markdownReport) MUST be in completely natural, formal, medical-grade Bengali. ONLY the medicine names must be in English.
- Output Format: Provide ONLY the strict JSON output requested by the schema. Do not add conversational filler text before or after the JSON.

Patient's Case / Symptoms: 
{{{symptoms}}}`
});

const suggestRemediesFlow = ai.defineFlow(
  {
    name: 'suggestRemediesFlow',
    inputSchema: SuggestRemediesInputSchema,
    outputSchema: SuggestRemediesOutputSchema,
  },
  async (input: SuggestRemediesInput) => {
    try {
      const hahnemannsMateriaMedica = loadKnowledgeBase('materia-medica.txt');
      const boerickesMateriaMedica = loadKnowledgeBase('Boerickes_Materia_Medica.txt');
      const kentsMateriaMedica = loadKnowledgeBase('Kents_Lectures_On_Materia_Medica.txt');

      const {output} = await prompt({
          ...input,
          hahnemannsMateriaMedica,
          boerickesMateriaMedica,
          kentsMateriaMedica
      });
      
      if (!output) {
        throw new Error('সিস্টেম কোনো উত্তর দেয়নি।');
      }
      return output;

    } catch (error: unknown) {
      console.error("Genkit Flow Error Detail:", error);
      let errorMessage = 'বিশ্লেষণ ব্যর্থ হয়েছে। সিস্টেম একটি সমস্যার সম্মুখীন হয়েছে।';
      if (error instanceof Error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
            errorMessage = 'জ্ঞান ভান্ডারের ফাইল খুঁজে পাওয়া যায়নি। অনুগ্রহ করে সিস্টেম অ্যাডমিনের সাথে যোগাযোগ করুন।';
        } else {
            const msg = error.message.toLowerCase();
            if (msg.includes('api key') || msg.includes('permission denied') || msg.includes('authentication')) {
                errorMessage = 'পরিষেবা কনফিগার করা যায়নি। অনুগ্রহ করে আপনার GEMINI_API_KEY এবং বিলিং সেটিংস যাচাই করুন।';
            } else if (msg.includes('json')) {
                errorMessage = 'সিস্টেম একটি ভুল উত্তর দিয়েছে যা প্রসেস করা সম্ভব হচ্ছে না। অনুগ্রহ করে আবার চেষ্টা করুন।';
            } else if (msg.includes('503') || msg.includes('unavailable') || msg.includes('internal error')) {
                errorMessage = 'পরিষেবাটি বর্তমানে ওভারলোড বা ব্যস্ত। অনুগ্রহ করে কিছুক্ষণ পর আবার চেষ্টা করুন।';
            } else if (msg.startsWith('সিস্টেম ') || msg.startsWith('ইনপুট') || msg.startsWith('পরিষেবা কনফিগার করা যায়নি')) {
                throw error;
            } else {
                errorMessage = error.message;
            }
        }
      }
      throw new Error(errorMessage);
    }
  }
);
