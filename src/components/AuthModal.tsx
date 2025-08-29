// src/components/AuthModal.tsx - IMPROVED CLERK INTEGRATION
'use client';
import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useSignIn, useSignUp, useAuth, useUser } from '@clerk/nextjs';

import { Button } from '@/components/ui/button-themed';
import { Input } from '@/components/ui/input-themed';
import { Label } from '@/components/ui/label-themed';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AuthModal({ isOpen, onClose }: AuthModalProps) {
  const [isSignUp, setIsSignUp] = useState(false);
  
  // Auth state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [pendingVerification, setPendingVerification] = useState(false);

  const { signIn, setActive: signInSetActive, isLoaded: signInLoaded } = useSignIn();
  const { signUp, setActive: signUpSetActive, isLoaded: signUpLoaded } = useSignUp();
  const { getToken } = useAuth();
  const { user } = useUser();

  // Close modal on Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  // Reset form when modal closes
  useEffect(() => {
    if (!isOpen) {
      resetForm();
    }
  }, [isOpen]);

  const resetForm = () => {
    setEmail('');
    setPassword('');
    setUsername('');
    setVerificationCode('');
    setError(null);
    setSuccess(null);
    setPendingVerification(false);
    setLoading(false);
  };

  // Enhanced email validation
  const validateEmail = (email: string): boolean => {
    const cleanEmail = email.replace(/[\u200B-\u200D\uFEFF]/g, '').trim();
    const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
    return emailRegex.test(cleanEmail) && cleanEmail.length <= 254;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const cleanEmail = email.replace(/[\u200B-\u200D\uFEFF]/g, '').trim().toLowerCase();
    const trimmedPassword = password.trim();
    const trimmedUsername = username.trim();
    
    if (!cleanEmail || !trimmedPassword) {
      setError('Please fill in all required fields');
      return;
    }
    
    if (!validateEmail(cleanEmail)) {
      setError('Please enter a valid email address');
      return;
    }
    
    // For signup, username is optional but recommended
    if (isSignUp && trimmedUsername && trimmedUsername.length < 3) {
      setError('Username must be at least 3 characters if provided');
      return;
    }
    
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      if (isSignUp) {
        if (!signUpLoaded || !signUp) {
          setError('Authentication system not ready. Please try again.');
          setLoading(false);
          return;
        }

        // Prepare signup data - only include username if provided
        const signUpData: any = {
          emailAddress: cleanEmail,
          password: trimmedPassword,
        };

        // Only add username if it's provided and valid
        if (trimmedUsername && trimmedUsername.length >= 3) {
          signUpData.username = trimmedUsername;
        }


        const result = await signUp.create(signUpData);

        if (result.status === 'complete') {
          // Account created and verified - set the session active
          if (signUpSetActive && result.createdSessionId) {
            await signUpSetActive({ session: result.createdSessionId });
          }
          setSuccess('Account created successfully! Redirecting...');
          
          // Give the webhook time to create the profile before reloading
          setTimeout(() => {
            onClose();
            window.location.href = window.location.href; // Force full reload
          }, 2000); // Increased delay for webhook processing
        } else if (result.status === 'missing_requirements') {
          // Check what's missing
          if (result.unverifiedFields?.includes('email_address')) {
            setPendingVerification(true);
            setSuccess('Please check your email and enter the verification code below');
            
            // Attempt to send verification email
            try {
              await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
            } catch (prepareError) {
            }
          } else {
            setError(`Please complete: ${result.missingFields?.join(', ') || 'required fields'}`);
          }
        } else {
          // Handle incomplete status
          setPendingVerification(true);
          setSuccess('Please check your email and enter the verification code below');
        }
      } else {
        // Sign in logic
        if (!signInLoaded || !signIn) {
          setError('Authentication system not ready. Please try again.');
          setLoading(false);
          return;
        }

        const result = await signIn.create({
          identifier: cleanEmail,
          password: trimmedPassword,
        });

        if (result.status === 'complete') {
          if (signInSetActive && result.createdSessionId) {
            await signInSetActive({ session: result.createdSessionId });
          }
          setSuccess('Welcome back! Redirecting...');
          setTimeout(() => {
            onClose();
            window.location.href = window.location.href; // Force full reload
          }, 1000);
        } else if (result.status === 'needs_second_factor') {
          setError('Two-factor authentication required. Please check your authenticator app.');
        } else {
          setError('Sign in failed. Please check your credentials.');
        }
      }
    } catch (err: any) {
      
      if (err.errors && err.errors.length > 0) {
        const errorMessage = err.errors[0].message;
        const errorCode = err.errors[0].code;
        
        // Handle specific Clerk error codes
        switch (errorCode) {
          case 'form_identifier_exists':
            setError('An account with this email already exists. Try signing in instead.');
            break;
          case 'form_password_pwned':
            setError('This password has been found in a data breach. Please choose a different password.');
            break;
          case 'form_password_validation_failed':
            setError('Password must be at least 8 characters long.');
            break;
          case 'form_username_invalid_character':
            setError('Username contains invalid characters. Use only letters, numbers, and underscores.');
            break;
          case 'form_username_invalid_length':
            setError('Username must be between 3 and 20 characters.');
            break;
          case 'session_exists':
            setError('You are already signed in. Please refresh the page.');
            break;
          case 'identifier_already_signed_in':
            setError('Already signed in with this account. Please refresh the page.');
            break;
          default:
            if (errorMessage.toLowerCase().includes('email')) {
              setError('Invalid email format or email already in use.');
            } else if (errorMessage.toLowerCase().includes('password')) {
              if (isSignUp) {
                setError('Password must be at least 8 characters long and secure.');
              } else {
                setError('Incorrect password. Please try again.');
              }
            } else if (errorMessage.toLowerCase().includes('username')) {
              setError('Username is already taken or invalid. Please try another.');
            } else if (errorMessage.toLowerCase().includes('identifier')) {
              setError('No account found with this email. Please check your email or sign up.');
            } else {
              setError(errorMessage || 'Authentication failed. Please try again.');
            }
        }
      } else {
        setError(isSignUp ? 'Failed to create account. Please try again.' : 'Failed to sign in. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleVerification = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!verificationCode.trim()) {
      setError('Please enter the verification code');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      if (!signUp) {
        setError('Verification system not ready');
        return;
      }

      const result = await signUp.attemptEmailAddressVerification({
        code: verificationCode.trim(),
      });

      if (result.status === 'complete') {
        if (signUpSetActive && result.createdSessionId) {
          await signUpSetActive({ session: result.createdSessionId });
        }
        setSuccess('Email verified! Your account is ready. Redirecting...');
        
        // Give webhook time to process before reloading
        setTimeout(() => {
          onClose();
          window.location.href = window.location.href; // Force full reload
        }, 2000);
      } else {
        setError('Verification incomplete. Please try again.');
      }
    } catch (err: any) {
      if (err.errors && err.errors.length > 0) {
        const errorMessage = err.errors[0].message;
        if (errorMessage.includes('invalid')) {
          setError('Invalid verification code. Please check and try again.');
        } else if (errorMessage.includes('expired')) {
          setError('Verification code expired. Please request a new one.');
        } else {
          setError(errorMessage);
        }
      } else {
        setError('Verification failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleOAuth = async (provider: 'oauth_google' | 'oauth_discord') => {
    setError(null);
    setLoading(true);

    try {
      // Use the current page as redirect URL for localhost development
      const redirectUrl = `${window.location.origin}/sso-callback`;
      const redirectUrlComplete = `${window.location.origin}`;

      if (isSignUp && signUpLoaded && signUp) {
        await signUp.authenticateWithRedirect({
          strategy: provider,
          redirectUrl,
          redirectUrlComplete,
        });
      } else if (signInLoaded && signIn) {
        await signIn.authenticateWithRedirect({
          strategy: provider,
          redirectUrl,
          redirectUrlComplete,
        });
      }
    } catch (err: any) {
      console.error('OAuth error:', err);
      if (err.errors && err.errors.length > 0) {
        setError(err.errors[0].message || 'OAuth authentication failed. Please try again.');
      } else {
        setError('OAuth authentication failed. Please try again.');
      }
      setLoading(false);
    }
  };

  const resendVerificationEmail = async () => {
    if (!signUp) return;
    
    setLoading(true);
    try {
      await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
      setSuccess('Verification email sent! Please check your inbox.');
      setError(null);
    } catch (err) {
      setError('Failed to resend verification email. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const isClerkReady = signInLoaded && signUpLoaded;

  return createPortal(
    <>
      {/* Backdrop */}
      <div 
        className="auth-modal-backdrop-fixed" 
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
              {pendingVerification 
                ? 'Verify Email' 
                : isSignUp 
                  ? 'Create Account' 
                  : 'Sign In'
              }
            </div>
            <div className="title-bar-controls">
              <button aria-label="Close" onClick={onClose}></button>
            </div>
          </div>

          {/* Window Body */}
          <div className="window-body p-6">
            
            {/* Loading State */}
            {!isClerkReady && (
              <div className="loading-state text-center py-4">
                <div className="text-sm text-gray-600">Loading authentication...</div>
              </div>
            )}

            {/* Verification Step */}
            {isClerkReady && pendingVerification && (
              <form onSubmit={handleVerification} className="space-y-4">
                <div className="text-center mb-4">
                  <p className="text-sm text-gray-600">
                    We sent a verification code to <strong>{email}</strong>
                  </p>
                </div>
                
                <div>
                  <Label htmlFor="verification-code">Verification Code</Label>
                  <Input 
                    id="verification-code"
                    type="text" 
                    value={verificationCode} 
                    onChange={(e) => setVerificationCode(e.target.value)}
                    placeholder="Enter 6-digit code"
                    maxLength={6}
                    required 
                    disabled={loading}
                    autoComplete="one-time-code"
                  />
                </div>

                {/* Success/Error Messages */}
                {success && (
                  <div className="text-green-600 text-xs p-2 bg-green-100 border border-green-400 rounded">
                    {success}
                  </div>
                )}

                {error && (
                  <div className="text-red-600 text-xs p-2 bg-red-100 border border-red-400 rounded">
                    {error}
                  </div>
                )}

                <div className="space-y-2">
                  <Button 
                    type="submit" 
                    className="w-full" 
                    disabled={loading || !verificationCode.trim()}
                  >
                    {loading ? 'Verifying...' : 'Verify Email'}
                  </Button>
                  
                  <Button 
                    type="button"
                    variant="outline"
                    onClick={resendVerificationEmail}
                    disabled={loading}
                    className="w-full"
                  >
                    Resend Code
                  </Button>
                  
                  <Button 
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      setPendingVerification(false);
                      setError(null);
                      setSuccess(null);
                    }}
                    className="w-full"
                  >
                    Back to Sign Up
                  </Button>
                </div>
              </form>
            )}

            {/* Main Auth Form */}
            {isClerkReady && !pendingVerification && (
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
                      setSuccess(null);
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
                      setSuccess(null);
                    }}
                  >
                    Sign Up
                  </button>
                </div>

                {/* Email/Password Form */}
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <Label htmlFor="email">Email</Label>
                    <Input 
                      id="email" 
                      type="email" 
                      value={email} 
                      onChange={(e) => {
                        const cleanValue = e.target.value.replace(/[\u200B-\u200D\uFEFF]/g, '');
                        setEmail(cleanValue);
                      }}
                      required 
                      disabled={loading}
                      autoComplete="email"
                      placeholder="Enter your email"
                    />
                  </div>

                  {/* Username Field - Optional for Sign Up */}
                  {isSignUp && (
                    <div>
                      <Label htmlFor="username">
                        Username <span className="text-gray-500 text-xs">(optional)</span>
                      </Label>
                      <Input 
                        id="username" 
                        type="text" 
                        value={username} 
                        onChange={(e) => setUsername(e.target.value)} 
                        disabled={loading}
                        autoComplete="username"
                        placeholder="Choose a username (optional)"
                        minLength={3}
                        maxLength={20}
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Leave blank to use your email prefix as username
                      </p>
                    </div>
                  )}
                  
                  <div>
                    <Label htmlFor="password">
                      Password {isSignUp && <span className="text-xs text-gray-500">(min. 8 characters)</span>}
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

                  {/* Success/Error Messages */}
                  {success && (
                    <div className="text-green-600 text-xs p-2 bg-green-100 border border-green-400 rounded">
                      {success}
                    </div>
                  )}

                  {error && (
                    <div className="text-red-600 text-xs p-2 bg-red-100 border border-red-400 rounded">
                      {error}
                    </div>
                  )}

                  <Button 
                    type="submit" 
                    className="w-full" 
                    disabled={loading || !email || !password}
                  >
                    {loading 
                      ? (isSignUp ? 'Creating Account...' : 'Signing In...') 
                      : (isSignUp ? 'Create Account' : 'Sign In')
                    }
                  </Button>
                </form>
                
                {/* CAPTCHA Container - Visible in modal when needed */}
                <div id="clerk-captcha-modal" className="mt-4 flex justify-center"></div>
                
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
                  
                  {/* Additional CAPTCHA Container for OAuth flows */}
                  <div id="clerk-captcha-oauth" className="mt-2 flex justify-center"></div>
                </div>
              </>
            )}

          </div>
        </div>
      </div>
    </>,
    document.body
  );
}