import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    proxy: {
      // Single proxy rule for all API requests - catches everything first
      "^/(api|request_otp|verify_otp|register|login|logout|me|profile|upload|stream_summary|uploads|ai_hub)":
        {
          target: "http://localhost:5000",
          changeOrigin: true,
          secure: false,
          bypass(req, res, options) {
            const path = req.url || "";
            const method = req.method || "";

            // List of frontend page routes that should NEVER be proxied (GET requests only)
            const frontendPageRoutes = [
              "/profile", // Frontend page route (not API)
              "/dashboard",
              "/create-profile",
              "/create-classroom",
              "/exams",
              "/media",
            ];

            // Don't proxy GET requests to frontend page routes
            if (
              method === "GET" &&
              frontendPageRoutes.some((route) => path.startsWith(route))
            ) {
              return path; // Let Vite handle it (serve index.html)
            }

            // Don't proxy GET requests to /login or /register (these are frontend pages)
            if (
              method === "GET" &&
              (path === "/login" || path === "/register")
            ) {
              return path; // Let Vite handle it
            }

            // Don't proxy GET requests to /profile (it's a page route, not /profile/create or /profile/get)
            if (method === "GET" && path === "/profile") {
              return path; // Let Vite handle it
            }

            // Proxy all other requests (POST, PUT, DELETE, etc. to these endpoints)
            // Also proxy API endpoints like /profile/create, /profile/get, /api/*, etc.
            return null; // Proceed with proxy
          },
        },
    },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(
    Boolean
  ),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
