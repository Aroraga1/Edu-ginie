import { useState, useRef, useCallback } from 'react';

interface UseAudioPlayerOptions {
  onPlayComplete?: () => void;
  onError?: (error: string) => void;
}

export const useAudioPlayer = (options: UseAudioPlayerOptions = {}) => {
  const { onPlayComplete, onError } = options;
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const playAudio = useCallback((audioData: string, format: string = 'webm') => {
    try {
      // Stop any existing audio
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }

      setIsLoading(true);
      setError(null);

      // Create audio element
      const audio = new Audio();
      
      // Convert base64 to blob URL if needed
      if (audioData.startsWith('data:')) {
        audio.src = audioData;
      } else {
        // Assume base64 string without data URI prefix
        try {
          const base64Data = audioData;
          // Decode base64 string
          const binaryString = atob(base64Data);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          const blob = new Blob([bytes], { type: `audio/${format}` });
          audio.src = URL.createObjectURL(blob);
        } catch (err) {
          console.error('Error decoding base64 audio:', err);
          throw new Error('Invalid audio data format');
        }
      }

      audio.onloadstart = () => {
        setIsLoading(true);
      };

      audio.oncanplay = () => {
        setIsLoading(false);
      };

      audio.onplay = () => {
        setIsPlaying(true);
        setIsLoading(false);
      };

      audio.onpause = () => {
        setIsPlaying(false);
      };

      audio.onended = () => {
        setIsPlaying(false);
        if (onPlayComplete) {
          onPlayComplete();
        }
        // Clean up
        if (audio.src.startsWith('blob:')) {
          URL.revokeObjectURL(audio.src);
        }
      };

      audio.onerror = (event) => {
        console.error('Audio playback error:', event);
        const errorMsg = 'Failed to play audio';
        setError(errorMsg);
        setIsPlaying(false);
        setIsLoading(false);
        if (onError) {
          onError(errorMsg);
        }
      };

      audioRef.current = audio;
      audio.play().catch((err) => {
        console.error('Error playing audio:', err);
        setError(err.message || 'Failed to play audio');
        setIsPlaying(false);
        setIsLoading(false);
        if (onError) {
          onError(err.message || 'Failed to play audio');
        }
      });
    } catch (err: any) {
      console.error('Error setting up audio:', err);
      setError(err.message || 'Failed to setup audio');
      setIsPlaying(false);
      setIsLoading(false);
      if (onError) {
        onError(err.message || 'Failed to setup audio');
      }
    }
  }, [onPlayComplete, onError]);

  const stopAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setIsPlaying(false);
    }
  }, []);

  const pauseAudio = useCallback(() => {
    if (audioRef.current && isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    }
  }, [isPlaying]);

  const resumeAudio = useCallback(() => {
    if (audioRef.current && !isPlaying) {
      audioRef.current.play().catch((err) => {
        console.error('Error resuming audio:', err);
        setError(err.message || 'Failed to resume audio');
      });
    }
  }, [isPlaying]);

  return {
    isPlaying,
    isLoading,
    error,
    playAudio,
    stopAudio,
    pauseAudio,
    resumeAudio,
  };
};

