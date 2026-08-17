
import type { Dispatch, SetStateAction } from "react";
import React, { useState, useEffect, useCallback, useRef } from "react";
import type { LabelState, IntervalMode, MealTime } from "@/lib/types";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { CalendarIcon, PlusCircle, XCircle, ChevronDown, Mic, MicOff } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { cn, convertToBanglaNumerals } from "@/lib/utils";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { Patient } from "@/lib/types";
import PatientSearch from "./patient-search";
import { useToast } from "@/hooks/use-toast";


interface LabelFormProps {
  state: LabelState;
  setState: (newState: Partial<LabelState>) => void;
  hideSearch?: boolean;
  readOnlyPatientInfo?: boolean;
}

const predefinedCounseling: string[] = [
  "• ঔষধ সেবনকালীন যাবতীয় ঔষধি নিষিদ্ধ।",
  "• ঔষধ সেবনের আধা ঘন্টা আগে-পরে জল ব্যতিত কোন খাবার খাবেন না।",
  "• জরুরী প্রয়োজনে বিকাল <strong>৫টা</strong> থেকে <strong>৭টার</strong> মধ্যে ফোন করুন।",
  `• <strong>৭ দিন</strong> পরে আসবেন।`,
  "• টক জাতীয় খাবার খাবেন না।",
  "• কাঁচা পিয়াজ-রসুন খাবেন না।",
  "• অ্যালার্জিযুক্ত সকল খাবার খাবেন।",
  "• রাত্রি জাগরণ করবেন না।",
  "• নিয়মিত প্রেসার/ডায়াবেটিসের ঔষধ খাবেন।",
  "• ঠান্ডা জাতীয় খাবার খাবেন না।",
  "• বমি, পাতলা পায়খানা, সর্দি হলে অবশ্যই জানাবেন।",
  "• অতিরিক্ত দেয়া ঔষধ ফোন না করে খাবেন না।"
];

// Extend window type for SpeechRecognition
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

