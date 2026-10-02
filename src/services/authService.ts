import { supabase } from './supabase';
import { deleteAccount as apiDeleteAccount } from './api';
import { User } from '../store/useStore';
import { DEFAULT_AVATAR_URL } from '../utils/avatar';
import { storage, STORAGE_KEYS } from '../platform/storage';

/**
 * The signed-in auth user's id + email, kept in sync with the Supabase
 * session. Used by transformUser for the user's own email, because
 * public.users no longer stores emails.
 */
let signedInAuthUser: { id: string; email: string } | null = null;
const rememberAuthUser = (u?: { id: string; email?: string | null } | null) => {
  signedInAuthUser = u?.id ? { id: u.id, email: u.email ?? '' } : null;
};
supabase.auth.getSession().then(({ data }) => rememberAuthUser(data.session?.user));
supabase.auth.onAuthStateChange((_event, session) => rememberAuthUser(session?.user));
/** The signed-in user's email if `id` is them, otherwise '' (other users' emails are private). */
const ownEmailFor = (id: string): string => {
  const me = signedInAuthUser;
  return me && me.id === id ? me.email : '';
};

export interface AuthError {
  message: string;
  status?: number;
}

export interface RegisterData {
  username: string;
  email: string;
  password: string;
  role: 'musician' | 'consumer';
  artistName?: string;
  bio?: string;
  /** 'YYYY-MM-DD'. Required: the database rejects signups without it (COPPA). */
  dateOfBirth: string;
}

export interface LoginData {
  email: string;
  password: string;
}

export class AuthService {
  private static async getCachedProfile(userId: string): Promise<User | null> {
    const cached = await storage.getJSON<User>(STORAGE_KEYS.PROFILE_CACHE);
    return cached?.id === userId ? cached : null;
  }

  private static async setCachedProfile(user: User): Promise<void> {
    await storage.setJSON(STORAGE_KEYS.PROFILE_CACHE, user);
  }

  private static async clearCachedProfile(): Promise<void> {
    await storage.remove(STORAGE_KEYS.PROFILE_CACHE);
  }

  private static normalizeUserRole(role: unknown): 'musician' | 'consumer' {
    const r = typeof role === 'string' ? role.toLowerCase().trim() : '';
    return r === 'musician' ? 'musician' : 'consumer';
  }

