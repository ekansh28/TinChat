// src/components/ProfileCustomizer/components/CustomizerPanel.tsx - 98.CSS STYLED
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
                    fontWeight: activeTab === tab.id ? 'bold' : 'normal'
                  }}
                >
                  <span>{tab.icon}</span> {tab.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Tab Content - 98.css styled windows */}
      <div className="window">
        <div className="title-bar">
          <div className="title-bar-text">
            {tabs.find(t => t.id === activeTab)?.icon} {tabs.find(t => t.id === activeTab)?.label}
          </div>
        </div>
        <div className="window-body" style={{ maxHeight: '400px', overflowY: 'auto' }}>
          {/* Basic Info Tab */}
          {activeTab === 'basic' && (
            <div className="space-y-4">
              {/* Username */}
              <div className="field-row">
                <label htmlFor="username" className="font-bold">Username *</label>
                <input
                  id="username"
                  type="text"
                  value={profile.username || ''}
                  onChange={(e) => updateProfile({ username: e.target.value.slice(0, 20) })}
                  placeholder="Enter your username"
                  maxLength={20}
                  disabled={saving || loading}
                  style={{ width: '100%' }}
                />
                <div className="text-xs text-gray-600 mt-1">
                  {(profile.username || '').length}/20 - This is your unique identifier
                </div>
              </div>

              {/* Display Name */}
              <div className="field-row">
                <label htmlFor="display_name" className="font-bold">Display Name</label>
                <input
                  id="display_name"
                  type="text"
                  value={profile.display_name || ''}
                  onChange={(e) => updateProfile({ display_name: e.target.value.slice(0, 32) })}
                  placeholder="Enter your display name"
                  maxLength={32}
                  disabled={saving || loading}
                  style={{ width: '100%' }}
                />
                <div className="text-xs text-gray-600 mt-1">
                  {(profile.display_name || '').length}/32 - This appears in chat and on your profile
                </div>
              </div>

              {/* Pronouns */}
              <div className="field-row">
                <label htmlFor="pronouns" className="font-bold">Pronouns</label>
                <input
                  id="pronouns"
                  type="text"
                  value={profile.pronouns || ''}
                  onChange={(e) => updateProfile({ pronouns: e.target.value.slice(0, 20) })}
                  placeholder="e.g., they/them, she/her, he/him"
                  maxLength={20}
                  disabled={saving || loading}
                  style={{ width: '100%' }}
                />
                <div className="text-xs text-gray-600 mt-1">
                  {(profile.pronouns || '').length}/20 - Optional
                </div>
              </div>

              {/* Bio */}
              <div className="field-row">
                <label htmlFor="bio" className="font-bold">About Me</label>
                <textarea
                  id="bio"
                  value={profile.bio || ''}
                  onChange={(e) => updateProfile({ bio: e.target.value.slice(0, 500) })}
                  placeholder="Tell people about yourself..."
                  maxLength={500}
                  rows={4}
                  disabled={saving || loading}
                  style={{ width: '100%', resize: 'none' }}
                />
                <div className="text-xs text-gray-600 mt-1">
                  {(profile.bio || '').length}/500 - Share something interesting about yourself
                </div>
              </div>
            </div>
          )}

          {/* Appearance Tab */}
          {activeTab === 'appearance' && (
            <div className="space-y-4">
              {/* Avatar URL */}
              <div className="field-row">
                <label htmlFor="avatar_url" className="font-bold">Avatar Image URL</label>
                <input
                  id="avatar_url"
                  type="text"
                  value={profile.avatar_url || ''}
                  onChange={(e) => updateProfile({ avatar_url: e.target.value })}
                  placeholder="https://example.com/your-avatar.png"
                  disabled={saving || loading}
                  style={{ width: '100%' }}
                />
                <div className="text-xs text-gray-600 mt-1">
                  Square images work best (1:1 ratio)
                </div>
              </div>

              {/* Banner URL */}
              <div className="field-row">
                <label htmlFor="banner_url" className="font-bold">Banner Image URL</label>
                <input
                  id="banner_url"
                  type="text"
                  value={profile.banner_url || ''}
                  onChange={(e) => updateProfile({ banner_url: e.target.value })}
                  placeholder="https://example.com/your-banner.png"
                  disabled={saving || loading}
                  style={{ width: '100%' }}
                />
                <div className="text-xs text-gray-600 mt-1">
                  Recommended size: 320x120 pixels (16:6 ratio)
                </div>
              </div>

              {/* Display Name Color */}
              <div className="field-row">
                <label htmlFor="display_name_color" className="font-bold">Display Name Color</label>
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
                    style={{ flex: 1 }}
                  />
                </div>
                <div className="text-xs text-gray-600 mt-1">
                  This color appears when you send messages in chat
                </div>
              </div>

              {/* Display Name Animation */}
              <div className="field-row">
                <label htmlFor="display_name_animation" className="font-bold">Display Name Animation</label>
                <select
                  id="display_name_animation"
                  value={profile.display_name_animation || 'none'}
                  onChange={(e) => updateProfile({ display_name_animation: e.target.value })}
                  disabled={saving || loading}
                  style={{ width: '100%' }}
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
                <div className="field-row">
                  <label htmlFor="rainbow_speed" className="font-bold">Rainbow Speed</label>
                  <div className="flex items-center gap-4">
                    <input
                      type="range"
                      id="rainbow_speed"
                      min="1"
                      max="10"
                      value={profile.rainbow_speed || 3}
                      onChange={(e) => updateProfile({ rainbow_speed: parseInt(e.target.value) })}
                      disabled={saving || loading}
                      style={{ flex: 1 }}
                    />
                    <span className="text-sm text-gray-600 min-w-[60px] font-bold">
                      {profile.rainbow_speed || 3}s
                    </span>
                  </div>
                  <div className="text-xs text-gray-600 mt-1">
                    How fast the rainbow animation cycles (1 = fastest, 10 = slowest)
                  </div>
                </div>
              )}

              {/* Status */}
              <div className="field-row">
                <label htmlFor="status" className="font-bold">Status</label>
                <select
                  id="status"
                  value={profile.status || 'online'}
                  onChange={(e) => updateProfile({ status: e.target.value as any })}
                  disabled={saving || loading}
                  style={{ width: '100%' }}
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
                isTheme98={true}
              />
            </div>
          )}

          {/* Advanced CSS Tab */}
          {activeTab === 'advanced' && (
            <div className="space-y-4">
              <div className="field-row">
                <label className="font-bold">Custom CSS</label>
                <div className="text-sm text-gray-600 mb-2">
                  Customize your profile card with CSS. Target the <code style={{ background: '#e0e0e0', padding: '2px 4px' }}>.profile-card-custom</code> class.
                </div>
              </div>
              
              <CSSEditor
                value={customCSS}
                onChange={setCustomCSS}
                disabled={saving || loading}
              />

              {/* CSS Examples */}
              <div className="field-row">
                <label className="font-bold">Quick Examples:</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '4px', marginTop: '8px' }}>
                  <button
                    className="btn"
                    onClick={() => setCustomCSS(`/* Neon glow effect */
.profile-card-custom {
  box-shadow: 0 0 20px #00ffff, 0 0 40px #00ffff, 0 0 60px #00ffff;
  border: 2px solid #00ffff;
  background: linear-gradient(135deg, #0a0a0a, #1a1a2e);
}`)}
                    disabled={saving || loading}
                    style={{ fontSize: '11px', padding: '4px' }}
                  >
                    🌟 Neon Glow
                  </button>
                  
                  <button
                    className="btn"
                    onClick={() => setCustomCSS(`/* Retro gradient */
.profile-card-custom {
  background: linear-gradient(45deg, #ff6b9d, #c44569, #f8b500, #feca57);
  color: white;
  border-radius: 20px;
}`)}
                    disabled={saving || loading}
                    style={{ fontSize: '11px', padding: '4px' }}
                  >
                    🌈 Retro
                  </button>
                  
                  <button
                    className="btn"
                    onClick={() => setCustomCSS(`/* Glass effect */
.profile-card-custom {
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
}`)}
                    disabled={saving || loading}
                    style={{ fontSize: '11px', padding: '4px' }}
                  >
                    🔮 Glass
                  </button>
                  
                  <button
                    className="btn"
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
                    style={{ fontSize: '11px', padding: '4px' }}
                  >
                    ⚡ Animated
                  </button>
                </div>
              </div>

              {/* CSS Help */}
              <div className="field-row">
                <div className="sunken" style={{ padding: '8px', backgroundColor: '#e0e0e0' }}>
                  <div className="font-bold mb-2">💡 CSS Tips:</div>
                  <ul className="text-sm space-y-1 text-gray-700" style={{ fontSize: '11px', lineHeight: '1.3' }}>
                    <li>• Use <code>background</code> to change the card background</li>
                    <li>• Use <code>border</code> and <code>border-radius</code> for shape styling</li>
                    <li>• Use <code>box-shadow</code> for glow and shadow effects</li>
                    <li>• Use <code>backdrop-filter</code> for glass effects</li>
                    <li>• Use <code>@keyframes</code> for animations</li>
                    <li>• Use <code>transform</code> for rotations and scaling</li>
                  </ul>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 98.css styling for form elements */}
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
          background: #c0c0c0;
          color: #808080;
        }
        
        .btn.pressed {
          border-style: inset;
          background: #c0c0c0;
        }
        
        .sunken {
          border: 2px inset #c0c0c0;
        }
        
        code {
          background: #e0e0e0;
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
      `}</style>
    </div>
  );
};