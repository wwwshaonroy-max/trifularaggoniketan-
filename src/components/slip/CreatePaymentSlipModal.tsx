'use client';
import React, { useEffect, useState } from 'react';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import type { Patient, PaymentSlip, PaymentMethod, MedicineDeliveryMethod } from '@/lib/types';
import { addPaymentSlip, formatCurrency, updateVisit } from '@/lib/firestoreService';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Receipt, CreditCard, Truck, User, FileText, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface CreatePaymentSlipModalProps {
  patient: Patient;
  isOpen: boolean;
  onClose: (slipCreated?: boolean) => void;
  onSlipCreated?: (slip: PaymentSlip) => void;
  visitId?: string;
}

const paymentMethodOptions: { value: PaymentMethod; label: string }[] = [
  { value: 'cash', label: 'ক্যাশ (Cash)' },
  { value: 'bkash', label: 'বিকাশ (bKash)' },
  { value: 'nagad', label: 'নগদ (Nagad)' },
  { value: 'rocket', label: 'রকেট (Rocket)' },
  { value: 'other', label: 'অন্যান্য (Other)' },
];

const medicineDeliveryMethodOptions: { value: MedicineDeliveryMethod; label: string }[] = [
  { value: 'direct', label: 'সরাসরি প্রদান (Direct)' },
  { value: 'courier', label: 'কুরিয়ারের মাধ্যমে (Courier)' },
];

const paymentSlipSchema = z.object({
  purpose: z.string().min(1, "উদ্দেশ্য আবশ্যক।"),
  amount: z.coerce.number().nonnegative("টাকার পরিমাণ অবশ্যই একটি অ-ঋণাত্মক সংখ্যা হতে হবে।"),
  paymentMethod: z.custom<PaymentMethod>().optional(),
  receivedBy: z.string().optional(),
  medicineDeliveryMethod: z.custom<MedicineDeliveryMethod>().optional(),
}).superRefine((data, ctx) => {
  if (data.amount > 0 && !data.paymentMethod) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "টাকার পরিমাণ ০ এর বেশি হলে পেমেন্ট মাধ্যম আবশ্যক।",
      path: ["paymentMethod"],
    });
  }
});

type PaymentSlipFormValues = z.infer<typeof paymentSlipSchema>;

