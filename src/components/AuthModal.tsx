<<<<<<< HEAD
// src/components/AuthModal.tsx - FIXED VERSION WITH CAPTCHA SUPPORT
'use client';
import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useSignIn, useSignUp, useAuth, useUser } from '@clerk/nextjs';
=======
// src/components/AuthModal.tsx - NEW FILE
'use client';
import { useState } from 'react';
import { useSignIn, useSignUp } from '@clerk/nextjs';
>>>>>>> parent of 80cc64c (added icons for signin/up)
import { Button } from '@/components/ui/button-themed';
import { Input } from '@/components/ui/input-themed';
import { Label } from '@/components/ui/label-themed';
import Image from 'next/image';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AuthModal({ isOpen, onClose }: AuthModalProps) {
  const [currentStep, setCurrentStep] = useState<'auth' | 'verification' | 'onboarding'>('auth');
  const [isSignUp, setIsSignUp] = useState(false);
  
  // Auth state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authUsername, setAuthUsername] = useState(''); // Username for Clerk auth
  const [verificationCode, setVerificationCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Onboarding state
  const [displayName, setDisplayName] = useState('');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [createdUserId, setCreatedUserId] = useState<string | null>(null);

  const { signIn, setActive, isLoaded: signInLoaded } = useSignIn();
  const { signUp, isLoaded: signUpLoaded } = useSignUp();
  const { getToken } = useAuth();
  const { user } = useUser();

  if (!isOpen) return null;

<<<<<<< HEAD
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

  // ✅ FIXED: Check if user profile exists in database with authentication
  const checkUserProfileExists = async (userId: string): Promise<boolean> => {
    try {
      const token = await getToken();
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };

      // Add auth token if available
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(`/api/profiles/${userId}`, {
        method: 'GET',
        headers,
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

  // ✅ FIXED: Create user profile in database with authentication
  const createUserProfile = async (userId: string, username: string, displayName: string, avatarData?: string): Promise<boolean> => {
    try {
      const token = await getToken();
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };

      // Add auth token if available
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

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
        headers,
        body: JSON.stringify(profileData),
      });

      if (response.ok) {
        const data = await response.json();
        return data.success;
      }
      
      const errorData = await response.json();
      console.error('Profile creation failed:', errorData);
      
      // Handle specific errors
      if (errorData.error === 'Username taken' || errorData.error?.includes('Username')) {
        setError('Username is already taken. Please choose another one.');
      } else if (errorData.error?.includes('unique') || errorData.error?.includes('duplicate')) {
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

  // ✅ NEW: Handle email verification
  const handleVerification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verificationCode.trim()) {
      setError('Please enter the verification code');
      return;
    }

    setError(null);
    setLoading(true);

    try {
      if (!signUpLoaded || !signUp) {
        setError('Sign up not ready. Please try again.');
        setLoading(false);
        return;
      }

      // Attempt email verification
      const result = await signUp.attemptEmailAddressVerification({
        code: verificationCode,
      });

      if (result.status === 'complete') {
        // Verification successful, set session
        if (result.createdSessionId && setActive) {
          await setActive({ session: result.createdSessionId });
        }
        
        const userId = result.createdUserId;
        setCreatedUserId(userId);
        
        if (userId) {
          // Wait a moment for the session to be fully established
          setTimeout(async () => {
            const profileExists = await checkUserProfileExists(userId);
            
            if (!profileExists) {
              // Profile doesn't exist in database, show onboarding
              setDisplayName(authUsername); // Pre-fill with username
              setCurrentStep('onboarding');
            } else {
              // Profile exists in database, just close modal and reload
              onClose();
              window.location.reload();
            }
            setLoading(false);
          }, 1000);
        } else {
          setLoading(false);
        }
      } else {
        setError('Invalid verification code. Please try again.');
        setLoading(false);
      }
    } catch (err: any) {
      console.error('Verification error:', err);
      
      if (err.errors && err.errors.length > 0) {
        const errorMessage = err.errors[0].message;
        setError(errorMessage);
      } else {
        setError('Verification failed. Please try again.');
      }
      setLoading(false);
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
=======
    const handleSubmit = async (e: React.FormEvent) => {
>>>>>>> parent of 80cc64c (added icons for signin/up)
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
        // Handle Sign Up
        if (!signUpLoaded || !signUp) return;

        // ✅ FIXED: Create signup with all required fields including username
        const result = await signUp.create({
<<<<<<< HEAD
          emailAddress: email,
          password,
          username: authUsername, // This fixes the missing_requirements error
        });

        console.log('SignUp result:', result.status, result);
        console.log('Required fields:', result.requiredFields);
        console.log('Missing fields:', result.missingFields);
        console.log('Unverified fields:', result.unverifiedFields);

        if (result.status === 'complete') {
          // Sign up successful, set session
          if (result.createdSessionId && setActive) {
            await setActive({ session: result.createdSessionId });
          }
          
          const userId = result.createdUserId;
          setCreatedUserId(userId);
          
          if (userId) {
            // Wait a moment for the session to be fully established
            setTimeout(async () => {
              const profileExists = await checkUserProfileExists(userId);
              
              if (!profileExists) {
                // Profile doesn't exist in database, show onboarding
                setDisplayName(authUsername); // Pre-fill with username
                setCurrentStep('onboarding');
              } else {
                // Profile exists in database, just close modal and reload
                onClose();
                window.location.reload();
              }
              setLoading(false);
            }, 1000);
          } else {
            setLoading(false);
          }
        } else if (result.status === 'missing_requirements') {
          console.log('Missing requirements:', result.missingFields);
          console.log('Required fields:', result.requiredFields);
          console.log('Unverified fields:', result.unverifiedFields);
          
          // Check if it's actually just email verification needed
          if (result.unverifiedFields?.includes('email_address')) {
            // Email verification is needed, proceed to verification step
            try {
              await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
              setCurrentStep('verification');
              setLoading(false);
            } catch (emailError) {
              console.error('Email verification preparation failed:', emailError);
              setError('Failed to send verification email. Please try again.');
              setLoading(false);
            }
          } else if (result.missingFields && result.missingFields.length > 0) {
            // There are actually missing fields
            setError(`Missing required fields: ${result.missingFields.join(', ')}`);
            setLoading(false);
          } else {
            // No missing fields but still missing_requirements - likely email verification
            setError('Account created but needs verification. Please check your email.');
            try {
              await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
              setCurrentStep('verification');
            } catch (emailError) {
              console.error('Email verification preparation failed:', emailError);
            }
            setLoading(false);
          }
        } else {
          // Email verification needed - switch to verification step
          try {
            await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
            setCurrentStep('verification');
            setLoading(false);
          } catch (emailError) {
            setError('Failed to send verification email. Please try again.');
            setLoading(false);
          }
        }
      } else {
        // Sign in logic
=======
            emailAddress: email,
            password,
        });

        // ✅ BETTER: Handle different completion statuses
        if (result.status === 'complete') {
            // User is signed up and signed in
            onClose();
            window.location.reload(); // Simple refresh to update auth state
        } else if (result.status === 'missing_requirements') {
            setError('Please complete all required fields');
        } else {
            // Usually means email verification is needed
            setError('Please check your email for a verification link');
        }
        } else {
        // Handle Sign In
>>>>>>> parent of 80cc64c (added icons for signin/up)
        if (!signInLoaded || !signIn) return;

        const result = await signIn.create({
            identifier: email,
            password,
        });

        // ✅ BETTER: Handle different completion statuses
        if (result.status === 'complete') {
<<<<<<< HEAD
          await setActive?.({ session: result.createdSessionId });
          
          // Wait a moment for the session to be established
          setTimeout(async () => {
            // Try to get user ID from multiple sources
            let userId = user?.id;
            
            // If user is not available yet, try to get it from the token
            if (!userId) {
              try {
                const token = await getToken();
                if (token) {
                  // Decode the token to get user ID (basic JWT decode)
                  const payload = JSON.parse(atob(token.split('.')[1]));
                  userId = payload.sub;
                }
              } catch (e) {
                console.warn('Could not extract user ID from token:', e);
              }
            }
            
            if (userId) {
              const profileExists = await checkUserProfileExists(userId);
              
              if (!profileExists) {
                // User signed in but no profile exists in database, show onboarding
                setCreatedUserId(userId);
                setDisplayName(email.split('@')[0]); // Use email prefix as default
                setAuthUsername(email.split('@')[0]); // Set a default username
                setCurrentStep('onboarding');
                setLoading(false);
                return;
              }
            }
            
            onClose();
            window.location.reload();
          }, 2000); // Increased timeout to 2 seconds
        } else if (result.status === 'needs_second_factor') {
          setError('Two-factor authentication required');
          setLoading(false);
        } else {
          setError('Sign in failed. Please check your credentials.');
          setLoading(false);
=======
            // User is signed in
            onClose();
            window.location.reload(); // Simple refresh to update auth state
        } else if (result.status === 'needs_second_factor') {
            setError('Two-factor authentication required');
        } else {
            setError('Sign in failed. Please check your credentials.');
        }
>>>>>>> parent of 80cc64c (added icons for signin/up)
        }
    } catch (err: any) {
<<<<<<< HEAD
      console.error('Auth error:', err);
      
      if (err.errors && err.errors.length > 0) {
        const errorMessage = err.errors[0].message;
        
        // Handle specific Clerk error messages
        if (errorMessage.includes('identifier already exists')) {
          setError('An account with this email already exists. Please sign in instead.');
        } else if (errorMessage.includes('password')) {
          setError('Password must be at least 8 characters long.');
        } else if (errorMessage.includes('username')) {
          setError('Username is already taken or invalid.');
        } else {
          setError(errorMessage);
        }
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
    
    if (!file.type.startsWith('image/')) {
      setError('Please select a valid image file.');
      return;
    }
    
    setAvatarFile(file);
    setError(null); // Clear any previous error
    
    const reader = new FileReader();
    reader.onloadend = () => {
      setAvatarPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleOnboardingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!displayName.trim()) {
      setError('Display name is required');
      return;
    }

    if (!createdUserId) {
      setError('User ID not found. Please try signing up again.');
      return;
    }

    // Generate username if not set (for sign-in users)
    let finalUsername = authUsername;
    if (!finalUsername) {
      finalUsername = displayName
        .toLowerCase()
        .replace(/[^a-z0-9_]/g, '')
        .slice(0, 20)
        .padEnd(3, '0');
    }

    setLoading(true);
    setError(null);

    try {
      // Convert avatar to base64 if provided
      let avatarData = null;
      if (avatarFile) {
        const reader = new FileReader();
        avatarData = await new Promise((resolve, reject) => {
          reader.onloadend = () => resolve(reader.result);
          reader.onerror = () => reject(new Error('Failed to read avatar file'));
          reader.readAsDataURL(avatarFile);
        });
      }

      // ✅ FIXED: Save profile data to database
      const success = await createUserProfile(
        createdUserId,
        finalUsername,
        displayName.trim(),
        avatarData as string
      );

      if (success) {
        console.log('✅ Profile created successfully in database!');
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
=======
        console.error('Auth error:', err);
        
        // ✅ BETTER: Handle specific Clerk error types
        if (err.errors && err.errors.length > 0) {
        setError(err.errors[0].message);
        } else {
        setError(isSignUp ? 'Failed to create account' : 'Failed to sign in');
        }
    } finally {
        setLoading(false);
>>>>>>> parent of 80cc64c (added icons for signin/up)
    }
    };

  const handleOAuth = async (provider: 'oauth_google' | 'oauth_discord') => {
    setError(null);
    setLoading(true);

    try {
      if (isSignUp && signUpLoaded && signUp) {
        await signUp.authenticateWithRedirect({
          strategy: provider,
          redirectUrl: window.location.origin + '/auth/callback',
          redirectUrlComplete: window.location.origin + '/auth/complete',
        });
      } else if (signInLoaded && signIn) {
        await signIn.authenticateWithRedirect({
          strategy: provider,
          redirectUrl: window.location.origin + '/auth/callback',
          redirectUrlComplete: window.location.origin + '/auth/complete',
        });
      }
    } catch (err: any) {
      console.error('OAuth error:', err);
      setError('OAuth authentication failed. Please try again.');
      setLoading(false);
    }
  };

<<<<<<< HEAD
  // Reset state when switching between sign in/up
  useEffect(() => {
    if (mounted) {
      setError(null);
      setEmail('');
      setPassword('');
      setAuthUsername('');
      setVerificationCode('');
      setCurrentStep('auth');
      setLoading(false);
    }
  }, [isSignUp, mounted]);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setError(null);
      setEmail('');
      setPassword('');
      setAuthUsername('');
      setVerificationCode('');
      setDisplayName('');
      setAvatarFile(null);
      setAvatarPreview(null);
      setCreatedUserId(null);
      setCurrentStep('auth');
      setLoading(false);
      setIsSignUp(false);
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
              : currentStep === 'verification'
              ? 'Verify Email'
              : 'Complete Your Profile'
            }
          </div>
          <div className="title-bar-controls">
            <button aria-label="Close" onClick={onClose}></button>
          </div>
        </div>

        {/* Window Body */}
        <div className="window-body p-6">
          {/* ✅ NEW: Add CAPTCHA container for Clerk */}
          <div id="clerk-captcha" style={{ display: 'none' }}></div>
          
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
                  <div className="text-red-600 text-xs p-3 bg-red-50 border border-red-200 rounded">
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
                  className="w-full flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  Continue with Google
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleOAuth('oauth_discord')}
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419-.0002 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9554 2.4189-2.1568 2.4189Z"/>
                  </svg>
                  Continue with Discord
                </Button>
              </div>
            </>
          ) : currentStep === 'verification' ? (
            <>
              {/* Email Verification Form */}
              <div className="text-center mb-4">
                <p className="text-sm text-gray-600">
                  We sent a verification code to <strong>{email}</strong>
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Check your email and enter the 6-digit code below
                </p>
              </div>

              <form onSubmit={handleVerification} className="space-y-4">
                <div>
                  <Label htmlFor="verification-code">Verification Code</Label>
                  <Input
                    id="verification-code"
                    type="text"
                    value={verificationCode}
                    onChange={(e) => setVerificationCode(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))}
                    required
                    maxLength={6}
                    disabled={loading}
                    placeholder="Enter 6-digit code"
                    className="text-center text-2xl tracking-widest"
                  />
                </div>

                {error && (
                  <div className="text-red-600 text-xs p-3 bg-red-50 border border-red-200 rounded">
                    {error}
                  </div>
                )}

                <div className="flex gap-2">
                  <Button 
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setCurrentStep('auth');
                      setVerificationCode('');
                      setError(null);
                    }}
                    disabled={loading}
                    className="flex-1"
                  >
                    Back
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={loading || verificationCode.length !== 6}
                    className="flex-1"
                  >
                    {loading ? 'Verifying...' : 'Verify Email'}
                  </Button>
                </div>
              </form>

              <div className="text-center mt-4">
                <button
                  type="button"
                  className="text-sm text-blue-600 hover:text-blue-800 underline"
                  onClick={async () => {
                    try {
                      await signUp?.prepareEmailAddressVerification({ strategy: 'email_code' });
                      setError(null);
                    } catch (err) {
                      setError('Failed to resend verification email');
                    }
                  }}
                  disabled={loading}
                >
                  Resend verification email
                </button>
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
                  <p className="text-xs text-gray-500 mt-1">JPG, PNG, or GIF. Max 2MB.</p>
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
                  <Label>Username {authUsername ? '(from signup)' : '(auto-generated)'}</Label>
                  <div className="text-sm text-gray-600 bg-gray-50 p-2 rounded border">
                    @{authUsername || (displayName
                      .toLowerCase()
                      .replace(/[^a-z0-9_]/g, '')
                      .slice(0, 20)
                      .padEnd(3, '0')) || 'username'}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">This will be saved to the database.</p>
                </div>

                {error && (
                  <div className="text-red-600 text-xs p-3 bg-red-50 border border-red-200 rounded">
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
                    disabled={loading || !displayName.trim()}
                    className="flex-1"
                  >
                    {loading ? 'Saving to Database...' : 'Complete Setup'}
                  </Button>
                </div>
              </form>
            </>
          )}
=======
  return (
    <>

      {/* Backdrop */}
<div 
  className="auth-modal-backdrop" 
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
              {isSignUp ? 'Create Account' : 'Sign In'}
            </div>
            <div className="title-bar-controls">
              <button aria-label="Close" onClick={onClose}></button>
            </div>
          </div>

          {/* Window Body */}
          <div className="window-body p-6">
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

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
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
          </div>
>>>>>>> parent of 80cc64c (added icons for signin/up)
        </div>
      </div>
    </>
  );
}