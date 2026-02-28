// App.tsx (located at project root)
import React, { useState, useCallback, useEffect } from 'react';
import Sidebar from './src/components/Sidebar';
import DashboardOverview from './src/components/DashboardOverview';
import MatrixAIView from './src/components/MatrixAIView';
import PupilsList from './src/components/PupilsList';
import StaffList from './src/components/StaffList';
import PaymentList from './src/components/PaymentList';
import AttendanceView from './src/components/AttendanceView';
import AwardScoresView from './src/components/AwardScoresView';
import PerformanceAnalyticsView from './src/components/PerformanceAnalyticsView';
import RegistrationModal from './src/components/RegistrationModal';
import NoticeboardView from './src/components/NoticeboardView';
import NewslettersView from './src/components/NewslettersView';
import SentCommsView from './src/components/SentCommsView';
import VirtualCampusView from './src/components/VirtualCampusView';
import SchoolManagementView from './src/components/SchoolManagementView';
import ClassManagement from './src/components/ClassManagement';
import SuperAdminDashboard from './src/components/SuperAdminDashboard';
import NationalHierarchicalIntel from './src/components/NationalHierarchicalIntel';
import StudentTraceView from './src/components/StudentTraceView';
import FacultyMatrixView from './src/components/FacultyMatrixView';
import LogisticsHubView from './src/components/LogisticsHubView';
import SupportTokensView from './src/components/SupportTokensView';
import Notification, { ToastMessage } from './src/components/Notification';
import LoginView from './src/components/LoginView';
import LearnerPortal from './src/components/LearnerPortal';

// NEW IMPORTS for Zambia-specific features
import OfflineBanner from './src/components/OfflineBanner';
import ExamPrepDashboard from './src/components/ExamPrep/ExamPrepDashboard';
import OLCRegistrationForm from './src/components/ExamPrep/OLCRegistrationForm';
import SyncToMySQLButton from './src/components/SyncToMySQLButton';
import SyncStatusIndicator from './src/components/SyncStatus';
import { offlineService } from './src/services/OfflineService';
import { UserSession } from './src/types';
import { db } from './src/db';

