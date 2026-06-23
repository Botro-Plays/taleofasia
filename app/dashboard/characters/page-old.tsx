'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';

interface Character {
  Name: string;
  Level: number;
  Experience: number;
  JobCode: number;
  ClanID: number;
  ClanName: string;
  IsClanLeader: boolean;
}

const classDetails: Record<number, { name: string; image: string }> = {
  1: { name: 'Fighter', image: 'https://taleofasia.com/images/CharClass/1.png' },
  2: { name: 'Mechanician', image: 'https://taleofasia.com/images/CharClass/2.png' },
  3: { name: 'Archer', image: 'https://taleofasia.com/images/CharClass/3.png' },
  4: { name: 'Pikeman', image: 'https://taleofasia.com/images/CharClass/4.png' },
  5: { name: 'Atalanta', image: 'https://taleofasia.com/images/CharClass/5.png' },
  6: { name: 'Knight', image: 'https://taleofasia.com/images/CharClass/6.png' },
  7: { name: 'Magician', image: 'https://taleofasia.com/images/CharClass/7.png' },
  8: { name: 'Priestess', image: 'https://taleofasia.com/images/CharClass/8.png' },
  9: { name: 'Assassin', image: 'https://taleofasia.com/images/CharClass/9.png' },
  10: { name: 'Shaman', image: 'https://taleofasia.com/images/CharClass/10.png' },
};

const getClanIconUrl = (clanID: number) => {
  if (clanID === 0) return 'https://taleofasia.com/ClanImage/999999.bmp';
  return `https://taleofasia.com/ClanImage/${1000000 + clanID}.bmp`;
};

