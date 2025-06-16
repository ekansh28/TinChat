// src/components/ProfileCustomizer/ProfileCustomizer.tsx
'use client';

import React, { useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button-themed';
import { cn } from '@/lib/utils';
import { getDefaultProfileCSS } from '@/lib/SafeCSS';
import { useProfileCustomizer } from './hooks/useProfileCustomizer';
import { EnhancedProfilePreview } from './EnhancedProfilePreview';
import { CustomizerPanel } from './components/CustomizerPanel';
import { DEFAULT_EASY_CUSTOMIZATION } from './utils/constants';
import type { ProfileCustomizerProps } from './types';

const ProfileCustomizer: React.FC<ProfileCustomizerProps> = ({ isOpen, onClose }) => {
  const {
    customCSS,
    setCustomCSS,
    cssMode,
    setCSSMode,
    easyCustomization,
    setEasyCustomization,
    loading,
    saving,
    profile,
    badges,
    isTheme98,
    isMobile,
    handleSave,
    handleReset,
    mountedRef,
    previewRef
  } = useProfileCustomizer();

  useEffect(() => {
    if (isOpen && !loading && !saving) {
      // Initialize with defaults if needed
      if (!customCSS) {
        setCustomCSS(getDefaultProfileCSS());
      }
      if (!easyCustomization) {
        setEasyCustomization(DEFAULT_EASY_CUSTOMIZATION);
      }
    }
  }, [isOpen, loading, saving]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-2">
      <div className={cn(
        'window flex flex-col w-full h-full max-w-7xl max-h-[95vh]',
        isTheme98 ? '' : 'bg-white dark:bg-gray-800 rounded-lg'
      )}>
        {/* Title Bar */}
        <div className={cn("title-bar", isTheme98 ? '' : 'border-b p-4')}>
          <div className="flex items-center justify-between">
            <div className="title-bar-text">Profile Customizer</div>
            <Button onClick={onClose} variant="outline" disabled={saving}>
              {saving ? 'Saving...' : 'Close'}
            </Button>
          </div>
        </div>

        {/* Main Content */}
        <div className="window-body flex-grow overflow-hidden p-4">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <span className="animate-pulse">Loading...</span>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-full">
              {/* Left Panel - Controls */}
              <CustomizerPanel
                cssMode={cssMode}
                setCSSMode={setCSSMode}
                customCSS={customCSS}
                setCustomCSS={setCustomCSS}
                easyCustomization={easyCustomization}
                setEasyCustomization={setEasyCustomization}
                profile={profile}
                badges={badges}
                saving={saving}
                onSave={handleSave}
                onReset={handleReset}
                isTheme98={isTheme98}
              />

              {/* Right Panel - Preview */}
              <div className="h-full overflow-auto">
                <div className="sticky top-0 bg-card p-4 rounded-lg">
                  <h3 className="text-lg font-semibold mb-4">Live Preview</h3>
                  <EnhancedProfilePreview
                    ref={previewRef}
                    customCSS={customCSS}
                    profile={profile}
                    badges={badges}
                    cssMode={cssMode}
                    easyCustomization={easyCustomization}
                    isTheme98={isTheme98}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProfileCustomizer;