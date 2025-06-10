// src/components/ProfileCustomizer/components/LayoutPresets.tsx
import React from 'react';
import { cn } from '@/lib/utils';
import type { EasyCustomization } from '../types';

interface LayoutPresetsProps {
  easyCustomization: EasyCustomization;
  setEasyCustomization: React.Dispatch<React.SetStateAction<EasyCustomization>>;
  saving: boolean;
  isTheme98: boolean;
}

export const LayoutPresets: React.FC<LayoutPresetsProps> = ({
  easyCustomization,
  setEasyCustomization,
  saving,
  isTheme98
}) => {
  const layouts = [
    {
      name: 'Classic',
      description: 'Traditional profile layout',
      icon: '📋',
      config: {
        bannerHeight: 120,
        avatarSize: 80,
        contentPadding: 16,
        borderRadius: 16
      }
    },
    {
      name: 'Compact',
      description: 'Space-efficient design',
      icon: '📱',
      config: {
        bannerHeight: 80,
        avatarSize: 60,
        contentPadding: 12,
        borderRadius: 12
      }
    },
    {
      name: 'Spacious',
      description: 'Generous spacing',
      icon: '📺',
      config: {
        bannerHeight: 160,
        avatarSize: 100,
        contentPadding: 24,
        borderRadius: 20
      }
    },
    {
      name: 'Minimal',
      description: 'Clean and simple',
      icon: '⚪',
      config: {
        bannerHeight: 100,
        avatarSize: 70,
        contentPadding: 20,
        borderRadius: 8
      }
    }
  ];

  const applyLayout = (layout: typeof layouts[0]) => {
    setEasyCustomization(prev => ({
      ...prev,
      ...layout.config
    }));
  };

  return (
    <div className={cn(
      "p-4 rounded-lg border space-y-4",
      isTheme98 ? "sunken-panel" : "bg-gray-50 dark:bg-gray-800"
    )}>
      <h3 className="text-lg font-semibold">📐 Layout Presets</h3>
      
      <div className="grid grid-cols-2 gap-3">
        {layouts.map((layout) => (
          <button
            key={layout.name}
            onClick={() => applyLayout(layout)}
            disabled={saving}
            className={cn(
              "p-3 text-left rounded-lg border-2 transition-all duration-200 hover:scale-105",
              "focus:outline-none focus:ring-2 focus:ring-blue-500",
              isTheme98 ? "button" : "hover:border-blue-500"
            )}
          >
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg">{layout.icon}</span>
              <span className="font-medium">{layout.name}</span>
            </div>
            <div className="text-xs text-gray-600 dark:text-gray-300">
              {layout.description}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};