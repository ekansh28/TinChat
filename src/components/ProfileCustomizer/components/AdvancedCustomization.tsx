// src/components/ProfileCustomizer/components/AdvancedCustomization.tsx
import React, { useState } from 'react';
import { Button } from '@/components/ui/button-themed';
import { Label } from '@/components/ui/label-themed';
import { Input } from '@/components/ui/input-themed';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select-themed';
import { cn } from '@/lib/utils';
import type { EasyCustomization } from '../types';

interface AdvancedCustomizationProps {
  easyCustomization: EasyCustomization;
  setEasyCustomization: React.Dispatch<React.SetStateAction<EasyCustomization>>;
  customCSS: string;
  setCustomCSS: React.Dispatch<React.SetStateAction<string>>;
  cssMode: 'custom' | 'easy';
  saving: boolean;
  isTheme98: boolean;
}

export const AdvancedCustomization: React.FC<AdvancedCustomizationProps> = ({
  easyCustomization,
  setEasyCustomization,
  customCSS,
  setCustomCSS,
  cssMode,
  saving,
  isTheme98
}) => {
  const [activeSection, setActiveSection] = useState<'effects' | 'layout' | 'css'>('effects');

  const updateCustomization = (updates: Partial<EasyCustomization>) => {
    setEasyCustomization(prev => ({ ...prev, ...updates }));
  };

  const EffectsSection = () => (
    <div className="space-y-4">
      {/* Shadow Controls */}
      <div>
        <Label>Card Shadow</Label>
        <div className="flex items-center gap-4 mt-2">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={easyCustomization.shadow}
              onChange={(e) => updateCustomization({ shadow: e.target.checked })}
              disabled={saving}
            />
            Drop Shadow
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={easyCustomization.glow}
              onChange={(e) => updateCustomization({ glow: e.target.checked })}
              disabled={saving}
            />
            Glow Effect
          </label>
        </div>
      </div>

      {/* Border Controls */}
      <div>
        <Label>Border Settings</Label>
        <div className="space-y-3 mt-2">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={easyCustomization.border}
              onChange={(e) => updateCustomization({ border: e.target.checked })}
              disabled={saving}
            />
            Enable Border
          </label>
          
          <div>
            <Label htmlFor="border-radius">Border Radius</Label>
            <div className="flex items-center gap-2 mt-1">
              <input
                id="border-radius"
                type="range"
                min="0"
                max="50"
                value={easyCustomization.borderRadius}
                onChange={(e) => updateCustomization({ borderRadius: parseInt(e.target.value) })}
                disabled={saving}
                className="flex-1"
              />
              <span className="text-sm w-12">{easyCustomization.borderRadius}px</span>
            </div>
          </div>
        </div>
      </div>

      {/* Text Effects */}
      <div>
        <Label>Text Effects</Label>
        <div className="grid grid-cols-2 gap-2 mt-2">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={easyCustomization.textShadow}
              onChange={(e) => updateCustomization({ textShadow: e.target.checked })}
              disabled={saving}
            />
            Text Shadow
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={easyCustomization.textGlow}
              onChange={(e) => updateCustomization({ textGlow: e.target.checked })}
              disabled={saving}
            />
            Text Glow
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={easyCustomization.textBold}
              onChange={(e) => updateCustomization({ textBold: e.target.checked })}
              disabled={saving}
            />
            Bold Text
          </label>
        </div>
      </div>

      {/* Background Gradient */}
      <div>
        <Label>Background Gradient</Label>
        <div className="space-y-3 mt-2">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={easyCustomization.backgroundGradient?.enabled}
              onChange={(e) => updateCustomization({
                backgroundGradient: {
                  ...easyCustomization.backgroundGradient!,
                  enabled: e.target.checked
                }
              })}
              disabled={saving}
            />
            Enable Gradient
          </label>
          
          {easyCustomization.backgroundGradient?.enabled && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="gradient-color1">Color 1</Label>
                <input
                  id="gradient-color1"
                  type="color"
                  value={easyCustomization.backgroundGradient.color1}
                  onChange={(e) => updateCustomization({
                    backgroundGradient: {
                      ...easyCustomization.backgroundGradient!,
                      color1: e.target.value
                    }
                  })}
                  disabled={saving}
                  className="w-full h-10 rounded border"
                />
              </div>
              <div>
                <Label htmlFor="gradient-color2">Color 2</Label>
                <input
                  id="gradient-color2"
                  type="color"
                  value={easyCustomization.backgroundGradient.color2}
                  onChange={(e) => updateCustomization({
                    backgroundGradient: {
                      ...easyCustomization.backgroundGradient!,
                      color2: e.target.value
                    }
                  })}
                  disabled={saving}
                  className="w-full h-10 rounded border"
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const LayoutSection = () => (
    <div className="space-y-4">
      {/* Size Controls */}
      <div>
        <Label>Dimensions</Label>
        <div className="space-y-3 mt-2">
          <div>
            <Label htmlFor="banner-height">Banner Height</Label>
            <div className="flex items-center gap-2 mt-1">
              <input
                id="banner-height"
                type="range"
                min="80"
                max="200"
                value={easyCustomization.bannerHeight}
                onChange={(e) => updateCustomization({ bannerHeight: parseInt(e.target.value) })}
                disabled={saving}
                className="flex-1"
              />
              <span className="text-sm w-12">{easyCustomization.bannerHeight}px</span>
            </div>
          </div>
          
          <div>
            <Label htmlFor="avatar-size">Avatar Size</Label>
            <div className="flex items-center gap-2 mt-1">
              <input
                id="avatar-size"
                type="range"
                min="60"
                max="120"
                value={easyCustomization.avatarSize}
                onChange={(e) => updateCustomization({ avatarSize: parseInt(e.target.value) })}
                disabled={saving}
                className="flex-1"
              />
              <span className="text-sm w-12">{easyCustomization.avatarSize}px</span>
            </div>
          </div>
          
          <div>
            <Label htmlFor="content-padding">Content Padding</Label>
            <div className="flex items-center gap-2 mt-1">
              <input
                id="content-padding"
                type="range"
                min="12"
                max="40"
                value={easyCustomization.contentPadding}
                onChange={(e) => updateCustomization({ contentPadding: parseInt(e.target.value) })}
                disabled={saving}
                className="flex-1"
              />
              <span className="text-sm w-12">{easyCustomization.contentPadding}px</span>
            </div>
          </div>
        </div>
      </div>

      {/* Avatar Frame */}
      <div>
        <Label>Avatar Style</Label>
        <Select 
          value={easyCustomization.avatarFrame} 
          onValueChange={(value: 'circle' | 'square') => updateCustomization({ avatarFrame: value })}
        >
          <SelectTrigger disabled={saving} className="mt-2">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="circle">Circle</SelectItem>
            <SelectItem value="square">Square</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Typography */}
      <div>
        <Label>Typography</Label>
        <div className="space-y-3 mt-2">
          <div>
            <Label htmlFor="font-family">Font Family</Label>
            <Select 
              value={easyCustomization.fontFamily} 
              onValueChange={(value) => updateCustomization({ fontFamily: value })}
            >
              <SelectTrigger disabled={saving} className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="default">Default</SelectItem>
                <SelectItem value="Arial, sans-serif">Arial</SelectItem>
                <SelectItem value="Helvetica, sans-serif">Helvetica</SelectItem>
                <SelectItem value="Georgia, serif">Georgia</SelectItem>
                <SelectItem value="Times New Roman, serif">Times New Roman</SelectItem>
                <SelectItem value="Courier New, monospace">Courier New</SelectItem>
                <SelectItem value="'Comic Sans MS', cursive">Comic Sans MS</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div>
            <Label htmlFor="font-size">Base Font Size</Label>
            <div className="flex items-center gap-2 mt-1">
              <input
                id="font-size"
                type="range"
                min="12"
                max="20"
                value={easyCustomization.fontSize}
                onChange={(e) => updateCustomization({ fontSize: parseInt(e.target.value) })}
                disabled={saving}
                className="flex-1"
              />
              <span className="text-sm w-12">{easyCustomization.fontSize}px</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const CSSSection = () => (
    <div className="space-y-4">
      <div>
        <Label htmlFor="custom-css">Custom CSS</Label>
        <textarea
          id="custom-css"
          value={customCSS}
          onChange={(e) => setCustomCSS(e.target.value)}
          placeholder="Enter your custom CSS here..."
          disabled={saving || cssMode !== 'custom'}
          rows={12}
          className={cn(
            "w-full mt-2 text-sm font-mono resize-none",
            isTheme98 ? "sunken-panel px-2 py-1" : "rounded-md border border-input bg-transparent px-3 py-2 shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
          )}
        />
      </div>
      
      <div className="text-xs text-gray-500 space-y-1">
        <p><strong>Available CSS Classes:</strong></p>
        <p>• .profile-card-container - Main container</p>
        <p>• .profile-banner - Banner section</p>
        <p>• .profile-avatar - Avatar image</p>
        <p>• .profile-display-name - Display name</p>
        <p>• .profile-username - Username</p>
        <p>• .profile-bio - Bio text</p>
        <p>• .profile-badges - Badge container</p>
        <p>• .profile-status - Status indicator</p>
      </div>
    </div>
  );

  return (
    <div className={cn(
      "p-4 rounded-lg border space-y-4",
      isTheme98 ? "sunken-panel" : "bg-gray-50 dark:bg-gray-800"
    )}>
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Advanced Customization</h3>
        <div className="flex gap-1">
          {[
            { id: 'effects', label: '✨ Effects', icon: '✨' },
            { id: 'layout', label: '📐 Layout', icon: '📐' },
            { id: 'css', label: '💻 CSS', icon: '💻' }
          ].map((section) => (
            <Button
              key={section.id}
              variant={activeSection === section.id ? 'primary' : 'outline'}
              size="sm"
              onClick={() => setActiveSection(section.id as any)}
              disabled={saving}
              className="text-xs"
            >
              {section.icon}
            </Button>
          ))}
        </div>
      </div>
      
      <div className="min-h-[300px]">
        {activeSection === 'effects' && <EffectsSection />}
        {activeSection === 'layout' && <LayoutSection />}
        {activeSection === 'css' && <CSSSection />}
      </div>
    </div>
  );
};