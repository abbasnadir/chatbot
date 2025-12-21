'use client';
import { useRouter } from 'next/navigation';
import { signOut } from 'next-auth/react';
import { useAuth } from '@/components/AuthContext';

export default function Navbar() {
  const router = useRouter();
  const { signedIn, setSignedIn, setUser } = useAuth();

  const logOut = async () => {
    try {
      const result = await signOut({
        redirect: false
      });

      if (result?.url) {
        setSignedIn(false);
        setUser(null);
        router.push('/');
      }
    } catch (error) {
      console.error('Failed to log out:', error);
    }
  }

  return (
    <nav className="flex m-4 dark:bg-white/30 bg-gray-800/30 fixed w-[calc(100%-2rem)] justify-between items-center p-4
        rounded-lg backdrop-blur-md shadow-[0_0_2px_#686464]">
      <div className="flex gap-4 items-center">

        <span>Settings</span>
        {signedIn ?
          <button onClick={() => logOut()} className='cursor-pointer'>Log Out</button> :
          <>
            <button onClick={() => router.push('/login')} className='cursor-pointer'>Sign In</button>
            <button onClick={() => router.push('/signup')} className='cursor-pointer'>Sign up</button>
          </>
        }

      </div>
    </nav>
  );
}