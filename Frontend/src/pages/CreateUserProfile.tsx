import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { User, ArrowRight, Sparkles } from "lucide-react";
import { me, createProfile, checkProfileExists } from "@/lib/api";

const CreateUserProfile = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [existingUser, setExistingUser] = useState<any>(null);

  // Form state
  const [formData, setFormData] = useState({
    bio: "",
    interests: "",
    learningGoals: "",
    preferredLearningStyle: "Visual", // Visual, Auditory, Kinesthetic, Reading/Writing
    difficultyLevel: "Intermediate", // Beginner, Intermediate, Advanced
    timeCommitment: "1-2 hours/day",
  });

  // Check if profile exists and fetch user data
  useEffect(() => {
    const checkAndFetch = async () => {
      try {
        // Wait a bit for session to be ready
        await new Promise((resolve) => setTimeout(resolve, 300));

        // First, check if profile already exists
        try {
          const profileResponse = await checkProfileExists();
          if (profileResponse?.success && profileResponse?.profile) {
            // Profile already exists - redirect to profile page
            navigate("/profile");
            return;
          }
        } catch (profileError: any) {
          // 404 means profile doesn't exist - that's fine, continue
          if (profileError?.response?.status !== 404) {
            console.error("Error checking profile:", profileError);
          }
        }

        // Profile doesn't exist - continue with profile creation
        // Try to get from localStorage first (from registration)
        const tempUserData = localStorage.getItem("tempUserData");
        if (tempUserData) {
          try {
            setExistingUser(JSON.parse(tempUserData));
            localStorage.removeItem("tempUserData");
          } catch (e) {
            console.error("Error parsing temp user data:", e);
          }
        }

        // If no temp data, try to fetch from backend
        if (!existingUser) {
          try {
            const userResponse = await me();
            setExistingUser(userResponse?.user);
          } catch (error: any) {
            // If 401, user needs to login
            if (error?.response?.status === 401) {
              navigate("/login");
            }
          }
        }
      } catch (error) {
        console.error("Error in checkAndFetch:", error);
      }
    };

    checkAndFetch();
  }, [navigate]);

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!existingUser) {
      console.error("User data not found");
      navigate("/login");
      return;
    }

    // Validate required fields
    if (!formData.bio.trim()) {
      console.error("Bio is required");
      return;
    }

    if (!formData.interests.trim()) {
      console.error("Interests are required");
      return;
    }

    setIsLoading(true);

    try {
      // Parse interests (comma-separated)
      const interestsList = formData.interests
        .split(",")
        .map((i) => i.trim())
        .filter(Boolean);

      // Prepare profile data
      const profileData = {
        userId: existingUser.id || existingUser.email,
        bio: formData.bio.trim(),
        interests: interestsList,
        learningGoals: formData.learningGoals.trim(),
        preferredLearningStyle: formData.preferredLearningStyle,
        difficultyLevel: formData.difficultyLevel,
        timeCommitment: formData.timeCommitment,
        // Initialize gamification stats
        totalProgress: 0,
        currentStreak: 0,
        longestStreak: 0,
        totalBadges: 0,
        createdAt: new Date().toISOString(),
      };

      // Save profile to backend
      const response = await createProfile(profileData);

      if (
        response?.success ||
        response?.message === "Profile created successfully"
      ) {
        // Create complete profile object for localStorage
        const completeProfile = {
          ...existingUser,
          ...profileData,
          name: existingUser.name || existingUser.full_name,
          email: existingUser.email,
          username: existingUser.username,
          age: existingUser.age,
          education: existingUser.education,
          language: existingUser.language,
          avatar: existingUser.photo || "/placeholder.svg",
          joinDate: new Date().toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
          }),
        };

        // Save to localStorage for quick access
        localStorage.setItem("userProfile", JSON.stringify(completeProfile));

        navigate("/profile");
      } else {
        throw new Error(response?.message || "Failed to create profile");
      }
    } catch (error: any) {
      console.error("Error creating profile:", error);
    } finally {
      setIsLoading(false);
    }
  };

  if (!existingUser) {
    return (
      <div className="min-h-screen bg-gradient-hero flex items-center justify-center p-6">
        <Card className="bg-gradient-card border-border glow-card max-w-md w-full">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="relative mb-8">
              <div className="w-24 h-24 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
              <Sparkles className="absolute inset-0 m-auto h-8 w-8 text-primary animate-pulse" />
            </div>
            <h3 className="text-2xl font-semibold mb-2">Loading...</h3>
            <p className="text-muted-foreground text-center">
              Fetching your account information
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-hero flex items-center justify-center p-6">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl md:text-5xl font-bold mb-4 text-gradient">
            Create Your Learning Profile
          </h1>
          <p className="text-xl text-muted-foreground">
            Tell us about yourself to personalize your learning experience
          </p>
        </div>

        {/* Profile Creation Form */}
        <Card className="bg-gradient-card border-border glow-card">
          <CardHeader className="text-center">
            <CardTitle className="flex items-center justify-center text-2xl">
              <User className="mr-2 h-6 w-6 text-primary" />
              Profile Setup
            </CardTitle>
            <CardDescription>
              Complete your profile to unlock personalized learning features
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* User Info Display (Read-only) */}
              <div className="bg-background/30 rounded-lg p-4 mb-6">
                <h3 className="text-sm font-semibold text-primary mb-2">
                  Your Account Information
                </h3>
                <div className="grid md:grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-muted-foreground">Name:</span>
                    <span className="ml-2 font-medium">
                      {existingUser.name || existingUser.full_name}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Email:</span>
                    <span className="ml-2 font-medium">
                      {existingUser.email}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Education:</span>
                    <span className="ml-2 font-medium">
                      {existingUser.education || "Not specified"}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Language:</span>
                    <span className="ml-2 font-medium">
                      {existingUser.language || "English"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Bio */}
              <div className="space-y-2">
                <Label htmlFor="bio">About You *</Label>
                <Textarea
                  id="bio"
                  name="bio"
                  placeholder="Tell us about yourself, your background, and what you're passionate about..."
                  value={formData.bio}
                  onChange={handleChange}
                  className="bg-background/50 border-border focus:border-primary min-h-[100px]"
                  required
                />
              </div>

              {/* Interests */}
              <div className="space-y-2">
                <Label htmlFor="interests">Interests *</Label>
                <Input
                  id="interests"
                  name="interests"
                  type="text"
                  placeholder="e.g., AI, Programming, Mathematics, Science (comma-separated)"
                  value={formData.interests}
                  onChange={handleChange}
                  className="bg-background/50 border-border focus:border-primary"
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Separate multiple interests with commas
                </p>
              </div>

              {/* Learning Goals */}
              <div className="space-y-2">
                <Label htmlFor="learningGoals">Learning Goals</Label>
                <Textarea
                  id="learningGoals"
                  name="learningGoals"
                  placeholder="What do you want to achieve? e.g., Master Python programming, Learn machine learning basics..."
                  value={formData.learningGoals}
                  onChange={handleChange}
                  className="bg-background/50 border-border focus:border-primary min-h-[80px]"
                />
              </div>

              {/* Preferred Learning Style */}
              <div className="space-y-2">
                <Label htmlFor="preferredLearningStyle">
                  Preferred Learning Style
                </Label>
                <select
                  id="preferredLearningStyle"
                  name="preferredLearningStyle"
                  value={formData.preferredLearningStyle}
                  onChange={handleChange}
                  className="flex h-10 w-full rounded-md border border-border bg-background/50 px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <option value="Visual">
                    Visual (Diagrams, Charts, Videos)
                  </option>
                  <option value="Auditory">
                    Auditory (Discussions, Lectures, Audio)
                  </option>
                  <option value="Kinesthetic">
                    Kinesthetic (Hands-on, Practice, Experiments)
                  </option>
                  <option value="Reading/Writing">
                    Reading/Writing (Texts, Notes, Documentation)
                  </option>
                </select>
              </div>

              {/* Difficulty Level */}
              <div className="space-y-2">
                <Label htmlFor="difficultyLevel">
                  Preferred Difficulty Level
                </Label>
                <select
                  id="difficultyLevel"
                  name="difficultyLevel"
                  value={formData.difficultyLevel}
                  onChange={handleChange}
                  className="flex h-10 w-full rounded-md border border-border bg-background/50 px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <option value="Beginner">Beginner</option>
                  <option value="Intermediate">Intermediate</option>
                  <option value="Advanced">Advanced</option>
                </select>
              </div>

              {/* Time Commitment */}
              <div className="space-y-2">
                <Label htmlFor="timeCommitment">Daily Time Commitment</Label>
                <select
                  id="timeCommitment"
                  name="timeCommitment"
                  value={formData.timeCommitment}
                  onChange={handleChange}
                  className="flex h-10 w-full rounded-md border border-border bg-background/50 px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <option value="30 minutes/day">30 minutes/day</option>
                  <option value="1-2 hours/day">1-2 hours/day</option>
                  <option value="2-4 hours/day">2-4 hours/day</option>
                  <option value="4+ hours/day">4+ hours/day</option>
                </select>
              </div>

              {/* Submit Button */}
              <div className="pt-4">
                <Button
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-gradient-primary hover:opacity-90 glow-feature text-lg py-4"
                >
                  {isLoading ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin mr-2"></div>
                      Creating Profile...
                    </>
                  ) : (
                    <>
                      Create Profile
                      <ArrowRight className="ml-2 h-5 w-5" />
                    </>
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default CreateUserProfile;
