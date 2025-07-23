// components/myspace/TopFriends.tsx
import Image from 'next/image';
import Link from 'next/link';

export default function TopFriends({ friends }) {
  return (
    <div className="grid grid-cols-3 gap-2 p-2">
      {friends.map(({ friend }) => (
        <Link key={friend.id} href={`/${friend.username}`} className="text-center">
          <Image
            src={friend.avatar_url || '/default-avatar.png'}
            alt={friend.display_name}
            width={80}
            height={80}
            className="rounded-full border-2 border-blue-500 mx-auto"
          />
          <p className="text-sm mt-1 truncate">{friend.display_name || friend.username}</p>
        </Link>
      ))}
    </div>
  );
}