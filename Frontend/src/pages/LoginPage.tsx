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
import { Eye, EyeOff, LogIn, UserPlus } from "lucide-react";
import { HomeButton } from "@/components/HomeButton";
import { login, checkProfileExists } from "@/lib/api";

const LoginPage = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const navigate = useNavigate();
  const handleLogin = async () => {
    try {
      await login(identifier, password);
      // Wait a moment for session cookie to be set before navigating
      await new Promise((resolve) => setTimeout(resolve, 300));

      // Wait a bit more for session to be fully established
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Check if user has a profile
      const profileResponse = await checkProfileExists();
      if (profileResponse?.unauthorized) {
        // Session not established yet, wait and retry once
        await new Promise((resolve) => setTimeout(resolve, 500));
        const retryResponse = await checkProfileExists();
        if (retryResponse?.success && retryResponse?.profile) {
          navigate("/profile");
        } else {
          navigate("/create-profile");
        }
      } else if (profileResponse?.success && profileResponse?.profile) {
        // User has profile, go to profile page
        navigate("/profile");
      } else {
        // User doesn't have profile, go to create-profile
        navigate("/create-profile");
      }
    } catch (err: unknown) {
      const error = err as { response?: { data?: { msg?: string } } };
      const msg = error?.response?.data?.msg || "Login failed";
      console.error("Login error:", msg);
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
            Welcome Back
          </h1>
          <p className="text-xl text-muted-foreground">
            Continue your learning journey
          </p>
        </div>

        {/* Login Card */}
        <Card className="bg-gradient-card border-border glow-card">
          <CardHeader className="text-center">
            <CardTitle className="flex items-center justify-center text-2xl">
              <LogIn className="mr-2 h-6 w-6 text-primary" />
              Sign In
            </CardTitle>
            <CardDescription>
              Enter your credentials to access your account
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Email or Username Field */}
            <div className="space-y-2">
              <Label htmlFor="identifier">Email or Username</Label>
              <Input
                id="identifier"
                type="text"
                placeholder="email or username"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
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
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
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

            {/* Login Button */}
            <Button
              onClick={handleLogin}
              className="w-full bg-gradient-primary hover:opacity-90 glow-feature text-lg py-3"
            >
              Sign In
            </Button>

            {/* Register Link */}
            <div className="text-center">
              <span className="text-muted-foreground">
                Don't have an account?{" "}
              </span>
              <Link
                to="/register"
                className="text-primary hover:text-primary/80 font-medium story-link"
              >
                Create Account
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default LoginPage;
