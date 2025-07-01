// src/components/AuthModal.tsx - ROBUST VERSION
'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useSignIn, useSignUp, useClerk } from '@clerk/nextjs';
import { Button } from '@/components/ui/button-themed';
import { Input } from '@/components/ui/input-themed';
import { Label } from '@/components/ui/label-themed';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AuthModal({ isOpen, onClose }: AuthModalProps) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const [checkingUsername, setCheckingUsername] = useState(false);
  
  // Email verification state
  const [pendingVerification, setPendingVerification] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [verificationLoading, setVerificationLoading] = useState(false);

  // Profile sync state - simplified
  const [completingSignup, setCompletingSignup] = useState(false);

  const { signIn, isLoaded: signInLoaded } = useSignIn();
  const { signUp, isLoaded: signUpLoaded } = useSignUp();
  const { setActive } = useClerk();

  // Mount detection for portal
  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  // Escape key handler
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

  // Real-time username availability check with better error handling
  useEffect(() => {
    if (!isSignUp || !username || username.length < 3) {
      setUsernameAvailable(null);
      return;
    }

    const checkUsername = async () => {
      setCheckingUsername(true);
      setError(null);
      
      try {
        console.log('🔍 Checking username:', username);
        
        // Add timeout to prevent hanging
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

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
          setError('Username check timed out. You can still proceed with signup.');
        } else {
          // Fallback to basic client-side validation
          const usernameRegex = /^[a-zA-Z0-9_-]+$/;
          if (!usernameRegex.test(username)) {
            setUsernameAvailable(false);
            setError('Username can only contain letters, numbers, underscores, and hyphens');
          } else {
            setUsernameAvailable(null);
            setError('Unable to check username availability. You can still proceed with signup.');
          }
        }
      } finally {
        setCheckingUsername(false);
      }
    };

    // Debounce the API call
    const timeoutId = setTimeout(checkUsername, 800);
    return () => clearTimeout(timeoutId);
  }, [username, isSignUp]);

  // Simplified success handler - let Clerk webhook handle profile creation
  const handleAuthSuccess = async (sessionId: string, userId?: string) => {
    try {
      console.log('✅ Authentication successful');
      
      if (setActive) {
        await setActive({ session: sessionId });
        console.log('✅ Session set successfully');
      }

      // For sign up, show brief completion message
      if (isSignUp) {
        setCompletingSignup(true);
        
        // Give webhook time to process in background
        setTimeout(() => {
          onClose();
          window.location.reload();
        }, 2000);
      } else {
        // For sign in, immediate redirect
        onClose();
        setTimeout(() => {
          window.location.reload();
        }, 100);
      }

    } catch (error) {
      console.error('❌ Auth success handler error:', error);
      
      // Fallback - still close modal and refresh
      onClose();
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || (isSignUp && !username)) return;
    
    setError(null);
    setLoading(true);

    try {
      if (isSignUp) {
        if (!signUpLoaded || !signUp) return;

        console.log('🔑 Starting sign up process with username:', username);

        // Create the sign up
        const result = await signUp.create({
          emailAddress: email,
          username: username.trim(),
          password,
        });

        console.log('📋 Sign up result:', result.status);

        if (result.status === 'missing_requirements') {
          console.log('📧 Email verification required - preparing verification');
          
          try {
            await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
            console.log('✅ Email verification prepared successfully');
            
            setPendingVerification(true);
            setLoading(false);
            setError('Please check your email for a verification code');
          } catch (prepareError) {
            console.error('❌ Failed to prepare email verification:', prepareError);
            setError('Failed to send verification email. Please try again.');
            setLoading(false);
          }
        } else if (result.status === 'complete' && result.createdSessionId) {
          console.log('✅ Sign up completed immediately');
          await handleAuthSuccess(result.createdSessionId, result.createdUserId || undefined);
        } else {
          console.log('📧 Email verification required');
          setError('Please check your email for a verification link');
          setLoading(false);
        }
      } else {
        // Sign In
        if (!signInLoaded || !signIn) return;

        console.log('🔑 Starting sign in process');

        const result = await signIn.create({
          identifier: email,
          password,
        });

        console.log('📋 Sign in result:', result.status);

        if (result.status === 'complete' && result.createdSessionId) {
          await handleAuthSuccess(result.createdSessionId);
        } else if (result.status === 'needs_second_factor') {
          setError('Two-factor authentication required');
          setLoading(false);
        } else {
          setError('Sign in failed. Please check your credentials.');
          setLoading(false);
        }
      }
    } catch (err: any) {
      console.error('Auth error:', err);
      
      if (err.errors && err.errors.length > 0) {
        const errorMsg = err.errors[0].message;
        setError(errorMsg);
        
        // Handle specific errors
        if (errorMsg.includes('identifier_exists')) {
          setError('An account with this email already exists. Try signing in instead.');
        } else if (errorMsg.includes('form_identifier_exists')) {
          setError('Username is already taken. Please choose another.');
        }
      } else {
        setError(isSignUp ? 'Failed to create account' : 'Failed to sign in');
      }
      setLoading(false);
    }
  };

  // Handle email verification code submission
  const handleVerificationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verificationCode || !signUp) return;
    
    setVerificationLoading(true);
    setError(null);

    try {
      console.log('🔐 Attempting email verification with code:', verificationCode);

      const result = await signUp.attemptEmailAddressVerification({
        code: verificationCode,
      });

      console.log('📋 Verification result:', result.status);

      if (result.status === 'complete' && result.createdSessionId) {
        console.log('✅ Email verified and account created');
        await handleAuthSuccess(result.createdSessionId, result.createdUserId || undefined);
      } else {
        setError('Verification failed. Please try again.');
        setVerificationLoading(false);
      }
    } catch (err: any) {
      console.error('Verification error:', err);
      
      if (err.errors && err.errors.length > 0) {
        const errorMsg = err.errors[0].message;
        setError(errorMsg);
        
        // Handle specific verification errors
        if (errorMsg.includes('verification code before attempting')) {
          setError('Please request a new verification code first.');
        } else if (errorMsg.includes('invalid') || errorMsg.includes('incorrect')) {
          setError('Invalid verification code. Please check and try again.');
        } else if (errorMsg.includes('expired')) {
          setError('Verification code expired. Please request a new one.');
        }
      } else {
        setError('Invalid verification code. Please try again.');
      }
      setVerificationLoading(false);
    }
  };

  // Resend verification email
  const handleResendVerification = async () => {
    if (!signUp) return;
    
    setError(null);
    setVerificationLoading(true);
    
    try {
      console.log('📧 Resending verification email...');
      await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
      setError('Verification email sent! Check your inbox.');
      console.log('✅ Verification email resent successfully');
    } catch (err: any) {
      console.error('❌ Failed to resend verification email:', err);
      setError('Failed to resend verification email. Please try again.');
    } finally {
      setVerificationLoading(false);
    }
  };

  const handleOAuth = async (provider: 'oauth_google' | 'oauth_discord') => {
    setError(null);
    setLoading(true);

    try {
      console.log(`🔗 Starting ${provider} authentication`);
      
      if (isSignUp && signUpLoaded && signUp) {
        await signUp.authenticateWithRedirect({
          strategy: provider,
          redirectUrl: window.location.origin,
          redirectUrlComplete: window.location.origin,
        });
      } else if (signInLoaded && signIn) {
        await signIn.authenticateWithRedirect({
          strategy: provider,
          redirectUrl: window.location.origin,
          redirectUrlComplete: window.location.origin,
        });
      }
    } catch (err: any) {
      console.error('OAuth error:', err);
      setError('OAuth authentication failed');
      setLoading(false);
    }
  };

  // Reset form when switching between sign in/up
  const switchMode = (newIsSignUp: boolean) => {
    setIsSignUp(newIsSignUp);
    setError(null);
    setUsername('');
    setUsernameAvailable(null);
    setPendingVerification(false);
    setVerificationCode('');
    setCompletingSignup(false);
  };

  // Generate username suggestion from email
  const suggestUsername = () => {
    if (email) {
      const suggestion = email.split('@')[0].replace(/[^a-zA-Z0-9]/g, '');
      setUsername(suggestion);
    }
  };

  // Don't render until mounted
  if (!mounted || !isOpen) return null;

  const modalContent = (
    <div 
      className="auth-modal-backdrop-fixed"
      onClick={onClose}
    >
      <div 
        className="auth-modal-window"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Title Bar */}
        <div className="title-bar">
          <div className="title-bar-text">
            {completingSignup ? 'Welcome!' :
             pendingVerification ? 'Email Verification' : 
             (isSignUp ? 'Create Account' : 'Sign In')}
          </div>
          <div className="title-bar-controls">
            <button aria-label="Close" onClick={onClose}></button>
          </div>
        </div>

        {/* Window Body */}
        <div className="window-body auth-modal-body">
          {/* Show completion message */}
          {completingSignup ? (
            <div className="text-center py-8">
              <div className="text-4xl mb-4">🎉</div>
              <h3 className="text-lg font-semibold mb-2">Account Created Successfully!</h3>
              <p className="text-sm text-gray-600">
                Welcome to TinChat! We're setting up your profile in the background.
              </p>
              <p className="text-xs text-gray-500 mt-2">
                You'll be redirected in a moment...
              </p>
            </div>
          ) : 
          /* Show verification form if pending */
          pendingVerification ? (
            <>
              <div className="mb-4">
                <h3 className="text-lg font-semibold">Email Verification</h3>
                <p className="text-sm text-gray-600 mt-2">
                  We sent a verification code to <strong>{email}</strong>. 
                  Please enter the code below to complete your account setup.
                </p>
                <p className="text-xs text-blue-600 mt-1">
                  💡 Check your spam folder if you don't see the email within a few minutes.
                </p>
              </div>

              <form onSubmit={handleVerificationSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="verificationCode">Verification Code</Label>
                  <Input 
                    id="verificationCode" 
                    type="text" 
                    value={verificationCode} 
                    onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))} 
                    required 
                    disabled={verificationLoading}
                    placeholder="Enter 6-digit code"
                    maxLength={6}
                    className="text-center text-lg tracking-widest"
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
                  disabled={verificationLoading || verificationCode.length !== 6}
                >
                  {verificationLoading ? 'Verifying...' : 'Verify Email'}
                </Button>

                <div className="flex justify-between items-center text-sm">
                  <button
                    type="button"
                    onClick={handleResendVerification}
                    className="text-blue-600 hover:text-blue-700 underline"
                    disabled={verificationLoading}
                  >
                    Resend Code
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPendingVerification(false);
                      setVerificationCode('');
                      setError(null);
                    }}
                    className="text-gray-600 hover:text-gray-700 underline"
                    disabled={verificationLoading}
                  >
                    Back to Sign Up
                  </button>
                </div>
              </form>
            </>
          ) : (
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
                  onClick={() => switchMode(false)}
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
                  onClick={() => switchMode(true)}
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

                {isSignUp && (
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <Label htmlFor="username">Username</Label>
                      {email && !username && (
                        <button
                          type="button"
                          onClick={suggestUsername}
                          className="text-xs text-blue-600 hover:text-blue-700"
                        >
                          Use email prefix
                        </button>
                      )}
                    </div>
                    <div className="relative">
                      <Input 
                        id="username" 
                        type="text" 
                        value={username} 
                        onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-zA-Z0-9_-]/g, ''))} 
                        required 
                        disabled={loading}
                        autoComplete="username"
                        placeholder="Choose a username"
                        minLength={3}
                        maxLength={30}
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
                  disabled={loading || (isSignUp && usernameAvailable === false)}
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
                  className="oauth-button google-button"
                >
                  Continue with Google
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleOAuth('oauth_discord')}
                  disabled={loading}
                  className="oauth-button discord-button"
                >
                  Continue with Discord
                </Button>
              </div>

              {/* Captcha container for Clerk */}
              <div id="clerk-captcha" className="mt-4"></div>
            </>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}