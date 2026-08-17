
import { useState, useEffect, useCallback, useRef } from 'react';
import { Search, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { getPatientsByQuery } from '@/lib/firestoreService';
import type { Patient } from '@/lib/types';

interface PatientSearchProps {
  onPatientSelect: (patient: Patient | null, newQuery?: string) => void;
}

export default function PatientSearch({ onPatientSelect }: PatientSearchProps) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(false);
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleSearch = useCallback(async (currentQuery: string) => {
    if (currentQuery.trim().length < 2) {
      setSuggestions([]);
      setIsPopoverOpen(false);
      return;
    }

    setLoading(true);
    try {
      const results = await getPatientsByQuery(currentQuery);
      setSuggestions(results);
      setIsPopoverOpen(results.length > 0);
    } catch (error) {
      console.error('Error searching patients:', error);
      setSuggestions([]);
      setIsPopoverOpen(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    if (query) {
      searchTimeoutRef.current = setTimeout(() => {
        handleSearch(query);
      }, 300);
    } else {
      setSuggestions([]);
      setIsPopoverOpen(false);
    }

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [query, handleSearch]);

  const handleSelect = (patient: Patient) => {
    setQuery(patient.name);
    onPatientSelect(patient);
    setIsPopoverOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      setIsPopoverOpen(false);
      if (suggestions.length === 0 && query.trim() !== '') {
        onPatientSelect(null, query.trim());
      } else if (suggestions.length > 0) {
        handleSelect(suggestions[0]);
      }
    }
  };

  return (
    <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
      <PopoverTrigger asChild className="w-full">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="নাম বা ক্রমিক নম্বর দিয়ে খুঁজুন..."
            className="pl-10"
            autoComplete="off"
          />
          {loading && (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin" />
          )}
        </div>
      </PopoverTrigger>
      <PopoverContent
        className="w-[--radix-popover-trigger-width] p-0"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <div className="max-h-60 overflow-y-auto">
          {suggestions.length > 0 ? (
            suggestions.map((p) => (
              <div
                key={p.id}
                onClick={() => handleSelect(p)}
                className="p-3 hover:bg-accent cursor-pointer text-sm"
              >
                <div className="flex justify-between items-center">
                  <span className="font-semibold">
                    {p.name}{' '}
                    <span className="text-xs text-muted-foreground font-normal">
                      ({p.diaryNumber || 'N/A'})
                    </span>
                  </span>
                  {p.phone && (
                    <span className="text-xs text-muted-foreground">{p.phone}</span>
                  )}
                </div>
              </div>
            ))
          ) : (
            <div className="p-3 text-center text-sm text-muted-foreground">
              কোনো রোগী পাওয়া যায়নি।
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
