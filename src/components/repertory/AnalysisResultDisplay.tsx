'use client';

import React, { useState, useCallback } from 'react';
import {
  MapPin,
  Sparkle,
  HeartPulse,
  Link as LinkIcon,
  Brain,
  Pill,
  Lightbulb,
  Beaker,
  ShieldAlert,
  Copy,
  Check,
  FileText,
  Printer
} from 'lucide-react';
import type { AnalysisResult } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';

const CATEGORY_META = {
  Locations: {
    title: 'স্থান (Locations)',
    icon: MapPin,
    color: 'blue',
  },
  Causations: {
    title: 'কারণ (Causations)',
    icon: Sparkle,
    color: 'green',
  },
  Sensations: {
    title: 'অনুভূতি (Sensations)',
    icon: HeartPulse,
    color: 'purple',
  },
  Concomitants: {
    title: 'সহগামী লক্ষণ (Concomitants)',
    icon: LinkIcon,
    color: 'orange',
  },
  Mental: {
    title: 'মানসিক অবস্থা (Mental)',
    icon: Brain,
    color: 'amber',
  },
} as const;

type CategoryKey = keyof typeof CATEGORY_META;

interface AnalysisResultDisplayProps {
  result: AnalysisResult;
}

const AnalysisResultDisplay: React.FC<AnalysisResultDisplayProps> = ({ result }) => {
  const { categorizedSymptoms, remedySuggestions, markdownReport } = result;
  const suggestion = remedySuggestions?.[0];
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    if (markdownReport) {
      navigator.clipboard.writeText(markdownReport);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [markdownReport]);

  const handlePrint = useCallback(() => {
    const printContent = document.getElementById('report-print-area');
    if (!printContent) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <html>
        <head>
          <title>হোমিওপ্যাথিক বিশ্লেষণ রিপোর্ট - ত্রিফুল আরোগ্য নিকেতন</title>
          <style>
            body {
              font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
              line-height: 1.6;
              color: #333;
              padding: 40px;
              max-width: 850px;
              margin: 0 auto;
              background: #fff;
            }
            h1, h2, h3, h4, h5, h6 {
              color: #1e3a8a;
            }
            h1 {
              text-align: center;
              border-bottom: 2px solid #2563eb;
              padding-bottom: 10px;
              margin-top: 0;
              font-size: 24px;
            }
            h2 {
              border-bottom: 1px solid #e5e7eb;
              padding-bottom: 5px;
              margin-top: 25px;
              font-size: 18px;
            }
            h3 {
              margin-top: 20px;
              font-size: 16px;
              color: #1d4ed8;
            }
            ul {
              padding-left: 20px;
              margin-top: 5px;
              margin-bottom: 10px;
            }
            li {
              margin-bottom: 5px;
              list-style-type: disc;
            }
            p {
              margin-top: 5px;
              margin-bottom: 10px;
            }
            strong {
              color: #111827;
            }
            .h-2 {
              height: 10px;
            }
            @media print {
              body {
                padding: 20px;
              }
            }
          </style>
        </head>
        <body>
          <div>
            \${printContent.innerHTML}
          </div>
          <script>
            window.onload = function() {
              window.print();
              setTimeout(function() { window.close(); }, 500);
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  }, []);

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

  const renderSymptomCategory = (category: CategoryKey) => {
    const symptoms = categorizedSymptoms[category];
    const meta = CATEGORY_META[category];
    if (!symptoms || symptoms.length === 0) return null;

    return (
      <Card
        key={category}
        className={`bg-${meta.color}-50/50 dark:bg-${meta.color}-900/10 border-${meta.color}-200 dark:border-${meta.color}-800/50 shadow-sm transition-all hover:shadow-md hover:border-${meta.color}-300 dark:hover:border-${meta.color}-700`}
      >
        <CardHeader className="p-3">
          <CardTitle
            className={`flex items-center text-sm font-semibold text-${meta.color}-700 dark:text-${meta.color}-300`}
          >
            <meta.icon className="h-4 w-4 mr-2" />
            {meta.title}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-3 pt-0 text-sm">
          <ul className="list-disc list-inside space-y-1">
            {symptoms.map((symptom, index) => (
              <li key={index} className="text-gray-700 dark:text-gray-300">
                {symptom}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    );
  };

  const renderStructuredView = () => (
    <div className="space-y-6">
      <div>
        <h3 className="font-semibold text-lg mb-3 text-gray-700 dark:text-gray-300">শ্রেণীবদ্ধ লক্ষণসমূহ</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {Object.keys(CATEGORY_META).map((key) => renderSymptomCategory(key as CategoryKey))}
        </div>
      </div>

      {suggestion && (
        <div>
          <h3 className="font-semibold text-lg mb-3 text-gray-700 dark:text-gray-300 pt-4 border-t border-gray-200 dark:border-gray-700/50">প্রস্তাবিত ঔষধ</h3>
          <Card className="bg-gradient-to-br from-white to-gray-50 dark:from-gray-800/40 dark:to-gray-900/30 shadow-lg border-gray-200 dark:border-gray-700/60">
            <CardHeader>
              <CardTitle className="flex items-center gap-3">
                <Pill className="h-8 w-8 text-primary" />
                <span className="text-2xl font-bold text-primary">
                  {suggestion.remedyName}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-400">
                <h4 className="font-semibold flex items-center text-blue-800 dark:text-blue-300">
                  <Lightbulb className="h-5 w-5 mr-2" />
                  নির্বাচনের কারণ (Reasoning)
                </h4>
                <p className="mt-1 text-gray-700 dark:text-gray-300 text-sm">
                  {suggestion.reasoning || (suggestion as any).justification || (suggestion as any).reason || 'N/A'}
                </p>
              </div>

              <Separator />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 rounded-lg bg-green-50 dark:bg-green-900/20 border-l-4 border-green-400">
                     <h4 className="font-semibold flex items-center text-green-800 dark:text-green-300">
                        <Beaker className="h-5 w-5 mr-2" />
                        প্রস্তাবিত মাত্রা (Dosage)
                    </h4>
                     <div className="mt-2 text-sm space-y-2">
                        <div className="flex flex-wrap items-center gap-1.5"><strong className="text-gray-800 dark:text-gray-200">Centesimal:</strong> <Badge variant="outline">{suggestion.dosage?.centesimal || 'N/A'}</Badge></div>
                        <div className="flex flex-wrap items-center gap-1.5"><strong className="text-gray-800 dark:text-gray-200">Millesimal:</strong> <Badge variant="outline">{suggestion.dosage?.millesimal || 'N/A'}</Badge></div>
                    </div>
                  </div>
                  <div className="p-4 rounded-lg bg-yellow-50 dark:bg-yellow-900/20 border-l-4 border-yellow-400">
                     <h4 className="font-semibold flex items-center text-yellow-800 dark:text-yellow-300">
                        <ShieldAlert className="h-5 w-5 mr-2" />
                        সতর্কতা (Precautions)
                    </h4>
                     <p className="mt-1 text-gray-700 dark:text-gray-300 text-sm">
                       {suggestion.precautions || 'N/A'}
                     </p>
                  </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-6 rounded-lg bg-gray-50/80 dark:bg-gray-900/20 p-4 border border-gray-200 dark:border-gray-800 shadow-inner">
      <h2 className="text-xl font-bold text-center text-gray-800 dark:text-gray-200 flex items-center justify-center gap-2">
        <Brain className="h-6 w-6 text-primary" />
        স্মার্ট বিশ্লেষণ ফলাফল
      </h2>

      {markdownReport ? (
        <Tabs defaultValue="report" className="w-full">
          <TabsList className="grid w-full grid-cols-2 max-w-[400px] mb-4">
            <TabsTrigger value="report">বিশ্লেষণ রিপোর্ট</TabsTrigger>
            <TabsTrigger value="structured">লক্ষণ ও ঔষধ</TabsTrigger>
          </TabsList>

          <TabsContent value="report" className="space-y-4">
            <Card className="shadow-md border-border/50 bg-card/50 backdrop-blur-sm relative">
              <div className="absolute top-3 right-3 z-10 flex gap-2">
                <Button
                  onClick={handleCopy}
                  size="sm"
                  variant="outline"
                  className="h-8 gap-1.5 bg-background hover:bg-muted"
                >
                  {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
                  {copied ? 'কপি হয়েছে' : 'রিপোর্ট কপি করুন'}
                </Button>
                <Button
                  onClick={handlePrint}
                  size="sm"
                  variant="outline"
                  className="h-8 gap-1.5 bg-background hover:bg-muted"
                >
                  <Printer className="h-3.5 w-3.5" />
                  প্রিন্ট করুন
                </Button>
              </div>
              <CardContent className="p-6 pt-10 text-sm prose dark:prose-invert max-w-none max-h-[700px] overflow-y-auto">
                <div id="report-print-area" className="space-y-1 font-sans">
                  {renderMarkdownToReact(markdownReport)}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="structured">
            {renderStructuredView()}
          </TabsContent>
        </Tabs>
      ) : (
        renderStructuredView()
      )}
    </div>
  );
};

export default AnalysisResultDisplay;
