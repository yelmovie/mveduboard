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
import { ResetPasswordRequestModal } from "./components/ResetPasswordRequestModal";
import { FooterPage } from "./components/FooterPages"; // Import FooterPage
import { Participant } from "./types";
import * as api from "./services/boardService";
import { HealthDebugPage } from "./src/pages/debug/HealthDebugPage";
import { ResetPasswordPage } from "./src/pages/ResetPasswordPage";
import { getCurrentUserProfile, getSession, ensureTeacherProfile } from "./src/lib/supabase/auth";
import { supabase } from "./src/lib/supabase/client";
import { isAuthDebug } from "./src/config/supabase";
import { initializeClassRenewal } from "./src/lib/report/classRenewal";
import { clearRosterCache } from "./services/studentService";

export default function App() {
  const pathname =
    typeof window !== "undefined" ? window.location.pathname : "";
  const [currentApp, setCurrentApp] = useState<string | null>(null);
  const [isTeacherLoggedIn, setIsTeacherLoggedIn] = useState(false);
  const [teacherName, setTeacherName] = useState("");

  // Login Modals State
  const [isTeacherLoginOpen, setIsTeacherLoginOpen] = useState(false);
  const [isTeacherSignupMode, setIsTeacherSignupMode] = useState(false);
  const [isResetPasswordRequestOpen, setIsResetPasswordRequestOpen] = useState(false);
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

  // Bootstrap: TEMP debug log (no tokens); redact URL after '#'
  useEffect(() => {
    if (!supabase || typeof window === "undefined") return;
    if (pathname.startsWith("/reset-password")) return;
    const href = window.location.href;
    const redacted = href.includes("#") ? href.split("#")[0] + "#..." : href;
    const hashHasAccessToken = window.location.hash.includes("access_token");
    getSession().then((s) => {
      if (isAuthDebug()) {
        console.log("[auth bootstrap] url (redacted):", redacted, "hashHasAccessToken:", hashHasAccessToken, "getSession:", s ? "ok" : "null");
      }
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (pathname.startsWith("/reset-password")) return;
    const initProfile = async () => {
      if (!supabase) return;
      let session = await getSession();
      if (typeof window !== "undefined" && isAuthDebug()) {
        console.log("[앱 초기화] getSession() 결과:", session ? "있음" : "null");
      }
      // OAuth callback: URL hash may not be processed yet; wait and retry once before treating as no session
      if (!session && typeof window !== "undefined" && window.location.hash.includes("access_token")) {
        await new Promise((r) => setTimeout(r, 800));
        session = await getSession();
        if (typeof window !== "undefined" && isAuthDebug()) {
          console.log("[앱 초기화] after wait for URL session getSession():", session ? "있음" : "null");
        }
      }
      if (!session) {
        setIsTeacherLoggedIn(false);
        setTeacherName("");
        return;
      }
      const profile = await getCurrentUserProfile();
      if (profile?.role === "teacher") {
        setIsTeacherLoggedIn(true);
        setTeacherName(profile.display_name || "");
      } else {
        setIsTeacherLoggedIn(false);
        setTeacherName("");
      }
    };
    initProfile();
  }, []);

  useEffect(() => {
    if (currentApp === "dashboard" && !isTeacherLoggedIn) {
      setCurrentApp(null);
    }
  }, [currentApp, isTeacherLoggedIn]);

  // Supabase auth 상태와 UI 동기화 (세션 복구/만료 시 대시보드 표시 정확히 유지)
  useEffect(() => {
    if (!supabase) return;
    const isResetPage = typeof window !== "undefined" && window.location.pathname.startsWith("/reset-password");
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (typeof window !== "undefined" && isAuthDebug()) {
        console.log("[onAuthStateChange]", event, "session:", session ? "있음" : "null");
      }
      // /reset-password 페이지에서는 recovery 세션 처리를 ResetPasswordPage에 위임
      if (isResetPage && (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN" || event === "INITIAL_SESSION")) {
        return;
      }
      // INITIAL_SESSION with null can happen before URL hash is processed (OAuth callback); defer and re-check
      if (event === "INITIAL_SESSION" && !session && typeof window !== "undefined" && window.location.hash.includes("access_token")) {
        setTimeout(async () => {
          const retry = await getSession();
          if (retry) {
            if (isAuthDebug()) console.log("[onAuthStateChange] after URL recovery getSession(): ok");
            await ensureTeacherProfile(retry.user);
            const profile = await getCurrentUserProfile();
            if (profile?.role === "teacher") {
              setIsTeacherLoggedIn(true);
              setTeacherName(profile.display_name || "");
            } else {
              setIsTeacherLoggedIn(false);
              setTeacherName("");
            }
          } else {
            setIsTeacherLoggedIn(false);
            setTeacherName("");
          }
        }, 800);
        return;
      }
      if (event === "SIGNED_OUT" || (event === "INITIAL_SESSION" && !session) || !session) {
        setIsTeacherLoggedIn(false);
        setTeacherName("");
        return;
      }
      if (session && (event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || event === "INITIAL_SESSION")) {
        if (typeof window !== "undefined" && isAuthDebug()) {
          const s = await getSession();
          console.log("[로그인 직후] getSession():", s ? "있음" : "null");
        }
        await ensureTeacherProfile(session.user);
        const profile = await getCurrentUserProfile();
        if (profile?.role === "teacher") {
          setIsTeacherLoggedIn(true);
          setTeacherName(profile.display_name || "");
        } else {
          setIsTeacherLoggedIn(false);
          setTeacherName("");
        }
      }
    });
    return () => subscription.unsubscribe();
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
    if (!isTeacherLoggedIn) {
      setIsTeacherLoginOpen(true);
      return;
    }
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
    setCurrentApp(appId);
  };

  // Pathname-only routes (훅 이후 분기)
  if (pathname.startsWith("/debug/health") || pathname.startsWith("/debug/supabase")) {
    return <HealthDebugPage />;
  }
  if (pathname === "/reset-password" || pathname.startsWith("/reset-password/")) {
    return <ResetPasswordPage />;
  }

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
    if (!isTeacherLoggedIn) {
      return null;
    }
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
          onForgotPassword={() => { setIsTeacherLoginOpen(false); setIsResetPasswordRequestOpen(true); }}
        />
      )}

      {isResetPasswordRequestOpen && (
        <ResetPasswordRequestModal onClose={() => setIsResetPasswordRequestOpen(false)} />
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
