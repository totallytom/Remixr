import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { useNavigate, Link } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff, Mic2, Headphones, ArrowRight, Music2 } from 'lucide-react';
import { AuthService } from '../services/authService';
import { useStore } from '../store/useStore';

type Role = 'Musician' | 'Consumer';

interface SignupForm {
  email: string;
  password: string;
}

const ROLE_OPTIONS: {
  value: Role;
  label: string;
  sublabel: string;
  icon: React.ReactNode;
  nextHint: string;
  gradient: string;
  activeBorder: string;
  activeBg: string;
}[] = [
  {
    value: 'Musician',
    label: 'Musician',
    sublabel: 'I create & share music',
    icon: <Mic2 size={28} strokeWidth={1.5} />,
    nextHint: 'Upload a track → get your shareable profile',
    gradient: 'from-violet-500 to-fuchsia-500',
    activeBorder: 'border-violet-500',
    activeBg: 'bg-violet-500/10',
  },
  {
    value: 'Consumer',
    label: 'Listener',
    sublabel: 'I discover & explore music',
    icon: <Headphones size={28} strokeWidth={1.5} />,
    nextHint: 'Tell us your taste → get a personalised feed',
    gradient: 'from-cyan-500 to-blue-500',
    activeBorder: 'border-cyan-500',
    activeBg: 'bg-cyan-500/10',
  },
];

const Signup: React.FC = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const { isAuthenticated } = useStore();
  const navigate = useNavigate();

  const { register, handleSubmit, formState: { errors } } = useForm<SignupForm>();

  useEffect(() => {
    if (!isAuthenticated) return;
    // Route based on role chosen during this signup session.
    // Falls back to home for returning users who visit /signup while logged in.
    const role = sessionStorage.getItem('signup_role');
    if (role === 'Musician') navigate('/onboarding');
    else navigate('/');
  }, [isAuthenticated, navigate]);

  const onSubmit = async (data: SignupForm) => {
    if (!selectedRole) {
      setError('Please choose your role to continue.');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      // Set role BEFORE register() — Supabase fires SIGNED_IN during the await,
      // which triggers the useEffect redirect. sessionStorage must be ready by then.
      sessionStorage.setItem('signup_role', selectedRole);

      const username = data.email.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '_');
      await AuthService.register({
        username,
        email: data.email,
        password: data.password,
        role: selectedRole,
      });
      navigate(selectedRole === 'Musician' ? '/onboarding' : '/');
    } catch (err) {
      sessionStorage.removeItem('signup_role');
      setError(err instanceof Error ? err.message : 'Registration failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-dark-900 via-dark-800 to-primary-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: 'easeOut' }}
        >
          {/* Logo + heading */}
          <div className="text-center mb-10">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.15, type: 'spring', stiffness: 220 }}
              className="w-16 h-16 rounded-full mx-auto mb-4 overflow-hidden ring-2 ring-primary-500/40"
            >
              <img src="/logo/logo.png" alt="Remixr" className="w-full h-full object-cover" />
            </motion.div>
            <h1 className="h2 text-gradient-neon mb-1">Join Remixr</h1>
            <p className="text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>
              Create your account in seconds.
            </p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} noValidate>
            <div className="glass-effect rounded-2xl p-8 space-y-6">

              {/* Error banner */}
              <AnimatePresence>
                {error && (
                  <motion.div
                    key="error"
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    className="p-3 bg-red-500/10 border border-red-500/25 rounded-lg"
                  >
                    <p className="text-sm text-red-400">{error}</p>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-white mb-2">Email</label>
                <div className="relative">
                  <Mail size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-400" />
                  <input
                    {...register('email', {
                      required: 'Email is required',
                      pattern: {
                        value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                        message: 'Enter a valid email',
                      },
                    })}
                    type="email"
                    placeholder="you@example.com"
                    autoComplete="email"
                    className="w-full pl-10 pr-4 py-3 bg-dark-700 border border-dark-600 rounded-lg text-white placeholder-dark-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                  />
                </div>
                {errors.email && (
                  <p className="mt-1 text-xs text-red-400">{errors.email.message}</p>
                )}
              </div>

              {/* Password */}
              <div>
                <label className="block text-sm font-medium text-white mb-2">Password</label>
                <div className="relative">
                  <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-400" />
                  <input
                    {...register('password', {
                      required: 'Password is required',
                      minLength: { value: 6, message: 'At least 6 characters' },
                    })}
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Min. 6 characters"
                    autoComplete="new-password"
                    className="w-full pl-10 pr-11 py-3 bg-dark-700 border border-dark-600 rounded-lg text-white placeholder-dark-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-dark-400 hover:text-white transition-colors"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                {errors.password && (
                  <p className="mt-1 text-xs text-red-400">{errors.password.message}</p>
                )}
              </div>

              {/* Role selector */}
              <div>
                <label className="block text-sm font-medium text-white mb-3">I am a…</label>
                <div className="grid grid-cols-2 gap-3">
                  {ROLE_OPTIONS.map((opt) => {
                    const active = selectedRole === opt.value;
                    return (
                      <motion.button
                        key={opt.value}
                        type="button"
                        onClick={() => { setSelectedRole(opt.value); setError(''); }}
                        whileTap={{ scale: 0.97 }}
                        className={`
                          relative flex flex-col items-center justify-center gap-2
                          p-5 rounded-xl border-2 transition-all text-center
                          ${active
                            ? `${opt.activeBorder} ${opt.activeBg}`
                            : 'border-dark-600 hover:border-dark-500'
                          }
                        `}
                      >

                        {/* Icon */}
                        <div className={`transition-colors ${active ? 'text-white' : 'text-dark-400'}`}>
                          {opt.icon}
                        </div>

                        {/* Labels */}
                        <div>
                          <p className={`text-sm font-semibold transition-colors ${active ? 'text-white' : 'text-dark-300'}`}>
                            {opt.label}
                          </p>
                          <p className={`text-xs mt-0.5 transition-colors ${active ? 'text-white/60' : 'text-dark-500'}`}>
                            {opt.sublabel}
                          </p>
                        </div>

                        {/* What happens next hint */}
                        {active && (
                          <motion.div
                            initial={{ opacity: 0, y: 4 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="mt-1 px-2 py-1 rounded-md bg-white/5 w-full"
                          >
                            <p className="text-[10px] text-white/50 flex items-center gap-1 justify-center">
                              <Music2 size={10} />
                              {opt.nextHint}
                            </p>
                          </motion.div>
                        )}
                      </motion.button>
                    );
                  })}
                </div>
              </div>

              {/* Submit */}
              <motion.button
                type="submit"
                disabled={isLoading}
                whileHover={{ scale: isLoading ? 1 : 1.02 }}
                whileTap={{ scale: isLoading ? 1 : 0.98 }}
                className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-primary-600 to-secondary-600 text-white py-3 px-6 rounded-lg font-semibold hover:from-primary-700 hover:to-secondary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 focus:ring-offset-dark-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <>
                    <div className="spinner w-4 h-4" />
                    Creating account…
                  </>
                ) : (
                  <>
                    Create account
                    <ArrowRight size={16} />
                  </>
                )}
              </motion.button>
            </div>
          </form>

          {/* Sign in link */}
          <p className="mt-6 text-center text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>
            Already have an account?{' '}
            <Link
              to="/login"
              className="text-primary-400 hover:text-primary-300 font-medium transition-colors"
            >
              Sign in
            </Link>
          </p>
        </motion.div>
      </div>
    </div>
  );
};

export default Signup;
