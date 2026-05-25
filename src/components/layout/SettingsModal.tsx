import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import i18n from '../../i18n';
import {
  X,
  User,
  Mail,
  Lock,
  Shield,
  Bell,
  Palette,
  LogOut,
  Eye,
  EyeOff,
  Save,
  Check,
  Circle,
  Moon,
  Globe,
  EyeOff as InvisibleIcon,
  Star,
} from 'lucide-react';
import { useStore } from '../../store/useStore';
import { applyTheme, themeConfigs } from '../../data/themeConfig';
import { AuthService } from '../../services/authService';
import { DEFAULT_AVATAR_URL, getAvatarUrl } from '../../utils/avatar';
import { proSubscriptionService, ProSubscription } from '../../services/proSubscriptionService';
import { PRICING } from '../../config/pricing';

interface SettingsModalProps {
  isOpen: boolean;
  initialTab?: 'account' | 'security' | 'notifications' | 'appearance' | 'pro';
}

interface ChangeEmailForm {
  currentEmail: string;
  newEmail: string;
  password: string;
}

interface ChangePasswordForm {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, initialTab }) => {
  const { user, setSettingsOpen, theme, setTheme, setUserAvatar, updateProfile, changePassword, togglePrivateAccount, logout, userStatus, setUserStatus, refreshUser } = useStore();
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<'account' | 'security' | 'notifications' | 'appearance' | 'pro'>(initialTab || 'account');
  const navigate = useNavigate();
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [avatarPreview, setAvatarPreview] = useState<string | null>(user?.avatar || null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [privacyLoading, setPrivacyLoading] = useState(false);

  const [deleteLoading, setDeleteLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const [resetPasswordEmail, setResetPasswordEmail] = useState(user?.email || '');
  const [resetPasswordLoading, setResetPasswordLoading] = useState(false);
  const [resetPasswordSent, setResetPasswordSent] = useState(false);
  const [resetPasswordError, setResetPasswordError] = useState('');

  const [proSubscription, setProSubscription] = useState<ProSubscription | null>(null);
  const [proSubLoading, setProSubLoading] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);
  const [portalError, setPortalError] = useState('');

  useEffect(() => {
    if (isOpen && initialTab) setActiveTab(initialTab);
  }, [isOpen, initialTab]);

  useEffect(() => {
    if (!isOpen || !user?.id || activeTab !== 'pro') return;
    setProSubLoading(true);
    refreshUser()
      .then(() => proSubscriptionService.getSubscription(user.id))
      .then((sub) => {
        setProSubscription(sub);
        // If subscription record is active but store still says free (webhook may have been slow/missed),
        // patch the store so Pro UI and feature gates work for this session.
        if (sub && (sub.status === 'active' || sub.status === 'past_due')) {
          const storeUser = useStore.getState().user;
          if (storeUser && storeUser.subscriptionTier !== 'pro') {
            useStore.setState({ user: { ...storeUser, subscriptionTier: 'pro' } });
          }
        }
      })
      .finally(() => setProSubLoading(false));
  }, [isOpen, user?.id, activeTab]);

  useEffect(() => {
    if (user?.email) setResetPasswordEmail(user.email);
  }, [user?.email]);

  const [emailForm, setEmailForm] = useState<ChangeEmailForm>({
    currentEmail: user?.email || '',
    newEmail: '',
    password: ''
  });

  const [passwordForm, setPasswordForm] = useState<ChangePasswordForm>({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  const tabs = [
    { id: 'account', label: t('settings.tabs.account'), icon: User },
    { id: 'security', label: t('settings.tabs.security'), icon: Shield },
    { id: 'notifications', label: t('settings.tabs.notifications'), icon: Bell },
    { id: 'pro', label: t('settings.tabs.subscription'), icon: Star },
  ];

  const handleEmailChange = (field: keyof ChangeEmailForm, value: string) => {
    setEmailForm(prev => ({ ...prev, [field]: value }));
  };

  const handlePasswordChange = (field: keyof ChangePasswordForm, value: string) => {
    setPasswordForm(prev => ({ ...prev, [field]: value }));
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMessage('');
    
    try {
      await updateProfile({ email: emailForm.newEmail });
      setSuccessMessage('Email updated successfully!');
      setEmailForm(prev => ({ ...prev, newEmail: '', password: '' }));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to update email');
    } finally {
      setIsLoading(false);
      setTimeout(() => {
        setSuccessMessage('');
        setErrorMessage('');
      }, 3000);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMessage('');
    
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setErrorMessage('New passwords do not match');
      setIsLoading(false);
      return;
    }
    
    try {
      await changePassword(passwordForm.currentPassword, passwordForm.newPassword);
      setSuccessMessage('Password updated successfully!');
      setPasswordForm({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to update password');
    } finally {
      setIsLoading(false);
      setTimeout(() => {
        setSuccessMessage('');
        setErrorMessage('');
      }, 3000);
    }
  };

  const handleForgotPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const email = resetPasswordEmail.trim();
    if (!email) {
      setResetPasswordError('Please enter your email address');
      setTimeout(() => setResetPasswordError(''), 3000);
      return;
    }
    setResetPasswordLoading(true);
    setResetPasswordError('');
    setResetPasswordSent(false);
    try {
      await AuthService.resetPassword(email);
      setResetPasswordSent(true);
    } catch (error) {
      setResetPasswordError(error instanceof Error ? error.message : 'Failed to send reset email');
    } finally {
      setResetPasswordLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      setSettingsOpen(false);
    } catch (error) {
      console.error('Logout error:', error);
      // Force logout even if API call fails
      setSettingsOpen(false);
    }
  };

  {/*const handleThemeChange = (type: 'dark' | 'light' | 'auto') => {
    const newTheme = { ...theme, type };
    setTheme(newTheme);
    applyTheme(newTheme);
  };*/}

  const handleAccentColorChange = (accentColor: 'primary' | 'secondary' | 'green' | 'purple') => {
    const newTheme = { ...theme, accentColor };
    setTheme(newTheme);
    applyTheme(newTheme);
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      setAvatarFile(file);
      const reader = new FileReader();
      reader.onload = (ev) => {
        setAvatarPreview(ev.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAvatarSave = async () => {
    if (avatarPreview) {
      try {
        await updateProfile({ avatar: avatarPreview });
        setUserAvatar(avatarPreview);
        setAvatarFile(null);
        setSuccessMessage('Avatar updated successfully!');
        setTimeout(() => setSuccessMessage(''), 3000);
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : 'Failed to update avatar');
        setTimeout(() => setErrorMessage(''), 3000);
      }
    }
  };

  const handleRemoveAvatar = async () => {
    try {
      await updateProfile({ avatar: DEFAULT_AVATAR_URL });
      setAvatarPreview(DEFAULT_AVATAR_URL);
      setUserAvatar(DEFAULT_AVATAR_URL);
      setAvatarFile(null);
      setSuccessMessage('Avatar removed successfully!');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to remove avatar');
      setTimeout(() => setErrorMessage(''), 3000);
    }
  };

  const handlePrivacyToggle = async () => {
    if (!user) return;
    setPrivacyLoading(true);
    setErrorMessage('');
    try {
      const updated = await togglePrivateAccount(user.id, !user.isPrivate);
      setSuccessMessage(`Account is now ${updated.isPrivate ? 'private' : 'public'}`);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to update privacy');
    } finally {
      setPrivacyLoading(false);
      setTimeout(() => setSuccessMessage(''), 3000);
    }
  };

  const handleDeleteAccount = async () => {
    if (!user) return;
    setDeleteLoading(true);
    setErrorMessage('');
    try {
      await AuthService.deleteAccount(user.id);
      setSuccessMessage('Account deleted. Logging out...');
      setTimeout(async () => {
        await logout();
        setSettingsOpen(false);
      }, 1500);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to delete account');
    } finally {
      setDeleteLoading(false);
      setTimeout(() => setSuccessMessage(''), 3000);
    }
  };

  const renderAccountTab = () => (
    <div className="space-y-6">
      <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
          <User className="mr-2 text-blue-600" />
          <span className="text-base font-semibold">Profile Information</span>
        </h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Profile Picture</label>
            <div className="flex items-center space-x-4">
              <img
                src={getAvatarUrl(avatarPreview ?? user?.avatar)}
                alt="Profile Preview"
                className="w-16 h-16 rounded-full object-cover border-2 border-primary-500"
              />
              <input
                type="file"
                accept="image/*"
                onChange={handleAvatarChange}
                className="block text-xs text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100"
              />
              {avatarFile && (
                <button
                  onClick={handleAvatarSave}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Save
                </button>
              )}
              <button
                onClick={handleRemoveAvatar}
                className="px-2 py-1 text-xs border border-red-500 text-red-500 rounded hover:bg-red-50 hover:text-red-700 transition-colors ml-2"
                type="button"
              >
                Remove Photo
              </button>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Username</label>
            <input
              type="text"
              value={user?.username || ''}
              disabled
              className="w-full px-4 py-3 bg-gray-100 border border-gray-300 rounded-lg text-gray-600 opacity-50 cursor-not-allowed"
            />
            <p className="text-sm text-gray-500 mt-1">Username cannot be changed</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Current Email</label>
            <input
              type="email"
              value={user?.email || ''}
              disabled
              className="w-full px-4 py-3 bg-gray-100 border border-gray-300 rounded-lg text-gray-600 opacity-50 cursor-not-allowed"
            />
          </div>
        </div>
      </div>

      {/* Manual Status: Online, Idle, Invisible */}
      <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
        <p className="text-lg font-semibold text-gray-800 mb-2 flex items-center">
          <Circle className="mr-2 text-blue-600" size={20} />
          Status
        </p>
        <p className="text-gray-600 text-sm mb-4">Choose how you appear to others in chat and across the app.</p>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => setUserStatus('online')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium transition-colors border ${
              userStatus === 'online'
                ? 'bg-green-600 text-white border-green-600'
                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
            }`}
          >
            <span className="w-2.5 h-2.5 rounded-full bg-green-500" aria-hidden />
            Online
          </button>
          <button
            type="button"
            onClick={() => setUserStatus('idle')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium transition-colors border ${
              userStatus === 'idle'
                ? 'bg-amber-600 text-white border-amber-600'
                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
            }`}
          >
            <Moon className="w-4 h-4" />
            Idle
          </button>
          <button
            type="button"
            onClick={() => setUserStatus('invisible')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium transition-colors border ${
              userStatus === 'invisible'
                ? 'bg-gray-600 text-white border-gray-600'
                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
            }`}
          >
            <InvisibleIcon className="w-4 h-4" />
            Offline
          </button>
        </div>
      </div>

      {/* Privacy Toggle */}
      <div className="bg-gray-50 rounded-lg p-6 flex items-center justify-between border border-gray-200">
        <div>
          <p className="text-lg font-semibold text-gray-800 mb-1 flex items-center">
            <Shield className="mr-2 text-blue-600" />
            Private Account
          </p>
          <p className="text-gray-600 text-sm">Only approved followers can see your profile and uploads.</p>
        </div>
        <button
          onClick={handlePrivacyToggle}
          disabled={privacyLoading}
          className={`ml-4 px-4 py-2 rounded-lg font-semibold transition-colors ${user?.isPrivate ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'} ${privacyLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          {privacyLoading ? 'Saving...' : user?.isPrivate ? 'Private' : 'Public'}
        </button>
      </div>
      {/* Delete Account */}
      <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
        <p className="text-lg font-semibold text-red-600 mb-2 flex items-center">
          <LogOut className="mr-2" />
          Delete Account
        </p>
        <p className="text-gray-600 mb-4">Permanently delete your account and all data. This action cannot be undone.</p>
        <button
          onClick={() => setShowDeleteConfirm(true)}
          className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center space-x-2"
          disabled={deleteLoading}
        >
          {deleteLoading ? 'Deleting...' : 'Delete Account'}
        </button>
        {showDeleteConfirm && (
          <div className="mt-4 p-4 bg-gray-100 rounded-lg border border-gray-200">
            <p className="text-gray-800 mb-2">Are you sure you want to delete your account? This cannot be undone.</p>
            <div className="flex space-x-2">
              <button
                onClick={handleDeleteAccount}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                disabled={deleteLoading}
              >
                Yes, Delete
              </button>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
                disabled={deleteLoading}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Language Switcher */}
      <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
        <p className="text-lg font-semibold text-gray-800 mb-1 flex items-center">
          <Globe className="mr-2 text-blue-600" size={20} />
          {t('settings.language.title')}
        </p>
        <p className="text-gray-600 text-sm mb-4">{t('settings.language.subtitle')}</p>
        <div className="flex flex-wrap gap-2">
          {(['en', 'ko', 'ja'] as const).map((lang) => (
            <button
              key={lang}
              type="button"
              onClick={() => i18n.changeLanguage(lang)}
              className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors border ${
                i18n.language === lang
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              }`}
            >
              {t(`settings.language.${lang}`)}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
        <p className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
          <Mail className="mr-2 text-blue-600" />
          Change Email
        </p>
        <form onSubmit={handleEmailSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">New Email</label>
            <input
              type="email"
              value={emailForm.newEmail}
              onChange={(e) => handleEmailChange('newEmail', e.target.value)}
              className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter new email"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Current Password</label>
            <input
              type="password"
              value={emailForm.password}
              onChange={(e) => handleEmailChange('password', e.target.value)}
              className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter current password"
              required
            />
          </div>
          <button
            type="submit"
            disabled={isLoading}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
          >
            {isLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Updating...</span>
              </>
            ) : (
              <>
                <Save size={16} />
                <span>Update Email</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );

  const renderSecurityTab = () => (
    <div className="space-y-6">
      <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
        <p className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
          <Lock className="mr-2 text-blue-600" />
          Change Password
        </p>
        <form onSubmit={handlePasswordSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Current Password</label>
            <div className="relative">
              <input
                type={showCurrentPassword ? 'text' : 'password'}
                value={passwordForm.currentPassword}
                onChange={(e) => handlePasswordChange('currentPassword', e.target.value)}
                className="w-full px-4 py-3 pr-10 bg-white border border-gray-300 rounded-lg text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter current password"
                required
              />
              <button
                type="button"
                onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
              >
                {showCurrentPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">New Password</label>
            <div className="relative">
              <input
                type={showNewPassword ? 'text' : 'password'}
                value={passwordForm.newPassword}
                onChange={(e) => handlePasswordChange('newPassword', e.target.value)}
                className="w-full px-4 py-3 pr-10 bg-white border border-gray-300 rounded-lg text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter new password"
                required
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
              >
                {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Confirm New Password</label>
            <div className="relative">
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                value={passwordForm.confirmPassword}
                onChange={(e) => handlePasswordChange('confirmPassword', e.target.value)}
                className="w-full px-4 py-3 pr-10 bg-white border border-gray-300 rounded-lg text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Confirm new password"
                required
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
              >
                {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
          <button
            type="submit"
            disabled={isLoading}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
          >
            {isLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Updating...</span>
              </>
            ) : (
              <>
                <Save size={16} />
                <span>Update Password</span>
              </>
            )}
          </button>
        </form>
      </div>

      {/* Forgot password - reset via email */}
      <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
        <p className="text-lg font-semibold text-gray-800 mb-2 flex items-center">
          <Mail className="mr-2 text-blue-600" />
          Forgot your password?
        </p>
        <p className="text-gray-600 text-sm mb-4">
          Enter your account email and we&apos;ll send you a link to reset your password.
        </p>
        {resetPasswordSent ? (
          <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-green-800 text-sm flex items-center space-x-2">
            <Check size={16} />
            <span>Check your email for a link to reset your password. The link will expire after a short time.</span>
          </div>
        ) : (
          <form onSubmit={handleForgotPasswordSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Email address</label>
              <input
                type="email"
                value={resetPasswordEmail}
                onChange={(e) => setResetPasswordEmail(e.target.value)}
                className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter your email"
                disabled={resetPasswordLoading}
              />
            </div>
            {resetPasswordError && (
              <p className="text-sm text-red-600">{resetPasswordError}</p>
            )}
            <button
              type="submit"
              disabled={resetPasswordLoading}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
            >
              {resetPasswordLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Sending...</span>
                </>
              ) : (
                <>
                  <Mail size={16} />
                  <span>Send reset link</span>
                </>
              )}
            </button>
          </form>
        )}
      </div>

      <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
        <p className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
          <LogOut className="mr-2 text-red-600" />
          Logout
        </p>
        <p className="text-gray-600 mb-4">Sign out of your account</p>
        <button
          onClick={handleLogout}
          className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center space-x-2"
        >
          <LogOut size={16} />
          <span>Logout</span>
        </button>
      </div>
    </div>
  );

  const renderNotificationsTab = () => (
    <div className="space-y-6">
      <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
        <p className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
          <Bell className="mr-2 text-blue-600" />
          Notification Preferences
        </p>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-800 font-medium">New Music</p>
              <p className="text-gray-600 text-sm">Get notified when artists you follow release new music</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" defaultChecked className="sr-only peer" />
              <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-800 font-medium">Comments</p>
              <p className="text-gray-600 text-sm">Get notified when someone comments on your posts</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" defaultChecked className="sr-only peer" />
              <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-800 font-medium">Messages</p>
              <p className="text-gray-600 text-sm">Get notified when you receive new messages</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" className="sr-only peer" />
              <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>
        </div>
      </div>
    </div>
  );

  const renderProTab = () => {
    // Use the DB subscription record as ground truth — the store's subscriptionTier
    // can be stale if the webhook hasn't updated it yet.
    const isPro =
      user?.subscriptionTier === 'pro' ||
      Boolean(proSubscription && (proSubscription.status === 'active' || proSubscription.status === 'past_due'));

    const handleOpenPortal = async () => {
      setPortalLoading(true);
      setPortalError('');
      try {
        await proSubscriptionService.openPortal();
      } catch (err) {
        setPortalError(err instanceof Error ? err.message : 'Could not open billing portal');
      } finally {
        setPortalLoading(false);
      }
    };

    if (proSubLoading) {
      return (
        <div className="flex items-center justify-center py-16 gap-2 text-gray-400 text-sm">
          <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
          Loading subscription…
        </div>
      );
    }

    return (
      <div className="space-y-4">

        {/* Current plan card */}
        <div className={`rounded-xl border p-5 ${isPro ? 'bg-yellow-50 border-yellow-200' : 'bg-gray-50 border-gray-200'}`}>
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${isPro ? 'bg-yellow-100' : 'bg-gray-200'}`}>
                <Star size={15} className={isPro ? 'text-yellow-500' : 'text-gray-400'} />
              </div>
              <p className="font-semibold text-gray-800">{isPro ? 'Remixr Pro' : 'Free plan'}</p>
            </div>
            <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${isPro ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'}`}>
              {isPro ? 'Active' : 'Free'}
            </span>
          </div>
          {isPro && proSubscription && (
            <p className="text-sm text-gray-500 capitalize ml-10">
              {proSubscription.plan} plan
              {' · '}
              {proSubscription.cancelAtPeriodEnd ? 'Cancels' : 'Renews'}{' '}
              {new Date(proSubscription.currentPeriodEnd).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
            </p>
          )}
          {!isPro && (
            <p className="text-sm text-gray-500 ml-10">Up to 10 tracks · 2 albums · core features</p>
          )}
        </div>

        {/* Cancellation notice */}
        {isPro && proSubscription?.cancelAtPeriodEnd && (
          <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4">
            <Star size={16} className="text-amber-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-amber-700">
              Your Pro access ends on{' '}
              <strong>
                {new Date(proSubscription.currentPeriodEnd).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}
              </strong>
              . You won't be charged again. Resubscribe any time to keep Pro.
            </p>
          </div>
        )}

        {/* Manage subscription (Pro users) */}
        {isPro && (
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-5 space-y-3">
            <div>
              <p className="text-sm font-semibold text-gray-800 mb-0.5">Manage subscription</p>
              <p className="text-xs text-gray-500">Update your payment method, download invoices, or cancel — all through the Stripe billing portal.</p>
            </div>
            <button
              onClick={handleOpenPortal}
              disabled={portalLoading}
              className="flex items-center gap-2 px-4 py-2.5 bg-green-300 hover:bg-orange-600 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
            >
              {portalLoading ? (
                <><div className="w-3.5 h-3.5 border-2 border-white/60 border-t-transparent rounded-full animate-spin" /> Opening portal…</>
              ) : (
                <>Open billing portal <span aria-hidden>↗</span></>
              )}
            </button>
            {portalError && (
              <div className="space-y-1.5">
                <p className="text-xs text-red-500">{portalError}</p>
                <p className="text-xs text-gray-500">
                  If the portal won't open, contact support with the email on your account.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Upgrade CTA (Free users) */}
        {!isPro && (
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-5 space-y-4">
            <div>
              <p className="text-sm font-semibold text-gray-800 mb-1">Unlock Remixr Pro</p>
              <p className="text-xs text-gray-500">Unlimited uploads, priority Discover placement, analytics, enhanced profile, and more.</p>
            </div>
            <div className="flex gap-2 text-sm">
              <div className="flex-1 bg-white border border-gray-200 rounded-lg px-3 py-2 text-center">
                <p className="font-bold text-gray-900">{PRICING.monthly.display}</p>
                <p className="text-xs text-gray-500">per month</p>
              </div>
              <div className="flex-1 bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2 text-center relative">
                <span className="absolute -top-2 left-1/2 -translate-x-1/2 text-[10px] bg-yellow-400 text-yellow-900 px-1.5 py-0.5 rounded-full font-bold whitespace-nowrap">2 months free</span>
                <p className="font-bold text-gray-900 mt-1">{PRICING.yearly.display}</p>
                <p className="text-xs text-gray-500">per month, billed yearly</p>
              </div>
            </div>
            <button
              onClick={() => { setSettingsOpen(false); navigate('/upgrade'); }}
              className="w-full py-2.5 bg-yellow-500 hover:bg-yellow-400 text-gray-900 rounded-lg font-semibold text-sm transition-colors"
            >
              View plans and upgrade
            </button>
          </div>
        )}
      </div>
    );
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'account':
        return renderAccountTab();
      case 'security':
        return renderSecurityTab();
      case 'notifications':
        return renderNotificationsTab();
      case 'pro':
        return renderProTab();
      default:
        return renderAccountTab();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-70 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="bg-white rounded-lg shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden border-2 border-gray-200"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <p className="text-2xl font-bold text-gray-800">{t('settings.title')}</p>
              <button
                onClick={() => setSettingsOpen(false)}
                className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <X size={24} className="text-gray-600" />
              </button>
            </div>

            {/* Success Message */}
            {successMessage && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mx-6 mt-4 p-3 bg-green-600 text-white rounded-lg flex items-center space-x-2"
              >
                <Check size={16} />
                <span>{successMessage}</span>
              </motion.div>
            )}

            {/* Error Message */}
            {errorMessage && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mx-6 mt-4 p-3 bg-red-600 text-white rounded-lg flex items-center space-x-2"
              >
                <X size={16} />
                <span>{errorMessage}</span>
              </motion.div>
            )}

            {/* Tabs */}
            <div className="flex border-b border-gray-200">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`flex-1 flex items-center justify-center px-4 py-3 font-medium text-sm transition-colors ${
                      activeTab === tab.id
                        ? 'bg-blue-600 text-white border-b-2 border-blue-600'
                        : 'bg-gray-50 text-gray-600 hover:bg-gray-100 hover:text-gray-800'
                    }`}
                  >
                    <Icon size={16} className="mr-2" />
                    <span className="text-sm">{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Content */}
            <div className="p-6 overflow-y-auto max-h-[60vh]">
              {renderTabContent()}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default SettingsModal; 

