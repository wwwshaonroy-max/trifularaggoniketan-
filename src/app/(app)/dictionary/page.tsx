
'use client';
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { PageHeaderCard } from '@/components/shared/PageHeaderCard';
import { getPatients } from '@/lib/firestoreService';
import type { Patient } from '@/lib/types';
import { BENGALI_VOWELS_FOR_FILTER, BENGALI_CONSONANTS_FOR_FILTER } from '@/lib/constants';
import { Loader2, ExternalLink, ListChecks } from 'lucide-react';
import Link from 'next/link';
import { ROUTES } from '@/lib/constants';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { motion, AnimatePresence } from 'framer-motion';

const MotionTableRow = motion(TableRow);

const getFirstChar = (name: string): string => {
  if (!name) return '';
  return name.charAt(0).toUpperCase();
};

export default function DictionaryPage() {
  const [allPatients, setAllPatients] = useState<Patient[]>([]);
  const [selectedLetter, setSelectedLetter] = useState<string | null>(BENGALI_VOWELS_FOR_FILTER[0]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchPatients = useCallback(async () => {
    setIsLoading(true);
    try {
        const patientsData = await getPatients();
        setAllPatients(patientsData.sort((a, b) => a.name.localeCompare(b.name, 'bn')));
    } catch (error) {
        console.error("Failed to fetch patients", error);
    } finally {
        setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPatients();
    
    const handleDataChange = () => {
      fetchPatients();
    };
    window.addEventListener('firestoreDataChange', handleDataChange);
    return () => {
      window.removeEventListener('firestoreDataChange', handleDataChange);
    };

  }, [fetchPatients]);

  const filteredPatients = useMemo(() => {
    if (!selectedLetter || selectedLetter === 'সব') return allPatients;
    return allPatients.filter(patient => getFirstChar(patient.name) === selectedLetter);
  }, [selectedLetter, allPatients]);

  const handleLetterClick = (letter: string) => {
    setSelectedLetter(letter);
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 15, filter: 'blur(4px)' }}
      animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="space-y-6"
    >
      <PageHeaderCard
        title="রোগীর তালিকা"
        description="রোগীর রেকর্ড ব্রাউজ, অনুসন্ধান এবং ফিল্টার করুন।"
        actions={<ListChecks className="h-8 w-8 text-primary" />}
        className="bg-gradient-to-br from-teal-100 to-green-200 dark:from-teal-900/30 dark:to-green-900/30"
      />

      <Card className="shadow-sm bg-blue-500/10 backdrop-blur-lg">
        <CardHeader className="pb-2 pt-4">
          <CardTitle className="font-headline text-lg">স্বরবর্ণ দ্বারা ফিল্টার:</CardTitle>
        </CardHeader>
        <CardContent className="pb-4">
          <ScrollArea className="h-auto max-h-[100px] w-full whitespace-nowrap rounded-md">
            <div className="flex space-x-1">
              {BENGALI_VOWELS_FOR_FILTER.map((letter) => (
                <Button
                  key={`vowel-${letter}`}
                  variant={selectedLetter === letter ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => handleLetterClick(letter)}
                  className={`p-2 h-9 w-9 text-base ${selectedLetter === letter ? 'bg-primary text-primary-foreground' : 'bg-white hover:bg-blue-100'}`}
                  aria-label={`Filter by vowel ${letter}`}
                >
                  {letter}
                </Button>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      <Card className="shadow-sm bg-purple-500/10 backdrop-blur-lg">
        <CardHeader className="pb-2 pt-4">
          <CardTitle className="font-headline text-lg">ব্যঞ্জনবর্ণ দ্বারা ফিল্টার:</CardTitle>
        </CardHeader>
        <CardContent className="pb-4">
          <ScrollArea className="h-auto max-h-[150px] w-full whitespace-nowrap rounded-md">
            <div className="flex flex-wrap gap-1">
              {BENGALI_CONSONANTS_FOR_FILTER.map((letter) => (
                <Button
                  key={`consonant-${letter}`}
                  variant={selectedLetter === letter ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => handleLetterClick(letter)}
                  className={`p-2 h-9 w-9 text-base ${selectedLetter === letter ? 'bg-primary text-primary-foreground' : 'bg-white hover:bg-purple-100'}`}
                  aria-label={`Filter by consonant ${letter}`}
                >
                  {letter}
                </Button>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="flex justify-center items-center py-10">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="ml-2 text-muted-foreground">রোগীর তালিকা লোড হচ্ছে...</p>
        </div>
      ) : (
        <Card className="shadow-sm mt-4 bg-card/80 backdrop-blur-lg">
          <CardHeader>
            <CardTitle className="font-headline text-xl">
              {selectedLetter && selectedLetter !== 'সব' ? `"${selectedLetter}" দিয়ে শুরু হওয়া রোগীগণ` : "সকল রোগী"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {filteredPatients.length > 0 ? (
              <div className="overflow-x-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ডায়েরি নং</TableHead>
                      <TableHead>নাম</TableHead>
                      <TableHead>ফোন</TableHead>
                      <TableHead>ঠিকানা</TableHead>
                      <TableHead className="text-right">কার্যক্রম</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <AnimatePresence>
                      {filteredPatients.map((patient, index) => (
                        <MotionTableRow 
                          key={patient.id}
                          initial={{ opacity: 0, x: -15, filter: 'blur(2px)' }}
                          animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
                          transition={{ 
                            type: 'spring', 
                            stiffness: 250, 
                            damping: 20,
                            delay: index * 0.03 
                          }}
                          className="hover:bg-blue-50/50 dark:hover:bg-blue-900/20 transition-colors"
                        >
                          <TableCell>{patient.diaryNumber || 'N/A'}</TableCell>
                          <TableCell className="font-medium">{patient.name}</TableCell>
                          <TableCell>{patient.phone}</TableCell>
                          <TableCell>{patient.villageUnion}{patient.district ? `, ${patient.district}` : ''}</TableCell>
                          <TableCell className="text-right">
                            <Button asChild variant="link" size="sm" className="text-primary font-semibold">
                              <Link href={`${ROUTES.PATIENT_SEARCH}?q=${patient.diaryNumber || patient.phone}&tab=history`}>
                                বিস্তারিত দেখুন
                                <ExternalLink className="ml-2 h-4 w-4" />
                              </Link>
                            </Button>
                          </TableCell>
                        </MotionTableRow>
                      ))}
                    </AnimatePresence>
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="mt-6 text-center text-muted-foreground py-8">
                {selectedLetter && selectedLetter !== 'সব'
                  ? `"${selectedLetter}" অক্ষর দিয়ে শুরু কোনো রোগীর নাম পাওয়া যায়নি।`
                  : "রোগীর তালিকা দেখতে একটি অক্ষর নির্বাচন করুন অথবা কোনো রোগী এখনো নিবন্ধিত হয়নি।"
                }
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </motion.div>
  );
}
