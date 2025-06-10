// src/components/ProfileCustomizer/components/AnimationControls.tsx
import React, { useState } from 'react';
import { Label } from '@/components/ui/label-themed';
import { cn } from '@/lib/utils';
import type { EasyCustomization } from '../types';

interface AnimationControlsProps {
  easyCustomization: EasyCustomization;
  setEasyCustomization: React.Dispatch<React.SetStateAction<EasyCustomization>>;
  displayNameAnimation: string;
  setDisplayNameAnimation: (value: any) => void;
  rainbowSpeed: number;
  setRainbowSpeed: (value: number) => void;
  saving: boolean;
  isTheme98: boolean;
}

export const AnimationControls: React.FC<AnimationControlsProps> = ({
  easyCustomization,
  setEasyCustomization,
  displayNameAnimation,
  setDisplayNameAnimation,
  rainbowSpeed,
  setRainbowSpeed,
  saving,
  isTheme98
}) => {
  const [previewAnimation, setPreviewAnimation] = useState('none');

  const animations = [
    { value: 'none', label: 'None', preview: 'Static text' },
    { value: 'rainbow', label: 'Rainbow', preview: 'Colorful flowing text' },
    { value: 'gradient', label: 'Gradient', preview: 'Smooth color blend' },
    { value: 'pulse', label: 'Pulse', preview: 'Rhythmic scaling' },
    { value: 'glow', label: 'Glow', preview: 'Luminous aura effect' }
  ];

  const particleEffects = [
    { id: 'stars', name: 'Floating Stars', icon: '⭐' },
    { id: 'sparkles', name: 'Sparkles', icon: '✨' },
    { id: 'bubbles', name: 'Bubbles', icon: '🫧' },
    { id: 'hearts', name: 'Hearts', icon: '💖' }
  ];

  return (
    <div className={cn(
      "p-4 rounded-lg border space-y-6",
      isTheme98 ? "sunken-panel" : "bg-gray-50 dark:bg-gray-800"
    )}>
      <h3 className="text-lg font-semibold">✨ Animation & Effects</h3>
      
      {/* Display Name Animation */}
      <div>
        <Label>Display Name Animation</Label>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
          {animations.map((animation) => (
            <button
              key={animation.value}
              onClick={() => {
                setDisplayNameAnimation(animation.value);
                setPreviewAnimation(animation.value);
              }}
              disabled={saving}
              className={cn(
                "p-3 text-left rounded-lg border-2 transition-all duration-200",
                displayNameAnimation === animation.value 
                  ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20" 
                  : "hover:border-blue-300",
                "focus:outline-none focus:ring-2 focus:ring-blue-500"
              )}
            >
              <div className="font-medium mb-1">{animation.label}</div>
              <div className="text-xs text-gray-600 dark:text-gray-300">
                {animation.preview}
              </div>
            </button>
          ))}
        </div>
        
        {/* Rainbow Speed Control */}
        {displayNameAnimation === 'rainbow' && (
          <div className="mt-4">
            <Label htmlFor="rainbow-speed">Rainbow Speed</Label>
            <div className="flex items-center gap-2 mt-2">
              <input
                id="rainbow-speed"
                type="range"
                min="1"
                max="10"
                step="0.5"
                value={rainbowSpeed}
                onChange={(e) => setRainbowSpeed(parseFloat(e.target.value))}
                disabled={saving}
                className="flex-1"
              />
              <span className="text-sm w-12">{rainbowSpeed}s</span>
            </div>
            <div className="text-xs text-gray-500 mt-1">
              Lower values = faster animation
            </div>
          </div>
        )}
      </div>

      {/* Particle Effects */}
      <div>
        <Label>Particle Effects</Label>
        <div className="grid grid-cols-2 gap-2 mt-3">
          {particleEffects.map((effect) => (
            <label
              key={effect.id}
              className="flex items-center gap-2 p-2 rounded cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <input
                type="checkbox"
                disabled={saving}
                className="rounded"
              />
              <span>{effect.icon}</span>
              <span className="text-sm">{effect.name}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Hover Effects */}
      <div>
        <Label>Hover Effects</Label>
        <div className="space-y-2 mt-3">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              defaultChecked
              disabled={saving}
            />
            <span className="text-sm">Scale on hover</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              defaultChecked
              disabled={saving}
            />
            <span className="text-sm">Glow on hover</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              disabled={saving}
            />
            <span className="text-sm">Rotation effect</span>
          </label>
        </div>
      </div>

      {/* Animation Preview */}
      <div className="p-4 bg-gray-900 rounded-lg">
        <div className="text-center">
          <div className="text-sm text-gray-400 mb-2">Animation Preview</div>
          <div
            className={cn(
              "text-xl font-bold transition-all duration-300",
              previewAnimation === 'rainbow' && 'bg-gradient-to-r from-red-500 via-yellow-500 to-blue-500 bg-clip-text text-transparent animate-pulse',
              previewAnimation === 'gradient' && 'bg-gradient-to-r from-purple-500 to-pink-500 bg-clip-text text-transparent',
              previewAnimation === 'pulse' && 'animate-pulse',
              previewAnimation === 'glow' && 'drop-shadow-lg'
            )}
            style={{
              color: previewAnimation === 'none' ? '#ffffff' : undefined,
              textShadow: previewAnimation === 'glow' ? '0 0 20px currentColor' : undefined
            }}
          >
            Sample Display Name
          </div>
        </div>
      </div>
    </div>
  );
};