  /** Wait for `public.users` row after `signUp` — SIGNED_IN can run before upsert finishes. */
  private static async fetchProfileForSessionUser(userId: string): Promise<User | null> {
    const maxAttempts = 12;
    const delayMs = 120;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.user || session.user.id !== userId) {
        return null;
      }
      const { data: profileData, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .maybeSingle();
      if (!error && profileData) {
        rememberAuthUser(session.user);
        return this.transformUser(profileData, session.user.email_confirmed_at);
      }
      if (error) {
        console.warn(`[AUTH] profile fetch attempt ${attempt + 1}:`, error.message);
      }
      await new Promise((r) => setTimeout(r, delayMs));
    }
    return null;
  }

  static async register(data: RegisterData): Promise<User> {
    try {
      const desiredRole = (data.role ?? 'consumer').toLowerCase() as 'musician' | 'consumer';

      // First, create the user in Supabase Auth with email confirmation disabled
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          emailRedirectTo: "https://re-mixed.net/onboarding",
          data: {
            username: data.username,
            role: desiredRole,
            artist_name: data.artistName,
            bio: data.bio,
            // Checked and stored privately by the enforce_signup_age trigger.
            date_of_birth: data.dateOfBirth,
          }
        }
      });

      if (authError) {
        throw new Error(authError.message);
      }

      if (!authData.user) {
        throw new Error('Failed to create user');
      }

      // Auto-confirm the user (for development/production convenience)
      // In production, you might want to keep email confirmation but make it seamless
      if (authData.user.email_confirmed_at === null) {
        // Email confirmation is disabled for now
      }

      // Then, create the user profile in our users table
      const { data: profileData, error: profileError } = await supabase
        .from('users')
        .upsert({
          id: authData.user.id,
          username: data.username,
          email: data.email,
          role: desiredRole,
          artist_name: data.artistName,
          bio: data.bio,
          avatar: DEFAULT_AVATAR_URL,
          followers: 0,
          following: 0,
        }, { onConflict: 'id' })
        .select()
        .single();

      if (profileError) {
        console.error('[register] users INSERT failed:', profileError.message, profileError.code);
        // Check if it's the row-level security policy error and replace with user-friendly message
        if (profileError.message && profileError.message.includes('new row violates row-level security policy')) {
          throw new Error('The Supabase link has been sent to your email');
        }
        throw new Error(profileError.message);
      }

      // Safety net: if DB triggers/defaults mutate role unexpectedly, force it back.
      if (profileData?.role && profileData.role !== desiredRole) {
        console.warn('[register] role mismatch after upsert; correcting', { desiredRole, got: profileData.role });
        const { data: corrected, error: correctedErr } = await supabase
          .from('users')
          .update({ role: desiredRole })
          .eq('id', authData.user.id)
          .select()
          .single();
        if (!correctedErr && corrected) {
          rememberAuthUser(authData.user);
          const correctedUser = this.transformUser(corrected, authData.user.email_confirmed_at);
          await this.setCachedProfile(correctedUser);
          return correctedUser;
        }
      }

      rememberAuthUser(authData.user);
      const newUser = this.transformUser(profileData, authData.user.email_confirmed_at);
      // Pre-cache so the onAuthStateChange background fetch (which races the INSERT)
      // finds the profile immediately rather than getting null and clearing auth state.
      await this.setCachedProfile(newUser);
      return newUser;
    } catch (error) {
      // Also check for the RLS error in the general catch block
      if (error instanceof Error && error.message.includes('new row violates row-level security policy')) {
        throw new Error('The Supabase link has been sent to your email');
      }
      throw new Error(error instanceof Error ? error.message : 'Registration failed');
    }
  }

  static async login(data: LoginData): Promise<User> {
    try {
      const { data: authData, error } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: data.password,
      });

      if (error) {
        throw new Error(error.message);
      }

      if (!authData.user) {
        throw new Error('Login failed');
      }

      // Get user profile
      const { data: profileData, error: profileError } = await supabase
        .from('users')
        .select('*')
        .eq('id', authData.user.id)
        .maybeSingle();

      if (profileError) {
        throw new Error(profileError.message);
      }

      if (profileData) {
        rememberAuthUser(authData.user);
        return this.transformUser(profileData, authData.user.email_confirmed_at);
      }

      // If profile not found, create one
      const username = authData.user.email?.split('@')[0] || 'new_user';
      const metaRoleRaw =
        (authData.user.user_metadata as { role?: unknown } | undefined)?.role ??
        (authData.user.app_metadata as { role?: unknown } | undefined)?.role;
      const desiredRole: 'musician' | 'consumer' =
        metaRoleRaw === 'musician' || metaRoleRaw === 'consumer'
          ? metaRoleRaw
          : 'consumer';

      const { data: newProfileData, error: newProfileError } = await supabase
        .from('users')
        .insert({
          id: authData.user.id,
          username: username,
          email: authData.user.email ?? 'unknown@example.com',
          role: desiredRole,
          avatar: DEFAULT_AVATAR_URL,
          followers: 0,
          following: 0,
        })
        .select()
        .single();

      if (newProfileError) {
        throw new Error(newProfileError.message);
      }
      
      if (!newProfileData) {
        throw new Error('User profile not found. Please contact support.');
      }

      rememberAuthUser(authData.user);
      return this.transformUser(newProfileData, authData.user.email_confirmed_at);
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : 'Login failed');
    }
  }

  /**
   * Sign out locally and (when a session exists) revoke the refresh token on the server.
   * The UI can still show a cached profile while Supabase has no session (see INITIAL_SESSION
   * handler); in that case a global signOut returns 403 / "Auth session missing!" — we always
   * fall back to a local sign-out so the user can actually log out.
   */
  static async logout(): Promise<void> {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session) {
        const { error } = await supabase.auth.signOut();
        if (error) {
          const msg = error.message ?? '';
          const benign =
            /session missing|not authenticated|session_not_found/i.test(msg) ||
            (error as { status?: number }).status === 403;
          if (!benign) {
            console.warn('[auth] signOut:', msg);
          }
        }
      }
    } catch (e) {
      console.warn('[auth] logout:', e);
    } finally {
      try {
        await supabase.auth.signOut({ scope: 'local' });
      } catch {
        /* ignore */
      }
      await this.clearCachedProfile();
    }
  }

  static async getCurrentUser(): Promise<User | null> {
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error || !session?.user) {
        return null;
      }

      const { data: profileData, error: profileError } = await supabase
        .from('users')
        .select('*')
        .eq('id', session.user.id)
        .maybeSingle();

      if (profileError || !profileData) {
        console.error('Error getting user profile:', profileError);
        return null;
      }

      rememberAuthUser(session.user);
      const user = this.transformUser(profileData, session.user.email_confirmed_at);
      await this.setCachedProfile(user);
      return user;
    } catch (error) {
      console.error('Error getting current user:', error);
      return null;
    }
  }

  static async updateProfile(updates: Partial<User>): Promise<User> {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.id) throw new Error('Not authenticated');

      const updateData: any = {};

      if (updates.username) updateData.username = updates.username;
      if (updates.avatar) updateData.avatar = updates.avatar;
      if (updates.bio) updateData.bio = updates.bio;
      if (updates.artistName) updateData.artist_name = updates.artistName;
      if (updates.genres) updateData.genres = updates.genres;
      if (updates.role) updateData.role = updates.role;
      if (updates.externalLinks !== undefined) updateData.external_links = updates.externalLinks;
      if (updates.bannerUrl !== undefined) updateData.banner_url = updates.bannerUrl;
      if (updates.vanityUrl !== undefined) updateData.vanity_url = updates.vanityUrl || null;

      updateData.updated_at = new Date().toISOString();

      const { data, error } = await supabase
        .from('users')
        .update(updateData)
        .eq('id', session.user.id)
        .select()
        .single();

      if (error) {
        throw new Error(error.message);
      }

      rememberAuthUser(session.user);
      return this.transformUser(data);
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : 'Profile update failed');
    }
  }

  static async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) throw new Error('No authenticated user');

      const { error: verifyError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: currentPassword,
      });
      if (verifyError) throw new Error('Current password is incorrect');

      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw new Error(error.message);
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : 'Password change failed');
    }
  }

  /**
   * Change the login email (auth.users). Supabase emails a confirmation link;
   * the change only takes effect once it's clicked.
   */
  static async changeEmail(newEmail: string, currentPassword: string): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.email) throw new Error('No authenticated user');

    const { error: verifyError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: currentPassword,
    });
    if (verifyError) throw new Error('Current password is incorrect');

    const { error } = await supabase.auth.updateUser(
      { email: newEmail.trim() },
      { emailRedirectTo: `${window.location.origin}/` },
    );
    if (error) throw new Error(error.message);
  }

  static async togglePrivateAccount(isPrivate: boolean): Promise<User> {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.id) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('users')
        .update({ is_private: isPrivate })
        .eq('id', session.user.id)
        .select()
        .single();

      if (error) throw new Error(error.message);

      rememberAuthUser(session.user);
      return this.transformUser(data);
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : 'Failed to update privacy settings');
    }
  }

  /** Send password reset email. Link in email redirects to app /reset-password with recovery token in hash. */
  static async resetPassword(email: string): Promise<void> {
    try {
      const redirectTo = `${typeof window !== 'undefined' ? window.location.origin : ''}/reset-password`;
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo
      });

      if (error) {
        throw new Error(error.message);
      }
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : 'Password reset failed');
    }
  }

  /** Set new password when user has followed the reset-password email link (recovery session). */
  static async setNewPassword(newPassword: string): Promise<void> {
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (error) {
        throw new Error(error.message);
      }
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : 'Failed to set new password');
    }
  }

  static async searchUsersByUsername(username: string): Promise<User[]> {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .ilike('username', `%${username}%`);
      if (error) throw new Error(error.message);
      return (data || []).map((u) => this.transformUser(u));
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : 'User search failed');
    }
  }

  static async deleteAccount(userId: string): Promise<void> {
    try {
      await apiDeleteAccount(userId);
    } catch (error) {
      console.error('Delete account error:', error);
      throw new Error(error instanceof Error ? error.message : 'Failed to delete account');
    }
  }

  static onAuthStateChange(callback: (user: User | null) => void) {
    return supabase.auth.onAuthStateChange(async (event, session) => {
      const shouldFetchProfile =
        (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') &&
        session?.user;

      if (shouldFetchProfile) {
        // 1. Show cached profile instantly so the UI is never blocked
        const cached = await this.getCachedProfile(session.user.id);
        if (cached) callback(cached);

        // 2. Use setTimeout(0) to break the "Supabase Deadlock"
        // This lets the Auth listener finish its execution before starting the DB fetch
        setTimeout(async () => {
          try {
            const freshUser = await this.fetchProfileForSessionUser(session.user.id);

            if (!freshUser) {
              console.warn('[AUTH] No profile after retries for:', session.user.id);
              if (!cached) callback(null);
              return;
            }

            await this.setCachedProfile(freshUser);

            if (!cached || JSON.stringify(freshUser) !== JSON.stringify(cached)) {
              callback(freshUser);
            }
          } catch (error) {
            console.error('Background profile fetch threw error:', error);
            if (!cached) callback(null);
          }
        }, 0);

        return;
      }

      if (event === 'SIGNED_OUT') {
        await this.clearCachedProfile();
        callback(null);
        return;
      }

      if (event === 'INITIAL_SESSION' && !session) {
        // Don't nuke the cache here — Supabase may fire INITIAL_SESSION before it has
        // finished hydrating the session from storage (cold-boot race condition).
        // Only clear on an explicit SIGNED_OUT above.
        const cached = await storage.getJSON<User>(STORAGE_KEYS.PROFILE_CACHE);
        if (cached?.id) {
          callback(cached);
          return;
        }
        callback(null);
        return;
      }

      if (event === 'TOKEN_REFRESH_FAILED') {
        this.clearCachedProfile();
        await supabase.auth.signOut({ scope: 'local' });
        callback(null);
      }
    });
  }

  static transformUser(dbUser: any, emailConfirmedAt?: string | null): User {
    return {
      id: dbUser.id,
      username: dbUser.username,
      // public.users no longer stores emails (privacy); the signed-in user's own
      // email comes from their auth session. Other users' emails stay private.
      email: dbUser.email ?? ownEmailFor(dbUser.id),
      avatar: dbUser.avatar,
      followers: dbUser.followers,
      following: dbUser.following,
      role: this.normalizeUserRole(dbUser.role),
      isVerified: dbUser.is_verified,
      isPrivate: dbUser.is_private,
      isAdmin: dbUser.is_admin ?? false,
      isVerifiedArtist: dbUser.is_verified_artist ?? false,
      artistName: dbUser.artist_name,
      bio: dbUser.bio,
      genres: dbUser.genres,
      externalLinks: dbUser.external_links ?? [],
      subscriptionTier: dbUser.subscription_tier ?? 'free',
      stripeCustomerId: dbUser.stripe_customer_id ?? undefined,
      bannerUrl: dbUser.banner_url ?? undefined,
      vanityUrl: dbUser.vanity_url ?? undefined,
      emailConfirmed: !!emailConfirmedAt,
    };
  }

  static async resendEmailConfirmation(email: string): Promise<void> {
    const { error } = await supabase.auth.resend({ type: 'signup', email });
    if (error) throw new Error(error.message);
  }
} 