import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  Calendar, 
  MapPin, 
  Users, 
  Eye, 
  Play, 
  Heart, 
  Share2, 
  Music,
  Clock,
  Ticket,
  Image
} from 'lucide-react';
import { useStore } from '../store/useStore';
import { mockUsers, mockTracks, mockPosts } from '../data/mockData';
import TrackCard from '../components/music/TrackCard';
import PostCard from '../components/social/PostCard';
import { Track } from '../store/useStore';
import { getAvatarUrl } from '../utils/avatar';

interface Concert {
  id: string;
  name: string;
  date: string;
  location: string;
  venue: string;
  ticketPrice: number;
  availableTickets: number;
  image: string;
}

const mockConcerts: Concert[] = [
  {
    id: '1',
    name: 'Summer Festival 2024',
    date: '2024-07-15',
    location: 'Los Angeles, CA',
    venue: 'Hollywood Bowl',
    ticketPrice: 75,
    availableTickets: 150,
    image: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400&h=300&fit=crop',
  },
  {
    id: '2',
    name: 'Electronic Night',
    date: '2024-08-20',
    location: 'New York, NY',
    venue: 'Brooklyn Steel',
    ticketPrice: 45,
    availableTickets: 89,
    image: 'https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=400&h=300&fit=crop',
  },
  {
    id: '3',
    name: 'Ambient Sessions',
    date: '2024-09-10',
    location: 'San Francisco, CA',
    venue: 'The Fillmore',
    ticketPrice: 60,
    availableTickets: 45,
    image: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=400&h=300&fit=crop',
  },
];

