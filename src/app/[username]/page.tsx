// app/[username]/page.tsx - FIXED FOR NEXT.JS 15
import { notFound } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ✅ FIXED: Next.js 15 requires params to be awaited
interface PageProps {
  params: Promise<{ username: string }>;
}

export default async function UserProfilePage({ params }: PageProps) {
  // ✅ FIXED: Await the params object
  const { username } = await params;
  
  // Fetch user data from Supabase
  const { data: user, error } = await supabase
    .from('user_profiles')
    .select('username, display_name, avatar_url')
    .eq('username', username.toLowerCase())
    .single();

  if (error || !user) {
    return notFound();
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-md p-6 text-center">
        {user.avatar_url && (
          <img 
            src={user.avatar_url} 
            alt={`${user.username}'s avatar`}
            className="w-24 h-24 rounded-full mx-auto mb-4"
          />
        )}
        <h1 className="text-3xl font-bold mb-2">
          Welcome to {user.display_name || user.username}'s page
        </h1>
        <p className="text-gray-600">@{user.username}</p>
      </div>
    </div>
  );
}