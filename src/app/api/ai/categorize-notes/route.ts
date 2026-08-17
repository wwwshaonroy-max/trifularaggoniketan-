import { NextResponse } from 'next/server';
import { categorizeCaseNotes } from '@/ai/flows/categorize-case-notes-flow';

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

    const { caseNotesText } = body as { caseNotesText?: string };

    if (!caseNotesText || typeof caseNotesText !== 'string') {
      return NextResponse.json(
        { error: 'Invalid or missing caseNotesText' },
        { status: 400 },
      );
    }

    const result = await categorizeCaseNotes({ caseNotesText });
    return NextResponse.json(result, { status: 200 });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error';

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
