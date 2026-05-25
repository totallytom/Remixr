import { useEffect, lazy, Suspense } from 'react'
import './App.css'
import { useStore } from './store/useStore';
import { isOnboardingPending } from './utils/onboardingPending';
import ThemeProvider from './components/ThemeProvider';
import { AlertProvider } from './contexts/AlertContext';
import AlertToast from './components/AlertToast';
import {BrowserRouter as Router, Routes, Route, useLocation, useNavigate} from 'react-router-dom';
import { Analytics } from "@vercel/analytics/react"
import { AnimatePresence, motion } from 'framer-motion';
import Sidebar from './components/layout/Sidebar';

// Routes that manage their own scroll/layout and must not inherit page-content padding
const FULL_HEIGHT_ROUTES = new Set(['/chat', '/playlists']);

function PageContent({ children }) {
  const { pathname } = useLocation();
  const isFullHeight = FULL_HEIGHT_ROUTES.has(pathname);
  return (
    <div className={isFullHeight
      ? 'flex-1 min-w-0 overflow-hidden flex flex-col h-full'
      : 'flex-1 min-w-0 overflow-y-auto overflow-x-hidden page-content'
    }>
      {children}
    </div>
  );
}

// Lazy-loaded pages (code splitting: each route loads on demand)
const Home = lazy(() => import('./pages/Home'));
const Search = lazy(() => import('./pages/Search'));
const Chat = lazy(() => import('./pages/Chat'));
const Profile = lazy(() => import('./pages/Profile'));
const Artist = lazy(() => import('./pages/Artist'));
const Upload = lazy(() => import('./pages/Upload'));
const Playlists = lazy(() => import('./pages/Playlists'));
const Login = lazy(() => import('./pages/Login'));
const Signup = lazy(() => import('./pages/Signup'));
const Onboarding = lazy(() => import('./pages/Onboarding'));
const OnboardingUpload = lazy(() => import('./pages/OnboardingUpload'));
const OnboardingLive = lazy(() => import('./pages/OnboardingLive'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));
const PlaylistTracksPage = lazy(() => import('./pages/PlaylistTracksPage'));
const AlbumTracksPage = lazy(() => import('./pages/AlbumTracksPage'));
const Remix = lazy(() => import('./pages/Remix'));
const Discover = lazy(() => import('./pages/Discover'));
const Admin = lazy(() => import('./pages/Admin'));
const Dmca = lazy(() => import('./pages/Dmca'));
const Upgrade = lazy(() => import('./pages/Upgrade'));
const AnalyticsPage = lazy(() => import('./pages/Analytics'));
const Storefront = lazy(() => import('./pages/Storefront'));
const SettingsModal = lazy(() => import('./components/layout/SettingsModal'));
const MusicPlayer = lazy(() => import('./components/player/MusicPlayer'));

function OnboardingRedirectGuard() {
  const { user } = useStore();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  useEffect(() => {
    if (!user || user.role !== 'musician') return;
    if (pathname.startsWith('/onboarding')) return;
    isOnboardingPending(user.id).then((pending) => {
      if (pending) navigate('/onboarding', { replace: true });
    });
  }, [user?.id, pathname, navigate]);

  return null;
}

