import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useAuthStore } from './stores/authStore';
import AppShell from './components/Layout/AppShell';
// import LoginPage from './components/Auth/LoginPage';
import DashboardPage from './pages/DashboardPage';
import ProjectsPage from './pages/ProjectsPage';
import CompliancePage from './pages/CompliancePage';
import LicensingPage from './pages/LicensingPage';
import HRPage from './pages/HRPage';
import DocumentsPage from './pages/DocumentsPage';

function AuthGate({ children }: { children: React.ReactNode }) {
  // TODO: Re-enable auth gate after login is fixed
  // const { session, loading, initialized } = useAuthStore();
  //
  // if (!initialized || loading) {
  //   return (
  //     <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100dvh', background: 'var(--color-bg)' }}>
  //       <div className="skeleton" style={{ width: 200, height: 24, borderRadius: 'var(--radius-md)' }} />
  //     </div>
  //   );
  // }
  //
  // if (!session) return <LoginPage />;
  return <>{children}</>;
}

export default function App() {
  const initialize = useAuthStore(s => s.initialize);

  useEffect(() => { initialize(); }, [initialize]);

  return (
    <BrowserRouter>
      <Toaster
        position="bottom-right"
        toastOptions={{
          style: {
            background: 'var(--color-surface)',
            color: 'var(--color-tx)',
            border: '1px solid var(--color-divider)',
            borderRadius: 'var(--radius-lg)',
            boxShadow: 'var(--shadow-lg)',
            fontSize: 'var(--text-sm)',
          },
        }}
      />
      <AuthGate>
        <Routes>
          <Route element={<AppShell />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/projects" element={<ProjectsPage />} />
            <Route path="/compliance" element={<CompliancePage />} />
            <Route path="/licensing" element={<LicensingPage />} />
            <Route path="/hr" element={<HRPage />} />
            <Route path="/documents" element={<DocumentsPage />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Route>
        </Routes>
      </AuthGate>
    </BrowserRouter>
  );
}
