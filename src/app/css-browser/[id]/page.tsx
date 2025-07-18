// src/app/css-browser/[id]/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import { createClient } from '@supabase/supabase-js';
import Link from 'next/link';
import { ThumbsUp, ThumbsDown, Download, ArrowLeft, Calendar, MessageCircle, Share2, ChevronLeft, ChevronRight, Play, Pause, Volume2, VolumeX, Maximize2, ExternalLink, Trash2, AlertTriangle } from 'lucide-react';
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
  preview_image_urls?: string[] | null;
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
  const { user, isLoaded } = useUser();
  const [cssFile, setCSSFile] = useState<CSSFile | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [userVote, setUserVote] = useState<UserVote | null>(null);
  const [loading, setLoading] = useState(true);
  const [commentText, setCommentText] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [votingLoading, setVotingLoading] = useState(false);
  const [deletingComments, setDeletingComments] = useState<Set<string>>(new Set());
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingFile, setDeletingFile] = useState(false);
  
  // Enhanced carousel state
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [autoSlideInterval, setAutoSlideInterval] = useState<NodeJS.Timeout | null>(null);
  const [imageLoadErrors, setImageLoadErrors] = useState<Set<number>>(new Set());
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [preloadedImages, setPreloadedImages] = useState<Set<string>>(new Set());
  
  // Video controls state
  const [videoStates, setVideoStates] = useState<{[key: string]: {isPlaying: boolean, isMuted: boolean}}>({});

  useEffect(() => {
    if (params.id) {
      fetchCSSFile();
      fetchComments();
      if (user) {
        fetchUserVote();
      }
    }
  }, [params.id, user]);

  // Preload images for smooth transitions
  useEffect(() => {
    const previewUrls = getPreviewUrls();
    previewUrls.forEach(url => {
      if (!isVideoUrl(url) && !preloadedImages.has(url)) {
        const img = new Image();
        img.onload = () => {
          setPreloadedImages(prev => new Set([...prev, url]));
        };
        img.src = url;
      }
    });
  }, [cssFile]);

  // Enhanced auto-slide with pause on hover
  useEffect(() => {
    const previewUrls = getPreviewUrls();
    if (previewUrls.length > 1 && !isTransitioning) {
      const interval = setInterval(() => {
        setCurrentImageIndex((prev) => 
          prev === previewUrls.length - 1 ? 0 : prev + 1
        );
      }, 6000);

      setAutoSlideInterval(interval);
      return () => clearInterval(interval);
    }
  }, [cssFile, isTransitioning]);

  // Helper function to get preview URLs
  const getPreviewUrls = (): string[] => {
    if (!cssFile) return [];
    
    if (cssFile.preview_image_urls && Array.isArray(cssFile.preview_image_urls) && cssFile.preview_image_urls.length > 0) {
      return cssFile.preview_image_urls.filter(url => url && url.trim() !== '');
    }
    
    return [];
  };

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

      setComments(prev => prev.filter(comment => comment.id !== commentId));

    } catch (error) {
      console.error('Error deleting comment:', error);
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
      link.download = `${cssFile.title.replace(/[^a-zA-Z0-9]/g, '_')}.css`;
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setCSSFile(prev => prev ? { ...prev, download_count: prev.download_count + 1 } : null);
    } catch (error) {
      console.error('Error downloading file:', error);
      const link = document.createElement('a');
      link.href = cssFile.file_url;
      link.download = `${cssFile.title.replace(/[^a-zA-Z0-9]/g, '_')}.css`;
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const handleShare = async () => {
    if (!cssFile) return;

    try {
      await navigator.clipboard.writeText(window.location.href);
      // Show toast notification instead of alert
      const toast = document.createElement('div');
      toast.className = 'fixed top-4 right-4 bg-green-600 text-white px-4 py-2 rounded-lg shadow-lg z-50 transform transition-all duration-300 ease-in-out';
      toast.textContent = 'Link copied to clipboard!';
      document.body.appendChild(toast);
      setTimeout(() => {
        toast.style.transform = 'translateX(100%)';
        setTimeout(() => document.body.removeChild(toast), 300);
      }, 2000);
    } catch (error) {
      console.error('Error copying to clipboard:', error);
    }
  };

  const handleDeleteFile = async () => {
    if (!cssFile || !user || cssFile.author_id !== user.id) return;

    setDeletingFile(true);

    try {
      const response = await fetch(`/api/css/${cssFile.id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to delete CSS file');
      }

      // Show success toast
      const toast = document.createElement('div');
      toast.className = 'fixed top-4 right-4 bg-green-600 text-white px-4 py-2 rounded-lg shadow-lg z-50 transform transition-all duration-300 ease-in-out';
      toast.textContent = 'CSS file deleted successfully!';
      document.body.appendChild(toast);

      // Redirect to CSS browser after a brief delay
      setTimeout(() => {
        window.location.href = '/css-browser';
      }, 1500);

    } catch (error) {
      console.error('Error deleting CSS file:', error);
      
      // Show error toast
      const toast = document.createElement('div');
      toast.className = 'fixed top-4 right-4 bg-red-600 text-white px-4 py-2 rounded-lg shadow-lg z-50 transform transition-all duration-300 ease-in-out';
      toast.textContent = 'Failed to delete CSS file. Please try again.';
      document.body.appendChild(toast);
      setTimeout(() => {
        toast.style.transform = 'translateX(100%)';
        setTimeout(() => document.body.removeChild(toast), 300);
      }, 3000);
    } finally {
      setDeletingFile(false);
      setShowDeleteConfirm(false);
    }
  };

  // Check if current user owns this CSS file
  const isOwner = user && cssFile && cssFile.author_id === user.id;

  // Enhanced carousel navigation with smooth transitions
  const goToPrevious = () => {
    const previewUrls = getPreviewUrls();
    if (!previewUrls.length || isTransitioning) return;
    
    if (autoSlideInterval) {
      clearInterval(autoSlideInterval);
      setAutoSlideInterval(null);
    }
    
    setIsTransitioning(true);
    setCurrentImageIndex((prev) => 
      prev === 0 ? previewUrls.length - 1 : prev - 1
    );
    
    setTimeout(() => setIsTransitioning(false), 300);
  };

  const goToNext = () => {
    const previewUrls = getPreviewUrls();
    if (!previewUrls.length || isTransitioning) return;
    
    if (autoSlideInterval) {
      clearInterval(autoSlideInterval);
      setAutoSlideInterval(null);
    }
    
    setIsTransitioning(true);
    setCurrentImageIndex((prev) => 
      prev === previewUrls.length - 1 ? 0 : prev + 1
    );
    
    setTimeout(() => setIsTransitioning(false), 300);
  };

  const goToSlide = (index: number) => {
    if (isTransitioning) return;
    
    if (autoSlideInterval) {
      clearInterval(autoSlideInterval);
      setAutoSlideInterval(null);
    }
    
    setIsTransitioning(true);
    setCurrentImageIndex(index);
    setTimeout(() => setIsTransitioning(false), 300);
  };

  // Enhanced video controls
  const toggleVideoPlay = (videoId: string) => {
    const video = document.getElementById(videoId) as HTMLVideoElement;
    if (video) {
      if (video.paused) {
        video.play();
        setVideoStates(prev => ({
          ...prev,
          [videoId]: { ...prev[videoId], isPlaying: true }
        }));
      } else {
        video.pause();
        setVideoStates(prev => ({
          ...prev,
          [videoId]: { ...prev[videoId], isPlaying: false }
        }));
      }
    }
  };

  const toggleVideoMute = (videoId: string) => {
    const video = document.getElementById(videoId) as HTMLVideoElement;
    if (video) {
      video.muted = !video.muted;
      setVideoStates(prev => ({
        ...prev,
        [videoId]: { ...prev[videoId], isMuted: video.muted }
      }));
    }
  };

  const openVideoFullscreen = (videoId: string) => {
    const video = document.getElementById(videoId) as HTMLVideoElement;
    if (video && video.requestFullscreen) {
      video.requestFullscreen();
    }
  };

  // Helper function to check if URL is a video
  const isVideoUrl = (url: string) => {
    const videoExtensions = ['.mp4', '.webm', '.ogg', '.avi', '.mov'];
    return videoExtensions.some(ext => url.toLowerCase().includes(ext));
  };

  // Handle image load errors
  const handleImageError = (index: number) => {
    setImageLoadErrors(prev => new Set([...prev, index]));
  };

  const handleImageLoad = (index: number) => {
    setImageLoadErrors(prev => {
      const newSet = new Set(prev);
      newSet.delete(index);
      return newSet;
    });
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
    return comment.user_id === user.id || cssFile?.author_id === user.id;
  };

  // Enhanced user avatar component
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
          className="rounded-full object-cover ring-2 ring-purple-500/20"
          style={{ width: size, height: size }}
        />
      );
    }

    const initial = (displayName?.charAt(0) || username?.charAt(0) || 'U').toUpperCase();
    return (
      <div 
        className="bg-gradient-to-br from-purple-600 to-blue-600 rounded-full flex items-center justify-center text-white font-bold ring-2 ring-purple-500/20"
        style={{ width: size, height: size, fontSize: size * 0.4 }}
      >
        {initial}
      </div>
    );
  };

  if (!isLoaded || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center space-y-4">
       
          <div className="text-white text-lg">
            <img src="https://cdn.tinchat.online/animations/downloading.gif" alt="Loading" />
            Loading CSS file...
          </div>
        </div>
      </div>
    );
  }

  if (!cssFile) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center text-white">
          <h1 className="text-2xl font-bold mb-4">CSS File Not Found</h1>
          <p className="text-purple-300 mb-6">The CSS file you're looking for doesn't exist or has been removed.</p>
          <Link href="/css-browser" className="inline-flex items-center space-x-2 text-purple-300 hover:text-purple-200 transition-colors">
            <ArrowLeft className="w-4 h-4" />
            <span>Back to CSS Browser</span>
          </Link>
        </div>
      </div>
    );
  }

  const previewUrls = getPreviewUrls();

  return (
    <div className="min-h-screen ">
      {/* Enhanced Header */}
      <div className="bg-black/60 backdrop-blur-md border-b border-purple-500/30 sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Link href="/css-browser" className="group flex items-center space-x-2 text-purple-300 hover:text-purple-200 transition-colors">
                <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                <span>Back to Browser</span>
              </Link>
              <div className="h-6 w-px bg-purple-500/30"></div>
              <div className="text-white text-xl font-bold truncate max-w-md">{cssFile.title}</div>
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
                    <span className="text-white text-sm font-medium hidden sm:block">
                      {user.fullName || user.username || 'User'}
                    </span>
                  </div>
                  <AuthButtons />
                </div>
              ) : (
                <div className="text-white text-sm">
                  <span className="mr-2 hidden sm:inline">Please log in to vote and comment</span>
                  <AuthButtons />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-4 py-4">
        {/* Compact File Header */}
        <div className="bg-black/40 backdrop-blur-sm rounded-xl p-4 mb-4 border border-purple-500/30 shadow-2xl">
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1">
              <div className="flex items-center space-x-3 mb-2">
                <h1 className="text-2xl font-bold text-white">{cssFile.title}</h1>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                  cssFile.file_type === 'profile' 
                    ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white' 
                    : 'bg-gradient-to-r from-green-600 to-teal-600 text-white'
                }`}>
                  {cssFile.file_type === 'profile' ? 'Profile CSS' : 'Chat Theme'}
                </span>
              </div>
              
              <div className="flex items-center space-x-4 text-purple-300 text-sm">
                <div className="flex items-center space-x-1">
                  <span>by</span>
                  <Link
                    href={`/${cssFile.author_username}`}
                    className="hover:text-purple-200 font-medium transition-colors"
                  >
                    {cssFile.author_display_name || cssFile.author_username}
                  </Link>
                </div>
                <div className="flex items-center space-x-1">
                  <Calendar className="w-3 h-3" />
                  <span>{formatDate(cssFile.created_at)}</span>
                </div>
                <div className="flex items-center space-x-1">
                  <Download className="w-3 h-3" />
                  <span>{cssFile.download_count.toLocaleString()}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={handleDownload}
                className="group bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white px-3 py-1.5 rounded-lg flex items-center space-x-1.5 text-sm font-medium transition-all duration-200"
              >
                <Download className="w-4 h-4" />
                <span>Download</span>
              </button>
              <button
                onClick={handleShare}
                className="group border border-purple-500/50 text-purple-300 hover:bg-purple-800/50 hover:text-white px-3 py-1.5 rounded-lg flex items-center space-x-1.5 text-sm font-medium transition-all duration-200"
              >
                <Share2 className="w-4 h-4" />
                <span>Share</span>
              </button>
              <button
                onClick={() => window.open(cssFile.file_url, '_blank')}
                className="group border border-purple-500/50 text-purple-300 hover:bg-purple-800/50 hover:text-white px-3 py-1.5 rounded-lg flex items-center space-x-1.5 text-sm font-medium transition-all duration-200"
              >
                <ExternalLink className="w-4 h-4" />
                <span>Raw</span>
              </button>
              {/* Delete button - only show for file owner */}
              {isOwner && (
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="group border border-red-500/50 text-red-400 hover:bg-red-800/50 hover:text-white px-3 py-1.5 rounded-lg flex items-center space-x-1.5 text-sm font-medium transition-all duration-200"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Delete</span>
                </button>
              )}
            </div>
          </div>

          {/* Compact Tags */}
          {cssFile.tags && cssFile.tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {cssFile.tags.map(tag => (
                <span
                  key={tag}
                  className="bg-gradient-to-r from-purple-800/50 to-blue-800/50 text-purple-200 px-2 py-0.5 rounded-full text-xs font-medium border border-purple-500/30 backdrop-blur-sm"
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Compact Preview Carousel */}
        {previewUrls.length > 0 ? (
          <div className="bg-black/40 backdrop-blur-sm rounded-xl p-4 mb-4 border border-purple-500/30 shadow-2xl">
            <h2 className="text-lg font-bold text-white mb-3">
              Preview ({previewUrls.length})
            </h2>
            <div className="relative">
              {/* Compact main preview container */}
              <div 
                className="relative aspect-video bg-black/50 rounded-lg overflow-hidden shadow-xl border border-purple-500/20"
                onMouseEnter={() => autoSlideInterval && clearInterval(autoSlideInterval)}
                onMouseLeave={() => {
                  if (previewUrls.length > 1) {
                    const interval = setInterval(() => {
                      setCurrentImageIndex((prev) => 
                        prev === previewUrls.length - 1 ? 0 : prev + 1
                      );
                    }, 6000);
                    setAutoSlideInterval(interval);
                  }
                }}
              >
                {/* Sliding container */}
                <div 
                  className="flex transition-transform duration-500 ease-in-out h-full"
                  style={{ transform: `translateX(-${currentImageIndex * 100}%)` }}
                >
                  {previewUrls.map((url, index) => (
                    <div key={index} className="w-full h-full flex-shrink-0 flex items-center justify-center">
                      {!imageLoadErrors.has(index) ? (
                        isVideoUrl(url) ? (
                          <div className="relative w-full h-full">
                            <video
                              id={`video-${index}`}
                              src={url}
                              className="w-full h-full object-contain"
                              controls={false}
                              muted={videoStates[`video-${index}`]?.isMuted !== false}
                              onError={() => handleImageError(index)}
                              onLoadedData={() => handleImageLoad(index)}
                            />
                            {/* Video controls overlay */}
                            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity duration-300">
                              <div className="flex items-center space-x-3">
                                <button
                                  onClick={() => toggleVideoPlay(`video-${index}`)}
                                  className="bg-black/50 hover:bg-black/70 text-white rounded-full p-2 transition-all duration-200"
                                >
                                  {videoStates[`video-${index}`]?.isPlaying ? 
                                    <Pause className="w-5 h-5" /> : 
                                    <Play className="w-5 h-5" />
                                  }
                                </button>
                                <button
                                  onClick={() => toggleVideoMute(`video-${index}`)}
                                  className="bg-black/50 hover:bg-black/70 text-white rounded-full p-2 transition-all duration-200"
                                >
                                  {videoStates[`video-${index}`]?.isMuted ? 
                                    <VolumeX className="w-4 h-4" /> : 
                                    <Volume2 className="w-4 h-4" />
                                  }
                                </button>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <img
                            src={url}
                            alt={`${cssFile.title} preview ${index + 1}`}
                            className="w-full h-full object-contain"
                            onError={() => handleImageError(index)}
                            onLoad={() => handleImageLoad(index)}
                          />
                        )
                      ) : (
                        <div className="text-center text-purple-300">
                          <div className="text-4xl mb-2 opacity-50">❌</div>
                          <div className="text-sm">Failed to load preview</div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                
                {/* Navigation arrows */}
                {previewUrls.length > 1 && (
                  <>
                    <button
                      onClick={goToPrevious}
                      disabled={isTransitioning}
                      className="absolute left-3 top-1/2 transform -translate-y-1/2 bg-black/40 text-white rounded-full p-2 disabled:opacity-50 disabled:cursor-not-allowed backdrop-blur-sm border-0 outline-none focus:outline-none"
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                    <button
                      onClick={goToNext}
                      disabled={isTransitioning}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 bg-black/40 text-white rounded-full p-2 disabled:opacity-50 disabled:cursor-not-allowed backdrop-blur-sm border-0 outline-none focus:outline-none"
                    >
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  </>
                )}
                
                {/* Image counter */}
                {previewUrls.length > 1 && (
                  <div className="absolute top-3 right-3 bg-black/70 backdrop-blur-sm text-white px-2 py-1 rounded-full text-xs font-medium">
                    {currentImageIndex + 1} / {previewUrls.length}
                  </div>
                )}
                
                {/* Progress indicators */}
                {previewUrls.length > 1 && (
                  <div className="absolute bottom-3 left-1/2 transform -translate-x-1/2 flex space-x-2">
                    {[0, 1, 2].map((dotIndex) => (
                      <div
                        key={dotIndex}
                        onClick={() => goToSlide(dotIndex < previewUrls.length ? dotIndex : 0)}
                        className={`w-2 h-2 rounded-full transition-all duration-300 cursor-pointer ${
                          dotIndex === currentImageIndex 
                            ? 'bg-white/60' 
                            : 'bg-black/60 hover:bg-black/80'
                        }`}
                      />
                    ))}
                  </div>
                )}
              </div>
              
              {/* Compact thumbnail navigation */}
              {previewUrls.length > 1 && (
                <div className="flex space-x-2 mt-3 overflow-x-auto pb-1">
                  {previewUrls.map((url, index) => (
                    <div
                      key={index}
                      onClick={() => goToSlide(index)}
                      className={`group flex-shrink-0 w-16 h-10 rounded-md overflow-hidden cursor-pointer transition-all duration-300 ${
                        index === currentImageIndex 
                          ? 'ring-2 ring-purple-400 ring-offset-1 ring-offset-black/40' 
                          : 'hover:ring-1 hover:ring-purple-300/50'
                      }`}
                    >
                      <div className="w-full h-full bg-black/50 flex items-center justify-center relative overflow-hidden">
                        {imageLoadErrors.has(index) ? (
                          <div className="text-red-400 text-xs">❌</div>
                        ) : isVideoUrl(url) ? (
                          <div className="relative w-full h-full">
                            <video
                              src={url}
                              className="w-full h-full object-cover"
                              muted
                            />
                            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                              <Play className="w-3 h-3 text-white" />
                            </div>
                          </div>
                        ) : (
                          <img
                            src={url}
                            alt={`Thumbnail ${index + 1}`}
                            className="w-full h-full object-cover"
                            onError={() => handleImageError(index)}
                            onLoad={() => handleImageLoad(index)}
                          />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="bg-black/40 backdrop-blur-sm rounded-xl p-4 mb-4 border border-purple-500/30 shadow-2xl">
            <h2 className="text-lg font-bold text-white mb-3">Preview</h2>
            <div className="text-center text-purple-300 py-8">
              <div className="text-4xl mb-2 opacity-50">🖼️</div>
              <p className="text-sm opacity-75">No preview available</p>
            </div>
          </div>
        )}

        {/* Compact Vote & Comments Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Compact Vote Section */}
          <div className="bg-black/40 backdrop-blur-sm rounded-xl p-4 border border-purple-500/30 shadow-2xl">
            <h2 className="text-lg font-bold text-white mb-3">Rate this CSS</h2>
            <div className="space-y-3">
              <div className="flex items-center space-x-3">
                <button
                  onClick={() => handleVote('like')}
                  disabled={votingLoading || !user}
                  className={`group flex items-center space-x-2 px-3 py-2 rounded-lg transition-all duration-200 text-sm font-medium ${
                    userVote?.like_type === 'like'
                      ? 'bg-gradient-to-r from-green-600 to-emerald-600 text-white shadow-lg'
                      : 'bg-transparent border border-green-500/50 text-green-400 hover:bg-green-800/30 hover:border-green-400'
                  } ${votingLoading || !user ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <ThumbsUp className="w-4 h-4" />
                  <span className="font-bold">{cssFile.likes_count}</span>
                </button>
                
                <button
                  onClick={() => handleVote('dislike')}
                  disabled={votingLoading || !user}
                  className={`group flex items-center space-x-2 px-3 py-2 rounded-lg transition-all duration-200 text-sm font-medium ${
                    userVote?.like_type === 'dislike'
                      ? 'bg-gradient-to-r from-red-600 to-rose-600 text-white shadow-lg'
                      : 'bg-transparent border border-red-500/50 text-red-400 hover:bg-red-800/30 hover:border-red-400'
                  } ${votingLoading || !user ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <ThumbsDown className="w-4 h-4" />
                  <span className="font-bold">{cssFile.dislikes_count}</span>
                </button>
              </div>

              <div className="flex items-center justify-between text-sm">
                <div className="text-center">
                  <div className="text-lg font-bold text-white">
                    {((cssFile.likes_count / Math.max(cssFile.likes_count + cssFile.dislikes_count, 1)) * 100).toFixed(0)}%
                  </div>
                  <div className="text-xs text-purple-300">Positive</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold text-white">
                    {cssFile.likes_count - cssFile.dislikes_count}
                  </div>
                  <div className="text-xs text-purple-300">Score</div>
                </div>
              </div>

              {!user && (
                <div className="p-3 bg-purple-900/20 rounded-lg border border-purple-500/30">
                  <p className="text-purple-300 text-xs text-center">
                    Sign in to rate this CSS file
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Compact Comments Section */}
          <div className="lg:col-span-2 bg-black/40 backdrop-blur-sm rounded-xl p-4 border border-purple-500/30 shadow-2xl">
            <div className="flex items-center space-x-2 mb-4">
              <MessageCircle className="w-5 h-5 text-purple-300" />
              <h2 className="text-lg font-bold text-white">
                Discussion ({comments.length})
              </h2>
            </div>

            {/* Compact Add Comment Form */}
            {user ? (
              <form onSubmit={handleComment} className="mb-4">
                <div className="flex items-start space-x-3">
                  <UserAvatar 
                    imageUrl={user.imageUrl}
                    displayName={user.fullName}
                    username={user.username}
                    size={32}
                  />
                  <div className="flex-1">
                    <textarea
                      value={commentText}
                      onChange={(e) => setCommentText(e.target.value)}
                      placeholder="Share your thoughts..."
                      className="w-full bg-black/30 backdrop-blur-sm text-white placeholder-purple-300/70 border border-purple-500/30 rounded-lg p-3 resize-none focus:border-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-500/20 text-sm transition-all duration-200"
                      rows={2}
                      maxLength={500}
                    />
                    <div className="flex justify-between items-center mt-2">
                      <span className="text-purple-300 text-xs">
                        {commentText.length}/500
                      </span>
                      <button
                        type="submit"
                        disabled={submittingComment || !commentText.trim() || commentText.length > 500}
                        className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 disabled:from-purple-800 disabled:to-blue-800 disabled:opacity-50 text-white px-4 py-1.5 rounded-lg text-sm font-medium transition-all duration-200"
                      >
                        {submittingComment ? 'Posting...' : 'Post'}
                      </button>
                    </div>
                  </div>
                </div>
              </form>
            ) : (
              <div className="mb-4 text-center p-4 bg-gradient-to-r from-purple-900/20 to-blue-900/20 rounded-lg border border-purple-500/30">
                <p className="text-purple-300 text-sm mb-3">
                  Sign in to join the discussion
                </p>
                <AuthButtons />
              </div>
            )}

            {/* Compact Comments List */}
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {comments.length === 0 ? (
                <div className="text-center py-8">
                  <div className="text-4xl mb-2 opacity-30">💬</div>
                  <p className="text-purple-300 text-sm">No comments yet. Be the first!</p>
                </div>
              ) : (
                comments.map((comment, index) => (
                  <div 
                    key={comment.id} 
                    className="bg-black/30 backdrop-blur-sm rounded-lg p-3 border border-purple-500/20 transition-all duration-300 hover:border-purple-400/30"
                  >
                    <div className="flex items-start space-x-3">
                      <UserAvatar 
                        imageUrl={comment.profile_image_url}
                        displayName={comment.display_name}
                        username={comment.username}
                        size={28}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2 mb-1">
                          <Link
                            href={`/${comment.username}`}
                            className="text-purple-300 font-medium hover:text-purple-200 text-sm transition-colors truncate"
                          >
                            {comment.display_name || comment.username}
                          </Link>
                          <span className="text-purple-400/70 text-xs">•</span>
                          <span className="text-purple-400/70 text-xs">
                            {new Date(comment.created_at).toLocaleDateString()}
                          </span>
                          
                          {/* Delete option */}
                          {canDeleteComment(comment) && (
                            <>
                              <span className="text-purple-400/70 text-xs">•</span>
                              <button
                                onClick={() => handleDeleteComment(comment.id)}
                                disabled={deletingComments.has(comment.id)}
                                className={`text-red-400 text-xs hover:text-red-300 transition-colors ${
                                  deletingComments.has(comment.id) ? 'opacity-50 cursor-not-allowed' : 'hover:underline'
                                }`}
                              >
                                {deletingComments.has(comment.id) ? 'Deleting...' : 'Delete'}
                              </button>
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

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-black/90 backdrop-blur-md border border-red-500/30 rounded-xl p-6 max-w-md w-full shadow-2xl">
            <div className="flex items-center space-x-3 mb-4">
              <div className="bg-red-600/20 rounded-full p-2">
                <AlertTriangle className="w-6 h-6 text-red-400" />
              </div>
              <h3 className="text-xl font-bold text-white">Delete CSS File</h3>
            </div>
            
            <div className="mb-6">
              <p className="text-gray-300 mb-3">
                Are you sure you want to delete <span className="font-semibold text-white">"{cssFile?.title}"</span>?
              </p>
              <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-3">
                <p className="text-red-300 text-sm">
                  <strong>This action cannot be undone.</strong> The file will be permanently deleted along with all comments and ratings.
                </p>
              </div>
            </div>

            <div className="flex space-x-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deletingFile}
                className="flex-1 bg-transparent border border-gray-500/50 text-gray-300 hover:bg-gray-800/50 hover:text-white px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteFile}
                disabled={deletingFile}
                className="flex-1 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 disabled:opacity-50 flex items-center justify-center space-x-2"
              >
                {deletingFile ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    <span>Delete File</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}