export default function LabelForm({ 
  state, 
  setState,
  hideSearch = false,
  readOnlyPatientInfo = false,
}: LabelFormProps) {
  const [selectedCounseling, setSelectedCounseling] = useState<string>("");
  const [customCounseling, setCustomCounseling] = useState("");
  const [isCounselingOpen, setIsCounselingOpen] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);
  const { toast } = useToast();

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.lang = 'bn-BD';
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;

      recognition.onresult = (event: any) => {
        let transcript = event.results[0][0].transcript;
        // Specific word replacements
        transcript = transcript.replace(/মোহাম্মদ|মুহাম্মদ|মোসাম্মদ/gi, 'মো:');
        setState({ patientName: transcript });
        setIsListening(false);
      };

      recognition.onerror = (event: any) => {
        console.error('Speech recognition error', event.error);
        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
             toast({
                variant: "destructive",
                title: "মাইক্রোফোন অনুমতি প্রয়োজন",
                description: "ভয়েস টাইপিং ব্যবহার করতে মাইক্রোফোন ব্যবহারের অনুমতি দিন।",
            });
        }
        setIsListening(false);
      };
      
      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    }
  }, [setState, toast]);

  const toggleListening = () => {
    if (!recognitionRef.current) {
         toast({
            variant: "destructive",
            title: "ব্রাউজার সমর্থিত নয়",
            description: "আপনার ব্রাউজার ভয়েস টাইপিং সমর্থন করে না।",
        });
      return;
    }
    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      recognitionRef.current.start();
      setIsListening(true);
    }
  };


  const handlePatientSelect = useCallback((patient: Patient | null, newQuery?: string) => {
    if (patient) {
      setState({
        patientId: patient.id,
        patientName: patient.name,
        serial: patient.diaryNumber || 'F/',
      });
    } else if(newQuery) {
        // Handle new patient entry
        const isNumeric = /^\d+$/.test(newQuery);
        if (isNumeric || newQuery.toUpperCase().startsWith('F/')) {
             setState({
                serial: newQuery,
                patientName: "", // Clear name for new serial
                patientId: undefined
            });
        } else {
            setState({
                patientName: newQuery,
                serial: "F/", // Reset to default serial for new patient
                patientId: undefined
            });
        }
    }
  }, [setState]);

  const handleNumberChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    if (value === '') {
      setState({ [name]: undefined });
      return;
    }
    const numValue = parseInt(value, 10);
    setState({ [name]: isNaN(numValue) ? undefined : numValue });
  }, [setState]);
  
  const handleLabelCountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    
    if (value === '') {
        setState({ labelCount: 1 });
        return;
    }
    
    const numValue = parseInt(value, 10);

    if (!isNaN(numValue) && numValue > 0) {
        setState({ labelCount: numValue });
    } else if (isNaN(numValue) || numValue < 1) {
        setState({ labelCount: 1 });
    }
  };
  
  const addNewCounselingItem = useCallback((newItem: string) => {
    if (newItem && !state.counseling.find((item: string) => item.replace(/<[^>]*>/g, '') === newItem.replace(/<[^>]*>/g, ''))) {
        
        const currentCounseling = [...state.counseling];
        const followUpIndex = currentCounseling.findIndex(c => c.includes("পরে আসবেন"));
        
        const followUpItem = followUpIndex > -1 ? currentCounseling.splice(followUpIndex, 1)[0] : null;

        const newCounselingList = [newItem, ...currentCounseling];

        if (followUpItem) {
            newCounselingList.push(followUpItem);
        }
        
        setState({ counseling: newCounselingList });
    }
}, [state.counseling, setState]);


  const addCounseling = useCallback(() => {
    addNewCounselingItem(selectedCounseling);
  }, [selectedCounseling, addNewCounselingItem]);

  const addCustomCounseling = useCallback(() => {
    if (customCounseling.trim() !== "") {
      const newCounselingItem = customCounseling.trim().startsWith('•') ? customCounseling.trim() : `• ${customCounseling.trim()}`;
      addNewCounselingItem(newCounselingItem);
      setCustomCounseling("");
    }
  }, [customCounseling, addNewCounselingItem]);


  const removeCounseling = useCallback((index: number) => {
      setState({ counseling: state.counseling.filter((_: unknown, i: number) => i !== index) });
  }, [setState, state.counseling]);
  
  const handleIntervalModeChange = useCallback((value: IntervalMode) => {
    let newState: Partial<LabelState> = {intervalMode: value};
    if (value === 'meal-time') {
        if(state.mealTime === 'none') {
            newState.mealTime = 'morning';
        }
    }
    setState(newState);
  }, [setState, state.mealTime]);

  useEffect(() => {
    const followUpDays = state.followUpDays;
    const newCounseling = [...(state.counseling || [])];
    const followUpIndex = newCounseling.findIndex(c => c.includes("পরে আসবেন"));

    if (followUpDays !== undefined && followUpDays > 0) {
        const followUpText = `• <strong>${convertToBanglaNumerals(followUpDays)} দিন</strong> পরে আসবেন।`;
        if (followUpIndex !== -1) {
            if (newCounseling[followUpIndex] !== followUpText) {
                newCounseling[followUpIndex] = followUpText;
                setState({ counseling: newCounseling });
            }
        } else {
            newCounseling.push(followUpText);
            setState({ counseling: newCounseling });
        }
    } else {
        if (followUpIndex !== -1) {
            newCounseling.splice(followUpIndex, 1);
            setState({ counseling: newCounseling });
        }
    }
  }, [state.followUpDays, state.counseling, setState]);


  return (
    <div className="space-y-6">

        {!hideSearch && (
          <div>
              <Label>রোগী খুঁজুন (নাম বা ক্রমিক নং)</Label>
              <PatientSearch onPatientSelect={handlePatientSelect} />
          </div>
        )}
      
      <div className="grid grid-cols-5 gap-4">
        <div className="col-span-2">
            <Label htmlFor="serial">ক্রমিক নং</Label>
            <Input 
                id="serial" 
                name="serial" 
                value={state.serial} 
                onChange={(e) => setState({ serial: e.target.value })} 
                autoComplete="off"
                className="text-left"
              />
        </div>
        <div className="col-span-3">
            <Label>তারিখ</Label>
            <Popover>
            <PopoverTrigger asChild>
                <Button
                variant={"outline"}
                className={cn(
                    "w-full justify-start text-left font-normal truncate",
                    !state.date && "text-muted-foreground"
                )}
                >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {state.date ? format(state.date, "PPP") : <span>Pick a date</span>}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
                <Calendar
                mode="single"
                selected={state.date}
                onSelect={(date) => date && setState({ date })}
                initialFocus
                />
            </PopoverContent>
            </Popover>
        </div>
      </div>

      <div>
          <Label htmlFor="patientName">রোগীর নাম</Label>
           <div className="relative flex items-center">
             <Input 
              id="patientName"
              name="patientName"
              value={state.patientName}
              onChange={(e) => setState({ patientName: e.target.value })}
              autoComplete="off"
              className="pr-10"
            />
            <Button 
                type="button"
                variant="ghost" 
                size="icon" 
                onClick={toggleListening}
                className="absolute right-1 h-8 w-8"
            >
                {isListening ? <Mic className="h-4 w-4 text-red-500 animate-pulse" /> : <MicOff className="h-4 w-4" />}
                <span className="sr-only">Toggle Voice Typing</span>
            </Button>
           </div>
      </div>

       <div className="space-y-4 pt-2">
          <RadioGroup
            value={state.shakeMode}
            onValueChange={(value: "with" | "without") => setState({shakeMode: value})}
            className="flex flex-wrap gap-4"
          >
            <div className="flex items-center">
              <RadioGroupItem value="with" id="with-shake" className="peer sr-only" />
              <Label 
                htmlFor="with-shake"
                className="px-4 py-2 rounded-lg bg-gray-200 text-gray-700 border-2 border-transparent hover:border-indigo-600 font-semibold transition duration-150 cursor-pointer peer-data-[state=checked]:bg-indigo-600 peer-data-[state=checked]:text-white peer-data-[state=checked]:border-indigo-600"
              >
                ঝাঁকি সহ
              </Label>
            </div>
            <div className="flex items-center">
              <RadioGroupItem value="without" id="without-shake" className="peer sr-only" />
              <Label 
                htmlFor="without-shake"
                className="px-4 py-2 rounded-lg bg-gray-200 text-gray-700 border-2 border-transparent hover:border-indigo-600 font-semibold transition duration-150 cursor-pointer peer-data-[state=checked]:bg-indigo-600 peer-data-[state=checked]:text-white peer-data-[state=checked]:border-indigo-600"
              >
                ঝাঁকি ছাড়া
              </Label>
            </div>
          </RadioGroup>
      </div>
      
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
            {state.shakeMode === 'with' && (
                <div>
                    <Label htmlFor="shakeCount" className="md:hidden">ঝাঁকি (বার)</Label>
                    <Label htmlFor="shakeCount" className="hidden md:inline">কত বার ঝাঁকি দিবেন?</Label>
                    <Input id="shakeCount" name="shakeCount" type="number" value={state.shakeCount ?? ''} onChange={handleNumberChange} min="1" />
                </div>
            )}
            <div>
                <Label htmlFor="drops" className="md:hidden">ফোঁটা (পরিমাণ)</Label>
                <Label htmlFor="drops" className="hidden md:inline">কত ফোঁটা করে খাবেন?</Label>
                <Input id="drops" name="drops" type="number" value={state.drops ?? ''} onChange={handleNumberChange} min="1" />
            </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="cupAmount" className="md:hidden">জল</Label>
            <Label htmlFor="cupAmount" className="hidden md:inline">জলের পরিমাণ</Label>
            <Select
                name="cupAmount"
                value={state.cupAmount}
                onValueChange={(value: "one_cup" | "half_cup") => setState({cupAmount: value})}
            >
                <SelectTrigger>
                    <SelectValue placeholder="Select..." />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="one_cup">এক কাপ</SelectItem>
                    <SelectItem value="half_cup">আধা কাপ</SelectItem>
                </SelectContent>
            </Select>
          </div>
           <div>
              <Label htmlFor="intervalMode" className="md:hidden">সময় (অন্তর)</Label>
              <Label htmlFor="intervalMode" className="hidden md:inline">খাওয়ার সময়</Label>
              <Select
                  name="intervalMode"
                  value={state.intervalMode}
                  onValueChange={handleIntervalModeChange}
              >
                  <SelectTrigger>
                      <SelectValue placeholder="Select..."/>
                  </SelectTrigger>
                  <SelectContent>
                      <SelectItem value="hourly">ঘন্টা অন্তর</SelectItem>
                      <SelectItem value="daily">দিন অন্তর</SelectItem>
                      <SelectItem value="meal-time">নির্দিষ্ট সময়</SelectItem>
                  </SelectContent>
              </Select>
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-4">
            <div>
                <Label htmlFor="interval" className="md:hidden">অন্তর (সময়)</Label>
                <Label htmlFor="interval" className="hidden md:inline">কত {state.intervalMode === 'hourly' ? 'ঘন্টা' : 'দিন'} পর পর?</Label>
                <Input id="interval" name="interval" type="number" value={state.interval ?? ''} onChange={handleNumberChange} min="1" disabled={state.intervalMode === 'meal-time'} />
            </div>
            <div>
                <Label htmlFor="mealTime" className="md:hidden">নির্দিষ্ট সময় (ঐচ্ছিক)</Label>
                <Label htmlFor="mealTime" className="hidden md:inline">নির্দিষ্ট সময় (ঐচ্ছিক)</Label>
                <Select
                    name="mealTime"
                    value={state.mealTime}
                    onValueChange={(value: MealTime) => setState({mealTime: value})}
                >
                    <SelectTrigger>
                        <SelectValue placeholder="নির্বাচন করুন..."/>
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="none">কোনোটিই নয়</SelectItem>
                        <SelectItem value="morning">সকালে</SelectItem>
                        <SelectItem value="noon">দুপুরে</SelectItem>
                        <SelectItem value="afternoon">বিকালে</SelectItem>
                        <SelectItem value="night">রাতে</SelectItem>
                        <SelectItem value="morning-night">সকালে ও রাতে</SelectItem>
                        <SelectItem value="morning-afternoon">সকালে ও বিকালে</SelectItem>
                    </SelectContent>
                </Select>
            </div>
        </div>
        
        <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="mixtureAmount" className="md  :hidden">কিভাবে?</Label>
              <Label htmlFor="mixtureAmount" className="hidden md:inline">কিভাবে খাবেন?</Label>
              <Select
                  name="mixtureAmount"
                  value={state.mixtureAmount}
                  onValueChange={(value) => setState({mixtureAmount: value})}
                  >
                  <SelectTrigger>
                      <SelectValue placeholder="Select..."/>
                  </SelectTrigger>
                  <SelectContent>
                      <SelectItem value="১ চামচ ঔষধ">১ চামচ ঔষধ</SelectItem>
                      <SelectItem value="২ চামচ ঔষধ">২ চামচ ঔষধ</SelectItem>
                      <SelectItem value="৩ চামচ ঔষধ">৩ চামচ ঔষধ</SelectItem>
                      <SelectItem value="সবটুকু ঔষধ">সবটুকু ঔষধ</SelectItem>
                  </SelectContent>
                </Select>
            </div>
            <div>
              <Label htmlFor="durationDays" className="md:hidden">কত দিন?</Label>
              <Label htmlFor="durationDays" className="hidden md:inline">কত দিন খাবেন?</Label>              <Input id="durationDays" name="durationDays" type="number" value={state.durationDays ?? ''} onChange={handleNumberChange} min="1" />
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-4">
            <div>
                <Label htmlFor="labelCount" className="md:hidden">লেবেল (সংখ্যা)</Label>
                <Label htmlFor="labelCount" className="hidden md:inline">কতগুলো লেবেল?</Label>
                <Input 
                    id="labelCount"
                    name="labelCount"
                    type="number"
                    value={state.labelCount ?? ''}
                    onChange={handleLabelCountChange}
                    min="1"
                />
            </div>
             <div>
                <Label htmlFor="followUpDays" className="md:hidden">পুনরায় আসবেন (দিন)</Label>
                <Label htmlFor="followUpDays" className="hidden md:inline">কত দিন পরে আসবেন?</Label>
                <Input id="followUpDays" name="followUpDays" type="number" value={state.followUpDays ?? ''} onChange={handleNumberChange} min="1" />
            </div>
        </div>
      </div>
      
      <Collapsible
        open={isCounselingOpen}
        onOpenChange={setIsCounselingOpen}
        className="space-y-4 pt-4 border-t"
      >
        <CollapsibleTrigger className="flex w-full justify-between items-center text-lg font-semibold">
          <h3>পরামর্শ</h3>
          <ChevronDown className={cn("h-5 w-5 transition-transform", isCounselingOpen && "rotate-180")} />
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-4 data-[state=open]:animate-accordion-down data-[state=closed]:animate-accordion-up">
            <div className="space-y-2">
                <Label>বর্তমান পরামর্শসমূহ:</Label>
                <div className="space-y-1">
                    {state.counseling.map((item: string, index: number) => (
                        <div key={index} className="flex items-center justify-between bg-gray-100 p-2 rounded-md">
                            <span className="text-sm" dangerouslySetInnerHTML={{ __html: item.replace(/<strong>/g, '<strong class="text-red-700">') }}></span>
                            <Button variant="ghost" size="icon" onClick={() => removeCounseling(index)}>
                                <XCircle className="h-4 w-4 text-red-500" />
                            </Button>
                        </div>
                    ))}
                </div>
            </div>
            
            <div className="space-y-2">
                <Label htmlFor="counseling-select">নতুন পরামর্শ যোগ করুন (তালিকা থেকে)</Label>
                <div className="flex gap-2">
                    <Select value={selectedCounseling} onValueChange={setSelectedCounseling}>
                        <SelectTrigger id="counseling-select">
                            <SelectValue placeholder="পরামর্শ নির্বাচন করুন..." />
                        </SelectTrigger>
                        <SelectContent>
                            {predefinedCounseling
                                .filter(item => !state.counseling.some((existing: string) => existing.includes(item.replace(/<[^>]*>/g, ''))))
                                .map((item, index) => (
                                <SelectItem key={index} value={item}>
                                  <div dangerouslySetInnerHTML={{ __html: item.replace(/<strong>/g, '<strong class="text-red-700">') }}></div>
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Button onClick={addCounseling}><PlusCircle className="h-4 w-4 mr-2" /> যোগ করুন</Button>
                </div>
            </div>

            <div className="space-y-2">
                <Label htmlFor="custom-counseling">নতুন পরামর্শ যোগ করুন (কাস্টম)</Label>                 <div className="flex gap-2">
                    <Textarea
                        id="custom-counseling"
                        placeholder="এখানে আপনার পরামর্শ লিখুন..."
                        value={customCounseling}
                        onChange={(e) => setCustomCounseling(e.target.value)}
                        className="min-h-[60px]"
                    />
                    <Button onClick={addCustomCounseling}><PlusCircle className="h-4 w-4 mr-2" /> যোগ করুন</Button>
                </div>
            </div>
        </CollapsibleContent>
       </Collapsible>
    </div>
  );
}

    