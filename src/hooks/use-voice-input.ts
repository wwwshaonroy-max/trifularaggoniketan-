'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useToast } from './use-toast';

export function useVoiceInput() {
  const { toast } = useToast();
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSupported, setIsSupported] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const activeElementRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
  const transcriptRef = useRef<string>('');
  const baseValueRef = useRef<string>('');
  const isListeningRef = useRef<boolean>(false);
  const restartTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const stopRecognition = useCallback(() => {
    if (restartTimeoutRef.current) {
      clearTimeout(restartTimeoutRef.current);
      restartTimeoutRef.current = null;
    }

    if (recognitionRef.current && isListeningRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (error) {
        console.warn('Voice recognition stop warning:', error);
      }
    }
    isListeningRef.current = false;
    setIsListening(false);
    transcriptRef.current = '';
    baseValueRef.current = '';
    activeElementRef.current = null;
  }, []);

  const startRecognition = useCallback(() => {
    const currentActiveElement = document.activeElement;
    if (
      !(
        currentActiveElement instanceof HTMLInputElement ||
        currentActiveElement instanceof HTMLTextAreaElement
      )
    ) {
      toast({
        title: 'ইনপুট ফিল্ড নির্বাচন করুন',
        description:
          'ভয়েস টাইপিং শুরু করার আগে অনুগ্রহ করে একটি লেখার জায়গায় ক্লিক করুন।',
        variant: 'default',
      });
      return;
    }

    if (isListeningRef.current) {
      console.warn('Voice recognition is already active');
      return;
    }

    activeElementRef.current = currentActiveElement;
    baseValueRef.current = currentActiveElement.value || '';
    transcriptRef.current = baseValueRef.current;
    setError(null);

    if (recognitionRef.current) {
      const recognition = recognitionRef.current as SpeechRecognition & {
        abort?: () => void;
      };

      try {
        recognition.abort?.();
      } catch (error) {
        console.warn('Voice recognition abort warning:', error);
      }

      // Add delay to allow abort to process before starting
      restartTimeoutRef.current = setTimeout(() => {
        try {
          recognition.start();
          isListeningRef.current = true;
          setIsListening(true);
        } catch (error) {
          console.warn('Voice recognition start warning:', error);
          
          // Retry once after a delay
          restartTimeoutRef.current = setTimeout(() => {
            try {
              recognition.start();
              isListeningRef.current = true;
              setIsListening(true);
            } catch (secondError) {
              console.error('Second start attempt failed:', secondError);
              setError('ভয়েস রিকগনিশন শুরু করতে সমস্যা হয়েছে।');
              isListeningRef.current = false;
              setIsListening(false);
            }
          }, 100);
        }
      }, 50);
    }
  }, [toast]);

  const toggleRecognition = useCallback(() => {
    if (isListeningRef.current) {
      stopRecognition();
    } else {
      startRecognition();
    }
  }, [startRecognition, stopRecognition]);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      const isInputFocused =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement;

      // Trigger on Alt+Shift (more accessible than Ctrl which conflicts with browser shortcuts)
      if (isInputFocused && event.altKey && event.shiftKey) {
        event.preventDefault();
        toggleRecognition();
      }
    },
    [toggleRecognition],
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const SpeechRecognitionAPI =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;

    if (!SpeechRecognitionAPI) {
      setIsSupported(false);
      return;
    }

    setIsSupported(true);

    const recognition = new SpeechRecognitionAPI() as SpeechRecognition;
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'bn-BD';
    recognition.maxAlternatives = 1;
    recognitionRef.current = recognition;

    recognition.onstart = () => {
      isListeningRef.current = true;
      setIsListening(true);
      setError(null);
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      let errorMessage = 'একটি অজানা ভয়েস টাইপিং ত্রুটি হয়েছে।';
      
      switch (event.error) {
        case 'no-speech':
          errorMessage = 'কোনো কথা শোনা যায়নি। অনুগ্রহ করে আবার চেষ্টা করুন।';
          break;
        case 'audio-capture':
          errorMessage = 'মাইক্রোফোন থেকে অডিও নিতে সমস্যা হচ্ছে।';
          break;
        case 'network':
          errorMessage = 'নেটওয়ার্ক সমস্যার কারণে ভয়েস টাইপিং ব্যর্থ হয়েছে।';
          break;
        case 'not-allowed':
          errorMessage = 'মাইক্রোফোন ব্যবহারের অনুমতি বাতিল করা হয়েছে।';
          break;
        case 'service-not-allowed':
          errorMessage = 'ভয়েস রিকগনিশন সেবা এই ব্রাউজারে উপলব্ধ নয়।';
          break;
      }
      setError(errorMessage);
      isListeningRef.current = false;
      setIsListening(false);
      transcriptRef.current = '';
      baseValueRef.current = '';
      activeElementRef.current = null;
    };

    recognition.onend = () => {
      isListeningRef.current = false;
      setIsListening(false);
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const currentActiveElement = activeElementRef.current || document.activeElement;
      if (
        !(
          currentActiveElement instanceof HTMLInputElement ||
          currentActiveElement instanceof HTMLTextAreaElement
        )
      ) {
        stopRecognition();
        return;
      }

      let accumulatedFinalText = transcriptRef.current || baseValueRef.current || '';
      let currentInterimText = '';

      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const resultText = event.results[i][0].transcript.trim();
        if (!resultText) continue;

        if (event.results[i].isFinal) {
          accumulatedFinalText = accumulatedFinalText.trim();
          accumulatedFinalText = accumulatedFinalText
            ? `${accumulatedFinalText} ${resultText}`
            : resultText;
        } else {
          currentInterimText = resultText;
        }
      }

      transcriptRef.current = accumulatedFinalText.trim();
      
      // Combine accumulated text with interim results
      const valueToApply = currentInterimText
        ? `${accumulatedFinalText.trim()} ${currentInterimText}`.trim()
        : accumulatedFinalText.trim();

      // Only update if value actually changed
      if (currentActiveElement.value !== valueToApply) {
        const isTextArea = currentActiveElement instanceof HTMLTextAreaElement;
        const prototype = isTextArea
          ? window.HTMLTextAreaElement.prototype
          : window.HTMLInputElement.prototype;
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
          prototype,
          'value',
        )?.set;

        if (nativeInputValueSetter) {
          nativeInputValueSetter.call(currentActiveElement, valueToApply);
        } else {
          currentActiveElement.value = valueToApply;
        }

        // Dispatch events for form libraries to detect changes
        currentActiveElement.dispatchEvent(
          new Event('input', { bubbles: true, cancelable: true }),
        );
        currentActiveElement.dispatchEvent(
          new Event('change', { bubbles: true, cancelable: true }),
        );
      }
    };

    const handleStopEvent = () => {
      stopRecognition();
    };

    window.addEventListener('stop-voice-input', handleStopEvent);

    return () => {
      if (restartTimeoutRef.current) {
        clearTimeout(restartTimeoutRef.current);
      }
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (error) {
          console.warn('Voice recognition cleanup warning:', error);
        }
      }
      window.removeEventListener('stop-voice-input', handleStopEvent);
    };
  }, [stopRecognition]);

  return {
    isListening,
    error,
    isSupported,
    start: startRecognition,
    stop: stopRecognition,
    toggle: toggleRecognition,
  };
}
