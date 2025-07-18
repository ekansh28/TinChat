// src/app/[username]/page.tsx - Complete MySpace-Style Profile Page
'use client';

import { useState, useEffect } from 'react';
import { notFound } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import Link from 'next/link';
import Image from 'next/image';
import { useUser } from '@clerk/nextjs';
import { 
  Calendar, 
  FileText, 
  ThumbsUp, 
  Download, 
  Music, 
  MessageCircle, 
  Users, 
  Settings, 
  Palette, 
  X,
  Save,
  Eye,
  Code,
  Sparkles,
  Heart,
  Star,
  Play,
  Pause,
  Volume2,
  UserPlus,
  Mail,
  Camera,
  Globe,
  MapPin,
  Gift,
  Zap
} from 'lucide-react';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

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
  myspace_css?: string;
  myspace_song?: string;
  myspace_mood?: string;
  myspace_status?: string;
  myspace_top_friends?: string[];
  myspace_interests?: string[];
  myspace_about_me?: string;
  myspace_who_id_like_to_meet?: string;
  myspace_layout_style?: 'classic' | 'glitter' | 'emo' | 'scene';
  myspace_profile_views?: number;
  myspace_last_login?: string;
  myspace_location?: string;
  myspace_age?: number;
  myspace_relationship_status?: string;
}

interface CSSFile {
  id: string;
  title: string;
  file_type: 'profile' | 'chat_theme';
  preview_image_urls?: string[];
  likes_count: number;
  download_count: number;
  created_at: string;
  tags: string[];
}

// MySpace-style default layouts
const MYSPACE_LAYOUTS = {
  classic: {
    name: 'Classic Blue',
    background: 'linear-gradient(135deg, #4169E1 0%, #87CEEB 50%, #4169E1 100%)',
    containerBg: 'rgba(255, 255, 255, 0.95)',
    textColor: '#000000',
    linkColor: '#0066CC',
    accentColor: '#FF6600',
    borderColor: '#4169E1'
  },
  glitter: {
    name: 'Pink Glitter',
    background: 'linear-gradient(45deg, #FF1493 0%, #FF69B4 25%, #DA70D6 50%, #FF1493 75%, #FF69B4 100%)',
    containerBg: 'rgba(255, 255, 255, 0.9)',
    textColor: '#8B008B',
    linkColor: '#FF1493',
    accentColor: '#FFD700',
    borderColor: '#FF1493'
  },
  emo: {
    name: 'Emo Dark',
    background: 'linear-gradient(135deg, #000000 0%, #2C2C2C 50%, #8B0000 100%)',
    containerBg: 'rgba(40, 40, 40, 0.95)',
    textColor: '#FFFFFF',
    linkColor: '#FF0000',
    accentColor: '#8B0000',
    borderColor: '#FF0000'
  },
  scene: {
    name: 'Scene Neon',
    background: 'linear-gradient(45deg, #FF00FF 0%, #00FFFF 25%, #FFFF00 50%, #FF00FF 75%, #00FFFF 100%)',
    containerBg: 'rgba(0, 0, 0, 0.85)',
    textColor: '#FFFFFF',
    linkColor: '#00FF00',
    accentColor: '#FF00FF',
    borderColor: '#00FF00'
  }
};

// Fun MySpace-style comments
const MYSPACE_COMMENTS = [
  "OMG your profile is so cool! 💕",
  "Thanks for the add! Your CSS is amazing! ✨",
  "Love your music taste! 🎵",
  "Your profile layout is fire! 🔥",
  "Can't wait to see your next CSS creation! 🎨",
  "Your profile gives me major 2000s vibes! 💜"
];

