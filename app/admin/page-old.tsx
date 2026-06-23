'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';

export default function AdminDashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    } else if (status === 'authenticated') {
      checkAdminStatus();
    }
  }, [status, router]);

  const checkAdminStatus = async () => {
    try {
      const response = await fetch('/api/admin/check');
      const data = await response.json();
      setIsAdmin(data.isAdmin);
      if (!data.isAdmin) {
        router.push('/dashboard');
      }
    } catch (error) {
      console.error('Error checking admin status:', error);
      router.push('/dashboard');
    } finally {
      setLoading(false);
    }
  };

  if (status === 'loading' || loading) {
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
              <span className="ml-4 text-amber-400 font-semibold">Admin Dashboard</span>
            </div>
            <div className="flex items-center space-x-4">
              <Link
                href="/dashboard"
                className="text-amber-200 hover:text-amber-300 font-semibold transition-colors"
              >
                User Dashboard
              </Link>
              <Link
                href="/"
                className="text-amber-200 hover:text-amber-300 font-semibold transition-colors"
              >
                Home
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Admin Dashboard Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <h1 className="text-5xl font-bold text-amber-300 mb-8">Admin Dashboard</h1>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Website Configuration */}
          <Link
            href="/admin/website-config"
            className="bg-gradient-to-b from-amber-950 to-amber-900 border-4 border-amber-600 rounded-lg p-6 shadow-2xl hover:border-amber-500 transition-all"
          >
            <div className="text-4xl mb-4">⚙️</div>
            <h2 className="text-2xl font-bold text-amber-300 mb-2">Website Configuration</h2>
            <p className="text-amber-200">
              Manage website settings, API keys, and maintenance mode
            </p>
          </Link>

          {/* Game Configuration */}
          <Link
            href="/admin/game-config"
            className="bg-gradient-to-b from-amber-950 to-amber-900 border-4 border-amber-600 rounded-lg p-6 shadow-2xl hover:border-amber-500 transition-all"
          >
            <div className="text-4xl mb-4">🎮</div>
            <h2 className="text-2xl font-bold text-amber-300 mb-2">Game Configuration</h2>
            <p className="text-amber-200">
              Manage game rates, events, and server settings
            </p>
          </Link>

          {/* User Management */}
          <Link
            href="/admin/users"
            className="bg-gradient-to-b from-amber-950 to-amber-900 border-4 border-amber-600 rounded-lg p-6 shadow-2xl hover:border-amber-500 transition-all"
          >
            <div className="text-4xl mb-4">👥</div>
            <h2 className="text-2xl font-bold text-amber-300 mb-2">User Management</h2>
            <p className="text-amber-200">
              View and manage user accounts, bans, and credits
            </p>
          </Link>

          {/* Payment Management */}
          <Link
            href="/admin/payments"
            className="bg-gradient-to-b from-amber-950 to-amber-900 border-4 border-amber-600 rounded-lg p-6 shadow-2xl hover:border-amber-500 transition-all"
          >
            <div className="text-4xl mb-4">💳</div>
            <h2 className="text-2xl font-bold text-amber-300 mb-2">Payment Management</h2>
            <p className="text-amber-200">
              View transactions, manage payment gateways
            </p>
          </Link>

          {/* Logs */}
          <Link
            href="/admin/logs"
            className="bg-gradient-to-b from-amber-950 to-amber-900 border-4 border-amber-600 rounded-lg p-6 shadow-2xl hover:border-amber-500 transition-all"
          >
            <div className="text-4xl mb-4">📋</div>
            <h2 className="text-2xl font-bold text-amber-300 mb-2">Audit Logs</h2>
            <p className="text-amber-200">
              View system logs and user activity
            </p>
          </Link>

          {/* Events */}
          <Link
            href="/admin/events"
            className="bg-gradient-to-b from-amber-950 to-amber-900 border-4 border-amber-600 rounded-lg p-6 shadow-2xl hover:border-amber-500 transition-all"
          >
            <div className="text-4xl mb-4">🎉</div>
            <h2 className="text-2xl font-bold text-amber-300 mb-2">Event Management</h2>
            <p className="text-amber-200">
              Create and manage game events
            </p>
          </Link>
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
