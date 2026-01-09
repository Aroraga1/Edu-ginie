import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import HomePage from "./pages/HomePage";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import CreateUserProfile from "./pages/CreateUserProfile";
import UserProfile from "./pages/UserProfile";
import ClassroomCreation from "./pages/ClassroomCreation";
import Dashboard from "./pages/Dashboard";
import ExamCreation from "./pages/ExamCreation";
import MediaManager from "./pages/MediaManager";
import NotFound from "./pages/NotFound";
import { ProtectedRoute } from "./components/ProtectedRoute";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={
            <ProtectedRoute>
              <HomePage />
            </ProtectedRoute>
          } />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/create-profile" element={<CreateUserProfile />} />
          <Route path="/profile" element={<UserProfile />} />
          <Route path="/create-classroom" element={<ClassroomCreation />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/exams" element={<ExamCreation />} />
          <Route path="/media" element={<MediaManager />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
