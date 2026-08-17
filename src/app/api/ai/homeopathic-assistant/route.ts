import { NextResponse } from 'next/server';
import { suggestRemedies } from '@/ai/flows/suggest-remedies';

export async function POST(request: Request) {
  try {
    let body;
    try {
      body = await request.json();
    } catch (_err) {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Body must be a JSON object' }, { status: 400 });
    }

    const { caseData, rawSymptoms, symptoms, caseNotesText, patientDemographics } = body as any;

    let textToAnalyze = caseData || rawSymptoms || symptoms || caseNotesText || '';

    if (patientDemographics && typeof patientDemographics === 'object') {
      const demoParts = [];
      if (patientDemographics.name) demoParts.push(`নাম: ${patientDemographics.name}`);
      if (patientDemographics.age) demoParts.push(`বয়স: ${patientDemographics.age}`);
      if (patientDemographics.gender) demoParts.push(`লিঙ্গ: ${patientDemographics.gender}`);
      if (patientDemographics.height) demoParts.push(`উচ্চতা: ${patientDemographics.height}`);
      if (patientDemographics.weight) demoParts.push(`ওজন: ${patientDemographics.weight}`);
      if (patientDemographics.complexion) demoParts.push(`গায়ের রং: ${patientDemographics.complexion}`);
      if (patientDemographics.mentalState) demoParts.push(`মানসিক অবস্থা: ${patientDemographics.mentalState}`);

      if (demoParts.length > 0) {
        textToAnalyze = `রোগীর বিবরণ: ${demoParts.join(', ')}\n\nলক্ষণসমূহ: ${textToAnalyze}`;
      }
    }

    if (!textToAnalyze || typeof textToAnalyze !== 'string' || textToAnalyze.trim().length < 2) {
      return NextResponse.json(
        { error: 'অনুগ্রহ করে রোগীর অন্তত কিছু লক্ষণ বা বিবরণ প্রদান করুন।' },
        { status: 400 },
      );
    }

    const result = await suggestRemedies({ symptoms: textToAnalyze.trim() });

    // Map AI categorized symptoms to the expected keys for UI components
    const cat = result.categorizedSymptoms || {} as any;
    const hasMappedKeys = 'Locations' in cat || 'Causations' in cat || 'Sensations' in cat;
    const finalCategorizedSymptoms = hasMappedKeys ? cat : {
      Locations: [
        cat.physicalSymptoms?.locationAndNature,
        cat.physicalSymptoms?.gastrointestinal,
        cat.physicalSymptoms?.urinary,
        cat.physicalSymptoms?.femaleSpecific
      ].filter(Boolean) as string[],
      Causations: [
        cat.excitingCause?.weather,
        cat.excitingCause?.diet,
        cat.excitingCause?.mentalTrauma,
        cat.excitingCause?.accidentOrInfection,
        cat.maintainingCause?.lifestyle,
        cat.maintainingCause?.mentalStress,
        cat.maintainingCause?.habits
      ].filter(Boolean) as string[],
      Sensations: [
        cat.physicalSymptoms?.general,
        cat.physicalSymptoms?.modalities
      ].filter(Boolean) as string[],
      Concomitants: [
        cat.pastMedicalHistory?.chronicIssues,
        cat.pastMedicalHistory?.majorIllnesses
      ].filter(Boolean) as string[],
      Mental: [
        cat.mentalAndEmotionalSymptoms?.fear,
        cat.mentalAndEmotionalSymptoms?.sadnessAndDepression,
        cat.mentalAndEmotionalSymptoms?.angerAndMoodSwings,
        cat.mentalAndEmotionalSymptoms?.loneliness
      ].filter(Boolean) as string[],
    };

    const responseData = {
      ...result,
      categorizedSymptoms: finalCategorizedSymptoms,
      keySymptoms: Object.values(result.categorizedSymptoms || {}).flatMap(c =>
        typeof c === 'object' ? Object.values(c).filter(Boolean) as string[] : []
      ),
      remedySuggestions: (result.remedies || []).map(r => ({
        remedyName: r.name,
        name: r.name,
        reasoning: r.justification || r.description || '',
        dosage: {
          centesimal: 'LM1 থেকে LM6 (প্রয়োজনানুসারে) অথবা ৩০C/২০০C একক মাত্রা',
          millesimal: 'LM1 থেকে LM6 ক্রমানুসারে (প্রতিদিন সকালে খালি পেটে ১ বার করে)',
        },
        precautions: 'ঔষধ খাওয়ার ৩০ মিনিট আগে ও পরে কোনো কিছু খাওয়া নিষেধ। পেঁয়াজ, কফি, অতিরিক্ত টক বর্জন করুন।',
        potency: '30C / 200C / LM',
        justification: r.justification || r.description,
        reason: r.justification || r.description,
        score: r.score,
        source: r.source,
      })),
    };

    return NextResponse.json(responseData, { status: 200 });
  } catch (e: unknown) {
    console.error("AI Assistant Route Error:", e);
    const message = e instanceof Error ? e.message : 'Unknown error occurred during AI analysis.';

    // Detect quota / billing exhaustion errors
    const isQuotaError = e instanceof Error && (
      message.includes('429') ||
      message.includes('Too Many Requests') ||
      message.includes('prepayment credits') ||
      message.includes('RESOURCE_EXHAUSTED') ||
      message.includes('quota')
    );

    if (isQuotaError) {
      return NextResponse.json(
        { error: 'AI সেবার ব্যবহার সীমা (quota) শেষ হয়ে গেছে। অনুগ্রহ করে কিছুক্ষণ পরে আবার চেষ্টা করুন।' },
        { status: 503 },
      );
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
