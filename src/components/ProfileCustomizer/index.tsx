// src/components/ProfileCustomizer/index.tsx - FIXED WITH SCROLL LOCK
'use client';
import './ProfileCustomizer.css';
import React, { useEffect, useCallback } from 'react';
import { useUser } from '@clerk/nextjs';
import { useToast } from '@/hooks/use-toast';
import { CustomizerPanel } from './components/CustomizerPanel';
import ProfileCardPreview from './components/ProfileCardPreview';
import GoogleAd from "@/components/googleAd";
import { LoadingSpinner98, LoadingState98 } from './components/LoadingComponents';
import { useProfileCustomizer } from './hooks/useProfileCustomizer';

export interface ProfileCustomizerProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ProfileCustomizer({ isOpen, onClose }: ProfileCustomizerProps) {
  // Use Clerk's useUser hook
  const { user, isLoaded, isSignedIn } = useUser();
  const { toast } = useToast();
  
  const {
    profile,
    setProfile,
    badges,
    setBadges,
    customCSS,
    setCustomCSS,
    saving,
    loading,
    error,
    loadingProgress,
    hasChanges,
    saveProfile,
    loadProfile,
    resetToDefaults,
    discardChanges
  } = useProfileCustomizer();

  // ✅ SCROLL LOCK: Disable body scrolling when customizer is open
  useEffect(() => {
    if (isOpen) {
      // Save current scroll position
      const scrollY = window.scrollY;
      
      // Disable body scrolling
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollY}px`;
      document.body.style.left = '0';
      document.body.style.right = '0';
      document.body.style.overflow = 'hidden';
      
      // Cleanup function
      return () => {
        // Re-enable body scrolling
        document.body.style.position = '';
        document.body.style.top = '';
        document.body.style.left = '';
        document.body.style.right = '';
        document.body.style.overflow = '';
        
        // Restore scroll position
        window.scrollTo(0, scrollY);
      };
    }
  }, [isOpen]);

  // ✅ PREVENT ESCAPE KEY FROM SCROLLING
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Prevent arrow keys, page up/down, space, etc. from scrolling
      const scrollKeys = [
        'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
        'PageUp', 'PageDown', 'Home', 'End', ' '
      ];
      
      if (scrollKeys.includes(e.key)) {
        // Only prevent if the target is not an input, textarea, or contenteditable
        const target = e.target as HTMLElement;
        const isInputElement = target.tagName === 'INPUT' || 
                              target.tagName === 'TEXTAREA' || 
                              target.contentEditable === 'true' ||
                              target.closest('.ace_editor'); // Allow ACE editor navigation
        
        if (!isInputElement) {
          e.preventDefault();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown, { passive: false });
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // ✅ PREVENT WHEEL EVENTS OUTSIDE SPECIFIC CONTAINERS
  useEffect(() => {
    if (!isOpen) return;

    const handleWheel = (e: WheelEvent) => {
      const target = e.target as HTMLElement;
      
      // Allow scrolling only in specific containers
      const allowedScrollContainers = [
        '.overflow-y-auto',
        '.overflow-x-auto', 
        '.profile-badges-container',
        '.badge-scroll-container',
        '.ace_editor',
        '.window-body'
      ];
      
      const isInAllowedContainer = allowedScrollContainers.some(selector => 
        target.closest(selector)
      );
      
      if (!isInAllowedContainer) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    // Use passive: false to allow preventDefault
    document.addEventListener('wheel', handleWheel, { passive: false });
    return () => document.removeEventListener('wheel', handleWheel);
  }, [isOpen]);

  // Updated image upload handlers that work with the image editor
  const handleAvatarUpload = useCallback((imageData: string) => {
    // This function is no longer needed as we handle updates via events
    // Keeping it for backwards compatibility
  }, []);

  const handleBannerUpload = useCallback((imageData: string) => {
    // This function is no longer needed as we handle updates via events
    // Keeping it for backwards compatibility
  }, []);

  // Listen for profile update events from the ProfileCardPreview
  useEffect(() => {
    const handleProfileUpdate = (e: CustomEvent) => {
      const { type, data } = e.detail;
      
      if (type === 'avatar') {
        setProfile(prev => ({ ...prev, avatar_url: data }));
        toast({
          title: "Avatar Updated",
          description: "Profile picture updated successfully",
          variant: "default"
        });
      } else if (type === 'banner') {
        setProfile(prev => ({ ...prev, banner_url: data }));
        toast({
          title: "Banner Updated", 
          description: "Banner image updated successfully",
          variant: "default"
        });
      }
    };

    window.addEventListener('profileUpdate', handleProfileUpdate as EventListener);

    return () => {
      window.removeEventListener('profileUpdate', handleProfileUpdate as EventListener);
    };
  }, [setProfile, toast]);

  // Load profile when component opens with Clerk user ID
  useEffect(() => {
    if (isOpen && user?.id && isLoaded && isSignedIn) {
      console.log('ProfileCustomizer: Loading profile for Clerk user:', user.id);
      
      // Pre-populate with Clerk user data
      setProfile(prev => ({
        ...prev,
        username: prev.username || user.username || '',
        display_name: prev.display_name || user.firstName || user.username || '',
        avatar_url: prev.avatar_url || user.imageUrl || '',
      }));
      
      loadProfile(user.id);
    }
  }, [isOpen, user?.id, isLoaded, isSignedIn, loadProfile, setProfile]);

  // Warn user about unsaved changes when closing
  const handleClose = useCallback(() => {
    if (hasChanges) {
      if (window.confirm('You have unsaved changes. Are you sure you want to close without saving?')) {
        onClose();
      }
    } else {
      onClose();
    }
  }, [hasChanges, onClose]);

  // Handle save with enhanced error handling
  const handleSave = useCallback(async () => {
    if (!user?.id) {
      toast({
        title: "Authentication Required",
        description: "Please sign in to save your profile",
        variant: "destructive"
      });
      return;
    }

    try {
      await saveProfile(user.id);
      toast({
        title: "Profile Saved! ⚡",
        description: "Your profile has been updated successfully!",
        variant: "default"
      });
    } catch (error: unknown) {
      console.error('Save error:', error);
      
      const getErrorMessage = (err: unknown): string => {
        if (err instanceof Error) return err.message;
        if (typeof err === 'string') return err;
        return 'An unknown error occurred';
      };
      
      const errorMessage = getErrorMessage(error);
      
      // Enhanced error messages based on error type
      let displayMessage = "Failed to save your profile. Please try again.";
      let errorTitle = "Save Failed";
      
      if (errorMessage.includes('Network error')) {
        errorTitle = "Connection Error";
        displayMessage = "Unable to connect to the server. Please check your internet connection and try again.";
      } else if (errorMessage.includes('Username')) {
        errorTitle = "Invalid Username";
        displayMessage = errorMessage;
      } else if (errorMessage.includes('Database')) {
        errorTitle = "Database Error";
        displayMessage = "There was a problem saving to the database. Please try again in a few moments.";
      }
      
      toast({
        title: errorTitle,
        description: displayMessage,
        variant: "destructive"
      });
    }
  }, [user?.id, saveProfile, toast]);

  const handleReset = useCallback(() => {
    resetToDefaults();
    toast({
      title: "Profile Reset",
      description: "Profile has been reset to default settings",
      variant: "default"
    });
  }, [resetToDefaults, toast]);

  // Handle discard changes
  const handleDiscardChanges = useCallback(() => {
    if (window.confirm('Are you sure you want to discard all your changes?')) {
      discardChanges();
      toast({
        title: "Changes Discarded",
        description: "All changes have been reverted to the last saved state",
        variant: "default"
      });
    }
  }, [discardChanges, toast]);

  const handleRetry = useCallback(() => {
    if (user?.id) {
      loadProfile(user.id);
    }
  }, [user?.id, loadProfile]);

  // Debug function to test API connection
  const testConnection = useCallback(async () => {
    try {
      console.log('Testing API connection...');
      const response = await fetch('/api/profile/save', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });
      console.log('Test response status:', response.status);
      const data = await response.json();
      console.log('Test response data:', data);
      
      toast({
        title: "Connection Test",
        description: `API responded with status: ${response.status}`,
        variant: response.ok ? "default" : "destructive"
      });
    } catch (error: unknown) {
      const getErrorMessage = (err: unknown): string => {
        if (err instanceof Error) return err.message;
        if (typeof err === 'string') return err;
        return 'An unknown error occurred';
      };
      
      console.error('Connection test failed:', error);
      toast({
        title: "Connection Test Failed",
        description: `Error: ${getErrorMessage(error)}`,
        variant: "destructive"
      });
    }
  }, [toast]);

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center" 
      style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
      onWheel={(e) => e.preventDefault()} // Prevent any wheel events on the overlay
    >
      <div 
        className="window" 
        style={{ width: '90vw', maxWidth: '1200px', height: '90vh', maxHeight: '800px' }}
        onWheel={(e) => e.stopPropagation()} // Allow wheel events inside the window
      >
        {/* Title Bar */}
        <div className="title-bar">
          <div className="title-bar-text">
            Customize Your Profile 
            {hasChanges && <span className="text-xs text-red-600"> - Unsaved Changes</span>}
          </div>
          <div className="title-bar-controls">
            <button aria-label="Close" onClick={handleClose}></button>
          </div>
        </div>

        {/* Window Body */}
        <div className="window-body" style={{ height: 'calc(100% - 33px)', overflow: 'hidden' }}>
          {/* Show loading state while Clerk is loading */}
          {!isLoaded && (
            <LoadingState98 
              message="Loading authentication..."
              progress={50}
            />
          )}

          {/* Show auth required state */}
          {isLoaded && !isSignedIn && (
            <div className="window-body">
              <div className="flex items-center justify-center p-8">
                <div className="text-center">
                  <div className="w-16 h-16 sunken border-2 bg-blue-100 flex items-center justify-center mx-auto mb-4">
                    <span className="text-2xl">🔐</span>
                  </div>
                  <h3 className="text-lg font-bold mb-2">Authentication Required</h3>
                  <p className="text-gray-700 mb-4">Please sign in to customize your profile</p>
                  <button className="btn" onClick={handleClose}>Close</button>
                </div>
              </div>
            </div>
          )}

          {/* Show loading state during profile fetch */}
          {isLoaded && isSignedIn && user && loading && (
            <div className="space-y-4">
              <LoadingState98 
                message=" "
                progress={loadingProgress}
              />
              <GoogleAd
                adClient="ca-pub-5670235631357216"
                adSlot="6047746984"
                adFormat="fluid"
                layoutKey="-f9+4w+7x-eg+3a"
              />
            </div>
          )}

          {/* Show error state with enhanced debugging */}
          {isLoaded && isSignedIn && user && !loading && error && (
            <div className="window-body">
              <div className="flex items-center justify-center p-8">
                <div className="text-center">
                  <div className="w-16 h-16 sunken border-2 border-gray-400 bg-red-100 flex items-center justify-center mx-auto mb-4">
                    <span className="text-2xl">⚠️</span>
                  </div>
                  <h3 className="text-lg font-bold text-red-700 mb-2">Failed to Load Profile</h3>
                  <p className="text-gray-700 mb-4">{error}</p>
                  <div className="flex gap-2 justify-center mb-4">
                    <button className="btn" onClick={handleRetry}>Try Again</button>
                    <button className="btn" onClick={testConnection}>Test Connection</button>
                    <button className="btn" onClick={handleClose}>Close</button>
                  </div>
                  
                  {/* Debug info */}
                  <details className="text-left bg-gray-100 p-2 rounded text-xs">
                    <summary className="cursor-pointer font-bold">Debug Information</summary>
                    <div className="mt-2 space-y-1">
                      <div>User ID: {user?.id}</div>
                      <div>Current URL: {typeof window !== 'undefined' ? window.location.href : 'N/A'}</div>
                      <div>User Agent: {typeof navigator !== 'undefined' ? navigator.userAgent : 'N/A'}</div>
                      <div>Error: {error}</div>
                    </div>
                  </details>
                </div>
              </div>
            </div>
          )}

          {/* Main Content */}
          {isLoaded && isSignedIn && user && !loading && !error && (
            <div className="flex h-full">
              {/* Left Panel - Customization Controls */}
              <div 
                className="flex-1 p-4 overflow-y-auto border-r border-gray-400 no-scrollbar" 
                style={{ 
                  borderStyle: 'inset',
                  width: '60%',
                  maxWidth: '60%'
                }}
              >
                {/* Welcome message for new users */}
                {!profile.profile_complete && (
                  <div className="mb-4 p-3 field-row sunken border border-gray-400 bg-green-50">
                    <div className="flex items-center gap-2">
                      <span className="text-green-700">🎉</span>
                      <span className="text-green-800 text-sm font-bold">
                        Welcome {user.firstName || user.username}! Let's set up your profile.
                      </span>
                    </div>
                  </div>
                )}

                {/* Changes indicator */}
                {hasChanges && (
                  <div className="mb-4 p-3 field-row sunken border border-gray-400 bg-yellow-50">
                    <div className="flex items-center gap-2">
                      <span className="text-yellow-700">⚠️</span>
                      <span className="text-yellow-800 text-sm font-bold">
                        You have unsaved changes!
                      </span>
                    </div>
                  </div>
                )}

                {/* Show saving overlay */}
                {saving && (
                  <div className="mb-4 p-4 field-row sunken border border-gray-400 bg-blue-50">
                    <div className="flex items-center">
                      <LoadingSpinner98 size="sm" />
                      <span className="text-blue-800 ml-3 font-bold">Saving your profile...</span>
                    </div>
                  </div>
                )}

                <CustomizerPanel
                  profile={profile}
                  setProfile={setProfile}
                  badges={badges}
                  setBadges={setBadges}
                  customCSS={customCSS}
                  setCustomCSS={setCustomCSS}
                  saving={saving}
                  loading={loading}
                />
              </div>

 {/* Right Panel - Live Preview */}
<div className="w-80 h-100 p-4 overflow-y-auto no-scrollbar" style={{ width: '40%' }}>
  <div className="window">
    <div className="title-bar">
      <div className="title-bar-text">
        Live Preview
      </div>
    </div>
    <div className="window-body">
      <div className="space-y-4">
        {/* Profile Card Preview with upload hover and image editor */}
        <div className="field-row flex justify-center">
          <div style={{ width: "298px", height: "465px" }}> {/* Increased height by 30% (358 * 1.3 = 465) */}
            <ProfileCardPreview
              profile={profile}
              badges={badges}
              customCSS={customCSS}
              isPreview={true}
              onAvatarUpload={() => {}} // The ProfileCardPreview handles file selection internally
              onBannerUpload={() => {}} // The ProfileCardPreview handles file selection internally
            />
          </div>
        </div>
        
        {/* Account Info and Chat Preview - Side by Side */}
        <div className="field-row">
          <div className="flex gap-4">
            {/* Account Info - Left Side */}
            <div className="flex-1">
              <div className="sunken border border-gray-400 p-2 bg-gray-50">
                <div className="text-xs text-gray-600">
                  <div className="font-bold mb-1">👤 Account Info:</div>
                  <div className="space-y-1">
                    <div>ID: {user.id}</div>
                    <div>Email: {user.emailAddresses?.[0]?.emailAddress}</div>
                    <div>Joined: {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'Unknown'}</div>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Chat Preview - Right Side */}
            <div className="flex-1">
              <div className="sunken border border-gray-400 p-2 bg-white">
                <div className="text-xs text-gray-600 mb-1 font-bold">Chat Preview:</div>
                <div className="flex items-start gap-2">
                  <div>
                    <div 
                      className="text-sm font-bold cursor-pointer hover:underline"
                      style={{ 
                        color: profile.display_name_color || '#000000',
                        animation: profile.display_name_animation === 'rainbow' ? 
                          `rainbow ${profile.rainbow_speed || 3}s infinite` : 'none'
                      }}
                    >
                      <span>
                        {profile.display_name || profile.username || 'Unknown User'}
                      </span>
                      <span style={{ color: '#000000' }}> : hello!</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  </div>
</div>
            </div>
          )}

          {/* Footer Controls with change detection */}
          {isLoaded && isSignedIn && user && !loading && !error && (
            <div className="absolute bottom-0 left-0 right-0 p-4" style={{ borderStyle: 'inset' }}>
              <div className="flex justify-between items-center">
                <div className="flex gap-2 items-center">
   
                </div>
                
                <div className="flex gap-6 items-center">
                  <div className="flex gap-2 items-center">
                    {/* Discard changes button (only show when there are changes) */}
                    {hasChanges && (
                      <button
                        className="btn"
                        onClick={handleDiscardChanges}
                        disabled={saving || loading}
                        style={{ color: '#d97706' }}
                      >
                        Discard Changes
                      </button>
                    )}
                    
                    {error && (
                      <button
                        className="btn"
                        onClick={handleRetry}
                        disabled={loading}
                      >
                        🔄 Reload Profile
                      </button>
                    )}
                  </div>
                  
                  <div className="flex gap-2 items-center">
                    {saving && (
                      <div className="flex items-center gap-2 text-sm text-gray-700">
                        <LoadingSpinner98 size="sm" />
                        Saving...
                      </div>
                    )}
                    
                    <button
                      className="btn"
                      onClick={handleClose}
                      disabled={saving}
                    >
                      {hasChanges ? 'Cancel' : 'Close'}
                    </button>
                    
                    {/* Save button only visible when there are changes */}
                    {hasChanges && (
                      <button
                        className="btn"
                        onClick={handleSave}
                        disabled={saving || loading || !profile.username?.trim()}
                        style={{ fontWeight: 'bold', backgroundColor: hasChanges ? '#4ade80' : undefined }}
                      >
                        {saving ? 'Saving...' : 'Save Changes'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* CSS for rainbow animation and scroll prevention */}
      <style jsx>{`
        @keyframes rainbow {
          0% { color: #ff0000; }
          16.66% { color: #ff8000; }
          33.33% { color: #ffff00; }
          50% { color: #00ff00; }
          66.66% { color: #0080ff; }
          83.33% { color: #8000ff; }
          100% { color: #ff0000; }
        }
        
        .btn:disabled {
          color: #808080;
          background: #c0c0c0;
          border-color: #808080;
        }
        
        .field-row {
          margin-bottom: 8px;
        }
        
        .sunken {
          border-style: inset;
        }
        
        .window-body {
          position: relative;
        }

        /* Hide all scrollbars */
        .no-scrollbar {
          scrollbar-width: none;
          -ms-overflow-style: none;
        }

        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }

        .space-y-4 > * + * {
          margin-top: 16px;
        }

        .text-xs { font-size: 10px; }
        .text-sm { font-size: 11px; }
        .text-lg { font-size: 14px; }
        .font-bold { font-weight: bold; }

        .text-gray-600 { color: #666; }
        .text-gray-700 { color: #555; }
        .text-red-600 { color: #dc2626; }
        .text-red-700 { color: #b91c1c; }
        .text-green-700 { color: #15803d; }
        .text-green-800 { color: #166534; }
        .text-yellow-700 { color: #a16207; }
        .text-yellow-800 { color: #92400e; }
        .text-blue-800 { color: #1e40af; }

        .bg-gray-50 { background-color: #f9fafb; }
        .bg-gray-100 { background-color: #f3f4f6; }
        .bg-red-100 { background-color: #fee2e2; }
        .bg-green-50 { background-color: #f0fdf4; }
        .bg-yellow-50 { background-color: #fefce8; }
        .bg-blue-50 { background-color: #eff6ff; }
        .bg-blue-100 { background-color: #dbeafe; }

        .border { border-width: 1px; }
        .border-2 { border-width: 2px; }
        .border-r { border-right-width: 1px; }
        .border-gray-400 { border-color: #9ca3af; }

        .flex { display: flex; }
        .items-center { align-items: center; }
        .items-start { align-items: flex-start; }
        .justify-center { justify-content: center; }
        .justify-between { justify-content: space-between; }
        .gap-2 { gap: 8px; }
        .gap-4 { gap: 16px; }
        .gap-6 { gap: 24px; }

        .w-16 { width: 64px; }
        .h-16 { height: 64px; }
        .w-80 { width: 320px; }

        .p-2 { padding: 8px; }
        .p-3 { padding: 12px; }
        .p-4 { padding: 16px; }
        .p-8 { padding: 32px; }

        .mb-1 { margin-bottom: 4px; }
        .mb-2 { margin-bottom: 8px; }
        .mb-4 { margin-bottom: 16px; }
        .ml-3 { margin-left: 12px; }
        .mx-auto { margin-left: auto; margin-right: auto; }

        .absolute { position: absolute; }
        .relative { position: relative; }
        .fixed { position: fixed; }
        .inset-0 { inset: 0; }
        .bottom-0 { bottom: 0; }
        .left-0 { left: 0; }
        .right-0 { right: 0; }

        .z-50 { z-index: 50; }
        .text-center { text-align: center; }
        .text-left { text-align: left; }
        .block { display: block; }
        .cursor-pointer { cursor: pointer; }
        .hover\\:underline:hover { text-decoration: underline; }
        .overflow-hidden { overflow: hidden; }
        .overflow-y-auto { overflow-y: auto; }
        .flex-1 { flex: 1 1 0%; }

        .animate-spin {
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        .transition-all {
          transition-property: all;
          transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
          transition-duration: 150ms;
        }

        details {
          border: 1px solid #ccc;
          border-radius: 4px;
          padding: 8px;
        }

        summary {
          font-weight: bold;
          margin: -8px -8px 8px -8px;
          padding: 8px;
          background: #f0f0f0;
          border-radius: 4px;
        }
      `}</style>
    </div>
  );
}