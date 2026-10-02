import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { Music, Mail, Lock, Eye, EyeOff, User, Mic, Headphones } from 'lucide-react';
import { useStore } from '../store/useStore';
import { AuthService } from '../services/authService';
import { supabase } from '../services/supabase';

interface LoginForm {
  email: string;
  password: string;
}

interface RegisterForm {
  username: string;
  email: string;
  password: string;
  confirmPassword: string;
  role: 'musician' | 'consumer';
  artistName?: string;
  bio?: string;
}

const Login: React.FC = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'login' | 'register'>('login');
  const [error, setError] = useState<string>('');
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmailSent, setResetEmailSent] = useState(false);
  const [mfaRequired, setMfaRequired] = useState(false);
  const [mfaFactorId, setMfaFactorId] = useState<string | null>(null);
  const [mfaChallengeId, setMfaChallengeId] = useState<string | null>(null);
  const [mfaCode, setMfaCode] = useState('');
  const [mfaLoading, setMfaLoading] = useState(false);
  const [mfaError, setMfaError] = useState<string | null>(null);
  const { login, register, isAuthenticated, user } = useStore();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const forgotPasswordForm = useForm<{ email: string }>();
  
  const loginForm = useForm<LoginForm>();
  const registerForm = useForm<RegisterForm>();

  // Handle URL parameters and redirect if already authenticated
  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab === 'register') {
      // All signups go through /signup, which has the date-of-birth check.
      navigate('/signup', { replace: true });
      return;
    }
    
    // If user is already authenticated, redirect based on role.
    // Note: right after register(), auth state can flip true before the user object is hydrated.
    // sessionStorage provides a stable hint during that short window.
    if (isAuthenticated) {
      const hintedRole = sessionStorage.getItem('signup_role');
      const role = user?.role ?? hintedRole;
      const pendingOnboarding = sessionStorage.getItem('signup_pending_onboarding') === '1';
      if (role === 'musician' && pendingOnboarding) {
        navigate('/onboarding', { replace: true });
      } else {
        navigate('/', { replace: true });
      }
    }
  }, [searchParams, isAuthenticated, user, navigate]);

  const onLoginSubmit = async (data: LoginForm) => {
    setIsLoading(true);
    setError('');
    
    try {
      console.log('🔄 Starting login process for:', data.email);
      
      const loginPromise = login(data.email, data.password);
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Connection timed out. Check your internet and try again.')), 25000)
      );

      await Promise.race([loginPromise, timeoutPromise]);
      console.log('✅ Login completed successfully');

      // Check if MFA is required
      const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (aal?.nextLevel === 'aal2' && aal?.currentLevel === 'aal1') {
        const { data: factors } = await supabase.auth.mfa.listFactors();
        const factor = factors?.totp?.[0];
        if (factor) {
          const { data: challenge } = await supabase.auth.mfa.challenge({ factorId: factor.id });
          setMfaFactorId(factor.id);
          setMfaChallengeId(challenge?.id ?? null);
          setMfaRequired(true);
          setIsLoading(false);
          return;
        }
      }

      sessionStorage.removeItem('signup_role');
      sessionStorage.removeItem('signup_pending_onboarding');
    } catch (error) {
      console.error('❌ Login failed:', error);
      setError(error instanceof Error ? error.message : 'Login failed');
    } finally {
      setIsLoading(false);
    }
  };

  const onRegisterSubmit = async (data: RegisterForm) => {
    setIsLoading(true);
    setError('');
    
    try {
      // Set role hint BEFORE register() — auth listeners may fire mid-await.
      sessionStorage.setItem('signup_role', data.role);
      if (data.role === 'musician') {
        sessionStorage.setItem('signup_pending_onboarding', '1');
      }
      const user = await register({
        username: data.username,
        email: data.email,
        password: data.password,
        role: data.role,
        artistName: data.artistName,
        bio: data.bio,
      });
    } catch (error) {
      sessionStorage.removeItem('signup_role');
      sessionStorage.removeItem('signup_pending_onboarding');
      setError(error instanceof Error ? error.message : 'Registration failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleMFAVerify = async () => {
    if (!mfaFactorId || !mfaChallengeId || mfaCode.length !== 6) return;
    setMfaLoading(true);
    setMfaError(null);
    try {
      const { error } = await supabase.auth.mfa.verify({ factorId: mfaFactorId, challengeId: mfaChallengeId, code: mfaCode });
      if (error) throw error;
      sessionStorage.removeItem('signup_role');
      sessionStorage.removeItem('signup_pending_onboarding');
      // isAuthenticated effect will navigate
    } catch {
      setMfaError('Invalid code. Please try again.');
    } finally {
      setMfaLoading(false);
    }
  };

  const onForgotPasswordSubmit = async (data: { email: string }) => {
    setIsLoading(true);
    setError('');
    
    try {
      await AuthService.resetPassword(data.email);
      setResetEmailSent(true);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Password reset failed');
    } finally {
      setIsLoading(false);
    }
  };

  const switchTab = (tab: 'login' | 'register') => {
    setActiveTab(tab);
    setError('');
    setShowForgotPassword(false);
    setResetEmailSent(false);
    loginForm.reset();
    registerForm.reset();
    if (tab === 'register') {
      registerForm.setValue('role', 'consumer');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-dark-900 via-dark-800 to-primary-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="glass-effect rounded-2xl p-8"
        >
          {/* Header */}
          <div className="text-center mb-8">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
              className="w-16 h-16 bg-gradient-to-r from-primary-500 to-secondary-500 rounded-full flex items-center justify-center mx-auto mb-4 overflow-hidden"
            >
              <img src="/logo/logo.png" alt="Remix Logo" className="w-16 h-16 rounded-full object-cover" />
            </motion.div>
            <h1 className="h2 text-center mb-2 text-gradient-neon">Re-Mixed</h1>
            <p className="body text-center text-black">Connect with musicians and enthusiasts worldwide</p>
          </div>

          {/* Error Message */}
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg"
            >
              <p className="text-red-600 text-sm">{error}</p>
            </motion.div>
          )}


          {/* MFA Challenge */}
          {mfaRequired && (
            <div className="space-y-5">
              <div className="text-center">
                <div className="w-12 h-12 bg-primary-500/10 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Lock size={22} className="text-primary-400" />
                </div>
                <h3 className="text-lg font-semibold text-black">Two-Factor Authentication</h3>
                <p className="text-dark-300 text-sm mt-1">Enter the 6-digit code from your authenticator app.</p>
              </div>
              <div>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={mfaCode}
                  onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000"
                  className="w-full px-4 py-3 bg-dark-700 border border-dark-600 rounded-lg text-black text-center font-mono text-2xl tracking-widest placeholder-dark-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                  autoFocus
                />
                {mfaError && <p className="mt-2 text-sm text-red-400 text-center">{mfaError}</p>}
              </div>
              <motion.button
                type="button"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleMFAVerify}
                disabled={mfaLoading || mfaCode.length !== 6}
                className="w-full bg-gradient-to-r from-primary-600 to-secondary-600 text-black py-3 px-6 rounded-lg font-medium hover:from-primary-700 hover:to-secondary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 focus:ring-offset-dark-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {mfaLoading ? (
                  <div className="flex items-center justify-center">
                    <div className="spinner w-5 h-5 mr-2"></div>
                    Verifying...
                  </div>
                ) : (
                  'Verify'
                )}
              </motion.button>
              <button
                type="button"
                onClick={() => { setMfaRequired(false); setMfaCode(''); setMfaError(null); }}
                className="w-full text-sm text-dark-400 hover:text-black transition-colors"
              >
                ← Back to sign in
              </button>
            </div>
          )}

          {/* Login Form */}
          {!mfaRequired && activeTab === 'login' && !showForgotPassword && (
            <form onSubmit={loginForm.handleSubmit(onLoginSubmit)} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-black mb-2">
                  Email Address
                </label>
                <div className="relative">
                  <Mail size={20} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-dark-400" />
                  <input
                    {...loginForm.register('email', {
                      required: 'Email is required',
                      pattern: {
                        value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                        message: 'Invalid email address',
                      },
                    })}
                    type="email"
                    placeholder="Enter your email"
                    className="w-full pl-10 pr-4 py-3 bg-dark-700 border border-dark-600 rounded-lg text-black placeholder-dark-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                  />
                </div>
                {loginForm.formState.errors.email && (
                  <p className="mt-1 text-sm text-red-400">{loginForm.formState.errors.email.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-black mb-2">
                  Password
                </label>
                <div className="relative">
                  <Lock size={20} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-dark-400" />
                  <input
                    {...loginForm.register('password', {
                      required: 'Password is required',
                      minLength: {
                        value: 6,
                        message: 'Password must be at least 6 characters',
                      },
                    })}
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Enter your password"
                    className="w-full pl-10 pr-12 py-3 bg-dark-700 border border-dark-600 rounded-lg text-black placeholder-dark-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-dark-400 hover:text-black transition-colors"
                  >
                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
                {loginForm.formState.errors.password && (
                  <p className="mt-1 text-sm text-red-400">{loginForm.formState.errors.password.message}</p>
                )}
                <div className="mt-1 flex justify-end">
                  <button
                    type="button"
                    onClick={() => setShowForgotPassword(true)}
                    className="text-sm text-primary-400 hover:text-primary-300 transition-colors"
                  >
                    Forgot your password?
                  </button>
                </div>
              </div>

              <motion.button
                type="submit"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                disabled={isLoading}
                className="w-full bg-gradient-to-r from-primary-600 to-secondary-600 text-black py-3 px-6 rounded-lg font-medium hover:from-primary-700 hover:to-secondary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 focus:ring-offset-dark-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <div className="flex items-center justify-center">
                    <div className="spinner w-5 h-5 mr-2"></div>
                    Signing in...
                  </div>
                ) : (
                  'Sign In'
                )}
              </motion.button>
            </form>
          )}

          {/* Forgot Password Form */}
          {!mfaRequired && activeTab === 'login' && showForgotPassword && (
            <div className="space-y-6">
              {resetEmailSent ? (
                <div className="text-center">
                  <h3 className="text-xl font-medium text-black mb-2">Check Your Email</h3>
                  <p className="text-dark-300 mb-4">
                    We've sent password reset instructions to your email address.
                  </p>
                  <button
                    onClick={() => {
                      setShowForgotPassword(false);
                      setResetEmailSent(false);
                    }}
                    className="text-primary-400 hover:text-primary-300 transition-colors"
                  >
                    Return to login
                  </button>
                </div>
              ) : (
                <form onSubmit={forgotPasswordForm.handleSubmit(onForgotPasswordSubmit)}>
                  <h3 className="text-xl font-medium text-black mb-4">Reset Your Password</h3>
                  <p className="text-dark-300 mb-4">
                    Enter your email address and you will receive a Supabase Auth email instructions to reset your password.
                  </p>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-black mb-2">
                        Email Address
                      </label>
                      <div className="relative">
                        <Mail size={20} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-dark-400" />
                        <input
                          {...forgotPasswordForm.register('email', {
                            required: 'Email is required',
                            pattern: {
                              value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                              message: 'Invalid email address',
                            },
                          })}
                          type="email"
                          placeholder="Enter your email"
                          className="w-full pl-10 pr-4 py-3 bg-dark-700 border border-dark-600 rounded-lg text-black placeholder-dark-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                        />
                      </div>
                      {forgotPasswordForm.formState.errors.email && (
                        <p className="mt-1 text-sm text-red-400">
                          {forgotPasswordForm.formState.errors.email.message}
                        </p>
                      )}
                    </div>

                    <div className="flex space-x-3">
                      <motion.button
                        type="submit"
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        disabled={isLoading}
                        className="flex-1 bg-gradient-to-r from-primary-600 to-secondary-600 text-black py-3 px-6 rounded-lg font-medium hover:from-primary-700 hover:to-secondary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 focus:ring-offset-dark-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isLoading ? (
                          <div className="flex items-center justify-center">
                            <div className="spinner w-5 h-5 mr-2"></div>
                            Sending...
                          </div>
                        ) : (
                          'Send Reset Instructions'
                        )}
                      </motion.button>
                      <button
                        type="button"
                        onClick={() => setShowForgotPassword(false)}
                        className="px-6 py-3 border border-dark-600 rounded-lg text-dark-300 hover:text-black hover:border-dark-500 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* Register Form */}
          {!mfaRequired && activeTab === 'register' && (
            <form onSubmit={registerForm.handleSubmit(onRegisterSubmit)} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-black mb-2">
                  Username
                </label>
                <div className="relative">
                  <User size={20} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-dark-400" />
                  <input
                    {...registerForm.register('username', {
                      required: 'Username is required',
                      minLength: {
                        value: 3,
                        message: 'Username must be at least 3 characters',
                      },
                    })}
                    type="text"
                    placeholder="Choose a username"
                    className="w-full pl-10 pr-4 py-3 bg-dark-700 border border-dark-600 rounded-lg text-black placeholder-dark-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                  />
                </div>
                {registerForm.formState.errors.username && (
                  <p className="mt-1 text-sm text-red-400">{registerForm.formState.errors.username.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-black mb-2">
                  Email Address
                </label>
                <div className="relative">
                  <Mail size={20} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-dark-400" />
                  <input
                    {...registerForm.register('email', {
                      required: 'Email is required',
                      pattern: {
                        value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                        message: 'Invalid email address',
                      },
                    })}
                    type="email"
                    placeholder="Enter your email"
                    className="w-full pl-10 pr-4 py-3 bg-dark-700 border border-dark-600 rounded-lg text-black placeholder-dark-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                  />
                </div>
                {registerForm.formState.errors.email && (
                  <p className="mt-1 text-sm text-red-400">{registerForm.formState.errors.email.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-black mb-2">
                  Password
                </label>
                <div className="relative">
                  <Lock size={20} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-dark-400" />
                  <input
                    {...registerForm.register('password', {
                      required: 'Password is required',
                      minLength: {
                        value: 6,
                        message: 'Password must be at least 6 characters',
                      },
                    })}
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Create a password"
                    className="w-full pl-10 pr-12 py-3 bg-dark-700 border border-dark-600 rounded-lg text-black placeholder-dark-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-dark-400 hover:text-black transition-colors"
                  >
                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
                {registerForm.formState.errors.password && (
                  <p className="mt-1 text-sm text-red-400">{registerForm.formState.errors.password.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-black mb-2">
                  Confirm Password
                </label>
                <div className="relative">
                  <Lock size={20} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-dark-400" />
                  <input
                    {...registerForm.register('confirmPassword', {
                      required: 'Please confirm your password',
                      validate: (value) => value === registerForm.watch('password') || 'Passwords do not match',
                    })}
                    type={showConfirmPassword ? 'text' : 'password'}
                    placeholder="Confirm your password"
                    className="w-full pl-10 pr-12 py-3 bg-dark-700 border border-dark-600 rounded-lg text-black placeholder-dark-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-dark-400 hover:text-black transition-colors"
                  >
                    {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
                {registerForm.formState.errors.confirmPassword && (
                  <p className="mt-1 text-sm text-red-400">{registerForm.formState.errors.confirmPassword.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-black mb-2">
                  I am a...
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => registerForm.setValue('role', 'consumer')}
                    className={`p-3 rounded-lg border-2 transition-all ${
                      registerForm.watch('role') === 'consumer'
                        ? 'border-primary-500 bg-primary-500/10 text-primary-400'
                        : 'border-dark-600 text-dark-300 hover:border-dark-500 hover:text-black'
                    }`}
                  >
                    <Headphones size={20} className="mx-auto mb-2" />
                    <span className="text-sm font-medium">Listener</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => registerForm.setValue('role', 'musician')}
                    className={`p-3 rounded-lg border-2 transition-all ${
                      registerForm.watch('role') === 'musician'
                        ? 'border-primary-500 bg-primary-500/10 text-primary-400'
                        : 'border-dark-600 text-dark-300 hover:border-dark-500 hover:text-black'
                    }`}
                  >
                    <Mic size={20} className="mx-auto mb-2" />
                    <span className="text-sm font-medium">Musician</span>
                  </button>
                </div>
                <input
                  {...registerForm.register('role', {
                    required: 'Please select your role',
                    validate: (value) => ['musician', 'consumer'].includes(value) || 'Invalid role selected',
                  })}
                  type="hidden"
                />
                {registerForm.formState.errors.role && (
                  <p className="mt-1 text-sm text-red-400">{registerForm.formState.errors.role.message}</p>
                )}
              </div>

              {/* Conditional fields for musicians */}
              {registerForm.watch('role') === 'musician' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-black mb-2">
                      Artist Name
                    </label>
                    <div className="relative">
                      <Music size={20} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-dark-400" />
                      <input
                        {...registerForm.register('artistName', {
                          required: 'Artist name is required for musicians',
                          minLength: {
                            value: 2,
                            message: 'Artist name must be at least 2 characters',
                          },
                        })}
                        type="text"
                        placeholder="Your artist/stage name"
                        className="w-full pl-10 pr-4 py-3 bg-dark-700 border border-dark-600 rounded-lg text-black placeholder-dark-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                      />
                    </div>
                    {registerForm.formState.errors.artistName && (
                      <p className="mt-1 text-sm text-red-400">{registerForm.formState.errors.artistName.message}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-black mb-2">
                      Bio
                    </label>
                    <textarea
                      {...registerForm.register('bio')}
                      placeholder="Tell us about your music..."
                      rows={3}
                      className="w-full px-4 py-3 bg-dark-700 border border-dark-600 rounded-lg text-black placeholder-dark-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all resize-none"
                    />
                  </div>
                </>
              )}

              <motion.button
                type="submit"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                disabled={isLoading}
                className="w-full bg-gradient-to-r from-primary-600 to-secondary-600 text-black py-3 px-6 rounded-lg font-medium hover:from-primary-700 hover:to-secondary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 focus:ring-offset-dark-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <div className="flex items-center justify-center">
                    <div className="spinner w-5 h-5 mr-2"></div>
                    Creating account...
                  </div>
                ) : (
                  'Create Account'
                )}
              </motion.button>
            </form>
          )}

          {/* Footer */}
          {!mfaRequired && <div className="mt-6 text-center">
            <p className="text-sm text-dark-400">
              {activeTab === 'login' ? (
                <>
                  Don't have an account?{' '}
                  <Link to="/signup" className="text-primary-400 hover:text-primary-300 transition-colors">
                    Sign up
                  </Link>
                </>
              ) : (
                <>
                  Already have an account?{' '}
                  <button
                    onClick={() => switchTab('login')}
                    className="text-primary-400 hover:text-primary-300 transition-colors"
                  >
                    Sign in
                  </button>
                </>
              )}
            </p>
          </div>}
        </motion.div>
      </div>
    </div>
  );
};

export default Login;