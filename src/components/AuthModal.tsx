// src/components/AuthModal.tsx - NEW FILE
'use client';
import { useState } from 'react';
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
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const { signIn, setActive, isLoaded: signInLoaded } = useSignIn();
  const { signUp, isLoaded: signUpLoaded } = useSignUp();

  if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    
    setError(null);
    setLoading(true);

    try {
        if (isSignUp) {
        // Handle Sign Up
        if (!signUpLoaded || !signUp) return;

        const result = await signUp.create({
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
        if (!signInLoaded || !signIn) return;

        const result = await signIn.create({
            identifier: email,
            password,
        });

        // ✅ BETTER: Handle different completion statuses
        if (result.status === 'complete') {
            // User is signed in
            onClose();
            window.location.reload(); // Simple refresh to update auth state
        } else if (result.status === 'needs_second_factor') {
            setError('Two-factor authentication required');
        } else {
            setError('Sign in failed. Please check your credentials.');
        }
        }
    } catch (err: any) {
        console.error('Auth error:', err);
        
        // ✅ BETTER: Handle specific Clerk error types
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
        </div>
      </div>
    </>
  );
}