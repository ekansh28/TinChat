// src/components/ProfileCustomizer/ProfileCustomizer.tsx
'use client';

import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button-themed';
import { cn } from '@/lib/utils';
import { getDefaultProfileCSS } from '@/lib/SafeCSS';

// Hooks
import { useProfileCustomizer } from './hooks/useProfileCustomizer';
import { useProfileData } from './hooks/useProfileData';
import { useEasyMode } from './hooks/useEasyMode';

// Components
import { EnhancedProfilePreview } from './EnhancedProfilePreview';
import { BasicInfoSection } from './components/BasicInfoSection';
import { DisplayNameStyling } from './components/DisplayNameStyling';
import { ImageUploadSection } from './components/ImageUploadSection';
import { BadgeManager } from './components/BadgeManager';
import { ContextMenu } from './components/ContextMenu';
import { TypographyPopup } from './components/TypographyPopup';

// Utils
import { DEFAULT_EASY_CUSTOMIZATION } from './utils/constants';
import type { ProfileCustomizerProps } from './types';

export const ProfileCustomizer: React.FC<ProfileCustomizerProps> = ({ 
  isOpen, 
  onClose 
}) => {
  const [showCustomCSS, setShowCustomCSS] = useState(false);

  const {
    // CSS and mode states
    customCSS,
    setCustomCSS,
    cssMode,
    setCSSMode,
    positionMode,
    setPositionMode,
    
    // Easy customization
    easyCustomization,
    setEasyCustomization,
    
    // Profile data
    bio,
    setBio,
    displayName,
    setDisplayName,
    username,
    setUsername,
    pronouns,
    setPronouns,
    status,
    setStatus,
    displayNameColor,
    setDisplayNameColor,
    displayNameAnimation,
    setDisplayNameAnimation,
    rainbowSpeed,
    setRainbowSpeed,
    
    // Files
    avatarFile,
    setAvatarFile,
    avatarPreview,
    setAvatarPreview,
    avatarUrl,
    setAvatarUrl,
    bannerFile,
    setBannerFile,
    bannerPreview,
    setBannerPreview,
    bannerUrl,
    setBannerUrl,
    
    // Badges
    badges,
    setBadges,
    isBadgeManagerOpen,
    setIsBadgeManagerOpen,
    
    // Loading states
    loading,
    setLoading,
    saving,
    setSaving,
    currentUser,
    setCurrentUser,
    originalUsername,
    setOriginalUsername,
    
    // Refs
    mountedRef,
    avatarFileInputRef,
    bannerFileInputRef,
    previewRef,
    
    // Computed
    isTheme98,
    isMobile,
  } = useProfileCustomizer();

  // Profile data management
  const {
    usernameAvailable,
    loadCurrentProfile,
    handleSave: saveProfile,
  } = useProfileData({
    username,
    originalUsername,
    currentUser,
    mountedRef,
    onProfileLoaded: ({ user, profile }) => {
      console.log('ProfileCustomizer: Profile loaded callback', { user, profile });
      setCurrentUser(user);
      if (profile) {
        // Always set default CSS first to prevent undefined states
        const profileCSS = profile.profile_card_css || getDefaultProfileCSS();
        setCustomCSS(profileCSS);
        
        setBio(profile.bio || '');
        setDisplayName(profile.display_name || '');
        setUsername(profile.username || '');
        setOriginalUsername(profile.username || '');
        setPronouns(profile.pronouns || '');
        setStatus(profile.status || 'online');
        setDisplayNameColor(profile.display_name_color || '#ffffff');
        setDisplayNameAnimation(profile.display_name_animation || 'none');
        setRainbowSpeed(profile.rainbow_speed || 3);
        setAvatarUrl(profile.avatar_url);
        setBannerUrl(profile.banner_url);
        setBadges(profile.badges ? JSON.parse(profile.badges) : []);
        
        // Set previews
        if (profile.avatar_url) setAvatarPreview(profile.avatar_url);
        if (profile.banner_url) setBannerPreview(profile.banner_url);
        
        // Safe parsing with comprehensive error handling
        try {
          if (profile.easy_customization_data && typeof profile.easy_customization_data === 'string') {
            const parsedData = JSON.parse(profile.easy_customization_data);
            console.log('Successfully parsed easy customization data:', parsedData);
            
            // Validate the parsed data structure
            if (parsedData && typeof parsedData === 'object' && parsedData.elements) {
              setEasyCustomization({ 
                ...DEFAULT_EASY_CUSTOMIZATION, 
                ...parsedData,
                // Ensure elements always exists with proper defaults
                elements: {
                  ...DEFAULT_EASY_CUSTOMIZATION.elements,
                  ...parsedData.elements
                }
              });
            } else {
              console.warn('Parsed easy customization data is invalid, using defaults');
              setEasyCustomization(DEFAULT_EASY_CUSTOMIZATION);
            }
          } else {
            console.log('No easy customization data found, using defaults');
            setEasyCustomization(DEFAULT_EASY_CUSTOMIZATION);
          }
        } catch (e) {
          console.error('Failed to parse easy customization data:', e);
          console.log('Raw easy_customization_data:', profile.easy_customization_data);
          // Always fallback to defaults instead of leaving undefined
          setEasyCustomization(DEFAULT_EASY_CUSTOMIZATION);
        }
      } else {
        // Initialize with proper defaults for new profile
        console.log('No profile found, initializing with defaults');
        setCustomCSS(getDefaultProfileCSS());
        setEasyCustomization(DEFAULT_EASY_CUSTOMIZATION);
        setStatus('online'); // Set default status to prevent "Offline" showing
        setDisplayNameColor('#ffffff');
        setDisplayNameAnimation('none');
        setRainbowSpeed(3);
      }
    }
  });

  // Easy mode drag & drop
  const {
    selectedElement,
    selectedElements,
    contextMenu,
    setContextMenu,
    typographyPopup,
    setTypographyPopup,
    typographyPopupRef,
    handlePreviewMouseDown,
    handlePreviewMouseMove,
    handlePreviewMouseUp,
    handlePreviewContextMenu,
    handleTextElementRightClick,
  } = useEasyMode({
    cssMode,
    easyCustomization,
    setEasyCustomization,
    positionMode
  });

  // Load profile when component opens
  useEffect(() => {
    if (isOpen) {
      console.log('ProfileCustomizer: Component opened, loading profile');
      loadCurrentProfile();
    }
  }, [isOpen, loadCurrentProfile]);

  // Ensure default CSS is set when CSS mode changes
  useEffect(() => {
    if (cssMode === 'custom' && !customCSS) {
      console.log('Setting default CSS for custom mode');
      setCustomCSS(getDefaultProfileCSS());
    }
  }, [cssMode, customCSS, setCustomCSS]);

  // Initialize CSS properly when component mounts
  useEffect(() => {
    if (!customCSS && cssMode === 'custom') {
      setCustomCSS(getDefaultProfileCSS());
    }
  }, [customCSS, cssMode, setCustomCSS]);

  // Handle save
  const handleSave = async () => {
    const success = await saveProfile({
      customCSS: customCSS || getDefaultProfileCSS(), // Ensure CSS is never empty
      bio,
      displayName,
      username,
      pronouns,
      status,
      displayNameColor,
      displayNameAnimation,
      rainbowSpeed,
      avatarFile,
      avatarUrl,
      bannerFile,
      bannerUrl,
      badges,
      easyCustomization,
    });

    if (success) {
      setOriginalUsername(username);
      setTimeout(() => {
        if (mountedRef.current) {
          onClose();
        }
      }, 500);
    }
  };

  const handleReset = () => {
    if (cssMode === 'custom') {
      setCustomCSS(getDefaultProfileCSS());
    } else {
      setEasyCustomization(DEFAULT_EASY_CUSTOMIZATION);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999] p-2 overflow-hidden">
        <div className={cn(
          'window flex flex-col relative',
          'w-full h-full max-w-none max-h-none',
          isMobile ? 'mx-0 my-0' : 'max-w-7xl max-h-[95vh] mx-4',
          isTheme98 ? '' : 'bg-white dark:bg-gray-800 rounded-lg'
        )}>
          
          {/* Title Bar */}
          <div className={cn("title-bar", isTheme98 ? '' : 'border-b p-4')}>
            <div className="flex items-center justify-between">
              <div className="title-bar-text">Enhanced Profile Customizer</div>
              <Button 
                onClick={onClose} 
                variant={isTheme98 ? undefined : "outline"}
                disabled={saving}
                size={isMobile ? "sm" : "default"}
              >
                {saving ? 'Saving...' : (isMobile ? '✕' : 'Close')}
              </Button>
            </div>
          </div>

          {/* Main Content */}
          <div className="window-body window-body-content flex-grow overflow-hidden p-2">
            {loading ? (
              <div className="text-center py-8">
                <p className="animate-pulse">Loading profile data...</p>
              </div>
            ) : (
              <div className="grid gap-4 h-full grid-cols-1 xl:grid-cols-2">
                
                {/* Left Column - Form Controls */}
                <div className="space-y-4 overflow-y-auto pr-2">
                  
                  {/* Mode Toggle */}
                  <div className={cn(
                    "p-4 rounded-lg border",
                    isTheme98 ? "sunken-panel" : "bg-gray-50 dark:bg-gray-800"
                  )}>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-lg font-semibold">Customization Mode</h3>
                      <div className="flex gap-2">
                        <Button
                          variant={cssMode === 'easy' ? 'primary' : 'outline'}
                          size="sm"
                          onClick={() => setCSSMode('easy')}
                          disabled={saving}
                        >
                          Easy Mode
                        </Button>
                        <Button
                          variant={cssMode === 'custom' ? 'primary' : 'outline'}
                          size="sm"
                          onClick={() => setCSSMode('custom')}
                          disabled={saving}
                        >
                          Custom CSS
                        </Button>
                      </div>
                    </div>
                    
                    {cssMode === 'easy' && (
                      <div className="flex items-center gap-2">
                        <Button
                          variant={positionMode === 'normal' ? 'primary' : 'outline'}
                          size="sm"
                          onClick={() => setPositionMode('normal')}
                          disabled={saving}
                        >
                          Free Move
                        </Button>
                        <Button
                          variant={positionMode === 'grid' ? 'primary' : 'outline'}
                          size="sm"
                          onClick={() => setPositionMode('grid')}
                          disabled={saving}
                        >
                          Grid Snap
                        </Button>
                      </div>
                    )}

                    {/* Custom CSS Editor */}
                    {cssMode === 'custom' && (
                      <div className="mt-4">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-medium">Custom CSS</h4>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setShowCustomCSS(!showCustomCSS)}
                          >
                            {showCustomCSS ? 'Hide CSS' : 'Show CSS Editor'}
                          </Button>
                        </div>
                        
                        {showCustomCSS && (
                          <div className="mt-3">
                            <textarea
                              value={customCSS}
                              onChange={(e) => setCustomCSS(e.target.value)}
                              placeholder="Enter your custom CSS here..."
                              disabled={saving}
                              rows={12}
                              className={cn(
                                "w-full text-sm font-mono resize-none",
                                isTheme98 
                                  ? "sunken-panel px-2 py-1" 
                                  : "rounded-md border border-input bg-transparent px-3 py-2 shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                              )}
                            />
                            <div className="text-xs text-gray-500 mt-2">
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
                        )}
                      </div>
                    )}
                  </div>

                  <BasicInfoSection
                    username={username}
                    setUsername={setUsername}
                    displayName={displayName}
                    setDisplayName={setDisplayName}
                    pronouns={pronouns}
                    setPronouns={setPronouns}
                    status={status}
                    setStatus={setStatus}
                    bio={bio}
                    setBio={setBio}
                    usernameAvailable={usernameAvailable}
                    saving={saving}
                    isTheme98={isTheme98}
                  />
                  
                  <DisplayNameStyling
                    displayNameColor={displayNameColor}
                    setDisplayNameColor={setDisplayNameColor}
                    displayNameAnimation={displayNameAnimation}
                    setDisplayNameAnimation={setDisplayNameAnimation}
                    rainbowSpeed={rainbowSpeed}
                    setRainbowSpeed={setRainbowSpeed}
                    saving={saving}
                    isTheme98={isTheme98}
                  />
                  
                  <ImageUploadSection
                    avatarFile={avatarFile}
                    setAvatarFile={setAvatarFile}
                    avatarPreview={avatarPreview}
                    setAvatarPreview={setAvatarPreview}
                    avatarUrl={avatarUrl}
                    setAvatarUrl={setAvatarUrl}
                    bannerFile={bannerFile}
                    setBannerFile={setBannerFile}
                    bannerPreview={bannerPreview}
                    setBannerPreview={setBannerPreview}
                    bannerUrl={bannerUrl}
                    setBannerUrl={setBannerUrl}
                    avatarFileInputRef={avatarFileInputRef}
                    bannerFileInputRef={bannerFileInputRef}
                    saving={saving}
                    isTheme98={isTheme98}
                    mountedRef={mountedRef}
                  />
                  
                  <BadgeManager
                    badges={badges}
                    setBadges={setBadges}
                    isBadgeManagerOpen={isBadgeManagerOpen}
                    setIsBadgeManagerOpen={setIsBadgeManagerOpen}
                    saving={saving}
                    isTheme98={isTheme98}
                  />
                  
                  {/* Action Buttons */}
                  <div className="flex flex-col space-y-3">
                    <Button 
                      onClick={handleSave} 
                      disabled={saving || !username || username.length < 3 || usernameAvailable === false}
                      className="w-full"
                      size="lg"
                    >
                      {saving ? 'Saving Changes...' : 'Save Profile Changes'}
                    </Button>
                    
                    <div className="flex gap-2">
                      <Button 
                        variant="outline"
                        onClick={handleReset}
                        disabled={saving}
                        className="flex-1"
                      >
                        Reset to Default
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Right Column - Preview */}
                <div className="flex flex-col">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-lg font-semibold">Live Preview</h3>
                    {cssMode === 'easy' && (
                      <div className="text-xs text-gray-500">
                        {positionMode === 'grid' ? 'Grid Snap: ON' : 'Free Move'}
                        {selectedElements.length > 1 && ` • ${selectedElements.length} selected`}
                      </div>
                    )}
                  </div>
                  <div className="flex-1 p-3 overflow-auto bg-gray-100 dark:bg-gray-900 rounded-lg">
                    <EnhancedProfilePreview
                      customCSS={customCSS || getDefaultProfileCSS()}
                      bio={bio}
                      displayName={displayName}
                      username={username}
                      pronouns={pronouns}
                      status={status}
                      displayNameColor={displayNameColor}
                      displayNameAnimation={displayNameAnimation}
                      avatarPreview={avatarPreview}
                      avatarUrl={avatarUrl}
                      bannerPreview={bannerPreview}
                      bannerUrl={bannerUrl}
                      badges={badges}
                      cssMode={cssMode}
                      isTheme98={isTheme98}
                      onMouseDown={cssMode === 'easy' ? handlePreviewMouseDown : undefined}
                      onMouseMove={cssMode === 'easy' ? handlePreviewMouseMove : undefined}
                      onMouseUp={cssMode === 'easy' ? handlePreviewMouseUp : undefined}
                      onContextMenu={cssMode === 'easy' ? handlePreviewContextMenu : undefined}
                      onRightClick={cssMode === 'easy' ? handleTextElementRightClick : undefined}
                      previewRef={previewRef}
                      selectedElement={selectedElement}
                      selectedElements={selectedElements}
                    />
                  </div>
                  
                  {cssMode === 'easy' && (
                    <div className="mt-2 text-xs text-gray-500 space-y-1">
                      <p>• Click and drag elements to move them</p>
                      <p>• Right-click for context menu</p>
                      <p>• Double-click text elements for typography options</p>
                      <p>• Hold Shift to select multiple elements</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Context Menu */}
      <ContextMenu
        contextMenu={contextMenu}
        setContextMenu={setContextMenu}
        easyCustomization={easyCustomization}
        setEasyCustomization={setEasyCustomization}
        isTheme98={isTheme98}
      />

      {/* Typography Popup */}
      <TypographyPopup
        typographyPopup={typographyPopup}
        setTypographyPopup={setTypographyPopup}
        easyCustomization={easyCustomization}
        setEasyCustomization={setEasyCustomization}
        typographyPopupRef={typographyPopupRef}
        isTheme98={isTheme98}
      />
    </>
  );
};

export default ProfileCustomizer;