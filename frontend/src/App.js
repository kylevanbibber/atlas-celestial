// src/App.js
import React, { useEffect } from 'react';
import {
  Routes,
  Route,
  Navigate,
  useLocation,
  useNavigate,
} from "react-router-dom";
import Sidebar from "./components/utils/Sidebar";
import Header from "./components/utils/Header";
import BottomNav from "./components/utils/BottomNav";
import Dashboard from "./pages/Dashboard";
import RefsPage from "./pages/refs/page";
import Production from "./pages/Production";
import Reports from "./pages/Reports";
import Training from "./pages/Training";
import Recruiting from "./pages/Recruiting";
import Settings from "./pages/settings/Settings";
import TeamCustomization from "./pages/settings/TeamCustomization";
import NotificationsAdmin from "./pages/admin/Notifications";
import ProtectedRoute from "./components/ProtectedRoute";
import Login from "./pages/auth/Login";
// Removed AdminLogin import - admin users now use unified login system
import { AuthProvider, useAuth } from "./context/AuthContext";
import { ThemeProvider } from "./context/ThemeContext";
import { useTeamStyles, TeamStyleProvider } from './context/TeamStyleContext';
import { LicenseWarningProvider } from "./context/LicenseWarningContext";
import { NotificationProvider } from "./context/NotificationContext";
import NotificationSettings from "./components/settings/notification/NotificationSettings";
import InPageNotificationContainer from "./components/notifications/InPageNotificationContainer";
import RefEntry from "./components/refvalidation/RefEntry";
import DocumentSigning from "./components/tools/DocumentSigning";
import ClientSigning from "./components/tools/ClientSigning";
import { PromotionTracking } from "./components/promotion-tracking";
import { Toaster } from 'react-hot-toast';


import AdminHierarchySettings from "./components/admin/AdminHierarchySettings";
import LoginLogs from "./components/admin/LoginLogs";
import { HierarchyTablePage } from "./pages/settings";
import AdminCheck from "./pages/admin/AdminCheck";
import { logRedirect, logNavigation } from "./utils/navigationLogger";
import "./App.css";

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
  const location = useLocation();
  const navigate = useNavigate();
  const [isExpanded, setIsExpanded] = React.useState(false);
  
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

  // Update document title with team name
  useEffect(() => {
    if (!stylesLoading && teamName) {
      document.title = `${teamName} - Atlas`;
    }
  }, [teamName, stylesLoading]);

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
  const publicPaths = ["/login", "/register", "/adminlogin"];
  const isClientSigningPage = location.pathname.startsWith("/client-sign/");
  const isPublicPage = publicPaths.includes(location.pathname) || isClientSigningPage;

  // Map routes to page titles (for pages with header)
  const pageTitleMap = {
    "/dashboard": "Dashboard",

    "/refs": "Refs",
    "/ref-entry": "Ref Entry",
    "/production": "Production",
    "/reports": "Reports",
    "/training": "Training",
    "/recruiting": "Recruiting",
    "/settings": user?.Role === 'Admin' && user?.teamRole === 'app' ? "Utilities" : "Settings",
    "/team-customization": "Team Customization",
    "/admin/notifications": "Notifications Management",
    "/admin/hierarchy": "Hierarchy Management",
    "/admin/hierarchy-table": "Hierarchy Table View",
    "/admin/login-logs": "Login Logs",
    "/admin/check": "Admin Permissions Check",
    "/notifications": "Notifications",
    "/notification-settings": "Notification Settings",
    "/other": "Other Page",
  };

  const pageTitle = pageTitleMap[location.pathname] || "Atlas";

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
    
    // If we're on a public page (including client signing) and not authenticated, allow it
    if (!isAuthenticated && isClientSigningPage) {
      console.log(`[App] On public client signing page ${location.pathname}, allowing access without redirect`);
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
        '/settings?section=hierarchy',
        'Legacy admin hierarchy path',
        {
          userId: user?.userId,
          userRole: user?.Role
        }
      );
      
      navigate("/settings?section=hierarchy", { replace: true });
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

  }, [isAuthenticated, isAuthPage, location.pathname, location.search, navigate, authLoading, user, hasPermission, isPublicPage, isClientSigningPage]);

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

  // Otherwise, render the main app layout with header, sidebar, etc.
  return (
    <div className={`app-container ${isExpanded ? "expanded" : ""}`}>
      <Sidebar isExpanded={isExpanded} setIsExpanded={setIsExpanded} />
      <Header pageTitle={pageTitle} isExpanded={isExpanded} />
      <div className="main-content">
        <div className="page-content">
          <Routes>
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
              path="/reports"
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
              path="/settings"
              element={
                <ProtectedRoute>
                  <Settings />
                </ProtectedRoute>
              }
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
              path="/admin/hierarchy-table"
              element={
                <ProtectedRoute requiredPermission="admin">
                  <HierarchyTablePage key="admin-hierarchy-table" />
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
              path="/admin/check"
              element={
                <AdminCheck />
              }
            />
            <Route
              path="/notification-settings"
              element={
                <ProtectedRoute>
                  <NotificationSettings />
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
      {/* Add BottomNav for mobile */}
      <BottomNav />
      <InPageNotificationContainer />
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
            <NotificationProvider>
              <LicenseWarningProvider>
                <AppContent />
              </LicenseWarningProvider>
            </NotificationProvider>
          </TeamStyleProvider>
        </ThemeProvider>
      </AuthProvider>
    </div>
  );
}

export default App;
