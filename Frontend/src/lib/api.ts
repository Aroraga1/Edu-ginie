import axios from "axios";

export const api = axios.create({
  // Using Vite proxy; keep relative base URL
  baseURL: "/",
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
});

export type RegisterPayload = {
  name: string;
  email: string;
  username: string;
  password: string;
  age: number;
  education: string;
  language: string;
  photo?: string;
};

export async function requestOtp(payload: RegisterPayload) {
  const { data } = await api.post("/request_otp", payload);
  return data;
}

export async function verifyOtp(email: string, otp: string) {
  const { data } = await api.post("/verify_otp", { email, otp });
  return data;
}

export async function login(identifier: string, password: string) {
  const { data } = await api.post("/login", { identifier, password });
  return data;
}

export async function me() {
  const { data } = await api.post("/me");
  return data;
}

export async function logout() {
  // Backend returns HTML; we ignore body
  await api.post("/logout");
}

export type ProfileData = {
  userId: string;
  bio: string;
  interests: string[];
  learningGoals?: string;
  preferredLearningStyle: string;
  difficultyLevel: string;
  timeCommitment: string;
  totalProgress?: number;
  currentStreak?: number;
  longestStreak?: number;
  totalBadges?: number;
  createdAt?: string;
};

// Streak tracking functions
export async function trackDailyVisit() {
  const { data } = await api.post("/profile/track-visit");
  return data;
}

export async function getStreakInfo() {
  const { data } = await api.get("/profile/streak-info");
  return data;
}

export async function createProfile(profileData: ProfileData) {
  const { data } = await api.post("/profile/create", profileData);
  return data;
}

export async function getUserClassrooms() {
  const { data } = await api.post("/api/user/classrooms");
  return data;
}

export async function getUserBadges() {
  const { data } = await api.post("/api/user/badges");
  return data;
}

export async function getUserAchievements() {
  const { data } = await api.post("/api/user/achievements");
  return data;
}

export async function trackClassroomClick(classroomId: string) {
  const { data } = await api.post("/api/user/track-classroom-click", {
    classroom_id: classroomId,
  });
  return data;
}

export async function checkProfileExists() {
  try {
    const { data } = await api.post("/profile/get");
    return data;
  } catch (error: unknown) {
    // If 404, profile doesn't exist - return null
    const err = error as { response?: { status?: number } };
    if (err?.response?.status === 404) {
      return { success: false, profile: null };
    }
    // If 401, user not authenticated - return null (don't throw)
    if (err?.response?.status === 401) {
      return { success: false, profile: null, unauthorized: true };
    }
    // For other errors, still return null to avoid breaking the flow
    console.error("Error checking profile:", error);
    return { success: false, profile: null };
  }
}

export type ClassroomData = {
  name: string;
  subject: string;
  description?: string;
  preparation?: string;
  syllabus?: string;
  mediaType?: string;
  medium?: string;
  confidenceLevel?: number[];
};

export async function createClassroom(classroomData: ClassroomData) {
  const { data } = await api.post("/api/classroom/create", classroomData);
  return data;
}

export async function getClassroomById(classroomId: string) {
  const { data } = await api.post("/api/user/classrooms");
  // Filter from the list (backend doesn't have a single classroom endpoint yet)
  if (data?.success && data?.classrooms) {
    const classroom = data.classrooms.find(
      (c: { id: string }) => c.id === classroomId
    );
    return classroom
      ? { success: true, classroom }
      : { success: false, classroom: null };
  }
  return { success: false, classroom: null };
}

export async function getClassroomProgress(classroomId: string) {
  const { data } = await api.get(`/api/classroom/progress/${classroomId}`);
  return data;
}

// Media/PDF upload functions
export async function uploadPDF(file: File, topic?: string, guidance?: string) {
  const formData = new FormData();
  formData.append("pdf", file);
  if (topic) formData.append("topic", topic);
  if (guidance) formData.append("guidance", guidance);

  const { data } = await api.post("/ai_hub/upload_pdf", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}

export async function getPDFs(topic?: string) {
  const { data } = await api.get("/ai_hub/get_pdfs", {
    params: topic ? { topic } : {},
  });
  return data;
}

export async function deletePDF(pdfId: string) {
  const { data } = await api.delete(`/ai_hub/delete_pdf/${pdfId}`);
  return data;
}

// AI Chat functions
export async function sendChatMessage(
  message: string,
  topic?: string,
  language?: string,
  classroomId?: string,
  isVoiceMode?: boolean,
  isSummaryMode?: boolean
) {
  const { data } = await api.post("/ai_hub/chat", {
    message,
    topic,
    language,
    classroom_id: classroomId,
    is_voice_mode: isVoiceMode || false,
    is_summary_mode: isSummaryMode || false,
  });
  return data;
}

export async function sendVoiceAudio(
  audioBlob: Blob,
  language?: string,
  topic?: string,
  classroomId?: string
) {
  const formData = new FormData();
  formData.append("audio", audioBlob, "recording.webm");
  if (language) formData.append("language", language);
  if (topic) formData.append("topic", topic);
  if (classroomId) formData.append("classroom_id", classroomId);

  const { data } = await api.post<{
    success: boolean;
    audio_data?: string;
    text?: string;
    format?: string;
    error?: string;
  }>("/ai_hub/voice", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}

export async function getChatHistory(classroomId?: string, topic?: string) {
  const params: Record<string, string> = {};
  if (classroomId) params.classroom_id = classroomId;
  if (topic) params.topic = topic;
  const { data } = await api.get("/ai_hub/get_chat_history", { params });
  return data;
}

// PPT Generation function
export async function generatePPT(
  query: string,
  topic?: string,
  language?: string,
  classroomId?: string
) {
  const { data } = await api.post("/ai_hub/generate_ppt", {
    query,
    topic,
    language: language || "en-US",
    classroom_id: classroomId,
  });
  return data;
}

// Exam functions
export async function generateExam(examData: {
  title?: string;
  subject: string;
  topics?: string;
  questionCount: number;
  difficulty: string;
  questionType: string;
  timeLimit: number;
  classroom_id?: string;
}) {
  const { data } = await api.post("/api/exam/generate", examData);
  return data;
}

export async function getExam(examId: string) {
  const { data } = await api.get(`/api/exam/get/${examId}`);
  return data;
}

export async function submitExam(examData: {
  exam_id: string;
  answers: number[];
  time_used: number;
}) {
  const { data } = await api.post("/api/exam/submit", examData);
  return data;
}

// Progress and analysis functions
export async function getExamResults() {
  const { data } = await api.post("/api/user/exam-results");
  return data;
}

export async function getUserProgress() {
  const { data } = await api.post("/api/user/progress");
  return data;
}

// Student Analysis function
export async function getStudentAnalysis() {
  const { data } = await api.get("/api/student/analysis");
  return data;
}

// Leaderboard function
export async function getLeaderboard() {
  const { data } = await api.post("/api/leaderboard");
  return data;
}

// Activity Calendar function
export async function getActivityCalendar(year?: number, month?: number) {
  const { data } = await api.post("/profile/activity-calendar", { year, month });
  return data;
}
