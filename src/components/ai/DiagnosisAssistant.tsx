'use client';

import React, { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import {
  Sparkles,
  Loader2,
  AlertCircle,
  Wand2,
  ListChecks,
  Pill,
  Copy,
  Check,
  FileText
} from 'lucide-react';
import type { Patient, Visit } from '@/lib/types';
import type { HomeopathicAssistantOutput } from '@/ai/flows/homeopathic-assistant-flow';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { updatePatient } from '@/lib/firestoreService';

interface ExtendedAssistantOutput extends HomeopathicAssistantOutput {
  markdownReport?: string;
}

interface DiagnosisAssistantProps {
  patient: Patient | null;
  visit: Visit | null;
  onKeySymptomsSelect: (symptoms: string) => void;
  currentDiagnosisValue?: string;
  pastVisits?: Visit[];
}

export function DiagnosisAssistant({
  patient,
  visit,
  onKeySymptomsSelect,
  currentDiagnosisValue,
  pastVisits,
}: DiagnosisAssistantProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] =
    useState<ExtendedAssistantOutput | null>(null);
  const { toast } = useToast();
  const [reportOpen, setReportOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  React.useEffect(() => {
    if (patient?.analysisResult) {
      const ar = patient.analysisResult as any;
      const keySymptoms = ar.keySymptoms || (ar.categorizedSymptoms ? Object.values(ar.categorizedSymptoms).flat().filter((s: any) => typeof s === 'string' && s.length > 0) : []);
      setAnalysisResult({
        keySymptoms,
        remedySuggestions: (ar.remedySuggestions || []).map((r: any) => ({
          remedyName: r.remedyName || r.name || '',
          potency: r.potency || '30C / 200C / LM',
          justification: r.justification || r.reasoning || r.reason || '',
        })),
        markdownReport: ar.markdownReport,
      } as ExtendedAssistantOutput);
    } else {
      setAnalysisResult(null);
    }
  }, [patient]);

  const handleAnalyze = async () => {
    if (!patient) {
      toast({
        title: 'প্রয়োজনীয় তথ্য নেই',
        description: 'বিশ্লেষণ শুরু করার জন্য রোগীর তথ্য প্রয়োজন।',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    setError(null);
    setAnalysisResult(null);

    // Combine past history with current complaints
    const pastHistoryStr = (pastVisits || [])
      .map(v => {
         const date = new Date(v.visitDate).toLocaleDateString('bn-BD');
         return `${date}: ${v.symptoms || ''} - ${v.diagnosis || ''}`;
      })
      .filter(s => s.length > 15)
      .join('\n');
      
    const combinedContext = `পূর্ববর্তী ইতিহাস:\n${pastHistoryStr}\n\nবর্তমান অভিযোগ:\n${currentDiagnosisValue || ''}`;

    // Combine all patient data into a single string for the AI
    const caseDataParts = [
      `সম্পূর্ণ কেস হিস্ট্রি ও বর্তমান অভিযোগ:\n${combinedContext}`,
      visit?.symptoms && `বর্তমান ভিজিটের প্রধান সমস্যা: ${visit.symptoms}`,
      `রোগীর নাম: ${patient.name}, বয়স: ${patient.age || 'N/A'}, লিঙ্গ: ${patient.gender || 'N/A'}`,
      // Use the structured case notes if available, otherwise use the raw text
      patient.categorizedCaseNotes
        ? `রোগীর বিস্তারিত ইতিহাস (স্বয়ংক্রিয়ভাবে শ্রেণীবদ্ধ): ${JSON.stringify(patient.categorizedCaseNotes, null, 2)}`
        : patient.caseNotes && `রোগীর ইতিহাস: ${patient.caseNotes}`,
      // Include basic demographic information available in current Patient type
      patient.occupation && `পেশা: ${patient.occupation}`,
      patient.district && `জেলা: ${patient.district}`,
      patient.thanaUpazila && `থানা/উপজেলা: ${patient.thanaUpazila}`,
      patient.villageUnion && `গ্রাম/ইউনিয়ন: ${patient.villageUnion}`,
      patient.guardianName && `অভিভাবকের নাম: ${patient.guardianName}`,
      patient.guardianRelation &&
        `অভিভাবকের সম্পর্ক: ${patient.guardianRelation}`,
    ];
    const fullCaseData = caseDataParts.filter(Boolean).join('\n');

    try {
      const res = await fetch('/api/ai/homeopathic-assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ caseData: fullCaseData }),
      });
      const result = (await res.json()) as
        | ExtendedAssistantOutput
        | { error?: string };
      if (!res.ok || (result as any)?.error) {
        throw new Error(
          ((result as any)?.error as string) || 'সিস্টেম কোনো উত্তর দেয়নি।',
        );
      }
      setAnalysisResult(result as ExtendedAssistantOutput);

      // Save the analysisResult to the patient's record in Firestore
      if (patient?.id) {
        await updatePatient(patient.id, {
          analysisResult: result as any,
        });
        toast({
          title: 'বিশ্লেষণ ফলাফল সংরক্ষিত হয়েছে',
          description: 'স্মার্ট বিশ্লেষণের ফলাফল রোগীর ডেমোগ্রাফিক তথ্যের সাথে ডাটাবেজে সংরক্ষণ করা হয়েছে।',
        });
      }
    } catch (e: unknown) {
      const errorMessage =
        e instanceof Error
          ? e.message
          : 'বিশ্লেষণ করার সময় একটি অজানা ত্রুটি হয়েছে।';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUseSymptoms = () => {
    if (analysisResult?.keySymptoms) {
      const symptomsText = analysisResult.keySymptoms.join('; ');
      onKeySymptomsSelect(symptomsText);
    }
  };

  const copyToClipboard = (text: string, type: string) => {
    navigator.clipboard.writeText(text).then(() => {
      toast({
        title: `${type} কপি হয়েছে`,
        description: `"${text}" ক্লিপবোর্ডে কপি করা হয়েছে।`,
      });
    });
  };

  const handleCopyReport = useCallback(() => {
    if (analysisResult?.markdownReport) {
      navigator.clipboard.writeText(analysisResult.markdownReport);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [analysisResult]);

  const renderBoldText = (text: string) => {
    const parts = text.split('**');
    return parts.map((part, i) => {
      if (i % 2 === 1) {
        return <strong key={i} className="font-bold text-slate-900 dark:text-white">{part}</strong>;
      }
      return part;
    });
  };

  const renderMarkdownToReact = (markdown: string) => {
    const lines = markdown.split('\n');
    return lines.map((line, index) => {
      let trimmed = line.trim();
      
      // Headers
      if (trimmed.startsWith('**') && trimmed.endsWith('**')) {
        const text = trimmed.slice(2, -2);
        return <h3 key={index} className="text-md font-bold mt-4 mb-2 text-primary">{text}</h3>;
      }
      if (trimmed.startsWith('### ')) {
        return <h3 key={index} className="text-md font-bold mt-4 mb-2 text-primary">{trimmed.slice(4)}</h3>;
      }
      if (trimmed.startsWith('## ')) {
        return <h2 key={index} className="text-lg font-bold mt-6 mb-3 text-primary border-b pb-1">{trimmed.slice(3)}</h2>;
      }
      if (trimmed.startsWith('# ')) {
        return <h1 key={index} className="text-xl font-extrabold mt-8 mb-4 text-primary text-center">{trimmed.slice(2)}</h1>;
      }
      
      // Bullet points
      if (trimmed.startsWith('- ')) {
        let content = trimmed.slice(2);
        return (
          <li key={index} className="ml-4 list-disc text-slate-700 dark:text-slate-300 my-1">
            {renderBoldText(content)}
          </li>
        );
      }
      
      // Empty line
      if (trimmed === '') {
        return <div key={index} className="h-2" />;
      }
      
      return <p key={index} className="text-slate-700 dark:text-slate-300 my-1 leading-relaxed">{renderBoldText(line)}</p>;
    });
  };

  return (
    <div className="space-y-4 mt-4 w-full">
        <Button
          onClick={handleAnalyze}
          disabled={isLoading || !patient}
          className="w-full"
        >
          {isLoading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Wand2 className="mr-2 h-4 w-4" />
          )}
          {isLoading ? 'বিশ্লেষণ চলছে...' : 'লক্ষণ বিশ্লেষণ করুন'}
        </Button>

        {error && (
          <Alert variant="destructive" className="mt-4">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>ত্রুটি</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {analysisResult && (
          <div className="space-y-4 pt-4 border-t">
            {analysisResult.markdownReport && (
              <Dialog open={reportOpen} onOpenChange={setReportOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="w-full mt-2">
                    <FileText className="mr-2 h-4 w-4 text-purple-600" />
                    সম্পূর্ণ ৩-পর্যায় রিপোর্ট দেখুন
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col">
                  <DialogHeader className="flex flex-row justify-between items-center pr-6">
                    <DialogTitle className="font-headline flex items-center gap-2">
                      <Sparkles className="h-5 w-5 text-primary animate-pulse" />
                      বিস্তারিত ৩-পর্যায় হোমিওপ্যাথিক বিশ্লেষণ রিপোর্ট
                    </DialogTitle>
                    <Button
                      onClick={handleCopyReport}
                      size="sm"
                      variant="outline"
                      className="ml-auto gap-1.5 h-8 bg-background"
                    >
                      {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
                      {copied ? 'কপি হয়েছে' : 'রিপোর্ট কপি করুন'}
                    </Button>
                  </DialogHeader>
                  <ScrollArea className="flex-grow p-4 border rounded-md bg-muted/30">
                    <div className="space-y-1 font-sans text-sm pr-4">
                      {renderMarkdownToReact(analysisResult.markdownReport)}
                    </div>
                  </ScrollArea>
                </DialogContent>
              </Dialog>
            )}

            <div>
              <h4 className="font-semibold text-md mb-2 flex items-center">
                <ListChecks className="mr-2 h-5 w-5 text-blue-600" />
                প্রধান লক্ষণসমূহ
              </h4>
              <ul className="list-disc list-inside space-y-1 text-sm bg-muted/50 p-3 rounded-md">
                {analysisResult.keySymptoms.map((symptom, i) => (
                  <li key={`symptom-${i}`}>{symptom}</li>
                ))}
              </ul>
              <Button
                onClick={handleUseSymptoms}
                variant="outline"
                size="sm"
                className="mt-2"
              >
                <Copy className="mr-2 h-4 w-4" /> এই লক্ষণগুলো ব্যবহার করুন
              </Button>
            </div>
            <div>
              <h4 className="font-semibold text-md mb-2 flex items-center">
                <Pill className="mr-2 h-5 w-5 text-green-600" />
                সম্ভাব্য ঔষধ
              </h4>
              <p className="text-xs text-destructive font-medium mb-2">
                সতর্কীকরণ: এটি শুধুমাত্র প্রস্তাবিত একটি তালিকা, কোনো চূড়ান্ত চিকিৎসা নয়।
              </p>
              <div className="space-y-2">
                {analysisResult.remedySuggestions.map((remedy, i) => (
                  <div
                    key={`remedy-${i}`}
                    className="text-sm border p-2 rounded-md bg-white/30"
                  >
                    <div className="font-bold flex justify-between items-center text-slate-700">
                      <span>
                        {remedy.remedyName} {remedy.potency}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() =>
                          copyToClipboard(remedy.remedyName, 'ঔষধের নাম')
                        }
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                    <p className="text-slate-600 text-xs">
                      {remedy.justification}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
    </div>
  );
}
