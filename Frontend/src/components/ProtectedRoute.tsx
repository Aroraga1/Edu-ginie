import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

interface ProtectedRouteProps {
  children: React.ReactNode;
  redirectTo?: string;
}

/**
 * ProtectedRoute component that redirects authenticated users
 * Used to redirect logged-in users away from public pages
 */
export const ProtectedRoute = ({
  children,
  redirectTo = "/profile",
}: ProtectedRouteProps) => {
  const navigate = useNavigate();

  useEffect(() => {
    // Check if user is logged in (has profile in localStorage)
    const userProfile = localStorage.getItem("userProfile");
    if (userProfile) {
      try {
        const profile = JSON.parse(userProfile);
        // If profile exists and has user data, redirect to profile
        if (profile && (profile.name || profile.email)) {
          navigate(redirectTo, { replace: true });
        }
      } catch (e) {
        // If parsing fails, continue to show the page
        console.error("Error parsing user profile:", e);
      }
    }
  }, [navigate, redirectTo]);

  return <>{children}</>;
};