const Artist: React.FC = () => {
  const { artistId } = useParams<{ artistId: string }>();
  const { setCurrentTrack, addToQueue } = useStore();
  const [isFollowing, setIsFollowing] = useState(false);
  const [activeTab, setActiveTab] = useState<'music' | 'posts' | 'concerts' | 'about'>('music');

  // Handle case when no users exist
  if (mockUsers.length === 0) {
    return (
      <div className="p-6 text-center">
        <h1 className="text-2xl font-bold text-black mb-4">No Artists Found</h1>
        <p className="text-gray-500">There are no artists available at the moment.</p>
      </div>
    );
  }

  const artist = mockUsers.find(u => u.id === artistId) || mockUsers[0];
  const artistTracks = mockTracks.filter(track => track.artist === artist.username);
  const artistPosts = (mockPosts as any[]).filter((post: any) => post.user?.username === artist.username);

  const handlePlayTrack = (track: Track) => {
    setCurrentTrack(track);
  };

  const handleAddToQueue = (track: Track) => {
    addToQueue(track);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  return (
    <div className="p-6 space-y-6">
      {/* Artist Header */}
      <div className="relative">
        <div className="absolute inset-0 bg-gradient-to-r from-primary-900/50 to-secondary-900/50 rounded-lg" />
        <div className="relative flex items-end p-8">
          <img
            src={getAvatarUrl(artist.avatar)}
            alt={artist.username}
            className="w-32 h-32 rounded-full object-cover border-4 border-white shadow-lg"
          />
          <div className="ml-40 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-black mb-2 font-kyobo">{artist.username}</h1>
                <p className="text-gray-600">Electronic Music Producer & DJ</p>
              </div>
              <div className="flex items-center space-x-4">
                <button
                  onClick={() => setIsFollowing(!isFollowing)}
                  className={`px-6 py-2 rounded-full font-medium transition-colors ${
                    isFollowing
                      ? 'bg-dark-700 text-black'
                      : 'bg-primary-600 text-black hover:bg-primary-700'
                  }`}
                >
                  {isFollowing ? 'Following' : 'Follow'}
                </button>
                <button className="p-2 rounded-full bg-dark-700 text-black hover:bg-dark-600 transition-colors">
                  <Share2 size={20} />
                </button>
              </div>
            </div>

            {/* Stats */}
            <div className="flex items-center space-x-8">
              <div className="flex items-center space-x-2">
                <Users className="text-primary-400" size={20} />
                <div>
                  <p className="text-black font-semibold">{artist.followers.toLocaleString()}</p>
                  <p className="text-gray-500 text-sm">Followers</p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <Users className="text-secondary-400" size={20} />
                <div>
                  <p className="text-black font-semibold">{artist.following.toLocaleString()}</p>
                  <p className="text-gray-500 text-sm">Following</p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <Eye className="text-green-400" size={20} />
                <div>
                  <p className="text-black font-semibold">2.4M</p>
                  <p className="text-gray-500 text-sm">Monthly Views</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-dark-700">
        <div className="flex space-x-8">
          {[
            { id: 'music', label: 'Music', icon: Music },
            { id: 'posts', label: 'Posts', icon: Image },
            { id: 'concerts', label: 'Concerts', icon: Calendar },
            { id: 'about', label: 'About', icon: Users },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center space-x-2 py-4 px-2 border-b-2 transition-colors ${
                  isActive
                    ? 'border-primary-500 text-primary-400'
                    : 'border-transparent text-gray-500 hover:text-black'
                }`}
              >
                <Icon size={20} />
                <span className="font-medium">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab Content */}
      <div className="min-h-96">
        {activeTab === 'music' && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-black font-kyobo">Latest Releases</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {artistTracks.map(track => (
                <TrackCard
                  key={track.id}
                  track={track}
                  onPlay={handlePlayTrack}
                  onAddToQueue={handleAddToQueue}
                />
              ))}
            </div>
          </div>
        )}

        {activeTab === 'posts' && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-black">Posts</h2>
            {artistPosts.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-500">No posts yet.</p>
              </div>
            ) : (
              <div className="max-w-2xl">
                {artistPosts.map((post: any) => (
                  <PostCard key={post.id} post={post} />
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'concerts' && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-black">Upcoming Concerts</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {mockConcerts.map(concert => (
                <motion.div
                  key={concert.id}
                  whileHover={{ y: -4 }}
                  className="bg-dark-800 rounded-lg overflow-hidden card-hover"
                >
                  <img
                    src={concert.image}
                    alt={concert.name}
                    className="w-full h-48 object-cover"
                  />
                  <div className="p-4 space-y-3">
                    <h3 className="text-lg font-semibold text-black">{concert.name}</h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center space-x-2 text-gray-600">
                        <Calendar size={16} />
                        <span>{formatDate(concert.date)}</span>
                      </div>
                      <div className="flex items-center space-x-2 text-gray-600">
                        <MapPin size={16} />
                        <span>{concert.venue}, {concert.location}</span>
                      </div>
                      <div className="flex items-center space-x-2 text-gray-600">
                        <Ticket size={16} />
                        <span>${concert.ticketPrice}</span>
                      </div>
                      <div className="flex items-center space-x-2 text-green-400">
                        <Clock size={16} />
                        <span>{concert.availableTickets} tickets left</span>
                      </div>
                    </div>
                    <button className="w-full bg-primary-600 text-black py-2 rounded-lg hover:bg-primary-700 transition-colors">
                      Buy Tickets
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'about' && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-black">About {artist.username}</h2>
            <div className="bg-dark-800 rounded-lg p-6">
              <p className="text-gray-600 leading-relaxed">
                {artist.username} is a talented electronic music producer and DJ who has been creating 
                innovative sounds for over 5 years. Known for their unique blend of ambient, electronic, 
                and experimental music, they have gained a dedicated following worldwide.
              </p>
              <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-lg font-semibold text-black mb-3">Achievements</h3>
                  <ul className="space-y-2 text-gray-600">
                    <li>• 2.4M+ monthly listeners</li>
                    <li>• Featured on major streaming platforms</li>
                    <li>• Collaborated with top artists</li>
                    <li>• Multiple chart-topping releases</li>
                  </ul>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-black mb-3">Genres</h3>
                  <div className="flex flex-wrap gap-2">
                    {['Electronic', 'Ambient', 'Experimental', 'Downtempo'].map(genre => (
                      <span
                        key={genre}
                        className="px-3 py-1 bg-dark-700 text-black rounded-full text-sm"
                      >
                        {genre}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Artist; 