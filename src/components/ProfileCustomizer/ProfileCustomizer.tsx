// src/components/ProfileCustomizer/ProfileCustomizer.tsx
'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button-themed';
import { cn } from '@/lib/utils';
import { getDefaultProfileCSS } from '@/lib/SafeCSS';

// Hooks
import { useProfileCustomizer } from './hooks/useProfileCustomizer';
import { useProfileData } from './hooks/useProfileData';
import { useEasyMode } from './hooks/useEasyMode';

// Components
import { ProfileCard } from '../ProfileCard';
import { BasicInfoSection } from './components/BasicInfoSection';
import { DisplayNameStyling } from './components/DisplayNameStyling';
import { ImageUploadSection } from './components/ImageUploadSection';
import { BadgeManager } from './components/BadgeManager';
import { ContextMenu } from './components/ContextMenu';
import { TypographyPopup } from './components/TypographyPopup';
import { ProfileCustomizerErrorBoundary } from './components/ErrorBoundary';

// Utils
import { DEFAULT_EASY_CUSTOMIZATION } from './utils/constants';
import type { ProfileCustomizerProps } from './types';

const ProfileCustomizer: React.FC<ProfileCustomizerProps> = ({ 
  isOpen, 
  onClose 
}) => {
  const [showCustomCSS, setShowCustomCSS] = useState(false);
  const [showProfileCard, setShowProfileCard] = useState(false);

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

  // Enhanced profile loaded callback with comprehensive error handling
  const handleProfileLoaded = useCallback(({ user, profile }: { user: any; profile: any }) => {
    console.log('ProfileCustomizer: Profile loaded callback', { user: user?.id, profile: !!profile });
    
    if (!mountedRef.current) {
      console.log('ProfileCustomizer: Component unmounted, ignoring profile load');
      return;
    }
    
    try {
      setCurrentUser(user);
      
      if (profile) {
        // Validate and set profile data with fallbacks
        const safeProfile = {
          profile_card_css: typeof profile.profile_card_css === 'string' ? profile.profile_card_css : getDefaultProfileCSS(),
          bio: typeof profile.bio === 'string' ? profile.bio : '',
          display_name: typeof profile.display_name === 'string' ? profile.display_name : '',
          username: typeof profile.username === 'string' ? profile.username : '',
          pronouns: typeof profile.pronouns === 'string' ? profile.pronouns : '',
          status: ['online', 'idle', 'dnd', 'offline'].includes(profile.status) ? profile.status : 'online',
          display_name_color: typeof profile.display_name_color === 'string' ? profile.display_name_color : '#ffffff',
          display_name_animation: ['none', 'rainbow', 'gradient', 'pulse', 'glow'].includes(profile.display_name_animation) ? profile.display_name_animation : 'none',
          rainbow_speed: typeof profile.rainbow_speed === 'number' && profile.rainbow_speed > 0 ? profile.rainbow_speed : 3,
          avatar_url: typeof profile.avatar_url === 'string' ? profile.avatar_url : null,
          banner_url: typeof profile.banner_url === 'string' ? profile.banner_url : null,
          badges: Array.isArray(profile.badges) ? profile.badges : [],
          easy_customization_data: profile.easy_customization_data
        };
        
        // Set profile data with validation
        setCustomCSS(safeProfile.profile_card_css);
        setBio(safeProfile.bio);
        setDisplayName(safeProfile.display_name);
        setUsername(safeProfile.username);
        setOriginalUsername(safeProfile.username);
        setPronouns(safeProfile.pronouns);
        setStatus(safeProfile.status);
        setDisplayNameColor(safeProfile.display_name_color);
        setDisplayNameAnimation(safeProfile.display_name_animation);
        setRainbowSpeed(safeProfile.rainbow_speed);
        setAvatarUrl(safeProfile.avatar_url);
        setBannerUrl(safeProfile.banner_url);
        setBadges(safeProfile.badges);
        
        // Set previews
        if (safeProfile.avatar_url) setAvatarPreview(safeProfile.avatar_url);
        if (safeProfile.banner_url) setBannerPreview(safeProfile.banner_url);
        
        // Enhanced easy customization parsing
        try {
          if (safeProfile.easy_customization_data) {
            let parsedData;
            
            if (typeof safeProfile.easy_customization_data === 'string') {
              parsedData = JSON.parse(safeProfile.easy_customization_data);
            } else if (typeof safeProfile.easy_customization_data === 'object') {
              parsedData = safeProfile.easy_customization_data;
            }
            
            if (parsedData && typeof parsedData === 'object' && parsedData.elements) {
              // Validate the structure
              const validatedCustomization = {
                ...DEFAULT_EASY_CUSTOMIZATION,
                ...parsedData,
                elements: {
                  ...DEFAULT_EASY_CUSTOMIZATION.elements,
                  ...parsedData.elements
                }
              };
              
              // Validate each element
              Object.keys(validatedCustomization.elements).forEach(key => {
                const element = validatedCustomization.elements[key];
                if (!element || typeof element !== 'object') {
                  validatedCustomization.elements[key] = DEFAULT_EASY_CUSTOMIZATION.elements[key] || {
                    x: 0, y: 0, scale: 1, visible: true
                  };
                }
              });
              
              setEasyCustomization(validatedCustomization);
              console.log('Successfully loaded easy customization data');
            } else {
              console.warn('Easy customization data has invalid structure, using defaults');
              setEasyCustomization(DEFAULT_EASY_CUSTOMIZATION);
            }
          } else {
            console.log('No easy customization data found, using defaults');
            setEasyCustomization(DEFAULT_EASY_CUSTOMIZATION);
          }
        } catch (e) {
          console.error('Failed to parse easy customization data:', e);
          setEasyCustomization(DEFAULT_EASY_CUSTOMIZATION);
        }
      } else {
        // Initialize with proper defaults for new profile
        console.log('No profile found, initializing with defaults');
        setCustomCSS(getDefaultProfileCSS());
        setEasyCustomization(DEFAULT_EASY_CUSTOMIZATION);
        setStatus('online');
        setDisplayNameColor('#ffffff');
        setDisplayNameAnimation('none');
        setRainbowSpeed(3);
      }
    } catch (error) {
      console.error('Error in handleProfileLoaded:', error);
      // Fallback to defaults on any error
      setCustomCSS(getDefaultProfileCSS());
      setEasyCustomization(DEFAULT_EASY_CUSTOMIZATION);
      setStatus('online');
      setDisplayNameColor('#ffffff');
      setDisplayNameAnimation('none');
      setRainbowSpeed(3);
    }
  }, [
    mountedRef, setCurrentUser, setCustomCSS, setBio, setDisplayName, setUsername,
    setOriginalUsername, setPronouns, setStatus, setDisplayNameColor,
    setDisplayNameAnimation, setRainbowSpeed, setAvatarUrl, setBannerUrl,
    setBadges, setAvatarPreview, setBannerPreview, setEasyCustomization
  ]);

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
    onProfileLoaded: handleProfileLoaded,
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

  // Load profile when component opens - FIXED to prevent infinite loops
  useEffect(() => {
    if (isOpen && !loading && !saving) {
      console.log('ProfileCustomizer: Component opened, loading profile');
      loadCurrentProfile();
    }
  }, [isOpen]); // Only depend on isOpen

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

  const toggleProfileCard = () => {
    setShowProfileCard(!showProfileCard);
  };

  if (!isOpen) return null;

  return (
    <ProfileCustomizerErrorBoundary>
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
              <div className="flex gap-2">
                <Button 
                  onClick={toggleProfileCard}
                  variant="outline"
                  disabled={saving}
                  size={isMobile ? "sm" : "default"}
                >
                  {showProfileCard ? 'Hide' : 'Show'} Profile Card
                </Button>
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
                    {/* Mock Profile Preview using actual ProfileCard styles */}
                    <div 
                      ref={previewRef}
                      className="flex justify-center items-center min-h-full p-4"
                      onMouseMove={cssMode === 'easy' ? handlePreviewMouseMove : undefined}
                      onMouseUp={cssMode === 'easy' ? handlePreviewMouseUp : undefined}
                      onMouseLeave={cssMode === 'easy' ? handlePreviewMouseUp : undefined}
                    >
                      <style dangerouslySetInnerHTML={{ 
                        __html: customCSS || getDefaultProfileCSS() 
                      }} />
                      
                      <div 
                        className={cn(
                          "window bg-white dark:bg-gray-800 p-4 rounded shadow-lg max-w-sm w-80",
                          cssMode === 'easy' && "editing-mode"
                        )}
                        style={{
                          userSelect: cssMode === 'easy' ? 'none' : 'auto'
                        }}
                      >
                        <div className="title-bar mb-3">
                          <div className="title-bar-text">User Profile</div>
                        </div>

                        <div className="window-body">
                          <div className="space-y-3">
                            {/* Avatar */}
                            {(avatarPreview || avatarUrl) && (
                              <div 
                                className={cn(
                                  "text-center profile-avatar-container",
                                  selectedElements.includes('profile-avatar') && "element-selected"
                                )}
                                onMouseDown={cssMode === 'easy' ? (e) => handlePreviewMouseDown(e, 'profile-avatar') : undefined}
                                onContextMenu={cssMode === 'easy' ? (e) => handlePreviewContextMenu(e, 'profile-avatar') : undefined}
                              >
                                <img 
                                  src={avatarPreview || avatarUrl || ''} 
                                  alt="Avatar" 
                                  className="profile-avatar w-16 h-16 rounded-full mx-auto"
                                />
                              </div>
                            )}

                            {/* Name */}
                            <div className="text-center">
                              {displayName && (
                                <h3 
                                  className={cn(
                                    "profile-display-name font-bold text-lg",
                                    displayNameAnimation === 'rainbow' && 'display-name-rainbow',
                                    displayNameAnimation === 'gradient' && 'display-name-gradient',
                                    displayNameAnimation === 'pulse' && 'display-name-pulse',
                                    displayNameAnimation === 'glow' && 'display-name-glow',
                                    selectedElements.includes('profile-display-name') && "element-selected"
                                  )}
                                  style={{ 
                                    color: displayNameAnimation === 'none' ? displayNameColor : undefined 
                                  }}
                                  onMouseDown={cssMode === 'easy' ? (e) => handlePreviewMouseDown(e, 'profile-display-name') : undefined}
                                  onContextMenu={cssMode === 'easy' ? (e) => handlePreviewContextMenu(e, 'profile-display-name') : undefined}
                                  onDoubleClick={cssMode === 'easy' ? (e) => handleTextElementRightClick(e, 'profile-display-name') : undefined}
                                >
                                  {displayName}
                                </h3>
                              )}
                              
                              {username && (
                                <div 
                                  className={cn(
                                    "profile-username text-sm text-gray-500",
                                    selectedElements.includes('profile-username') && "element-selected"
                                  )}
                                  onMouseDown={cssMode === 'easy' ? (e) => handlePreviewMouseDown(e, 'profile-username') : undefined}
                                  onContextMenu={cssMode === 'easy' ? (e) => handlePreviewContextMenu(e, 'profile-username') : undefined}
                                  onDoubleClick={cssMode === 'easy' ? (e) => handleTextElementRightClick(e, 'profile-username') : undefined}
                                >
                                  @{username}
                                </div>
                              )}
                              
                              {pronouns && (
                                <p 
                                  className={cn(
                                    "profile-pronouns text-sm text-gray-500",
                                    selectedElements.includes('profile-pronouns') && "element-selected"
                                  )}
                                  onMouseDown={cssMode === 'easy' ? (e) => handlePreviewMouseDown(e, 'profile-pronouns') : undefined}
                                  onContextMenu={cssMode === 'easy' ? (e) => handlePreviewContextMenu(e, 'profile-pronouns') : undefined}
                                  onDoubleClick={cssMode === 'easy' ? (e) => handleTextElementRightClick(e, 'profile-pronouns') : undefined}
                                >
                                  ({pronouns})
                                </p>
                              )}
                            </div>

                            {/* Status */}
                            {status && (
                              <div 
                                className={cn(
                                  "profile-status-text flex items-center justify-center gap-2",
                                  selectedElements.includes('profile-status-text') && "element-selected"
                                )}
                                onMouseDown={cssMode === 'easy' ? (e) => handlePreviewMouseDown(e, 'profile-status-text') : undefined}
                                onContextMenu={cssMode === 'easy' ? (e) => handlePreviewContextMenu(e, 'profile-status-text') : undefined}
                              >
                                <div 
                                  className={cn(
                                    "profile-status w-3 h-3 rounded-full",
                                    status === 'online' && 'bg-green-500',
                                    status === 'idle' && 'bg-yellow-500',
                                    status === 'dnd' && 'bg-red-500',
                                    status === 'offline' && 'bg-gray-500'
                                  )}
                                />
                                <span className="text-sm capitalize">{status}</span>
                              </div>
                            )}

                            {/* Bio */}
                            {bio && (
                              <div>
                                <h4 className="font-semibold text-sm">About</h4>
                                <p 
                                  className={cn(
                                    "profile-bio text-sm text-gray-600 dark:text-gray-300",
                                    selectedElements.includes('profile-bio') && "element-selected"
                                  )}
                                  onMouseDown={cssMode === 'easy' ? (e) => handlePreviewMouseDown(e, 'profile-bio') : undefined}
                                  onContextMenu={cssMode === 'easy' ? (e) => handlePreviewContextMenu(e, 'profile-bio') : undefined}
                                  onDoubleClick={cssMode === 'easy' ? (e) => handleTextElementRightClick(e, 'profile-bio') : undefined}
                                >
                                  {bio}
                                </p>
                              </div>
                            )}

                            {/* Badges */}
                            {badges.length > 0 && (
                              <div>
                                <h4 className="font-semibold text-sm mb-2">Badges</h4>
                                <div 
                                  className={cn(
                                    "profile-badges flex flex-wrap gap-1",
                                    selectedElements.includes('profile-badges') && "element-selected"
                                  )}
                                  onMouseDown={cssMode === 'easy' ? (e) => handlePreviewMouseDown(e, 'profile-badges') : undefined}
                                  onContextMenu={cssMode === 'easy' ? (e) => handlePreviewContextMenu(e, 'profile-badges') : undefined}
                                >
                                  {badges.map((badge, index) => (
                                    <img 
                                      key={badge.id}
                                      src={badge.url}
                                      alt={badge.name || 'Badge'}
                                      title={badge.name}
                                      className="profile-badge w-6 h-6 rounded"
                                      onError={(e) => {
                                        const target = e.target as HTMLImageElement;
                                        target.style.display = 'none';
                                      }}
                                    />
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
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

      {/* Actual ProfileCard Component for Testing */}
      {showProfileCard && currentUser && (
        <ProfileCard
          userId={currentUser.id}
          isOpen={showProfileCard}
          onClose={() => setShowProfileCard(false)}
          onScrollToggle={() => {}}
          clickPosition={{ x: window.innerWidth / 2, y: window.innerHeight / 2 }}
        />
      )}

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
    </ProfileCustomizerErrorBoundary>
  );
};

export default ProfileCustomizer;