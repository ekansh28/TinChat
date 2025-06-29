// src/components/AuthModal.tsx - UPDATED FOR XATA DATABASE
'use client';
import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useSignIn, useSignUp, useUser } from '@clerk/nextjs';
import { Button } from '@/components/ui/button-themed';
import { Input } from '@/components/ui/input-themed';
import { Label } from '@/components/ui/label-themed';
import Image from 'next/image';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AuthModal({ isOpen, onClose }: AuthModalProps) {
  const [currentStep, setCurrentStep] = useState<'auth' | 'onboarding'>('auth');
  const [isSignUp, setIsSignUp] = useState(false);
  
  // Auth state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authUsername, setAuthUsername] = useState(''); // Username for Clerk auth
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Onboarding state
  const [displayName, setDisplayName] = useState('');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [createdUserId, setCreatedUserId] = useState<string | null>(null);

  const { signIn, setActive, isLoaded: signInLoaded } = useSignIn();
  const { signUp, isLoaded: signUpLoaded } = useSignUp();
  const { user } = useUser();

  // 🔥 CRITICAL: Ensure component is mounted before rendering portal
  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  // 🔥 CRITICAL: Close modal on Escape key
  useEffect(() => {
    if (!isOpen) return;
    
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  // 🔥 CRITICAL: Prevent body scroll when modal is open
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

  // ✅ NEW: Check if user profile exists in Xata database
  const checkUserProfileExists = async (userId: string): Promise<boolean> => {
    try {
      const response = await fetch(`/api/profiles/${userId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        return data.success && data.data;
      }
      
      return false;
    } catch (error) {
      console.error('Error checking user profile:', error);
      return false;
    }
  };

  // ✅ NEW: Create user profile in Xata database
  const createUserProfile = async (userId: string, username: string, displayName: string, avatarData?: string): Promise<boolean> => {
    try {
      const profileData: any = {
        username,
        display_name: displayName,
        profile_complete: true,
        status: 'online',
        is_online: true,
        last_seen: new Date().toISOString(),
        display_name_color: '#667eea',
        display_name_animation: 'none',
        rainbow_speed: 3,
        badges: [],
        bio: '',
        pronouns: '',
        blocked_users: [],
        profile_card_css: '',
        easy_customization_data: {}
      };

      if (avatarData) {
        profileData.avatar_url = avatarData;
      }

      const response = await fetch(`/api/profiles/${userId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(profileData),
      });

      if (response.ok) {
        const data = await response.json();
        return data.success;
      }
      
      const errorData = await response.json();
      console.error('Profile creation failed:', errorData);
      
      // Handle specific errors
      if (errorData.error === 'Username taken') {
        setError('Username is already taken. Please choose another one.');
      } else {
        setError(errorData.message || 'Failed to create profile');
      }
      
      return false;
    } catch (error) {
      console.error('Error creating user profile:', error);
      setError('Failed to create profile. Please try again.');
      return false;
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    
    // Check username for sign up
    if (isSignUp && (!authUsername || authUsername.length < 3)) {
      setError('Username must be at least 3 characters');
      return;
    }
    
    setError(null);
    setLoading(true);

    try {
      if (isSignUp) {
        if (!signUpLoaded || !signUp) return;

        // ✅ FIXED: Create signup with all required fields including username
        const result = await signUp.create({
          emailAddress: email,
          password,
          username: authUsername, // This fixes the missing_requirements error
        });

        console.log('SignUp result:', result.status, result);

        if (result.status === 'complete') {
          // Sign up successful, check if profile exists in Xata
          const userId = result.createdUserId;
          setCreatedUserId(userId);
          
          if (userId) {
            const profileExists = await checkUserProfileExists(userId);
            
            if (!profileExists) {
              // Profile doesn't exist in Xata, show onboarding
              setDisplayName(authUsername); // Pre-fill with username
              setCurrentStep('onboarding');
            } else {
              // Profile exists in Xata, just close modal and reload
              onClose();
              window.location.reload();
            }
          }
          
          setLoading(false);
        } else if (result.status === 'missing_requirements') {
          console.log('Missing requirements:', result.missingFields);
          setError(`Missing required fields: ${result.missingFields?.join(', ') || 'Unknown'}`);
          setLoading(false);
        } else {
          // Email verification needed
          try {
            await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
            setError('Please check your email for a verification code and try again');
          } catch (emailError) {
            setError('Please check your email for a verification link');
          }
          setLoading(false);
        }
      } else {
        // Sign in logic
        if (!signInLoaded || !signIn) return;

        const result = await signIn.create({
          identifier: email,
          password,
        });

        if (result.status === 'complete') {
          await setActive({ session: result.createdSessionId });
          
          // Check if user profile exists in Xata after successful sign in
          if (result.createdUserId) {
            const profileExists = await checkUserProfileExists(result.createdUserId);
            
            if (!profileExists) {
              // User signed in but no profile exists in Xata, show onboarding
              setCreatedUserId(result.createdUserId);
              setDisplayName(email.split('@')[0]); // Use email prefix as default
              setCurrentStep('onboarding');
              setLoading(false);
              return;
            }
          }
          
          onClose();
          window.location.reload();
        } else if (result.status === 'needs_second_factor') {
          setError('Two-factor authentication required');
        } else {
          setError('Sign in failed. Please check your credentials.');
        }
        setLoading(false);
      }
    } catch (err: any) {
      console.error('Auth error:', err);
      
      if (err.errors && err.errors.length > 0) {
        setError(err.errors[0].message);
      } else {
        setError(isSignUp ? 'Failed to create account' : 'Failed to sign in');
      }
      setLoading(false);
    }
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0]) return;

    const file = e.target.files[0];
    
    if (file.size > 2 * 1024 * 1024) {
      setError('Image too large. Please select an image smaller than 2MB.');
      return;
    }
    
    setAvatarFile(file);
    
    const reader = new FileReader();
    reader.onloadend = () => {
      setAvatarPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleOnboardingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!displayName) {
      setError('Display name is required');
      return;
    }

    if (!createdUserId) {
      setError('User ID not found. Please try signing up again.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Convert avatar to base64 if provided
      let avatarData = null;
      if (avatarFile) {
        const reader = new FileReader();
        avatarData = await new Promise((resolve) => {
          reader.onloadend = () => resolve(reader.result);
          reader.readAsDataURL(avatarFile);
        });
      }

      // ✅ FIXED: Save profile data to Xata database
      const success = await createUserProfile(
        createdUserId,
        authUsername,
        displayName,
        avatarData as string
      );

      if (success) {
        console.log('Profile created successfully in Xata!');
        onClose();
        window.location.reload();
      } else {
        // Error is already set in createUserProfile function
        setLoading(false);
      }
      
    } catch (err: any) {
      console.error('Onboarding error:', err);
      setError('Failed to save profile. Please try again.');
      setLoading(false);
    }
  };

  const handleOAuth = async (provider: 'oauth_google' | 'oauth_discord') => {
    setError(null);
    setLoading(true);

    try {
      if (isSignUp && signUpLoaded) {
        await signUp.authenticateWithRedirect({
          strategy: provider,
          redirectUrl: window.location.origin + '/auth/callback',
          redirectUrlComplete: window.location.origin + '/auth/complete',
        });
      } else if (signInLoaded) {
        await signIn.authenticateWithRedirect({
          strategy: provider,
          redirectUrl: window.location.origin + '/auth/callback',
          redirectUrlComplete: window.location.origin + '/auth/complete',
        });
      }
    } catch (err: any) {
      console.error('OAuth error:', err);
      setError('OAuth authentication failed');
      setLoading(false);
    }
  };

  // Reset state when switching between sign in/up
  useEffect(() => {
    setError(null);
    setEmail('');
    setPassword('');
    setAuthUsername('');
    setCurrentStep('auth');
  }, [isSignUp]);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setError(null);
      setEmail('');
      setPassword('');
      setAuthUsername('');
      setDisplayName('');
      setAvatarFile(null);
      setAvatarPreview(null);
      setCreatedUserId(null);
      setCurrentStep('auth');
      setLoading(false);
    }
  }, [isOpen]);

  // 🔥 CRITICAL: Don't render until mounted (prevents SSR issues)
  if (!mounted || !isOpen) return null;

  const modalContent = (
    <div 
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
        zIndex: 9999
      }}
      onClick={onClose}
    >
      {/* Modal Window */}
      <div 
        className="window w-full max-w-md relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Title Bar */}
        <div className="title-bar">
          <div className="title-bar-text">
            {currentStep === 'auth' 
              ? (isSignUp ? 'Create Account' : 'Sign In')
              : 'Complete Your Profile'
            }
          </div>
          <div className="title-bar-controls">
            <button aria-label="Close" onClick={onClose}></button>
          </div>
        </div>

        {/* Window Body */}
        <div className="window-body p-6">
          {currentStep === 'auth' ? (
            <>
              {/* Tab Switcher */}
              <div className="flex mb-4 border-b">
                <button
                  type="button"
                  className={`flex-1 py-2 px-4 text-sm font-medium border-b-2 transition-colors ${
                    !isSignUp 
                      ? 'border-blue-500 text-blue-600' 
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                  onClick={() => {
                    setIsSignUp(false);
                    setError(null);
                  }}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  className={`flex-1 py-2 px-4 text-sm font-medium border-b-2 transition-colors ${
                    isSignUp 
                      ? 'border-blue-500 text-blue-600' 
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                  onClick={() => {
                    setIsSignUp(true);
                    setError(null);
                  }}
                >
                  Sign Up
                </button>
              </div>

              {/* Auth Form */}
              <form onSubmit={handleAuth} className="space-y-4">
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input 
                    id="email" 
                    type="email" 
                    value={email} 
                    onChange={(e) => setEmail(e.target.value)} 
                    required 
                    disabled={loading}
                    autoComplete="email"
                    placeholder="Enter your email"
                  />
                </div>

                {/* Username field - only for sign up */}
                {isSignUp && (
                  <div>
                    <Label htmlFor="username">Username</Label>
                    <Input 
                      id="username" 
                      type="text" 
                      value={authUsername} 
                      onChange={(e) => setAuthUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, '').slice(0, 20))} 
                      required 
                      minLength={3}
                      maxLength={20}
                      disabled={loading}
                      placeholder="Enter username"
                    />
                    <p className="text-xs text-gray-500 mt-1">3-20 characters. Letters, numbers, and underscores only.</p>
                  </div>
                )}
                
                <div>
                  <Label htmlFor="password">
                    Password {isSignUp && '(min. 8 characters)'}
                  </Label>
                  <Input 
                    id="password" 
                    type="password" 
                    value={password} 
                    onChange={(e) => setPassword(e.target.value)} 
                    required 
                    minLength={isSignUp ? 8 : undefined}
                    disabled={loading}
                    autoComplete={isSignUp ? "new-password" : "current-password"}
                    placeholder="Enter your password"
                  />
                </div>

                {error && (
                  <div className="text-red-600 text-xs p-2 bg-red-100 border border-red-400 rounded">
                    {error}
                  </div>
                )}

                <Button 
                  type="submit" 
                  className="w-full" 
                  disabled={loading}
                >
                  {loading 
                    ? (isSignUp ? 'Creating Account...' : 'Signing In...') 
                    : (isSignUp ? 'Create Account' : 'Sign In')
                  }
                </Button>
              </form>
              
              {/* Divider */}
              <div className="flex items-center my-4">
                <hr className="flex-grow border-t border-gray-300 dark:border-gray-600" />
                <span className="mx-2 text-xs text-gray-500 dark:text-gray-400">OR</span>
                <hr className="flex-grow border-t border-gray-300 dark:border-gray-600" />
              </div>
              
              {/* OAuth Buttons */}
              <div className="flex flex-col gap-2">
                <Button 
                  type="button"
                  variant="outline" 
                  onClick={() => handleOAuth('oauth_google')} 
                  disabled={loading}
                  className="w-full"
                >
                  Continue with Google
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleOAuth('oauth_discord')}
                  disabled={loading}
                  className="w-full"
                >
                  Continue with Discord
                </Button>
              </div>
            </>
          ) : (
            <>
              {/* Onboarding Form */}
              <form onSubmit={handleOnboardingSubmit} className="space-y-4">
                {/* Avatar Upload */}
                <div>
                  <Label>Profile Picture (Optional)</Label>
                  <div className="mt-2 flex items-center space-x-4">
                    <div className="h-16 w-16 rounded-full overflow-hidden bg-gray-100 border">
                      {avatarPreview ? (
                        <Image 
                          src={avatarPreview} 
                          alt="Avatar preview" 
                          width={64} 
                          height={64} 
                          className="object-cover h-full w-full" 
                        />
                      ) : (
                        <div className="h-full w-full flex items-center justify-center text-gray-400">
                          <svg className="h-8 w-8" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M24 20.993V24H0v-2.996A14.977 14.977 0 0112.004 15c4.904 0 9.26 2.354 11.996 5.993zM16.002 8.999a4 4 0 11-8 0 4 4 0 018 0z" />
                          </svg>
                        </div>
                      )}
                    </div>
                    <Button 
                      type="button" 
                      variant="outline"
                      onClick={() => document.getElementById('avatar-input')?.click()}
                      disabled={loading}
                    >
                      Choose Image
                    </Button>
                    <input
                      id="avatar-input"
                      type="file"
                      accept="image/*"
                      onChange={handleAvatarChange}
                      className="hidden"
                    />
                  </div>
                </div>

                {/* Display Name */}
                <div>
                  <Label htmlFor="displayName">Display Name</Label>
                  <Input
                    id="displayName"
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value.slice(0, 30))}
                    required
                    maxLength={30}
                    disabled={loading}
                    placeholder="Enter display name"
                  />
                  <p className="text-xs text-gray-500 mt-1">This will be shown in chats.</p>
                </div>

                {/* Show username being used */}
                <div>
                  <Label>Username (from signup)</Label>
                  <div className="text-sm text-gray-600 bg-gray-50 p-2 rounded border">
                    @{authUsername}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">This will be saved to the database.</p>
                </div>

                {error && (
                  <div className="text-red-600 text-xs p-2 bg-red-100 border border-red-400 rounded">
                    {error}
                  </div>
                )}

                <div className="flex gap-2">
                  <Button 
                    type="button"
                    variant="outline"
                    onClick={() => setCurrentStep('auth')}
                    disabled={loading}
                    className="flex-1"
                  >
                    Back
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={loading}
                    className="flex-1"
                  >
                    {loading ? 'Saving to Database...' : 'Complete Setup'}
                  </Button>
                </div>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );

  // 🔥 CRITICAL: Render modal at root level using createPortal
  return createPortal(modalContent, document.body);
}