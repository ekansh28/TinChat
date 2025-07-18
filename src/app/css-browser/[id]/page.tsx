// src/app/css-browser/[id]/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import { createClient } from '@supabase/supabase-js';
import Link from 'next/link';
import { ThumbsUp, ThumbsDown, Download, ArrowLeft, Calendar, MessageCircle, Share2 } from 'lucide-react';
import AuthButtons from '@/components/AuthButtons';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface CSSFile {
  id: string;
  title: string;
  author_id: string;
  author_username: string;
  author_display_name: string;
  file_type: 'profile' | 'chat_theme';
  file_url: string;
  preview_image_url?: string;
  tags: string[];
  likes_count: number;
  dislikes_count: number;
  download_count: number;
  created_at: string;
}

interface Comment {
  id: string;
  user_id: string;
  username: string;
  display_name: string;
  profile_image_url?: string | null;
  comment_text: string;
  created_at: string;
}

interface UserVote {
  like_type: 'like' | 'dislike';
}

export default function CSSFileDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user, isLoaded } = useUser();
  const [cssFile, setCSSFile] = useState<CSSFile | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [userVote, setUserVote] = useState<UserVote | null>(null);
  const [loading, setLoading] = useState(true);
  const [commentText, setCommentText] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [votingLoading, setVotingLoading] = useState(false);
  const [deletingComments, setDeletingComments] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (params.id) {
      fetchCSSFile();
      fetchComments();
      if (user) {
        fetchUserVote();
      }
    }
  }, [params.id, user]);

  const fetchCSSFile = async () => {
    try {
      const { data, error } = await supabase
        .from('css_files')
        .select('*')
        .eq('id', params.id)
        .single();

      if (error) {
        console.error('Error fetching CSS file:', error);
        return;
      }

      setCSSFile(data);
    } catch (error) {
      console.error('Error fetching CSS file:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchComments = async () => {
    try {
      const { data, error } = await supabase
        .from('css_file_comments')
        .select('*')
        .eq('file_id', params.id)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error fetching comments:', error);
        return;
      }

      setComments(data || []);
    } catch (error) {
      console.error('Error fetching comments:', error);
    }
  };

  const fetchUserVote = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('css_file_likes')
        .select('like_type')
        .eq('file_id', params.id)
        .eq('user_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching user vote:', error);
        return;
      }

      setUserVote(data);
    } catch (error) {
      console.error('Error fetching user vote:', error);
    }
  };

  const handleVote = async (voteType: 'like' | 'dislike') => {
    if (!user || !cssFile) return;

    setVotingLoading(true);
    
    try {
      const response = await fetch('/api/css/vote', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fileId: params.id,
          voteType,
          currentVote: userVote?.like_type
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to submit vote');
      }

      const result = await response.json();
      setUserVote(result.userVote);
      
      await fetchCSSFile();
    } catch (error) {
      console.error('Error voting:', error);
    } finally {
      setVotingLoading(false);
    }
  };

  const handleComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !commentText.trim()) return;

    setSubmittingComment(true);

    try {
      const response = await fetch('/api/css/comment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fileId: params.id,
          commentText: commentText.trim()
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to submit comment');
      }

      const result = await response.json();
      
      if (result.comment) {
        setComments(prev => [...prev, result.comment]);
      } else {
        const newComment: Comment = {
          id: Date.now().toString(),
          user_id: user.id,
          username: user.username || 'user',
          display_name: user.fullName || user.username || 'User',
          profile_image_url: user.imageUrl,
          comment_text: commentText.trim(),
          created_at: new Date().toISOString()
        };
        setComments(prev => [...prev, newComment]);
        
        setTimeout(() => {
          fetchComments();
        }, 500);
      }
      
      setCommentText('');

    } catch (error) {
      console.error('Error submitting comment:', error);
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!user) return;

    // No confirmation dialog - delete immediately
    setDeletingComments(prev => new Set([...prev, commentId]));

    try {
      const response = await fetch('/api/css/comment', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          commentId: commentId
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to delete comment');
      }

      // Remove comment from local state
      setComments(prev => prev.filter(comment => comment.id !== commentId));

    } catch (error) {
      console.error('Error deleting comment:', error);
      // Silently handle error - no alert
    } finally {
      setDeletingComments(prev => {
        const newSet = new Set(prev);
        newSet.delete(commentId);
        return newSet;
      });
    }
  };

  const handleDownload = async () => {
    if (!cssFile) return;

    try {
      await fetch('/api/css/download', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fileId: cssFile.id
        }),
      });

      const link = document.createElement('a');
      link.href = cssFile.file_url;
      link.download = `${cssFile.title}.css`;
      link.click();

      setCSSFile(prev => prev ? { ...prev, download_count: prev.download_count + 1 } : null);
    } catch (error) {
      console.error('Error downloading file:', error);
      const link = document.createElement('a');
      link.href = cssFile.file_url;
      link.download = `${cssFile.title}.css`;
      link.click();
    }
  };

  const handleShare = async () => {
    if (!cssFile) return;

    try {
      await navigator.clipboard.writeText(window.location.href);
      alert('Link copied to clipboard!');
    } catch (error) {
      console.error('Error copying to clipboard:', error);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const canDeleteComment = (comment: Comment) => {
    if (!user) return false;
    // User can delete their own comments or if they're the author of the CSS file
    return comment.user_id === user.id || cssFile?.author_id === user.id;
  };

  // Component to render user avatar
  const UserAvatar = ({ imageUrl, displayName, username, size = 32 }: {
    imageUrl?: string | null;
    displayName?: string | null;
    username?: string | null;
    size?: number;
  }) => {
    if (imageUrl) {
      return (
        <img
          src={imageUrl}
          alt={displayName || username || 'User'}
          width={size}
          height={size}
          className="rounded-full object-cover"
          style={{ width: size, height: size }}
        />
      );
    }

    const initial = (displayName?.charAt(0) || username?.charAt(0) || 'U').toUpperCase();
    return (
      <div 
        className="bg-purple-600 rounded-full flex items-center justify-center text-white font-bold"
        style={{ width: size, height: size, fontSize: size * 0.4 }}
      >
        {initial}
      </div>
    );
  };

  if (!isLoaded || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-white text-lg">Loading...</div>
      </div>
    );
  }

  if (!cssFile) {
    return (
      <div className="min-h-screenflex items-center justify-center">
        <div className="text-center text-white">
          <h1 className="text-2xl font-bold mb-4">CSS File Not Found</h1>
          <Link href="/css-browser" className="text-purple-300 hover:text-purple-200">
            ← Back to CSS Browser
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen ">
      {/* Header */}
      <div className="bg-black bg-opacity-50 border-b border-purple-500">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Link href="/css-browser" className="text-purple-300 hover:text-purple-200 flex items-center space-x-2">
                <ArrowLeft className="w-4 h-4" />
                <span>Back to Browser</span>
              </Link>
              <div className="text-white text-xl font-bold">{cssFile.title}</div>
            </div>
            
            <div className="flex items-center space-x-4">
              {user ? (
                <div className="flex items-center space-x-3">
                  <div className="flex items-center space-x-2">
                    <UserAvatar 
                      imageUrl={user.imageUrl}
                      displayName={user.fullName}
                      username={user.username}
                      size={32}
                    />
                    <span className="text-white text-sm font-medium">
                      {user.fullName || user.username || 'User'}
                    </span>
                  </div>
                  <AuthButtons />
                </div>
              ) : (
                <div className="text-white text-sm">
                  <span className="mr-2">Please log in to vote and comment</span>
                  <AuthButtons />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* File Header */}
        <div className="bg-black bg-opacity-40 rounded-lg p-6 mb-8 border border-purple-500">
          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="flex items-center space-x-3 mb-2">
                <h1 className="text-3xl font-bold text-white">{cssFile.title}</h1>
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                  cssFile.file_type === 'profile' 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-green-600 text-white'
                }`}>
                  {cssFile.file_type === 'profile' ? 'Profile CSS' : 'Chat Theme'}
                </span>
              </div>
              
              <div className="flex items-center space-x-4 text-purple-300 text-sm">
                <span>by </span>
                <Link
                  href={`/${cssFile.author_username}`}
                  className="hover:text-purple-200 font-medium"
                >
                  {cssFile.author_display_name || cssFile.author_username}
                </Link>
                <span className="flex items-center space-x-1">
                  <Calendar className="w-4 h-4" />
                  <span>{formatDate(cssFile.created_at)}</span>
                </span>
                <span className="flex items-center space-x-1">
                  <Download className="w-4 h-4" />
                  <span>{cssFile.download_count} downloads</span>
                </span>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={handleDownload}
                className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded flex items-center space-x-2"
              >
                <Download className="w-4 h-4" />
                <span>Download</span>
              </button>
              <button
                onClick={handleShare}
                className="border border-purple-500 text-purple-300 hover:bg-purple-800 hover:text-white px-4 py-2 rounded flex items-center space-x-2"
              >
                <Share2 className="w-4 h-4" />
                <span>Share</span>
              </button>
            </div>
          </div>

          {/* Tags */}
          {cssFile.tags && cssFile.tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-4">
              {cssFile.tags.map(tag => (
                <span
                  key={tag}
                  className="bg-purple-800 text-purple-200 px-3 py-1 rounded-full text-sm"
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Preview Images */}
        {cssFile.preview_image_url && (
          <div className="bg-black bg-opacity-40 rounded-lg p-6 mb-8 border border-purple-500">
            <h2 className="text-xl font-bold text-white mb-4">Preview</h2>
            <div className="relative aspect-video bg-gray-800 rounded-lg overflow-hidden">
              <img
                src={cssFile.preview_image_url}
                alt={`${cssFile.title} preview`}
                className="w-full h-full object-cover"
              />
            </div>
          </div>
        )}

        {/* Vote Section */}
        <div className="bg-black bg-opacity-40 rounded-lg p-6 mb-8 border border-purple-500">
          <h2 className="text-xl font-bold text-white mb-4">Rate this CSS</h2>
          <div className="flex items-center space-x-4">
            <button
              onClick={() => handleVote('like')}
              disabled={votingLoading || !user}
              className={`flex items-center space-x-2 px-4 py-2 rounded transition-colors ${
                userVote?.like_type === 'like'
                  ? 'bg-green-600 hover:bg-green-700 text-white'
                  : 'bg-transparent border border-green-500 text-green-400 hover:bg-green-800'
              }`}
            >
              <ThumbsUp className="w-4 h-4" />
              <span>{cssFile.likes_count}</span>
            </button>
            
            <button
              onClick={() => handleVote('dislike')}
              disabled={votingLoading || !user}
              className={`flex items-center space-x-2 px-4 py-2 rounded transition-colors ${
                userVote?.like_type === 'dislike'
                  ? 'bg-red-600 hover:bg-red-700 text-white'
                  : 'bg-transparent border border-red-500 text-red-400 hover:bg-red-800'
              }`}
            >
              <ThumbsDown className="w-4 h-4" />
              <span>{cssFile.dislikes_count}</span>
            </button>

            {!user && (
              <span className="text-purple-300 text-sm">Sign in to vote</span>
            )}
          </div>
        </div>

        {/* Comments Section */}
        <div className="bg-black bg-opacity-40 rounded-lg p-6 border border-purple-500">
          <div className="flex items-center space-x-2 mb-6">
            <MessageCircle className="w-5 h-5 text-purple-300" />
            <h2 className="text-xl font-bold text-white">Comments ({comments.length})</h2>
          </div>

          {/* Add Comment Form */}
          {user ? (
            <form onSubmit={handleComment} className="mb-6">
              <div className="flex items-start space-x-3">
                <UserAvatar 
                  imageUrl={user.imageUrl}
                  displayName={user.fullName}
                  username={user.username}
                  size={40}
                />
                <div className="flex-1">
                  <textarea
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    placeholder="Write a comment..."
                    className="w-full bg-black bg-opacity-30 text-white placeholder-purple-300 border border-purple-500 rounded p-3 resize-none focus:border-purple-400 focus:outline-none"
                    rows={3}
                    maxLength={500}
                  />
                  <div className="flex justify-between items-center mt-2">
                    <span className="text-purple-300 text-sm">
                      {commentText.length}/500
                    </span>
                    <button
                      type="submit"
                      disabled={submittingComment || !commentText.trim() || commentText.length > 500}
                      className="bg-purple-600 hover:bg-purple-700 disabled:bg-purple-800 disabled:opacity-50 text-white px-4 py-2 rounded"
                    >
                      {submittingComment ? 'Posting...' : 'Post Comment'}
                    </button>
                  </div>
                </div>
              </div>
            </form>
          ) : (
            <div className="mb-6 text-center text-purple-300 p-4 bg-black bg-opacity-30 rounded-lg">
              <p>Please sign in to leave a comment</p>
            </div>
          )}

          {/* Comments List */}
          <div className="space-y-4">
            {comments.length === 0 ? (
              <div className="text-center text-purple-300 py-8">
                <p>No comments yet. Be the first to comment!</p>
              </div>
            ) : (
              comments.map(comment => (
                <div key={comment.id} className="bg-black bg-opacity-30 rounded-lg p-4">
                  <div className="flex items-start space-x-3">
                    <UserAvatar 
                      imageUrl={comment.profile_image_url}
                      displayName={comment.display_name}
                      username={comment.username}
                      size={32}
                    />
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-1">
                        <Link
                          href={`/${comment.username}`}
                          className="text-purple-300 font-medium hover:text-purple-200"
                        >
                          {comment.display_name || comment.username}
                        </Link>
                        <span className="text-purple-400 text-sm">
                          {formatDate(comment.created_at)}
                        </span>
                        
                        {/* Delete option next to timestamp - as clickable text, not button */}
                        {canDeleteComment(comment) && (
                          <>
                            <span className="text-purple-400 text-sm">•</span>
                            <span
                              onClick={() => handleDeleteComment(comment.id)}
                              className={`text-white text-sm underline cursor-pointer hover:text-red-300 transition-colors ${
                                deletingComments.has(comment.id) ? 'opacity-50 cursor-not-allowed' : ''
                              }`}
                              style={{ 
                                pointerEvents: deletingComments.has(comment.id) ? 'none' : 'auto'
                              }}
                            >
                              {deletingComments.has(comment.id) ? 'Deleting...' : 'Delete'}
                            </span>
                          </>
                        )}
                      </div>
                      <p className="text-white text-sm leading-relaxed">
                        {comment.comment_text}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}