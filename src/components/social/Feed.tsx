import React, { useState, useEffect } from 'react';
import PostCard, { Post } from './PostCard';
import { PostsService } from '../../services/postsService';
import { useStore } from '../../store/useStore';
import PostCommentSection from './PostCommentSection';

const Feed: React.FC = () => {
  const [posts, setPosts] = useState<Post[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useStore();
  const [openCommentPostId, setOpenCommentPostId] = useState<string | null>(null);

  useEffect(() => {
    const loadPosts = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const fetchedPosts = await PostsService.getPosts();
        
        // Mark posts as liked by current user
        const postsWithLikeStatus = fetchedPosts.map(post => ({
          ...post,
          likedByUser: user ? post.likedBy.includes(user.id) : false
        }));
        
        setPosts(postsWithLikeStatus);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load posts');
      } finally {
        setIsLoading(false);
      }
    };

    loadPosts();
  }, [user]);

  const handleLike = async (postId: string) => {
    if (!user) return;

    try {
      await PostsService.likePost(postId, user.id);
      
      // Update the post in local state
      setPosts(prevPosts => 
        prevPosts.map(post => {
          if (post.id === postId) {
            const isLiked = post.likedByUser;
            return {
              ...post,
              likes: isLiked ? post.likes - 1 : post.likes + 1,
              likedByUser: !isLiked,
              likedBy: isLiked 
                ? post.likedBy.filter(id => id !== user.id)
                : [...post.likedBy, user.id]
            };
          }
          return post;
        })
      );
    } catch (err) {
      console.error('Failed to like post:', err);
    }
  };

  const handleDelete = async (postId: string) => {
    if (!user) return;
    try {
      await PostsService.deletePost(postId, user.id);
      setPosts(prevPosts => prevPosts.filter(post => post.id !== postId));
    } catch (err) {
      console.error('Failed to delete post:', err);
    }
  };
  const handleComment = (postId: string) => {
    setOpenCommentPostId(prev => (prev === postId ? null : postId));
  };

  if (isLoading) {
    return (
      <div className="max-w-xl mx-auto py-8">
        <div className="flex items-center justify-center py-8">
          <div className="spinner w-8 h-8"></div>
          <span className="ml-2 text-dark-400">Loading posts...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-xl mx-auto py-8">
        <div className="text-center py-8">
          <p className="text-red-400 mb-4">{error}</p>
          <button 
            onClick={() => window.location.reload()}
            className="bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (posts.length === 0) {
    return (
      <div className="max-w-xl mx-auto py-8">
        <div className="text-center py-8">
          <p className="text-dark-400 mb-4">No posts yet.</p>
          <p className="text-dark-400 text-sm">Be the first to share something!</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto py-8">
      {posts.map((post: Post) => (
        <div key={post.id}>
          <PostCard 
            post={post} 
            onLike={() => handleLike(post.id)}
            onDelete={() => handleDelete(post.id)}
            onComment={() => handleComment(post.id)}
          />
          {openCommentPostId === post.id && (
            <PostCommentSection
              postId={post.id}
              postOwnerId={post.user.id}
              isOpen={true}
              onToggle={() => handleComment(post.id)}
            />
          )}
        </div>
      ))}
    </div>
  );
};

export default Feed; 