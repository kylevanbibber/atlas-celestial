// src/App.js
import React, { useEffect } from 'react';
import {
  Routes,
  Route,
  Navigate,
  useLocation,
  useNavigate,
} from "react-router-dom";
import Header from "./components/utils/Header";
import BottomNav from "./components/utils/BottomNav";
import Dashboard from "./pages/Dashboard";
import RefsPage from "./pages/refs/page";
import Production from "./pages/Production";
import ProductionOverview from "./pages/ProductionOverview";
import Reports from "./pages/Reports";
import ResourcesOverview from "./pages/ResourcesOverview";
import Training from "./pages/Training";
import Recruiting from "./pages/Recruiting";
import RecruitingOverview from "./pages/RecruitingOverview";
import Utilities from "./pages/utilities/Utilities";
import UtilitiesOverview from "./pages/UtilitiesOverview";
import OneOnOne from "./pages/OneOnOne";
import TeamCustomization from "./pages/utilities/TeamCustomization";
import NotificationsAdmin from "./pages/admin/Notifications";
import EmailCampaigns from "./pages/admin/EmailCampaigns";
import ProtectedRoute from "./components/ProtectedRoute";
import Login from "./pages/auth/Login";
import OnboardingLogin from "./pages/onboarding/OnboardingLogin";
import OnboardingRegister from "./pages/onboarding/OnboardingRegister";
import OnboardingForgot from "./pages/onboarding/OnboardingForgot";
import OnboardingResetPassword from "./pages/onboarding/OnboardingResetPassword";
import OnboardingHome from "./pages/onboarding/OnboardingHome";
import TermsOfService from "./pages/legal/TermsOfService";
import PrivacyPolicy from "./pages/legal/PrivacyPolicy";
// Removed AdminLogin import - admin users now use unified login system
import { AuthProvider, useAuth } from "./context/AuthContext";
import { ThemeProvider } from "./context/ThemeContext";
import { useTeamStyles, TeamStyleProvider } from './context/TeamStyleContext';
import { LicenseWarningProvider } from "./context/LicenseWarningContext";
import { NotificationProvider } from "./context/NotificationContext";
import { HeaderProvider } from "./context/HeaderContext";
import { AgencyProvider } from "./context/AgencyContext";
import { EmbeddedProvider, useEmbedded } from "./context/EmbeddedContext";
import NotificationUtilities from "./components/utilities/notification/NotificationUtilities";
import InPageNotificationContainer from "./components/notifications/InPageNotificationContainer";
import RefEntry from "./components/refvalidation/RefEntry";
import DocumentSigning from "./components/tools/DocumentSigning";
import ClientSigning from "./components/tools/ClientSigning";
import AgentDocumentSigning from "./components/tools/AgentDocumentSigning";
import AgentSigning from "./components/tools/AgentSigning";
import PresentationSetup from "./components/tools/PresentationSetup";
import PresentationSlideshow from "./components/tools/PresentationSlideshow";
import PresentationScripts from "./components/tools/PresentationScripts";
import { PromotionTracking } from "./components/promotion-tracking";
import { Toaster } from 'react-hot-toast';
import LicenseOnboardingModal from "./components/utilities/LicenseOnboardingModal";
import CalendlyCallback from "./pages/CalendlyCallback";
import ZoomCallback from "./pages/ZoomCallback";
import RecruitmentForm from "./pages/RecruitmentForm";
import RecruitmentSuccess from "./pages/RecruitmentSuccess";


import AdminHierarchySettings from "./components/admin/AdminHierarchySettings";
import LoginLogs from "./components/admin/LoginLogs";
import AdminCheck from "./pages/admin/AdminCheck";
import AnalyticsDashboard from "./pages/admin/AnalyticsDashboard";
import { logRedirect, logNavigation } from "./utils/navigationLogger";
import "./App.css";
import "./embedded.css";

// Placeholder component for pages under construction
const PlaceholderPage = ({ title }) => (
  <div style={{ padding: "2rem", textAlign: "center" }}>
    <h2>{title}</h2>
    <p>This page is under construction.</p>
  </div>
);