const App: React.FC = () => {
  const [session, setSession] = useState<UserSession | null>(null);
  const [activePage, setActivePage] = useState('dashboard');
  const [isRegModalOpen, setRegModalOpen] = useState(false);
  const [isOLCRegModalOpen, setOLCRegModalOpen] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [schoolName, setSchoolName] = useState('Academia Pulse');
  const [syncStatus, setSyncStatus] = useState({
    pendingSync: 0,
    isOnline: navigator.onLine,
    isSyncing: false
  });

  // ------------------------------------------------------------------
  //  Load session from localStorage on initial mount
  // ------------------------------------------------------------------
  useEffect(() => {
    const savedSession = localStorage.getItem('academiaPulse_session');
    if (savedSession) {
      try {
        const parsed = JSON.parse(savedSession) as UserSession;
        if (parsed && parsed.userId && parsed.role) {
          setSession(parsed);
          console.log('✅ Session loaded:', parsed);
        } else {
          localStorage.removeItem('academiaPulse_session');
        }
      } catch (e) {
        localStorage.removeItem('academiaPulse_session');
      }
    }
  }, []);

  // Monitor sync status
  useEffect(() => {
    const updateSyncStatus = async () => {
      try {
        const status = await offlineService.getSyncStatus();
        setSyncStatus({
          pendingSync: status.pendingSync,
          isOnline: status.isOnline,
          isSyncing: status.isSyncing || false
        });
      } catch (error) {
        console.warn('Could not get sync status:', error);
      }
    };

    offlineService.onStatusChange((status) => {
      setSyncStatus({
        pendingSync: status.pendingSync,
        isOnline: status.isOnline,
        isSyncing: status.isSyncing || false
      });
    });

    updateSyncStatus();
    const interval = setInterval(updateSyncStatus, 10000);
    return () => clearInterval(interval);
  }, []);

  // Monitor online status
  useEffect(() => {
    const handleOnline = () => {
      setSyncStatus(prev => ({ ...prev, isOnline: true }));
      addToast('📶 Connection restored - Syncing data...', 'success');
    };
    
    const handleOffline = () => {
      setSyncStatus(prev => ({ ...prev, isOnline: false }));
      addToast('📱 Offline mode - Changes will be saved locally', 'info');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Listen for offline notifications
  useEffect(() => {
    const handleNotification = (event: CustomEvent) => {
      const { message, type } = event.detail;
      addToast(message, type);
    };

    window.addEventListener('offline-notification' as any, handleNotification);
    return () => window.removeEventListener('offline-notification' as any, handleNotification);
  }, []);

  // Log active page changes
  useEffect(() => {
    console.log('📌 App: activePage changed to:', activePage);
    console.log('👤 Current user role:', session?.role);
  }, [activePage, session]);

  // ------------------------------------------------------------------
  //  Custom setter that also updates localStorage
  // ------------------------------------------------------------------
  const handleSetSession = useCallback((newSession: UserSession | null) => {
    setSession(newSession);
    if (newSession) {
      localStorage.setItem('academiaPulse_session', JSON.stringify(newSession));
    } else {
      localStorage.removeItem('academiaPulse_session');
    }
  }, []);

  // ------------------------------------------------------------------
  //  Fetch school name whenever session changes
  // ------------------------------------------------------------------
  useEffect(() => {
    if (session?.schoolId) {
      db.getSchoolName(session.schoolId)
        .then(setSchoolName)
        .catch(() => setSchoolName('Academia Pulse'));
    }
  }, [session]);

  const addToast = useCallback((text: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToasts(prev => [...prev, { id: Date.now(), text, type }]);
  }, []);

  const removeToast = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const handlePageChange = (page: string) => {
    console.log('🔄 App: handlePageChange called with:', page);
    setActivePage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleLogout = useCallback(() => {
    handleSetSession(null);
    setActivePage('dashboard');
    addToast("Session terminated. Systems secure.", "info");
  }, [handleSetSession, addToast]);

  const handleForceSync = async () => {
    if (!syncStatus.isOnline) {
      addToast('Cannot sync while offline', 'error');
      return;
    }
    
    try {
      addToast('Starting sync...', 'info');
      const result = await offlineService.forceSync();
      addToast(`Sync complete: ${result.success} synced, ${result.failed} failed`, 
        result.failed > 0 ? 'error' : 'success');
    } catch (error) {
      addToast('Sync failed: ' + error, 'error');
    }
  };

  const renderContent = () => {
    if (!session) return null;

    console.log('🎨 Rendering content for page:', activePage, 'role:', session.role);

    // ------------------ SUPER ADMIN ------------------
    if (session.role === 'SUPER_ADMIN') {
      switch (activePage) {
        case 'dashboard':
          return <SuperAdminDashboard session={session} setPage={handlePageChange} addToast={addToast} />;
        case 'national-intel':
          return <NationalHierarchicalIntel session={session} addToast={addToast} />;
        case 'student-trace':
          return <StudentTraceView session={session} addToast={addToast} />;
        case 'faculty-matrix':
          return <FacultyMatrixView session={session} addToast={addToast} />;
        case 'logistics-hub':
          return <LogisticsHubView session={session} addToast={addToast} />;
        case 'institution-registry':
          return <SuperAdminDashboard activeTabOverride="institutions" session={session} setPage={handlePageChange} addToast={addToast} />;
        case 'ai-matrix':
          return <MatrixAIView session={session} addToast={addToast} />;
        case 'subscription':
          return <SupportTokensView session={session} addToast={addToast} />;
        case 'class-management':
          return <ClassManagement session={session} addToast={addToast} setPage={handlePageChange} />;
        case 'exam-prep':
          return <ExamPrepDashboard session={session} examLevel="G7" addToast={addToast} />;
        default:
          return <SuperAdminDashboard session={session} setPage={handlePageChange} addToast={addToast} />;
      }
    }

    // ------------------ LEARNER ------------------
    if (session.role === 'LEARNER') {
      return (
        <LearnerPortal
          session={session}
          onLogout={handleLogout}
          addToast={addToast}
          onPageChange={handlePageChange}
          activePage={activePage}
          renderContent={renderContent}
        />
      );
    }

    // ------------------ SCHOOL ADMIN / STAFF ------------------
    switch (activePage) {
      case 'dashboard':
        return <DashboardOverview session={session} onOpenReg={() => setRegModalOpen(true)} setPage={handlePageChange} addToast={addToast} />;
      case 'ai-matrix':
        return <MatrixAIView session={session} addToast={addToast} />;
      case 'pupils':
        return <PupilsList session={session} addToast={addToast} />;
      case 'staff':
        return <StaffList session={session} addToast={addToast} />;
      case 'payments':
        return <PaymentList session={session} addToast={addToast} />;
      case 'attendance':
        return <AttendanceView session={session} addToast={addToast} />;
      case 'award-scores':
        return <AwardScoresView session={session} addToast={addToast} setPage={handlePageChange} />;
      case 'performance-analytics':
        return <PerformanceAnalyticsView session={session} addToast={addToast} />;
      case 'notices':  // ✅ NOTICEBOARD CASE
      case 'noticeboard': // Also handle both spellings just in case
        console.log('📢 Rendering NoticeboardView');
        return <NoticeboardView session={session} addToast={addToast} />;
      case 'newsletters':
        return <NewslettersView session={session} addToast={addToast} />;
      case 'sent-comms':
        return <SentCommsView session={session} addToast={addToast} />;
      case 'virtual-campus':
        return <VirtualCampusView session={session} addToast={addToast} />;
      case 'school-management':
        return <SchoolManagementView session={session} addToast={addToast} />;
      case 'class-management':
        return <ClassManagement session={session} addToast={addToast} setPage={handlePageChange} />;
      case 'exam-prep':
        return <ExamPrepDashboard session={session} examLevel="G7" addToast={addToast} />;
      case 'olc-registration':
        setOLCRegModalOpen(true);
        return null;
      default:
        console.log('⚠️ Unknown page:', activePage, 'falling back to dashboard');
        return <DashboardOverview session={session} onOpenReg={() => setRegModalOpen(true)} setPage={handlePageChange} addToast={addToast} />;
    }
  };

  if (!session) {
    return (
      <>
        <Notification toasts={toasts} removeToast={removeToast} />
        <LoginView addToast={addToast} onLogin={handleSetSession} />
      </>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-800 selection:bg-indigo-100">
      <OfflineBanner />
      <SyncStatusIndicator />
      <Notification toasts={toasts} removeToast={removeToast} />

      <header className="fixed top-4 left-4 right-4 h-20 flex items-center px-10 z-[100] backdrop-blur-2xl border border-white shadow-[0_8px_32px_rgba(0,0,0,0.04)] rounded-[2rem] bg-white/80 text-slate-900">
        <div className="flex items-center gap-5 mr-12 group cursor-pointer" onClick={() => handlePageChange('dashboard')}>
          <div className="w-12 h-12 rounded-[1.2rem] flex items-center justify-center text-2xl shadow-xl transition-all duration-500 bg-indigo-600 text-white">
            <i className={`fa-solid ${session.role === 'SUPER_ADMIN' ? 'fa-shield-halved' : 'fa-graduation-cap'}`}></i>
          </div>
          <div className="flex flex-col">
            <span className="font-extrabold text-xl tracking-tighter uppercase leading-none">{schoolName}</span>
            <span className="text-[10px] font-bold uppercase tracking-[0.4em] mt-1 text-indigo-600">
              {session.role === 'SUPER_ADMIN' ? 'Sovereign Node' : 'Institutional Command'}
            </span>
          </div>
        </div>

        <div className="ml-auto flex items-center gap-6">
          <div className="hidden lg:flex items-center gap-3">
            <div className={`w-2 h-2 rounded-full ${syncStatus.isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`}></div>
            <span className="text-[10px] text-slate-500">{syncStatus.isOnline ? 'Online' : 'Offline'}</span>
          </div>

          {syncStatus.pendingSync > 0 && (
            <button
              onClick={handleForceSync}
              disabled={!syncStatus.isOnline || syncStatus.isSyncing}
              className="flex items-center gap-2 px-3 py-1.5 bg-amber-100 text-amber-700 rounded-full text-xs hover:bg-amber-200 transition-colors disabled:opacity-50"
              title="Click to sync now"
            >
              <i className={`fa-solid ${syncStatus.isSyncing ? 'fa-circle-notch animate-spin' : 'fa-cloud-arrow-up'}`}></i>
              <span>{syncStatus.pendingSync} pending</span>
            </button>
          )}

          <div className="hidden sm:flex items-center gap-4 px-6 py-2.5 border rounded-2xl bg-slate-50 border-slate-100">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center text-[10px] font-black shadow-sm border bg-white text-indigo-600 border-slate-100">
              {session.role[0]}
            </div>
            <div className="flex flex-col">
              <span className="font-extrabold text-[11px] uppercase tracking-wider leading-none">{session.displayName}</span>
              <span className="text-[9px] font-bold uppercase tracking-widest mt-0.5 opacity-40">{session.role} MODE</span>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-11 h-11 rounded-2xl flex items-center justify-center transition-all shadow-sm group bg-white border border-slate-100 text-slate-900 hover:bg-rose-50 hover:text-rose-500"
          >
            <i className="fa-solid fa-power-off text-sm group-hover:rotate-12 transition-transform"></i>
          </button>
        </div>
      </header>

      <div className="flex pt-32">
        <Sidebar session={session} activePage={activePage} setActivePage={handlePageChange} />
        <main className="flex-1 min-h-[calc(100vh-128px)] relative ml-64">
          <div className="px-12 max-w-[1600px] mx-auto pb-40 space-y-12">
            {/* Page Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4 text-[10px] font-black uppercase tracking-[0.5em] text-slate-300">
                <span className="hover:text-indigo-600 cursor-pointer transition-colors" onClick={() => handlePageChange('dashboard')}>
                  Sovereign Core
                </span>
                <i className="fa-solid fa-chevron-right text-[7px] opacity-40"></i>
                <span className="text-indigo-600">{activePage.replace('-', ' ')}</span>
              </div>
              
              {session.role !== 'SUPER_ADMIN' && session.role !== 'LEARNER' && (
                <SyncToMySQLButton 
                  schoolId={session.schoolId}
                  addToast={addToast}
                />
              )}
            </div>
            
            {renderContent()}
          </div>
        </main>
      </div>

      <RegistrationModal
        session={session}
        isOpen={isRegModalOpen}
        onClose={() => setRegModalOpen(false)}
        addToast={addToast}
      />

      {isOLCRegModalOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <OLCRegistrationForm
            onSuccess={() => {
              setOLCRegModalOpen(false);
              addToast('OLC Learner registered successfully', 'success');
              if (activePage === 'exam-prep') {
                handlePageChange('dashboard');
                setTimeout(() => handlePageChange('exam-prep'), 100);
              }
            }}
            onCancel={() => setOLCRegModalOpen(false)}
          />
        </div>
      )}

      {/* SOVEREIGN COMMAND HUB */}
      <div className="fixed bottom-10 left-0 right-0 flex justify-center pointer-events-none z-[110]">
        <div className="flex gap-6 bg-white/80 backdrop-blur-3xl px-8 py-5 rounded-[3rem] border border-white shadow-[0_25px_70px_-15px_rgba(0,0,0,0.15)] pointer-events-auto items-center animate-in slide-in-from-bottom-12 duration-700">
          <button
            onClick={() => handlePageChange('dashboard')}
            className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all group ${
              activePage === 'dashboard' ? 'bg-indigo-50 text-indigo-600 shadow-sm' : 'text-slate-300 hover:text-indigo-600'
            }`}
            title="Dashboard"
          >
            <i className="fa-solid fa-house text-xl group-hover:scale-110 transition-transform"></i>
          </button>
          <button
            onClick={() => handlePageChange('ai-matrix')}
            className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all group ${
              activePage === 'ai-matrix' ? 'bg-blue-50 text-[#2a9fd6] shadow-sm' : 'text-slate-300 hover:text-[#2a9fd6]'
            }`}
            title="AI Assistant"
          >
            <i className="fa-solid fa-brain-circuit text-xl group-hover:scale-110 transition-transform"></i>
          </button>
          <div className="px-2">
            <button
              onClick={() => {
                if (session.role === 'SUPER_ADMIN') handlePageChange('institution-registry');
                else setRegModalOpen(true);
              }}
              className="w-16 h-16 bg-indigo-600 text-white rounded-[1.8rem] flex items-center justify-center text-2xl shadow-xl shadow-indigo-600/30 hover:scale-110 active:scale-95 transition-all outline-none group"
              title={session.role === 'SUPER_ADMIN' ? 'Manage Registry' : 'Quick Register'}
            >
              <i className="fa-solid fa-plus group-hover:rotate-90 transition-transform duration-500"></i>
            </button>
          </div>
          <button
            onClick={() => handlePageChange(session.role === 'SUPER_ADMIN' ? 'national-intel' : 'performance-analytics')}
            className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all group ${
              ['performance-analytics', 'national-intel'].includes(activePage)
                ? 'bg-rose-50 text-rose-500 shadow-sm'
                : 'text-slate-300 hover:text-rose-500'
            }`}
            title="Intelligence Matrix"
          >
            <i
              className={`fa-solid ${
                session.role === 'SUPER_ADMIN' ? 'fa-chart-network' : 'fa-chart-pie'
              } text-xl group-hover:scale-110 transition-transform`}
            ></i>
          </button>
          <button
            onClick={() => handlePageChange('virtual-campus')}
            className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all group ${
              activePage === 'virtual-campus' ? 'bg-emerald-50 text-emerald-600 shadow-sm' : 'text-slate-300 hover:text-emerald-600'
            }`}
            title="Virtual Campus"
          >
            <i className="fa-solid fa-video text-xl group-hover:scale-110 transition-transform"></i>
          </button>
        </div>
      </div>
    </div>
  );
};

export default App;