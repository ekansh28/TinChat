'use client';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button-themed';
import { Input } from '@/components/ui/input-themed';
import { Label } from '@/components/ui/label-themed';
import Link from 'next/link';
import { useTheme } from '@/components/theme-provider';
import HomeButton from '@/components/HomeButton';

export default function SignUpPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [oauthLoading, setOauthLoading] = useState<string | null>(null);
  const router = useRouter();
  const { currentTheme } = useTheme();
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Check if user is already authenticated
  useEffect(() => {
    const checkExistingAuth = async () => {
      if (!mountedRef.current) return;

      try {
        console.log('SignUp: Checking existing authentication...');
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          console.error('SignUp: Session error:', sessionError);
          if (mountedRef.current) setInitialLoading(false);
          return;
        }

        if (session?.user && mountedRef.current) {
          console.log('SignUp: User already authenticated, redirecting to home');
          router.replace('/');
          return;
        }

        if (mountedRef.current) {
          console.log('SignUp: No existing session, showing signup form');
          setInitialLoading(false);
        }
      } catch (error) {
        console.error('SignUp: Error checking auth session:', error);
        if (mountedRef.current) setInitialLoading(false);
      }
    };

    checkExistingAuth();
  }, [router]);

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mountedRef.current) return;

    setError(null);
    setMessage(null);
    setLoading(true);

    try {
      console.log('SignUp: Starting signup process for:', email);

      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/onboarding`,
        }
      });

      if (!mountedRef.current) return;

      if (signUpError) {
        console.error('SignUp: Signup error:', signUpError);
        
        if (signUpError.message.includes('already registered') || 
            signUpError.message.includes('already exists') ||
            signUpError.message.includes('User already registered')) {
          setError("An account with this email already exists. Redirecting to sign in...");
          setTimeout(() => {
            if (mountedRef.current) {
              router.push('/signin');
            }
          }, 2000);
        } else {
          setError(signUpError.message);
        }
      } else if (data.user && data.user.identities?.length === 0) {
        // User already exists but is unconfirmed
        console.log('SignUp: User exists but unconfirmed');
        setError("An account with this email already exists. Please check your email for confirmation or try signing in.");
        setTimeout(() => {
          if (mountedRef.current) {
            router.push('/signin');
          }
        }, 3000);
      } else if (data.user) {
        // Successful signup
        console.log('SignUp: Signup successful, user:', data.user.id);
        
        if (data.session) {
          // Auto-confirmed, redirect to onboarding
          console.log('SignUp: User auto-confirmed, redirecting to onboarding');
          router.push('/onboarding');
        } else {
          // Email confirmation required
          console.log('SignUp: Email confirmation required');
          setMessage('Account created successfully! Please check your email for a confirmation link. After confirming, you\'ll be guided through profile setup.');
        }
      } else {
        console.error('SignUp: Unexpected signup result');
        setError("An unexpected error occurred during sign up. Please try again.");
      }
    } catch (error: any) {
      console.error('SignUp: Exception during signup:', error);
      if (mountedRef.current) {
        setError("An unexpected error occurred. Please try again.");
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  };

  const handleOAuthSignIn = async (provider: 'google' | 'discord' | 'spotify') => {
    if (!mountedRef.current) return;

    setError(null);
    setMessage(null);
    setOauthLoading(provider);
    
    try {
      console.log(`SignUp: Starting ${provider} OAuth signup`);
      
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/onboarding`,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          }
        },
      });

      if (oauthError) {
        console.error(`SignUp: ${provider} OAuth error:`, oauthError);
        if (mountedRef.current) {
          setError(oauthError.message);
          setOauthLoading(null);
        }
      }
      // On success, Supabase handles redirection automatically
    } catch (error: any) {
      console.error(`SignUp: ${provider} OAuth exception:`, error);
      if (mountedRef.current) {
        setError("Failed to sign up with " + provider);
        setOauthLoading(null);
      }
    }
  };

  if (initialLoading) {
    return (
      <>
        <HomeButton />
        <div className="flex flex-col items-center justify-center min-h-screen p-4">
          <div className="window w-full max-w-md">
            <div className="title-bar">
              <div className="title-bar-text">Loading...</div>
            </div>
            <div className="window-body p-4">
              <div className="text-center">
                <p className="text-black dark:text-white animate-pulse">Checking authentication status...</p>
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <HomeButton />
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <div className="window w-full max-w-md">
          <div className="title-bar">
            <div className="title-bar-text">Create Account</div>
             <div className="title-bar-controls">
                <button aria-label="Close" onClick={() => router.push('/')}></button>
            </div>
          </div>
          <div className="window-body p-4">
            <form onSubmit={handleSignUp} className="space-y-4">
              <div>
                <Label htmlFor="email">Email</Label>
                <Input 
                  id="email" 
                  type="email" 
                  value={email} 
                  onChange={(e) => setEmail(e.target.value)} 
                  required 
                  disabled={loading || !!oauthLoading}
                  autoComplete="email"
                />
              </div>
              <div>
                <Label htmlFor="password">Password (min. 6 characters)</Label>
                <Input 
                  id="password" 
                  type="password" 
                  value={password} 
                  onChange={(e) => setPassword(e.target.value)} 
                  required 
                  minLength={6}
                  disabled={loading || !!oauthLoading}
                  autoComplete="new-password"
                />
              </div>
              {error && (
                <div className="text-red-600 text-xs p-2 bg-red-100 border border-red-400 rounded">
                  {error}
                </div>
              )}
              {message && (
                <div className="text-green-600 text-xs p-2 bg-green-100 border border-green-400 rounded">
                  {message}
                </div>
              )}
              <Button 
                type="submit" 
                className="w-full" 
                disabled={loading || !!oauthLoading}
              >
                {loading ? 'Creating Account...' : 'Create Account'}
              </Button>
            </form>
            
            <div className="flex items-center my-4">
              <hr className="flex-grow border-t border-gray-300 dark:border-gray-600" />
              <span className="mx-2 text-xs text-gray-500 dark:text-gray-400">OR</span>
              <hr className="flex-grow border-t border-gray-300 dark:border-gray-600" />
            </div>
            
            <div className="flex flex-col gap-2">
              <Button 
                variant="outline" 
                onClick={() => handleOAuthSignIn('google')} 
                disabled={loading || !!oauthLoading}
              >
                {oauthLoading === 'google' ? 'Connecting...' : 'Continue with Google'}
              </Button>
              <Button 
                variant="outline" 
                onClick={() => handleOAuthSignIn('discord')} 
                disabled={loading || !!oauthLoading}
              >
                {oauthLoading === 'discord' ? 'Connecting...' : 'Continue with Discord'}
              </Button>
              <Button 
                variant="outline" 
                onClick={() => handleOAuthSignIn('spotify')} 
                disabled={loading || !!oauthLoading}
              >
                {oauthLoading === 'spotify' ? 'Connecting...' : 'Continue with Spotify'}
              </Button>
            </div>
            
            <p className="text-xs text-center mt-4">
              Already have an account? <Link href="/signin" className="text-blue-600 hover:underline">Sign In</Link>
            </p>
          </div>
        </div>
      </div>
    </>
  );
}