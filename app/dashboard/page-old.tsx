'use client';

import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [characterData, setCharacterData] = useState<any>(null);
  const [votingLogs, setVotingLogs] = useState<any[]>([]);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    } else if (status === 'authenticated') {
      fetchUserData();
      fetchVotingLogs();
    }
  }, [status, router]);

  const fetchUserData = async () => {
    try {
      const response = await fetch('/api/user/characters');
      const data = await response.json();
      setCharacterData(data);
    } catch (error) {
      console.error('Error fetching user data:', error);
    }
  };

  const fetchVotingLogs = async () => {
    try {
      const response = await fetch('/api/user/voting-logs');
      const data = await response.json();
      setVotingLogs(data);
    } catch (error) {
      console.error('Error fetching voting logs:', error);
    }
  };

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-900 via-amber-800 to-amber-900 flex items-center justify-center">
        <div className="text-amber-200 text-2xl">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-900 via-amber-800 to-amber-900">
      {/* Navigation */}
      <nav className="bg-gradient-to-r from-amber-950 to-amber-900 border-b-4 border-amber-600">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <Link href="/" className="text-amber-300 text-2xl font-bold">
                Tale of Conquest
              </Link>
            </div>
            <div className="flex items-center space-x-4">
              <Link
                href="/"
                className="text-amber-200 hover:text-amber-300 font-semibold transition-colors"
              >
                Home
              </Link>
              <Link
                href="/rankings"
                className="text-amber-200 hover:text-amber-300 font-semibold transition-colors"
              >
                Rankings
              </Link>
              <button
                onClick={() => signOut()}
                className="bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white px-4 py-2 rounded-lg border-2 border-red-500 font-semibold transition-all"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Dashboard Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <h1 className="text-5xl font-bold text-amber-300 mb-8">
          Welcome, {session?.user?.name}!
        </h1>

        {/* Profile Section */}
        <div className="bg-gradient-to-b from-amber-950 to-amber-900 border-4 border-amber-600 rounded-lg p-8 mb-8 shadow-2xl">
          <h2 className="text-3xl font-bold text-amber-300 mb-6">Your Profile</h2>
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <p className="text-amber-200">
                <span className="font-semibold">Username:</span> {session?.user?.name}
              </p>
              <p className="text-amber-200 mt-2">
                <span className="font-semibold">Email:</span> {session?.user?.email}
              </p>
              <p className="text-amber-200 mt-2">
                <span className="font-semibold">Credits:</span> {session?.user?.coins || 0}
              </p>
            </div>
            <div className="flex flex-col gap-4">
              <Link
                href="/dashboard/characters"
                className="bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white py-3 px-6 rounded-lg border-2 border-amber-500 font-semibold text-center transition-all"
              >
                View Character Details
              </Link>
              <Link
                href="/dashboard/topup"
                className="bg-gradient-to-r from-cyan-600 to-cyan-700 hover:from-cyan-500 hover:to-cyan-600 text-white py-3 px-6 rounded-lg border-2 border-cyan-500 font-semibold text-center transition-all"
              >
                Top-Up Credits
              </Link>
            </div>
          </div>
        </div>

        {/* Voting Section */}
        <div className="bg-gradient-to-b from-amber-950 to-amber-900 border-4 border-amber-600 rounded-lg p-8 mb-8 shadow-2xl">
          <h2 className="text-3xl font-bold text-amber-300 mb-6">Vote for Rewards</h2>
          <p className="text-amber-200 mb-4">
            Vote for our server and earn 5 Coins every 12 hours!
          </p>
          <div className="flex gap-4">
            <a
              href="https://www.xtremetop100.com/in.php?site=1132376972"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-500 hover:to-purple-600 text-white py-3 px-6 rounded-lg border-2 border-purple-500 font-semibold transition-all"
            >
              Vote for Us
            </a>
            <button
              onClick={async () => {
                try {
                  const response = await fetch('/api/voting/reward', { method: 'POST' });
                  const data = await response.json();
                  if (response.ok) {
                    alert(data.message);
                    fetchUserData();
                  } else {
                    alert(data.error);
                  }
                } catch (error) {
                  alert('An error occurred');
                }
              }}
              className="inline-block bg-gradient-to-r from-green-600 to-green-700 hover:from-green-500 hover:to-green-600 text-white py-3 px-6 rounded-lg border-2 border-green-500 font-semibold transition-all"
            >
              Claim Reward
            </button>
          </div>
        </div>

        {/* Voting Logs */}
        <div className="bg-gradient-to-b from-amber-950 to-amber-900 border-4 border-amber-600 rounded-lg p-8 mb-8 shadow-2xl">
          <h2 className="text-3xl font-bold text-amber-300 mb-6">Voting History</h2>
          {votingLogs.length > 0 ? (
            <div className="space-y-2">
              {votingLogs.map((log) => (
                <div key={log.LogID} className="text-amber-200 border-b border-amber-700 py-2">
                  Voted on {new Date(log.VoteTime).toLocaleString()} from IP: {log.IP}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-amber-200">No voting activity recorded.</p>
          )}
        </div>

        {/* Account Settings */}
        <div className="bg-gradient-to-b from-amber-950 to-amber-900 border-4 border-amber-600 rounded-lg p-8 shadow-2xl">
          <h2 className="text-3xl font-bold text-amber-300 mb-6">Account Settings</h2>
          <div className="flex flex-col gap-4">
            <Link
              href="/dashboard/change-password"
              className="bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white py-3 px-6 rounded-lg border-2 border-amber-500 font-semibold text-center transition-all"
            >
              Change Password
            </Link>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-gradient-to-r from-amber-950 to-amber-900 border-t-4 border-amber-600 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center text-amber-200">
            <p>&copy; 2024 Tale of Conquest. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
