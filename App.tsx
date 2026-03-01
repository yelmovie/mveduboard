import React, { useState, useEffect } from "react";
import { LandingPage } from "./components/LandingPage";
import { BoardApp } from "./BoardApp";
import { ChatApp } from "./components/ChatApp";
import { NoticeApp } from "./components/NoticeApp";
import { TodoApp } from "./components/TodoApp";
import { MangaApp } from "./components/MangaApp";
import { LunchApp } from "./components/LunchApp";
import { CouponApp } from "./components/CouponApp";
import { MeetingApp } from "./components/MeetingApp";
import { RoleApp } from "./components/RoleApp";
import { WordSearchApp } from "./components/WordSearchApp";
import { PlannerApp } from "./components/PlannerApp";
import { MessageApp } from "./components/MessageApp";
import { PointApp } from "./components/PointApp";
import { OccasionApp } from "./components/OccasionApp";
import { ScheduleApp } from "./components/ScheduleApp";
import { ToolsApp } from "./components/ToolsApp";
import { ManagementApp } from "./components/ManagementApp";
import { LearningApp } from "./components/LearningApp";
import { ClassBoardApp } from "./components/ClassBoardApp";
import { ContactApp } from "./components/ContactApp";
import { TeacherDashboard } from "./components/TeacherDashboard";
import { StudentLoginModal } from "./components/StudentLoginModal";
import { TeacherLoginModal } from "./components/TeacherLoginModal";
import { FooterPage } from "./components/FooterPages"; // Import FooterPage
import { Participant } from "./types";
import * as api from "./services/boardService";
import { HealthDebugPage } from "./src/pages/debug/HealthDebugPage";
import { getCurrentUserProfile } from "./src/lib/supabase/auth";
import { initializeClassRenewal } from "./src/lib/report/classRenewal";
import { clearRosterCache } from "./services/studentService";

