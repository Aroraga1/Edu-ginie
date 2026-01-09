import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
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
import { Eye, EyeOff, UserPlus } from "lucide-react";
import { HomeButton } from "@/components/HomeButton";
import { requestOtp, verifyOtp, login, api } from "@/lib/api";

const RegisterPage = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    username: "",
    email: "",
    age: "",
    education: "",
    language: "",
    password: "",
    confirmPassword: "",
  });
  const navigate = useNavigate();
  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleRegister = async (e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();

    if (formData.password !== formData.confirmPassword) {
      console.error("Passwords do not match");
      return;
    }
    try {
      const payload = {
        name: formData.name,
        username: formData.username || formData.email.split("@")[0],
        email: formData.email,
        password: formData.password,
        age: Number(formData.age || 18),
        education: formData.education || "Student",
        language: formData.language || "English",
      };

      // Use direct registration (no OTP required)
      const response = await api.post("/register", payload);
      if (
        response.data?.success ||
        response.data?.msg === "Registration successful"
      ) {
        // Store user info temporarily for profile creation
        localStorage.setItem(
          "tempUserData",
          JSON.stringify({
            name: payload.name,
            email: payload.email,
            age: payload.age,
            education: payload.education,
            language: payload.language,
            username: payload.username,
          })
        );

        // Wait a bit for session cookie to be set
        setTimeout(() => {
          navigate("/create-profile");
        }, 300);
      } else {
        throw new Error(
          response.data?.msg || response.data?.message || "Registration failed"
        );
      }
    } catch (err: unknown) {
      const error = err as {
        response?: { data?: { msg?: string; message?: string } };
        message?: string;
      };
      const msg =
        error?.response?.data?.msg ||
        error?.response?.data?.message ||
        error?.message ||
        "Registration failed";
      console.error("Registration error:", msg, err);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-hero flex items-center justify-center p-6">
      {/* Navigation */}
      <div className="absolute top-6 left-6">
        <HomeButton
          variant="outline"
          className="border-primary text-primary hover:bg-primary/10"
        />
      </div>

      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-4 text-gradient">
            Join Edu Ginie
          </h1>
          <p className="text-xl text-muted-foreground">
            Start your AI-powered learning journey
          </p>
        </div>

        {/* Register Card */}
        <Card className="bg-gradient-card border-border glow-card">
          <CardHeader className="text-center">
            <CardTitle className="flex items-center justify-center text-2xl">
              <UserPlus className="mr-2 h-6 w-6 text-primary" />
              Create Account
            </CardTitle>
            <CardDescription>
              Fill in your details to get started
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Name Field */}
            <div className="space-y-2">
              <Label htmlFor="name">Full Name</Label>
              <Input
                id="name"
                type="text"
                placeholder="Your full name"
                value={formData.name}
                onChange={(e) => handleInputChange("name", e.target.value)}
                className="bg-background/50 border-border focus:border-primary"
              />
            </div>

            {/* Username Field */}
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                type="text"
                placeholder="yourusername"
                value={formData.username}
                onChange={(e) => handleInputChange("username", e.target.value)}
                className="bg-background/50 border-border focus:border-primary"
              />
            </div>

            {/* Email Field */}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="your@email.com"
                value={formData.email}
                onChange={(e) => handleInputChange("email", e.target.value)}
                className="bg-background/50 border-border focus:border-primary"
              />
            </div>

            {/* Age Field */}
            <div className="space-y-2">
              <Label htmlFor="age">Age</Label>
              <Input
                id="age"
                type="number"
                placeholder="18"
                value={formData.age}
                onChange={(e) => handleInputChange("age", e.target.value)}
                className="bg-background/50 border-border focus:border-primary"
              />
            </div>

            {/* Education Field */}
            <div className="space-y-2">
              <Label htmlFor="education">Education</Label>
              <Input
                id="education"
                type="text"
                placeholder="e.g., BSc 2nd Year"
                value={formData.education}
                onChange={(e) => handleInputChange("education", e.target.value)}
                className="bg-background/50 border-border focus:border-primary"
              />
            </div>

            {/* Language Field */}
            <div className="space-y-2">
              <Label htmlFor="language">Language</Label>
              <Input
                id="language"
                type="text"
                placeholder="English"
                value={formData.language}
                onChange={(e) => handleInputChange("language", e.target.value)}
                className="bg-background/50 border-border focus:border-primary"
              />
            </div>

            {/* Password Field */}
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Create a strong password"
                  value={formData.password}
                  onChange={(e) =>
                    handleInputChange("password", e.target.value)
                  }
                  className="bg-background/50 border-border focus:border-primary pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Eye className="h-4 w-4 text-muted-foreground" />
                  )}
                </Button>
              </div>
            </div>

            {/* Confirm Password Field */}
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="Confirm your password"
                  value={formData.confirmPassword}
                  onChange={(e) =>
                    handleInputChange("confirmPassword", e.target.value)
                  }
                  className="bg-background/50 border-border focus:border-primary pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  {showConfirmPassword ? (
                    <EyeOff className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Eye className="h-4 w-4 text-muted-foreground" />
                  )}
                </Button>
              </div>
            </div>

            {/* Register Button */}
            <Button
              type="button"
              onClick={handleRegister}
              className="w-full bg-gradient-primary hover:opacity-90 glow-feature text-lg py-3"
            >
              Create Account
            </Button>

            {/* Login Link */}
            <div className="text-center">
              <span className="text-muted-foreground">
                Already have an account?{" "}
              </span>
              <Link
                to="/login"
                className="text-primary hover:text-primary/80 font-medium story-link"
              >
                Sign In
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default RegisterPage;
