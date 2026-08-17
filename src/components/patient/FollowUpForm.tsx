
'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Patient, CaseHistory } from '@/lib/types';
import { analyzeComplaint, ComplaintAnalyzerOutput } from '@/ai/flows/complaint-analyzer-flow';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

const followUpSchema = z.object({
  complaints: z.string().min(1, 'New complaints are required.'),
  analysis: z.string().optional(),
  followUpDate: z.string().optional(),
});

type FollowUpFormValues = z.infer<typeof followUpSchema>;

interface FollowUpFormProps {
  patient: Patient;
  onSave: (data: CaseHistory) => void;
}

export const FollowUpForm: React.FC<FollowUpFormProps> = ({ patient, onSave }) => {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const { toast } = useToast();
  const form = useForm<FollowUpFormValues>({
    resolver: zodResolver(followUpSchema),
    defaultValues: {
      complaints: '',
      analysis: '',
      followUpDate: '',
    },
  });

  const handleAnalyze = async () => {
    const complaints = form.getValues('complaints');
    if (!complaints) {
      toast({
        title: 'Error',
        description: 'Please enter complaints before analyzing.',
        variant: 'destructive',
      });
      return;
    }

    setIsAnalyzing(true);
    try {
      const analysisResult: ComplaintAnalyzerOutput = await analyzeComplaint({ symptoms: complaints });
      form.setValue('analysis', analysisResult.srpSummary || 'No SRP symptoms identified.');
      toast({
        title: 'Analysis Complete',
        description: 'The AI analysis has been completed.',
      });
    } catch (error) {
      console.error('Error analyzing complaints:', error);
      toast({
        title: 'Error',
        description: 'Failed to analyze complaints.',
        variant: 'destructive',
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const onSubmit = (data: FollowUpFormValues) => {
    const newVisit: CaseHistory = {
      id: new Date().toISOString(), // Temporary ID
      patientId: patient.id,
      visitDate: new Date().toISOString(),
      complaints: data.complaints,
      analysis: data.analysis,
      followUpDate: data.followUpDate,
      createdAt: new Date().toISOString(),
    };
    onSave(newVisit);
    form.reset();
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="complaints"
          render={({ field }) => (
            <FormItem>
              <FormLabel>New Complaints</FormLabel>
              <FormControl>
                <Textarea placeholder="Enter new complaints" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="button" onClick={handleAnalyze} disabled={isAnalyzing}>
          {isAnalyzing ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Analyzing...
            </>
          ) : (
            'Analyze with AI'
          )}
        </Button>
        <FormField
          control={form.control}
          name="analysis"
          render={({ field }) => (
            <FormItem>
              <FormLabel>AI Analysis (SRP Summary)</FormLabel>
              <FormControl>
                <Textarea placeholder="AI analysis will be shown here" {...field} readOnly />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="followUpDate"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Next Follow-up Date</FormLabel>
              <FormControl>
                <Input type="date" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit">Save Visit</Button>
      </form>
    </Form>
  );
};
