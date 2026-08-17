"use client";

import { useState, useEffect, useRef, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Printer, Loader2, Trash2 } from "lucide-react";
import dynamic from "next/dynamic";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import LabelForm from "@/components/pharma-guide/label-form";
import LabelPreview from "@/components/pharma-guide/label-preview";
import DailyReport from "@/components/pharma-guide/daily-report";
import { convertToBanglaNumerals } from "@/lib/utils";
import { ROUTES } from "@/lib/constants";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { addMedicationLabel, getPatientById, getPrescriptionsByPatientId } from "@/lib/firestoreService";
import { useToast } from "@/hooks/use-toast";
import type { LabelState, Patient } from "@/lib/types";


const defaultCounseling = [
  "• ঔষধ সেবনকালীন যাবতীয় ঔষধি নিষিদ্ধ।",
  "• ঔষধ সেবনের আধা ঘন্টা আগে-পরে জল ব্যতিত কোন খাবার খাবেন না।",
  "• জরুরী প্রয়োজনে বিকাল <strong>৫টা</strong> থেকে <strong>৭টার</strong> মধ্যে ফোন করুন।",
];

const defaultLabelState: LabelState = {
  serial: "F/",
  patientName: "",
  patientId: undefined,
  date: undefined,
  shakeMode: "with",
  drops: 3,
  cupAmount: "one_cup",
  shakeCount: 10,
  intervalMode: "hourly",
  interval: 12,
  mealTime: "none",
  mixtureAmount: "১ চামচ ঔষধ",
  durationDays: 7,
  counseling: defaultCounseling,
  labelCount: 1,
  followUpDays: 7,
};

const BILL_PER_LABEL = 300;

