'use client';
import React, { useEffect, useState, Suspense } from 'react';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { addPatient, updatePatient, checkDiaryNumberExists } from '@/lib/firestoreService';
import type { Patient, AnalysisResult } from '@/lib/types';
import { ROUTES } from '@/lib/constants';
import { PageHeaderCard } from '@/components/shared/PageHeaderCard';
import { useSearchParams } from 'next/navigation';
import {
  Loader2,
  CalendarIcon,
  Brain,
  Save,
  Sparkles,
} from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { format, isValid } from 'date-fns';
import { bn } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import AnalysisResultDisplay from '@/components/repertory/AnalysisResultDisplay';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { CoreLabelPrintModal } from '@/components/pharma-guide/CoreLabelPrintModal';
import dynamic from "next/dynamic";
import type { CreatePaymentSlipModalProps } from "@/components/slip/CreatePaymentSlipModal";
import { useRouter } from 'next/navigation';

const CreatePaymentSlipModal = dynamic<CreatePaymentSlipModalProps>(
  () => import("@/components/slip/CreatePaymentSlipModal").then((mod) => mod.CreatePaymentSlipModal),
  {
    ssr: false,
    loading: () => <LoadingSpinner variant="component" />,
  }
);

const patientFormSchema = z.object({
  registrationDate: z.date({ required_error: 'নিবন্ধনের তারিখ আবশ্যক।' }),
  diaryNumber: z.string().min(1, { message: 'ডায়েরি নম্বর আবশ্যক।' }),
  name: z.string().min(1, { message: 'পুরো নাম আবশ্যক।' }),
  age: z.string().optional(),
  gender: z
    .enum(['male', 'female', 'other', ''], {
      errorMap: () => ({ message: 'লিঙ্গ নির্বাচন করুন।' }),
    })
    .optional(),
  occupation: z.string().optional(),
  phone: z.string().regex(/^(\+8801|01)\d{9}$/, {
    message: 'একটি বৈধ বাংলাদেশী ফোন নম্বর লিখুন।',
  }),
  guardianName: z.string().optional(),
  district: z.string().optional(),
  thanaUpazila: z.string().optional(),
  villageUnion: z.string().optional(),
  height: z.string().optional(),
  weight: z.string().optional(),
  complexion: z.string().optional(),
  mentalState: z.string().optional(),
  rawSymptoms: z.string().min(20, {
    message:
      'বিশ্লেষণ করার জন্য অনুগ্রহ করে রোগীর সমস্যা ও ইতিহাস সম্পর্কে আরও বিস্তারিত লিখুন (কমপক্ষে ২০ অক্ষর)।',
  }),
  analysisResult: z.custom<AnalysisResult>().optional(),
});

type PatientFormValues = z.infer<typeof patientFormSchema>;

