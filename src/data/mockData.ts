import { User, Track, Chat, Message, Comment } from '../store/useStore';
import { DEFAULT_AVATAR_URL } from '../utils/avatar';

export const mockUsers: User[] = [
  {
    id: '1',
    username: 'artist1',
    email: 'artist1@example.com',
    avatar: DEFAULT_AVATAR_URL,
    followers: 1200,
    following: 50,
    role: 'musician',
    isVerified: true,
    isPrivate: false,
    artistName: 'Artist One',
    bio: 'Electronic music producer',
    genres: ['Electronic', 'Ambient'],
  },
  {
    id: '2',
    username: 'artist2',
    email: 'artist2@example.com',
    avatar: DEFAULT_AVATAR_URL,
    followers: 800,
    following: 30,
    role: 'musician',
    isVerified: true,
    isPrivate: false,
    artistName: 'Artist Two',
    bio: 'Rock band frontman',
    genres: ['Rock', 'Alternative'],
  },
  {
    id: '3',
    username: 'artist3',
    email: 'artist3@example.com',
    avatar: DEFAULT_AVATAR_URL,
    followers: 2000,
    following: 100,
    role: 'musician',
    isVerified: true,
    isPrivate: false,
    artistName: 'Artist Three',
    bio: 'Hip-hop artist',
    genres: ['Hip Hop', 'R&B'],
  }
];

export const mockTracks: Track[] = [
  {
    id: '1',
    title: 'Midnight Dreams',
    artist: 'Artist One',
    album: 'Electronic Vibes',
    duration: 180,
    cover: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400&h=400&fit=crop',
    audioUrl: 'https://www.soundjay.com/misc/sounds/bell-ringing-05.wav',
    price: 0.99,
    genre: 'Electronic',
    boosted: false,
  },
  {
    id: '2',
    title: 'Ocean Waves',
    artist: 'Artist One',
    album: 'Ambient Collection',
    duration: 240,
    cover: 'https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=400&h=400&fit=crop',
    audioUrl: 'https://www.soundjay.com/misc/sounds/bell-ringing-05.wav',
    price: 1.49,
    genre: 'Ambient',
    boosted: true,
  },
  {
    id: '3',
    title: 'Rock Anthem',
    artist: 'Artist Two',
    album: 'Rock Classics',
    duration: 200,
    cover: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400&h=400&fit=crop',
    audioUrl: 'https://www.soundjay.com/misc/sounds/bell-ringing-05.wav',
    price: 0.99,
    genre: 'Rock',
    boosted: false,
  },
  {
    id: '4',
    title: 'Hip Hop Beat',
    artist: 'Artist Three',
    album: 'Urban Sounds',
    duration: 160,
    cover: 'https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=400&h=400&fit=crop',
    audioUrl: 'https://www.soundjay.com/misc/sounds/bell-ringing-05.wav',
    price: 1.99,
    genre: 'Hip Hop',
    boosted: true,
  },
  {
    id: '5',
    title: 'Jazz Fusion',
    artist: 'Artist One',
    album: 'Jazz Collection',
    duration: 300,
    cover: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400&h=400&fit=crop',
    audioUrl: 'https://www.soundjay.com/misc/sounds/bell-ringing-05.wav',
    price: 0.99,
    genre: 'Jazz',
    boosted: false,
  },
  {
    id: '6',
    title: 'Pop Hit',
    artist: 'Artist Two',
    album: 'Pop Hits',
    duration: 180,
    cover: 'https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=400&h=400&fit=crop',
    audioUrl: 'https://www.soundjay.com/misc/sounds/bell-ringing-05.wav',
    price: 1.29,
    genre: 'Pop',
    boosted: false,
  },
  {
    id: '7',
    title: 'Classical Piece',
    artist: 'Artist Three',
    album: 'Classical Masterpieces',
    duration: 400,
    cover: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400&h=400&fit=crop',
    audioUrl: 'https://www.soundjay.com/misc/sounds/bell-ringing-05.wav',
    price: 2.99,
    genre: 'Classical',
    boosted: false,
  },
  {
    id: '8',
    title: 'R&B Soul',
    artist: 'Artist One',
    album: 'Soul Collection',
    duration: 220,
    cover: 'https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=400&h=400&fit=crop',
    audioUrl: 'https://www.soundjay.com/misc/sounds/bell-ringing-05.wav',
    price: 1.49,
    genre: 'R&B',
    boosted: false,
  }
];

export const mockComments: Comment[] = [];

export const mockMessages: Message[] = [];

export const mockChats: Chat[] = [];

export const mockPosts = [];

export const mockData = {
  users: mockUsers,
  tracks: mockTracks,
  chats: mockChats,
  messages: mockMessages,
  comments: mockComments,
}; 