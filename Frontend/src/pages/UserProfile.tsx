import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  User,
  Calendar as CalendarIcon,
  GraduationCap,
  Languages,
  Trophy,
  Flame,
  Target,
  Plus,
  BookOpen,
  ArrowRight,
  LogOut,
  Brain,
  Sparkles,
} from "lucide-react";
import { HomeButton } from "@/components/HomeButton";
import {
  getUserClassrooms,
  getUserBadges,
  getUserAchievements,
  trackClassroomClick,
  me,
  checkProfileExists,
  getExamResults,
  getUserProgress,
  getStudentAnalysis,
  trackDailyVisit,
  getStreakInfo,
  getLeaderboard,
  getActivityCalendar,
} from "@/lib/api";
import { Calendar } from "@/components/ui/calendar";

const UserProfile = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<{
    name?: string;
    age?: number;
    education?: string;
    language?: string;
    avatar?: string;
    totalProgress?: number;
    currentStreak?: number;
    longestStreak?: number;
  } | null>(null);
  const [classrooms, setClassrooms] = useState<
    Array<{
      id: string;
      name: string;
      subject?: string;
      topic?: string;
      progress: number;
      members: number;
    }>
  >([]);
  const [badges, setBadges] = useState<
    Array<{
      name: string;
      icon: string;
      description: string;
      earned: boolean;
      key?: string;
    }>
  >([]);
  const [achievements, setAchievements] = useState<
    Array<{
      title?: string;
      name?: string;
      date?: string;
      created_at?: string;
      timestamp?: string;
    }>
  >([]);
  const [isLoading, setIsLoading] = useState(true);
  const [examStats, setExamStats] = useState<{
    total_exams: number;
    average_score: number;
    overall_accuracy: number;
    subject_breakdown: Array<{
      subject: string;
      exam_count: number;
      average_score: number;
    }>;
    recent_results: Array<{
      exam_title: string;
      score: number;
      created_at: string;
    }>;
  } | null>(null);
  const [progressData, setProgressData] = useState<{
    overall_progress: number;
    total_exams: number;
    total_chats: number;
    total_documents: number;
    total_classrooms: number;
    current_streak: number;
    longest_streak: number;
  } | null>(null);
  const [studentAnalysis, setStudentAnalysis] = useState<{
    overall_stats: {
      total_exams: number;
      average_score: number;
      overall_progress: number;
      overall_confidence: number;
      accuracy_rate: number;
    };
    conversation_engagement?: {
      total_messages: number;
      total_conversations: number;
      engagement_score: number;
      topics_covered: number;
      ppt_generated: number;
      recent_activity_days: number;
    };
    exam_performance?: {
      total_exams: number;
      average_score: number;
      performance_score: number;
      improvement_trend: number;
      perfect_scores: number;
    };
    subject_confidence: {
      [subject: string]: {
        confidence_level: number;
        average_score: number;
        exam_count: number;
        accuracy_rate: number;
      };
    };
    score_trend: number[];
    confidence_trend?: Array<{
      date: string;
      confidence: number;
    }>;
    earned_badges?: string[];
    new_achievements?: Array<{
      name: string;
      description: string;
      icon: string;
    }>;
    ai_feedback: {
      overall_feedback: string;
      strengths: string[];
      areas_for_improvement: string[];
    };
  } | null>(null);
  const [leaderboard, setLeaderboard] = useState<
    Array<{
      user_id: string;
      name: string;
      avatar?: string;
      performance_score: number;
      exam_score: number;
      engagement_score: number;
      overall_confidence: number;
      total_exams: number;
      average_exam_score: number;
      total_messages: number;
      is_current_user?: boolean;
      rank: number;
    }>
  >([]);
  const [isLoadingLeaderboard, setIsLoadingLeaderboard] = useState(false);
  const [activeDates, setActiveDates] = useState<Set<string>>(new Set());
  const [isLoadingCalendar, setIsLoadingCalendar] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());

  useEffect(() => {
    const loadUserData = async () => {
      setIsLoading(true);

      // Track daily visit when profile page loads
      try {
        const visitResponse = await trackDailyVisit();
        if (visitResponse?.success && visitResponse?.streak) {
          // Update user state with latest streak
          setUser((prev) => ({
            ...prev,
            currentStreak:
              visitResponse.streak.current_streak || prev?.currentStreak || 0,
            longestStreak:
              visitResponse.streak.longest_streak || prev?.longestStreak || 0,
          }));
        }
      } catch (error) {
        // Silently fail - don't interrupt user experience
        console.log("Visit tracking failed (non-critical):", error);
      }

      // Try to get user profile from localStorage first (for quick display)
      const savedProfile = localStorage.getItem("userProfile");
      if (savedProfile) {
        try {
          setUser(JSON.parse(savedProfile));
        } catch (e) {
          console.error("Error parsing saved profile:", e);
        }
      }

      // Always try to fetch from backend to get latest data
      try {
        const userResponse = await me();

        if (userResponse?.user) {
          // Get profile from backend if it exists
          const profileResponse = await checkProfileExists();

          if (profileResponse?.success && profileResponse?.profile) {
            // User has profile - combine user and profile data
            const completeProfile = {
              ...userResponse.user,
              ...profileResponse.profile,
              name: userResponse.user.name || userResponse.user.full_name,
              avatar: userResponse.user.photo || "/placeholder.svg",
            };
            setUser(completeProfile);
            localStorage.setItem(
              "userProfile",
              JSON.stringify(completeProfile)
            );
          } else {
            // No profile exists - redirect to create profile (only if localStorage also doesn't have it)
            if (!savedProfile) {
              navigate("/create-profile");
              return;
            }
            // If localStorage has data but backend doesn't, keep showing localStorage data
          }
        } else {
          // No user data from backend - redirect to login
          if (!savedProfile) {
            navigate("/login");
            return;
          }
        }
      } catch (error: unknown) {
        const err = error as { response?: { status?: number } };
        console.error("Error loading user data:", error);
        // If unauthorized, redirect to login
        if (err?.response?.status === 401) {
          localStorage.removeItem("userProfile");
          navigate("/login");
          return;
        }
        // If localStorage has data, continue with it even if backend fails
        if (!savedProfile) {
          navigate("/login");
          return;
        }
      }

      // Fetch additional data (classrooms, badges, achievements, exam results, progress)
      const fetchUserData = async () => {
        try {
          const [
            classroomsRes,
            badgesRes,
            achievementsRes,
            examResultsRes,
            progressRes,
            analysisRes,
          ] = await Promise.all([
            getUserClassrooms(),
            getUserBadges(),
            getUserAchievements(),
            getExamResults().catch(() => ({ success: false })),
            getUserProgress().catch(() => ({ success: false })),
            getStudentAnalysis().catch(() => ({ success: false })),
          ]);

          if (classroomsRes?.success) {
            setClassrooms(classroomsRes.classrooms || []);
          }
          if (badgesRes?.success) {
            setBadges(badgesRes.badges || []);
          }
          if (achievementsRes?.success) {
            setAchievements(achievementsRes.achievements || []);
          }
          if (examResultsRes?.success) {
            setExamStats({
              total_exams: examResultsRes.statistics?.total_exams || 0,
              average_score: examResultsRes.statistics?.average_score || 0,
              overall_accuracy:
                examResultsRes.statistics?.overall_accuracy || 0,
              subject_breakdown: examResultsRes.subject_breakdown || [],
              recent_results: examResultsRes.recent_results || [],
            });

            // Update user progress in state
            if (examResultsRes.statistics?.average_score) {
              setUser((prev) => ({
                ...prev,
                totalProgress: examResultsRes.statistics.average_score,
              }));
            }
          }
          if (progressRes?.success) {
            setProgressData(progressRes.progress);

            // Update user with progress data
            setUser((prev) => ({
              ...prev,
              totalProgress:
                progressRes.progress?.overall_progress ||
                prev?.totalProgress ||
                0,
              currentStreak:
                progressRes.progress?.current_streak ||
                prev?.currentStreak ||
                0,
              longestStreak:
                progressRes.progress?.longest_streak ||
                prev?.longestStreak ||
                0,
            }));
          }

          if (analysisRes?.success) {
            setStudentAnalysis({
              overall_stats: analysisRes.overall_stats || {
                total_exams: 0,
                average_score: 0,
                overall_progress: 0,
                overall_confidence: 0,
                accuracy_rate: 0,
              },
              conversation_engagement: analysisRes.conversation_engagement,
              exam_performance: analysisRes.exam_performance,
              subject_confidence: analysisRes.subject_confidence || {},
              score_trend: analysisRes.score_trend || [],
              confidence_trend: analysisRes.confidence_trend || [],
              earned_badges: analysisRes.earned_badges || [],
              new_achievements: analysisRes.new_achievements || [],
              ai_feedback: analysisRes.ai_feedback || {
                overall_feedback: "",
                strengths: [],
                areas_for_improvement: [],
              },
            });

            // Update user progress from analysis
            if (analysisRes.overall_stats?.overall_confidence) {
              setUser((prev) => ({
                ...prev,
                totalProgress: analysisRes.overall_stats.overall_confidence,
              }));
            }

            // New achievements detected
            if (
              analysisRes.new_achievements &&
              analysisRes.new_achievements.length > 0
            ) {
              // Achievements unlocked
            }
          }
        } catch (error) {
          console.error("Error fetching user data:", error);
          // Set empty arrays on error
          setClassrooms([]);
          setBadges([]);
          setAchievements([]);
        } finally {
          setIsLoading(false);
        }
      };

      fetchUserData();
    };

    loadUserData();
  }, [navigate]);

  useEffect(() => {
    const loadLeaderboard = async () => {
      setIsLoadingLeaderboard(true);
      try {
        const leaderboardRes = await getLeaderboard();
        if (leaderboardRes?.success && leaderboardRes?.leaderboard) {
          setLeaderboard(leaderboardRes.leaderboard || []);
        }
      } catch (error) {
        console.error("Error loading leaderboard:", error);
      } finally {
        setIsLoadingLeaderboard(false);
      }
    };

    loadLeaderboard();
  }, []);

  useEffect(() => {
    const loadActivityCalendar = async () => {
      setIsLoadingCalendar(true);
      try {
        const calendarRes = await getActivityCalendar();
        if (calendarRes?.success && calendarRes?.calendar?.active_dates) {
          setActiveDates(new Set(calendarRes.calendar.active_dates));
        }
      } catch (error) {
        console.error("Error loading activity calendar:", error);
      } finally {
        setIsLoadingCalendar(false);
      }
    };

    loadActivityCalendar();
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("userProfile");
    window.location.href = "/";
  };

  const handleClassroomClick = async (classroomId: string) => {
    try {
      // Track the click
      await trackClassroomClick(classroomId);
      // Navigate to dashboard with classroom context
      navigate(`/dashboard?classroom=${classroomId}`);
    } catch (error) {
      console.error("Error tracking classroom click:", error);
      // Still navigate even if tracking fails
      navigate(`/dashboard?classroom=${classroomId}`);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-hero flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary/20 border-t-primary rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading your profile...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-hero p-4 md:p-6 animate-slide-up">
      {/* Navigation */}
      <div className="mb-6 md:mb-8 flex justify-between items-center">
        <HomeButton
          variant="outline"
          className="border-primary/50 text-primary hover:bg-primary/10 hover:border-primary transition-smooth hover:scale-105"
        />

        <Button
          onClick={handleLogout}
          variant="outline"
          className="border-destructive/50 text-destructive hover:bg-destructive/10 hover:border-destructive transition-smooth hover:scale-105"
        >
          <LogOut className="mr-2 h-4 w-4" />
          Logout
        </Button>
      </div>

      <div className="container mx-auto max-w-7xl">
        {/* Header */}
        <div className="text-center mb-6 md:mb-8">
          <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-3 md:mb-4 text-gradient animate-slide-up">
            Dashboard
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground animate-slide-up" style={{ animationDelay: '0.1s' }}>
            Track your progress and achievements
          </p>
        </div>

        {/* Dashboard Layout: Main Content + Right Sidebar */}
        <div className="grid lg:grid-cols-4 gap-4 md:gap-6">
          {/* Main Content Area - 3 columns */}
          <div className="lg:col-span-3 space-y-4 md:space-y-6">

            {/* Profile Card - Enhanced */}
            <Card className="bg-gradient-card border-border/50 glow-card hover:border-primary/30 transition-smooth hover:shadow-lg hover:shadow-primary/10 group animate-slide-up">
              <CardHeader className="text-center pb-4">
                <div className="relative inline-block mb-4">
                  <Avatar className="h-28 w-28 md:h-32 md:w-32 mx-auto ring-4 ring-primary/50 glow-feature group-hover:ring-primary group-hover:scale-105 transition-smooth animate-slide-up">
                    <AvatarImage src={user.avatar} alt={user.name} className="object-cover" />
                    <AvatarFallback className="text-2xl bg-gradient-primary text-primary-foreground">
                      {user.name
                        .split(" ")
                        .map((n) => n[0])
                        .join("")}
                    </AvatarFallback>
                  </Avatar>
                  <div className="absolute -bottom-1 -right-1 h-6 w-6 bg-success rounded-full border-4 border-card animate-pulse"></div>
                </div>
                <CardTitle className="text-2xl md:text-3xl mb-2 group-hover:text-primary transition-smooth">{user.name}</CardTitle>
                <div className="flex flex-wrap justify-center gap-3 md:gap-4 text-sm md:text-base text-muted-foreground">
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-background/30 rounded-full hover:bg-primary/10 transition-smooth">
                    <CalendarIcon className="h-4 w-4 text-primary" />
                    <span>Age {user.age}</span>
                  </div>
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-background/30 rounded-full hover:bg-primary/10 transition-smooth">
                    <GraduationCap className="h-4 w-4 text-primary" />
                    <span>{user.education}</span>
                  </div>
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-background/30 rounded-full hover:bg-primary/10 transition-smooth">
                    <Languages className="h-4 w-4 text-primary" />
                    <span>{user.language}</span>
                  </div>
                </div>
              </CardHeader>
            </Card>

            {/* Exam Analysis Section - Enhanced */}
            {examStats && examStats.total_exams > 0 ? (
              <Card className="bg-gradient-card border-border/50 glow-card hover:border-primary/30 transition-smooth hover:shadow-lg hover:shadow-primary/10 animate-slide-up group" style={{ animationDelay: '0.1s' }}>
                <CardHeader>
                  <CardTitle className="flex items-center group-hover:text-primary transition-smooth">
                    <div className="mr-3 p-2 bg-primary/10 rounded-lg group-hover:bg-primary/20 transition-smooth">
                      <Target className="h-5 w-5 text-primary" />
                    </div>
                    Exam Performance Analysis
                  </CardTitle>
                  <CardDescription>
                    Detailed insights from your exam results
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-6">
                    <div className="text-center p-4 bg-primary/10 rounded-xl border border-primary/20 hover:bg-primary/15 hover:border-primary/40 hover:scale-105 transition-smooth group/stat cursor-default">
                      <div className="text-2xl md:text-3xl font-bold text-primary mb-1 group-hover/stat:scale-110 transition-smooth">
                        {examStats.total_exams}
                      </div>
                      <div className="text-xs md:text-sm text-muted-foreground font-medium">
                        Total Exams
                      </div>
                    </div>
                    <div className="text-center p-4 bg-success/10 rounded-xl border border-success/20 hover:bg-success/15 hover:border-success/40 hover:scale-105 transition-smooth group/stat cursor-default">
                      <div className="text-2xl md:text-3xl font-bold text-success mb-1 group-hover/stat:scale-110 transition-smooth">
                        {examStats.average_score.toFixed(1)}%
                      </div>
                      <div className="text-xs md:text-sm text-muted-foreground font-medium">
                        Average Score
                      </div>
                    </div>
                    <div className="text-center p-4 bg-warning/10 rounded-xl border border-warning/20 hover:bg-warning/15 hover:border-warning/40 hover:scale-105 transition-smooth group/stat cursor-default">
                      <div className="text-2xl md:text-3xl font-bold text-warning mb-1 group-hover/stat:scale-110 transition-smooth">
                        {examStats.overall_accuracy.toFixed(1)}%
                      </div>
                      <div className="text-xs md:text-sm text-muted-foreground font-medium">
                        Accuracy Rate
                      </div>
                    </div>
                    <div className="text-center p-4 bg-blue-500/10 rounded-xl border border-blue-500/20 hover:bg-blue-500/15 hover:border-blue-500/40 hover:scale-105 transition-smooth group/stat cursor-default">
                      <div className="text-2xl md:text-3xl font-bold text-blue-500 mb-1 group-hover/stat:scale-110 transition-smooth">
                        {progressData?.total_chats || 0}
                      </div>
                      <div className="text-xs md:text-sm text-muted-foreground font-medium">
                        Chat Sessions
                      </div>
                    </div>
                  </div>

                  {/* Subject Breakdown - Enhanced */}
                  {examStats.subject_breakdown.length > 0 && (
                    <div className="mb-6">
                      <h4 className="text-sm md:text-base font-semibold mb-4 text-foreground flex items-center gap-2">
                        <div className="h-1 w-1 bg-primary rounded-full"></div>
                        Performance by Subject
                      </h4>
                      <div className="space-y-3">
                        {examStats.subject_breakdown.map((subject, index) => (
                          <div 
                            key={index} 
                            className="space-y-2 p-3 rounded-lg bg-background/30 hover:bg-background/50 border border-transparent hover:border-primary/20 transition-smooth group"
                            style={{ animationDelay: `${index * 0.05}s` }}
                          >
                            <div className="flex justify-between items-center">
                              <span className="text-sm md:text-base font-medium group-hover:text-primary transition-smooth">
                                {subject.subject}
                              </span>
                              <div className="flex items-center space-x-3">
                                <span className="text-xs text-muted-foreground">
                                  {subject.exam_count} exam
                                  {subject.exam_count !== 1 ? "s" : ""}
                                </span>
                                <Badge
                                  variant="secondary"
                                  className="bg-primary/20 text-primary border-primary/30 hover:bg-primary/30 transition-smooth"
                                >
                                  {subject.average_score.toFixed(1)}% avg
                                </Badge>
                              </div>
                            </div>
                            <Progress
                              value={subject.average_score}
                              className="h-2.5 group-hover:h-3 transition-smooth"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Recent Results - Enhanced */}
                  {examStats.recent_results.length > 0 && (
                    <div>
                      <h4 className="text-sm md:text-base font-semibold mb-4 text-foreground flex items-center gap-2">
                        <div className="h-1 w-1 bg-primary rounded-full"></div>
                        Recent Exam Results
                      </h4>
                      <div className="space-y-2">
                        {examStats.recent_results
                          .slice(0, 5)
                          .map((result, index) => (
                            <div
                              key={index}
                              className="flex justify-between items-center p-3 bg-muted/20 rounded-lg border border-transparent hover:bg-muted/40 hover:border-primary/20 hover:scale-[1.02] transition-smooth group cursor-default"
                            >
                              <div className="flex-1">
                                <p className="text-sm md:text-base font-medium group-hover:text-primary transition-smooth">
                                  {result.exam_title}
                                </p>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                  {result.created_at
                                    ? new Date(
                                        result.created_at
                                      ).toLocaleDateString()
                                    : "Recently"}
                                </p>
                              </div>
                              <Badge
                                variant={
                                  result.score >= 80
                                    ? "default"
                                    : result.score >= 60
                                    ? "secondary"
                                    : "destructive"
                                }
                                className={
                                  result.score >= 80
                                    ? "bg-success/20 text-success border-success/30 hover:bg-success/30 transition-smooth"
                                    : result.score >= 60
                                    ? "bg-warning/20 text-warning border-warning/30 hover:bg-warning/30 transition-smooth"
                                    : "bg-destructive/20 text-destructive border-destructive/30 hover:bg-destructive/30 transition-smooth"
                                }
                              >
                                {result.score.toFixed(1)}%
                              </Badge>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ) : null}

            {/* Activity Summary - Enhanced */}
            {progressData && (
              <Card className="bg-gradient-card border-border/50 glow-card hover:border-primary/30 transition-smooth hover:shadow-lg hover:shadow-primary/10 animate-slide-up group" style={{ animationDelay: '0.15s' }}>
                <CardHeader>
                  <CardTitle className="flex items-center group-hover:text-primary transition-smooth">
                    <div className="mr-3 p-2 bg-primary/10 rounded-lg group-hover:bg-primary/20 transition-smooth">
                      <BookOpen className="h-5 w-5 text-primary" />
                    </div>
                    Learning Activity Summary
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
                    <div className="text-center p-4 bg-gradient-secondary rounded-xl border border-primary/10 hover:border-primary/30 hover:bg-primary/5 hover:scale-105 transition-smooth group/stat cursor-default">
                      <div className="text-2xl md:text-3xl font-bold text-primary mb-1 group-hover/stat:scale-110 transition-smooth">
                        {progressData.total_classrooms}
                      </div>
                      <div className="text-xs md:text-sm text-muted-foreground font-medium">
                        Classrooms
                      </div>
                    </div>
                    <div className="text-center p-4 bg-gradient-secondary rounded-xl border border-primary/10 hover:border-primary/30 hover:bg-primary/5 hover:scale-105 transition-smooth group/stat cursor-default">
                      <div className="text-2xl md:text-3xl font-bold text-primary mb-1 group-hover/stat:scale-110 transition-smooth">
                        {progressData.total_documents}
                      </div>
                      <div className="text-xs md:text-sm text-muted-foreground font-medium">Documents</div>
                    </div>
                    <div className="text-center p-4 bg-gradient-secondary rounded-xl border border-primary/10 hover:border-primary/30 hover:bg-primary/5 hover:scale-105 transition-smooth group/stat cursor-default">
                      <div className="text-2xl md:text-3xl font-bold text-primary mb-1 group-hover/stat:scale-110 transition-smooth">
                        {progressData.total_chats}
                      </div>
                      <div className="text-xs md:text-sm text-muted-foreground font-medium">
                        Chat Sessions
                      </div>
                    </div>
                    <div className="text-center p-4 bg-gradient-secondary rounded-xl border border-primary/10 hover:border-primary/30 hover:bg-primary/5 hover:scale-105 transition-smooth group/stat cursor-default">
                      <div className="text-2xl md:text-3xl font-bold text-primary mb-1 group-hover/stat:scale-110 transition-smooth">
                        {progressData.total_exams}
                      </div>
                      <div className="text-xs md:text-sm text-muted-foreground font-medium">
                        Exams Taken
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Conversation Engagement Section - Enhanced */}
            {studentAnalysis?.conversation_engagement && (
              <Card className="bg-gradient-card border-border/50 glow-card hover:border-primary/30 transition-smooth hover:shadow-lg hover:shadow-primary/10 animate-slide-up group" style={{ animationDelay: '0.2s' }}>
                <CardHeader>
                  <CardTitle className="flex items-center group-hover:text-primary transition-smooth">
                    <div className="mr-3 p-2 bg-primary/10 rounded-lg group-hover:bg-primary/20 transition-smooth">
                      <Languages className="h-5 w-5 text-primary" />
                    </div>
                    Conversation Engagement
                  </CardTitle>
                  <CardDescription>
                    Your learning activity through conversations with AI
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid md:grid-cols-3 gap-3 md:gap-4 mb-4">
                    <div className="text-center p-4 bg-primary/10 rounded-xl border border-primary/20 hover:bg-primary/15 hover:border-primary/40 hover:scale-105 transition-smooth group/stat cursor-default">
                      <div className="text-2xl md:text-3xl font-bold text-primary mb-1 group-hover/stat:scale-110 transition-smooth">
                        {studentAnalysis.conversation_engagement.total_messages}
                      </div>
                      <div className="text-xs md:text-sm text-muted-foreground font-medium">
                        Total Messages
                      </div>
                    </div>
                    <div className="text-center p-4 bg-primary/10 rounded-xl border border-primary/20 hover:bg-primary/15 hover:border-primary/40 hover:scale-105 transition-smooth group/stat cursor-default">
                      <div className="text-2xl md:text-3xl font-bold text-primary mb-1 group-hover/stat:scale-110 transition-smooth">
                        {studentAnalysis.conversation_engagement.topics_covered}
                      </div>
                      <div className="text-xs md:text-sm text-muted-foreground font-medium">
                        Topics Covered
                      </div>
                    </div>
                    <div className="text-center p-4 bg-primary/10 rounded-xl border border-primary/20 hover:bg-primary/15 hover:border-primary/40 hover:scale-105 transition-smooth group/stat cursor-default">
                      <div className="text-2xl md:text-3xl font-bold text-primary mb-1 group-hover/stat:scale-110 transition-smooth">
                        {studentAnalysis.conversation_engagement.engagement_score}%
                      </div>
                      <div className="text-xs md:text-sm text-muted-foreground font-medium">
                        Engagement Score
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2 p-4 bg-background/30 rounded-xl">
                    <div className="flex justify-between text-sm font-medium">
                      <span>Engagement Level</span>
                      <span className="text-primary">
                        {studentAnalysis.conversation_engagement.engagement_score}%
                      </span>
                    </div>
                    <Progress
                      value={
                        studentAnalysis.conversation_engagement.engagement_score
                      }
                      className="h-3 group-hover:h-3.5 transition-smooth"
                    />
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Subject Confidence Section - Enhanced */}
            {studentAnalysis &&
              studentAnalysis.subject_confidence &&
              Object.keys(studentAnalysis.subject_confidence).length > 0 && (
                <Card className="bg-gradient-card border-border/50 glow-card hover:border-primary/30 transition-smooth hover:shadow-lg hover:shadow-primary/10 animate-slide-up group" style={{ animationDelay: '0.25s' }}>
                  <CardHeader>
                    <CardTitle className="flex items-center group-hover:text-primary transition-smooth">
                      <div className="mr-3 p-2 bg-primary/10 rounded-lg group-hover:bg-primary/20 transition-smooth">
                        <GraduationCap className="h-5 w-5 text-primary" />
                      </div>
                      Subject Confidence & Progress
                    </CardTitle>
                    <CardDescription>
                      Your confidence level in each subject based on exam performance
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3 md:space-y-4">
                      {Object.entries(studentAnalysis.subject_confidence).map(
                        ([subject, data], index) => (
                          <div 
                            key={subject} 
                            className="space-y-2 p-4 rounded-xl bg-background/30 border border-transparent hover:border-primary/20 hover:bg-background/50 transition-smooth group/item"
                            style={{ animationDelay: `${index * 0.05}s` }}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className="p-1.5 bg-primary/10 rounded-lg group-hover/item:bg-primary/20 transition-smooth">
                                  <BookOpen className="h-4 w-4 text-primary" />
                                </div>
                                <span className="font-semibold text-sm md:text-base group-hover/item:text-primary transition-smooth">{subject}</span>
                                <Badge
                                  variant="secondary"
                                  className="bg-primary/20 text-primary border-primary/30 hover:bg-primary/30 transition-smooth"
                                >
                                  {data.exam_count}{" "}
                                  {data.exam_count === 1 ? "exam" : "exams"}
                                </Badge>
                              </div>
                              <div className="text-right">
                                <div className="text-lg md:text-xl font-bold text-primary group-hover/item:scale-110 transition-smooth inline-block">
                                  {data.confidence_level}%
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  Confidence
                                </div>
                              </div>
                            </div>
                            <Progress
                              value={data.confidence_level}
                              className="h-2.5 group-hover/item:h-3 transition-smooth"
                            />
                            <div className="flex justify-between text-xs text-muted-foreground pt-1">
                              <span>Avg Score: <span className="font-medium text-foreground">{data.average_score}%</span></span>
                              <span>Accuracy: <span className="font-medium text-foreground">{data.accuracy_rate}%</span></span>
                            </div>
                          </div>
                        )
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

            {/* AI Feedback Section - Enhanced */}
            {studentAnalysis && studentAnalysis.ai_feedback && (
              <Card className="bg-gradient-card border-border/50 glow-card hover:border-primary/30 transition-smooth hover:shadow-lg hover:shadow-primary/10 animate-slide-up group" style={{ animationDelay: '0.3s' }}>
                <CardHeader>
                  <CardTitle className="flex items-center group-hover:text-primary transition-smooth">
                    <div className="mr-3 p-2 bg-primary/10 rounded-lg group-hover:bg-primary/20 transition-smooth">
                      <Brain className="h-5 w-5 text-primary" />
                    </div>
                    AI Performance Analysis
                  </CardTitle>
                  <CardDescription>
                    Personalized feedback based on your learning journey
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {studentAnalysis.ai_feedback.overall_feedback && (
                    <div className="p-4 bg-primary/5 rounded-xl border border-primary/10">
                      <h4 className="font-semibold mb-2 text-primary flex items-center gap-2">
                        <Sparkles className="h-4 w-4 animate-pulse" />
                        Overall Feedback
                      </h4>
                      <p className="text-sm md:text-base text-foreground leading-relaxed">
                        {studentAnalysis.ai_feedback.overall_feedback}
                      </p>
                    </div>
                  )}

                  {studentAnalysis.ai_feedback.strengths &&
                    studentAnalysis.ai_feedback.strengths.length > 0 && (
                      <div className="p-4 bg-success/5 rounded-xl border border-success/10">
                        <h4 className="font-semibold mb-3 text-success flex items-center gap-2">
                          <Target className="h-4 w-4" />
                          Strengths
                        </h4>
                        <ul className="space-y-2">
                          {studentAnalysis.ai_feedback.strengths.map(
                            (strength, idx) => (
                              <li key={idx} className="flex items-start gap-2 text-sm md:text-base text-foreground">
                                <span className="text-success mt-1">✓</span>
                                <span>{strength}</span>
                              </li>
                            )
                          )}
                        </ul>
                      </div>
                    )}

                  {studentAnalysis.ai_feedback.areas_for_improvement &&
                    studentAnalysis.ai_feedback.areas_for_improvement.length >
                      0 && (
                      <div className="p-4 bg-warning/5 rounded-xl border border-warning/10">
                        <h4 className="font-semibold mb-3 text-warning flex items-center gap-2">
                          <Target className="h-4 w-4" />
                          Areas for Improvement
                        </h4>
                        <ul className="space-y-2">
                          {studentAnalysis.ai_feedback.areas_for_improvement.map(
                            (area, idx) => (
                              <li key={idx} className="flex items-start gap-2 text-sm md:text-base text-foreground">
                                <span className="text-warning mt-1">→</span>
                                <span>{area}</span>
                              </li>
                            )
                          )}
                        </ul>
                      </div>
                    )}
                </CardContent>
              </Card>
            )}

            <div className="grid lg:grid-cols-3 gap-4 md:gap-6">
              {/* Progress Section - Enhanced */}
              <Card className="bg-gradient-card border-border/50 glow-card hover:border-primary/30 transition-smooth hover:shadow-lg hover:shadow-primary/10 animate-slide-up group" style={{ animationDelay: '0.35s' }}>
                <CardHeader>
                  <CardTitle className="flex items-center group-hover:text-primary transition-smooth">
                    <div className="mr-2 p-1.5 bg-primary/10 rounded-lg group-hover:bg-primary/20 transition-smooth">
                      <Target className="h-5 w-5 text-primary" />
                    </div>
                    Overall Progress
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-5 md:space-y-6">
                  <div className="p-4 bg-background/30 rounded-xl">
                    <div className="flex justify-between mb-3">
                      <span className="text-sm font-medium text-foreground">
                        Overall Confidence
                      </span>
                      <span className="text-sm md:text-base font-bold text-primary">
                        {studentAnalysis?.overall_stats?.overall_confidence ||
                          studentAnalysis?.overall_stats?.overall_progress ||
                          user.totalProgress ||
                          0}
                        %
                      </span>
                    </div>
                    <Progress
                      value={
                        studentAnalysis?.overall_stats?.overall_confidence ||
                        studentAnalysis?.overall_stats?.overall_progress ||
                        user.totalProgress ||
                        0
                      }
                      className="h-3.5 group-hover:h-4 transition-smooth"
                    />
                    {studentAnalysis?.exam_performance && (
                      <div className="mt-4 space-y-2">
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>Exam Performance</span>
                          <span className="font-medium text-foreground">
                            {studentAnalysis.exam_performance.performance_score}%
                          </span>
                        </div>
                        <Progress
                          value={studentAnalysis.exam_performance.performance_score}
                          className="h-2"
                        />
                      </div>
                    )}
                    {studentAnalysis?.conversation_engagement && (
                      <div className="mt-4 space-y-2">
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>Engagement</span>
                          <span className="font-medium text-foreground">
                            {
                              studentAnalysis.conversation_engagement
                                .engagement_score
                            }
                            %
                          </span>
                        </div>
                        <Progress
                          value={
                            studentAnalysis.conversation_engagement.engagement_score
                          }
                          className="h-2"
                        />
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3 md:gap-4">
                    <div className="text-center p-4 bg-success/10 rounded-xl border border-success/20 hover:bg-success/15 hover:border-success/40 hover:scale-105 transition-smooth group/streak cursor-default">
                      <Flame className="h-6 w-6 text-success mx-auto mb-2 group-hover/streak:animate-pulse" />
                      <div className="text-2xl md:text-3xl font-bold text-success mb-1 group-hover/streak:scale-110 transition-smooth">
                        {user.currentStreak || 0}
                      </div>
                      <div className="text-xs md:text-sm text-muted-foreground font-medium">
                        Current Streak
                      </div>
                      {user.currentStreak && user.currentStreak > 0 && (
                        <div className="text-[10px] text-success mt-2 font-medium animate-pulse">
                          🔥 Keep it up!
                        </div>
                      )}
                      {(!user.currentStreak || user.currentStreak === 0) && (
                        <div className="text-[10px] text-muted-foreground mt-2">
                          Visit daily to build streak
                        </div>
                      )}
                    </div>
                    <div className="text-center p-4 bg-warning/10 rounded-xl border border-warning/20 hover:bg-warning/15 hover:border-warning/40 hover:scale-105 transition-smooth group/streak cursor-default">
                      <Trophy className="h-6 w-6 text-warning mx-auto mb-2 group-hover/streak:animate-pulse" />
                      <div className="text-2xl md:text-3xl font-bold text-warning mb-1 group-hover/streak:scale-110 transition-smooth">
                        {user.longestStreak || 0}
                      </div>
                      <div className="text-xs md:text-sm text-muted-foreground font-medium">
                        Best Streak
                      </div>
                      {user.longestStreak && user.longestStreak >= 7 && (
                        <div className="text-[10px] text-warning mt-2 font-medium animate-pulse">
                          🏆 Amazing!
                        </div>
                      )}
                      {user.longestStreak &&
                        user.longestStreak > 0 &&
                        user.longestStreak < 7 && (
                          <div className="text-[10px] text-muted-foreground mt-2">
                            Keep going!
                          </div>
                        )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Badges Section - Enhanced */}
              <Card className="bg-gradient-card border-border/50 glow-card hover:border-primary/30 transition-smooth hover:shadow-lg hover:shadow-primary/10 animate-slide-up group" style={{ animationDelay: '0.4s' }}>
                <CardHeader>
                  <CardTitle className="flex items-center group-hover:text-primary transition-smooth">
                    <div className="mr-2 p-1.5 bg-primary/10 rounded-lg group-hover:bg-primary/20 transition-smooth">
                      <Trophy className="h-5 w-5 text-primary" />
                    </div>
                    Badges ({badges.filter((b) => b.earned).length}/{badges.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <div className="text-center py-8">
                      <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin mx-auto mb-2"></div>
                      <p className="text-sm text-muted-foreground">
                        Loading badges...
                      </p>
                    </div>
                  ) : badges.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">
                      No badges yet. Start learning to earn badges!
                    </p>
                  ) : (
                    <div className="grid grid-cols-3 gap-2 md:gap-3">
                      {badges.map((badge, index) => (
                        <div
                          key={index}
                          className={`text-center p-3 rounded-xl transition-smooth border cursor-default ${
                            badge.earned
                              ? "bg-primary/20 border-primary/30 hover:bg-primary/30 hover:border-primary/50 hover:scale-110 glow-feature"
                              : "bg-muted/20 border-muted/30 opacity-50"
                          }`}
                          style={{ animationDelay: `${index * 0.03}s` }}
                        >
                          <div className="text-2xl md:text-3xl mb-1.5 transform transition-smooth hover:scale-125">{badge.icon}</div>
                          <div className="text-xs font-medium line-clamp-2">{badge.name}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Recent Achievements - Enhanced */}
              <Card className="bg-gradient-card border-border/50 glow-card hover:border-primary/30 transition-smooth hover:shadow-lg hover:shadow-primary/10 animate-slide-up group" style={{ animationDelay: '0.45s' }}>
                <CardHeader>
                  <CardTitle className="flex items-center group-hover:text-primary transition-smooth">
                    <div className="mr-2 p-1.5 bg-primary/10 rounded-lg group-hover:bg-primary/20 transition-smooth">
                      <Flame className="h-5 w-5 text-primary" />
                    </div>
                    Recent Achievements
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 md:space-y-3">
                  {isLoading ? (
                    <div className="text-center py-8">
                      <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin mx-auto mb-2"></div>
                      <p className="text-sm text-muted-foreground">
                        Loading achievements...
                      </p>
                    </div>
                  ) : achievements.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8 text-sm">
                      No achievements yet. Complete courses and exams to unlock achievements!
                    </p>
                  ) : (
                    achievements.map((achievement, index) => (
                      <div 
                        key={index} 
                        className="p-3 bg-muted/20 rounded-xl border border-transparent hover:border-primary/20 hover:bg-muted/40 hover:scale-[1.02] transition-smooth group/achievement cursor-default"
                        style={{ animationDelay: `${index * 0.05}s` }}
                      >
                        <div className="font-medium text-sm md:text-base group-hover/achievement:text-primary transition-smooth">
                          {achievement.title || achievement.name}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {achievement.date ||
                            (achievement.created_at
                              ? new Date(
                                  achievement.created_at
                                ).toLocaleDateString()
                              : "Recently")}
                        </div>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Classrooms Section - Enhanced */}
            <Card className="bg-gradient-card border-border/50 glow-card hover:border-primary/30 transition-smooth hover:shadow-lg hover:shadow-primary/10 animate-slide-up group" style={{ animationDelay: '0.5s' }}>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="flex items-center group-hover:text-primary transition-smooth">
                    <div className="mr-2 p-2 bg-primary/10 rounded-lg group-hover:bg-primary/20 transition-smooth">
                      <BookOpen className="h-5 w-5 text-primary" />
                    </div>
                    My Classrooms
                  </CardTitle>
                  <CardDescription>
                    Your active learning environments
                  </CardDescription>
                </div>
                <Link to="/create-classroom">
                  <Button className="bg-gradient-primary hover:opacity-90 glow-feature hover:scale-105 transition-smooth">
                    <Plus className="mr-2 h-4 w-4" />
                    Create New
                  </Button>
                </Link>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="text-center py-12">
                    <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-muted-foreground">Loading classrooms...</p>
                  </div>
                ) : classrooms.length === 0 ? (
                  <div className="text-center py-12">
                    <BookOpen className="h-12 w-12 mx-auto mb-4 text-muted-foreground animate-pulse" />
                    <p className="text-muted-foreground mb-4">
                      You haven't created any classrooms yet.
                    </p>
                    <Link to="/create-classroom">
                      <Button className="bg-gradient-primary hover:opacity-90 hover:scale-105 transition-smooth">
                        <Plus className="mr-2 h-4 w-4" />
                        Create Your First Classroom
                      </Button>
                    </Link>
                  </div>
                ) : (
                  <div className="grid md:grid-cols-2 gap-4 md:gap-6">
                    {classrooms.map((classroom, index) => (
                      <div
                        key={classroom.id}
                        className="p-5 md:p-6 bg-gradient-secondary rounded-xl border border-primary/10 group hover:border-primary/30 hover:glow-feature hover:scale-[1.02] transition-smooth cursor-pointer"
                        style={{ animationDelay: `${index * 0.05}s` }}
                        onClick={() => handleClassroomClick(classroom.id)}
                      >
                        <div className="flex justify-between items-start mb-4">
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-base md:text-lg mb-1 group-hover:text-primary transition-smooth truncate">
                              {classroom.name}
                            </h3>
                            <p className="text-xs md:text-sm text-muted-foreground truncate">
                              {classroom.subject || classroom.topic || "No subject"}
                            </p>
                          </div>
                          <Badge
                            variant="secondary"
                            className="bg-primary/20 text-primary border-primary/30 ml-2 flex-shrink-0 hover:bg-primary/30 transition-smooth"
                          >
                            {classroom.members}{" "}
                            {classroom.members === 1 ? "member" : "members"}
                          </Badge>
                        </div>

                        <div className="mb-4">
                          <div className="flex justify-between mb-2">
                            <span className="text-xs md:text-sm text-muted-foreground font-medium">
                              Progress
                            </span>
                            <span className="text-xs md:text-sm font-bold text-primary">
                              {classroom.progress}%
                            </span>
                          </div>
                          <Progress value={classroom.progress} className="h-2.5 group-hover:h-3 transition-smooth" />
                        </div>

                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full group-hover:bg-primary group-hover:text-primary-foreground group-hover:border-primary transition-smooth"
                        >
                          Enter Classroom
                          <ArrowRight className="ml-2 h-3 w-3 group-hover:translate-x-1 transition-smooth" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right Sidebar - Calendar and Leaderboard - Enhanced */}
          <div className="lg:col-span-1 space-y-4 md:space-y-6">
            {/* Activity Calendar Section - Enhanced */}
            <Card className="bg-gradient-card border-border/50 glow-card hover:border-primary/30 transition-smooth hover:shadow-lg hover:shadow-primary/10 animate-slide-up group w-full" style={{ animationDelay: '0.1s' }}>
              <CardHeader>
                <CardTitle className="flex items-center group-hover:text-primary transition-smooth">
                  <div className="mr-2 p-1.5 bg-primary/10 rounded-lg group-hover:bg-primary/20 transition-smooth">
                    <CalendarIcon className="h-5 w-5 text-primary" />
                  </div>
                  Activity Calendar
                </CardTitle>
                <CardDescription>
                  Track your active days
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoadingCalendar ? (
                  <div className="text-center py-8">
                    <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin mx-auto mb-3"></div>
                    <p className="text-sm text-muted-foreground">Loading calendar...</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center">
                    <Calendar
                      mode="single"
                      selected={undefined}
                      month={currentMonth}
                      onMonthChange={setCurrentMonth}
                      className="rounded-md border-0"
                      modifiers={{
                        active: (date) => {
                          const dateStr = date.toISOString().split('T')[0];
                          return activeDates.has(dateStr);
                        },
                      }}
                      modifiersClassNames={{
                        active: "bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground rounded-md shadow-md shadow-primary/30",
                      }}
                      classNames={{
                        months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
                        month: "space-y-4",
                        caption: "flex justify-center pt-1 relative items-center",
                        caption_label: "text-sm font-semibold",
                        nav: "space-x-1 flex items-center",
                        nav_button: "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100 hover:bg-primary/10 rounded-md transition-smooth",
                        nav_button_previous: "absolute left-1",
                        nav_button_next: "absolute right-1",
                        table: "w-full border-collapse space-y-1",
                        head_row: "flex",
                        head_cell: "text-muted-foreground rounded-md w-9 font-normal text-[0.8rem]",
                        row: "flex w-full mt-2",
                        cell: "h-9 w-9 text-center text-sm p-0 relative [&:has([aria-selected].day-range-end)]:rounded-r-md [&:has([aria-selected].day-outside)]:bg-accent/50 [&:has([aria-selected])]:bg-accent first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20",
                        day: "h-9 w-9 p-0 font-normal aria-selected:opacity-100 rounded-md hover:bg-accent hover:text-accent-foreground transition-smooth",
                        day_range_end: "day-range-end",
                        day_selected: "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
                        day_today: "bg-accent text-accent-foreground font-semibold border-2 border-primary/30",
                        day_outside: "day-outside text-muted-foreground opacity-50 aria-selected:bg-accent/50 aria-selected:text-muted-foreground aria-selected:opacity-30",
                        day_disabled: "text-muted-foreground opacity-50",
                        day_range_middle: "aria-selected:bg-accent aria-selected:text-accent-foreground",
                        day_hidden: "invisible",
                      }}
                    />
                    <div className="mt-4 flex flex-col items-center gap-2 text-xs text-muted-foreground w-full px-2">
                      <div className="flex items-center gap-2 w-full justify-center">
                        <div className="w-3 h-3 rounded-md bg-primary shadow-sm shadow-primary/50"></div>
                        <span>Active Day</span>
                      </div>
                      <div className="flex items-center gap-2 w-full justify-center">
                        <div className="w-3 h-3 rounded-md bg-accent border border-primary/30"></div>
                        <span>Today</span>
                      </div>
                    </div>
                    {activeDates.size > 0 && (
                      <div className="mt-3 text-center text-xs px-4 py-2 bg-primary/10 rounded-lg border border-primary/20 w-full">
                        <span className="font-bold text-primary text-base">
                          {activeDates.size}
                        </span>{" "}
                        <span className="text-muted-foreground">
                          {activeDates.size === 1 ? "active day" : "active days"} total
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Leaderboard Section - Enhanced */}
            <Card className="bg-gradient-card border-border/50 glow-card hover:border-primary/30 transition-smooth hover:shadow-lg hover:shadow-primary/10 animate-slide-up group w-full" style={{ animationDelay: '0.15s' }}>
              <CardHeader>
                <CardTitle className="flex items-center group-hover:text-primary transition-smooth">
                  <div className="mr-2 p-1.5 bg-primary/10 rounded-lg group-hover:bg-primary/20 transition-smooth">
                    <Trophy className="h-5 w-5 text-primary" />
                  </div>
                  Leaderboard
                </CardTitle>
                <CardDescription>
                  See how you rank
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoadingLeaderboard ? (
                  <div className="text-center py-8">
                    <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin mx-auto mb-3"></div>
                    <p className="text-sm text-muted-foreground">Loading leaderboard...</p>
                  </div>
                ) : leaderboard.length === 0 ? (
                  <div className="text-center py-8">
                    <Trophy className="h-10 w-10 mx-auto mb-3 text-muted-foreground animate-pulse" />
                    <p className="text-xs text-muted-foreground">No users found yet.</p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1 custom-scrollbar">
                    {leaderboard.map((entry, index) => (
                      <div
                        key={entry.user_id}
                        className={`flex items-center gap-2 md:gap-3 p-2.5 md:p-3 rounded-xl transition-smooth border cursor-default hover:scale-[1.02] ${
                          entry.is_current_user
                            ? "bg-primary/20 border-2 border-primary glow-feature shadow-lg shadow-primary/20"
                            : "bg-background/30 border border-transparent hover:border-primary/20 hover:bg-background/50"
                        }`}
                        style={{ animationDelay: `${index * 0.02}s` }}
                      >
                        {/* Rank */}
                        <div
                          className={`flex-shrink-0 w-7 h-7 md:w-8 md:h-8 rounded-full flex items-center justify-center font-bold text-xs shadow-sm ${
                            entry.rank === 1
                              ? "bg-yellow-500/20 text-yellow-500 border border-yellow-500/30"
                              : entry.rank === 2
                              ? "bg-gray-400/20 text-gray-400 border border-gray-400/30"
                              : entry.rank === 3
                              ? "bg-amber-600/20 text-amber-600 border border-amber-600/30"
                              : entry.is_current_user
                              ? "bg-primary/30 text-primary border border-primary/40"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {entry.rank === 1 ? "🥇" : entry.rank === 2 ? "🥈" : entry.rank === 3 ? "🥉" : entry.rank || (index + 1)}
                        </div>

                        {/* Avatar */}
                        <Avatar className="h-9 w-9 md:h-10 md:w-10 flex-shrink-0 ring-2 ring-background/50 hover:ring-primary/30 transition-smooth">
                          <AvatarImage src={entry.avatar} alt={entry.name} className="object-cover" />
                          <AvatarFallback className="bg-gradient-primary text-primary-foreground text-xs">
                            {entry.name
                              .split(" ")
                              .map((n) => n[0])
                              .join("")
                              .toUpperCase()}
                          </AvatarFallback>
                        </Avatar>

                        {/* User Info */}
                        <div className="flex-1 min-w-0">
                          <p
                            className={`font-semibold text-xs md:text-sm truncate ${
                              entry.is_current_user ? "text-primary" : "group-hover:text-primary transition-smooth"
                            }`}
                          >
                            {entry.name}
                            {entry.is_current_user && (
                              <span className="ml-1 text-xs bg-primary/20 px-1.5 py-0.5 rounded">You</span>
                            )}
                          </p>
                          <div className="flex items-center gap-1.5 md:gap-2 mt-0.5 text-xs text-muted-foreground">
                            <span className="font-bold text-foreground">
                              {typeof entry.performance_score === 'number' 
                                ? entry.performance_score.toFixed(1) 
                                : entry.performance_score || '0.0'}
                            </span>
                            <span className="text-muted-foreground">•</span>
                            <span>{entry.total_exams || 0} {entry.total_exams === 1 ? 'exam' : 'exams'}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserProfile;