// AppContent component for handling auth logic and routes
function AppContent() {
  const { isAuthenticated, loading: authLoading, user, hasPermission } = useAuth();
  const { styles, loading: stylesLoading, teamName } = useTeamStyles();
  const { isEmbedded } = useEmbedded();
  const location = useLocation();
  const navigate = useNavigate();
  
  // Track location changes for navigation logging
  React.useEffect(() => {
    // Don't log navigation when the app is first loading
    if (!authLoading) {
      logNavigation(
        'previous',  // We don't have the previous location in this effect
        location.pathname + location.search,
        { 
          isAuthenticated, 
          userId: user?.userId,
          userRole: user?.Role
        }
      );
    }
  }, [location.pathname, location.search, isAuthenticated, user, authLoading]);

  // Helper function to get dynamic page title based on route and section
  const getPageTitle = () => {
    const pathname = location.pathname;
    const searchParams = new URLSearchParams(location.search);
    const section = searchParams.get('section');
    const active = searchParams.get('active');

    // Base page titles
    const baseTitles = {
      "/dashboard": "Dashboard",
      "/refs": "Refs",
      "/ref-entry": "Ref Entry",
      "/production": "Production",
      "/resources": "Resources",
      "/reports": "Reports", 
      "/training": "Training",
      "/recruiting": "Recruiting",
      "/utilities": "Utilities",
      "/1on1": "1-on-1 Meeting",
      "/team-customization": "Team Customization",
      "/admin/notifications": "Notifications Management",
      "/admin/hierarchy": "Hierarchy Management", 
      "/admin/hierarchy-table": "Hierarchy Table View",
      "/admin/login-logs": "Login Logs",
      "/admin/check": "Admin Permissions Check",
      "/notifications": "Notifications",
      "/notification-settings": "Notification Settings",
      "/promotion-tracking": "Promotion Tracking",
      "/other": "Other Page",
    };

    // Section-specific titles
    const sectionTitles = {
      production: {
        'daily-activity': 'Daily Activity',
        'scorecard': 'Scorecard',
        'leaderboard': 'Leaderboard',
        'verification': 'Verification',
        'release': 'Release',
        'vips': 'Codes and VIPs'
      },
      settings: {
        'account': 'Account',
        'trophy': 'Trophy Case',
        'hierarchy': 'Hierarchy',
        'notifications': 'Notifications',
        'discord': 'Discord',
        'licensing': 'Licensing'
      },
      training: {
        'release': 'Release'
      },
      resources: {
        'reports': 'Reports',
        'updates': 'Updates',
        'feedback': 'Feedback'
      }
    };

    let baseTitle = baseTitles[pathname] || "Atlas";
    
    // Use section title if available, otherwise use base title
    if (section || active) {
      const pageKey = pathname.replace('/', '');
      const sectionKey = section || active;
      const sectionMap = sectionTitles[pageKey];
      
      if (sectionMap && sectionMap[sectionKey]) {
        baseTitle = sectionMap[sectionKey];
      }
    }

    return baseTitle;
  };

  const pageTitle = getPageTitle();

  // Update document title with page title and team name
  useEffect(() => {
    // Don't change title on careers page - it has its own SEO-friendly title
    const isCareersRoute = location.pathname === '/careers' || location.pathname === '/careers-success';
    if (isCareersRoute) {
      document.title = 'Career Opportunities | Arias Agencies';
      return;
    }
    
    if (!stylesLoading && teamName) {
      const title = pageTitle === teamName ? `${teamName} - Atlas` : `${pageTitle} | ${teamName} - Atlas`;
      document.title = title;
    }
  }, [teamName, stylesLoading, pageTitle, location.pathname]);

  // Apply team styles to the root element
  useEffect(() => {
    if (!stylesLoading) {
      const rootElement = document.documentElement;
      // Apply each CSS variable
      Object.entries(styles).forEach(([property, value]) => {
        rootElement.style.setProperty(property, value);
      });
    }
  }, [styles, stylesLoading]);

  // Determine if the current page is an auth page (login, register, etc.) or public page
  // Note: /adminlogin now redirects to /login since admin users use the unified login system
  const authPaths = ["/login", "/register", "/adminlogin"];
  const isAuthPage = authPaths.includes(location.pathname);
  
  // Check if current path is a public route that doesn't require authentication
  const publicPaths = ["/login", "/register", "/adminlogin", "/onboarding/login", "/onboarding/register", "/onboarding/forgot", "/onboarding/reset-password", "/onboarding", "/terms-of-service", "/privacy-policy"];
  const isClientSigningPage = location.pathname.startsWith("/client-sign/");
  const isAgentSigningPage = location.pathname.startsWith("/agent-sign/");
  const isAgentDocumentSigningPage = location.pathname === "/agent-document-signing";
  const isPresentationSetupPage = location.pathname === "/presentation-setup";
  const isPresentationSlideshowPage = location.pathname === "/presentation-slideshow";
  const isPresentationScriptsPage = location.pathname === "/presentation-scripts";
  const isCareersPage = location.pathname === "/careers" || location.pathname === "/careers-success";
  const isOnboardingPage = location.pathname.startsWith('/onboarding');
  const isOnboardingHomePath = location.pathname === '/onboarding/home';
  const isOnboardingAuth = isOnboardingPage && !isOnboardingHomePath;
  const isLegalPage = location.pathname === '/terms-of-service' || location.pathname === '/privacy-policy';
  const isPublicPage = publicPaths.includes(location.pathname) || isClientSigningPage || isAgentSigningPage || isAgentDocumentSigningPage || isPresentationSetupPage || isPresentationSlideshowPage || isPresentationScriptsPage || isCareersPage || isOnboardingAuth || isOnboardingHomePath || isLegalPage;

  // Handle redirects only once auth is no longer loading
  React.useEffect(() => {
    // Don't redirect while authentication is still loading
    if (authLoading) {
      console.log('[App] Auth is still loading, deferring redirect logic');
      return;
    }
    
    // If authenticated and on auth page, redirect to dashboard or intended location
    if (isAuthenticated && isAuthPage) {
      // Determine default path based on user role
      const isAppAdmin = user?.Role === 'Admin' && user?.teamRole === 'app';
      const defaultPath = isAppAdmin ? '/production' : '/dashboard';
      const intendedPath = localStorage.getItem('intendedPath') || defaultPath;
      
      console.log(`[App] Already authenticated, redirecting from auth page to ${intendedPath}`, {
        from: location.pathname,
        to: intendedPath,
        userId: user?.userId,
        isAppAdmin,
        defaultPath
      });
      
      // Log the redirect
      logRedirect(
        location.pathname,
        intendedPath,
        'User already authenticated',
        {
          userId: user?.userId,
          userRole: user?.Role,
          isAppAdmin
        }
      );
      
      localStorage.removeItem('intendedPath'); // Clear after use
      navigate(intendedPath, { replace: true });
      return;
    }
    
    // Only redirect to login if not authenticated AND not on any auth page
    // This prevents redirecting away from /login, /adminlogin, /register, etc.
    if (!isAuthenticated && !isPublicPage) {
      const currentPath = location.pathname + location.search;
      console.log(`[App] Not authenticated, redirecting to login from ${currentPath}`, {
        user,
        targetPath: currentPath,
        isAuthPage,
        isPublicPage
      });
      
      // Log the redirect
      logRedirect(
        currentPath,
        '/login',
        'User not authenticated',
        {
          targetPath: currentPath
        }
      );
      
      // Store the current path for redirection after login
      localStorage.setItem('intendedPath', currentPath);
      navigate("/login", { replace: true });
      return;
    }
    
    // If we're on an auth page and not authenticated, allow it (don't redirect)
    if (!isAuthenticated && isAuthPage) {
      console.log(`[App] On auth page ${location.pathname}, allowing access without redirect`);
      return;
    }
    
    // If we're on a public page (including client/agent signing and careers) and not authenticated, allow it
    if (!isAuthenticated && (isClientSigningPage || isAgentSigningPage || isAgentDocumentSigningPage || isPresentationSetupPage || isPresentationSlideshowPage || isPresentationScriptsPage || isCareersPage)) {
      console.log(`[App] On public page ${location.pathname}, allowing access without redirect`);
      return;
    }
    
    // If authenticated and on root path, redirect to dashboard
    if (isAuthenticated && location.pathname === "/") {
      console.log("[App] Authenticated at root, redirecting to dashboard", {
        userId: user?.userId,
        role: user?.Role
      });
      
      // Log the redirect
      logRedirect(
        '/',
        '/dashboard',
        'Root path redirect for authenticated user',
        {
          userId: user?.userId,
          userRole: user?.Role
        }
      );
      
      navigate("/dashboard", { replace: true });
    }
    
    // Legacy redirect - no longer needed for new admin hierarchy page
    if (location.pathname === "/admin-legacy/hierarchy") {
      console.log("[App] Redirecting legacy admin hierarchy to settings with hierarchy tab");
      
      // Log the redirect
      logRedirect(
        '/admin-legacy/hierarchy',
        '/utilities?section=hierarchy',
        'Legacy admin hierarchy path',
        {
          userId: user?.userId,
          userRole: user?.Role
        }
      );
      
      navigate("/utilities?section=hierarchy", { replace: true });
    }

    // Add debug logging for the admin hierarchy path
    if (location.pathname === "/admin/hierarchy") {
      console.log("[App] Accessing admin hierarchy page", {
        isAuthenticated,
        userRole: user?.Role,
        userPermissions: user?.permissions,
        hasAdminPermission: hasPermission('admin')
      });
    }

  }, [isAuthenticated, isAuthPage, location.pathname, location.search, navigate, authLoading, user, hasPermission, isPublicPage, isClientSigningPage, isAgentDocumentSigningPage, isPresentationSetupPage, isPresentationSlideshowPage, isPresentationScriptsPage, isCareersPage]);

  // If we're on a legal page, render without header/sidebar (public access)
  if (isLegalPage) {
    return (
      <Routes>
        <Route path="/terms-of-service" element={<TermsOfService />} />
        <Route path="/privacy-policy" element={<PrivacyPolicy />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  // If we're on an auth page, we render only the auth routes
  if (isAuthPage) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        {/* Redirect admin login to regular login since admin users now use unified login */}
        <Route path="/adminlogin" element={<Navigate to="/login" replace />} />
        {/* Add a register route if needed */}
        <Route path="/register" element={<div>Register Page</div>} />
        {/* Redirect any unknown auth route to /login */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  // Onboarding auth routes (no header/sidebar)
  if (isOnboardingAuth) {
    return (
      <Routes>
        <Route path="/onboarding" element={<OnboardingLogin />} />
        <Route path="/onboarding/login" element={<OnboardingLogin />} />
        <Route path="/onboarding/register" element={<OnboardingRegister />} />
        <Route path="/onboarding/forgot" element={<OnboardingForgot />} />
        <Route path="/onboarding/reset-password" element={<OnboardingResetPassword />} />
        <Route path="/terms-of-service" element={<TermsOfService />} />
        <Route path="/privacy-policy" element={<PrivacyPolicy />} />
        <Route path="*" element={<Navigate to="/onboarding/login" replace />} />
      </Routes>
    );
  }
  
  // If we're on a careers page, render without header/sidebar
  if (isCareersPage) {
    return (
      <Routes>
        <Route path="/careers" element={<RecruitmentForm />} />
        <Route path="/careers-success" element={<RecruitmentSuccess />} />
        <Route path="/terms-of-service" element={<TermsOfService />} />
        <Route path="/privacy-policy" element={<PrivacyPolicy />} />
        {/* Redirect any unknown careers route to dashboard or careers form */}
        <Route path="*" element={<Navigate to={isAuthenticated ? "/dashboard" : "/careers"} replace />} />
      </Routes>
    );
  }

  // Note: Onboarding HOME renders inside main layout (auth screens above render bare)

  // If we're on a client signing page, render without header/sidebar
  if (isClientSigningPage) {
    return (
      <Routes>
        <Route path="/client-sign/:token" element={<ClientSigning />} />
        {/* Redirect any unknown client signing route to dashboard */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    );
  }

  // If we're on the agent document signing page, render without header/sidebar
  if (isAgentDocumentSigningPage) {
    return (
      <Routes>
        <Route path="/agent-document-signing" element={<AgentDocumentSigning />} />
        {/* Redirect any unknown route to the agent signing page */}
        <Route path="*" element={<Navigate to="/agent-document-signing" replace />} />
      </Routes>
    );
  }

  // If we're on an agent signing page, render without header/sidebar
  if (isAgentSigningPage) {
    return (
      <Routes>
        <Route path="/agent-sign/:token" element={<AgentSigning />} />
        {/* Redirect any unknown agent signing route to dashboard */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    );
  }

  // If we're on the presentation setup page, render without header/sidebar
  if (isPresentationSetupPage) {
    return (
      <Routes>
        <Route path="/presentation-setup" element={<PresentationSetup />} />
        {/* Redirect any unknown route */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    );
  }

  // If we're on the presentation slideshow page, render without header/sidebar
  if (isPresentationSlideshowPage) {
    return (
      <Routes>
        <Route path="/presentation-slideshow" element={<PresentationSlideshow />} />
        {/* Redirect any unknown route */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    );
  }

  // If we're on the presentation scripts page, render without header/sidebar
  if (isPresentationScriptsPage) {
    return (
      <Routes>
        <Route path="/presentation-scripts" element={<PresentationScripts />} />
        {/* Redirect any unknown route */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    );
  }

  // Otherwise, render the main app layout with header, sidebar, etc.
  const isOnboardingHome = location.pathname.startsWith('/onboarding/home');
  return (
    <div className={`app-container ${isEmbedded ? 'embedded-mode' : ''}`}>
      {!isEmbedded && <Header pageTitle={pageTitle} onboardingMode={isOnboardingHome} />}
      <div className="main-content">
        <div className="page-content">
          <Routes>
            {/* Root path handler */}
            <Route
              path="/"
              element={
                isAuthenticated ? (
                  user?.Role === 'Admin' && user?.teamRole === 'app' ? (
                    <Navigate to="/production" replace />
                  ) : (
                    <Navigate to="/dashboard" replace />
                  )
                ) : (
                  <Navigate to="/login" replace />
                )
              }
            />
            {/* Onboarding home inside main layout */}
            <Route path="/onboarding/home" element={<OnboardingHome />} />
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute requiredPermission="view_dashboard">
                  {user?.Role === 'Admin' && user?.teamRole === 'app' ? (
                    <Navigate to="/production" replace />
                  ) : (
                    <Dashboard />
                  )}
                </ProtectedRoute>
              }
            />
            <Route
              path="/refs"
              element={
                <ProtectedRoute requiredPermission="view_refs">
                  <RefsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/ref-entry"
              element={
                <ProtectedRoute>
                  {user?.Role === 'Admin' && user?.teamRole === 'app' ? (
                    <RefEntry />
                  ) : (
                    <div style={{ padding: "2rem", textAlign: "center" }}>
                      <h2>Access Denied</h2>
                      <p>This page is only available to App team administrators.</p>
                    </div>
                  )}
                </ProtectedRoute>
              }
            />

            <Route
              path="/production"
              element={
                <ProtectedRoute>
                  <Production />
                </ProtectedRoute>
              }
            />
            <Route
              path="/promotion-tracking"
              element={
                <ProtectedRoute>
                  {user?.Role === 'Admin' && user?.teamRole === 'app' ? (
                    <PromotionTracking />
                  ) : (
                    <div style={{ padding: "2rem", textAlign: "center" }}>
                      <h2>Access Denied</h2>
                      <p>This page is only available to App team administrators.</p>
                    </div>
                  )}
                </ProtectedRoute>
              }
            />
            <Route
              path="/resources"
              element={
                <ProtectedRoute>
                  <Reports />
                </ProtectedRoute>
              }
            />
            <Route
              path="/training"
              element={
                <ProtectedRoute>
                  <Training />
                </ProtectedRoute>
              }
            />
            <Route
              path="/recruiting"
              element={
                <ProtectedRoute>
                  <Recruiting />
                </ProtectedRoute>
              }
            />
            <Route
              path="/utilities"
              element={
                <ProtectedRoute>
                  <Utilities />
                </ProtectedRoute>
              }
            />
            <Route
              path="/auth/calendly/callback"
              element={
                <ProtectedRoute>
                  <CalendlyCallback />
                </ProtectedRoute>
              }
            />
            <Route
              path="/auth/zoom/callback"
              element={
                <ProtectedRoute>
                  <ZoomCallback />
                </ProtectedRoute>
              }
            />
            <Route
              path="/1on1"
              element={
                <ProtectedRoute>
                  <OneOnOne />
                </ProtectedRoute>
              }
            />
            {/* Redirect old /settings path to /utilities for backward compatibility */}
            <Route
              path="/settings"
              element={<Navigate to="/utilities" replace />}
            />
            <Route
              path="/team-customization"
              element={
                <ProtectedRoute requiredPermission="edit_team">
                  <TeamCustomization />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/notifications"
              element={
                <ProtectedRoute requiredPermission="admin">
                  <NotificationsAdmin />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/hierarchy"
              element={
                <ProtectedRoute requiredPermission="admin">
                  <AdminHierarchySettings key="admin-hierarchy" />
                </ProtectedRoute>
              }
            />
 
            <Route
              path="/admin/login-logs"
              element={
                <ProtectedRoute requiredPermission="admin">
                  <LoginLogs />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/analytics"
              element={
                <ProtectedRoute requiredPermission="admin">
                  <AnalyticsDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/email-campaigns"
              element={
                <ProtectedRoute requiredPermission="admin">
                  <EmailCampaigns />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/check"
              element={
                <AdminCheck />
              }
            />
            <Route
              path="/notification-settings"
              element={
                <ProtectedRoute>
                  <NotificationUtilities />
                </ProtectedRoute>
              }
            />
            <Route
              path="/other"
              element={
                <ProtectedRoute>
                  <PlaceholderPage title="Other Page" />
                </ProtectedRoute>
              }
            />
            <Route
              path="/document-signing"
              element={
                <ProtectedRoute>
                  <DocumentSigning />
                </ProtectedRoute>
              }
            />

            {/* Redirect unknown routes to dashboard */}
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </div>
      </div>
      {/* Add BottomNav for mobile (hide on onboarding pages) */}
      {!isOnboardingPage && <BottomNav />}
      <InPageNotificationContainer />
      <LicenseOnboardingModal />
      <Toaster 
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: '#363636',
            color: '#fff',
          },
          success: {
            duration: 3000,
            theme: {
              primary: '#4aed88',
            },
          },
        }}
      />
    </div>
  );
}

function App() {
  return (
    <div className="app-content-wrapper" style={{ fontFamily: 'inherit' }}>
      <AuthProvider>
        <ThemeProvider>
          <TeamStyleProvider>
            <AgencyProvider>
              <EmbeddedProvider>
                <NotificationProvider>
                  <LicenseWarningProvider>
                    <HeaderProvider>
                      <AppContent />
                    </HeaderProvider>
                  </LicenseWarningProvider>
                </NotificationProvider>
              </EmbeddedProvider>
            </AgencyProvider>
          </TeamStyleProvider>
        </ThemeProvider>
      </AuthProvider>
    </div>
  );
}

export default App;