export default function App() {
  const pathname =
    typeof window !== "undefined" ? window.location.pathname : "";
  if (
    pathname.startsWith("/debug/health") ||
    pathname.startsWith("/debug/supabase")
  ) {
    return <HealthDebugPage />;
  }
  const [currentApp, setCurrentApp] = useState<string | null>(null);
  const [isTeacherLoggedIn, setIsTeacherLoggedIn] = useState(false);
  const [teacherName, setTeacherName] = useState("");

  // Login Modals State
  const [isTeacherLoginOpen, setIsTeacherLoginOpen] = useState(false);
  const [isTeacherSignupMode, setIsTeacherSignupMode] = useState(false); // Track if it's signup or login
  const [isStudentLoginOpen, setIsStudentLoginOpen] = useState(false);

  // Student Data
  const [student, setStudent] = useState<Participant | null>(null);

  // 학급 정보 갱신 체크 (앱 시작 시 한 번만)
  useEffect(() => {
    initializeClassRenewal();
  }, []);

  useEffect(() => {
    // Check for existing student session
    const storedStudent = api.getStoredParticipant();
    if (storedStudent) {
      setStudent(storedStudent);
    }
  }, []);

  useEffect(() => {
    const initProfile = async () => {
      const profile = await getCurrentUserProfile();
      if (profile?.role === "teacher") {
        setIsTeacherLoggedIn(true);
        setTeacherName(profile.display_name || "");
      }
    };
    initProfile();
  }, []);

  useEffect(() => {
    if (!isTeacherLoggedIn) {
      setTeacherName("");
      return;
    }
    const loadProfile = async () => {
      const profile = await getCurrentUserProfile();
      if (profile?.role === "teacher") {
        setTeacherName(profile.display_name || "");
      }
    };
    loadProfile();
  }, [isTeacherLoggedIn]);

  // --- Teacher Login/Signup Handlers ---
  const handleTeacherLoginClick = () => {
    setIsTeacherSignupMode(false);
    setIsTeacherLoginOpen(true);
  };

  const handleTeacherSignupClick = () => {
    setIsTeacherSignupMode(true);
    setIsTeacherLoginOpen(true);
  };

  const handleTeacherLoginSuccess = () => {
    setIsTeacherLoggedIn(true);
    setCurrentApp("dashboard"); // Automatically go to dashboard
  };

  const handleTeacherLogout = () => {
    setIsTeacherLoggedIn(false);
    setCurrentApp(null); // Return to landing page
    // Clear roster cache on logout
    clearRosterCache();
    alert("로그아웃 되었습니다.");
  };

  const handleOpenDashboard = () => {
    setCurrentApp("dashboard");
  };

  // --- Student Login Handlers ---
  const handleStudentLoginSuccess = (p: Participant) => {
    setStudent(p);
  };

  const handleStudentLogout = () => {
    api.logoutParticipant();
    setStudent(null);
  };

  const handleSelectApp = (appId: string) => {
    // Direct mapping or fallback
    setCurrentApp(appId);
  };

  // --- App Switching ---

  // Handle Footer Pages
  if (
    [
      "features",
      "use_cases",
      "pricing",
      "faq",
      "terms",
      "privacy",
      "community",
      "materials",
      "news",
    ].includes(currentApp || "")
  ) {
    return (
      <FooterPage pageId={currentApp!} onBack={() => setCurrentApp(null)} />
    );
  }

  if (currentApp === "dashboard") {
    return (
      <TeacherDashboard
        onSelectApp={handleSelectApp}
        onBack={() => setCurrentApp(null)}
        onLogout={handleTeacherLogout}
      />
    );
  }

  // Contact App (Added)
  if (currentApp === "contact") {
    return <ContactApp onBack={() => setCurrentApp(null)} />;
  }

  // Management App (Notice, Coupon, Meeting, Points, Roles)
  if (currentApp === "management") {
    return (
      <ManagementApp
        onBack={() => setCurrentApp(null)}
        isTeacherMode={isTeacherLoggedIn}
        student={student}
        onLoginRequest={() => setIsStudentLoginOpen(true)}
      />
    );
  }

  // Learning Tasks App (Learning Note, Writing, Reading, Math)
  if (currentApp === "tasks") {
    return (
      <LearningApp
        onBack={() => setCurrentApp(null)}
        isTeacherMode={isTeacherLoggedIn}
        student={student}
        onLoginRequest={() => setIsStudentLoginOpen(true)}
      />
    );
  }

  // Tools Container App (Timer, Dice, Bingo, Picker, Seat, Career, WordSearch)
  if (currentApp === "tools") {
    return (
      <ToolsApp
        onBack={() => setCurrentApp(null)}
        isTeacherMode={isTeacherLoggedIn}
        student={student}
        onLoginRequest={() => setIsStudentLoginOpen(true)}
      />
    );
  }

  // Class Board App (Free Board, Gallery, Manga, Album, Chat)
  if (currentApp === "class_board") {
    return (
      <ClassBoardApp
        onBack={() => setCurrentApp(null)}
        isTeacherMode={isTeacherLoggedIn}
        student={student}
        onLoginRequest={() => setIsStudentLoginOpen(true)}
      />
    );
  }

  // Schedule App (Custom Planner)
  if (currentApp === "schedule") {
    return (
      <ScheduleApp
        onBack={() => setCurrentApp(null)}
        isTeacherMode={isTeacherLoggedIn}
        student={student}
        onLoginRequest={() => setIsStudentLoginOpen(true)}
      />
    );
  }

  // Planner App (Study Guide, Timetable, School Plan, Lunch)
  if (currentApp === "planner") {
    return (
      <PlannerApp
        onBack={() => setCurrentApp(null)}
        isTeacherMode={isTeacherLoggedIn}
        student={student}
        onLoginRequest={() => setIsStudentLoginOpen(true)}
      />
    );
  }

  // Board Apps (Multiple types sharing same component but different ID)
  // Removed 'album'
  if (
    [
      "board",
      "writing",
      "reading",
      "math",
      "learning",
      "gallery",
      "refine",
      "roster",
      "handbook",
    ].includes(currentApp || "")
  ) {
    return (
      <BoardApp
        boardId={currentApp || "board"}
        onBack={() => setCurrentApp(null)}
        isTeacherMode={isTeacherLoggedIn}
        student={student}
        onLoginRequest={() => setIsStudentLoginOpen(true)}
      />
    );
  }

  if (currentApp === "talk") {
    // Redirect to class board since talk is now a tab there
    return (
      <ClassBoardApp
        onBack={() => setCurrentApp(null)}
        isTeacherMode={isTeacherLoggedIn}
        student={student}
        onLoginRequest={() => setIsStudentLoginOpen(true)}
      />
    );
  }

  // Individual fallbacks if called directly (e.g. from Dashboard)

  if (currentApp === "notice") {
    return (
      <NoticeApp
        onBack={() => setCurrentApp(null)}
        isTeacherMode={isTeacherLoggedIn}
      />
    );
  }

  if (currentApp === "todo") {
    return (
      <TodoApp
        onBack={() => setCurrentApp(null)}
        isTeacherMode={isTeacherLoggedIn}
        student={student}
        onLoginRequest={() => setIsStudentLoginOpen(true)}
      />
    );
  }

  if (currentApp === "manga") {
    return (
      <MangaApp
        onBack={() => setCurrentApp(null)}
        isTeacherMode={isTeacherLoggedIn}
        student={student}
        onLoginRequest={() => setIsStudentLoginOpen(true)}
      />
    );
  }

  if (currentApp === "lunch") {
    // Redirect to planner since lunch is now a tab there
    return (
      <PlannerApp
        onBack={() => setCurrentApp(null)}
        isTeacherMode={isTeacherLoggedIn}
        student={student}
        onLoginRequest={() => setIsStudentLoginOpen(true)}
      />
    );
  }

  if (currentApp === "coupon") {
    return (
      <CouponApp
        onBack={() => setCurrentApp(null)}
        isTeacherMode={isTeacherLoggedIn}
      />
    );
  }

  if (currentApp === "meeting") {
    return (
      <MeetingApp
        onBack={() => setCurrentApp(null)}
        isTeacherMode={isTeacherLoggedIn}
        student={student}
        onLoginRequest={() => setIsStudentLoginOpen(true)}
      />
    );
  }

  if (currentApp === "roles") {
    return (
      <RoleApp
        onBack={() => setCurrentApp(null)}
        isTeacherMode={isTeacherLoggedIn}
      />
    );
  }

  if (currentApp === "bingo") {
    return (
      <ToolsApp
        onBack={() => setCurrentApp(null)}
        isTeacherMode={isTeacherLoggedIn}
        student={student}
        onLoginRequest={() => setIsStudentLoginOpen(true)}
      />
    );
  }

  if (currentApp === "message") {
    return (
      <MessageApp
        onBack={() => setCurrentApp(null)}
        isTeacherMode={isTeacherLoggedIn}
        student={student}
        onLoginRequest={() => setIsStudentLoginOpen(true)}
      />
    );
  }

  if (currentApp === "points") {
    return (
      <PointApp
        onBack={() => setCurrentApp(null)}
        isTeacherMode={isTeacherLoggedIn}
      />
    );
  }

  if (currentApp === "occasion") {
    return (
      <OccasionApp
        onBack={() => setCurrentApp(null)}
        isTeacherMode={isTeacherLoggedIn}
      />
    );
  }

  return (
    <>
      <LandingPage
        onSelectApp={handleSelectApp}
        isLoggedIn={isTeacherLoggedIn}
        onLogin={handleTeacherLoginClick}
        onTeacherSignup={handleTeacherSignupClick}
        onLogout={handleTeacherLogout}
        onOpenDashboard={handleOpenDashboard}
        student={student}
        teacherName={teacherName}
        onStudentLogin={() => setIsStudentLoginOpen(true)}
        onStudentLogout={handleStudentLogout}
      />

      {isTeacherLoginOpen && (
        <TeacherLoginModal
          isSignup={isTeacherSignupMode}
          onClose={() => setIsTeacherLoginOpen(false)}
          onLoginSuccess={handleTeacherLoginSuccess}
        />
      )}

      {isStudentLoginOpen && (
        <StudentLoginModal
          onClose={() => setIsStudentLoginOpen(false)}
          onLoginSuccess={handleStudentLoginSuccess}
        />
      )}
    </>
  );
}
