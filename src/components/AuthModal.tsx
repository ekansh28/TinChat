// src/components/AuthModal.tsx - UPDATED WITH PORTAL AND USERNAME
'use client';
import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useSignIn, useSignUp } from '@clerk/nextjs';
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

  const { signIn, setActive, isLoaded: signInLoaded } = useSignIn();
  const { signUp, isLoaded: signUpLoaded } = useSignUp();

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || (isSignUp && !username)) return;
    
    setError(null);
    setLoading(true);

    try {
      if (isSignUp) {
        if (!signUpLoaded || !signUp) return;

        const result = await signUp.create({
          emailAddress: email,
          username, // Add username to sign up
          password,
        });

        if (result.status === 'complete') {
          onClose();
          window.location.reload();
        } else if (result.status === 'missing_requirements') {
          setError('Please complete all required fields');
        } else {
          setError('Please check your email for a verification link');
        }
      } else {
        if (!signInLoaded || !signIn) return;

        const result = await signIn.create({
          identifier: email,
          password,
        });

        if (result.status === 'complete') {
          onClose();
          window.location.reload();
        } else if (result.status === 'needs_second_factor') {
          setError('Two-factor authentication required');
        } else {
          setError('Sign in failed. Please check your credentials.');
        }
      }
    } catch (err: any) {
      console.error('Auth error:', err);
      
      if (err.errors && err.errors.length > 0) {
        setError(err.errors[0].message);
      } else {
        setError(isSignUp ? 'Failed to create account' : 'Failed to sign in');
      }
    } finally {
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
          redirectUrl: window.location.origin,
          redirectUrlComplete: window.location.origin,
        });
      } else if (signInLoaded) {
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

  // 🔥 CRITICAL: Don't render until mounted (prevents SSR issues)
  if (!mounted || !isOpen) return null;

  const modalContent = (
    <div 
      className="auth-modal-backdrop-fixed"
      onClick={onClose}
    >
      {/* Modal Window */}
      <div 
        className="auth-modal-window"
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
        <div className="window-body auth-modal-body">
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
              <div id="clerk-captcha"></div>
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

            {isSignUp && (
              <div>
                <Label htmlFor="username">Username</Label>
                <Input 
                  id="username" 
                  type="text" 
                  value={username} 
                  onChange={(e) => setUsername(e.target.value)} 
                  required 
                  disabled={loading}
                  autoComplete="username"
                  placeholder="Choose a username"
                  minLength={3}
                  maxLength={30}
                />
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
        </div>
      </div>
    </div>
  );

  // 🔥 CRITICAL: Render modal at root level using createPortal
  return createPortal(modalContent, document.body);
}