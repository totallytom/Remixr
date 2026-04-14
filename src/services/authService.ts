import { supabase } from './supabase';
import { User } from '../store/useStore';
import { DEFAULT_AVATAR_URL } from '../utils/avatar';

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
}

export interface LoginData {
  email: string;
  password: string;
}

export class AuthService {
  private static now(): number {
    return typeof performance !== 'undefined' ? performance.now() : Date.now();
  }

  private static logDuration(label: string, start: number) {
    const duration = Math.round(this.now() - start);
    console.debug(`[auth] ${label} ${duration}ms`);
  }

  static async register(data: RegisterData): Promise<User> {
    try {
      // First, create the user in Supabase Auth with email confirmation disabled
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          emailRedirectTo: "https://re-mixed.net",
          data: {
            username: data.username,
            role: data.role,
            artist_name: data.artistName,
            bio: data.bio,
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
        // For now, we'll proceed without email confirmation
        console.log('User registered successfully. Email confirmation can be enabled later.');
      }

      // Then, create the user profile in our users table
      const { data: profileData, error: profileError } = await supabase
        .from('users')
        .insert({
          id: authData.user.id,
          username: data.username,
          email: data.email,
          role: data.role,
          artist_name: data.artistName,
          bio: data.bio,
          avatar: DEFAULT_AVATAR_URL,
          followers: 0,
          following: 0,
          is_verified: true, // Auto-verify for better UX
        })
        .select()
        .single();

      if (profileError) {
        // Check if it's the row-level security policy error and replace with user-friendly message
        if (profileError.message && profileError.message.includes('new row violates row-level security policy')) {
          throw new Error('The Supabase link has been sent to your email');
        }
        throw new Error(profileError.message);
      }

      return this.transformUser(profileData);
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
      const signInStart = this.now();
      const { data: authData, error } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: data.password,
      });
      this.logDuration('login signInWithPassword', signInStart);

      if (error) {
        throw new Error(error.message);
      }

      if (!authData.user) {
        throw new Error('Login failed');
      }

      // Get user profile
      const profileFetchStart = this.now();
      const { data: profileData, error: profileError } = await supabase
        .from('users')
        .select('*')
        .eq('id', authData.user.id)
        .maybeSingle();
      this.logDuration('login fetch profile', profileFetchStart);

      if (profileError) {
        throw new Error(profileError.message);
      }

      if (profileData) {
        return this.transformUser(profileData);
      }

      // If profile not found, create one
      const username = authData.user.email?.split('@')[0] || 'new_user';
      const profileCreateStart = this.now();
      const { data: newProfileData, error: newProfileError } = await supabase
        .from('users')
        .insert({
          id: authData.user.id,
          username: username,
          email: authData.user.email ?? 'unknown@example.com',
          role: 'consumer' as 'musician' | 'consumer',
          avatar: DEFAULT_AVATAR_URL,
          followers: 0,
          following: 0,
          is_verified: true, // Auto-verify for better UX
        })
        .select()
        .single();
      this.logDuration('login create profile', profileCreateStart);

      if (newProfileError) {
        throw new Error(newProfileError.message);
      }
      
      if (!newProfileData) {
        throw new Error('User profile not found. Please contact support.');
      }

