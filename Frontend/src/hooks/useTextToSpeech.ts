import { useState, useRef, useEffect } from 'react';

interface UseTextToSpeechOptions {
  rate?: number;
  pitch?: number;
  volume?: number;
  lang?: string;
  voiceName?: string; // Optional: specific voice name to use
}

export const useTextToSpeech = (options: UseTextToSpeechOptions = {}) => {
  const {
    rate = 1.0,
    pitch = 1.0,
    volume = 1.0,
    lang = 'en-US',
    voiceName,
  } = options;
  
  // Update language and voice when options change
  const langRef = useRef(lang);
  const rateRef = useRef(rate);
  const voiceNameRef = useRef(voiceName);
  
  useEffect(() => {
    langRef.current = lang;
    rateRef.current = rate;
    voiceNameRef.current = voiceName;
  }, [lang, rate, voiceName]);

  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  // Check browser support and load voices
  useEffect(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      setIsSupported(true);
      
      // Load voices when available (some browsers load voices asynchronously)
      const loadVoices = () => {
        if (window.speechSynthesis && typeof window.speechSynthesis.getVoices === 'function') {
          const voices = window.speechSynthesis.getVoices();
          if (voices.length > 0) {
            console.log('Voices loaded:', voices.length);
            setAvailableVoices(voices);
          }
        }
      };
      
      // Try to load voices immediately
      loadVoices();
      
      // Listen for voiceschanged event (fired when voices are loaded)
      if (window.speechSynthesis) {
        window.speechSynthesis.onvoiceschanged = loadVoices;
      }
      
      // Cleanup
      return () => {
        if (window.speechSynthesis) {
          window.speechSynthesis.onvoiceschanged = null;
        }
      };
    }
  }, []);

  const speak = (text: string) => {
    if (!isSupported) {
      console.warn('Text-to-speech is not supported in this browser');
      return;
    }

    if (!text || !text.trim()) {
      console.warn('Cannot speak empty text');
      return;
    }

    // Stop any ongoing speech
    stop();

    // Wait a bit to ensure previous speech is fully stopped
    setTimeout(() => {
      const utterance = new SpeechSynthesisUtterance(text.trim());
      utterance.rate = rateRef.current; // Use dynamic rate
      utterance.pitch = pitch;
      utterance.volume = volume;
      utterance.lang = langRef.current;

      // Select voice - prioritize user-selected voice, then auto-select
      if (window.speechSynthesis && typeof window.speechSynthesis.getVoices === 'function') {
        const voices = window.speechSynthesis.getVoices();
        const selectedLang = langRef.current.toLowerCase();
        const langCode = selectedLang.split('-')[0];
        
        let bestVoice: SpeechSynthesisVoice | null = null;
        
        // Priority 0: Use user-selected voice if specified
        if (voiceNameRef.current) {
          bestVoice = voices.find(voice => voice.name === voiceNameRef.current) || null;
          if (bestVoice) {
            console.log('✅ Using user-selected voice:', bestVoice.name);
          }
        }
        
        // If no user-selected voice, auto-select best voice
        if (!bestVoice) {
          // First: Try to find exact language match (e.g., "hi-IN" matches "hi-in")
          const exactMatchVoices = voices.filter(voice => 
            voice.lang.toLowerCase() === selectedLang ||
            voice.lang.toLowerCase().replace('_', '-') === selectedLang
          );
          
          // Second: Try language code match (e.g., "hi" for "hi-IN")
          const codeMatchVoices = voices.filter(voice => 
            voice.lang.toLowerCase().startsWith(langCode.toLowerCase() + '-') ||
            voice.lang.toLowerCase().startsWith(langCode.toLowerCase() + '_')
          );
          
          // Use exact match if available, otherwise use code match
          const matchingVoices = exactMatchVoices.length > 0 ? exactMatchVoices : codeMatchVoices;
          
          if (matchingVoices.length > 0) {
            // Priority 1: Prefer Google voices (best for Gemini Live feature)
            // Filter out Microsoft voices
            const googleVoices = matchingVoices.filter(voice => {
              const name = voice.name.toLowerCase();
              return (name.includes('google') || name.includes('google us') || name.includes('google uk')) &&
                     !name.includes('microsoft') && !name.includes('zira') && !name.includes('david') &&
                     !name.includes('mark') && !name.includes('helen');
            });
            
            if (googleVoices.length > 0) {
              // Within Google voices, prefer neural/premium/enhanced
              bestVoice = googleVoices.find(voice => {
                const name = voice.name.toLowerCase();
                return name.includes('neural') || name.includes('premium') || 
                       name.includes('enhanced') || name.includes('wavenet');
              }) || googleVoices[0]; // If no premium, take first Google voice
            }
            
            // Priority 2: Prefer other neural/premium voices (but not Microsoft)
            if (!bestVoice) {
              bestVoice = matchingVoices.find(voice => {
                const name = voice.name.toLowerCase();
                return (name.includes('neural') || name.includes('premium') ||
                        name.includes('enhanced') || name.includes('wavenet')) &&
                       !name.includes('microsoft') && !name.includes('zira') &&
                       !name.includes('david') && !name.includes('mark') &&
                       !name.includes('helen');
              }) || null;
            }
            
            // Priority 3: Prefer Amazon/Polly voices (but not Microsoft)
            if (!bestVoice) {
              bestVoice = matchingVoices.find(voice => {
                const name = voice.name.toLowerCase();
                return (name.includes('amazon') || name.includes('polly')) &&
                       !name.includes('microsoft');
              }) || null;
            }
            
            // Priority 4: For Indian languages, prefer native-sounding voices (but not Microsoft)
            if (!bestVoice && selectedLang.includes('-in')) {
              bestVoice = matchingVoices.find(voice => {
                const name = voice.name.toLowerCase();
                return (name.includes('hindi') || name.includes('india') || 
                        name.includes('indian') || name.includes('native')) &&
                       !name.includes('microsoft');
              }) || null;
            }
            
            // Priority 5: Prefer female voices (generally more natural for TTS, but not Microsoft)
            if (!bestVoice) {
              bestVoice = matchingVoices.find(voice => {
                const name = voice.name.toLowerCase();
                return (name.includes('female') || name.includes('woman')) &&
                       !name.includes('male') && !name.includes('man') &&
                       !name.includes('microsoft');
              }) || null;
            }
            
            // Priority 6: Any matching voice (excluding Microsoft as last resort)
            if (!bestVoice) {
              const nonMicrosoftVoices = matchingVoices.filter(voice => {
                const name = voice.name.toLowerCase();
                return !name.includes('microsoft') && !name.includes('zira') &&
                       !name.includes('david') && !name.includes('mark') &&
                       !name.includes('helen');
              });
              bestVoice = nonMicrosoftVoices.length > 0 ? nonMicrosoftVoices[0] : matchingVoices[0] || null;
            }
          } else {
            // No matching voices found - log warning but don't fail
            console.warn('⚠️ No matching voices found for language:', langRef.current);
            // Still try to use any available voice for the language code
            const fallbackVoices = voices.filter(voice => {
              const voiceLang = voice.lang.toLowerCase();
              return voiceLang.startsWith(langCode.toLowerCase() + '-') ||
                     voiceLang.startsWith(langCode.toLowerCase() + '_') ||
                     voiceLang === langCode.toLowerCase();
            });
            if (fallbackVoices.length > 0) {
              bestVoice = fallbackVoices[0];
              console.log('Using fallback voice:', bestVoice.name);
            }
          }
        }
        
        if (bestVoice) {
          utterance.voice = bestVoice;
          utterance.lang = langRef.current;
          console.log('✅ Selected voice:', bestVoice.name, 'for language:', langRef.current, 'at rate:', rateRef.current);
        } else {
          // Even if no voice found, still try to speak - browser will use default
          console.warn('⚠️ No matching voice found for language:', langRef.current, '- using browser default');
          // Set language so browser can try to find a default voice
          utterance.lang = langRef.current;
        }
      }

      utterance.onstart = () => {
        setIsSpeaking(true);
        console.log('Speech started:', text.substring(0, 50) + (text.length > 50 ? '...' : ''));
      };

      utterance.onend = () => {
        setIsSpeaking(false);
        console.log('Speech ended');
      };

      utterance.onerror = (event) => {
        console.error('Speech synthesis error:', event);
        setIsSpeaking(false);
      };

      utteranceRef.current = utterance;
      
      try {
        window.speechSynthesis.speak(utterance);
        console.log('Speech synthesis initiated for language:', langRef.current);
      } catch (err) {
        console.error('Error starting speech synthesis:', err);
        setIsSpeaking(false);
      }
    }, 50);
  };

  const stop = () => {
    if (isSupported && window.speechSynthesis) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }
  };

  const pause = () => {
    if (isSupported && window.speechSynthesis) {
      window.speechSynthesis.pause();
      setIsSpeaking(false);
    }
  };

  const resume = () => {
    if (isSupported && window.speechSynthesis) {
      window.speechSynthesis.resume();
      setIsSpeaking(true);
    }
  };

  return {
    speak,
    stop,
    pause,
    resume,
    isSpeaking,
    isSupported,
    availableVoices, // Expose available voices for selection
  };
};