function PatientEntryPageContent() {
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmittingFinal, setIsSubmittingFinal] = useState(false);
  const [savedPatientId, setSavedPatientId] = useState<string | null>(null);
  
  const [showCoreLabelPrint, setShowCoreLabelPrint] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [savedPatientInfo, setSavedPatientInfo] = useState<Patient | null>(null);
  const [currentVisitId, setCurrentVisitId] = useState<string | null>(null);
  const router = useRouter();

  const form = useForm<PatientFormValues>({
    resolver: zodResolver(patientFormSchema),
    defaultValues: {
      registrationDate: new Date(),
      diaryNumber: '',
      name: '',
      age: '',
      gender: '',
      occupation: '',
      phone: '',
      guardianName: '',
      district: '',
      thanaUpazila: '',
      villageUnion: '',
      height: '',
      weight: '',
      complexion: '',
      mentalState: '',
      rawSymptoms: '',
      analysisResult: undefined,
    },
  });

  const { formState: { isDirty } } = form;

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (isDirty) {
        event.preventDefault();
        event.returnValue =
          'আপনার করা পরিবর্তনগুলো সেভ করা হয়নি। আপনি কি নিশ্চিত যে আপনি এই পেজটি ছাড়তে চান?';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [isDirty]);

  useEffect(() => {
    const urlParams = Object.fromEntries(searchParams.entries());
    if (Object.keys(urlParams).length > 0) {
      Object.entries(urlParams).forEach(([key, value]) => {
        if (value && key in form.getValues()) {
          if (key !== 'registrationDate' && key !== 'analysisResult') {
            form.setValue(key as keyof PatientFormValues, value, {
              shouldDirty: true,
            });
          }
        }
      });
    }
  }, [searchParams, form]);

  const handleAnalyzeSymptoms = async () => {
    const rawSymptoms = form.getValues('rawSymptoms');
    if (!rawSymptoms || rawSymptoms.trim().length < 20) {
      toast({
        title: 'অপর্যাপ্ত তথ্য',
        description:
          'বিশ্লেষণ করার জন্য অনুগ্রহ করে রোগীর সমস্যা ও ইতিহাস সম্পর্কে আরও বিস্তারিত লিখুন (কমপক্ষে ২০ অক্ষর)।',
        variant: 'destructive',
      });
      return;
    }
    
    try {
      window.dispatchEvent(new CustomEvent('stop-voice-input'));
    } catch (e) {
      console.error(e);
    }
    const el = document.getElementById(
      'rawSymptoms-textarea',
    ) as HTMLTextAreaElement | null;
    if (el && el.value !== form.getValues('rawSymptoms')) {
      form.setValue('rawSymptoms', el.value, { shouldDirty: true });
    }

    setIsAnalyzing(true);
    setAnalysisError(null);
    setAnalysisResult(null);

    try {
      const patientDemographics = {
          name: form.getValues('name'),
          age: form.getValues('age'),
          gender: form.getValues('gender'),
          height: form.getValues('height'),
          weight: form.getValues('weight'),
          complexion: form.getValues('complexion'),
      };

      const res = await fetch('/api/ai/homeopathic-assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            rawSymptoms, 
            patientDemographics
        }),
      });
      const result: AnalysisResult | { error?: string } = await res.json();

      if (!res.ok || ('error' in result && result.error)) {
        throw new Error(
          ('error' in result && result.error) || 'বিশ্লেষণ ব্যর্থ হয়েছে'
        );
      }
      const data = result as AnalysisResult;
      setAnalysisResult(data);
      form.setValue('analysisResult', data, { shouldDirty: true });
      toast({
        title: 'বিশ্লেষণ সফল',
        description:
          'রোগীর লক্ষণগুলো বিশ্লেষণ করে সম্ভাব্য ঔষধ ও তার কারণ দেখানো হয়েছে।',
      });
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'একটি অজানা ত্রুটি ঘটেছে।';
      setAnalysisError(errorMessage);
      toast({
        title: 'বিশ্লেষণ ব্যর্থ হয়েছে',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSaveBasicInfo = async () => {
    const basicInfoFields: (keyof PatientFormValues)[] = [
      'registrationDate',
      'diaryNumber',
      'name',
      'age',
      'gender',
      'occupation',
      'phone',
      'guardianName',
      'district',
      'thanaUpazila',
      'villageUnion',
      'height',
      'weight',
      'complexion',
    ];
    const triggerResult = await form.trigger(basicInfoFields);

    if (!triggerResult) {
      toast({
        title: 'ফর্ম যাচাইকরণ ব্যর্থ',
        description: 'অনুগ্রহ করে সকল আবশ্যক তথ্য পূরণ করুন।',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);
    const data = form.getValues();
    
    try {
      const isDiaryNumberUsed = await checkDiaryNumberExists(data.diaryNumber, savedPatientId || undefined);
      if (isDiaryNumberUsed) {
        form.setError('diaryNumber', { type: 'manual', message: 'এই সিরিয়াল নম্বরটি ইতিমধ্যে অন্য রোগীর জন্য বরাদ্দ করা হয়েছে। অনুগ্রহ করে একটি ইউনিক নম্বর প্রদান করুন।' });
        toast({
          title: 'সিরিয়াল নম্বর ব্যবহৃত',
          description: 'এই সিরিয়াল নম্বরটি ইতিমধ্যে অন্য রোগীর জন্য বরাদ্দ করা হয়েছে। অনুগ্রহ করে একটি ইউনিক নম্বর প্রদান করুন।',
          variant: 'destructive',
        });
        setIsSubmitting(false);
        return;
      }
    } catch (error) {
      console.error('Error checking diary number:', error);
    }

    try {
      const patientDataPayload: Partial<Patient> = {
        name: data.name,
        phone: data.phone,
        registrationDate: data.registrationDate.toISOString(),
        age: data.age || undefined,
        gender: (data.gender as Patient['gender']) || undefined,
        occupation: data.occupation || undefined,
        guardianName: data.guardianName || undefined,
        district: data.district || undefined,
        thanaUpazila: data.thanaUpazila || undefined,
        villageUnion: data.villageUnion || undefined,
        diaryNumber: data.diaryNumber || undefined,
        height: data.height || undefined,
        weight: data.weight || undefined,
        complexion: data.complexion || undefined,
      };

      let patientId = savedPatientId;
      if (patientId) {
        await updatePatient(patientId, patientDataPayload);
      } else {
        const newPatientId = await addPatient(patientDataPayload);
        setSavedPatientId(newPatientId);
        patientId = newPatientId;
      }

      toast({
        title: 'সাধারণ তথ্য সংরক্ষিত হয়েছে',
        description: `${data.name}-এর প্রাথমিক তথ্য সফলভাবে সেভ করা হয়েছে। এখন আপনি লক্ষণ বিশ্লেষণ করতে পারেন।`,
      });
      window.dispatchEvent(new CustomEvent('firestoreDataChange'));
    } catch (error: any) {
      console.error('Failed to save basic patient info:', error);
      
      let errorMsg = `সাধারণ তথ্য সেভ করার সময় একটি ত্রুটি ঘটেছে।`;
      if (error?.code === 'permission-denied') {
        errorMsg = 'এই ডায়েরি/সিরিয়াল নম্বরটি ইতিমধ্যে অন্য রোগীর জন্য বরাদ্দ করা হয়েছে। অনুগ্রহ করে একটি ইউনিক নম্বর প্রদান করুন।';
        form.setError('diaryNumber', { type: 'manual', message: errorMsg });
      }

      toast({
        title: 'সংরক্ষণ ব্যর্থ',
        description: errorMsg,
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const onSubmit: SubmitHandler<PatientFormValues> = async (data) => {
    setIsSubmittingFinal(true);
    try {
      const patientId = savedPatientId;
      
      if (!patientId) {
          toast({
              title: 'তথ্য সংরক্ষণ করুন',
              description: 'চূড়ান্তভাবে নিবন্ধন করার আগে অনুগ্রহ করে "সাধারণ তথ্য সংরক্ষণ করুন" বাটনে ক্লিক করে তথ্য সেভ করুন।',
              variant: 'destructive'
          });
          setIsSubmittingFinal(false);
          return;
      }

      const fullPatientData: Partial<Patient> = {
        rawSymptoms: data.rawSymptoms || undefined,
        analysisResult: data.analysisResult || undefined,
      };

      await updatePatient(patientId, fullPatientData);

      toast({
        title: 'রোগী নিবন্ধিত',
        description: `${data.name} সফলভাবে নিবন্ধিত হয়েছেন। আইডি: ${patientId}`,
      });

      // Prepare patient info for printing
      setSavedPatientInfo({
          id: patientId,
          name: data.name,
          diaryNumber: data.diaryNumber,
          phone: data.phone,
          registrationDate: data.registrationDate,
          gender: data.gender as any,
          age: data.age,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
      } as unknown as Patient);
      
      setShowCoreLabelPrint(true);
      
      // We don't reset form yet, it will be reset when modal is closed
      setAnalysisResult(null);
      setSavedPatientId(null);
      window.dispatchEvent(new CustomEvent('firestoreDataChange'));
    } catch (error) {
      console.error('Failed to register patient:', error);
      const errorMessage =
        error instanceof Error ? error.message : 'An unknown error occurred.';
      toast({
        title: 'নিবন্ধন ব্যর্থ হয়েছে',
        description: `রোগী নিবন্ধন করার সময় একটি ত্রুটি ঘটেছে: ${errorMessage}`,
        variant: 'destructive',
      });
    } finally {
      setIsSubmittingFinal(false);
    }
  };

  return (
    <>
      <div className="space-y-6">
        <Form {...form}>
          <PageHeaderCard
            title="নতুন রোগী নিবন্ধন"
            description="নতুন রোগী নিবন্ধন করতে নিচের বিবরণগুলি পূরণ করুন।"
            className="bg-gradient-to-br from-violet-100 to-indigo-200 dark:from-violet-900/30 dark:to-indigo-900/30"
          />
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <Card className="shadow-lg border-border/30 bg-card/60 backdrop-blur-xl">
              <CardHeader>
                <CardTitle className="font-headline text-lg">
                  রোগীর সাধারণ ও ডেমোগ্রাফিক তথ্য
                </CardTitle>
                <CardDescription>
                  রোগীর ব্যক্তিগত, যোগাযোগের তথ্য এবং ডেমোগ্রাফিক বিবরণ লিখুন।
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-8">
                  {/* TOP SECTION: Primary Info */}
                  <div>
                    <h3 className="text-sm font-semibold text-primary/80 mb-4 border-b pb-2 flex items-center">
                      <span className="bg-primary/10 w-6 h-6 rounded-full flex items-center justify-center mr-2 text-xs">1</span>
                      প্রাথমিক তথ্য
                    </h3>
                    <div className="grid grid-cols-1 gap-x-6 gap-y-4 md:grid-cols-2 lg:grid-cols-4">
                      <FormField
                        control={form.control}
                        name="registrationDate"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>
                              নিবন্ধনের তারিখ{' '}
                              <span className="text-destructive">*</span>
                            </FormLabel>
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button
                                  variant={'outline'}
                                  className={cn(
                                    'w-full justify-start text-left font-normal',
                                    !field.value && 'text-muted-foreground',
                                  )}
                                >
                                  <CalendarIcon className="mr-2 h-4 w-4 opacity-70" />
                                  {field.value && isValid(field.value) ? (
                                    format(field.value, 'PPP', { locale: bn })
                                  ) : (
                                    <span>একটি তারিখ নির্বাচন করুন</span>
                                  )}
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-0" align="start">
                                <Calendar
                                  mode="single"
                                  selected={field.value}
                                  onSelect={field.onChange}
                                  disabled={(date) =>
                                    date > new Date() ||
                                    date < new Date('1900-01-01')
                                  }
                                  initialFocus
                                  locale={bn}
                                />
                              </PopoverContent>
                            </Popover>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="diaryNumber"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>ডায়েরি নম্বর <span className="text-destructive">*</span></FormLabel>
                            <FormControl>
                              <Input
                                placeholder="যেমন: F/123"
                                {...field}
                                type="text"
                                id="patientDiaryNumberEntry"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>
                              পুরো নাম <span className="text-destructive">*</span>
                            </FormLabel>
                            <FormControl>
                              <Input
                                placeholder="রোগীর নাম"
                                {...field}
                                id="patientNameEntry"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="phone"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>
                              ফোন নম্বর <span className="text-destructive">*</span>
                            </FormLabel>
                            <FormControl>
                              <Input
                                type="tel"
                                placeholder="01XXXXXXXXX"
                                {...field}
                                id="patientPhoneEntry"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  {/* MIDDLE SECTION: Compact Fields */}
                  <div>
                    <h3 className="text-sm font-semibold text-primary/80 mb-4 border-b pb-2 flex items-center">
                      <span className="bg-primary/10 w-6 h-6 rounded-full flex items-center justify-center mr-2 text-xs">2</span>
                      যোগাযোগের তথ্য
                    </h3>
                    <div className="grid grid-cols-1 gap-x-6 gap-y-4 md:grid-cols-2 lg:grid-cols-3">
                      <FormField
                        control={form.control}
                        name="age"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>বয়স</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="যেমন: ৩৫"
                                {...field}
                                type="text"
                                id="patientAgeEntry"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="guardianName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>পিতা/স্বামীর নাম</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="অভিভাবকের নাম"
                                {...field}
                                id="guardianNameEntry"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  {/* BOTTOM SECTION: Secondary Info */}
                  <div>
                    <h3 className="text-sm font-semibold text-primary/80 mb-4 border-b pb-2 flex items-center">
                      <span className="bg-primary/10 w-6 h-6 rounded-full flex items-center justify-center mr-2 text-xs">3</span>
                      অতিরিক্ত তথ্য (ঐচ্ছিক)
                    </h3>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-4 md:grid-cols-3 lg:grid-cols-4">
                      <FormField
                        control={form.control}
                        name="gender"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>লিঙ্গ</FormLabel>
                            <Select
                              onValueChange={field.onChange}
                              value={field.value}
                              defaultValue=""
                            >
                              <FormControl>
                                <SelectTrigger id="patientGenderEntry">
                                  <SelectValue placeholder="নির্বাচন করুন" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="male">পুরুষ</SelectItem>
                                <SelectItem value="female">মহিলা</SelectItem>
                                <SelectItem value="other">অন্যান্য</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="occupation"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>পেশা</FormLabel>
                            <Select
                              onValueChange={field.onChange}
                              value={field.value}
                              defaultValue=""
                            >
                              <FormControl>
                                <SelectTrigger id="patientOccupationEntry">
                                  <SelectValue placeholder="নির্বাচন করুন" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="student">ছাত্র/ছাত্রী</SelectItem>
                                <SelectItem value="housewife">গৃহিণী</SelectItem>
                                <SelectItem value="service">চাকুরীজীবী</SelectItem>
                                <SelectItem value="business">ব্যবসায়ী</SelectItem>
                                <SelectItem value="farmer">কৃষক</SelectItem>
                                <SelectItem value="labourer">শ্রমিক</SelectItem>
                                <SelectItem value="unemployed">বেকার</SelectItem>
                                <SelectItem value="retired">অবসরপ্রাপ্ত</SelectItem>
                                <SelectItem value="other">অন্যান্য</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="height"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>উচ্চতা</FormLabel>
                            <FormControl>
                              <Input placeholder="যেমন: ৫'৬&quot;" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="weight"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>ওজন</FormLabel>
                            <FormControl>
                              <Input placeholder="যেমন: ৬৫ কেজি" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="complexion"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>গায়ের বর্ণ</FormLabel>
                            <FormControl>
                              <Input placeholder="যেমন: শ্যামলা" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="district"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>জেলা</FormLabel>
                            <FormControl>
                              <Input placeholder="জেলা" {...field} id="districtEntry" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="thanaUpazila"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>থানা/উপজেলা</FormLabel>
                            <FormControl>
                              <Input placeholder="থানা" {...field} id="thanaUpazilaEntry" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="villageUnion"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>গ্রাম/ইউনিয়ন</FormLabel>
                            <FormControl>
                              <Input placeholder="গ্রাম" {...field} id="villageUnionEntry" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                    </div>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="flex justify-end border-t pt-6">
                <Button
                  type="button"
                  onClick={handleSaveBasicInfo}
                  disabled={isSubmitting}
                  className="min-w-[180px] bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-md hover:shadow-lg hover:brightness-105 transition-all"
                >
                  {isSubmitting ? (
                    <LoadingSpinner variant="button" />
                  ) : (
                    <Save className="mr-2 h-4 w-4" />
                  )}
                  সাধারণ তথ্য সংরক্ষণ করুন
                </Button>
              </CardFooter>
            </Card>

            <Card className="shadow-lg border-border/30 bg-card/60 backdrop-blur-xl">
              <CardHeader>
                <CardTitle className="font-headline text-lg">
                  রোগীর বিস্তারিত লক্ষণ ও বিশ্লেষণ
                </CardTitle>
                <CardDescription>
                  এখানে রোগীর সকল সমস্যা, মানসিক অবস্থা, রোগের কারণ, পূর্ব ও
                  পারিবারিক ইতিহাস ইত্যাদি বিস্তারিতভাবে লিখুন।
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <FormField
                  control={form.control}
                  name="rawSymptoms"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel htmlFor="rawSymptoms-textarea">
                        রোগীর বিস্তারিত লক্ষণ (Raw Symptoms)
                      </FormLabel>
                      <FormControl>
                        <Textarea
                          id="rawSymptoms-textarea"
                          placeholder="রোগীর সকল সমস্যা বিস্তারিতভাবে এখানে লিখুন..."
                          {...field}
                          rows={8}
                          className="text-base"
                        />
                      </FormControl>
                      <p className="text-xs text-muted-foreground pt-1">
                        টিপস: ভয়েস টাইপিংয়ের জন্য কীবোর্ডের &apos;Control&apos;
                        কী চেপে ধরে রাখুন।
                      </p>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="space-y-4 rounded-lg border bg-card/80 p-4 shadow-inner">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div>
                      <h3 className="font-semibold text-base text-primary flex items-center">
                        <Sparkles className="w-5 h-5 mr-2 text-amber-500" />
                        লক্ষণ বিশ্লেষণ করুন
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        উপরের লক্ষণগুলো থেকে সিস্টেম সবচেয়ে উপযুক্ত ঔষধ খুঁজে বের করবে।
                      </p>
                    </div>
                    <Button
                      type="button"
                      onClick={handleAnalyzeSymptoms}
                      disabled={isAnalyzing}
                      className="bg-gradient-to-r from-teal-400 to-cyan-500 text-white shadow-md hover:shadow-lg hover:brightness-105 transition-all"
                    >
                      {isAnalyzing ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Brain className="mr-2 h-4 w-4" />
                      )}
                      {isAnalyzing
                        ? 'বিশ্লেষণ চলছে...'
                        : 'ঔষধ বিশ্লেষণ করুন'}
                    </Button>
                  </div>

                  {analysisError && (
                    <Alert variant="destructive">
                      <AlertTitle>ত্রুটি</AlertTitle>
                      <AlertDescription>{analysisError}</AlertDescription>
                    </Alert>
                  )}

                  {analysisResult && (
                      <div className="space-y-4 pt-4 mt-4 border-t">
                        <AnalysisResultDisplay result={analysisResult} />
                      </div>
                    )}
                </div>
              </CardContent>
              <CardFooter className="flex justify-end border-t pt-6">
                <Button
                  type="submit"
                  disabled={isSubmittingFinal || isSubmitting || !savedPatientId || !analysisResult}
                  className="min-w-[180px] bg-gradient-to-r from-green-500 to-teal-500 text-white font-bold tracking-wider hover:brightness-110 active:brightness-90 transition-all duration-200 shadow-lg"
                >
                  {isSubmittingFinal ? (
                    <LoadingSpinner variant="button" />
                  ) : (
                    <Save className="mr-2 h-4 w-4" />
                  )}
                  সম্পূর্ণ তথ্য সেভ করুন
                </Button>
              </CardFooter>
            </Card>
          </form>
        </Form>
      </div>

      <CoreLabelPrintModal 
        isOpen={showCoreLabelPrint} 
        patient={savedPatientInfo} 
        onClose={() => {
            setShowCoreLabelPrint(false);
        }}
        onPrintSuccess={() => {
            setShowPaymentModal(true);
        }}
      />
      
      {savedPatientInfo && (
        <CreatePaymentSlipModal
          patient={savedPatientInfo}
          isOpen={showPaymentModal}
          onClose={(slipCreated) => {
            setShowPaymentModal(false);
            form.reset();
            setSavedPatientId(null);
            setSavedPatientInfo(null);
            setCurrentVisitId(null);
            
            if (slipCreated) {
              toast({
                title: "পেমেন্ট সফল",
                description: "পেমেন্ট সম্পন্ন হয়েছে এবং ড্যাশবোর্ড আপডেট করা হয়েছে।",
              });
              router.push(ROUTES.DASHBOARD);
            }
          }}
          visitId={currentVisitId || undefined}
        />
      )}
    </>
  );
}

export default function PatientEntryPage() {
  return (
    <Suspense
      fallback={
        <LoadingSpinner variant="page" label="নিবন্ধন পৃষ্ঠা লোড হচ্ছে..." />
      }
    >
      <PatientEntryPageContent />
    </Suspense>
  );
}
