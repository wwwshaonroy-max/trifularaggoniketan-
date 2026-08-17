"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { Loader2, Printer } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CreditCard } from "lucide-react";
import LabelForm from "@/components/pharma-guide/label-form";
import LabelPreview from "@/components/pharma-guide/label-preview";
import { addMedicationLabel } from "@/lib/firestoreService";
import { useToast } from "@/hooks/use-toast";
import type { LabelState, Patient } from "@/lib/types";

const BILL_PER_LABEL = 300;

interface CoreLabelPrintModalProps {
  patient: Patient | null;
  isOpen: boolean;
  onClose: () => void;
  onPrintSuccess?: () => void;
}

const defaultCounseling = [
  "• ঔষধ সেবনকালীন যাবতীয় ঔষধি নিষিদ্ধ।",
  "• ঔষধ সেবনের আধা ঘন্টা আগে-পরে জল ব্যতিত কোন খাবার খাবেন না।",
  "• জরুরী প্রয়োজনে বিকাল <strong>৫টা</strong> থেকে <strong>৭টার</strong> মধ্যে ফোন করুন।",
];

const getBaseLabelState = (): LabelState => ({
  serial: "F/",
  patientName: "",
  patientId: undefined,
  date: new Date(),
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
});

export function CoreLabelPrintModal({ patient, isOpen, onClose, onPrintSuccess }: CoreLabelPrintModalProps) {
  const [labelState, setLabelState] = useState<LabelState>(getBaseLabelState());
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();
  const originalTitleRef = useRef(typeof document !== 'undefined' ? document.title : '');

  // Initialize state when modal opens and patient is provided
  useEffect(() => {
    if (isOpen && patient) {
      setLabelState((prev) => ({
        ...getBaseLabelState(),
        serial: patient.diaryNumber || "F/",
        patientName: patient.name || "",
        patientId: patient.id,
        date: new Date(),
      }));
      if (typeof document !== 'undefined') {
        originalTitleRef.current = document.title;
      }
    }
  }, [isOpen, patient]);

  const handleStateChange = useCallback((newState: Partial<LabelState>) => {
    setLabelState((prevState) => ({ ...prevState, ...newState }));
  }, []);

  const triggerPrint = useCallback(() => {
    if (labelState.patientName) {
      document.title = labelState.patientName;
    }
    
    // We create a temporary printable area dynamically to avoid layout issues in modal
    const printContainer = document.createElement('div');
    printContainer.id = 'printable-area';
    printContainer.className = 'flex';
    
    // Render the previews to HTML
    const previewWrapper = document.getElementById('core-hidden-preview-container');
    
    if (previewWrapper) {
      printContainer.innerHTML = previewWrapper.innerHTML;
    }
    
    document.body.appendChild(printContainer);
    document.body.classList.add('printing-active');

    // Timeout ensures DOM repaints before browser print dialog opens
    setTimeout(() => {
      window.print();

      setTimeout(() => {
        document.body.classList.remove('printing-active');
        if (printContainer.parentNode) {
          printContainer.parentNode.removeChild(printContainer);
        }
        document.title = originalTitleRef.current;
        setIsProcessing(false);
      }, 300);
    }, 150);
  }, [labelState.patientName]);

  const handlePrint = async () => {
    setIsProcessing(true);
    try {
      if (!labelState.patientName || !labelState.serial) {
        toast({
          variant: "destructive",
          title: "ত্রুটি",
          description: "রোগীর নাম এবং ক্রমিক নম্বর প্রয়োজন।",
        });
        setIsProcessing(false);
        return;
      }
      const bill = (Number(labelState.labelCount) || 1) * BILL_PER_LABEL;
      await addMedicationLabel(labelState, bill);
      
      triggerPrint();
    } catch (error: any) {
      console.error("Failed to save or print:", error);
      toast({
        variant: "destructive",
        title: "সংরক্ষণে ত্রুটি",
        description: "তথ্য সংরক্ষণ বা প্রিন্ট করতে একটি সমস্যা হয়েছে।",
      });
      setIsProcessing(false);
    }
  };

  const renderPreviews = () => {
    const count = Number(labelState.labelCount) || 1;
    return Array.from({ length: count }, (_, i) => i + 1).map((index) => (
      <div key={index} className="printable-label-wrapper">
        <LabelPreview {...labelState} activeLabelIndex={index} />
      </div>
    ));
  };

  if (!isOpen || !patient) return null;

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>খাম ও লেবেল প্রিন্ট</DialogTitle>
            <DialogDescription>
              রোগীর নাম ও ডায়েরি নাম্বার আগে থেকেই পূরণ করা আছে। লেবেল প্রিন্ট করুন।
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start mt-4">
            <div className="bg-background border rounded-lg p-4">
              <LabelForm 
                state={labelState} 
                setState={handleStateChange} 
                hideSearch={true} 
                readOnlyPatientInfo={true} 
              />
            </div>
            <div className="bg-background border rounded-lg p-4 flex flex-col items-center">
               <h3 className="text-lg font-semibold mb-2">প্রিভিউ</h3>
               <div className="flex-grow w-full overflow-y-auto max-h-[60vh] flex flex-col items-center gap-4 scrollbar-thin">
                  <div className="scale-[0.85] origin-top h-auto w-full flex flex-col items-center gap-4">
                     {renderPreviews()}
                  </div>
               </div>
               <div className="flex gap-4 w-full mt-4">
                 <Button onClick={handlePrint} className="flex-1" disabled={isProcessing}>
                    {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Printer className="mr-2 h-4 w-4" />}
                    প্রিন্ট করুন
                 </Button>
                 <Button 
                    onClick={() => {
                      if (onPrintSuccess) onPrintSuccess();
                      onClose();
                    }} 
                    className="flex-1 bg-green-600 hover:bg-green-700" 
                 >
                    <CreditCard className="mr-2 h-4 w-4" />
                    পেমেন্ট গ্রহণ
                 </Button>
               </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      
      {/* Hidden container for extracting HTML during print */}
      {isOpen && (
        <div id="core-hidden-preview-container" className="hidden">
          {renderPreviews()}
        </div>
      )}
    </>
  );
}
