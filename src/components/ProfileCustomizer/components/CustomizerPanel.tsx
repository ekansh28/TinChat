// src/components/ProfileCustomizer/components/CustomizerPanel.tsx
import React, { useState } from 'react';
import { Button } from '@/components/ui/button-themed';
import { Input } from '@/components/ui/input-themed';
import { Label } from '@/components/ui/label-themed';
import { Textarea } from '@/components/ui/textarea-themed';
import { cn } from '@/lib/utils';
import { BadgeManager } from './BadgeManager';
import { ColorPicker } from './ColorPicker';
import { CSSEditor } from './CSSEditor';
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
  const [activeTab, setActiveTab] = useState<'basic' | 'appearance' | 'badges' | 'advanced'>('basic');
  const [isBadgeManagerOpen, setIsBadgeManagerOpen] = useState(false);

  const updateProfile = (updates: Partial<UserProfile>) => {
    setProfile(prev => ({ ...prev, ...updates }));
  };

  const tabs = [
    { id: 'basic', label: 'Basic Info', icon: '👤' },
    { id: 'appearance', label: 'Appearance', icon: '🎨' },
    { id: 'badges', label: 'Badges', icon: '🏆' },
    { id: 'advanced', label: 'CSS', icon: '💻' }
  ] as const;

  return (
    <div className="space-y-6">
      {/* Tab Navigation */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="flex space-x-8">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex items-center gap-2 py-2 px-1 border-b-2 font-medium text-sm transition-colors",
                activeTab === tab.id
                  ? "border-blue-500 text-blue-600 dark:text-blue-400"
                  : "border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              )}
              disabled={saving || loading}
            >
              <span>{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="space-y-6">
        {/* Basic Info Tab */}
        {activeTab === 'basic' && (
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Basic Information</h3>
            
            {/* Username */}
            <div>
              <Label htmlFor="username">Username *</Label>
              <Input
                id="username"
                value={profile.username || ''}
                onChange={(e) => updateProfile({ username: e.target.value.slice(0, 20) })}
                placeholder="Enter your username"
                maxLength={20}
                disabled={saving || loading}
                className="mt-1"
              />
              <div className="text-xs text-gray-500 mt-1">
                {(profile.username || '').length}/20 - This is your unique identifier
              </div>
            </div>

            {/* Display Name */}
            <div>
              <Label htmlFor="display_name">Display Name</Label>
              <Input
                id="display_name"
                value={profile.display_name || ''}
                onChange={(e) => updateProfile({ display_name: e.target.value.slice(0, 32) })}
                placeholder="Enter your display name"
                maxLength={32}
                disabled={saving || loading}
                className="mt-1"
              />
              <div className="text-xs text-gray-500 mt-1">
                {(profile.display_name || '').length}/32 - This appears in chat and on your profile
              </div>
            </div>

            {/* Pronouns */}
            <div>
              <Label htmlFor="pronouns">Pronouns</Label>
              <Input
                id="pronouns"
                value={profile.pronouns || ''}
                onChange={(e) => updateProfile({ pronouns: e.target.value.slice(0, 20) })}
                placeholder="e.g., they/them, she/her, he/him"
                maxLength={20}
                disabled={saving || loading}
                className="mt-1"
              />
              <div className="text-xs text-gray-500 mt-1">
                {(profile.pronouns || '').length}/20 - Optional
              </div>
            </div>

            {/* Bio */}
            <div>
              <Label htmlFor="bio">About Me</Label>
              <Textarea
                id="bio"
                value={profile.bio || ''}
                onChange={(e) => updateProfile({ bio: e.target.value.slice(0, 500) })}
                placeholder="Tell people about yourself..."
                maxLength={500}
                rows={4}
                disabled={saving || loading}
                className="mt-1 resize-none"
              />
              <div className="text-xs text-gray-500 mt-1">
                {(profile.bio || '').length}/500 - Share something interesting about yourself
              </div>
            </div>
          </div>
        )}

        {/* Appearance Tab */}
        {activeTab === 'appearance' && (
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Appearance Settings</h3>
            
            {/* Avatar URL */}
            <div>
              <Label htmlFor="avatar_url">Avatar Image URL</Label>
              <Input
                id="avatar_url"
                value={profile.avatar_url || ''}
                onChange={(e) => updateProfile({ avatar_url: e.target.value })}
                placeholder="https://example.com/your-avatar.png"
                disabled={saving || loading}
                className="mt-1"
              />
              <div className="text-xs text-gray-500 mt-1">
                Square images work best (1:1 ratio)
              </div>
            </div>

            {/* Banner URL */}
            <div>
              <Label htmlFor="banner_url">Banner Image URL</Label>
              <Input
                id="banner_url"
                value={profile.banner_url || ''}
                onChange={(e) => updateProfile({ banner_url: e.target.value })}
                placeholder="https://example.com/your-banner.png"
                disabled={saving || loading}
                className="mt-1"
              />
              <div className="text-xs text-gray-500 mt-1">
                Recommended size: 320x120 pixels (16:6 ratio)
              </div>
            </div>

            {/* Display Name Color */}
            <div>
              <Label htmlFor="display_name_color">Display Name Color</Label>
              <div className="flex gap-2 items-center mt-1">
                <ColorPicker
                  color={profile.display_name_color || '#000000'}
                  onChange={(color) => updateProfile({ display_name_color: color })}
                  disabled={saving || loading}
                />
                <Input
                  id="display_name_color"
                  value={profile.display_name_color || '#000000'}
                  onChange={(e) => updateProfile({ display_name_color: e.target.value })}
                  placeholder="#000000"
                  disabled={saving || loading}
                  className="flex-1"
                />
              </div>
              <div className="text-xs text-gray-500 mt-1">
                This color appears when you send messages in chat
              </div>
            </div>

            {/* Display Name Animation */}
            <div>
              <Label htmlFor="display_name_animation">Display Name Animation</Label>
              <select
                id="display_name_animation"
                value={profile.display_name_animation || 'none'}
                onChange={(e) => updateProfile({ display_name_animation: e.target.value })}
                disabled={saving || loading}
                className="mt-1 w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700"
              >
                <option value="none">None</option>
                <option value="rainbow">Rainbow</option>
                <option value="pulse">Pulse</option>
                <option value="glow">Glow</option>
                <option value="gradient">Gradient</option>
              </select>
            </div>

            {/* Rainbow Speed (only show if rainbow animation is selected) */}
            {profile.display_name_animation === 'rainbow' && (
              <div>
                <Label htmlFor="rainbow_speed">Rainbow Speed</Label>
                <div className="flex items-center gap-4 mt-1">
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
                  <span className="text-sm text-gray-600 dark:text-gray-400 min-w-[60px]">
                    {profile.rainbow_speed || 3}s
                  </span>
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  How fast the rainbow animation cycles (1 = fastest, 10 = slowest)
                </div>
              </div>
            )}

            {/* Status */}
            <div>
              <Label htmlFor="status">Status</Label>
              <select
                id="status"
                value={profile.status || 'online'}
                onChange={(e) => updateProfile({ status: e.target.value as any })}
                disabled={saving || loading}
                className="mt-1 w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700"
              >
                <option value="online">🟢 Online</option>
                <option value="idle">🟡 Idle</option>
                <option value="dnd">🔴 Do Not Disturb</option>
                <option value="offline">⚫ Offline</option>
              </select>
            </div>
          </div>
        )}

        {/* Badges Tab */}
        {activeTab === 'badges' && (
          <div className="space-y-4">
            <BadgeManager
              badges={badges}
              setBadges={setBadges}
              isBadgeManagerOpen={isBadgeManagerOpen}
              setIsBadgeManagerOpen={setIsBadgeManagerOpen}
              saving={saving}
              isTheme98={false}
            />
          </div>
        )}

        {/* Advanced CSS Tab */}
        {activeTab === 'advanced' && (
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Custom CSS</h3>
            <div className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Customize your profile card with CSS. Target the <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">.profile-card-custom</code> class.
            </div>
            
            <CSSEditor
              value={customCSS}
              onChange={setCustomCSS}
              disabled={saving || loading}
            />

            {/* CSS Examples */}
            <div className="space-y-3">
              <h4 className="font-medium">Quick Examples:</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCustomCSS(`/* Neon glow effect */
.profile-card-custom {
  box-shadow: 0 0 20px #00ffff, 0 0 40px #00ffff, 0 0 60px #00ffff;
  border: 2px solid #00ffff;
  background: linear-gradient(135deg, #0a0a0a, #1a1a2e);
}`)}
                  disabled={saving || loading}
                >
                  🌟 Neon Glow
                </Button>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCustomCSS(`/* Retro gradient */
.profile-card-custom {
  background: linear-gradient(45deg, #ff6b9d, #c44569, #f8b500, #feca57);
  color: white;
  border-radius: 20px;
}`)}
                  disabled={saving || loading}
                >
                  🌈 Retro
                </Button>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCustomCSS(`/* Glass effect */
.profile-card-custom {
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
}`)}
                  disabled={saving || loading}
                >
                  🔮 Glass
                </Button>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCustomCSS(`/* Animated border */
.profile-card-custom {
  position: relative;
  background: #000;
  border-radius: 15px;
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
                >
                  ⚡ Animated
                </Button>
              </div>
            </div>

            {/* CSS Help */}
            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
              <h5 className="font-medium mb-2">💡 CSS Tips:</h5>
              <ul className="text-sm space-y-1 text-gray-700 dark:text-gray-300">
                <li>• Use <code>background</code> to change the card background</li>
                <li>• Use <code>border</code> and <code>border-radius</code> for shape styling</li>
                <li>• Use <code>box-shadow</code> for glow and shadow effects</li>
                <li>• Use <code>backdrop-filter</code> for glass effects</li>
                <li>• Use <code>@keyframes</code> for animations</li>
                <li>• Use <code>transform</code> for rotations and scaling</li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};