function MedicineInstructionsContent() {
  const [labelState, setLabelState] = useState<LabelState>(defaultLabelState);
  
  const [isClient, setIsClient] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isReportOpen, setIsReportOpen] = useState(false);
  const previewContainerRef = useRef<HTMLDivElement>(null);

  const [patientData, setPatientData] = useState<Patient | null>(null);

  const searchParams = useSearchParams();
  const router = useRouter();
  const originalTitleRef = useRef(typeof document !== 'undefined' ? document.title : '');
  const { toast } = useToast();

  useEffect(() => {
    setIsClient(true);
    if (typeof document !== 'undefined') {
      originalTitleRef.current = document.title;
    }
  }, []);

  // Auto-populate patient information from URL parameters / central database
  useEffect(() => {
    let isMounted = true;
    const patientIdParam = searchParams?.get('patientId');
    const nameParam = searchParams?.get('name');
    const serialParam = searchParams?.get('serial') || searchParams?.get('serialNumber');

    const loadData = async () => {
      if (patientIdParam) {
        try {
          const patient = await getPatientById(patientIdParam);
          if (patient && isMounted) {
            setPatientData(patient);
            setLabelState(prev => ({
              ...prev,
              patientId: patient.id,
              patientName: patient.name || nameParam || '',
              serial: patient.diaryNumber || serialParam || 'F/',
            }));

            // Fetch prescription info for followUpDays
            try {
              const prescriptions = await getPrescriptionsByPatientId(patient.id);
              if (prescriptions && prescriptions.length > 0 && isMounted) {
                const latest = prescriptions[0];
                if (latest.followUpDays) {
                  setLabelState(prev => ({
                    ...prev,
                    followUpDays: latest.followUpDays,
                  }));
                }
              }
            } catch (err) {
              console.error("Error loading prescription for instructions:", err);
            }
          } else if (isMounted && nameParam) {
            setLabelState(prev => ({
              ...prev,
              patientName: nameParam,
              serial: serialParam || prev.serial,
            }));
          }
        } catch (error) {
          console.error("Error fetching patient details:", error);
        }
      } else if (nameParam || serialParam) {
        if (isMounted) {
          setLabelState(prev => ({
            ...prev,
            patientName: nameParam || prev.patientName,
            serial: serialParam || prev.serial,
          }));
        }
      }
    };

    loadData();

    return () => {
      isMounted = false;
    };
  }, [searchParams]);

  const triggerPrint = useCallback(() => {
    if (labelState.patientName) {
        document.title = labelState.patientName;
    }
    
    const printableArea = document.getElementById('printable-area');
    if (!printableArea) return;
    
    const originalParent = printableArea.parentNode;
    const originalNextSibling = printableArea.nextSibling;
    
    // Move printable area to document body to bypass layout container hiding
    document.body.appendChild(printableArea);

    document.body.classList.add('printing-active');
    printableArea.classList.remove('hidden');
    printableArea.classList.add('flex');

    // Timeout ensures DOM repaints before browser print dialog opens
    setTimeout(() => {
      window.print();

      setTimeout(() => {
        document.body.classList.remove('printing-active');
        printableArea.classList.add('hidden');
        printableArea.classList.remove('flex');
        
        if (originalParent) {
            originalParent.insertBefore(printableArea, originalNextSibling);
        }

        document.title = originalTitleRef.current;
      }, 300);
    }, 150);
  }, [labelState.patientName, patientData]);

  const handleStateChange = useCallback((newState: Partial<LabelState>) => {
    setLabelState(prevState => ({ ...prevState, ...newState }));
  }, []);

  const handlePrint = () => {
    setIsProcessing(true);
    try {
      triggerPrint();
    } catch (error: any) {
      console.error("Failed to print:", error);
      toast({
        variant: "destructive",
        title: "প্রিন্ট ত্রুটি",
        description: "প্রিন্ট করতে একটি সমস্যা হয়েছে।",
      });
    } finally {
        setIsProcessing(false);
    }
  };
  
  const handleClearForm = useCallback(() => {
    setLabelState(defaultLabelState);
  }, []);

  const renderPreviews = useCallback(() => {
    const count = Number(labelState.labelCount) || 1;
    return Array.from({ length: count }, (_, i) => i + 1).map(index => (
       <div key={index} className="printable-label-wrapper">
         <LabelPreview {...labelState} activeLabelIndex={index} />
       </div>
    ));
  }, [labelState]);

  if (!isClient) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-16 w-16 animate-spin text-primary" />
      </div>
    );
  }
  
  return (
    <>
      <main id="main-content" className="min-h-screen p-4 sm:p-6 lg:p-8 bg-background">
        <div className="max-w-screen-2xl mx-auto space-y-8">
          <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-4xl font-bold tracking-tight font-body text-primary">
                খাম
              </h1>
              <p className="text-muted-foreground mt-1">
                প্রয়োজনীয় তথ্য দিয়ে ঔষধের লেবেল তৈরি এবং প্রিন্ট করুন।
              </p>
            </div>
          </header>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 items-start">
            <div className="lg:col-span-1">
              <Card className="shadow-lg h-full">
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="font-body">রোগীর তথ্য ও নির্দেশাবলী</CardTitle>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={handleClearForm}
                            className="h-8 w-8"
                          >
                            <Trash2 className="h-4 w-4" />
                            <span className="sr-only">ফর্ম পরিষ্কার করুন</span>
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>ফর্ম পরিষ্কার করুন</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                </CardHeader>
                <CardContent>
                  <LabelForm 
                    state={labelState} 
                    setState={handleStateChange}
                    hideSearch={false}
                  />
                </CardContent>
              </Card>
            </div>

            <div className="lg:col-span-1">
              <Card className="shadow-lg h-full">
                  <CardHeader className="text-center">
                      <CardTitle className="text-2xl font-semibold">
                        প্রিভিউ
                      </CardTitle>
                    <CardDescription>
                      নিচের ফরম্যাটটি প্রিন্ট লেবেলের মতো দেখাবে ({convertToBanglaNumerals('3.6')}” x {convertToBanglaNumerals('5.6')}”)। 
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex flex-col">
                    <div ref={previewContainerRef} id="preview-container" className="flex-grow">
                        {renderPreviews()}
                    </div>
                     <div className="flex justify-center items-center flex-wrap gap-4 mt-6">
                      <Button onClick={handlePrint} className="bg-primary text-primary-foreground hover:bg-primary/90 font-semibold py-2 px-8 rounded-lg shadow-xl transition duration-150 focus:outline-none focus:ring-4 focus:ring-primary/50" disabled={isProcessing}>
                        {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Printer className="mr-2 h-4 w-4" />}
                        প্রিন্ট করুন
                      </Button>
                  </div>
                  </CardContent>
              </Card>
            </div>
          </div>
        </div>
        <DailyReport open={isReportOpen} onOpenChange={setIsReportOpen} />

      </main>
      <div id="printable-area" className="hidden">
        {renderPreviews()}
      </div>
    </>
  );
}

export default function MedicineInstructionsPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>}>
      <MedicineInstructionsContent />
    </Suspense>
  );
}
