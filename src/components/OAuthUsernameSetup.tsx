// src/components/OAuthUsernameSetup.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useUser } from '@clerk/nextjs';
import { Button } from '@/components/ui/button-themed';
import { Input } from '@/components/ui/input-themed';
import { Label } from '@/components/ui/label-themed';

interface OAuthUsernameSetupProps {
  isOpen: boolean;
  onComplete: () => void;
}

export default function OAuthUsernameSetup({ isOpen, onComplete }: OAuthUsernameSetupProps) {
  const { user } = useUser();
  const [username, setUsername] = useState('');
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const [checkingUsername, setCheckingUsername] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Mount detection for portal
  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  // Suggest username from user data
  useEffect(() => {
    if (!user || username) return;

    // Try to generate a good default username
    let suggestedUsername = '';
    
    if (user.username) {
      suggestedUsername = user.username;
    } else if (user.firstName) {
      suggestedUsername = user.firstName.toLowerCase().replace(/[^a-z0-9]/g, '');
    } else if (user.emailAddresses?.[0]?.emailAddress) {
      suggestedUsername = user.emailAddresses[0].emailAddress
        .split('@')[0]
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '');
    }

    if (suggestedUsername && suggestedUsername.length >= 3) {
      setUsername(suggestedUsername);
    }
  }, [user, username]);

  // Real-time username availability check
  useEffect(() => {
    if (!username || username.length < 3) {
      setUsernameAvailable(null);
      return;
    }

    const checkUsername = async () => {
      setCheckingUsername(true);
      setError(null);
      
      try {
        console.log('🔍 Checking username:', username);
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        const response = await fetch('/api/check-username', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ username: username.trim() }),
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const result = await response.json();
        
        console.log('📋 Username check result:', result);

        if (result.available) {
          setUsernameAvailable(true);
          if (result.reason && result.reason.includes('Unable to verify')) {
            setError(`⚠️ ${result.reason}`);
          } else {
            setError(null);
          }
        } else {
          setUsernameAvailable(false);
          setError(result.reason || 'Username is not available');
        }

      } catch (err: any) {
        console.error('Username check failed:', err);
        
        if (err.name === 'AbortError') {
          setUsernameAvailable(null);
          setError('Username check timed out. You can still proceed.');
        } else {
          // Fallback to basic validation
          const usernameRegex = /^[a-zA-Z0-9_-]+$/;
          if (!usernameRegex.test(username)) {
            setUsernameAvailable(false);
            setError('Username can only contain letters, numbers, underscores, and hyphens');
          } else {
            setUsernameAvailable(null);
            setError('Unable to check username availability. You can still proceed.');
          }
        }
      } finally {
        setCheckingUsername(false);
      }
    };

    // Debounce the API call
    const timeoutId = setTimeout(checkUsername, 800);
    return () => clearTimeout(timeoutId);
  }, [username]);

  // Body scroll prevention
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !user) return;
    
    setError(null);
    setSaving(true);

    try {
      console.log('💾 Saving OAuth user profile with username:', username);

      // Update the user profile in our database
      const response = await fetch('/api/profile/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: username.trim(),
          display_name: user.firstName && user.lastName 
            ? `${user.firstName} ${user.lastName}`
            : user.firstName || username,
          avatar_url: user.imageUrl || '',
          bio: '',
          pronouns: '',
          status: 'online',
          display_name_color: '#667eea',
          display_name_animation: 'none',
          rainbow_speed: 3,
          badges: [],
          profile_complete: true
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save profile');
      }

      const result = await response.json();
      console.log('✅ Profile saved successfully:', result);

      // Update Clerk user with the username
      try {
        await user.update({
          username: username.trim()
        });
        console.log('✅ Clerk username updated');
      } catch (clerkError) {
        console.warn('⚠️ Failed to update Clerk username:', clerkError);
        // Continue anyway - the important part is our database
      }

      // Complete the setup
      onComplete();

    } catch (err: any) {
      console.error('❌ Failed to save profile:', err);
      setError(err.message || 'Failed to save username. Please try again.');
      setSaving(false);
    }
  };

  const generateRandomUsername = () => {
    const adjectives = ['cool', 'awesome', 'super', 'mega', 'ultra', 'pro', 'epic', 'star'];
    const nouns = ['user', 'gamer', 'ninja', 'hero', 'wizard', 'master', 'legend', 'champion'];
    const randomAdj = adjectives[Math.floor(Math.random() * adjectives.length)];
    const randomNoun = nouns[Math.floor(Math.random() * nouns.length)];
    const randomNum = Math.floor(Math.random() * 1000);
    
    setUsername(`${randomAdj}${randomNoun}${randomNum}`);
  };

  // Don't render until mounted
  if (!mounted || !isOpen) return null;

  const modalContent = (
    <div className="auth-modal-backdrop-fixed">
      <div 
        className="auth-modal-window"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Title Bar */}
        <div className="title-bar">
          <div className="title-bar-text">Choose Your Username</div>
          <div className="title-bar-controls">
            {/* No close button - force username selection */}
          </div>
        </div>

        {/* Window Body */}
        <div className="window-body auth-modal-body">
          <div className="mb-6 text-center">
            <div className="text-4xl mb-3">👋</div>
            <h3 className="text-lg font-semibold mb-2">
              Welcome{user?.firstName ? `, ${user.firstName}` : ''}!
            </h3>
            <p className="text-sm text-gray-600">
              Your account has been created successfully. Please choose a username to complete your profile setup.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1">
                <Label htmlFor="username">Username</Label>
                <button
                  type="button"
                  onClick={generateRandomUsername}
                  className="text-xs text-blue-600 hover:text-blue-700"
                >
                  Generate random
                </button>
              </div>
              <div className="relative">
                <Input 
                  id="username" 
                  type="text" 
                  value={username} 
                  onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-zA-Z0-9_-]/g, ''))} 
                  required 
                  disabled={saving}
                  autoComplete="username"
                  placeholder="Enter your username"
                  minLength={3}
                  maxLength={20}
                  className={`pr-8 ${
                    username.length >= 3 
                      ? usernameAvailable === true 
                        ? 'border-green-500' 
                        : usernameAvailable === false 
                        ? 'border-red-500' 
                        : 'border-yellow-500'
                      : ''
                  }`}
                />
                {username.length >= 3 && (
                  <div className="absolute right-2 top-1/2 transform -translate-y-1/2">
                    {checkingUsername ? (
                      <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                    ) : usernameAvailable === true ? (
                      <span className="text-green-500 text-sm font-bold">✓</span>
                    ) : usernameAvailable === false ? (
                      <span className="text-red-500 text-sm font-bold">✗</span>
                    ) : (
                      <span className="text-yellow-500 text-sm">?</span>
                    )}
                  </div>
                )}
              </div>
              {username && username.length >= 3 && (
                <div className="text-xs mt-1">
                  {checkingUsername ? (
                    <span className="text-blue-600">Checking availability...</span>
                  ) : usernameAvailable === true ? (
                    <span className="text-green-600">✓ Username is available</span>
                  ) : usernameAvailable === false ? (
                    <span className="text-red-600">✗ Username is not available</span>
                  ) : (
                    <span className="text-yellow-600">? Unable to verify availability</span>
                  )}
                </div>
              )}
              {username && username.length < 3 && (
                <p className="text-xs text-gray-500 mt-1">
                  Username must be at least 3 characters
                </p>
              )}
              <p className="text-xs text-gray-500 mt-1">
                Username can only contain letters, numbers, underscores, and hyphens
              </p>
            </div>

            {error && (
              <div className={`text-xs p-2 border rounded ${
                error.includes('⚠️') 
                  ? 'text-yellow-700 bg-yellow-100 border-yellow-400' 
                  : 'text-red-600 bg-red-100 border-red-400'
              }`}>
                {error}
              </div>
            )}

            <Button 
              type="submit" 
              className="w-full" 
              disabled={saving || !username || username.length < 3 || usernameAvailable === false}
            >
              {saving ? 'Saving Username...' : 'Complete Setup'}
            </Button>

            <p className="text-xs text-gray-500 text-center">
              You can change your username later in your profile settings
            </p>
          </form>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}