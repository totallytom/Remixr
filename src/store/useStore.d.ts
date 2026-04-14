import type { StoreApi, UseBoundStore } from 'zustand';

export interface User {
  id: string;
  username: string;
  email: string;
  avatar: string;
  followers: number;
  following: number;
  role: 'musician' | 'consumer';
  isVerified: boolean;
  isPrivate: boolean;
  isAdmin?: boolean;
  isVerifiedArtist?: boolean;
  artistName?: string;
  bio?: string;
  genres?: string[];
  externalLinks: string[];
}

export const useStore: UseBoundStore<any>;
export type { StoreApi, UseBoundStore };