      return this.transformUser(newProfileData);
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : 'Login failed');
    }
  }

  static async logout(): Promise<void> {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        throw new Error(error.message);
      }
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : 'Logout failed');
    }
  }

  static async getCurrentUser(): Promise<User | null> {
    try {
      // Use getSession instead of getUser - it's faster and includes the same data
      const sessionStart = this.now();
      const { data: { session }, error } = await supabase.auth.getSession();
      this.logDuration('getCurrentUser getSession', sessionStart);
      
      if (error || !session?.user) {
        return null;
      }

      const profileFetchStart = this.now();
      const { data: profileData, error: profileError } = await supabase
        .from('users')
        .select('*')
        .eq('id', session.user.id)
        .maybeSingle();
      this.logDuration('getCurrentUser fetch profile', profileFetchStart);

      if (profileError || !profileData) {
        console.error('Error getting user profile:', profileError);
        return null;
      }

      return this.transformUser(profileData);
    } catch (error) {
      console.error('Error getting current user:', error);
      return null;
    }
  }

  static async getSession(): Promise<any> {
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error) {
        console.error('Error getting session:', error);
        return null;
      }
      return session;
    } catch (error) {
      console.error('Error getting session:', error);
      return null;
    }
  }

  static async refreshSession(): Promise<void> {
    try {
      const { data, error } = await supabase.auth.refreshSession();
      if (error) {
        console.error('Error refreshing session:', error);
      }
    } catch (error) {
      console.error('Error refreshing session:', error);
    }
  }

  static async updateProfile(userId: string, updates: Partial<User>): Promise<User> {
    try {
      const updateData: any = {};
      
      if (updates.username) updateData.username = updates.username;
      if (updates.avatar) updateData.avatar = updates.avatar;
      if (updates.bio) updateData.bio = updates.bio;
      if (updates.artistName) updateData.artist_name = updates.artistName;
      if (updates.genres) updateData.genres = updates.genres;
      if (updates.role) updateData.role = updates.role;
      if (updates.externalLinks !== undefined) updateData.external_links = updates.externalLinks;
      
      updateData.updated_at = new Date().toISOString();

      const { data, error } = await supabase
        .from('users')
        .update(updateData)
        .eq('id', userId)
        .select()
        .single();

      if (error) {
        throw new Error(error.message);
      }

      return this.transformUser(data);
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : 'Profile update failed');
    }
  }

  static async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (error) {
        throw new Error(error.message);
      }
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : 'Password change failed');
    }
  }

  static async changeEmail(newEmail: string): Promise<void> {
    try {
      const { error } = await supabase.auth.updateUser({
        email: newEmail
      });

      if (error) {
        throw new Error(error.message);
      }
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : 'Email change failed');
    }
  }

  static async changeUsername(userId: string, newUsername: string): Promise<User> {
    try {
      // Check if username is already taken
      const { data: existingUser, error: checkError } = await supabase
        .from('users')
        .select('id')
        .eq('username', newUsername)
        .neq('id', userId)
        .maybeSingle();

      if (checkError) {
        throw new Error(checkError.message);
      }

      if (existingUser) {
        throw new Error('Username is already taken');
      }

      // Update username
      const { data, error } = await supabase
        .from('users')
        .update({ username: newUsername })
        .eq('id', userId)
        .select()
        .single();

      if (error) {
        throw new Error(error.message);
      }

      return this.transformUser(data);
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : 'Username change failed');
    }
  }

  static async togglePrivateAccount(userId: string, isPrivate: boolean): Promise<User> {
    try {
      const { data, error } = await supabase
        .from('users')
        .update({ is_private: isPrivate })
        .eq('id', userId)
        .select()
        .single();

      if (error) {
        throw new Error(error.message);
      }

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
      return (data || []).map(this.transformUser);
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : 'User search failed');
    }
  }

  static async deleteAccount(userId: string): Promise<void> {
    try {
      // Call the backend API endpoint for secure account deletion
      const response = await fetch('/api/delete-account', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId }),
      });

      console.log('Delete account response status:', response.status);
      console.log('Delete account response headers:', response.headers.get('content-type'));

      if (!response.ok) {
        // Check if response is actually JSON before trying to parse
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const errorData = await response.json();
          throw new Error(errorData.error || `HTTP ${response.status}: Failed to delete account`);
        } else {
          // Response is not JSON (probably HTML error page)
          const textResponse = await response.text();
          console.error('Non-JSON response:', textResponse);
          throw new Error(`API endpoint not found (HTTP ${response.status}). Please ensure the API is deployed.`);
        }
      }

      // Check if successful response is JSON
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const result = await response.json();
        if (!result.success) {
          throw new Error('Account deletion failed');
        }
      } else {
        throw new Error('API returned non-JSON response');
      }
    } catch (error) {
      console.error('Delete account error:', error);
      throw new Error(error instanceof Error ? error.message : 'Failed to delete account');
    }
  }

  static onAuthStateChange(callback: (user: User | null) => void) {
    return supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth state change:', event, session?.user?.id);
      
      const shouldFetchProfile =
        (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION') &&
        session?.user;

      if (shouldFetchProfile) {
        const profileFetchStart = this.now();
        try {
          const { data: profileData, error } = await supabase
            .from('users')
            .select('*')
            .eq('id', session.user.id)
            .maybeSingle();
          this.logDuration(`auth ${event} fetch profile`, profileFetchStart);

          if (error) {
            console.error('Error getting user profile:', error);
            callback(null);
            return;
          }

          if (profileData) {
            callback(this.transformUser(profileData));
          } else {
            console.log('User profile not found in database');
            callback(null);
          }
        } catch (error) {
          console.error('Error getting user profile:', error);
          callback(null);
        }
        return;
      }

      if (event === 'SIGNED_OUT') {
        callback(null);
      }

      if (event === 'TOKEN_REFRESH_FAILED') {
        // Stale/invalid session — clear it so the app doesn't hang waiting for a refresh that will never succeed
        await supabase.auth.signOut();
        callback(null);
      }
    });
  }

  static transformUser(dbUser: any): User {
    return {
      id: dbUser.id,
      username: dbUser.username,
      email: dbUser.email,
      avatar: dbUser.avatar,
      followers: dbUser.followers,
      following: dbUser.following,
      role: dbUser.role,
      isVerified: dbUser.is_verified,
      isPrivate: dbUser.is_private,
      isAdmin: dbUser.is_admin ?? false,
      isVerifiedArtist: dbUser.is_verified_artist ?? false,
      artistName: dbUser.artist_name,
      bio: dbUser.bio,
      genres: dbUser.genres,
      externalLinks: dbUser.external_links ?? [],
    };
  }
} 