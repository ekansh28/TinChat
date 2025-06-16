// src/components/ProfileCustomizer/index.tsx
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button-themed';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { ProfileCard } from './components/ProfileCard';
import { CustomizerPanel } from './components/CustomizerPanel';
import { Modal } from './components/Modal';
import { useProfileCustomizer } from './hooks/useProfileCustomizer';
import type { UserProfile } from './types';

// Simple auth hook if useAuth doesn't exist
const useAuth = () => {
  const [user, setUser] = useState<{ id: string; email?: string } | null>(null);
  
  useEffect(() => {
    const getUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user || null);
    };
    
    getUser();
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user || null);
    });
    
    return () => subscription.unsubscribe();
  }, []);
  
  return { user };
};

export interface ProfileCustomizerProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ProfileCustomizer({ isOpen, onClose }: ProfileCustomizerProps) {
  const { user } = useAuth();
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
    saveProfile,
    loadProfile,
    resetToDefaults
  } = useProfileCustomizer();

  // Load profile when component mounts and user is available
  useEffect(() => {
    if (isOpen && user?.id && !loading) {
      loadProfile(user.id);
    }
  }, [isOpen, user?.id, loading, loadProfile]);

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
        title: "Profile Saved",
        description: "Your profile has been updated successfully!",
        variant: "default"
      });
    } catch (error) {
      console.error('Save error:', error);
      toast({
        title: "Save Failed",
        description: "Failed to save your profile. Please try again.",
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

  if (!user) {
    return (
      <Modal isOpen={isOpen} onClose={onClose} title="Profile Customizer">
        <div className="flex items-center justify-center p-8">
          <div className="text-center">
            <h3 className="text-lg font-medium mb-2">Authentication Required</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">Please sign in to customize your profile</p>
            <Button onClick={onClose}>Close</Button>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Customize Your Profile" maxWidth="6xl">
      <div className="flex flex-col lg:flex-row gap-6 h-[80vh]">
        {/* Left Panel - Customization Controls */}
        <div className="flex-1 overflow-y-auto">
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
        <div className="flex-1 lg:max-w-md">
          <div className="sticky top-0">
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
              <h3 className="text-lg font-medium mb-4 text-center">Live Preview</h3>
              <div className="space-y-4">
                {/* Discord-style Profile Card */}
                <ProfileCard
                  profile={profile}
                  badges={badges}
                  customCSS={customCSS}
                  isPreview={true}
                />
                
                {/* Chat Preview */}
                <div className="bg-white dark:bg-gray-700 rounded-lg p-3">
                  <div className="text-sm font-medium mb-2">Chat Preview:</div>
                  <div className="flex items-start gap-2 p-2 bg-gray-50 dark:bg-gray-600 rounded">
                    <img
                      src={profile.avatar_url || getDefaultAvatar()}
                      alt="Avatar"
                      className="w-8 h-8 rounded-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = getDefaultAvatar();
                      }}
                    />
                    <div>
                      <div 
                        className="text-sm font-medium"
                        style={{ 
                          color: profile.display_name_color || '#ffffff',
                          animation: profile.display_name_animation === 'rainbow' ? 
                            `rainbow ${profile.rainbow_speed || 3}s infinite` : 'none'
                        }}
                      >
                        {profile.display_name || profile.username || 'Unknown User'}
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-300">
                        Hello! This is how your name appears in chat.
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer Controls */}
      <div className="flex justify-between items-center pt-4 border-t">
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleReset}
            disabled={saving || loading}
          >
            Reset to Defaults
          </Button>
        </div>
        
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving || loading}
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </div>

      {/* CSS for rainbow animation */}
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
      `}</style>
    </Modal>
  );
}

// Helper function for default avatar
function getDefaultAvatar() {
  return 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODAiIGhlaWdodD0iODAiIHZpZXdCb3g9IjAgMCA4MCA4MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjgwIiBoZWlnaHQ9IjgwIiBmaWxsPSIjNTg2NUY0Ii8+CjxjaXJjbGUgY3g9IjQwIiBjeT0iMzAiIHI9IjE0IiBmaWxsPSJ3aGl0ZSIvPgo8cGF0aCBkPSJNMjAgNjBDMjAgNTIuMjY4IDI2LjI2OCA0NiAzNCA0NkM0MS43MzIgNDYgNDggNTIuMjY4IDQ4IDYwVjgwSDIwVjYwWiIgZmlsbD0id2hpdGUiLz4KPC9zdmc+';
}