export function CreatePaymentSlipModal({ patient, isOpen, onClose, onSlipCreated, visitId }: CreatePaymentSlipModalProps) {
  const { toast } = useToast();
  const form = useForm<PaymentSlipFormValues>({
    resolver: zodResolver(paymentSlipSchema),
  });

  const amountValue = form.watch('amount');
  const [isAmountPositive, setIsAmountPositive] = useState(false);

  useEffect(() => {
    setIsAmountPositive(amountValue > 0);
  }, [amountValue]);
  
  useEffect(() => {
    if (isOpen) {
      form.reset({
        purpose: visitId ? 'প্রেসক্রিপশন ফি ও ঔষধ বাবদ' : 'সাধারণ পেমেন্ট',
        amount: 0,
        paymentMethod: 'cash',
        receivedBy: '',
        medicineDeliveryMethod: 'direct',
      });
    }
  }, [isOpen, form, visitId]);

  const onSubmit: SubmitHandler<PaymentSlipFormValues> = async (data) => {
    try {
      const newSlipData: Omit<PaymentSlip, 'id' | 'createdAt'> = {
        patientId: patient.id,
        visitId: visitId,
        slipNumber: `SLIP-${Date.now().toString().slice(-6)}`,
        date: new Date().toISOString(),
        amount: data.amount,
        purpose: data.purpose,
        paymentMethod: data.amount > 0 ? data.paymentMethod : undefined,
        receivedBy: data.receivedBy,
        medicineDeliveryMethod: data.medicineDeliveryMethod,
      };

      if (visitId && data.medicineDeliveryMethod) {
        await updateVisit(visitId, { medicineDeliveryMethod: data.medicineDeliveryMethod });
      }

      const slipId = await addPaymentSlip(newSlipData);
      if (!slipId) {
        throw new Error("Failed to save payment slip to Firestore.");
      }
      const createdSlip = { ...newSlipData, id: slipId, createdAt: new Date().toISOString() };

      toast({
        title: 'পেমেন্ট স্লিপ তৈরি হয়েছে',
        description: `স্লিপ ${createdSlip.slipNumber} (${formatCurrency(createdSlip.amount)}) সফলভাবে তৈরি করা হয়েছে।`,
      });
      if (onSlipCreated) {
        onSlipCreated(createdSlip as PaymentSlip);
      }
      onClose(true);
      window.dispatchEvent(new CustomEvent('firestoreDataChange'));
    } catch (error) {
      console.error("Failed to create payment slip:", error);
      toast({
        title: 'ত্রুটি',
        description: 'পেমেন্ট স্লিপ তৈরি করতে ব্যর্থ হয়েছে।',
        variant: 'destructive',
      });
      onClose(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-xl w-full overflow-hidden rounded-xl border border-slate-200/80 dark:border-slate-800/80 shadow-2xl bg-card p-8 md:p-10">
        <DialogHeader className="space-y-1 pb-5 border-b border-slate-100 dark:border-slate-800 mb-2">
          <DialogTitle className="font-headline text-xl flex items-center text-primary gap-2">
            <Receipt className="h-6 w-6 text-primary" />
            পেমেন্ট স্লিপ ও বিল সংগ্রহ
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground mt-1.5">
            রোগী <strong>{patient.name}</strong> (ডায়েরি নং: {patient.diaryNumber || 'N/A'}) এর জন্য বিল সংগ্রহ করুন।
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 py-2">
            
            {/* Purpose field */}
            <FormField
              control={form.control}
              name="purpose"
              render={({ field }) => (
                <FormItem className="space-y-1.5">
                  <FormLabel className="text-sm font-semibold flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    পেমেন্টের উদ্দেশ্য (Purpose)
                  </FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="যেমন: প্রেসক্রিপশন ফি, ঔষধ বাবদ ফি ইত্যাদি।" 
                      {...field} 
                      className="resize-none min-h-[60px] text-sm focus-visible:ring-primary focus-visible:ring-2 border-slate-200 dark:border-slate-800 bg-background/50" 
                      rows={2} 
                    />
                  </FormControl>
                  <FormMessage className="text-xs" />
                </FormItem>
              )}
            />
            
            {/* Amount and Method Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <FormItem className="space-y-1.5">
                    <FormLabel className="text-sm font-semibold flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                      <Sparkles className="h-4 w-4 text-emerald-500" />
                      টাকার পরিমাণ (BDT)
                    </FormLabel>
                    <FormControl>
                      <div className="relative flex items-center">
                        <span className="absolute left-3 text-base font-bold text-slate-500 dark:text-slate-400">৳</span>
                        <Input 
                          type="number" 
                          placeholder="0" 
                          {...field} 
                          className="pl-8 text-base font-semibold border-emerald-200 focus-visible:ring-emerald-500 dark:border-emerald-950 dark:focus-visible:ring-emerald-700 focus-visible:ring-2 bg-emerald-50/10 dark:bg-emerald-950/10" 
                        />
                      </div>
                    </FormControl>
                    <FormMessage className="text-xs" />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="paymentMethod"
                render={({ field }) => (
                  <FormItem className="space-y-1.5">
                    <FormLabel className="text-sm font-semibold flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                      <CreditCard className="h-4 w-4 text-muted-foreground" />
                      পেমেন্ট মাধ্যম
                    </FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || ''} defaultValue="cash" disabled={!isAmountPositive}>
                      <FormControl>
                        <SelectTrigger className="border-slate-200 dark:border-slate-800 bg-background/50 h-10">
                          <SelectValue placeholder="পেমেন্ট মাধ্যম নির্বাচন করুন" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {paymentMethodOptions.map(option => (
                          <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage className="text-xs" />
                  </FormItem>
                )}
              />
            </div>
            
            {/* Delivery Method and Received By Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="medicineDeliveryMethod"
                render={({ field }) => (
                  <FormItem className="space-y-1.5">
                    <FormLabel className="text-sm font-semibold flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                      <Truck className="h-4 w-4 text-muted-foreground" />
                      ঔষধ প্রদানের মাধ্যম (ঐচ্ছিক)
                    </FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || 'direct'} defaultValue="direct">
                      <FormControl>
                        <SelectTrigger className="border-slate-200 dark:border-slate-800 bg-background/50 h-10">
                          <SelectValue placeholder="মাধ্যম নির্বাচন করুন" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {medicineDeliveryMethodOptions.map(option => (
                          <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage className="text-xs" />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="receivedBy"
                render={({ field }) => (
                  <FormItem className="space-y-1.5">
                    <FormLabel className="text-sm font-semibold flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                      <User className="h-4 w-4 text-muted-foreground" />
                      বিল গ্রহণকারী (ঐচ্ছিক)
                    </FormLabel>
                    <FormControl>
                      <div className="relative flex items-center">
                        <User className="absolute left-3 h-4 w-4 text-slate-400" />
                        <Input 
                          placeholder="গ্রহণকারীর নাম" 
                          {...field} 
                          className="pl-9 border-slate-200 dark:border-slate-800 bg-background/50 h-10" 
                          id="slipReceivedByModalBengali" 
                        />
                      </div>
                    </FormControl>
                    <FormMessage className="text-xs" />
                  </FormItem>
                )}
              />
            </div>
            
            <DialogFooter className="pt-6 border-t border-slate-100 dark:border-slate-800 gap-2 sm:gap-0 mt-6">
              <DialogClose asChild>
                <Button type="button" variant="outline" onClick={() => onClose(false)} className="border-slate-200 dark:border-slate-800">
                  বাতিল করুন
                </Button>
              </DialogClose>
              <Button 
                type="submit" 
                disabled={form.formState.isSubmitting}
                className="bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-md hover:shadow-lg hover:brightness-105 active:brightness-95 transition-all duration-200"
              >
                {form.formState.isSubmitting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Receipt className="mr-2 h-4 w-4" />
                )}
                পেমেন্ট স্লিপ তৈরি করুন
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
