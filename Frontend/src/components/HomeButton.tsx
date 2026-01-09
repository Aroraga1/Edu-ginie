import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Home } from "lucide-react";

interface HomeButtonProps {
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "sm" | "lg";
  className?: string;
  showText?: boolean;
}

/**
 * Smart Home Button component that redirects to profile if user is logged in,
 * otherwise redirects to homepage
 */
export const HomeButton = ({ 
  variant = "outline", 
  size = "default",
  className = "",
  showText = true 
}: HomeButtonProps) => {
  const navigate = useNavigate();

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    
    // Check if user is logged in
    const userProfile = localStorage.getItem("userProfile");
    if (userProfile) {
      try {
        const profile = JSON.parse(userProfile);
        // If profile exists and has user data, go to profile
        if (profile && (profile.name || profile.email)) {
          navigate("/profile", { replace: false });
          return;
        }
      } catch (e) {
        // If parsing fails, go to home
        console.error("Error parsing user profile:", e);
      }
    }
    
    // Not logged in, go to homepage
    navigate("/", { replace: false });
  };

  return (
    <Button
      variant={variant}
      size={size}
      className={className}
      onClick={handleClick}
    >
      <Home className={showText ? "mr-2 h-4 w-4" : "h-4 w-4"} />
      {showText && "Back to Home"}
    </Button>
  );
};

