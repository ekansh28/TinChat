// src/components/ProfileCustomizer/index.tsx
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button-themed';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { ProfileCard } from './components/ProfileCard';
import { CustomizerPanel } from './components/CustomizerPanel';
import { Modal } from './components/Modal';
import { useProfileCustomizer } from './hooks/useProfileCustomizer';
import type { UserProfile } from './types';

export interface ProfileCustomizerProps {
  isOpen: boolean;
  onClose: () => void;
}

export interface Profile {
  id: string;
  bio: string;
  displayName: string;
  username: string;
  pronouns: string;
  status: StatusType;
  displayNameColor: string;
  displayNameAnimation: DisplayNameAnimation;
  rainbowSpeed: number;
  avatarUrl: string | null;
  bannerUrl: string | null;
}

export interface EasyCustomization {
  backgroundColor: string;
  backgroundGradient?: {
    enabled: boolean;
    color1: string;
    color2: string;
    direction: string;
  };
  borderRadius: number;
  bannerHeight: number;
  avatarSize: number;
  avatarFrame: 'circle' | 'square';
  textShadow: boolean;
  textGlow: boolean;
  textBold: boolean;
  fontFamily: string;
  fontSize: number;
  contentPadding: number;
  shadow: boolean;
  glow: boolean;
  border: boolean;
  elements: Record<string, ElementProps>;
}

export interface ElementProps {
  x: number;
  y: number;
  scale: number;
  visible: boolean;
  color?: string;
  fontFamily?: string;
  fontSize?: number;
  width?: number;
  height?: number;
  background?: string;
  padding?: string;
  borderRadius?: string;
  border?: string;
  zIndex?: number;
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
    <Modal isOpen={isOpen} onClose={onClose} title="Customize Your Profile">
      <div className="flex flex-col space-y-4 max-h-[80vh] overflow-y-auto">
        <div className="flex flex-col lg:flex-row gap-6">
          <div className="flex-1">
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

          <div className="lg:w-96">
            <div className="sticky top-0">
              <div className="bg-card rounded-lg p-4">
                <h3 className="text-lg font-medium mb-4">Live Preview</h3>
                <div className="space-y-4">
                  <ProfileCard
                    profile={profile}
                    badges={badges}
                    customCSS={customCSS}
                    isPreview={true}
                  />
                  
                  <div className="bg-background rounded-lg p-3">
                    <div className="text-sm font-medium mb-2">Chat Preview</div>
                    <div className="flex items-start gap-2 p-2 rounded border">
                      <img
                        src={profile.avatar_url || '/default-avatar.png'}
                        alt="Avatar"
                        className="w-8 h-8 rounded-full"
                      />
                      <div>
                        <div 
                          className="text-sm font-medium"
                          style={{ 
                            color: profile.display_name_color || 'inherit',
                            animation: profile.display_name_animation === 'rainbow' ? 
                              `rainbow ${profile.rainbow_speed || 3}s linear infinite` : 'none'
                          }}
                        >
                          {profile.display_name || profile.username || 'Unknown User'}
                        </div>
                        <div className="text-sm text-muted-foreground">
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

        <div className="flex justify-between items-center pt-4 border-t">
          <Button
            variant="outline"
            onClick={handleReset}
            disabled={saving || loading}
          >
            Reset to Defaults
          </Button>
          
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
      </div>

      <style jsx>{`
        @keyframes rainbow {
          0% { color: #ff0000; }
          17% { color: #ff8000; }
          33% { color: #ffff00; }
          50% { color: #00ff00; }
          67% { color: #0080ff; }
          83% { color: #8000ff; }
          100% { color: #ff0000; }
        }
      `}</style>
    </Modal>
  );
}