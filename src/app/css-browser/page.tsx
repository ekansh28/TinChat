'use client';

import { useState, useEffect } from 'react';
import { useUser } from '@clerk/nextjs';
import { createClient } from '@supabase/supabase-js';
import Link from 'next/link';
import { Search, Filter, Upload, Home, ThumbsUp, Calendar, TrendingUp, Star, Eye, Download, User, ThumbsDown, Play } from 'lucide-react';
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
  preview_image_urls?: string[];
  tags: string[];
  likes_count: number;
  dislikes_count: number;
  download_count: number;
  created_at: string;
}

type SortBy = 'date' | 'popularity' | 'rating' | 'downloads';
type FilterBy = 'all' | 'profile' | 'chat_theme';

export default function CSSBrowserPage() {
  const { user, isLoaded } = useUser();
  const [cssFiles, setCSSFiles] = useState<CSSFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<SortBy>('date');
  const [filterBy, setFilterBy] = useState<FilterBy>('all');
  const [allTags, setAllTags] = useState<string[]>([]);

  useEffect(() => {
    fetchCSSFiles();
    fetchAllTags();
  }, [sortBy, filterBy, selectedTags]);

  const fetchCSSFiles = async () => {
    try {
      setLoading(true);
      
      let query = supabase
        .from('css_files')
        .select('*');

      // Apply filters
      if (filterBy !== 'all') {
        query = query.eq('file_type', filterBy);
      }

      // Apply search
      if (searchQuery) {
        query = query.or(
          `title.ilike.%${searchQuery}%,author_username.ilike.%${searchQuery}%,author_display_name.ilike.%${searchQuery}%`
        );
      }

      // Apply tag filtering
      if (selectedTags.length > 0) {
        query = query.overlaps('tags', selectedTags);
      }

      // Apply sorting
      switch (sortBy) {
        case 'date':
          query = query.order('created_at', { ascending: false });
          break;
        case 'popularity':
          query = query.order('likes_count', { ascending: false });
          break;
        case 'rating':
          query = query.order('likes_count', { ascending: false })
                     .order('dislikes_count', { ascending: true });
          break;
        case 'downloads':
          query = query.order('download_count', { ascending: false });
          break;
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching CSS files:', error);
        return;
      }

      setCSSFiles(data || []);
    } catch (error) {
      console.error('Error fetching CSS files:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAllTags = async () => {
    try {
      const { data, error } = await supabase
        .from('css_files')
        .select('tags');

      if (error) {
        console.error('Error fetching tags:', error);
        return;
      }

      // Extract unique tags
      const uniqueTags = new Set<string>();
      data?.forEach(file => {
        file.tags?.forEach((tag: string) => uniqueTags.add(tag));
      });

      setAllTags(Array.from(uniqueTags).sort());
    } catch (error) {
      console.error('Error fetching tags:', error);
    }
  };

  const handleSearch = () => {
    fetchCSSFiles();
  };

  const handleTagToggle = (tag: string) => {
    setSelectedTags(prev => 
      prev.includes(tag) 
        ? prev.filter(t => t !== tag)
        : [...prev, tag]
    );
  };

  const handleDownload = async (file: CSSFile) => {
    try {
      // Increment download count
      await supabase
        .from('css_files')
        .update({ download_count: file.download_count + 1 })
        .eq('id', file.id);

      // Create download link
      const link = document.createElement('a');
      link.href = file.file_url;
      link.download = `${file.title}.css`;
      link.click();
    } catch (error) {
      console.error('Error downloading file:', error);
    }
  };
const getSortIcon = (sort: SortBy) => {
  switch (sort) {
    case 'date':
      return <Calendar className="w-4 h-4 text-inherit" />;
    case 'popularity':
      return <ThumbsUp className="w-4 h-4 text-inherit" />;
    case 'rating':
      return <Star className="w-4 h-4 text-inherit" />;
    case 'downloads': // ✅ fixed
      return <TrendingUp className="w-4 h-4 text-inherit" />;
    default:
      return null;
  }
};


  const isVideoUrl = (url: string) => {
    const videoExtensions = ['.mp4', '.webm', '.ogg', '.avi', '.mov'];
    return videoExtensions.some(ext => url.toLowerCase().includes(ext));
  };

  if (!isLoaded) {
    return (
      <div className="min-h-screen  flex items-center justify-center">
        <div className="text-white text-lg">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen ">
      {/* Header */}
      <div className="bg-black bg-opacity-50 border-b border-purple-500">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Link href="/" className="text-2xl font-bold text-white hover:text-purple-300">
                TinChat
              </Link>
              <span className="text-purple-300 text-sm">CSS Browser</span>
            </div>
            
            <div className="flex items-center space-x-4">
              {user ? (
                <div className="flex items-center space-x-3">
                  <div className="flex items-center space-x-2">
                    {user.imageUrl && (
                      <img
                        src={user.imageUrl}
                        alt={user.username || 'User'}
                        width={32}
                        height={32}
                        className="rounded-full"
                      />
                    )}
                    <span className="text-white text-sm font-medium">
                      {user.fullName || user.username || 'User'}
                    </span>
                  </div>
                  <AuthButtons />
                </div>
              ) : (
                <div className="text-white text-sm">
                  <span className="mr-2">Please log in to upload CSS files</span>
                  <AuthButtons />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
    <div className="bg-black bg-opacity-60">
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Navigation */}
        <div className="mb-8">
          <div className="flex space-x-1 bg-black bg-opacity-30 rounded-lg p-1">
            <button
              className="px-4 py-2 flex items-center space-x-2 transition-colors bg-purple-500 text-white"
            >
              <Home className="w-4 h-4" />
              <span>Home</span>
            </button>
            {user && (
              <Link href="/css-browser/upload">
                <button
                  className="px-4 py-2  flex items-center space-x-2 transition-colors text-purple-300 hover:bg-purple-800 hover:text-white"
                >
                  <Upload className="w-4 h-4" />
                  <span>Upload</span>
                </button>
              </Link>
            )}
          </div>
        </div>

        {/* Search and Filters */}
        <div className="mb-8 space-y-4">
          {/* Search Bar */}
          <div className="flex space-x-2">
            <div className="flex-1 relative">

        <input
        type="text"
        placeholder="Search by title, author, or tags..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
        className="bg-black bg-opacity-30 text-white placeholder-gray-500 border-purple-500 w-full px-4 py-2 border"
        />


        </div>
        <button
        onClick={handleSearch}
        className="px-4 py-2 text-black hover:text-white hover:bg-purple-700 transition-colors duration-200"
        >
        Search
        </button>

          </div>

        {/* Filters and Sort */}
        <div className="w-full flex ">
        <div className="flex flex-wrap gap-4 items-center">
            {/* Type Filter */}
            <div className="flex items-center space-x-2">
            <Filter className="w-4 h-4 text-purple-300" />
            <select
                value={filterBy}
                onChange={(e) => setFilterBy(e.target.value as FilterBy)}
                className="bg-black bg-opacity-30 text-white border border-purple-500 "
            >
                <option value="all">All Types</option>
                <option value="profile">Profile CSS</option>
                <option value="chat_theme">Chat Theme</option>
            </select>
            </div>

            {/* Sort */}
            <div className="flex items-center space-x-2">
            <span className="text-purple-300 text-sm">Sort by:</span>
            <div className="flex  space-x-1">
        {(['date', 'popularity', 'rating', 'downloads'] as SortBy[]).map((sort) => (
        <button
            key={sort}
            onClick={() => setSortBy(sort)}
            className={`px-3 py-1 flex items-center space-x-1 text-sm transition-colors ${
            sortBy === sort
                ? 'bg-black-600 text-purple-500'
                : 'text-black hover:bg-purple-800 hover:text-purple-200'
            }`}
        >
            {getSortIcon(sort)}
            <span className="capitalize">{sort}</span>
        </button>
        ))}

            </div>
            </div>
        </div>
        </div>


          {/* Tags Filter */}
          {allTags.length > 0 && (
            <div>
              <h3 className="text-purple-300 text-sm mb-2">Filter by tags:</h3>
              <div className="flex flex-wrap gap-2">
                {allTags.map(tag => (
                  <button
                    key={tag}
                    onClick={() => handleTagToggle(tag)}
                    className={`px-3 py-1  text-sm transition-colors ${
                      selectedTags.includes(tag)
                        ? 'bg-purple-600 text-white'
                        : 'bg-black bg-opacity-30 text-purple-300 hover:bg-purple-800 hover:text-white'
                    }`}
                  >
                    #{tag}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* CSS Files Grid */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-4 border-white-600 border-t-transparent  animate-spin"></div>
          </div>
        ) : cssFiles.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-purple-300 text-lg mb-4">
              {searchQuery || filterBy !== 'all' || selectedTags.length > 0 
                ? 'No CSS files match your search criteria' 
                : 'No CSS files uploaded yet'}
            </div>
            {user && (
              <Link href="/css-browser/upload">
                <button className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-3  flex items-center space-x-2 mx-auto">
                  <Upload className="w-5 h-5" />
                  <span>Upload the First CSS File</span>
                </button>
              </Link>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {cssFiles.map((file) => (
              <div key={file.id} className="bg-black bg-opacity-40 rounded-lg border border-purple-500 overflow-hidden hover:border-purple-400 transition-colors">
                {/* Preview Image/Video */}
                <div className="relative aspect-video bg-gray-800">
                  {file.preview_image_urls && file.preview_image_urls.length > 0 ? (
                    <>
                      {isVideoUrl(file.preview_image_urls[0]) ? (
                        <div className="relative w-full h-full">
                          <video
                            src={file.preview_image_urls[0]}
                            className="w-full h-full object-cover"
                            muted
                            loop
                          />
                          <div className="absolute inset-0 bg-black bg-opacity-30 flex items-center justify-center">
                            <Play className="w-12 h-12 text-white opacity-80" />
                          </div>
                        </div>
                      ) : (
                        <img
                          src={file.preview_image_urls[0]}
                          alt={file.title}
                          className="w-full h-full object-cover"
                        />
                      )}
                      {file.preview_image_urls.length > 1 && (
                        <div className="absolute top-2 right-2 bg-black bg-opacity-70 text-white px-2 py-1 rounded text-xs">
                          +{file.preview_image_urls.length - 1} more
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-purple-300">
                      <div className="text-center">
                        <div className="text-4xl mb-2">📄</div>
                        <div className="text-sm">No Preview</div>
                      </div>
                    </div>
                  )}
                  
                  {/* File Type Badge */}
                  <div className="absolute top-2 left-2">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                        file.file_type === 'profile' 
                        ? 'bg-black bg-opacity-20 text-white' 
                        : 'bg-green-600 text-white'
                    }`}>
                      {file.file_type === 'profile' ? 'Profile' : 'Chat Theme'}
                    </span>
                  </div>
                </div>

                {/* Content */}
                <div className="p-4">
                  <h3 className="text-white font-bold text-lg mb-2 truncate">{file.title}</h3>
                  
                  <div className="flex items-center space-x-2 text-purple-300 text-sm mb-3">
                    <User className="w-4 h-4" />
                    <span>{file.author_display_name || file.author_username}</span>
                    <span>•</span>
                    <Calendar className="w-4 h-4" />
                    <span>{new Date(file.created_at).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric'
                    })}</span>
                  </div>

                  {/* Tags */}
                  {file.tags && file.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-3">
                      {file.tags.slice(0, 3).map(tag => (
                        <span
                          key={tag}
                          className="bg-purple-800 text-purple-200 px-2 py-1 rounded text-xs"
                        >
                          #{tag}
                        </span>
                      ))}
                      {file.tags.length > 3 && (
                        <span className="text-purple-400 text-xs">
                          +{file.tags.length - 3} more
                        </span>
                      )}
                    </div>
                  )}

                  {/* Stats */}
                  <div className="flex items-center justify-between text-sm text-purple-300 mb-4">
                    <div className="flex items-center space-x-4">
                      <div className="flex items-center space-x-1">
                        <ThumbsUp className="w-4 h-4" />
                        <span>{file.likes_count}</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <ThumbsDown className="w-4 h-4" />
                        <span>{file.dislikes_count}</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <Download className="w-4 h-4" />
                        <span>{file.download_count}</span>
                      </div>
                    </div>
                    <div className="text-xs">
                      Score: {file.likes_count - file.dislikes_count}
                    </div>
                  </div>

{/* Actions */}
<div className="flex space-x-2">
  {/* Download Button First */}
  <button 
    onClick={() => handleDownload(file)}
    className="border px-3 py-2 flex items-center space-x-2 text-black hover:text-white hover:bg-purple-800 transition-colors duration-200"
  >
    <Download className="w-4 h-4" />
    <span>Download</span>
  </button>

  {/* View Button Second */}
  <Link href={`/css-browser/${file.id}`} className="flex-1">
    <button className="w-full text-black px-3 py-2 flex items-center justify-center space-x-2 hover:text-white hover:bg-purple-800 transition-colors duration-200">
      <Eye className="w-4 h-4" />
      <span>View</span>
    </button>
  </Link>
</div>


                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
    </div>
  );
}