export default function UserProfilePage({ params }: PageProps) {
  const { user: currentUser } = useUser();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [cssFiles, setCSSFiles] = useState<CSSFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [customizeMode, setCustomizeMode] = useState(false);
  const [showCSSEditor, setShowCSSEditor] = useState(false);
  const [customCSS, setCustomCSS] = useState('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentUsername, setCurrentUsername] = useState('');
  const [profileData, setProfileData] = useState({
    myspace_song: '',
    myspace_mood: '',
    myspace_status: '',
    myspace_about_me: '',
    myspace_who_id_like_to_meet: '',
    myspace_interests: [] as string[],
    myspace_layout_style: 'classic' as keyof typeof MYSPACE_LAYOUTS,
    myspace_location: '',
    myspace_age: 0,
    myspace_relationship_status: ''
  });

  useEffect(() => {
    const fetchParams = async () => {
      const resolvedParams = await params;
      setCurrentUsername(resolvedParams.username);
      await fetchProfile(resolvedParams.username);
    };
    fetchParams();
  }, [params]);

  const fetchProfile = async (username: string) => {
    try {
      const { data: user, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('username', username.toLowerCase())
        .single();

      if (error || !user) {
        return notFound();
      }

      setProfile(user);
      setCustomCSS(user.myspace_css || '');
      setProfileData({
        myspace_song: user.myspace_song || '',
        myspace_mood: user.myspace_mood || '😊',
        myspace_status: user.myspace_status || 'Living my best life!',
        myspace_about_me: user.myspace_about_me || user.bio || '',
        myspace_who_id_like_to_meet: user.myspace_who_id_like_to_meet || 'Cool people who share my interests!',
        myspace_interests: user.myspace_interests || ['Music', 'Art', 'Technology'],
        myspace_layout_style: user.myspace_layout_style || 'classic',
        myspace_location: user.myspace_location || '',
        myspace_age: user.myspace_age || 0,
        myspace_relationship_status: user.myspace_relationship_status || 'Single'
      });

      // Fetch CSS files
      const { data: files } = await supabase
        .from('css_files')
        .select('*')
        .eq('author_id', user.clerk_id)
        .order('created_at', { ascending: false });

      setCSSFiles(files || []);

      // Increment profile views (if not own profile)
      if (currentUser && currentUser.id !== user.clerk_id) {
        await supabase
          .from('user_profiles')
          .update({ myspace_profile_views: (user.myspace_profile_views || 0) + 1 })
          .eq('clerk_id', user.clerk_id);
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveProfile = async () => {
    if (!profile || !currentUser || currentUser.id !== profile.clerk_id) return;

    try {
      const { error } = await supabase
        .from('user_profiles')
        .update({
          myspace_css: customCSS,
          ...profileData
        })
        .eq('clerk_id', currentUser.id);

      if (error) throw error;

      setProfile(prev => prev ? { ...prev, myspace_css: customCSS, ...profileData } : null);
      setCustomizeMode(false);
      setShowCSSEditor(false);
      
      // Show success message
      const toast = document.createElement('div');
      toast.className = 'fixed top-4 right-4 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg z-50';
      toast.textContent = 'Profile updated successfully! ✨';
      document.body.appendChild(toast);
      setTimeout(() => document.body.removeChild(toast), 3000);
    } catch (error) {
      console.error('Error saving profile:', error);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatDateShort = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const isOwner = currentUser && profile && currentUser.id === profile.clerk_id;
  const currentLayout = MYSPACE_LAYOUTS[profileData.myspace_layout_style];

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center">
        <div className="text-white text-lg flex items-center space-x-2">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
          <span>Loading profile...</span>
        </div>
      </div>
    );
  }

  if (!profile) {
    return notFound();
  }

  const totalLikes = cssFiles.reduce((sum, file) => sum + file.likes_count, 0);
  const totalDownloads = cssFiles.reduce((sum, file) => sum + file.download_count, 0);

  return (
    <div 
      className="min-h-screen myspace-profile"
      style={{
        background: customCSS ? undefined : currentLayout.background,
        fontFamily: 'Arial, sans-serif'
      }}
    >
      {/* Apply custom CSS */}
      {customCSS && (
        <style dangerouslySetInnerHTML={{ __html: customCSS }} />
      )}

      {/* MySpace-style Header */}
      <div className="bg-white border-b-4 border-blue-600 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-6">
              <Link href="/css-browser" className="text-blue-600 hover:text-blue-800 font-bold text-sm">
                « Back to CSS Browser
              </Link>
              <div className="text-2xl font-bold text-blue-800">
                {profile.display_name || profile.username}'s Profile
              </div>
              <div className="bg-yellow-200 px-2 py-1 rounded text-xs font-bold text-gray-700">
                {profile.myspace_profile_views || 0} profile views
              </div>
            </div>
            
            {isOwner && (
              <div className="flex items-center space-x-3">
                <button
                  onClick={() => setCustomizeMode(!customizeMode)}
                  className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded font-bold text-sm flex items-center space-x-2 shadow-lg"
                >
                  <Settings className="w-4 h-4" />
                  <span>Customize</span>
                </button>
                <button
                  onClick={() => setShowCSSEditor(!showCSSEditor)}
                  className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded font-bold text-sm flex items-center space-x-2 shadow-lg"
                >
                  <Code className="w-4 h-4" />
                  <span>CSS Editor</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* CSS Editor Modal */}
      {showCSSEditor && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-4xl w-full max-h-[80vh] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-2xl font-bold text-gray-800 flex items-center space-x-2">
                <Code className="w-6 h-6" />
                <span>Custom CSS Editor</span>
              </h3>
              <button
                onClick={() => setShowCSSEditor(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="mb-4">
              <p className="text-sm text-gray-600 mb-2">
                Write your custom CSS to completely customize your profile! You can target the main container with <code className="bg-gray-100 px-1 rounded">.myspace-profile</code>
              </p>
              <div className="bg-blue-50 p-3 rounded mb-3">
                <p className="text-sm text-blue-800 font-medium">💡 Pro Tips:</p>
                <ul className="text-xs text-blue-700 mt-1 space-y-1">
                  <li>• Use <code>.profile-container</code> to style individual sections</li>
                  <li>• Add <code>.profile-name</code> to style your name</li>
                  <li>• Create animations with <code>@keyframes</code></li>
                  <li>• Use <code>background-image</code> for custom backgrounds</li>
                </ul>
              </div>
              <textarea
                value={customCSS}
                onChange={(e) => setCustomCSS(e.target.value)}
                className="w-full h-64 p-3 border border-gray-300 rounded font-mono text-sm resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder={`/* Example CSS - Make it your own! */
.myspace-profile {
  background: linear-gradient(45deg, #ff6b6b, #4ecdc4);
  background-size: 400% 400%;
  animation: gradientShift 10s ease infinite;
}

@keyframes gradientShift {
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}

.profile-container {
  background: rgba(255, 255, 255, 0.9);
  border: 3px solid #ff6b6b;
  border-radius: 15px;
  box-shadow: 0 0 20px rgba(255, 107, 107, 0.5);
}

.profile-name {
  color: #ff6b6b;
  text-shadow: 2px 2px 4px rgba(0,0,0,0.5);
  font-size: 2rem;
}

/* Add glitter animation */
@keyframes glitter {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.5; transform: scale(1.2); }
}

.glitter {
  animation: glitter 1s infinite;
}

/* Neon glow effect */
.neon {
  text-shadow: 0 0 5px #ff00ff, 0 0 10px #ff00ff, 0 0 15px #ff00ff;
}

/* Rotating background */
.rotating-bg {
  background: conic-gradient(from 0deg, #ff00ff, #00ffff, #ffff00, #ff00ff);
  animation: rotate 10s linear infinite;
}

@keyframes rotate {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}`}
              />
            </div>
            
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowCSSEditor(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 font-medium"
              >
                Cancel
              </button>
              <button
                onClick={saveProfile}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded font-bold flex items-center space-x-2 shadow-lg"
              >
                <Save className="w-4 h-4" />
                <span>Save CSS</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Sidebar */}
          <div className="lg:col-span-3 space-y-6">
            {/* Profile Picture & Basic Info */}
            <div 
              className="profile-container p-4 rounded-lg shadow-lg"
              style={{
                backgroundColor: customCSS ? undefined : currentLayout.containerBg,
                color: customCSS ? undefined : currentLayout.textColor,
                border: customCSS ? undefined : `3px solid ${currentLayout.borderColor}`
              }}
            >
              <div className="text-center">
                <div className="relative inline-block mb-4">
                  <div className="w-32 h-32 rounded-lg overflow-hidden shadow-lg relative"
                       style={{ border: `4px solid ${currentLayout.accentColor}` }}>
                    {profile.avatar_url ? (
                      <Image
                        src={profile.avatar_url}
                        alt={`${profile.username}'s avatar`}
                        width={128}
                        height={128}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-pink-400 to-purple-600 flex items-center justify-center text-white text-4xl font-bold">
                        {profile.display_name?.charAt(0) || profile.username?.charAt(0) || 'U'}
                      </div>
                    )}
                  </div>
                  <div className="absolute -top-2 -right-2 bg-yellow-400 rounded-full p-1 shadow-lg">
                    <Star className="w-4 h-4 text-yellow-600" />
                  </div>
                  {isOwner && (
                    <div className="absolute bottom-0 right-0 bg-blue-500 rounded-full p-1 shadow-lg">
                      <Camera className="w-3 h-3 text-white" />
                    </div>
                  )}
                </div>
                
                <h1 className="profile-name text-2xl font-bold mb-1" 
                    style={{ color: customCSS ? undefined : currentLayout.linkColor }}>
                  {profile.display_name || profile.username}
                </h1>
                <p className="text-sm opacity-75 mb-2 italic">"{profileData.myspace_status}"</p>
                <div className="flex items-center justify-center space-x-2 mb-2">
                  <span className="text-lg">Mood:</span>
                  <span className="text-xl">{profileData.myspace_mood}</span>
                </div>
                
                {/* Additional Info */}
                <div className="text-xs space-y-1 mb-4 opacity-75">
                  {profileData.myspace_age > 0 && (
                    <div>{profileData.myspace_age} years old</div>
                  )}
                  {profileData.myspace_location && (
                    <div className="flex items-center justify-center space-x-1">
                      <MapPin className="w-3 h-3" />
                      <span>{profileData.myspace_location}</span>
                    </div>
                  )}
                  <div>{profileData.myspace_relationship_status}</div>
                </div>
                
                <div className="flex justify-center space-x-2 mb-4">
                  <div className="bg-blue-100 px-2 py-1 rounded text-xs font-bold">
                    <span className="text-blue-800">{cssFiles.length}</span> CSS files
                  </div>
                  <div className="bg-red-100 px-2 py-1 rounded text-xs font-bold">
                    <span className="text-red-800">{totalLikes}</span> likes
                  </div>
                  <div className="bg-green-100 px-2 py-1 rounded text-xs font-bold">
                    <span className="text-green-800">{totalDownloads}</span> downloads
                  </div>
                </div>

                {!isOwner && (
                  <div className="flex space-x-2">
                    <button className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm font-bold flex items-center space-x-1 shadow-lg">
                      <UserPlus className="w-3 h-3" />
                      <span>Add Friend</span>
                    </button>
                    <button className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-sm font-bold flex items-center space-x-1 shadow-lg">
                      <Mail className="w-3 h-3" />
                      <span>Message</span>
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Music Player */}
            <div 
              className="profile-container p-4 rounded-lg shadow-lg"
              style={{
                backgroundColor: customCSS ? undefined : currentLayout.containerBg,
                color: customCSS ? undefined : currentLayout.textColor,
                border: customCSS ? undefined : `3px solid ${currentLayout.accentColor}`
              }}
            >
              <h3 className="font-bold text-lg mb-3 flex items-center space-x-2">
                <Music className="w-5 h-5" />
                <span>Music</span>
              </h3>
              {profileData.myspace_song ? (
                <div className="bg-gray-100 p-3 rounded border shadow-inner">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-medium text-gray-700">🎵 Now Playing:</p>
                    <button
                      onClick={() => setIsPlaying(!isPlaying)}
                      className="text-blue-600 hover:text-blue-800"
                    >
                      {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                    </button>
                  </div>
                  <p className="font-bold text-gray-800 mb-2">{profileData.myspace_song}</p>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: isPlaying ? '65%' : '0%' }}
                    ></div>
                  </div>
                  <div className="flex justify-between items-center mt-2">
                    <span className="text-xs text-gray-500">1:23</span>
                    <Volume2 className="w-4 h-4 text-gray-500" />
                    <span className="text-xs text-gray-500">3:45</span>
                  </div>
                </div>
              ) : (
                <div className="text-center py-4">
                  <Music className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p className="text-sm italic">No song selected</p>
                </div>
              )}
            </div>

            {/* Online Status */}
            <div 
              className="profile-container p-4 rounded-lg shadow-lg"
              style={{
                backgroundColor: customCSS ? undefined : currentLayout.containerBg,
                color: customCSS ? undefined : currentLayout.textColor,
                border: customCSS ? undefined : `3px solid #10B981`
              }}
            >
              <h3 className="font-bold text-lg mb-3 flex items-center space-x-2">
                <Globe className="w-5 h-5" />
                <span>Status</span>
              </h3>
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                  <span className="text-sm font-medium">Online</span>
                </div>
                <p className="text-xs opacity-75">Last login: {formatDateShort(profile.created_at)}</p>
                <p className="text-xs opacity-75">Member since: {formatDateShort(profile.created_at)}</p>
              </div>
            </div>

            {/* Contact Info */}
            <div 
              className="profile-container p-4 rounded-lg shadow-lg"
              style={{
                backgroundColor: customCSS ? undefined : currentLayout.containerBg,
                color: customCSS ? undefined : currentLayout.textColor,
                border: customCSS ? undefined : `3px solid ${currentLayout.linkColor}`
              }}
            >
              <h3 className="font-bold text-lg mb-3">Contact Info</h3>
              <div className="space-y-2 text-sm">
                <div className="flex items-center space-x-2">
                  <Mail className="w-4 h-4" />
                  <span>Send Message</span>
                </div>
                <div className="flex items-center space-x-2">
                  <UserPlus className="w-4 h-4" />
                  <span>Add to Friends</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Heart className="w-4 h-4" />
                  <span>Add to Favorites</span>
                </div>
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-9 space-y-6">
            {/* About Me */}
            <div 
              className="profile-container p-6 rounded-lg shadow-lg"
              style={{
                backgroundColor: customCSS ? undefined : currentLayout.containerBg,
                color: customCSS ? undefined : currentLayout.textColor,
                border: customCSS ? undefined : `3px solid ${currentLayout.accentColor}`
              }}
            >
              <h2 className="text-2xl font-bold mb-4 flex items-center space-x-2">
                <Sparkles className="w-6 h-6" />
                <span>About Me</span>
              </h2>
              <div className="prose max-w-none">
                <p className="text-base leading-relaxed whitespace-pre-wrap">
                  {profileData.myspace_about_me || 'This person is mysterious and hasn\'t shared much about themselves yet... 🤔'}
                </p>
              </div>
            </div>

            {/* Who I'd Like to Meet */}
            <div 
              className="profile-container p-6 rounded-lg shadow-lg"
              style={{
                backgroundColor: customCSS ? undefined : currentLayout.containerBg,
                color: customCSS ? undefined : currentLayout.textColor,
                border: customCSS ? undefined : `3px solid ${currentLayout.linkColor}`
              }}
            >
              <h2 className="text-2xl font-bold mb-4 flex items-center space-x-2">
                <Users className="w-6 h-6" />
                <span>Who I'd Like to Meet</span>
              </h2>
              <p className="text-base leading-relaxed">
                {profileData.myspace_who_id_like_to_meet}
              </p>
            </div>

            {/* Interests */}
            <div 
              className="profile-container p-6 rounded-lg shadow-lg"
              style={{
                backgroundColor: customCSS ? undefined : currentLayout.containerBg,
                color: customCSS ? undefined : currentLayout.textColor,
                border: customCSS ? undefined : `3px solid #06B6D4`
              }}
            >
              <h2 className="text-2xl font-bold mb-4 flex items-center space-x-2">
                <Zap className="w-6 h-6" />
                <span>Interests</span>
              </h2>
              <div className="flex flex-wrap gap-2">
                {profileData.myspace_interests.map((interest, index) => (
                  <span
                    key={index}
                    className="bg-gradient-to-r from-purple-500 to-pink-500 text-white px-3 py-1 rounded-full text-sm font-bold shadow-lg hover:scale-105 transition-transform"
                  >
                    {interest}
                  </span>
                ))}
              </div>
            </div>

{/* Comments Section */}
            <div 
              className="profile-container p-6 rounded-lg shadow-lg"
              style={{
                backgroundColor: customCSS ? undefined : currentLayout.containerBg,
                color: customCSS ? undefined : currentLayout.textColor,
                border: customCSS ? undefined : `3px solid ${currentLayout.accentColor}`
              }}
            >
              <h2 className="text-2xl font-bold mb-4 flex items-center space-x-2">
                <MessageCircle className="w-6 h-6" />
                <span>Comments</span>
                <span className="bg-red-500 text-white px-2 py-1 rounded-full text-sm">
                  {MYSPACE_COMMENTS.length}
                </span>
              </h2>
              
              {/* Add Comment Form */}
              {!isOwner && (
                <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                  <h3 className="font-bold text-gray-800 mb-2">Leave a Comment</h3>
                  <textarea
                    className="w-full p-3 border border-gray-300 rounded text-gray-800 resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    rows={3}
                    placeholder="Write something nice..."
                  />
                  <div className="flex justify-end mt-2">
                    <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded font-bold text-sm shadow-lg">
                      Post Comment
                    </button>
                  </div>
                </div>
              )}
              
              {/* Sample Comments */}
              <div className="space-y-4">
                {MYSPACE_COMMENTS.map((comment, index) => (
                  <div key={index} className="bg-white p-4 rounded-lg shadow border-l-4 border-blue-500">
                    <div className="flex items-start space-x-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-pink-400 to-purple-600 flex items-center justify-center text-white font-bold">
                        {String.fromCharCode(65 + index)}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-1">
                          <span className="font-bold text-gray-800">Friend{index + 1}</span>
                          <span className="text-xs text-gray-500">
                            {formatDateShort(new Date(Date.now() - index * 86400000).toISOString())}
                          </span>
                        </div>
                        <p className="text-gray-700 text-sm">{comment}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Top 8 Friends Section */}
            <div 
              className="profile-container p-6 rounded-lg shadow-lg"
              style={{
                backgroundColor: customCSS ? undefined : currentLayout.containerBg,
                color: customCSS ? undefined : currentLayout.textColor,
                border: customCSS ? undefined : `3px solid ${currentLayout.linkColor}`
              }}
            >
              <h2 className="text-2xl font-bold mb-4 flex items-center space-x-2">
                <Users className="w-6 h-6" />
                <span>Top 8 Friends</span>
              </h2>
              
              <div className="grid grid-cols-4 gap-4">
                {[1, 2, 3, 4, 5, 6, 7, 8].map((friend) => (
                  <div key={friend} className="text-center">
                    <div className="w-16 h-16 rounded-lg bg-gradient-to-br from-blue-400 to-purple-600 flex items-center justify-center text-white font-bold mb-2 mx-auto shadow-lg hover:scale-105 transition-transform cursor-pointer">
                      {friend}
                    </div>
                    <p className="text-xs font-medium">Friend {friend}</p>
                  </div>
                ))}
              </div>
              
              {isOwner && (
                <div className="mt-4 text-center">
                  <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded font-bold text-sm shadow-lg">
                    Edit Top 8
                  </button>
                </div>
              )}
            </div>

            {/* Photo Gallery */}
            <div 
              className="profile-container p-6 rounded-lg shadow-lg"
              style={{
                backgroundColor: customCSS ? undefined : currentLayout.containerBg,
                color: customCSS ? undefined : currentLayout.textColor,
                border: customCSS ? undefined : `3px solid ${currentLayout.accentColor}`
              }}
            >
              <h2 className="text-2xl font-bold mb-4 flex items-center space-x-2">
                <Camera className="w-6 h-6" />
                <span>Photo Gallery</span>
                <span className="bg-green-500 text-white px-2 py-1 rounded-full text-sm">
                  12
                </span>
              </h2>
              
              <div className="grid grid-cols-3 gap-4">
                {[1, 2, 3, 4, 5, 6].map((photo) => (
                  <div key={photo} className="relative group">
                    <div className="aspect-square bg-gradient-to-br from-pink-400 to-purple-600 rounded-lg shadow-lg overflow-hidden">
                      <div className="w-full h-full flex items-center justify-center text-white font-bold text-2xl">
                        {photo}
                      </div>
                    </div>
                    <div className="absolute inset-0 bg-black bg-opacity-50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-lg">
                      <Eye className="w-6 h-6 text-white" />
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="mt-4 text-center">
                <button className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded font-bold text-sm shadow-lg">
                  View All Photos
                </button>
              </div>
            </div>

            {/* CSS Files Gallery */}
            <div 
              className="profile-container p-6 rounded-lg shadow-lg"
              style={{
                backgroundColor: customCSS ? undefined : currentLayout.containerBg,
                color: customCSS ? undefined : currentLayout.textColor,
                border: customCSS ? undefined : `3px solid ${currentLayout.linkColor}`
              }}
            >
              <h2 className="text-2xl font-bold mb-4 flex items-center space-x-2">
                <FileText className="w-6 h-6" />
                <span>CSS Creations</span>
                <span className="bg-purple-500 text-white px-2 py-1 rounded-full text-sm">
                  {cssFiles.length}
                </span>
              </h2>

              {cssFiles.length === 0 ? (
                <div className="text-center py-12">
                  <div className="mb-4">
                    <FileText className="w-20 h-20 mx-auto opacity-50" />
                  </div>
                  <h3 className="text-xl font-bold mb-2">No CSS files yet</h3>
                  <p className="text-sm opacity-75 mb-4">
                    {isOwner 
                      ? "Start creating and sharing your awesome CSS designs!" 
                      : "Check back later for awesome CSS creations!"}
                  </p>
                  {isOwner && (
                    <Link href="/css-browser/upload">
                      <button className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded font-bold flex items-center space-x-2 mx-auto shadow-lg">
                        <FileText className="w-5 h-5" />
                        <span>Upload Your First CSS</span>
                      </button>
                    </Link>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {cssFiles.map(file => (
                    <Link
                      key={file.id}
                      href={`/css-browser/${file.id}`}
                      className="group bg-white rounded-lg overflow-hidden shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105"
                      style={{ border: `2px solid ${currentLayout.accentColor}` }}
                    >
                      <div className="relative aspect-video bg-gradient-to-br from-purple-400 to-pink-400">
                        {file.preview_image_urls && file.preview_image_urls.length > 0 ? (
                          <Image
                            src={file.preview_image_urls[0]}
                            alt={file.title}
                            fill
                            className="object-cover group-hover:scale-110 transition-transform duration-300"
                          />
                        ) : (
                          <div className="flex items-center justify-center h-full text-white">
                            <FileText className="w-12 h-12 group-hover:scale-110 transition-transform duration-300" />
                          </div>
                        )}
                        
                        <div className="absolute top-2 left-2">
                          <span className={`px-2 py-1 rounded-full text-xs font-bold shadow-lg ${
                            file.file_type === 'profile' 
                              ? 'bg-blue-600 text-white' 
                              : 'bg-green-600 text-white'
                          }`}>
                            {file.file_type === 'profile' ? 'Profile' : 'Chat'}
                          </span>
                        </div>

                        <div className="absolute bottom-2 right-2 bg-black bg-opacity-80 text-white px-2 py-1 rounded text-xs flex items-center space-x-2">
                          <div className="flex items-center space-x-1">
                            <Heart className="w-3 h-3" />
                            <span>{file.likes_count}</span>
                          </div>
                          <div className="flex items-center space-x-1">
                            <Download className="w-3 h-3" />
                            <span>{file.download_count}</span>
                          </div>
                        </div>
                      </div>

                      <div className="p-4">
                        <h3 className="font-bold text-gray-800 mb-1 group-hover:text-purple-600 transition-colors">
                          {file.title}
                        </h3>
                        <p className="text-sm text-gray-600 mb-2">
                          {formatDateShort(file.created_at)}
                        </p>
                        
                        {file.tags && file.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {file.tags.slice(0, 2).map(tag => (
                              <span
                                key={tag}
                                className="bg-purple-100 text-purple-800 px-2 py-0.5 rounded text-xs font-medium"
                              >
                                #{tag}
                              </span>
                            ))}
                            {file.tags.length > 2 && (
                              <span className="text-purple-600 text-xs font-medium">
                                +{file.tags.length - 2} more
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

            {/* Blog Posts Section */}
            <div 
              className="profile-container p-6 rounded-lg shadow-lg"
              style={{
                backgroundColor: customCSS ? undefined : currentLayout.containerBg,
                color: customCSS ? undefined : currentLayout.textColor,
                border: customCSS ? undefined : `3px solid ${currentLayout.accentColor}`
              }}
            >
              <h2 className="text-2xl font-bold mb-4 flex items-center space-x-2">
                <FileText className="w-6 h-6" />
                <span>Blog Posts</span>
                <span className="bg-orange-500 text-white px-2 py-1 rounded-full text-sm">
                  3
                </span>
              </h2>
              
              <div className="space-y-4">
                {[
                  { title: "My CSS Journey", date: "3 days ago", excerpt: "Started learning CSS and fell in love with creating beautiful designs..." },
                  { title: "New Profile Layout", date: "1 week ago", excerpt: "Just updated my profile with some sick new animations!" },
                  { title: "Web Design Tips", date: "2 weeks ago", excerpt: "Here are some tips I've learned about responsive design..." }
                ].map((post, index) => (
                  <div key={index} className="bg-white p-4 rounded-lg shadow border-l-4 border-orange-500">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="font-bold text-gray-800 mb-1">{post.title}</h3>
                        <p className="text-sm text-gray-600 mb-2">{post.excerpt}</p>
                        <div className="flex items-center space-x-4 text-xs text-gray-500">
                          <span>{post.date}</span>
                          <span>•</span>
                          <span>5 comments</span>
                          <span>•</span>
                          <span>12 likes</span>
                        </div>
                      </div>
                      <div className="ml-4">
                        <button className="text-blue-600 hover:text-blue-800 font-medium text-sm">
                          Read More
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="mt-4 text-center">
                <button className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded font-bold text-sm shadow-lg">
                  View All Posts
                </button>
              </div>
            </div>

            {/* Activity Feed */}
            <div 
              className="profile-container p-6 rounded-lg shadow-lg"
              style={{
                backgroundColor: customCSS ? undefined : currentLayout.containerBg,
                color: customCSS ? undefined : currentLayout.textColor,
                border: customCSS ? undefined : `3px solid ${currentLayout.linkColor}`
              }}
            >
              <h2 className="text-2xl font-bold mb-4 flex items-center space-x-2">
                <Zap className="w-6 h-6" />
                <span>Recent Activity</span>
              </h2>
              
              <div className="space-y-3">
                {[
                  { action: "uploaded a new CSS file", item: "Neon Glow Profile", time: "2 hours ago", icon: "🎨" },
                  { action: "updated their status", item: "Feeling creative today!", time: "5 hours ago", icon: "💭" },
                  { action: "added new photos", item: "3 new photos", time: "1 day ago", icon: "📸" },
                  { action: "changed their song", item: "My Chemical Romance - Welcome to the Black Parade", time: "2 days ago", icon: "🎵" },
                  { action: "became friends with", item: "CSSMaster99", time: "3 days ago", icon: "👥" }
                ].map((activity, index) => (
                  <div key={index} className="flex items-center space-x-3 p-3 bg-white rounded-lg shadow">
                    <div className="text-2xl">{activity.icon}</div>
                    <div className="flex-1">
                      <p className="text-sm text-gray-800">
                        <span className="font-medium">{profile.display_name || profile.username}</span> {activity.action} <span className="font-medium">{activity.item}</span>
                      </p>
                      <p className="text-xs text-gray-500">{activity.time}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Customize Mode Panel */}
      {customizeMode && isOwner && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-2xl font-bold text-gray-800 flex items-center space-x-2">
                <Palette className="w-6 h-6" />
                <span>Customize Your Profile</span>
              </h3>
              <button
                onClick={() => setCustomizeMode(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="space-y-4">
              {/* Layout Style */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Layout Style</label>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(MYSPACE_LAYOUTS).map(([key, layout]) => (
                    <button
                      key={key}
                      onClick={() => setProfileData(prev => ({ ...prev, myspace_layout_style: key as keyof typeof MYSPACE_LAYOUTS }))}
                      className={`p-3 rounded border-2 text-sm font-bold transition-all ${
                        profileData.myspace_layout_style === key
                          ? 'border-blue-500 bg-blue-50 scale-105'
                          : 'border-gray-300 hover:border-gray-400'
                      }`}
                    >
                      <div
                        className="w-full h-8 rounded mb-2"
                        style={{ background: layout.background }}
                      ></div>
                      <div className="text-gray-800">{layout.name}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Personal Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">Age</label>
                  <input
                    type="number"
                    value={profileData.myspace_age || ''}
                    onChange={(e) => setProfileData(prev => ({ ...prev, myspace_age: parseInt(e.target.value) || 0 }))}
                    className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="25"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">Location</label>
                  <input
                    type="text"
                    value={profileData.myspace_location}
                    onChange={(e) => setProfileData(prev => ({ ...prev, myspace_location: e.target.value }))}
                    className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="New York, NY"
                  />
                </div>
              </div>

              {/* Relationship Status */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Relationship Status</label>
                <select
                  value={profileData.myspace_relationship_status}
                  onChange={(e) => setProfileData(prev => ({ ...prev, myspace_relationship_status: e.target.value }))}
                  className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="Single">Single</option>
                  <option value="In a relationship">In a relationship</option>
                  <option value="Married">Married</option>
                  <option value="It's complicated">It's complicated</option>
                  <option value="Rather not say">Rather not say</option>
                </select>
              </div>

              {/* Status */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Status Message</label>
                <input
                  type="text"
                  value={profileData.myspace_status}
                  onChange={(e) => setProfileData(prev => ({ ...prev, myspace_status: e.target.value }))}
                  className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="What's on your mind?"
                />
              </div>

              {/* Mood */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Current Mood</label>
                <input
                  type="text"
                  value={profileData.myspace_mood}
                  onChange={(e) => setProfileData(prev => ({ ...prev, myspace_mood: e.target.value }))}
                  className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="😊 Happy"
                />
              </div>

              {/* Song */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Current Song</label>
                <input
                  type="text"
                  value={profileData.myspace_song}
                  onChange={(e) => setProfileData(prev => ({ ...prev, myspace_song: e.target.value }))}
                  className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Artist - Song Title"
                />
              </div>

              {/* About Me */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">About Me</label>
                <textarea
                  value={profileData.myspace_about_me}
                  onChange={(e) => setProfileData(prev => ({ ...prev, myspace_about_me: e.target.value }))}
                  className="w-full p-2 border border-gray-300 rounded h-24 resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Tell everyone about yourself..."
                />
              </div>

              {/* Who I'd Like to Meet */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Who I'd Like to Meet</label>
                <textarea
                  value={profileData.myspace_who_id_like_to_meet}
                  onChange={(e) => setProfileData(prev => ({ ...prev, myspace_who_id_like_to_meet: e.target.value }))}
                  className="w-full p-2 border border-gray-300 rounded h-20 resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Describe the kind of people you'd like to meet..."
                />
              </div>

              {/* Interests */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Interests (comma separated)</label>
                <input
                  type="text"
                  value={profileData.myspace_interests.join(', ')}
                  onChange={(e) => setProfileData(prev => ({ 
                    ...prev, 
                    myspace_interests: e.target.value.split(',').map(s => s.trim()).filter(Boolean)
                  }))}
                  className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Music, Art, Technology, Gaming..."
                />
              </div>
            </div>
            
            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => setCustomizeMode(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 font-medium"
              >
                Cancel
              </button>
              <button
                onClick={saveProfile}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded font-bold flex items-center space-x-2 shadow-lg"
              >
                <Save className="w-4 h-4" />
                <span>Save Changes</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MySpace-style Footer */}
      <div className="bg-white border-t-4 border-blue-600 mt-8 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="text-center">
            <p className="text-gray-600 text-sm font-medium">
              © 2024 TinChat MySpace Edition - A place for CSS creators ✨
            </p>
            <div className="flex justify-center space-x-6 mt-3">
              <a href="#" className="text-blue-600 hover:text-blue-800 text-sm font-bold hover:underline">Terms</a>
              <a href="#" className="text-blue-600 hover:text-blue-800 text-sm font-bold hover:underline">Privacy</a>
              <a href="#" className="text-blue-600 hover:text-blue-800 text-sm font-bold hover:underline">Help</a>
              <a href="#" className="text-blue-600 hover:text-blue-800 text-sm font-bold hover:underline">Contact</a>
            </div>
            <div className="mt-2 text-xs text-gray-500">
              Relive the golden age of social media with custom CSS! 🎨
            </div>
          </div>
        </div>
      </div>

      {/* Floating MySpace-style decorations */}
      {!customCSS && (
        <div className="fixed inset-0 pointer-events-none z-0">
          {/* Animated decorations */}
          <div className="absolute top-20 left-10 text-yellow-400 animate-pulse">
            <Sparkles className="w-4 h-4" />
          </div>
          <div className="absolute top-40 right-20 text-pink-400 animate-bounce">
            <Heart className="w-3 h-3" />
          </div>
          <div className="absolute bottom-20 left-20 text-purple-400 animate-pulse">
            <Star className="w-5 h-5" />
          </div>
          <div className="absolute top-1/2 right-10 text-blue-400 animate-bounce">
            <Sparkles className="w-3 h-3" />
          </div>
          <div className="absolute bottom-40 right-1/4 text-green-400 animate-pulse">
            <Heart className="w-4 h-4" />
          </div>
          <div className="absolute top-1/3 left-1/4 text-cyan-400 animate-pulse">
            <Star className="w-3 h-3" />
          </div>
          <div className="absolute bottom-1/3 left-10 text-orange-400 animate-bounce">
            <Sparkles className="w-4 h-4" />
          </div>
          <div className="absolute top-2/3 right-1/3 text-red-400 animate-pulse">
            <Heart className="w-3 h-3" />
          </div>
        </div>
      )}
    </div>
  );
}