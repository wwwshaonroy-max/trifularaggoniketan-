
import { useState, useEffect, useCallback, useMemo } from 'react';
import { format } from 'date-fns';
import { bn } from 'date-fns/locale';
import { Loader2, CalendarIcon, Printer } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { getDailyReport, MedicationLabel } from '@/lib/firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { cn, convertToBanglaNumerals } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";

interface DailyReportProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function DailyReport({ open, onOpenChange }: DailyReportProps) {
  const [reportDate, setReportDate] = useState<Date>(new Date());
  const [reportData, setReportData] = useState<MedicationLabel[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const fetchReport = useCallback(async (date: Date) => {
    setLoading(true);
    try {
      const data = await getDailyReport(date);
      setReportData(data);
      if (data.length === 0) {
        toast({
            title: "কোনো তথ্য নেই",
            description: `এই তারিখে কোনো বিল তৈরি হয়নি।`,
        });
      }
    } catch (error: any) {
      console.error("Error fetching daily report:", error);
      toast({
        variant: "destructive",
        title: "রিপোর্ট আনতে ত্রুটি",
        description: error.message || "দৈনিক রিপোর্ট আনতে সমস্যা হয়েছে। অনুগ্রহ করে আবার চেষ্টা করুন।",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (open) {
      fetchReport(reportDate);
    }
  }, [open, reportDate, fetchReport]);

  const totalBill = useMemo(() => {
    return reportData.reduce((sum, item) => sum + item.bill, 0);
  }, [reportData]);

  const handlePrint = () => {
    const printableArea = document.getElementById('report-printable-area');
    if (!printableArea) return;
  
    const mainContent = document.getElementById('main-content');
    const dialogContent = printableArea.closest('[role="dialog"]');

    if (mainContent) mainContent.classList.add('print:hidden');
    if (dialogContent) dialogContent.classList.add('print:hidden');

    const printContainer = document.getElementById('printable-area');
    if (!printContainer) return;
  
    printContainer.innerHTML = printableArea.innerHTML;
    window.print();
    printContainer.innerHTML = '';
    
    if (mainContent) mainContent.classList.remove('print:hidden');
    if (dialogContent) dialogContent.classList.remove('print:hidden');

  };


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl w-[95vw] h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-2xl font-body">দৈনিক রিপোর্ট</DialogTitle>
          <DialogDescription>
            নির্দিষ্ট তারিখের জন্য বিল এবং রোগীর সারাংশ দেখুন।
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col sm:flex-row justify-between items-center py-4 border-b gap-4">
          <div className="flex items-center gap-4">
             <Popover>
                <PopoverTrigger asChild>
                    <Button
                    variant={"outline"}
                    className={cn(
                        "w-full sm:w-[280px] justify-start text-left font-normal",
                        !reportDate && "text-muted-foreground"
                    )}
                    >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {reportDate ? format(reportDate, "PPP", { locale: bn }) : <span>তারিখ নির্বাচন করুন</span>}
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                    <Calendar
                    mode="single"
                    selected={reportDate}
                    onSelect={(date) => date && setReportDate(date)}
                    initialFocus
                    />
                </PopoverContent>
            </Popover>
          </div>
           <Button variant="ghost" size="icon" onClick={handlePrint} >
              <Printer className="h-5 w-5" />
              <span className="sr-only">রিপোর্ট প্রিন্ট করুন</span>
            </Button>
        </div>

        <div className="flex-grow overflow-auto">
          <div id="report-printable-area">
            <div className="report-sheet-final">
                <header className="text-center mb-4">
                <h1 className="text-2xl sm:text-3xl font-bold text-primary font-body">দৈনিক বিল রিপোর্ট</h1>
                <p className="text-base sm:text-lg text-muted-foreground">{format(reportDate, "eeee, dd MMMM, yyyy", { locale: bn })}</p>
                </header>
                {loading ? (
                <div className="flex justify-center items-center h-full">
                    <Loader2 className="h-16 w-16 animate-spin" />
                </div>
                ) : reportData.length > 0 ? (
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[50px]">ক্রমিক</TableHead>
                                <TableHead>রোগীর নাম</TableHead>
                                <TableHead>সিরিয়াল নং</TableHead>
                                <TableHead className="text-right">লেবেল</TableHead>
                                <TableHead className="text-right">বিল (টাকা)</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {reportData.map((item, index) => (
                                <TableRow key={item.id}>
                                    <TableCell>{convertToBanglaNumerals(index + 1)}</TableCell>
                                    <TableCell>{item.patientName}</TableCell>
                                    <TableCell>{item.serial}</TableCell>
                                    <TableCell className="text-right">{convertToBanglaNumerals(item.labelCount)}</TableCell>
                                    <TableCell className="text-right">{convertToBanglaNumerals(item.bill)}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                        <TableFooter>
                            <TableRow className="bg-gray-100 font-bold">
                                <TableCell colSpan={4} className="text-right text-lg">সর্বমোট বিল:</TableCell>
                                <TableCell className="text-right text-lg">{convertToBanglaNumerals(totalBill)} টাকা</TableCell>
                            </TableRow>
                        </TableFooter>
                    </Table>
                ) : (
                <div className="flex justify-center items-center h-64">
                    <p className="text-xl text-muted-foreground">এই তারিখের জন্য কোনো তথ্য পাওয়া যায়নি।</p>
                </div>
                )}
                <footer className="text-center mt-8 footer-note">
                    <p>ত্রিফুল আরোগ্য নিকেতন</p>
                    <p>কোটালীপাড়া, গোপালগঞ্জ</p>
                </footer>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
