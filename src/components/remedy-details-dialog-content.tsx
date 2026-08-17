'use client';

import { useEffect, useState } from 'react';
import type { RemedyDetailsOutput } from '@/ai/flows/remedy-details';
import { RemedyDetailsDisplay } from '@/components/remedy-details-display';
import {
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { LoaderCircle, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';

interface RemedyDetailsDialogContentProps {
  remedyName: string;
}

// Simple in-memory cache for remedy details
const remedyCache = new Map<string, { data: RemedyDetailsOutput; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export function RemedyDetailsDialogContent({
  remedyName,
}: RemedyDetailsDialogContentProps) {
  const [details, setDetails] = useState<RemedyDetailsOutput | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryIn, setRetryIn] = useState<number | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);

  const fetchDetails = async (retryAttempt = 0) => {
    const maxRetries = 3;
    setIsLoading(true);
    setError(null);
    setDetails(null);
    setIsRetrying(false);

    try {
      // Check cache first
      const cached = remedyCache.get(remedyName);
      if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        console.log('Using cached remedy details for:', remedyName);
        setDetails(cached.data);
        setIsLoading(false);
        return;
      }

      const res = await fetch('/api/ai/remedy-details', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ remedyName }),
      });

      const result = (await res.json()) as
        | RemedyDetailsOutput
        | { error?: string; retryAfter?: number; isQuotaError?: boolean };

      // Handle quota exceeded with retry logic
      if (res.status === 429 && (result as any)?.isQuotaError) {
        const retryAfter = (result as any)?.retryAfter || 60;
        console.warn(`Quota exceeded. Retry after ${retryAfter}s`);

        if (retryAttempt < maxRetries) {
          setRetryIn(retryAfter);
          setError(
            `API quota reached. Retrying in ${retryAfter} seconds... (Attempt ${retryAttempt + 1}/${maxRetries})`
          );

          // Auto-retry after delay
          setTimeout(() => {
            setIsRetrying(true);
            fetchDetails(retryAttempt + 1);
          }, retryAfter * 1000);
          return;
        } else {
          setError(
            'API quota limit exceeded. Please try again in a few minutes or upgrade your API plan.'
          );
          setIsLoading(false);
          return;
        }
      }

      if (!res.ok || (result as any)?.error) {
        throw new Error(
          ((result as any)?.error as string) ||
            'No details found for this remedy.',
        );
      }

      // Cache the successful result
      remedyCache.set(remedyName, {
        data: result as RemedyDetailsOutput,
        timestamp: Date.now(),
      });

      setDetails(result as RemedyDetailsOutput);
      setRetryIn(null);
    } catch (e) {
      console.error('Failed to fetch remedy details:', e);
      const errorMessage =
        e instanceof Error
          ? e.message
          : 'An error occurred while fetching remedy details. Please try again.';
      setError(errorMessage);
      setRetryIn(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!remedyName) return;
    fetchDetails();
  }, [remedyName]);

  return (
    <DialogContent className="sm:max-w-2xl max-h-[90vh]">
      <ScrollArea className="max-h-[85vh] pr-6">
        <DialogHeader className="pr-6">
          <DialogTitle className="text-2xl font-bold text-foreground">
            Materia Medica
          </DialogTitle>
          <DialogDescription>
            &quot;{remedyName}&quot; ঔষধের বিস্তারিত প্রোফাইল।
          </DialogDescription>
        </DialogHeader>
        <div className="mt-4 pr-6">
          {isLoading && (
            <div className="flex flex-col items-center justify-center text-center p-10">
              <LoaderCircle className="w-12 h-12 animate-spin text-primary mb-4" />
              <p className="text-muted-foreground">
                {isRetrying ? `পুনরায় চেষ্টা করা হচ্ছে...` : 'বিস্তারিত লোড হচ্ছে...'}
              </p>
              {retryIn !== null && (
                <p className="text-sm text-muted-foreground mt-2">
                  পরবর্তী প্রচেষ্টা: {retryIn} সেকেন্ডে
                </p>
              )}
            </div>
          )}
          {error && (
            <Alert variant="destructive" className="flex items-start gap-4">
              <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <AlertTitle>অনুরোধ ত্রুটি</AlertTitle>
                <AlertDescription className="mt-2">{error}</AlertDescription>
                {error.includes('quota') && (
                  <div className="mt-3">
                    <p className="text-sm mb-2">
                      আপনি Google Gemini API এর বিনামূল্যের কোটা সীমা অতিক্রম করেছেন।
                    </p>
                    <a
                      href="https://console.cloud.google.com/gen-app-builder/billing"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm underline hover:no-underline"
                    >
                      আপনার API পরিকল্পনা আপগ্রেড করুন
                    </a>
                  </div>
                )}
              </div>
            </Alert>
          )}
          {details && <RemedyDetailsDisplay details={details} />}
        </div>
      </ScrollArea>
    </DialogContent>
  );
}
