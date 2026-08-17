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

    const { symptoms, rawSymptoms, caseData } = body as any;
    const textInput = symptoms || rawSymptoms || caseData || '';

    if (!textInput || typeof textInput !== 'string' || textInput.trim().length < 2) {
      return NextResponse.json(
        { error: 'অনুগ্রহ করে অন্তত ২টি অক্ষরের লক্ষণ বিবরণ লিখুন।' },
        { status: 400 },
      );
    }

    const result = await suggestRemedies({ symptoms: textInput.trim() });
    return NextResponse.json(result, { status: 200 });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    console.error("AI API Error (suggest-remedies):", e);

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
