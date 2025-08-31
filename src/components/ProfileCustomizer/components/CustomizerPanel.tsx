// src/components/ProfileCustomizer/components/CustomizerPanel.tsx - UPDATED WITH ACE EDITOR
import React, { useState, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button-themed';
import { Input } from '@/components/ui/input-themed';
import { Label } from '@/components/ui/label-themed';
import { Textarea } from '@/components/ui/textarea-themed';
import { cn } from '@/lib/utils';
import { BadgeManager } from './BadgeManager';
import { ColorPicker } from './ColorPicker';
import { CSSEditor } from './CSSEditor'; // Updated ACE Editor
import { useToast } from '@/hooks/use-toast';
import type { UserProfile, Badge } from '../types';

interface CustomizerPanelProps {
  profile: UserProfile;
  setProfile: React.Dispatch<React.SetStateAction<UserProfile>>;
  badges: Badge[];
  setBadges: React.Dispatch<React.SetStateAction<Badge[]>>;
  customCSS: string;
  setCustomCSS: React.Dispatch<React.SetStateAction<string>>;
  saving: boolean;
  loading: boolean;
}

// Enhanced image validation
const validateImageFile = (file: File): Promise<{valid: boolean, error?: string}> => {
  return new Promise((resolve) => {
    if (!file.type.startsWith('image/')) {
      resolve({ valid: false, error: 'File must be an image' });
      return;
    }

    if (file.size > 10 * 1024 * 1024) { // 10MB limit
      resolve({ valid: false, error: 'File size must be under 10MB' });
      return;
    }

    const img = new Image();
    const url = URL.createObjectURL(file);
    
    const cleanup = () => URL.revokeObjectURL(url);
    
    const timeout = setTimeout(() => {
      cleanup();
      resolve({ valid: false, error: 'Image validation timeout' });
    }, 5000);
    
    img.onload = () => {
      clearTimeout(timeout);
      cleanup();
      
      if (img.width < 32 || img.height < 32) {
        resolve({ valid: false, error: 'Image must be at least 32x32 pixels' });
        return;
      }
      
      if (img.width > 4096 || img.height > 4096) {
        resolve({ valid: false, error: 'Image must be smaller than 4096x4096 pixels' });
        return;
      }
      
      resolve({ valid: true });
    };
    
    img.onerror = () => {
      clearTimeout(timeout);
      cleanup();
      resolve({ valid: false, error: 'Invalid or corrupted image file' });
    };
    
    img.src = url;
  });
};

// CSS validation function
const validateCSS = (css: string): { valid: boolean; errors: string[] } => {
  const errors: string[] = [];
  
  if (!css.trim()) {
    return { valid: true, errors: [] };
  }

  const openBraces = (css.match(/\{/g) || []).length;
  const closeBraces = (css.match(/\}/g) || []).length;
  
  if (openBraces !== closeBraces) {
    errors.push('Mismatched braces in CSS');
  }

  const dangerousProps = ['position: fixed', 'position: absolute', 'z-index: 999'];
  dangerousProps.forEach(prop => {
    if (css.toLowerCase().includes(prop)) {
      errors.push(`Potentially dangerous CSS property: ${prop}`);
    }
  });

  const lines = css.split('\n');
  lines.forEach((line, index) => {
    const trimmed = line.trim();
    if (trimmed && 
        !trimmed.startsWith('/*') && 
        !trimmed.endsWith('*/') && 
        !trimmed.endsWith('{') && 
        !trimmed.endsWith('}') && 
        !trimmed.endsWith(';') && 
        trimmed.includes(':')) {
      errors.push(`Line ${index + 1}: Missing semicolon`);
    }
  });

  return { valid: errors.length === 0, errors };
};

export const CustomizerPanel: React.FC<CustomizerPanelProps> = ({
  profile,
  setProfile,
  badges,
  setBadges,
  customCSS,
  setCustomCSS,
  saving,
  loading
}) => {
  const [activeTab, setActiveTab] = useState<'basic' | 'css'>('basic');
  const [isBadgeManagerOpen, setIsBadgeManagerOpen] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [bannerUploading, setBannerUploading] = useState(false);
  const [cssValidation, setCssValidation] = useState<{ valid: boolean; errors: string[] }>({ valid: true, errors: [] });
  
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);
  const cssFileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const updateProfile = (updates: Partial<UserProfile>) => {
    setProfile(prev => ({ ...prev, ...updates }));
  };

  // Handle image upload (avatar/banner)
  const handleImageUpload = useCallback(async (
    file: File, 
    type: 'avatar' | 'banner',
    setUploading: React.Dispatch<React.SetStateAction<boolean>>
  ) => {
    setUploading(true);
    
    try {
      const validation = await validateImageFile(file);
      
      if (!validation.valid) {
        toast({
          title: "Invalid File",
          description: validation.error,
          variant: "destructive"
        });
        return;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        const dataUrl = event.target?.result as string;
        if (type === 'avatar') {
          updateProfile({ avatar_url: dataUrl });
        } else {
          updateProfile({ banner_url: dataUrl });
        }
        toast({
          title: "Image Uploaded",
          description: `${type === 'avatar' ? 'Avatar' : 'Banner'} image updated successfully`,
          variant: "default"
        });
      };
      reader.onerror = () => {
        toast({
          title: "Upload Error",
          description: "Failed to read the image file",
          variant: "destructive"
        });
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error('Image upload error:', error);
      toast({
        title: "Upload Error",
        description: "Failed to process the uploaded file",
        variant: "destructive"
      });
    } finally {
      setUploading(false);
    }
  }, [updateProfile, toast]);

  // Handle CSS file upload
  const handleCSSFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.css')) {
      toast({
        title: "Invalid File",
        description: "Please upload a CSS file (.css)",
        variant: "destructive"
      });
      return;
    }

    if (file.size > 50 * 1024) { // 50KB limit for CSS
      toast({
        title: "File Too Large",
        description: "CSS file must be smaller than 50KB",
        variant: "destructive"
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const cssContent = event.target?.result as string;
      const validation = validateCSS(cssContent);
      
      if (validation.valid) {
        setCustomCSS(cssContent);
        setCssValidation(validation);
        toast({
          title: "CSS Loaded",
          description: "CSS file loaded successfully",
          variant: "default"
        });
      } else {
        setCssValidation(validation);
        toast({
          title: "Invalid CSS",
          description: `CSS validation failed: ${validation.errors[0]}`,
          variant: "destructive"
        });
      }
    };
    reader.readAsText(file);
  }, [setCustomCSS, toast]);

  // Validate CSS on change
  const handleCSSChange = useCallback((css: string) => {
    setCustomCSS(css);
    const validation = validateCSS(css);
    setCssValidation(validation);
  }, [setCustomCSS]);

  const tabs = [
    { 
  id: 'basic', 
  label: (
    <div className="flex items-center gap-2">
      <img 
        src="https://cdn.tinchat.online/icons/agent.png" 
        className="w-4 h-4"  // Adjust size as needed
        alt="CSS Icon"
      />
      Profile 
    </div>
  ),
  icon: null  // Remove the separate icon since we're including it in the label
},
{ 
  id: 'css', 
  label: (
    <div className="flex items-center gap-2">
      <img 
        src="https://cdn.tinchat.online/icons/paint.png" 
        className="w-4 h-4"  // Adjust size as needed
        alt="CSS Icon"
      />
      Advanced CSS
    </div>
  ),
  icon: null  // Remove the separate icon since we're including it in the label
}
  ] as const;

  return (
    <div className="space-y-4">
      {/* Tab Navigation - 98.css style */}
      <div className="window">
        <div className="title-bar">
          <div className="title-bar-text">Profile Customization</div>
        </div>
        <div className="window-body">
          <div className="field-row">
            <div style={{ display: 'flex', gap: '4px' }}>
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "btn",
                    activeTab === tab.id && "pressed"
                  )}
                  disabled={saving || loading}
                  style={{ 
                    padding: '4px 8px',
                    fontSize: '12px',
                    fontWeight: activeTab === tab.id ? 'normal' : 'normal'
                  }}
                >
                  <span>{tab.icon}</span> {tab.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Tab Content */}
      <div className="no-scrollbar">
        <div className="legend-tab">
          <div className="legend">
            {tabs.find(t => t.id === activeTab)?.icon} {tabs.find(t => t.id === activeTab)?.label}
          </div>
        </div>
        <div className="fieldset no-scrollbar">
          {/* Basic Info + Appearance + Badges Tab */}
          {activeTab === 'basic' && (
            <div className="space-y-4">
              {/* Basic Info Section */}
              <fieldset style={{ border: 'groove' }} className="p-4 space-y-2">
                <legend className="font-bold text-xs">Basic Information</legend>

                {/* Username */}
                <div className="field-row flex items-start">
                  <label htmlFor="username" className="font-bold w-28">Username</label>
                  <div className="flex w-full">
                    <input
                      id="username"
                      type="text"
                      value={profile.username || ''}
                      onChange={(e) => updateProfile({ username: e.target.value.slice(0, 20) })}
                      placeholder="Enter your username"
                      maxLength={20}
                      disabled={saving || loading}
                      className="w-1/3"
                    />
                    <div className="text-xs text-gray-600 mt-1">
                      {(profile.username || '').length}/20
                    </div>
                  </div>
                </div>

                {/* Display Name */}
                <div className="field-row flex items-start">
                  <label htmlFor="display_name" className="font-bold w-28 mt-1">Display Name</label>
                  <div className="flex w-full">
                    <input
                      id="display_name"
                      type="text"
                      value={profile.display_name || ''}
                      onChange={(e) => updateProfile({ display_name: e.target.value.slice(0, 32) })}
                      placeholder="Enter your display name"
                      maxLength={32}
                      disabled={saving || loading}
                      className="w-1/3"
                    />
                    <div className="text-xs text-gray-600 mt-1">
                      {(profile.display_name || '').length}/32
                    </div>
                  </div>
                </div>

                {/* Pronouns */}
                <div className="field-row flex items-start">
                  <label htmlFor="pronouns" className="font-bold w-28 mt-1">Pronouns</label>
                  <div className="flex w-full">
                    <input
                      id="pronouns"
                      type="text"
                      value={profile.pronouns || ''}
                      onChange={(e) => updateProfile({ pronouns: e.target.value.slice(0, 20) })}
                      placeholder="e.g., he/him, she/her"
                      maxLength={20}
                      disabled={saving || loading}
                      className="w-1/3"
                    />
                    <div className="text-xs text-gray-600 mt-1">
                      {(profile.pronouns || '').length}/20 
                    </div>
                  </div>
                </div>

                {/* Bio */}
                <div className="field-row flex items-start">
                  <label htmlFor="bio" className="font-bold w-28 mt-1">About Me</label>
                  <div className="flex w-full">
                    <textarea
                      id="bio"
                      value={profile.bio || ''}
                      onChange={(e) => updateProfile({ bio: e.target.value.slice(0, 200) })}
                      placeholder="Tell people about yourself..."
                      maxLength={200}
                      rows={4}
                      disabled={saving || loading}
                      className="w-1/2 resize-none"
                    />
                    <div className="text-xs text-gray-600 mt-1">
                      {(profile.bio || '').length}/200 
                    </div>
                  </div>
                </div>
              </fieldset>

              {/* Appearance Section */}
              <fieldset className="p-4 space-y-2" style={{ border: 'groove' }}>
                <legend className="font-bold text-xs">Appearance</legend>

                {/* Hidden file inputs */}
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleImageUpload(file, 'avatar', setAvatarUploading);
                  }}
                  style={{ display: 'none' }}
                />
                <input
                  ref={bannerInputRef}
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleImageUpload(file, 'banner', setBannerUploading);
                  }}
                  style={{ display: 'none' }}
                />

                {/* Avatar Upload Info */}
                <div className="field-row flex items-start gap-4">
                  <label className="font-bold w-28 pt-1">Profile Picture</label>
                  <div className="flex flex-col">
                    <div className="text-xs text-gray-600 mb-1">
                      Hover over your profile picture in the preview to upload a new image
                    </div>
                    {avatarUploading && (
                      <div className="text-xs text-blue-600">Uploading avatar...</div>
                    )}
                  </div>
                </div>

                {/* Banner Upload Info */}
                <div className="field-row flex items-start gap-4">
                  <label className="font-bold w-28 pt-1">Banner Image</label>
                  <div className="flex flex-col">
                    <div className="text-xs text-gray-600 mb-1">
                      Hover over the banner area in the preview to upload a new image
                    </div>
                    {bannerUploading && (
                      <div className="text-xs text-blue-600">Uploading banner...</div>
                    )}
                  </div>
                </div>

                {/* Display Name Color */}
                <div className="field-row flex items-start gap-4">
                  <label htmlFor="display_name_color" className="font-bold w-28 pt-1">Display Name Color</label>
                  <div className="flex flex-col w-full gap-1">
                    <div className="flex gap-2 items-center">
                      <ColorPicker
                        color={profile.display_name_color || '#000000'}
                        onChange={(color) => updateProfile({ display_name_color: color })}
                        disabled={saving || loading}
                      />
                      <input
                        id="display_name_color"
                        type="text"
                        value={profile.display_name_color || '#000000'}
                        onChange={(e) => updateProfile({ display_name_color: e.target.value })}
                        placeholder="#000000"
                        disabled={saving || loading}
                        className="w-1/6"
                      />
                    </div>
                    <div className="text-xs text-gray-600">
                      This color appears when you send messages in chat
                    </div>
                  </div>
                </div>

                {/* Display Name Animation */}
                <div className="field-row flex items-start gap-4">
                  <label htmlFor="display_name_animation" className="font-bold w-28 pt-1">Display Name Animation</label>
                  <div className="flex flex-col w-full">
                    <select
                      id="display_name_animation"
                      value={profile.display_name_animation || 'none'}
                      onChange={(e) => updateProfile({ display_name_animation: e.target.value })}
                      disabled={saving || loading}
                      className="w-1/6"
                    >
                      <option value="none">None</option>
                      <option value="rainbow">Rainbow</option>
                      <option value="pulse">Pulse</option>
                      <option value="glow">Glow</option>
                      <option value="gradient">Gradient</option>
                    </select>
                  </div>
                </div>

                {/* Rainbow Speed */}
                {profile.display_name_animation === 'rainbow' && (
                  <div className="field-row flex items-start gap-4">
                    <label htmlFor="rainbow_speed" className="font-bold w-28 pt-1">Rainbow Speed</label>
                    <div className="flex flex-col w-full">
                      <div className="flex items-center gap-4">
                        <input
                          type="range"
                          id="rainbow_speed"
                          min="1"
                          max="10"
                          value={profile.rainbow_speed || 3}
                          onChange={(e) => updateProfile({ rainbow_speed: parseInt(e.target.value) })}
                          disabled={saving || loading}
                          className="flex-1"
                        />
                        <span className="text-sm text-gray-600 min-w-[60px] font-bold">
                          {profile.rainbow_speed || 3}s
                        </span>
                      </div>
                      <div className="text-xs text-gray-600 mt-1">
                        How fast the rainbow animation cycles (1 = fastest, 10 = slowest)
                      </div>
                    </div>
                  </div>
                )}

                {/* Status */}
                <div className="field-row flex items-start gap-4">
                  <label htmlFor="status" className="font-bold w-28 pt-1">Status</label>
                  <div className="flex flex-col w-full">
                    <select
                      id="status"
                      value={profile.status || 'online'}
                      onChange={(e) => updateProfile({ status: e.target.value as any })}
                      disabled={saving || loading}
                      className="w-1/4"
                    >
                      <option value="online">🟢 Online</option>
                      <option value="idle">🟡 Idle</option>
                      <option value="dnd">🔴 Do Not Disturb</option>
                      <option value="offline">⚫ Offline</option>
                    </select>
                  </div>
                </div>
              </fieldset>

              {/* Badges Section */}
              <fieldset style={{ border: 'groove'}}>
                <legend style={{ fontWeight: 'bold', fontSize: '12px' }}>Badges</legend>
                <BadgeManager
                  badges={badges}
                  setBadges={setBadges}
                  isBadgeManagerOpen={isBadgeManagerOpen}
                  setIsBadgeManagerOpen={setIsBadgeManagerOpen}
                  saving={saving}
                  isTheme98={true}
                />
              </fieldset>
            </div>
          )}

          {/* Advanced CSS Tab with ACE Editor */}
          {activeTab === 'css' && (
            <div className="space-y-4">
              {/* CSS File Upload */}
              <div className="field-row">
                <label className="font-bold">Upload CSS File</label>
                <input
                  ref={cssFileInputRef}
                  type="file"
                  accept=".css"
                  onChange={handleCSSFileUpload}
                  style={{ display: 'none' }}
                />
                <button
                  className="btn"
                  onClick={() => cssFileInputRef.current?.click()}
                  disabled={saving || loading}
                  style={{ marginTop: '4px' }}
                >
                  📁 Upload CSS File
                </button>
                <div className="text-xs text-gray-600 mt-1">
                  Upload a .css file (max 50KB) with automatic validation
                </div>
              </div>

              {/* CSS Validation Status */}
              {!cssValidation.valid && cssValidation.errors.length > 0 && (
                <div className="field-row">
                  <div className="sunken border-2 border-red-400 bg-red-50 p-2">
                    <div className="font-bold text-red-700 mb-1">⚠️ CSS Validation Errors:</div>
                    <ul className="text-xs text-red-600">
                      {cssValidation.errors.slice(0, 5).map((error, index) => (
                        <li key={index}>• {error}</li>
                      ))}
                      {cssValidation.errors.length > 5 && (
                        <li>• ... and {cssValidation.errors.length - 5} more errors</li>
                      )}
                    </ul>
                  </div>
                </div>
              )}

              {cssValidation.valid && customCSS.trim() && (
                <div className="field-row">
                  <div className="sunken border-2 border-green-400 bg-green-50 p-2">
                    <div className="font-bold text-green-700 text-xs">✓ CSS is valid</div>
                  </div>
                </div>
              )}

              <div className="field-row">
                <label className="font-bold">Custom CSS Editor (ACE)</label>
                <div className="text-sm text-gray-600 mb-2">
                  Professional code editor with syntax highlighting, auto-completion, and more. Target the <code style={{padding: '2px 4px' }}>.profile-card-custom</code> class.
                </div>
              </div>
              
              {/* ACE CSS Editor */}
              <CSSEditor
                value={customCSS}
                onChange={handleCSSChange}
                disabled={saving || loading}
              />

              {/* CSS Examples */}
              <div className="field-row">
                <label className="font-bold">Quick Examples:</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '4px', marginTop: '8px' }}>
                  <button
                    className="btn"
                    onClick={() => handleCSSChange(`/* Neon glow effect */
.profile-card-custom {
  box-shadow: 0 0 20px #00ffff, 0 0 40px #00ffff, 0 0 60px #00ffff;
  border: 2px solid #00ffff;
  background: linear-gradient(135deg, #0a0a0a, #1a1a2e);
  color: #ffffff;
}`)}
                    disabled={saving || loading}
                    style={{ fontSize: '11px', padding: '4px' }}
                  >
                    🌟 Neon Glow
                  </button>
                  
                  <button
                    className="btn"
                    onClick={() => handleCSSChange(`/* Retro gradient */
.profile-card-custom {
  background: linear-gradient(45deg, #ff6b9d, #c44569, #f8b500, #feca57);
  color: white;
  border-radius: 20px;
  border: none;
}`)}
                    disabled={saving || loading}
                    style={{ fontSize: '11px', padding: '4px' }}
                  >
                    🌈 Retro
                  </button>
                  
                  <button
                    className="btn"
                    onClick={() => handleCSSChange(`/* Liquid Glass Effect for Profile Card - Pure CSS Only */

/* Main profile card with liquid glass effect */
.profile-card-custom {
  position: relative;
  isolation: isolate;
  border-radius: 16px;
  
  /* Outer shadow for depth */
  box-shadow: 0px 8px 32px rgba(0, 0, 0, 0.3);
  
  /* FIXED: Subtle glass background for blur effect */
  background: rgba(255, 255, 255, 0.000001) !important;
  backdrop-filter: blur(1px)  ;
  -webkit-backdrop-filter: blur(1px);
  
  border: 1px solid rgba(255, 255, 255, 0.05) !important;
  overflow: hidden;
}

/* Glass effect layer - behind content */
.profile-card-custom::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: -1;
  border-radius: 16px;
  

  
  /* Very subtle glass tint overlay */
  background: rgba(255, 255, 255, 0.08);
  

}

/* Backdrop blur and glass effect layer */
.profile-card-custom::after {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: -2;
  border-radius: 16px;
  
  /* Subtle backdrop blur for frosted glass effect */
  backdrop-filter: blur(3px) saturate(110%) brightness(101%) contrast(101%);
  -webkit-backdrop-filter: blur(3px) saturate(110%) brightness(101%) contrast(101%);
  
  /* Very subtle glass reflection effect */
  background: 
    linear-gradient(135deg, rgba(255, 255, 255, 0.08) 0%, transparent 60%),
    linear-gradient(225deg, rgba(255, 255, 255, 0.05) 0%, transparent 60%);
  
  /* Minimal glass surface distortion filter */
  filter: blur(0.2px) brightness(1.02) contrast(1.02) hue-rotate(1deg);
}

/* ADDED: Glass distortion animation keyframes */
@keyframes glass-distortion {
  0%, 100% {
    backdrop-filter: blur(20px) saturate(180%) brightness(110%) contrast(115%);
    box-shadow: 
      inset 0 0 20px -5px rgba(255, 255, 255, 0.7),
      inset 0 0 40px -10px rgba(255, 255, 255, 0.3);
  }
  50% {
    backdrop-filter: blur(25px) saturate(200%) brightness(115%) contrast(120%);
    box-shadow: 
      inset 0 0 25px -3px rgba(255, 255, 255, 0.8),
      inset 0 0 50px -8px rgba(255, 255, 255, 0.4);
  }
}

/* Enhanced text contrast on glass background */
.profile-card-custom .profile-display-name,
.profile-card-custom .profile-username,
.profile-card-custom .profile-pronouns,
.profile-card-custom .profile-footer-label,
.profile-card-custom .profile-footer-date,
.profile-card-custom .profile-badges-title {
  text-shadow: 
    1px 1px 2px rgba(0, 0, 0, 0.8),
    0 0 10px rgba(255, 255, 255, 0.3);
  color: #ffffff !important;
  font-weight: 600;
}

/* Bio section with enhanced glass effect */
.profile-card-custom .profile-bio {
  background: rgba(0, 0, 0, 0.25) !important;
  backdrop-filter: blur(50px);
  -webkit-backdrop-filter: blur(50px);
  border: 1px solid rgba(255, 255, 255, 0.2) !important;
  border-left: 4px solid rgba(255, 255, 255, 0.8) !important;
  box-shadow: 
    inset 0 1px 0 rgba(255, 255, 255, 0.2),
    0 4px 15px rgba(0, 0, 0, 0.2);
}

/* Footer with glass effect */
.profile-card-custom .profile-footer {

  border-top: 1px solid rgba(255, 255, 255, 0.3) !important;
 
}

/* Divider with glass styling */
.profile-card-custom .profile-divider {
  background: linear-gradient(
    to right, 
    transparent, 
    rgba(255, 255, 255, 0.6), 
    transparent
  ) !important;
  height: 1px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
}

/* Badge styling for glass effect */
.profile-card-custom .profile-badge-item {
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
  border-radius: 8px;
  padding: 2px;
  background: rgba(255, 255, 255, 0.15);
  border: 1px solid rgba(255, 255, 255, 0.3);
  box-shadow: 
    inset 0 1px 0 rgba(255, 255, 255, 0.2),
    0 2px 8px rgba(0, 0, 0, 0.2);
  transition: all 0.3s ease;
}

.profile-card-custom .profile-badge-item:hover {
  background: rgba(255, 255, 255, 0.25);
  transform: translateY(-2px);
  box-shadow: 
    inset 0 1px 0 rgba(255, 255, 255, 0.3),
    0 4px 15px rgba(0, 0, 0, 0.3);
}

/* Avatar with enhanced glass border */
.profile-card-custom .profile-avatar {
  border: 3px solid rgba(255, 255, 255, 0.8) !important;
  box-shadow: 
    0 0 20px rgba(255, 255, 255, 0.4),
    inset 0 0 10px rgba(255, 255, 255, 0.2);
}



/* Banner with glass overlay */
.profile-card-custom .profile-popup-banner::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: 
    linear-gradient(135deg, rgba(255, 255, 255, 0.1) 0%, transparent 70%),
    linear-gradient(45deg, rgba(255, 255, 255, 0.05) 0%, transparent 50%);
  border-radius: 8px 8px 0 0;
  z-index: 1;
  pointer-events: none;
}`)}
                    disabled={saving || loading}
                    style={{ fontSize: '11px', padding: '4px' }}
                  >
                    🔮 Glass
                  </button>
                  
                  <button
                    className="btn"
                    onClick={() => handleCSSChange(`/* Animated border */
.profile-card-custom {
  position: relative;
  background: #000;
  border-radius: 15px;
  overflow: hidden;
}

.profile-card-custom::before {
  content: '';
  position: absolute;
  inset: -2px;
  padding: 2px;
  background: linear-gradient(45deg, #ff0000, #ff8000, #ffff00, #00ff00, #0080ff, #8000ff);
  border-radius: 15px;
  z-index: -1;
  animation: rotate 2s linear infinite;
}

@keyframes rotate {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}`)}
                    disabled={saving || loading}
                    style={{ fontSize: '11px', padding: '4px' }}
                  >
                    ⚡ Animated
                  </button>
                </div>
              </div>

              {/* CSS Help */}
              <fieldset style={{ border: 'groove'}}>
                <legend>CSS Tips & ACE Editor Shortcuts:</legend>
                <div className="field-row">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <div className="font-bold text-xs mb-2">CSS Properties:</div>
                      <ul className="text-xs space-y-1 text-gray-700">
                        <li>• <code>background</code> - Change card background</li>
                        <li>• <code>border</code> & <code>border-radius</code> - Shape styling</li>
                        <li>• <code>box-shadow</code> - Glow and shadow effects</li>
                        <li>• <code>backdrop-filter</code> - Glass effects</li>
                        <li>• <code>@keyframes</code> - Custom animations</li>
                        <li>• <code>transform</code> - Rotations and scaling</li>
                      </ul>
                    </div>
                    <div>
                      <div className="font-bold text-xs mb-2">Editor Shortcuts:</div>
                      <ul className="text-xs space-y-1 text-gray-700">
                        <li>• <code>Ctrl+Space</code> - Auto-completion</li>
                        <li>• <code>Ctrl+F</code> - Find & Replace</li>
                        <li>• <code>Ctrl+Z/Y</code> - Undo/Redo</li>
                        <li>• <code>Ctrl+Alt+↑/↓</code> - Multi-cursor</li>
                        <li>• <code>Ctrl+/</code> - Toggle comment</li>
                        <li>• <code>Alt+↑/↓</code> - Move lines</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </fieldset>
            </div>
          )}
        </div>
      </div>

      {/* Export avatar/banner upload functions */}
      <style jsx>{`
        .field-row {
          margin-bottom: 12px;
        }
        
        .field-row label {
          display: block;
          margin-bottom: 4px;
          font-size: 11px;
        }
        
        .field-row input,
        .field-row textarea,
        .field-row select {
          border: 2px inset #c0c0c0;
          padding: 2px 4px;
          font-family: inherit;
          font-size: 11px;
        }
        
        .field-row input:focus,
        .field-row textarea:focus,
        .field-row select:focus {
          outline: 1px dotted #000;
        }
        
        .field-row input:disabled,
        .field-row textarea:disabled,
        .field-row select:disabled {
          color: #808080;
        }
        
        .btn.pressed {
          border-style: inset;
        }
        
        .sunken {
          border: 2px inset #c0c0c0;
        }
        
        code {
          padding: 1px 3px;
          border: 1px inset #c0c0c0;
          font-family: 'MS Sans Serif', sans-serif;
          font-size: 10px;
        }
        
        .space-y-4 > * + * {
          margin-top: 16px;
        }
        
        .space-y-1 > * + * {
          margin-top: 4px;
        }
        
        .text-xs {
          font-size: 10px;
        }
        
        .text-sm {
          font-size: 11px;
        }
        
        .text-gray-600 {
          color: #666;
        }
        
        .text-gray-700 {
          color: #555;
        }
        
        .font-bold {
          font-weight: bold;
        }
        
        .flex {
          display: flex;
        }
        
        .items-center {
          align-items: center;
        }
        
        .gap-2 {
          gap: 8px;
        }
        
        .gap-4 {
          gap: 16px;
        }
        
        .min-w-[60px] {
          min-width: 60px;
        }
        
        .mt-1 {
          margin-top: 4px;
        }
        
        .mb-2 {
          margin-bottom: 8px;
        }
        
        .grid {
          display: grid;
        }
        
        .grid-cols-1 {
          grid-template-columns: repeat(1, minmax(0, 1fr));
        }
        
        .grid-cols-2 {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
        
        legend {
          padding: 0 8px;
        }
        
        @media (min-width: 768px) {
          .md\\:grid-cols-2 {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }
      `}</style>
    </div>
  );

  // Export avatar/banner upload trigger functions for use in preview
  (CustomizerPanel as any).triggerAvatarUpload = () => avatarInputRef.current?.click();
  (CustomizerPanel as any).triggerBannerUpload = () => bannerInputRef.current?.click();
};