export default function CharactersPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [characters, setCharacters] = useState<Character[]>([]);
  const [loading, setLoading] = useState(true);
  const [showClanModal, setShowClanModal] = useState(false);
  const [selectedClan, setSelectedClan] = useState<{ clanID: number; clanName: string; characterName: string } | null>(null);
  const [loginMessage, setLoginMessage] = useState('');
  const [clanImage, setClanImage] = useState<File | null>(null);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    } else if (status === 'authenticated') {
      fetchCharacters();
    }
  }, [status, router]);

  const fetchCharacters = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/user/characters');
      const data = await response.json();
      setCharacters(data.characters || []);
    } catch (error) {
      console.error('Error fetching characters:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenClanModal = (clanID: number, clanName: string, characterName: string) => {
    setSelectedClan({ clanID, clanName, characterName });
    setLoginMessage('');
    setClanImage(null);
    setShowClanModal(true);
  };

  const handleCloseClanModal = () => {
    setShowClanModal(false);
    setSelectedClan(null);
    setLoginMessage('');
    setClanImage(null);
  };

  const handleUpdateClan = async () => {
    if (!selectedClan) return;

    setUpdating(true);
    try {
      // Update login message if provided
      if (loginMessage) {
        const response = await fetch('/api/clan/update', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            clanID: selectedClan.clanID,
            characterName: selectedClan.characterName,
            loginMessage,
          }),
        });

        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || 'Failed to update login message');
        }
      }

      // Upload clan image if provided
      if (clanImage) {
        const formData = new FormData();
        formData.append('clanID', selectedClan.clanID.toString());
        formData.append('characterName', selectedClan.characterName);
        formData.append('clanImage', clanImage);

        const response = await fetch('/api/clan/upload-image', {
          method: 'POST',
          body: formData,
        });

        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || 'Failed to upload clan image');
        }
      }

      alert('Clan updated successfully');
      handleCloseClanModal();
      fetchCharacters(); // Refresh to show updated data
    } catch (error) {
      console.error('Error updating clan:', error);
      alert(error instanceof Error ? error.message : 'Failed to update clan');
    } finally {
      setUpdating(false);
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
            </div>
            <div className="flex items-center space-x-4">
              <Link
                href="/dashboard"
                className="text-amber-200 hover:text-amber-300 font-semibold transition-colors"
              >
                Dashboard
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

      {/* Characters Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <h1 className="text-5xl font-bold text-amber-300 mb-8">Character Details</h1>

        {characters.length > 0 ? (
          <div className="bg-gradient-to-b from-amber-950 to-amber-900 border-4 border-amber-600 rounded-lg overflow-hidden shadow-2xl">
            <table className="w-full">
              <thead>
                <tr className="bg-amber-800">
                  <th className="px-6 py-4 text-left text-amber-300 font-bold">Name</th>
                  <th className="px-6 py-4 text-left text-amber-300 font-bold">Class</th>
                  <th className="px-6 py-4 text-left text-amber-300 font-bold">Level</th>
                  <th className="px-6 py-4 text-left text-amber-300 font-bold">Experience</th>
                  <th className="px-6 py-4 text-left text-amber-300 font-bold">Clan</th>
                </tr>
              </thead>
              <tbody>
                {characters.map((char) => (
                  <tr key={char.Name} className="border-t border-amber-700 hover:bg-amber-800/20 transition-colors">
                    <td className="px-6 py-4 text-amber-200 font-semibold">{char.Name}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <img
                          src={classDetails[char.JobCode]?.image || 'https://taleofasia.com/images/CharClass/unknown.png'}
                          alt="Class"
                          className="w-8 h-8"
                        />
                        <span className="text-amber-200">{classDetails[char.JobCode]?.name || 'Unknown'}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-amber-200">{char.Level.toLocaleString()}</td>
                    <td className="px-6 py-4 text-amber-200">{char.Experience.toLocaleString()}</td>
                    <td className="px-6 py-4">
                      {char.ClanID > 0 ? (
                        <div className="flex items-center gap-3">
                          <img
                            src={getClanIconUrl(char.ClanID)}
                            alt="Clan"
                            className="w-10 h-10 rounded border border-amber-500"
                          />
                          {char.IsClanLeader ? (
                            <button
                              onClick={() => handleOpenClanModal(char.ClanID, char.ClanName, char.Name)}
                              className="text-amber-200 font-semibold hover:text-amber-300 transition-colors cursor-pointer"
                            >
                              <span className="text-amber-400">★ </span>
                              {char.ClanName}
                            </button>
                          ) : (
                            <span className="text-amber-200 font-semibold">
                              {char.ClanName}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-amber-200">None</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="bg-gradient-to-b from-amber-950 to-amber-900 border-4 border-amber-600 rounded-lg p-8 shadow-2xl">
            <p className="text-amber-200 text-xl text-center">No character details available.</p>
          </div>
        )}

        {/* Back to Dashboard */}
        <div className="mt-8">
          <Link
            href="/dashboard"
            className="inline-block bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white py-3 px-6 rounded-lg border-2 border-amber-500 font-semibold transition-all"
          >
            ← Back to Dashboard
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

      {/* Clan Management Modal */}
      {showClanModal && selectedClan && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gradient-to-b from-amber-950 to-amber-900 border-4 border-amber-600 rounded-lg p-8 max-w-md w-full shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-amber-300">Update Clan Information</h2>
              <button
                onClick={handleCloseClanModal}
                className="text-amber-200 hover:text-amber-300 text-2xl"
              >
                &times;
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-amber-200 mb-2">Clan Name</label>
                <input
                  type="text"
                  value={selectedClan.clanName}
                  disabled
                  className="w-full bg-amber-950 border-2 border-amber-700 text-amber-200 px-4 py-2 rounded-lg opacity-50"
                />
              </div>

              <div>
                <label className="block text-amber-200 mb-2">Login Message (max 32 characters)</label>
                <input
                  type="text"
                  value={loginMessage}
                  onChange={(e) => setLoginMessage(e.target.value)}
                  maxLength={32}
                  placeholder="Enter login message"
                  className="w-full bg-amber-950 border-2 border-amber-700 text-amber-200 px-4 py-2 rounded-lg focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-amber-200 mb-2">Upload Clan Image (32x32 BMP)</label>
                <input
                  type="file"
                  accept=".bmp"
                  onChange={(e) => setClanImage(e.target.files?.[0] || null)}
                  className="w-full bg-amber-950 border-2 border-amber-700 text-amber-200 px-4 py-2 rounded-lg focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="flex gap-4 mt-6">
                <button
                  onClick={handleCloseClanModal}
                  className="flex-1 bg-amber-950 border-2 border-amber-700 text-amber-200 px-4 py-2 rounded-lg hover:border-amber-500 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleUpdateClan}
                  disabled={updating}
                  className="flex-1 bg-gradient-to-r from-amber-600 to-amber-700 text-white px-4 py-2 rounded-lg hover:from-amber-500 hover:to-amber-600 transition-all disabled:opacity-50"
                >
                  {updating ? 'Updating...' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
