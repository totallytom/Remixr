import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Music, Mail, Lock, Eye, EyeOff, User, Mic, Headphones } from 'lucide-react';
import { useStore } from '../store/useStore';
import { AuthService } from '../services/authService';

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
  const { login, register, isAuthenticated } = useStore();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const forgotPasswordForm = useForm<{ email: string }>();
  
  const loginForm = useForm<LoginForm>();
  const registerForm = useForm<RegisterForm>();

  // Handle URL parameters and redirect if already authenticated
  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab === 'register') {
      setActiveTab('register');
    }
    
    // If user is already authenticated, redirect to home
    if (isAuthenticated) {
      navigate('/');
    }
  }, [searchParams, isAuthenticated]);

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
      const user = await register({
        username: data.username,
        email: data.email,
        password: data.password,
        role: data.role,
        artistName: data.artistName,
        bio: data.bio,
      });
      // After successful registration, create Stripe customer
      if (user && user.id && user.email) {
        await fetch('/api/create-stripe-customer', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: user.id, email: user.email })
        });
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Registration failed');
    } finally {
      setIsLoading(false);
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
            <h1 className="h2 text-center mb-2 text-gradient-neon">Remix</h1>
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

          {/* Tabs */}
          <div className="flex mb-6 bg-dark-700 rounded-lg p-1">
            <button
              onClick={() => switchTab('login')}
              className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all ${
                activeTab === 'login'
                  ? 'bg-primary-600 text-white'
                  : 'text-dark-300 hover:text-white'
              }`}
            >
              Sign In
            </button>
            <button
              onClick={() => switchTab('register')}
              className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all ${
                activeTab === 'register'
                  ? 'bg-primary-600 text-white'
                  : 'text-dark-300 hover:text-white'
              }`}
            >
              Sign Up
            </button>
          </div>

          {/* Login Form */}
          {activeTab === 'login' && !showForgotPassword && (
            <form onSubmit={loginForm.handleSubmit(onLoginSubmit)} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-white mb-2">
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
                    className="w-full pl-10 pr-4 py-3 bg-dark-700 border border-dark-600 rounded-lg text-white placeholder-dark-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                  />
                </div>
                {loginForm.formState.errors.email && (
                  <p className="mt-1 text-sm text-red-400">{loginForm.formState.errors.email.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-white mb-2">
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
                    className="w-full pl-10 pr-12 py-3 bg-dark-700 border border-dark-600 rounded-lg text-white placeholder-dark-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-dark-400 hover:text-white transition-colors"
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
                className="w-full bg-gradient-to-r from-primary-600 to-secondary-600 text-white py-3 px-6 rounded-lg font-medium hover:from-primary-700 hover:to-secondary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 focus:ring-offset-dark-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
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
          {activeTab === 'login' && showForgotPassword && (
            <div className="space-y-6">
              {resetEmailSent ? (
                <div className="text-center">
                  <h3 className="text-xl font-medium text-white mb-2">Check Your Email</h3>
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
                  <h3 className="text-xl font-medium text-white mb-4">Reset Your Password</h3>
                  <p className="text-dark-300 mb-4">
                    Enter your email address and you will receive a Supabase Auth email instructions to reset your password.
                  </p>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-white mb-2">
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
                          className="w-full pl-10 pr-4 py-3 bg-dark-700 border border-dark-600 rounded-lg text-white placeholder-dark-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
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
                        className="flex-1 bg-gradient-to-r from-primary-600 to-secondary-600 text-white py-3 px-6 rounded-lg font-medium hover:from-primary-700 hover:to-secondary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 focus:ring-offset-dark-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
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
                        className="px-6 py-3 border border-dark-600 rounded-lg text-dark-300 hover:text-white hover:border-dark-500 transition-colors"
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
          {activeTab === 'register' && (
            <form onSubmit={registerForm.handleSubmit(onRegisterSubmit)} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-white mb-2">
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
                    className="w-full pl-10 pr-4 py-3 bg-dark-700 border border-dark-600 rounded-lg text-white placeholder-dark-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                  />
                </div>
                {registerForm.formState.errors.username && (
                  <p className="mt-1 text-sm text-red-400">{registerForm.formState.errors.username.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-white mb-2">
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
                    className="w-full pl-10 pr-4 py-3 bg-dark-700 border border-dark-600 rounded-lg text-white placeholder-dark-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                  />
                </div>
                {registerForm.formState.errors.email && (
                  <p className="mt-1 text-sm text-red-400">{registerForm.formState.errors.email.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-white mb-2">
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
                    className="w-full pl-10 pr-12 py-3 bg-dark-700 border border-dark-600 rounded-lg text-white placeholder-dark-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-dark-400 hover:text-white transition-colors"
                  >
                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
                {registerForm.formState.errors.password && (
                  <p className="mt-1 text-sm text-red-400">{registerForm.formState.errors.password.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-white mb-2">
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
                    className="w-full pl-10 pr-12 py-3 bg-dark-700 border border-dark-600 rounded-lg text-white placeholder-dark-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-dark-400 hover:text-white transition-colors"
                  >
                    {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
                {registerForm.formState.errors.confirmPassword && (
                  <p className="mt-1 text-sm text-red-400">{registerForm.formState.errors.confirmPassword.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  I am a...
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => registerForm.setValue('role', 'consumer')}
                    className={`p-3 rounded-lg border-2 transition-all ${
                      registerForm.watch('role') === 'consumer'
                        ? 'border-primary-500 bg-primary-500/10 text-primary-400'
                        : 'border-dark-600 text-dark-300 hover:border-dark-500 hover:text-white'
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
                        : 'border-dark-600 text-dark-300 hover:border-dark-500 hover:text-white'
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
                    <label className="block text-sm font-medium text-white mb-2">
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
                        className="w-full pl-10 pr-4 py-3 bg-dark-700 border border-dark-600 rounded-lg text-white placeholder-dark-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                      />
                    </div>
                    {registerForm.formState.errors.artistName && (
                      <p className="mt-1 text-sm text-red-400">{registerForm.formState.errors.artistName.message}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-white mb-2">
                      Bio
                    </label>
                    <textarea
                      {...registerForm.register('bio')}
                      placeholder="Tell us about your music..."
                      rows={3}
                      className="w-full px-4 py-3 bg-dark-700 border border-dark-600 rounded-lg text-white placeholder-dark-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all resize-none"
                    />
                  </div>
                </>
              )}

              <motion.button
                type="submit"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                disabled={isLoading}
                className="w-full bg-gradient-to-r from-primary-600 to-secondary-600 text-white py-3 px-6 rounded-lg font-medium hover:from-primary-700 hover:to-secondary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 focus:ring-offset-dark-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
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
          <div className="mt-6 text-center">
            <p className="text-sm text-dark-400">
              {activeTab === 'login' ? "Don't have an account? " : "Already have an account? "}
              <button 
                onClick={() => switchTab(activeTab === 'login' ? 'register' : 'login')}
                className="text-primary-400 hover:text-primary-300 transition-colors"
              >
                {activeTab === 'login' ? 'Sign up' : 'Sign in'}
              </button>
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default Login;