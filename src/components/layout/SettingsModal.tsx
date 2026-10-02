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
  Camera,
  KeyRound,
  Smartphone,
  Trash2,
  Sparkles,
  CreditCard,
} from 'lucide-react';
import { BrutalButton, BrutalToggle, Sticker, brutalInput, hardShadow } from '../ui/brutal';
import { useStore } from '../../store/useStore';
import { applyTheme, themeConfigs } from '../../data/themeConfig';
import { AuthService } from '../../services/authService';
import { DEFAULT_AVATAR_URL, getAvatarUrl } from '../../utils/avatar';
import { proSubscriptionService, ProSubscription } from '../../services/proSubscriptionService';
import { PRICING } from '../../config/pricing';
import { supabase } from '../../services/supabase';

interface SettingsModalProps {
  isOpen: boolean;
  initialTab?: 'account' | 'security' | 'appearance' | 'pro';
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

// ─── Layout helpers ───────────────────────────────────────────────────────────

const Section: React.FC<{
  icon: React.ComponentType<{ size?: number; className?: string }>;
  title: string;
  description?: React.ReactNode;
  tone?: 'default' | 'danger';
  aside?: React.ReactNode;
  children?: React.ReactNode;
}> = ({ icon: Icon, title, description, tone = 'default', aside, children }) => (
  <section
    className={`border-2 border-black rounded-2xl p-5 ${tone === 'danger' ? 'bg-red-50' : 'bg-white'}`}
    style={hardShadow(4)}
  >
    <div className="flex items-start gap-3">
      <span
        className={`flex-shrink-0 w-9 h-9 rounded-lg border-2 border-black flex items-center justify-center ${
          tone === 'danger' ? 'bg-red-300' : 'bg-teal-300'
        }`}
      >
        <Icon size={18} className="text-black" />
      </span>
      <div className="flex-1 min-w-0">
        <h3 className="text-base font-bold text-black leading-tight">{title}</h3>
        {description && <p className="text-sm text-black/60 mt-0.5">{description}</p>}
      </div>
      {aside}
    </div>
    {children && <div className="mt-4">{children}</div>}
  </section>
);

const FieldLabel: React.FC<{ htmlFor?: string; children: React.ReactNode }> = ({ htmlFor, children }) => (
  <label htmlFor={htmlFor} className="block text-xs font-bold uppercase tracking-wide text-black/70 mb-1.5">
    {children}
  </label>
);

/** Row of pill buttons where one is selected. */
function ChoiceChips<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: { value: T; label: string; dot?: string; icon?: React.ReactNode }[];
  value: T;
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl border-2 border-black text-sm font-bold transition-all ${
              active ? 'bg-black text-white shadow-none translate-x-[2px] translate-y-[2px]' : 'bg-white text-black shadow-[2px_2px_0_0_#000] hover:bg-teal-50'
            }`}
          >
            {o.dot && <span className={`w-2.5 h-2.5 rounded-full border border-black ${o.dot}`} aria-hidden />}
            {o.icon}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

const PasswordInput: React.FC<{
  id: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  visible: boolean;
  onToggleVisible: () => void;
}> = ({ id, value, onChange, placeholder, visible, onToggleVisible }) => (
  <div className="relative">
    <input
      id={id}
      type={visible ? 'text' : 'password'}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`${brutalInput} pr-11`}
      placeholder={placeholder}
      required
    />
    <button
      type="button"
      onClick={onToggleVisible}
      className="absolute right-3 top-1/2 -translate-y-1/2 text-black/50 hover:text-black"
      aria-label={visible ? 'Hide password' : 'Show password'}
    >
      {visible ? <EyeOff size={16} /> : <Eye size={16} />}
    </button>
  </div>
);

const Spinner: React.FC<{ light?: boolean }> = ({ light }) => (
  <span className={`w-4 h-4 border-2 ${light ? 'border-white' : 'border-black'} border-t-transparent rounded-full animate-spin`} />
);

// ─── Modal ────────────────────────────────────────────────────────────────────

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, initialTab }) => {
  const { user, setSettingsOpen, theme, setTheme, setUserAvatar, updateProfile, changePassword, togglePrivateAccount, logout, userStatus, setUserStatus, refreshUser } = useStore();
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<'account' | 'security' | 'appearance' | 'pro'>(initialTab || 'account');
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

  // 2FA state
  const [mfaEnabled, setMfaEnabled] = useState(false);
  const [mfaFactorId, setMfaFactorId] = useState<string | null>(null);
  const [mfaLoading, setMfaLoading] = useState(false);
  const [mfaStep, setMfaStep] = useState<'idle' | 'setup'>('idle');
  const [mfaQRCode, setMfaQRCode] = useState<string | null>(null);
  const [mfaSecret, setMfaSecret] = useState<string | null>(null);
  const [mfaEnrollId, setMfaEnrollId] = useState<string | null>(null);
  const [mfaCode, setMfaCode] = useState('');
  const [mfaError, setMfaError] = useState<string | null>(null);

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
          if (storeUser && storeUser.subscriptionTier !== 'artist') {
            useStore.setState({ user: { ...storeUser, subscriptionTier: 'artist' } });
          }
        }
      })
      .finally(() => setProSubLoading(false));
  }, [isOpen, user?.id, activeTab]);

  useEffect(() => {
    if (user?.email) setResetPasswordEmail(user.email);
  }, [user?.email]);

  useEffect(() => {
    if (!isOpen || activeTab !== 'security') return;
    supabase.auth.mfa.listFactors().then(({ data }) => {
      const verified = data?.totp?.find((f: { status: string }) => f.status === 'verified');
      if (verified) {
        setMfaEnabled(true);
        setMfaFactorId(verified.id);
      } else {
        setMfaEnabled(false);
        setMfaFactorId(null);
      }
    });
  }, [isOpen, activeTab]);

  const handleEnableMFA = async () => {
    setMfaLoading(true);
    setMfaError(null);
    try {
      const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp' });
      if (error) throw error;
      setMfaQRCode(data.totp.qr_code);
      setMfaSecret(data.totp.secret);
      setMfaEnrollId(data.id);
      setMfaStep('setup');
    } catch {
      setMfaError('Failed to start 2FA setup. Please try again.');
    } finally {
      setMfaLoading(false);
    }
  };

  const handleVerifyMFA = async () => {
    if (!mfaEnrollId || mfaCode.length !== 6) return;
    setMfaLoading(true);
    setMfaError(null);
    try {
      const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: mfaEnrollId, code: mfaCode });
      if (error) throw error;
      setMfaEnabled(true);
      setMfaFactorId(mfaEnrollId);
      setMfaStep('idle');
      setMfaQRCode(null);
      setMfaSecret(null);
      setMfaCode('');
    } catch {
      setMfaError('Invalid code. Please try again.');
    } finally {
      setMfaLoading(false);
    }
  };

  const handleDisableMFA = async () => {
    if (!mfaFactorId) return;
    setMfaLoading(true);
    setMfaError(null);
    try {
      const { error } = await supabase.auth.mfa.unenroll({ factorId: mfaFactorId });
      if (error) throw error;
      setMfaEnabled(false);
      setMfaFactorId(null);
    } catch {
      setMfaError('Failed to disable 2FA. Please try again.');
    } finally {
      setMfaLoading(false);
    }
  };

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
      await AuthService.changeEmail(emailForm.newEmail, emailForm.password);
      setSuccessMessage(`Check ${emailForm.newEmail} for a confirmation link — your email changes once you click it.`);
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
      const updated = await togglePrivateAccount(!user.isPrivate);
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
    <div className="space-y-5">
      <Section icon={User} title="Profile" description="How you appear across Re-Mixed.">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-5">
          <img
            src={getAvatarUrl(avatarPreview ?? user?.avatar)}
            alt="Profile picture"
            className="w-20 h-20 rounded-2xl object-cover border-2 border-black bg-white"
            style={hardShadow(3)}
          />
          <div className="flex flex-wrap items-center gap-2">
            <label
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border-2 border-black bg-white text-xs font-bold cursor-pointer shadow-[2px_2px_0_0_#000] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all"
            >
              <Camera size={14} />
              Change photo
              <input type="file" accept="image/*" onChange={handleAvatarChange} className="sr-only" />
            </label>
            {avatarFile && (
              <BrutalButton size="sm" tone="teal" onClick={handleAvatarSave}>
                <Save size={14} /> Save photo
              </BrutalButton>
            )}
            <button
              type="button"
              onClick={handleRemoveAvatar}
              className="px-2 py-1.5 text-xs font-bold text-red-600 hover:underline"
            >
              Remove
            </button>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <FieldLabel htmlFor="settings-username">Username</FieldLabel>
            <input id="settings-username" type="text" value={user?.username || ''} disabled className={brutalInput} />
            <p className="text-xs text-black/50 mt-1">Usernames can't be changed.</p>
          </div>
          <div>
            <FieldLabel htmlFor="settings-email">Email</FieldLabel>
            <input id="settings-email" type="email" value={user?.email || ''} disabled className={brutalInput} />
          </div>
        </div>
      </Section>

      <Section icon={Circle} title="Status" description="How you appear to others in chat and across the app.">
        <ChoiceChips
          label="Status"
          value={userStatus}
          onChange={(s) => setUserStatus(s)}
          options={[
            { value: 'online', label: 'Online', dot: 'bg-green-500' },
            { value: 'idle', label: 'Idle', icon: <Moon size={14} /> },
            { value: 'invisible', label: 'Offline', icon: <InvisibleIcon size={14} /> },
          ]}
        />
      </Section>

      <Section
        icon={Shield}
        title="Private account"
        description="Only approved followers can see your profile and uploads."
        aside={
          <div className="flex items-center gap-2">
            {privacyLoading && <Spinner />}
            <BrutalToggle
              label="Private account"
              checked={Boolean(user?.isPrivate)}
              onChange={() => handlePrivacyToggle()}
              disabled={privacyLoading}
            />
          </div>
        }
      />

      <Section icon={Globe} title={t('settings.language.title')} description={t('settings.language.subtitle')}>
        <ChoiceChips
          label={t('settings.language.title')}
          value={(['en', 'ko', 'ja'].includes(i18n.language) ? i18n.language : 'en') as 'en' | 'ko' | 'ja'}
          onChange={(lang) => i18n.changeLanguage(lang)}
          options={(['en', 'ko', 'ja'] as const).map((lang) => ({ value: lang, label: t(`settings.language.${lang}`) }))}
        />
      </Section>

      <Section icon={Mail} title="Change email">
        <form onSubmit={handleEmailSubmit} className="space-y-4">
          <div>
            <FieldLabel htmlFor="settings-new-email">New email</FieldLabel>
            <input
              id="settings-new-email"
              type="email"
              value={emailForm.newEmail}
              onChange={(e) => handleEmailChange('newEmail', e.target.value)}
              className={brutalInput}
              placeholder="you@example.com"
              required
            />
          </div>
          <div>
            <FieldLabel htmlFor="settings-email-password">Current password</FieldLabel>
            <input
              id="settings-email-password"
              type="password"
              value={emailForm.password}
              onChange={(e) => handleEmailChange('password', e.target.value)}
              className={brutalInput}
              placeholder="Enter current password"
              required
            />
          </div>
          <BrutalButton type="submit" disabled={isLoading}>
            {isLoading ? <><Spinner light /> Updating…</> : <><Save size={16} /> Update email</>}
          </BrutalButton>
        </form>
      </Section>

      <Section
        icon={Trash2}
        tone="danger"
        title="Delete account"
        description="Permanently delete your account and all your data. This can't be undone."
      >
        {!showDeleteConfirm ? (
          <BrutalButton tone="danger" onClick={() => setShowDeleteConfirm(true)} disabled={deleteLoading}>
            <Trash2 size={16} /> Delete account
          </BrutalButton>
        ) : (
          <div className="p-4 rounded-xl border-2 border-black bg-white space-y-3">
            <p className="text-sm font-bold text-black">Are you sure? Your profile, tracks and messages will be deleted for good.</p>
            <div className="flex flex-wrap gap-2">
              <BrutalButton tone="danger" onClick={handleDeleteAccount} disabled={deleteLoading}>
                {deleteLoading ? <><Spinner /> Deleting…</> : 'Yes, delete my account'}
              </BrutalButton>
              <BrutalButton tone="white" onClick={() => setShowDeleteConfirm(false)} disabled={deleteLoading}>
                Cancel
              </BrutalButton>
            </div>
          </div>
        )}
      </Section>
    </div>
  );

  const renderSecurityTab = () => (
    <div className="space-y-5">
      <Section icon={Lock} title="Change password">
        <form onSubmit={handlePasswordSubmit} className="space-y-4">
          <div>
            <FieldLabel htmlFor="settings-current-password">Current password</FieldLabel>
            <PasswordInput
              id="settings-current-password"
              value={passwordForm.currentPassword}
              onChange={(v) => handlePasswordChange('currentPassword', v)}
              placeholder="Enter current password"
              visible={showCurrentPassword}
              onToggleVisible={() => setShowCurrentPassword(!showCurrentPassword)}
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <FieldLabel htmlFor="settings-new-password">New password</FieldLabel>
              <PasswordInput
                id="settings-new-password"
                value={passwordForm.newPassword}
                onChange={(v) => handlePasswordChange('newPassword', v)}
                placeholder="New password"
                visible={showNewPassword}
                onToggleVisible={() => setShowNewPassword(!showNewPassword)}
              />
            </div>
            <div>
              <FieldLabel htmlFor="settings-confirm-password">Confirm new password</FieldLabel>
              <PasswordInput
                id="settings-confirm-password"
                value={passwordForm.confirmPassword}
                onChange={(v) => handlePasswordChange('confirmPassword', v)}
                placeholder="Repeat new password"
                visible={showConfirmPassword}
                onToggleVisible={() => setShowConfirmPassword(!showConfirmPassword)}
              />
            </div>
          </div>
          <BrutalButton type="submit" disabled={isLoading}>
            {isLoading ? <><Spinner light /> Updating…</> : <><Save size={16} /> Update password</>}
          </BrutalButton>
        </form>
      </Section>

      <Section
        icon={KeyRound}
        title="Forgot your password?"
        description="We'll email you a link to reset it."
      >
        {resetPasswordSent ? (
          <div className="flex items-start gap-2 p-3 rounded-xl border-2 border-black bg-green-200 text-sm text-black">
            <Check size={16} className="mt-0.5 flex-shrink-0" />
            <span>Check your email for a reset link. It expires after a short time.</span>
          </div>
        ) : (
          <form onSubmit={handleForgotPasswordSubmit} className="flex flex-col sm:flex-row gap-3 sm:items-end">
            <div className="flex-1">
              <FieldLabel htmlFor="settings-reset-email">Email address</FieldLabel>
              <input
                id="settings-reset-email"
                type="email"
                value={resetPasswordEmail}
                onChange={(e) => setResetPasswordEmail(e.target.value)}
                className={brutalInput}
                placeholder="Enter your email"
                disabled={resetPasswordLoading}
              />
            </div>
            <BrutalButton type="submit" tone="white" disabled={resetPasswordLoading}>
              {resetPasswordLoading ? <><Spinner /> Sending…</> : <><Mail size={16} /> Send link</>}
            </BrutalButton>
          </form>
        )}
        {resetPasswordError && <p className="mt-2 text-sm font-semibold text-red-600">{resetPasswordError}</p>}
      </Section>

      <Section
        icon={Smartphone}
        title="Two-factor authentication"
        description="Use an authenticator app (Google Authenticator, Authy) as a second step when you sign in."
        aside={mfaEnabled && mfaStep === 'idle' ? <Sticker rotate={3} className="!bg-green-300">On</Sticker> : undefined}
      >
        {mfaStep === 'idle' && (
          mfaEnabled ? (
            <BrutalButton tone="danger" onClick={handleDisableMFA} disabled={mfaLoading}>
              {mfaLoading ? <><Spinner /> Turning off…</> : 'Turn off 2FA'}
            </BrutalButton>
          ) : (
            <BrutalButton tone="teal" onClick={handleEnableMFA} disabled={mfaLoading}>
              {mfaLoading ? <><Spinner /> Setting up…</> : <><Shield size={16} /> Turn on 2FA</>}
            </BrutalButton>
          )
        )}

        {mfaStep === 'setup' && mfaQRCode && (
          <div className="flex flex-col sm:flex-row gap-5">
            <img
              src={mfaQRCode}
              alt="2FA QR code"
              className="w-40 h-40 rounded-xl border-2 border-black bg-white p-2 flex-shrink-0"
              style={hardShadow(3)}
            />
            <div className="space-y-3 flex-1">
              <p className="text-sm text-black">1. Scan this QR code with your authenticator app.</p>
              {mfaSecret && (
                <p className="text-xs text-black/60">
                  Can't scan? Enter this code: <span className="font-mono font-bold text-black select-all break-all">{mfaSecret}</span>
                </p>
              )}
              <div>
                <FieldLabel htmlFor="settings-mfa-code">2. Enter the 6-digit code</FieldLabel>
                <div className="flex flex-wrap gap-2">
                  <input
                    id="settings-mfa-code"
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={mfaCode}
                    onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="000000"
                    className={`${brutalInput} !w-36 text-center font-mono text-lg tracking-[0.3em]`}
                  />
                  <BrutalButton onClick={handleVerifyMFA} disabled={mfaLoading || mfaCode.length !== 6}>
                    {mfaLoading ? <><Spinner light /> Verifying…</> : 'Verify & turn on'}
                  </BrutalButton>
                  <BrutalButton
                    tone="white"
                    onClick={() => { setMfaStep('idle'); setMfaQRCode(null); setMfaCode(''); setMfaError(null); }}
                  >
                    Cancel
                  </BrutalButton>
                </div>
              </div>
            </div>
          </div>
        )}

        {mfaError && <p className="mt-3 text-sm font-semibold text-red-600">{mfaError}</p>}
      </Section>

      <Section icon={LogOut} title="Log out" description="Sign out of Re-Mixed on this device.">
        <BrutalButton tone="white" onClick={handleLogout}>
          <LogOut size={16} /> Log out
        </BrutalButton>
      </Section>
    </div>
  );

  const renderProTab = () => {
    // Use the DB subscription record as ground truth — the store's subscriptionTier
    // can be stale if the webhook hasn't updated it yet.
    const isPro =
      user?.subscriptionTier === 'artist' ||
      Boolean(proSubscription && (proSubscription.status === 'active' || proSubscription.status === 'past_due'));
    const isComplimentaryAdmin = Boolean((user as { isAdmin?: boolean })?.isAdmin && !proSubscription);

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
        <div className="flex items-center justify-center py-16 gap-2 text-black/60 text-sm">
          <Spinner /> Loading subscription…
        </div>
      );
    }

    return (
      <div className="space-y-5">
        {/* Current plan */}
        <div
          className={`relative rounded-2xl border-2 border-black p-5 ${isPro ? 'bg-teal-300' : 'bg-white'}`}
          style={hardShadow(5)}
        >
          {isPro && (
            <Sticker rotate={6} className="absolute -top-3 right-5">
              <Sparkles size={12} /> {proSubscription?.status === 'past_due' ? 'Payment due' : 'Active'}
            </Sticker>
          )}
          <p className="text-xs font-bold uppercase tracking-widest text-black/70">Your plan</p>
          <p className="font-kotra text-3xl text-black mt-1">{isPro ? 'Re-Mixed Pro' : 'Free'}</p>
          {isPro && proSubscription && (
            <p className="text-sm text-black/80 mt-1 capitalize">
              {proSubscription.plan} plan · {proSubscription.cancelAtPeriodEnd ? 'ends' : 'renews'}{' '}
              {new Date(proSubscription.currentPeriodEnd).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
            </p>
          )}
          {!isPro && <p className="text-sm text-black/60 mt-1">Up to 10 tracks · 2 albums · core features</p>}
        </div>

        {isPro && proSubscription?.cancelAtPeriodEnd && (
          <div className="flex items-start gap-3 p-4 rounded-xl border-2 border-black bg-yellow-200">
            <Star size={16} className="flex-shrink-0 mt-0.5" />
            <p className="text-sm text-black">
              Your Pro access ends on{' '}
              <strong>
                {new Date(proSubscription.currentPeriodEnd).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}
              </strong>
              . You won't be charged again. Resubscribe any time to keep Pro.
            </p>
          </div>
        )}

        {isPro && (
          <Section
            icon={CreditCard}
            title="Billing"
            description={
              isComplimentaryAdmin
                ? 'Admin account — Pro access is permanent and needs no billing.'
                : 'Update your payment method, download invoices, or cancel in the Stripe billing portal.'
            }
          >
            {!isComplimentaryAdmin && (
              <>
                <BrutalButton tone="white" onClick={handleOpenPortal} disabled={portalLoading}>
                  {portalLoading ? <><Spinner /> Opening portal…</> : <>Open billing portal <span aria-hidden>↗</span></>}
                </BrutalButton>
                {portalError && (
                  <div className="mt-3 space-y-1">
                    <p className="text-sm font-semibold text-red-600">{portalError}</p>
                    <p className="text-xs text-black/60">
                      If the portal won't open, email remix.official0714@gmail.com from the address on your account.
                    </p>
                  </div>
                )}
              </>
            )}
          </Section>
        )}

        {!isPro && (
          <div className="rounded-2xl border-2 border-black bg-white p-5 space-y-4" style={hardShadow(4)}>
            <div>
              <p className="text-base font-bold text-black">Unlock Re-Mixed Pro</p>
              <p className="text-sm text-black/60">Unlimited uploads, priority in Discover, analytics, an enhanced profile and more.</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border-2 border-black bg-white px-3 py-3 text-center">
                <p className="font-kotra text-2xl text-black">{PRICING.monthly.display}</p>
                <p className="text-xs text-black/60">per month</p>
              </div>
              <div className="relative rounded-xl border-2 border-black bg-teal-300 px-3 py-3 text-center">
                <Sticker rotate={5} className="absolute -top-3 left-1/2 -translate-x-1/2 !text-[10px] !px-2 !py-0.5 whitespace-nowrap">
                  2 months free
                </Sticker>
                <p className="font-kotra text-2xl text-black">{PRICING.yearly.display}</p>
                <p className="text-xs text-black/70">per month, billed yearly</p>
              </div>
            </div>
            <BrutalButton className="w-full" onClick={() => { setSettingsOpen(false); navigate('/upgrade'); }}>
              <Sparkles size={16} /> See plans & upgrade
            </BrutalButton>
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
      case 'pro':
        return renderProTab();
      default:
        return renderAccountTab();
    }
  };

  const activeTabLabel = tabs.find((tb) => tb.id === activeTab)?.label ?? '';

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 bg-black/60 backdrop-blur-[2px] z-50 flex items-center justify-center p-3 sm:p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={(e) => { if (e.target === e.currentTarget) setSettingsOpen(false); }}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={t('settings.title')}
            initial={{ opacity: 0, y: 24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 320, damping: 28 }}
            className="relative w-full max-w-3xl max-h-[92vh] md:h-[min(720px,88vh)] flex flex-col overflow-hidden rounded-2xl border-2 border-black bg-[#faf6ec]"
            style={hardShadow(8)}
          >
            {/* Header */}
            <div className="flex items-center gap-3 px-5 py-4 border-b-2 border-black bg-white">
              <img
                src={getAvatarUrl(user?.avatar)}
                alt=""
                className="w-10 h-10 rounded-xl object-cover border-2 border-black"
              />
              <div className="flex-1 min-w-0">
                <p className="font-kotra text-2xl text-black leading-none">{t('settings.title')}</p>
                {user?.username && <p className="text-xs text-black/60 truncate mt-1">@{user.username}</p>}
              </div>
              <button
                type="button"
                onClick={() => setSettingsOpen(false)}
                className="p-2 rounded-xl border-2 border-black bg-white shadow-[2px_2px_0_0_#000] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all"
                aria-label="Close settings"
              >
                <X size={18} className="text-black" />
              </button>
            </div>

            <div className="flex flex-col md:flex-row flex-1 min-h-0">
              {/* Tabs — sidebar on desktop, scrollable row on phones */}
              <nav
                aria-label="Settings sections"
                className="flex md:flex-col gap-2 p-3 md:p-4 md:w-52 flex-shrink-0 overflow-x-auto border-b-2 md:border-b-0 md:border-r-2 border-black bg-white/60"
              >
                {tabs.map((tab) => {
                  const Icon = tab.icon;
                  const active = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActiveTab(tab.id as typeof activeTab)}
                      aria-current={active ? 'page' : undefined}
                      className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border-2 text-sm font-bold whitespace-nowrap transition-all ${
                        active
                          ? 'bg-black text-white border-black'
                          : 'bg-transparent text-black border-transparent hover:border-black hover:bg-white'
                      }`}
                    >
                      <Icon size={16} />
                      {tab.label}
                      {tab.id === 'pro' && user?.subscriptionTier === 'artist' && (
                        <span className={`ml-auto text-[10px] px-1.5 py-0.5 rounded border ${active ? 'border-white/60' : 'border-black bg-teal-300'}`}>
                          PRO
                        </span>
                      )}
                    </button>
                  );
                })}
              </nav>

              {/* Content */}
              <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6">
                <h2 className="sr-only">{activeTabLabel}</h2>

                <AnimatePresence>
                  {successMessage && (
                    <motion.div
                      initial={{ opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      role="status"
                      className="mb-5 flex items-center gap-2 p-3 rounded-xl border-2 border-black bg-green-300 text-sm font-bold text-black"
                      style={hardShadow(3)}
                    >
                      <Check size={16} /> {successMessage}
                    </motion.div>
                  )}
                  {errorMessage && (
                    <motion.div
                      initial={{ opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      role="alert"
                      className="mb-5 flex items-center gap-2 p-3 rounded-xl border-2 border-black bg-red-300 text-sm font-bold text-black"
                      style={hardShadow(3)}
                    >
                      <X size={16} /> {errorMessage}
                    </motion.div>
                  )}
                </AnimatePresence>

                <motion.div
                  key={activeTab}
                  initial={{ opacity: 0, x: 8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.15 }}
                >
                  {renderTabContent()}
                </motion.div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default SettingsModal;
