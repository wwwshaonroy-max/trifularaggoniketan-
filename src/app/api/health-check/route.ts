import { NextResponse } from 'next/server';

export async function GET() {
  const timestamp = new Date().toISOString();
  const environment = process.env.NODE_ENV || 'development';

  // Check for required environment variables
  const checks = {
    firebase: {
      configured: !!process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || null,
    },
    genkit: {
      configured: !!(process.env.GEMINI_API_KEY || process.env.GOOGLE_GENAI_API_KEY),
      hasGeminiKey: !!process.env.GEMINI_API_KEY,
      hasGoogleKey: !!process.env.GOOGLE_GENAI_API_KEY,
    },
    steadfast: {
      configured: !!(process.env.STEADFAST_API_KEY && process.env.STEADFAST_SECRET_KEY),
      apiUrl: process.env.STEADFAST_API_URL || null,
    },
  };

  // Determine overall health
  const isHealthy =
    checks.firebase.configured &&
    checks.genkit.configured &&
    checks.steadfast.configured;

  const statusCode = isHealthy ? 200 : 503;

  return NextResponse.json(
    {
      status: isHealthy ? 'healthy' : 'degraded',
      timestamp,
      environment,
      checks,
      version: '1.0.0',
    },
    { status: statusCode }
  );
}

export async function HEAD() {
  // For simple health checks by load balancers
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}
