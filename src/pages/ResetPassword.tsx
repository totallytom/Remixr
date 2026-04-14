import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router-dom';
import { Lock, Eye, EyeOff, ArrowLeft } from 'lucide-react';
import { AuthService } from '../services/authService';
import { supabase } from '../services/supabase';

interface ResetPasswordForm {
  password: string;
  confirmPassword: string;
}

const ResetPassword: React.FC = () => {
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState(false);
  const [hasRecoverySession, setHasRecoverySession] = useState<boolean | null>(null);

  const { register, handleSubmit, watch, formState: { errors } } = useForm<ResetPasswordForm>();

  // When user clicks "Reset your password" in the Supabase email, they are redirected to
  // /reset-password#access_token=...&refresh_token=...&type=recovery
  // We process the hash so the recovery session is established, then show the form.
  useEffect(() => {
    let cancelled = false;
    const hash = window.location.hash;
    const hasRecoveryHash = hash && (hash.includes('type=recovery') || hash.includes('access_token='));

    if (!hasRecoveryHash) {
      setHasRecoverySession(false);
      return;
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (cancelled) return;
      if (event === 'PASSWORD_RECOVERY' || (event === 'INITIAL_SESSION' && session)) {
        setHasRecoverySession(true);
      }
    });

    // Trigger session read so Supabase consumes the URL hash and establishes the session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!cancelled) {
        setHasRecoverySession(!!session);
      }
    });

    return () => {
      cancelled = true;
      subscription?.unsubscribe();
    };
  }, []);

  const onSubmit = async (data: ResetPasswordForm) => {
    if (data.password !== data.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      await AuthService.setNewPassword(data.password);
      setSuccess(true);
      setTimeout(() => {
        navigate('/login');
      }, 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reset password');
    } finally {
      setIsLoading(false);
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
            <h1 className="text-3xl font-bold gradient-text mb-2 font-kotra">Reset Password</h1>
            <p className="text-gray-600">
              {hasRecoverySession === null
                ? 'Checking your reset link...'
                : hasRecoverySession
                  ? 'Enter your new password below'
                  : 'Use the link from your email to set a new password.'}
            </p>
          </div>

          {/* No valid recovery link */}
          {hasRecoverySession === false && (
            <div className="mb-4 p-4 bg-dark-700/50 border border-dark-600 rounded-lg text-center">
              <p className="text-gray-400 text-sm mb-4">
                This page is only valid when opened from the &quot;Reset your password&quot; email. The link may have expired or already been used.
              </p>
              <Link
                to="/login"
                className="inline-flex items-center gap-2 text-primary-400 hover:text-primary-300 text-sm font-medium"
              >
                <ArrowLeft size={16} />
                Back to login to request a new link
              </Link>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg"
            >
              <p className="text-red-400 text-sm">{error}</p>
            </motion.div>
          )}

          {/* Success Message */}
          {success && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-4 p-3 bg-green-500/10 border border-green-500/20 rounded-lg"
            >
              <p className="text-green-400 text-sm">
                Password reset successful! Redirecting to login...
              </p>
            </motion.div>
          )}

          {/* Reset Password Form - show when we have a recovery session or when still checking (allow submit once session is ready) */}
          {(hasRecoverySession === null || hasRecoverySession === true) && (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-black mb-2">
                New Password
              </label>
              <div className="relative">
                <Lock size={20} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500" />
                <input
                  {...register('password', {
                    required: 'Password is required',
                    minLength: {
                      value: 6,
                      message: 'Password must be at least 6 characters',
                    },
                  })}
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter new password"
                  className="w-full pl-10 pr-12 py-3 bg-dark-700 border border-dark-600 rounded-lg text-black placeholder-dark-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-black transition-colors"
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
              {errors.password && (
                <p className="mt-1 text-sm text-red-400">{errors.password.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-black mb-2">
                Confirm New Password
              </label>
              <div className="relative">
                <Lock size={20} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500" />
                <input
                  {...register('confirmPassword', {
                    required: 'Please confirm your password',
                    validate: (value) => value === watch('password') || 'Passwords do not match',
                  })}
                  type={showConfirmPassword ? 'text' : 'password'}
                  placeholder="Confirm new password"
                  className="w-full pl-10 pr-12 py-3 bg-dark-700 border border-dark-600 rounded-lg text-black placeholder-dark-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-black transition-colors"
                >
                  {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
              {errors.confirmPassword && (
                <p className="mt-1 text-sm text-red-400">{errors.confirmPassword.message}</p>
              )}
            </div>

            <motion.button
              type="submit"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              disabled={isLoading || hasRecoverySession !== true}
              className="w-full bg-gradient-to-r from-primary-600 to-secondary-600 text-black py-3 px-6 rounded-lg font-medium hover:from-primary-700 hover:to-secondary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 focus:ring-offset-dark-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {hasRecoverySession === null ? (
                <div className="flex items-center justify-center">
                  <div className="spinner w-5 h-5 mr-2"></div>
                  Checking link...
                </div>
              ) : isLoading ? (
                <div className="flex items-center justify-center">
                  <div className="spinner w-5 h-5 mr-2"></div>
                  Resetting Password...
                </div>
              ) : (
                'Reset Password'
              )}
            </motion.button>

            <Link
              to="/login"
              className="flex items-center justify-center gap-2 text-sm text-gray-500 hover:text-primary-400 transition-colors mt-4"
            >
              <ArrowLeft size={16} />
              Back to login
            </Link>
          </form>
          )}
        </motion.div>
      </div>
    </div>
  );
};

export default ResetPassword;
