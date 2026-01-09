import { useState, useRef, useCallback, useEffect } from "react";

interface UseAudioRecorderOptions {
  onRecordingComplete?: (audioBlob: Blob) => void;
  onSilenceDetected?: (audioBlob: Blob) => void;
  mimeType?: string;
  silenceThreshold?: number; // Silence duration in ms before auto-sending
  minRecordingDuration?: number; // Minimum recording duration before auto-send
}

export const useAudioRecorder = (options: UseAudioRecorderOptions = {}) => {
  const {
    onRecordingComplete,
    onSilenceDetected,
    mimeType = "audio/webm",
    silenceThreshold = 2000, // 2 seconds of silence
    minRecordingDuration = 500, // Minimum 0.5 seconds before auto-send
  } = options;

  const [isRecording, setIsRecording] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [audioLevel, setAudioLevel] = useState(0); // For visual feedback

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastSoundTimeRef = useRef<number>(0);
  const recordingStartTimeRef = useRef<number>(0);
  const animationFrameRef = useRef<number | null>(null);

  // Check browser support
  const checkSupport = useCallback(() => {
    if (typeof window === "undefined") return false;

    const hasMediaRecorder = typeof MediaRecorder !== "undefined";
    const hasGetUserMedia =
      navigator.mediaDevices?.getUserMedia !== undefined ||
      (navigator as any).webkitGetUserMedia !== undefined ||
      (navigator as any).mozGetUserMedia !== undefined;

    return hasMediaRecorder && hasGetUserMedia;
  }, []);

  // Initialize support check
  useState(() => {
    setIsSupported(checkSupport());
  });

  // Audio level monitoring for silence detection
  const monitorAudioLevel = useCallback(() => {
    if (!analyserRef.current || !isRecording) return;

    const analyser = analyserRef.current;
    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(dataArray);

    // Calculate average audio level
    const average =
      dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length;
    const normalizedLevel = Math.min(average / 255, 1);
    setAudioLevel(normalizedLevel);

    // Check for silence
    const now = Date.now();
    const hasSound = normalizedLevel > 0.01; // Threshold for detecting sound

    if (hasSound) {
      lastSoundTimeRef.current = now;
      // Clear silence timer if sound detected
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = null;
      }
    } else {
      // No sound detected
      const silenceDuration = now - lastSoundTimeRef.current;
      const recordingDuration = now - recordingStartTimeRef.current;

      // If silence detected and minimum recording duration passed
      if (
        silenceDuration >= silenceThreshold &&
        recordingDuration >= minRecordingDuration
      ) {
        if (!silenceTimerRef.current) {
        // Gemini Live-style: Auto-send when silence detected
        // Set timer to trigger auto-send after silence threshold
        silenceTimerRef.current = setTimeout(() => {
          if (onSilenceDetected && mediaRecorderRef.current && isRecording) {
            console.log("🔇 Silence detected - auto-sending (Gemini Live style)");
            // Stop recording and send automatically
            mediaRecorderRef.current.stop();
          }
        }, 200); // Reduced delay for faster response (Gemini Live is very responsive)
        }
      }
    }

    // Continue monitoring
    if (isRecording) {
      animationFrameRef.current = requestAnimationFrame(monitorAudioLevel);
    }
  }, [isRecording, silenceThreshold, minRecordingDuration, onSilenceDetected]);

  const startRecording = useCallback(async () => {
    if (!isSupported) {
      setError("Audio recording is not supported in this browser");
      return false;
    }

    try {
      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      streamRef.current = stream;
      audioChunksRef.current = [];
      recordingStartTimeRef.current = Date.now();
      lastSoundTimeRef.current = Date.now();

      // Create AudioContext for audio level monitoring
      const audioContext = new (window.AudioContext ||
        (window as any).webkitAudioContext)();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);

      audioContextRef.current = audioContext;
      analyserRef.current = analyser;

      // Create MediaRecorder
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: mimeType,
      });

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const finalRecordingDuration =
          Date.now() - recordingStartTimeRef.current;
        const finalAudioBlob = new Blob(audioChunksRef.current, {
          type: mimeType,
        });

        // Stop all tracks
        stream.getTracks().forEach((track) => track.stop());

        // Close audio context
        if (audioContextRef.current) {
          audioContextRef.current.close();
          audioContextRef.current = null;
        }

        // Stop animation frame
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
          animationFrameRef.current = null;
        }

        // Clear silence timer
        if (silenceTimerRef.current) {
          clearTimeout(silenceTimerRef.current);
          silenceTimerRef.current = null;
        }

        // Check if this was triggered by silence detection or manual stop
        const wasSilenceDetected =
          finalAudioBlob.size > 0 &&
          finalRecordingDuration >= minRecordingDuration;

        // Always call callback if we have audio data (either silence detected or manual stop)
        if (finalAudioBlob.size > 0) {
          if (wasSilenceDetected && onSilenceDetected) {
            onSilenceDetected(finalAudioBlob);
          } else if (onRecordingComplete) {
            // Manual stop - still process the audio
            onRecordingComplete(finalAudioBlob);
          }
        }

        // Clear chunks
        audioChunksRef.current = [];
        setAudioLevel(0);
      };

      mediaRecorder.onerror = (event: any) => {
        console.error("MediaRecorder error:", event);
        setError("Error recording audio");
        setIsRecording(false);
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start(100); // Collect data every 100ms
      setIsRecording(true);
      setError(null);

      // Start monitoring audio levels
      monitorAudioLevel();

      return true;
    } catch (err: any) {
      console.error("Error starting recording:", err);
      setError(err.message || "Failed to start recording");
      setIsRecording(false);
      return false;
    }
  }, [isSupported, mimeType, onRecordingComplete, monitorAudioLevel]);

  const stopRecording = useCallback(() => {
    // Clear silence timer
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }

    // Stop animation frame
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }

    // Stop stream if still active
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    // Close audio context
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    setAudioLevel(0);
  }, [isRecording]);

  const cancelRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }

    // Stop stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    // Clear chunks
    audioChunksRef.current = [];
  }, [isRecording]);

  return {
    isRecording,
    isSupported,
    error,
    audioLevel, // Audio level for visual feedback (0-1)
    startRecording,
    stopRecording,
    cancelRecording,
  };
};