function App() {
  const store = useStore() || {};
  const {
    setChats = () => {},
    sidebarOpen = false,
    isSettingsOpen = false,
    settingsInitialTab = 'account',

    player = {
      isPlaying: false,
      visible: false,
      currentTrack: null,
      currentTime: 0,
      duration: 0,
    },

    initializeAudio = () => {},
    pauseTrack = () => {},
    resumeTrack = () => {},
    skipToNext = () => {},
    skipToPrevious = () => {},
    seekTo = () => {},

    togglePlayerVisibility = () => {},

    checkAuth = () => {},
    initializeAuth = () => () => {},

    theme = {
      customBackgroundColor: null
    }
  } = store;


  useEffect(() => {
    // Initialize audio system
    initializeAudio();

    // Initialize authentication listener (handles INITIAL_SESSION — no need for checkAuth)
    const cleanupAuth = initializeAuth();

    // Cleanup
    return () => {
      cleanupAuth();
    };
  }, [setChats, initializeAudio, initializeAuth, checkAuth]);

  const handlePlayPause = () => {
    if (player.isPlaying) {
      pauseTrack();
    } else {
      resumeTrack();
    }
  };

  const handleNext = () => {
    skipToNext();
  };

  const handlePrevious = () => {
    skipToPrevious();
  };

  const handleSeek = (time) => {
    seekTo(time);
  };

  return (
    <ThemeProvider>
      <AlertProvider>
      <Router>
        <OnboardingRedirectGuard />
        <div
          className="flex h-dvh bg-dark-900 text-white"
          style={
            theme.customBackgroundColor
              ? { backgroundColor: theme.customBackgroundColor }
              : {}
          }
        >
          {/* Desktop Sidebar - fixed 260px when open, does not shrink */}
          <div className={`hidden lg:block ${sidebarOpen ? 'lg:w-[260px] lg:min-w-[260px] lg:flex-shrink-0' : ''}`}>
            <AnimatePresence mode="wait">
              {sidebarOpen && (
                <motion.div
                  initial={{ x: -300, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  exit={{ x: -300, opacity: 0 }}
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  className="w-[260px] min-w-[260px] flex-shrink-0 h-full"
                >
                  <Sidebar />
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Mobile Sidebar */}
          <div className="lg:hidden">
            <Sidebar />
          </div>

          {/* Main Content */}
          <div className="flex-1 flex flex-col min-w-0 main-content">
            <PageContent>
              <Suspense fallback={
                <div className="flex items-center justify-center min-h-[40vh] text-white/70">Loading…</div>
              }>
                <Routes>
                  <Route path="/" element={<Home />} />
                  <Route path="/search" element={<Search />} />
                  <Route path="/chat" element={<Chat />} />
                  <Route path="/profile" element={<Profile />} />
                  <Route path="/profile/:userId" element={<Profile />} />
                  <Route path="/@:handle" element={<Profile />} />
                  <Route path="/artist/:id" element={<Artist />} />
                  <Route path="/upload" element={<Upload />} />
                  <Route path="/playlists" element={<Playlists />} />
                  <Route
                    path="/playlists/:playlistId"
                    element={<PlaylistTracksPage />}
                  />
                  <Route path="/albums/:albumId" element={<AlbumTracksPage />} />
                  <Route path="/discover" element={<Discover />} />
                  <Route path="/remix" element={<Remix />} />
                  <Route path="/remix/:trackId" element={<Remix />} />
                  <Route path="/admin" element={<Admin />} />
                  <Route path="/login" element={<Login />} />
                  <Route path="/signup" element={<Signup />} />
                  <Route path="/onboarding" element={<Onboarding />} />
                  <Route path="/onboarding/upload" element={<OnboardingUpload />} />
                  <Route path="/onboarding/live" element={<OnboardingLive />} />
                  <Route path="/reset-password" element={<ResetPassword />} />
                  <Route path="/dmca" element={<Dmca />} />
                  <Route path="/upgrade" element={<Upgrade />} />
                  <Route path="/analytics" element={<AnalyticsPage />} />
                  <Route path="/storefront" element={<Storefront />} />
                </Routes>
              </Suspense>
            </PageContent>
          </div>
        </div>

        {/* Music Player (lazy-loaded when first shown) */}
        <AnimatePresence>
          {player.visible && (
            <motion.div
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 100, opacity: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="fixed bottom-0 left-0 right-0 z-50"
            >
              <Suspense fallback={
                <div className="h-20 bg-dark-800 flex items-center justify-center text-white/60 text-sm">Loading player…</div>
              }>
                <MusicPlayer
                  currentTrack={player.currentTrack}
                  isPlaying={player.isPlaying}
                  onPlayPause={handlePlayPause}
                  onNext={handleNext}
                  onPrevious={handlePrevious}
                  onSeek={handleSeek}
                  currentTime={player.currentTime}
                  duration={player.duration}
                  visible={player.visible}
                  onToggleVisibility={togglePlayerVisibility}
                />
              </Suspense>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Settings Modal (lazy-loaded) */}
        <Suspense fallback={null}>
          <SettingsModal isOpen={isSettingsOpen} initialTab={settingsInitialTab} />
        </Suspense>

        {/* Global alert toasts (copyright, upload success/error) */}
        <AlertToast />
        <Analytics />
      </Router>
      </AlertProvider>
    </ThemeProvider>
  );
}


export default App
