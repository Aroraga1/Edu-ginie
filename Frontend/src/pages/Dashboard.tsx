import React, { useState, useEffect, useRef, useCallback } from "react";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Presentation,
  Languages,
  Mic,
  GitBranch,
  PlusCircle,
  Upload,
  User,
  Send,
  Sparkles,
  Brain,
  Loader2,
  BookOpen,
  Eye,
  X,
  FileText,
  Square,
  Radio,
} from "lucide-react";
import { useVoice } from "@/hooks/useVoice";
import { useTextToSpeech } from "@/hooks/useTextToSpeech";
import { useAudioRecorder } from "@/hooks/useAudioRecorder";
import { useAudioPlayer } from "@/hooks/useAudioPlayer";
import {
  getClassroomById,
  getUserClassrooms,
  sendChatMessage,
  sendVoiceAudio,
  getChatHistory,
  getPDFs,
  generatePPT,
  trackDailyVisit,
  getClassroomProgress,
} from "@/lib/api";
import VisualPPTViewer from "@/components/VisualPPTViewer";
import { HomeButton } from "@/components/HomeButton";
import {
  SUPPORTED_LANGUAGES,
  getSpeechRecognitionCode,
  getLanguageByCode,
  getDefaultLanguage,
} from "@/constants/languages";

