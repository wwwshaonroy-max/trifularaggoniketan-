import { NextResponse } from 'next/server';
import { getRemedyDetails } from '@/ai/flows/remedy-details';

const isQuotaError = (error: unknown): boolean => {
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    return (
      msg.includes('429') ||
      msg.includes('too many requests') ||
      msg.includes('quota exceeded') ||
      msg.includes('resource_exhausted') ||
      msg.includes('quota') ||
      msg.includes('generate_content_free_tier_requests')
    );
  }
  return false;
};

const extractRetryAfter = (error: unknown): number | null => {
  if (error instanceof Error) {
    const match = error.message.match(/retry[\s\w]*in\s+([\d.]+)s/i);
    if (match && match[1]) {
      const seconds = parseFloat(match[1]);
      return Math.ceil(Math.min(seconds, 60));
    }
  }
  return null;
};

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

    const { remedyName } = body as { remedyName?: string };

    if (!remedyName || typeof remedyName !== 'string') {
      return NextResponse.json(
        { error: 'Invalid or missing remedyName' },
        { status: 400 },
      );
    }
    const result = await getRemedyDetails({ remedyName });
    return NextResponse.json(result, { status: 200 });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    console.error("AI API Error (remedy-details):", e);

    // Detect quota exceeded errors
    if (isQuotaError(e)) {
      const retryAfter = extractRetryAfter(e);
      return NextResponse.json(
        {
          error: 'API quota exceeded. Please try again in a few moments.',
          retryAfter: retryAfter || 60,
          isQuotaError: true,
        },
        { status: 429 },
      );
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
