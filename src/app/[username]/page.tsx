// src/app/[username]/page.tsx - Updated with CSS contributions
import { notFound } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import Link from 'next/link';
import Image from 'next/image';
import { Calendar, FileText, ThumbsUp, Download } from 'lucide-react';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Next.js 15 requires params to be awaited
interface PageProps {
  params: Promise<{ username: string }>;
}

interface UserProfile {
  id: string;
  clerk_id: string;
  username: string;
  display_name: string;
  avatar_url?: string;
  banner_url?: string;
  bio?: string;
  created_at: string;
}

interface CSSFile {
  id: string;
  title: string;
  file_type: 'profile' | 'chat_theme';
  preview_image_url?: string;
  likes_count: number;
  download_count: number;
  created_at: string;
  tags: string[];
}

async function getUserProfile(username: string): Promise<UserProfile | null> {
  const { data: user, error } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('username', username.toLowerCase())
    .single();

  if (error || !user) {
    return null;
  }

  return user;
}

async function getUserCSSFiles(clerkId: string): Promise<CSSFile[]> {
  const { data: files, error } = await supabase
    .from('css_files')
    .select('id, title, file_type, preview_image_url, likes_count, download_count, created_at, tags')
    .eq('author_id', clerkId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching user CSS files:', error);
    return [];
  }

  return files || [];
}

export default async function UserProfilePage({ params }: PageProps) {
  const { username } = await params;
  
  const user = await getUserProfile(username);
  
  if (!user) {
    return notFound();
  }

  const cssFiles = await getUserCSSFiles(user.clerk_id);
  
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const totalLikes = cssFiles.reduce((sum, file) => sum + file.likes_count, 0);
  const totalDownloads = cssFiles.reduce((sum, file) => sum + file.download_count, 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900">
      {/* Header */}
      <div className="bg-black bg-opacity-50 border-b border-purple-500">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center space-x-4">
            <Link href="/css-browser" className="text-purple-300 hover:text-purple-200">
              ← Back to CSS Browser
            </Link>
            <span className="text-white text-lg font-semibold">User Profile</span>
          </div>
        </div>
      </div>

      {/* Profile Container */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Profile Header */}
        <div className="bg-black bg-opacity-40 rounded-lg overflow-hidden border border-purple-500 mb-8">
          {/* Banner */}
          <div className="h-48 bg-gradient-to-r from-purple-800 to-indigo-800 relative">
            {user.banner_url && (
              <Image
                src={user.banner_url}
                alt="Profile banner"
                fill
                className="object-cover"
              />
            )}
            <div className="absolute inset-0 bg-black bg-opacity-30"></div>
          </div>

          {/* Profile Info */}
          <div className="relative px-6 py-6">
            <div className="flex items-start space-x-6">
              {/* Avatar */}
              <div className="relative -mt-16 z-10">
                <div className="w-32 h-32 rounded-full border-4 border-purple-500 bg-black bg-opacity-50 flex items-center justify-center overflow-hidden">
                  {user.avatar_url ? (
                    <Image
                      src={user.avatar_url}
                      alt={`${user.username}'s avatar`}
                      width={128}
                      height={128}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="text-white text-4xl font-bold">
                      {user.display_name?.charAt(0) || user.username?.charAt(0) || 'U'}
                    </div>
                  )}
                </div>
              </div>

              {/* User Info */}
              <div className="flex-1 pt-4">
                <h1 className="text-3xl font-bold text-white mb-2">
                  {user.display_name || user.username}
                </h1>
                <p className="text-purple-300 text-lg mb-4">@{user.username}</p>
                
                {user.bio && (
                  <p className="text-gray-300 mb-4 leading-relaxed">
                    {user.bio}
                  </p>
                )}

                <div className="flex items-center space-x-6 text-sm text-purple-300">
                  <div className="flex items-center space-x-1">
                    <Calendar className="w-4 h-4" />
                    <span>Joined {formatDate(user.created_at)}</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <FileText className="w-4 h-4" />
                    <span>{cssFiles.length} CSS files</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <ThumbsUp className="w-4 h-4" />
                    <span>{totalLikes} likes</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <Download className="w-4 h-4" />
                    <span>{totalDownloads} downloads</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* CSS Files Section */}
        <div className="bg-black bg-opacity-40 rounded-lg p-6 border border-purple-500">
          <h2 className="text-2xl font-bold text-white mb-6 flex items-center space-x-2">
            <FileText className="w-6 h-6" />
            <span>CSS Contributions</span>
          </h2>

          {cssFiles.length === 0 ? (
            <div className="text-center py-12 text-purple-300">
              <FileText className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <p className="text-lg">No CSS files uploaded yet</p>
              <p className="text-sm mt-2">This user hasn't shared any CSS files with the community.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {cssFiles.map(file => (
                <Link
                  key={file.id}
                  href={`/css-browser/${file.id}`}
                  className="group bg-black bg-opacity-30 rounded-lg overflow-hidden border border-purple-600 hover:border-purple-400 transition-all duration-200 hover:transform hover:scale-105"
                >
                  {/* Preview Image */}
                  <div className="relative aspect-video bg-gray-800">
                    {file.preview_image_url ? (
                      <Image
                        src={file.preview_image_url}
                        alt={file.title}
                        fill
                        className="object-cover"
                      />
                    ) : (
                      <div className="flex items-center justify-center h-full text-gray-500">
                        <FileText className="w-12 h-12" />
                      </div>
                    )}
                    
                    {/* Type Badge */}
                    <div className="absolute top-2 left-2">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        file.file_type === 'profile' 
                          ? 'bg-blue-600 text-white' 
                          : 'bg-green-600 text-white'
                      }`}>
                        {file.file_type === 'profile' ? 'Profile' : 'Chat Theme'}
                      </span>
                    </div>

                    {/* Stats Overlay */}
                    <div className="absolute bottom-2 right-2 bg-black bg-opacity-70 text-white px-2 py-1 rounded text-xs flex items-center space-x-2">
                      <div className="flex items-center space-x-1">
                        <ThumbsUp className="w-3 h-3" />
                        <span>{file.likes_count}</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <Download className="w-3 h-3" />
                        <span>{file.download_count}</span>
                      </div>
                    </div>
                  </div>

                  {/* File Info */}
                  <div className="p-4">
                    <h3 className="text-white font-semibold mb-2 group-hover:text-purple-300 transition-colors">
                      {file.title}
                    </h3>
                    
                    <div className="text-purple-300 text-sm mb-2">
                      {formatDate(file.created_at)}
                    </div>

                    {/* Tags */}
                    {file.tags && file.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {file.tags.slice(0, 3).map(tag => (
                          <span
                            key={tag}
                            className="bg-purple-800 text-purple-200 px-2 py-0.5 rounded-full text-xs"
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
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}