const Dashboard = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [allClassrooms, setAllClassrooms] = useState<
    Array<{
      id: string;
      name: string;
      subject: string;
      description?: string;
      progress: number;
      members: number;
    }>
  >([]);
  const [currentClassroom, setCurrentClassroom] = useState<{
    id: string;
    name: string;
    subject: string;
    description?: string;
    progress: number;
    members: number;
  } | null>(null);
  const [classroomProgress, setClassroomProgress] = useState<{
    progress: number;
    conversation_score: number;
    exam_score: number;
    details: {
      total_messages: number;
      total_exams: number;
      average_exam_score: number;
      engagement_level: string;
    };
  } | null>(null);
  const [isLoadingClassroom, setIsLoadingClassroom] = useState(true);
  const [conversation, setConversation] = useState<
    Array<{
      type: "user" | "ai" | "system";
      content: string;
      timestamp: string;
      ppt?: {
        title: string;
        theme?: string;
        color_scheme?: {
          primary: string;
          secondary: string;
          accent: string;
          background: string;
          text: string;
        };
        slides: Array<{
          slide_number: number;
          title: string;
          content: string[];
          layout?: string;
          visual_elements?: {
            image_type?: string;
            image_description?: string;
            colors?: string[];
            icons?: string[];
          };
          animation?: string;
          visual_suggestion?: string;
        }>;
      };
    }>
  >([]);
  const [isPPTMode, setIsPPTMode] = useState(false);
  const [isVoiceMode, setIsVoiceMode] = useState(false);
  const [voiceTranscript, setVoiceTranscript] = useState("");
  const [selectedLanguage, setSelectedLanguage] = useState<string>("en-US");
  const [documents, setDocuments] = useState<
    Array<{
      id: string;
      filename: string;
      topic: string;
      subject: string;
      summary: string;
      timestamp: string | null;
    }>
  >([]);
  const [selectedDocument, setSelectedDocument] = useState<{
    id: string;
    filename: string;
    topic: string;
    subject: string;
    summary: string;
  } | null>(null);
  const [isLoadingDocuments, setIsLoadingDocuments] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const isLoadingProgressRef = useRef(false);

  // Load selected language from localStorage or use default
  useEffect(() => {
    const savedLanguage = localStorage.getItem("selectedLanguage");
    if (savedLanguage) {
      setSelectedLanguage(savedLanguage);
    } else {
      setSelectedLanguage("en-US");
    }
  }, []);

  // Save language preference
  useEffect(() => {
    if (selectedLanguage) {
      localStorage.setItem("selectedLanguage", selectedLanguage);
    }
  }, [selectedLanguage]);

  // Get current language info
  const currentLanguage =
    getLanguageByCode(selectedLanguage) || getDefaultLanguage();

  // Text-to-speech hook (declared early for use in handlers)
  const {
    speak,
    stop: stopSpeaking,
    isSpeaking,
  } = useTextToSpeech({
    rate: 1.0,
    pitch: 1.0,
    volume: 1.0,
    lang: selectedLanguage,
  });

  // Audio player for Gemini's voice responses (declared first)
  const {
    isPlaying: isPlayingAudio,
    isLoading: isLoadingAudio,
    error: audioPlaybackError,
    playAudio: playAudioResponse,
    stopAudio: stopAudioResponse,
  } = useAudioPlayer({
    onError: (error) => {
      console.error("Audio playback error:", error);
    },
  });

  // Audio recorder for continuous voice-to-voice conversation
  // Use refs to avoid circular dependencies
  const recorderRefs = useRef<{
    startRecording: (() => Promise<boolean>) | null;
    isRecording: boolean;
    isVoiceMode: boolean;
    isLoading: boolean;
  }>({
    startRecording: null,
    isRecording: false,
    isVoiceMode: false,
    isLoading: false,
  });

  // Handler for processing audio from voice-to-voice mode (will be set after recorder)
  const handleVoiceAudioRef = useRef<
    ((audioBlob: Blob) => Promise<void>) | null
  >(null);

  const {
    isRecording,
    isSupported: isAudioRecordingSupported,
    error: audioRecordingError,
    audioLevel,
    startRecording,
    stopRecording,
    cancelRecording,
  } = useAudioRecorder({
    onSilenceDetected: (audioBlob) => {
      if (handleVoiceAudioRef.current) {
        handleVoiceAudioRef.current(audioBlob);
      }
    },
    onRecordingComplete: (audioBlob) => {
      if (handleVoiceAudioRef.current) {
        handleVoiceAudioRef.current(audioBlob);
      }
    },
    mimeType: "audio/webm",
    silenceThreshold: 2000, // 2 seconds of silence
    minRecordingDuration: 500, // Minimum 0.5 seconds
  });

  // Update recorder refs
  useEffect(() => {
    recorderRefs.current.startRecording = startRecording;
    recorderRefs.current.isRecording = isRecording;
    recorderRefs.current.isVoiceMode = isVoiceMode;
    recorderRefs.current.isLoading = isLoading;
  }, [startRecording, isRecording, isVoiceMode, isLoading]);

  // Handler for processing audio from voice-to-voice mode
  const handleVoiceAudio = useCallback(
    async (audioBlob: Blob) => {
      // Prevent multiple simultaneous calls
      if (isLoading) {
        console.log("Already processing voice, skipping...");
        return;
      }

      // Validate audio blob
      if (!audioBlob || audioBlob.size === 0) {
        console.error("Invalid or empty audio blob");
        return;
      }

      console.log("Processing voice audio, blob size:", audioBlob.size);
      setIsLoading(true);
      const topic = currentClassroom?.name || undefined;
      const classroomId = currentClassroom?.id || undefined;

      try {
        // Send audio to backend for Gemini voice-to-voice processing
        console.log("Sending voice audio to backend...");
        const response = await sendVoiceAudio(
          audioBlob,
          selectedLanguage,
          topic,
          classroomId
        );

        console.log("Voice response received:", response);

        if (response?.success) {
          // Add user voice message placeholder
          setConversation((prev) => [
            ...prev,
            {
              type: "user",
              content: "🎤 Voice message",
              timestamp: new Date().toLocaleTimeString(),
            },
          ]);

          const textResponse = response.text || "Voice response received";
          const audioResponse = response.audio_data;

          console.log("Text response:", textResponse);
          console.log("Audio response available:", !!audioResponse);
          console.log("Response format:", response.format);

          // Add AI response to conversation
          setConversation((prev) => [
            ...prev,
            {
              type: "ai",
              content: textResponse,
              timestamp: new Date().toLocaleTimeString(),
            },
          ]);

          // Play audio response if available (Gemini's native voice)
          if (audioResponse && response.format !== "text") {
            console.log("Playing audio response...");
            stopSpeaking(); // Stop any TTS
            stopAudioResponse(); // Stop any previous audio

            // Convert base64 to data URL if needed
            let audioToPlay = audioResponse;
            if (typeof audioResponse === "string") {
              if (!audioResponse.startsWith("data:")) {
                // Base64 string without data URI, add prefix
                audioToPlay = `data:audio/${
                  response.format || "webm"
                };base64,${audioResponse}`;
              }
            }

            // Play audio response
            try {
              playAudioResponse(audioToPlay, response.format || "webm");
            } catch (playError) {
              console.error("Error playing audio:", playError);
              // Fallback to TTS if audio playback fails
              stopSpeaking();
              setTimeout(() => {
                speak(textResponse);
              }, 100);
            }
          } else {
            // Fallback to TTS if no audio response
            console.log("No audio response, using TTS fallback");
            stopSpeaking();
            stopAudioResponse();
            setTimeout(() => {
              speak(textResponse);
            }, 100);
          }
        } else {
          const errorMsg = response?.error || "Failed to process voice";
          console.error("Voice processing failed:", errorMsg);
          throw new Error(errorMsg);
        }
      } catch (error: unknown) {
        const err = error as {
          response?: { data?: { error?: string } };
          message?: string;
        };
        console.error("Voice audio error:", error);
      } finally {
        setIsLoading(false);
      }
    },
    [
      isLoading,
      currentClassroom,
      selectedLanguage,
      stopSpeaking,
      speak,
      playAudioResponse,
      stopAudioResponse,
    ]
  );

  // Update handler ref
  handleVoiceAudioRef.current = handleVoiceAudio;

  // Update audio player callback to auto-restart recording
  useEffect(() => {
    // This will be handled via the callback in handleVoiceAudio using refs
  }, [isVoiceMode, isRecording, isLoading]);

  // Voice message handler (fallback for text-based voice mode)
  const handleVoiceMessage = async (text: string) => {
    if (!text.trim() || isLoading) return;

    const userMessage = text.trim();
    setIsLoading(true);
    setVoiceTranscript(""); // Clear transcript after sending

    // Add user message to conversation
    setConversation((prev) => [
      ...prev,
      {
        type: "user",
        content: userMessage,
        timestamp: new Date().toLocaleTimeString(),
      },
    ]);

    const topic = currentClassroom?.name || undefined;
    const classroomId = currentClassroom?.id || undefined;

    try {
      const response = await sendChatMessage(
        userMessage,
        topic,
        selectedLanguage,
        classroomId,
        isVoiceMode // Pass voice mode flag
      );

      if (response?.success && response?.response) {
        const aiResponse = response.response;

        // Add AI response to conversation
        setConversation((prev) => [
          ...prev,
          {
            type: "ai",
            content: aiResponse,
            timestamp: new Date().toLocaleTimeString(),
          },
        ]);

        // Speak the AI response with voice-optimized settings
        // Stop any current speech before starting new one
        stopSpeaking();
        // Small delay to ensure previous speech is stopped
        setTimeout(() => {
          speak(aiResponse);
        }, 100);
      } else {
        throw new Error(response?.error || "Failed to get response");
      }
    } catch (error: unknown) {
      const err = error as {
        response?: { data?: { error?: string } };
        message?: string;
      };
      console.error("Voice chat error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Voice recognition hook
  const speechRecognitionCode = getSpeechRecognitionCode(selectedLanguage);
  const {
    isListening,
    transcript,
    isSupported: isVoiceSupported,
    error: voiceError,
    startListening,
    stopListening,
    toggleListening,
  } = useVoice({
    onFinalTranscript: (text) => {
      if (text.trim() && isVoiceMode) {
        setVoiceTranscript(text);
        // Auto-send message when final transcript is received
        handleVoiceMessage(text);
      }
    },
    continuous: true,
    interimResults: true,
    lang: speechRecognitionCode,
  });

  // Update transcript display
  useEffect(() => {
    if (transcript && isVoiceMode) {
      setVoiceTranscript(transcript);
    }
  }, [transcript, isVoiceMode]);

  // Cleanup voice on unmount
  useEffect(() => {
    return () => {
      if (isListening) {
        stopListening();
      }
      stopSpeaking();
    };
  }, [isListening, stopListening, stopSpeaking]);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversation]);

  // Track daily visit when Dashboard loads
  useEffect(() => {
    const trackVisit = async () => {
      try {
        await trackDailyVisit();
      } catch (error) {
        // Silently fail - don't interrupt user experience
        console.log("Visit tracking failed (non-critical):", error);
      }
    };
    trackVisit();
  }, []);

  // Load all classrooms
  useEffect(() => {
    const loadClassrooms = async () => {
      try {
        const response = await getUserClassrooms();
        if (response?.success && response?.classrooms) {
          setAllClassrooms(response.classrooms);
        }
      } catch (error) {
        console.error("Error loading classrooms:", error);
      }
    };
    loadClassrooms();
  }, []);

  // Load documents - use classroom ID to prevent infinite loops
  useEffect(() => {
    const loadDocuments = async () => {
      setIsLoadingDocuments(true);
      try {
        const topic = currentClassroom?.name || undefined;
        const response = await getPDFs(topic);
        if (response?.pdfs) {
          setDocuments(response.pdfs);
        }
      } catch (error) {
        console.error("Error loading documents:", error);
      } finally {
        setIsLoadingDocuments(false);
      }
    };
    loadDocuments();
  }, [currentClassroom?.id, currentClassroom?.name]); // Only depend on ID and name, not the whole object

  // Load chat history and progress when classroom changes
  useEffect(() => {
    const loadChatHistory = async () => {
      // Prevent concurrent loading
      if (isLoadingProgressRef.current) return;
      try {
        const classroomId = currentClassroom?.id || undefined;
        const topic = currentClassroom?.name || undefined;

        // Load classroom progress first
        if (classroomId) {
          isLoadingProgressRef.current = true;
          try {
            const progressResponse = await getClassroomProgress(classroomId);
            if (progressResponse?.success && progressResponse?.progress) {
              const progressData = progressResponse.progress;
              const calculatedProgress =
                typeof progressData.progress === "number"
                  ? progressData.progress
                  : progressData.progress || 0;

              // Always update classroomProgress with the latest calculated value
              setClassroomProgress({
                ...progressData,
                progress: Math.min(100, Math.max(0, calculatedProgress)),
              });

              // Always update currentClassroom progress to ensure it's displayed
              setCurrentClassroom((prev) => {
                if (prev && prev.id === classroomId) {
                  return {
                    ...prev,
                    progress: Math.min(100, Math.max(0, calculatedProgress)),
                  };
                }
                return prev;
              });
            } else {
              // If progress calculation failed, try to use stored progress or default to 0
              setClassroomProgress(null);
              setCurrentClassroom((prev) => {
                if (prev && prev.id === classroomId) {
                  // Keep existing progress if available, otherwise set to 0
                  const existingProgress =
                    typeof prev.progress === "number" ? prev.progress : 0;
                  return {
                    ...prev,
                    progress: existingProgress,
                  };
                }
                return prev;
              });
            }
          } catch (error) {
            console.error("Error loading classroom progress:", error);
            // On error, keep existing progress
            setClassroomProgress(null);
          } finally {
            isLoadingProgressRef.current = false;
          }
        } else {
          setClassroomProgress(null);
        }

        const response = await getChatHistory(classroomId, topic);
        if (response?.chats && Array.isArray(response.chats)) {
          const formattedChats = response.chats.map(
            (chat: {
              role: string;
              message?: string;
              timestamp?: string;
              ppt?: {
                title?: string;
                theme?: string;
                color_scheme?: Record<string, string>;
                slides?: Array<Record<string, unknown>>;
              };
            }) => ({
              type: chat.role === "user" ? "user" : "ai",
              content: chat.message || "",
              timestamp: chat.timestamp
                ? new Date(chat.timestamp).toLocaleTimeString()
                : new Date().toLocaleTimeString(),
              // Include PPT data if present
              ppt: chat.ppt || undefined,
            })
          );
          if (formattedChats.length > 0) {
            setConversation(formattedChats);
          } else {
            const welcomeMessage = currentClassroom
              ? `Hello! I'm your AI tutor for "${currentClassroom.name}". I'm here to help you learn and understand this topic. What would you like to explore today?`
              : "Hello! I'm your AI tutor. I'm here to help you learn and understand any topic. What would you like to explore today?";
            setConversation([
              {
                type: "ai",
                content: welcomeMessage,
                timestamp: new Date().toLocaleTimeString(),
              },
            ]);
          }
        }
      } catch (error) {
        console.error("Error loading chat history:", error);
        const welcomeMessage = currentClassroom
          ? `Hello! I'm your AI tutor for "${currentClassroom.name}". I'm here to help you learn and understand this topic. What would you like to explore today?`
          : "Hello! I'm your AI tutor. I'm here to help you learn and understand any topic. What would you like to explore today?";
        setConversation([
          {
            type: "ai",
            content: welcomeMessage,
            timestamp: new Date().toLocaleTimeString(),
          },
        ]);
      }
    };

    loadChatHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentClassroom?.id]); // Only depend on ID to prevent loops

  const features = [
    {
      icon: Presentation,
      label: "PPT",
      color: "text-blue-500",
    },
    {
      icon: Languages,
      label: "Language",
      color: "text-green-500",
    },
    {
      icon: Mic,
      label: "Voice",
      color: "text-purple-500",
    },
    {
      icon: GitBranch,
      label: "Flowchart",
      color: "text-orange-500",
    },
  ];

  const handleFeatureClick = async (feature: string) => {
    if (feature === "PPT") {
      setIsPPTMode(!isPPTMode);
    } else if (feature === "Voice") {
      // Check for audio recording support (preferred for Gemini voice-to-voice)
      if (!isAudioRecordingSupported && !isVoiceSupported) {
        return;
      }
      setIsVoiceMode(!isVoiceMode);
      if (!isVoiceMode) {
        // Stop any ongoing speech/audio when starting voice mode
        stopSpeaking();
        stopAudioResponse();

        // Use audio recording if supported (for Gemini voice-to-voice)
        if (isAudioRecordingSupported) {
          const started = await startRecording();
          if (!started) {
            setIsVoiceMode(false);
          }
        } else if (isVoiceSupported) {
          // Fallback to text-based voice mode
          startListening();
        }
      } else {
        // Stop voice mode
        if (isRecording) {
          stopRecording();
        }
        if (isListening) {
          stopListening();
        }
        stopSpeaking();
        stopAudioResponse();
      }
    }
  };

  const handleClassroomChange = (classroomId: string) => {
    if (classroomId === "none") {
      setCurrentClassroom(null);
      setSearchParams({});
      return;
    }
    const classroom = allClassrooms.find((c) => c.id === classroomId);
    if (classroom) {
      // Ensure progress is always a number
      setCurrentClassroom({
        ...classroom,
        progress:
          typeof classroom.progress === "number"
            ? Math.min(100, Math.max(0, classroom.progress))
            : 0,
      });
      setSearchParams({ classroom: classroomId });
    }
  };

  const handleSendMessage = async () => {
    if (!message.trim() || isLoading) return;

    const userMessage = message.trim();
    setIsLoading(true);

    setConversation((prev) => [
      ...prev,
      {
        type: "user",
        content: userMessage,
        timestamp: new Date().toLocaleTimeString(),
      },
    ]);

    const messageToSend = userMessage;
    setMessage("");
    const topic = currentClassroom?.name || undefined;

    try {
      // If PPT mode is active, generate PPT instead of regular chat
      if (isPPTMode) {
        setIsPPTMode(false); // Reset PPT mode after use
        const classroomId = currentClassroom?.id || undefined;
        const response = await generatePPT(messageToSend, topic, classroomId);

        if (response?.success && response?.ppt) {
          setConversation((prev) => [
            ...prev,
            {
              type: "ai",
              content: response.message || "PPT generated successfully",
              timestamp: new Date().toLocaleTimeString(),
              ppt: response.ppt,
            },
          ]);

          // Refresh classroom progress after PPT generation
          if (currentClassroom?.id && !isLoadingProgressRef.current) {
            isLoadingProgressRef.current = true;
            try {
              const progressResponse = await getClassroomProgress(
                currentClassroom.id
              );
              if (progressResponse?.success && progressResponse?.progress) {
                const progressData = progressResponse.progress;
                const calculatedProgress =
                  typeof progressData.progress === "number"
                    ? progressData.progress
                    : progressData.progress || 0;

                // Always update classroomProgress with the latest calculated value
                setClassroomProgress({
                  ...progressData,
                  progress: Math.min(100, Math.max(0, calculatedProgress)),
                });

                // Always update currentClassroom progress
                setCurrentClassroom((prev) => {
                  if (prev) {
                    return {
                      ...prev,
                      progress: Math.min(100, Math.max(0, calculatedProgress)),
                    };
                  }
                  return prev;
                });
              }
            } catch (error) {
              console.log("Error refreshing progress (non-critical):", error);
            } finally {
              isLoadingProgressRef.current = false;
            }
          }
        } else {
          throw new Error(response?.error || "Failed to generate PPT");
        }
      } else {
        // Regular chat mode
        const classroomId = currentClassroom?.id || undefined;
        const response = await sendChatMessage(
          messageToSend,
          topic,
          selectedLanguage,
          classroomId,
          isVoiceMode // Pass voice mode flag
        );

        if (response?.success && response?.response) {
          const aiResponse = response.response;

          setConversation((prev) => [
            ...prev,
            {
              type: "ai",
              content: aiResponse,
              timestamp: new Date().toLocaleTimeString(),
            },
          ]);

          // If voice mode is active, speak the response with TTS
          if (isVoiceMode) {
            stopSpeaking();
            stopAudioResponse(); // Stop any ongoing audio
            setTimeout(() => {
              speak(aiResponse);
            }, 100);
          }

          // Refresh classroom progress after receiving AI response
          if (currentClassroom?.id && !isLoadingProgressRef.current) {
            isLoadingProgressRef.current = true;
            try {
              const progressResponse = await getClassroomProgress(
                currentClassroom.id
              );
              if (progressResponse?.success && progressResponse?.progress) {
                const progressData = progressResponse.progress;
                const calculatedProgress =
                  typeof progressData.progress === "number"
                    ? progressData.progress
                    : progressData.progress || 0;

                // Always update classroomProgress with the latest calculated value
                setClassroomProgress({
                  ...progressData,
                  progress: Math.min(100, Math.max(0, calculatedProgress)),
                });

                // Always update currentClassroom progress
                setCurrentClassroom((prev) => {
                  if (prev) {
                    return {
                      ...prev,
                      progress: Math.min(100, Math.max(0, calculatedProgress)),
                    };
                  }
                  return prev;
                });
              }
            } catch (error) {
              console.log("Error refreshing progress (non-critical):", error);
            } finally {
              isLoadingProgressRef.current = false;
            }
          }
        } else {
          throw new Error(response?.error || "Failed to get response");
        }
      }
    } catch (error: unknown) {
      const err = error as {
        response?: { data?: { error?: string } };
        message?: string;
      };
      console.error("Chat error:", error);
      setConversation((prev) => prev.slice(0, -1));
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Load classroom data from URL params
  useEffect(() => {
    const loadClassroom = async () => {
      const classroomId = searchParams.get("classroom");

      if (!classroomId) {
        setIsLoadingClassroom(false);
        return;
      }

      setIsLoadingClassroom(true);
      try {
        const result = await getClassroomById(classroomId);
        if (result.success && result.classroom) {
          // Ensure progress is always a number
          setCurrentClassroom({
            ...result.classroom,
            progress:
              typeof result.classroom.progress === "number"
                ? Math.min(100, Math.max(0, result.classroom.progress))
                : 0,
          });
        } else {
          const classroomsResponse = await getUserClassrooms();
          if (classroomsResponse?.success && classroomsResponse?.classrooms) {
            const classroom = classroomsResponse.classrooms.find(
              (c: { id: string }) => c.id === classroomId
            );
            if (classroom) {
              // Ensure progress is always a number
              setCurrentClassroom({
                ...classroom,
                progress:
                  typeof classroom.progress === "number"
                    ? Math.min(100, Math.max(0, classroom.progress))
                    : 0,
              });
            }
          }
        }
      } catch (error) {
        console.error("Error loading classroom:", error);
      } finally {
        setIsLoadingClassroom(false);
      }
    };

    loadClassroom();
  }, [searchParams]);

  return (
    <div className="h-screen bg-gradient-hero flex overflow-hidden">
      {/* Left Sidebar - Compressed */}
      <div className="w-64 bg-gradient-card border-r border-border glow-card flex flex-col">
        <div className="p-4 flex-shrink-0">
          <div className="flex items-center mb-6">
            <HomeButton
              variant="ghost"
              size="sm"
              showText={false}
              className="mr-2"
            />
            <h2 className="text-xl font-bold text-gradient">Edu Ginie</h2>
          </div>

          {/* Navigation Menu */}
          <nav className="space-y-1">
            <Link to="/exams">
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start hover:bg-primary/10 hover:text-primary text-sm"
              >
                <PlusCircle className="mr-2 h-3 w-3" />
                Create Exams
              </Button>
            </Link>
            <Link to="/media">
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start hover:bg-primary/10 hover:text-primary text-sm"
              >
                <Upload className="mr-2 h-3 w-3" />
                Upload Media
              </Button>
            </Link>
            <Link to="/profile">
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start hover:bg-primary/10 hover:text-primary text-sm"
              >
                <User className="mr-2 h-3 w-3" />
                Profile
              </Button>
            </Link>
          </nav>
        </div>

        {/* Classroom Selector */}
        <div className="px-4 pb-4 flex-shrink-0 border-t border-border pt-4">
          <h3 className="text-xs font-semibold mb-2 text-muted-foreground uppercase tracking-wide">
            Select Classroom
          </h3>
          <Select
            value={currentClassroom?.id || "none"}
            onValueChange={handleClassroomChange}
          >
            <SelectTrigger className="w-full bg-background/50 text-sm">
              <SelectValue placeholder="Choose classroom" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No Classroom</SelectItem>
              {allClassrooms.map((classroom: { id: string; name: string }) => (
                <SelectItem key={classroom.id} value={classroom.id}>
                  {classroom.name}
                </SelectItem>
              ))}
              {allClassrooms.length === 0 && (
                <SelectItem value="create" disabled>
                  No classrooms yet
                </SelectItem>
              )}
            </SelectContent>
          </Select>
          {allClassrooms.length === 0 && (
            <Link to="/create-classroom" className="mt-2 block">
              <Button variant="outline" size="sm" className="w-full text-xs">
                Create Classroom
              </Button>
            </Link>
          )}
        </div>

        {/* Current Classroom Info */}
        {currentClassroom && (
          <div className="px-4 pb-4 flex-shrink-0 border-t border-border pt-4">
            <div className="mb-3">
              <h3 className="text-xs font-semibold mb-2 text-muted-foreground uppercase tracking-wide">
                Current Classroom
              </h3>
              <Card className="bg-gradient-secondary">
                <CardContent className="p-3">
                  <h4 className="text-sm font-medium truncate">
                    {currentClassroom.name}
                  </h4>
                  <p className="text-xs text-muted-foreground truncate">
                    {currentClassroom.subject}
                  </p>
                  <Badge
                    variant="secondary"
                    className="mt-2 bg-primary/20 text-primary text-xs"
                  >
                    {currentClassroom.members}{" "}
                    {currentClassroom.members === 1 ? "member" : "members"}
                  </Badge>
                </CardContent>
              </Card>
            </div>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between mb-1">
                <span className="text-muted-foreground">Progress:</span>
                <span className="font-medium">
                  {(() => {
                    // Prioritize classroomProgress.progress (calculated), then currentClassroom.progress
                    let progressValue = 0;

                    if (
                      classroomProgress &&
                      typeof classroomProgress.progress === "number"
                    ) {
                      progressValue = classroomProgress.progress;
                    } else if (
                      currentClassroom &&
                      typeof currentClassroom.progress === "number"
                    ) {
                      progressValue = currentClassroom.progress;
                    }

                    return Math.min(100, Math.max(0, progressValue)).toFixed(1);
                  })()}
                  %
                </span>
              </div>
              <Progress
                value={(() => {
                  // Prioritize classroomProgress.progress (calculated), then currentClassroom.progress
                  let progressValue = 0;

                  if (
                    classroomProgress &&
                    typeof classroomProgress.progress === "number"
                  ) {
                    progressValue = classroomProgress.progress;
                  } else if (
                    currentClassroom &&
                    typeof currentClassroom.progress === "number"
                  ) {
                    progressValue = currentClassroom.progress;
                  }

                  // Ensure valid number between 0-100
                  progressValue = Math.min(100, Math.max(0, progressValue));

                  return progressValue;
                })()}
                className="h-2 bg-background/50"
              />
              {classroomProgress && (
                <div className="space-y-1 text-[10px] text-muted-foreground mt-2 pt-2 border-t border-border/50">
                  <div className="flex justify-between">
                    <span>Messages:</span>
                    <span className="font-medium">
                      {classroomProgress.details.total_messages}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Exams:</span>
                    <span className="font-medium">
                      {classroomProgress.details.total_exams}
                    </span>
                  </div>
                  {classroomProgress.details.total_exams > 0 && (
                    <div className="flex justify-between">
                      <span>Avg Score:</span>
                      <span className="font-medium">
                        {classroomProgress.details.average_exam_score}%
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span>Level:</span>
                    <span className="font-medium capitalize">
                      {classroomProgress.details.engagement_level}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Documents Section */}
        <div className="flex-1 overflow-y-auto px-4 pb-4 border-t border-border pt-4">
          <h3 className="text-xs font-semibold mb-2 text-muted-foreground uppercase tracking-wide">
            Documents
          </h3>
          {isLoadingDocuments ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-4 w-4 text-primary animate-spin" />
            </div>
          ) : documents.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">
              No documents uploaded
            </p>
          ) : (
            <div className="space-y-2">
              {documents.map((doc) => (
                <Card
                  key={doc.id}
                  className="bg-gradient-secondary cursor-pointer hover:bg-primary/10 transition-smooth"
                  onClick={() => setSelectedDocument(doc)}
                >
                  <CardContent className="p-2">
                    <div className="flex items-start space-x-2">
                      <FileText className="h-3 w-3 text-primary mt-0.5 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">
                          {doc.filename}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {doc.subject || "No subject"}
                        </p>
                      </div>
                      <Eye className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Main Content - Expanded */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header - Compressed */}
        <header className="bg-card/80 backdrop-blur-lg border-b border-border px-6 py-3 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold">AI Learning Hub</h1>
              <p className="text-xs text-muted-foreground">
                Your personal AI tutor
              </p>
            </div>
            <div className="flex items-center gap-3">
              {/* Language Selector */}
              <Select
                value={selectedLanguage}
                onValueChange={(value) => {
                  setSelectedLanguage(value);
                  if (isListening) {
                    stopListening();
                    setTimeout(() => {
                      if (isVoiceMode) {
                        startListening();
                      }
                    }, 100);
                  }
                }}
              >
                <SelectTrigger className="w-40 h-8 text-xs bg-background/50 border-border">
                  <SelectValue>
                    {currentLanguage.nativeName || currentLanguage.name}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent className="max-h-[400px] overflow-y-auto">
                  <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                    English
                  </div>
                  {SUPPORTED_LANGUAGES.filter((lang) =>
                    lang.code.startsWith("en")
                  ).map((lang) => (
                    <SelectItem key={lang.code} value={lang.code}>
                      <div className="flex items-center gap-2">
                        <span>{lang.nativeName}</span>
                        <span className="text-xs text-muted-foreground">
                          ({lang.name})
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                  <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground mt-2">
                    Indian Languages
                  </div>
                  {SUPPORTED_LANGUAGES.filter(
                    (lang) =>
                      lang.code.includes("-IN") && !lang.code.startsWith("en")
                  ).map((lang) => (
                    <SelectItem key={lang.code} value={lang.code}>
                      <div className="flex items-center gap-2">
                        <span>{lang.nativeName}</span>
                        <span className="text-xs text-muted-foreground">
                          ({lang.name})
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                  <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground mt-2">
                    Other Languages
                  </div>
                  {SUPPORTED_LANGUAGES.filter(
                    (lang) => !lang.code.includes("-IN")
                  ).map((lang) => (
                    <SelectItem key={lang.code} value={lang.code}>
                      <div className="flex items-center gap-2">
                        <span>{lang.nativeName}</span>
                        <span className="text-xs text-muted-foreground">
                          ({lang.name})
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Avatar className="h-8 w-8 ring-2 ring-primary">
                <AvatarImage src="/placeholder.svg" alt="User" />
                <AvatarFallback className="bg-gradient-primary text-primary-foreground text-xs">
                  U
                </AvatarFallback>
              </Avatar>
            </div>
          </div>
        </header>

        {/* Chat Area - Expanded */}
        <div className="flex-1 flex flex-col p-6 min-h-0">
          {/* Conversation - Full Height */}
          <Card
            className={`flex-1 bg-gradient-card mb-4 min-h-0 flex flex-col transition-all duration-500 ${
              isVoiceMode
                ? `border-2 ${
                    isRecording
                      ? "border-purple-500 shadow-[0_0_20px_rgba(168,85,247,0.5),0_0_40px_rgba(168,85,247,0.3)] animate-pulse"
                      : isPlayingAudio
                      ? "border-blue-500 shadow-[0_0_20px_rgba(59,130,246,0.5),0_0_40px_rgba(59,130,246,0.3)]"
                      : "border-primary/50 shadow-[0_0_15px_rgba(59,130,246,0.3)]"
                  }`
                : "border-border glow-card"
            }`}
          >
            <CardContent className="p-6 flex-1 overflow-y-auto">
              <div className="space-y-4">
                {conversation.map((msg, index) => (
                  <div
                    key={index}
                    className={`flex ${
                      msg.type === "user" ? "justify-end" : "justify-start"
                    }`}
                  >
                    <div
                      className={`max-w-[80%] p-4 rounded-lg ${
                        msg.type === "user"
                          ? "bg-gradient-primary text-primary-foreground ml-4"
                          : msg.type === "system"
                          ? "bg-warning/20 text-warning-foreground mr-4"
                          : "bg-gradient-secondary mr-4"
                      }`}
                    >
                      <div className="flex items-start space-x-2">
                        {msg.type === "ai" && (
                          <Brain className="h-4 w-4 mt-1 text-primary flex-shrink-0" />
                        )}
                        {msg.type === "system" && (
                          <Sparkles className="h-4 w-4 mt-1 text-warning flex-shrink-0" />
                        )}
                        <div className="flex-1">
                          {/* Visual PPT Display */}
                          {msg.ppt && (
                            <div className="mb-4">
                              <VisualPPTViewer ppt={msg.ppt} />
                            </div>
                          )}
                          {!msg.ppt && (
                            <p className="text-sm whitespace-pre-wrap">
                              {msg.content}
                            </p>
                          )}
                          <p className="text-xs opacity-70 mt-2">
                            {msg.timestamp}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                {isLoading && (
                  <div className="flex justify-start">
                    <div className="bg-gradient-secondary p-4 rounded-lg mr-4">
                      <div className="flex items-center space-x-2">
                        <Brain className="h-4 w-4 text-primary animate-pulse" />
                        <div className="flex space-x-1">
                          <div className="w-2 h-2 bg-primary rounded-full animate-bounce"></div>
                          <div
                            className="w-2 h-2 bg-primary rounded-full animate-bounce"
                            style={{ animationDelay: "0.1s" }}
                          ></div>
                          <div
                            className="w-2 h-2 bg-primary rounded-full animate-bounce"
                            style={{ animationDelay: "0.2s" }}
                          ></div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                {isVoiceMode && isRecording && (
                  <div className="flex justify-start mb-2">
                    <div className="bg-purple-500/20 p-3 rounded-lg border border-purple-500/30">
                      <div className="flex items-center space-x-2">
                        <Mic className="h-4 w-4 text-purple-500 animate-pulse" />
                        <div className="flex-1">
                          <p className="text-xs text-purple-300 mb-1">
                            🎤 Recording... Speak naturally (silence auto-sends)
                          </p>
                          {/* Audio level indicator */}
                          <div className="w-full bg-purple-500/20 rounded-full h-1.5 overflow-hidden">
                            <div
                              className="bg-purple-500 h-full transition-all duration-100"
                              style={{
                                width: `${Math.min(
                                  (audioLevel || 0) * 100,
                                  100
                                )}%`,
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                {isVoiceMode && isPlayingAudio && (
                  <div className="flex justify-start mb-2">
                    <div className="bg-blue-500/20 p-3 rounded-lg border border-blue-500/30">
                      <div className="flex items-center space-x-2">
                        <Brain className="h-4 w-4 text-blue-500 animate-pulse" />
                        <p className="text-xs text-blue-300">
                          🔊 Gemini is speaking... (conversation saved in
                          background)
                        </p>
                      </div>
                    </div>
                  </div>
                )}
                {isVoiceMode &&
                  isLoading &&
                  !isRecording &&
                  !isPlayingAudio && (
                    <div className="flex justify-start mb-2">
                      <div className="bg-yellow-500/20 p-3 rounded-lg border border-yellow-500/30">
                        <div className="flex items-center space-x-2">
                          <Loader2 className="h-4 w-4 text-yellow-500 animate-spin" />
                          <p className="text-xs text-yellow-300">
                            ⚡ Processing your voice...
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                {isSpeaking && !isVoiceMode && (
                  <div className="flex justify-start mb-2">
                    <div className="bg-blue-500/20 p-3 rounded-lg border border-blue-500/30">
                      <div className="flex items-center space-x-2">
                        <Brain className="h-4 w-4 text-blue-500 animate-pulse" />
                        <p className="text-xs text-blue-300">
                          🔊 AI is speaking...
                        </p>
                      </div>
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>
            </CardContent>
          </Card>

          {/* Input Area with Small Feature Icons */}
          <Card className="bg-gradient-card border-border flex-shrink-0">
            <CardContent className="p-3">
              {/* Small Feature Icons */}
              <div className="flex items-center justify-center gap-3 mb-2">
                {features.map((feature, index) => (
                  <Button
                    key={index}
                    onClick={() => handleFeatureClick(feature.label)}
                    variant={
                      (feature.label === "PPT" && isPPTMode) ||
                      (feature.label === "Voice" && isVoiceMode)
                        ? "default"
                        : "ghost"
                    }
                    size="sm"
                    className={`h-7 w-7 p-0 hover:bg-primary/10 ${
                      (feature.label === "PPT" && isPPTMode) ||
                      (feature.label === "Voice" && isVoiceMode)
                        ? "bg-primary text-primary-foreground"
                        : ""
                    } ${
                      feature.label === "Voice" && isListening
                        ? "animate-pulse ring-2 ring-purple-500"
                        : ""
                    }`}
                    title={
                      feature.label === "PPT"
                        ? isPPTMode
                          ? "PPT Mode Active - Click to disable"
                          : "Click to enable PPT mode"
                        : feature.label === "Voice"
                        ? isVoiceMode
                          ? isListening
                            ? "Voice mode active - Click to stop"
                            : "Voice mode enabled - Click to start listening"
                          : "Click to enable voice chat"
                        : feature.label
                    }
                  >
                    <feature.icon className={`h-3.5 w-3.5 ${feature.color}`} />
                  </Button>
                ))}
              </div>
              {isPPTMode && (
                <div className="mb-2 text-xs text-center text-primary bg-primary/10 px-2 py-1 rounded">
                  📊 PPT Mode Active - Your next message will generate a
                  presentation
                </div>
              )}

              {/* Input */}
              <div className="flex space-x-2">
                <div className="flex-1 relative">
                  <Textarea
                    placeholder={
                      isVoiceMode
                        ? isRecording
                          ? "🎤 Recording... Speak now, then click Stop to send"
                          : "Voice mode active - Click Record to start recording"
                        : "Ask me anything about your learning topics..."
                    }
                    value={
                      isVoiceMode && voiceTranscript ? voiceTranscript : message
                    }
                    onChange={(e) => {
                      if (!isVoiceMode) {
                        setMessage(e.target.value);
                      }
                    }}
                    onKeyPress={handleKeyPress}
                    className="flex-1 bg-input border-border focus:ring-primary resize-none text-sm pr-10"
                    rows={2}
                    disabled={isVoiceMode && isRecording}
                  />
                  {isVoiceMode && isRecording && (
                    <div className="absolute right-2 top-2">
                      <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                    </div>
                  )}
                  {isVoiceMode && voiceError && (
                    <div className="absolute bottom-1 left-2 text-xs text-destructive">
                      {voiceError}
                    </div>
                  )}
                </div>

                {/* Voice Recording Controls */}
                {isVoiceMode && isAudioRecordingSupported && (
                  <>
                    {!isRecording ? (
                      <Button
                        onClick={async () => {
                          const started = await startRecording();
                          if (started) {
                            // Recording started
                          }
                        }}
                        disabled={isLoading || isPlayingAudio}
                        className="bg-purple-500 hover:bg-purple-600 text-white self-end"
                        size="sm"
                      >
                        <Radio className="h-4 w-4" />
                      </Button>
                    ) : (
                      <Button
                        onClick={() => {
                          stopRecording();
                        }}
                        disabled={isLoading}
                        className="bg-red-500 hover:bg-red-600 text-white self-end animate-pulse"
                        size="sm"
                      >
                        <Square className="h-4 w-4" />
                      </Button>
                    )}
                  </>
                )}

                {/* Send Button (for text messages or when not recording) */}
                {(!isVoiceMode || !isRecording) && (
                  <Button
                    onClick={handleSendMessage}
                    disabled={
                      (!message.trim() && !isVoiceMode) ||
                      isLoading ||
                      isRecording
                    }
                    className="bg-gradient-primary hover:opacity-90 glow-feature self-end"
                    size="sm"
                  >
                    {isLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </Button>
                )}
              </div>
              <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
                <span>
                  {isVoiceMode
                    ? isRecording
                      ? "🎤 Recording... Click Stop to send and get voice response"
                      : isPlayingAudio
                      ? "🔊 AI is speaking..."
                      : "Voice mode - Click Record button to start recording"
                    : "Press Enter to send"}
                </span>
                <span>
                  {isVoiceMode ? voiceTranscript.length : message.length}/1000
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Document Preview Dialog */}
      <Dialog
        open={!!selectedDocument}
        onOpenChange={() => setSelectedDocument(null)}
      >
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>{selectedDocument?.filename}</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedDocument(null)}
                className="h-6 w-6 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </DialogTitle>
            <DialogDescription>
              {selectedDocument?.subject && (
                <Badge variant="secondary" className="mt-2">
                  {selectedDocument.subject}
                </Badge>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            {selectedDocument?.topic && (
              <div>
                <h4 className="text-sm font-semibold mb-1">Topic:</h4>
                <p className="text-sm text-muted-foreground">
                  {selectedDocument.topic}
                </p>
              </div>
            )}
            {selectedDocument?.summary &&
            selectedDocument.summary.trim() &&
            !selectedDocument.summary.includes(
              "AI service is not configured"
            ) ? (
              <div>
                <h4 className="text-sm font-semibold mb-1">Summary:</h4>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {selectedDocument.summary}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {selectedDocument?.topic && (
                  <div>
                    <h4 className="text-sm font-semibold mb-1">Topic:</h4>
                    <p className="text-sm text-muted-foreground">
                      {selectedDocument.topic}
                    </p>
                  </div>
                )}
                <p className="text-sm text-muted-foreground text-center py-4">
                  {selectedDocument?.summary &&
                  selectedDocument.summary.includes(
                    "AI service is not configured"
                  )
                    ? "Document is uploaded and ready. Summary will be available once AI service is configured."
                    : "Document summary is being processed. It will be available soon."}
                </p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Dashboard;
