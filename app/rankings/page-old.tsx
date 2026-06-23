'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface RankingPlayer {
  Name: string;
  Level: number;
  RebornStage: number;
  JobCode: number;
  ClanID: number;
  ClanName: string | null;
  PVPKills?: number;
  PVPDeaths?: number;
  SODKills?: number;
  SODDeaths?: number;
  BRKills?: number;
  BRWins?: number;
  IconID?: number;
  Members?: number;
  PVPWins?: number;
  SODWins?: number;
  Kills?: number;
  Deaths?: number;
  Streak?: number;
  Experience?: number;
  BellatraPoints?: number;
  BellatraDate?: string;
}

type RankingType = 'level' | 'pvp' | 'bellatra' | 'battle-royale';
type RankingSubType = 'personal' | 'clan';

export default function RankingsPage() {
  const [rankings, setRankings] = useState<RankingPlayer[]>([]);
  const [selectedClass, setSelectedClass] = useState('all');
  const [selectedType, setSelectedType] = useState<RankingType>('level');
  const [selectedSubType, setSelectedSubType] = useState<RankingSubType>('personal');
  const [loading, setLoading] = useState(true);

  const rankingTypes = [
    { value: 'level' as RankingType, label: 'Level Rankings' },
    { value: 'pvp' as RankingType, label: 'PvP Rankings' },
    { value: 'bellatra' as RankingType, label: 'Bellatra Rankings' },
    { value: 'battle-royale' as RankingType, label: 'Battle Royale Rankings' },
  ];

  const classes = [
    { value: 'all', label: 'All Classes' },
    { value: '1', label: 'Fighter' },
    { value: '2', label: 'Mechanician' },
    { value: '3', label: 'Archer' },
    { value: '4', label: 'Pikeman' },
    { value: '5', label: 'Atalanta' },
    { value: '6', label: 'Knight' },
    { value: '7', label: 'Magician' },
    { value: '8', label: 'Priestess' },
    { value: '9', label: 'Assassin' },
    { value: '10', label: 'Shaman' },
  ];

  useEffect(() => {
    fetchRankings();
  }, [selectedClass, selectedType, selectedSubType]);

  const fetchRankings = async () => {
    setLoading(true);
    try {
      let url = '';
      if (selectedType === 'level') {
        url = `/api/rankings/level?class=${selectedClass}`;
      } else if (selectedType === 'pvp') {
        url = `/api/rankings/pvp?type=${selectedSubType}`;
      } else if (selectedType === 'bellatra') {
        url = `/api/rankings/bellatra?type=${selectedSubType}`;
      } else if (selectedType === 'battle-royale') {
        url = `/api/rankings/battle-royale`;
      }

      const response = await fetch(url);
      const data = await response.json();
      if (data.error) {
        console.error('API error:', data.error);
        setRankings([]);
      } else {
        setRankings(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error('Error fetching rankings:', error);
      setRankings([]);
    } finally {
      setLoading(false);
    }
  };

  const getClanIconUrl = (clanID: number) => {
    if (clanID === 0) return 'https://taleofasia.com/ClanImage/999999.bmp';
    return `https://taleofasia.com/ClanImage/${1000000 + clanID}.bmp`;
  };

  const getOrdinalSuffix = (n: number) => {
    if (n >= 11 && n <= 13) return 'th';
    const lastDigit = n % 10;
    if (lastDigit === 1) return 'st';
    if (lastDigit === 2) return 'nd';
    if (lastDigit === 3) return 'rd';
    return 'th';
  };

  const getRankingTitle = () => {
    switch (selectedType) {
      case 'level': return 'Level Rankings';
      case 'pvp': return selectedSubType === 'personal' ? 'PvP Personal Rankings' : 'PvP Clan Rankings';
      case 'bellatra': return selectedSubType === 'personal' ? 'Bellatra Personal Rankings' : 'Bellatra Clan Rankings';
      case 'battle-royale': return 'Battle Royale Rankings';
    }
  };

  const getRankingDescription = () => {
    switch (selectedType) {
      case 'level': return 'See the TOP 100 Players based on Reborn Stage and Level';
      case 'pvp': return selectedSubType === 'personal' ? 'See the TOP 100 Players based on PvP Kills' : 'See the TOP 100 Clans based on PvP Wins';
      case 'bellatra': return selectedSubType === 'personal' ? 'See the TOP 100 Players based on Bellatra Kills' : 'See the TOP 100 Clans based on Bellatra Wins';
      case 'battle-royale': return 'See the TOP 100 Players based on Battle Royale Wins';
    }
  };

  const getTableColumns = () => {
    switch (selectedType) {
      case 'level':
        return [
          { key: 'Rank', label: 'Rank' },
          { key: 'Clan', label: 'Clan' },
          { key: 'Name', label: 'Name' },
          { key: 'Class', label: 'Class' },
          { key: 'Level', label: 'Level' },
          { key: 'RebornStage', label: 'Reborn Stage' },
        ];
      case 'pvp':
        if (selectedSubType === 'personal') {
          return [
            { key: 'Rank', label: 'Rank' },
            { key: 'Clan', label: 'Clan' },
            { key: 'Name', label: 'Name' },
            { key: 'Class', label: 'Class' },
            { key: 'Level', label: 'Level' },
            { key: 'PVPKills', label: 'PvP Kills' },
          ];
        } else {
          return [
            { key: 'Rank', label: 'Rank' },
            { key: 'ClanName', label: 'Clan' },
            { key: 'Kills', label: 'Kills' },
            { key: 'Deaths', label: 'Deaths' },
            { key: 'Streak', label: 'Streak' },
            { key: 'PVPWins', label: 'PvP Wins' },
          ];
        }
      case 'bellatra':
        if (selectedSubType === 'personal') {
          return [
            { key: 'Rank', label: 'Rank' },
            { key: 'Clan', label: 'Clan' },
            { key: 'Name', label: 'Name' },
            { key: 'Class', label: 'Class' },
            { key: 'Level', label: 'Level' },
            { key: 'SODKills', label: 'Bellatra Kills' },
          ];
        } else {
          return [
            { key: 'Rank', label: 'Rank' },
            { key: 'ClanName', label: 'Clan' },
            { key: 'BellatraPoints', label: 'Bellatra Points' },
            { key: 'BellatraDate', label: 'Date' },
            { key: 'SODWins', label: 'Bellatra Wins' },
          ];
        }
      case 'battle-royale':
        return [
          { key: 'Rank', label: 'Rank' },
          { key: 'Clan', label: 'Clan' },
          { key: 'Name', label: 'Name' },
          { key: 'Class', label: 'Class' },
          { key: 'Level', label: 'Level' },
          { key: 'BRWins', label: 'Battle Royale Wins' },
        ];
    }
  };

  const getCellValue = (player: RankingPlayer, key: string, index?: number) => {
    switch (key) {
      case 'Rank':
        return (
          <>
            {index! + 1}
            <span className="text-amber-400">{getOrdinalSuffix(index! + 1)}</span>
          </>
        );
      case 'Clan':
        if (selectedSubType === 'clan') {
          return (
            <div className="flex items-center gap-3">
              <img
                src={getClanIconUrl(player.IconID || 0)}
                alt="Clan"
                className="w-10 h-10 rounded border border-amber-500"
                onError={(e) => {
                  e.currentTarget.src = 'https://taleofasia.com/ClanImage/999999.bmp';
                }}
              />
            </div>
          );
        }
        return (
          <div className="flex items-center gap-3">
            <img
              src={getClanIconUrl(player.ClanID)}
              alt="Clan"
              className="w-10 h-10 rounded border border-amber-500"
              onError={(e) => {
                e.currentTarget.src = 'https://taleofasia.com/ClanImage/999999.bmp';
              }}
            />
            <span className="text-amber-200">{player.ClanName || 'No Clan'}</span>
          </div>
        );
      case 'ClanName':
        if (selectedSubType === 'clan') {
          return (
            <div className="flex items-center gap-3">
              <img
                src={getClanIconUrl(player.IconID || 0)}
                alt="Clan"
                className="w-10 h-10 rounded border border-amber-500"
                onError={(e) => {
                  e.currentTarget.src = 'https://taleofasia.com/ClanImage/999999.bmp';
                }}
              />
              <span className="text-amber-200">{player.ClanName || 'Unknown'}</span>
            </div>
          );
        }
        return <span className="text-amber-200">{player.ClanName || 'Unknown'}</span>;
      case 'IconID':
        return (
          <img
            src={getClanIconUrl(player.IconID || 0)}
            alt="Clan Icon"
            className="w-10 h-10 rounded border border-amber-500"
            onError={(e) => {
              e.currentTarget.src = 'https://taleofasia.com/ClanImage/999999.bmp';
            }}
          />
        );
      case 'Class':
        return (
          <img
            src={`https://taleofasia.com/images/CharClass/${player.JobCode}.png`}
            alt="Class"
            className="w-8 h-8"
          />
        );
      default:
        const value = player[key as keyof RankingPlayer];
        return value !== undefined ? value : 0;
    }
  };

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
                href="/login"
                className="bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white px-4 py-2 rounded-lg border-2 border-amber-500 font-semibold transition-all"
              >
                Login
              </Link>
              <Link
                href="/register"
                className="bg-gradient-to-r from-cyan-600 to-cyan-700 hover:from-cyan-500 hover:to-cyan-600 text-white px-4 py-2 rounded-lg border-2 border-cyan-500 font-semibold transition-all"
              >
                Register
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Header */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <h1 className="text-5xl font-bold text-amber-300 mb-4 text-center">{getRankingTitle()}</h1>
        <p className="text-xl text-amber-200 text-center mb-8">
          {getRankingDescription()}
        </p>

        {/* Ranking Type Tabs */}
        <div className="mb-8 flex justify-center gap-4">
          {rankingTypes.map((type) => (
            <button
              key={type.value}
              onClick={() => {
                setSelectedType(type.value);
                if (type.value !== 'pvp' && type.value !== 'bellatra') {
                  setSelectedSubType('personal');
                }
              }}
              className={`px-6 py-3 rounded-lg font-semibold transition-all ${
                selectedType === type.value
                  ? 'bg-gradient-to-r from-amber-600 to-amber-700 text-white border-2 border-amber-500'
                  : 'bg-amber-950 text-amber-200 border-2 border-amber-700 hover:border-amber-500'
              }`}
            >
              {type.label}
            </button>
          ))}
        </div>

        {/* Sub-type Tabs for PvP and Bellatra */}
        {(selectedType === 'pvp' || selectedType === 'bellatra') && (
          <div className="mb-8 flex justify-center gap-4">
            <button
              onClick={() => setSelectedSubType('personal')}
              className={`px-6 py-3 rounded-lg font-semibold transition-all ${
                selectedSubType === 'personal'
                  ? 'bg-gradient-to-r from-cyan-600 to-cyan-700 text-white border-2 border-cyan-500'
                  : 'bg-amber-950 text-amber-200 border-2 border-amber-700 hover:border-amber-500'
              }`}
            >
              Personal Rankings
            </button>
            <button
              onClick={() => setSelectedSubType('clan')}
              className={`px-6 py-3 rounded-lg font-semibold transition-all ${
                selectedSubType === 'clan'
                  ? 'bg-gradient-to-r from-cyan-600 to-cyan-700 text-white border-2 border-cyan-500'
                  : 'bg-amber-950 text-amber-200 border-2 border-amber-700 hover:border-amber-500'
              }`}
            >
              Clan Rankings
            </button>
          </div>
        )}

        {/* Class Filter (only for level rankings) */}
        {selectedType === 'level' && (
          <div className="mb-8 flex justify-center">
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              className="bg-amber-950 border-2 border-amber-700 text-amber-100 px-4 py-3 rounded-lg focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/50"
            >
              {classes.map((cls) => (
                <option key={cls.value} value={cls.value}>
                  {cls.label}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Rankings Table */}
        {loading ? (
          <div className="text-center text-amber-200 text-xl">Loading rankings...</div>
        ) : (
          <div className="bg-gradient-to-b from-amber-950 to-amber-900 border-4 border-amber-600 rounded-lg overflow-hidden shadow-2xl">
            <table className="w-full">
              <thead>
                <tr className="bg-amber-800">
                  {getTableColumns().map((col) => (
                    <th key={col.key} className="px-6 py-4 text-left text-amber-300 font-bold">
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rankings.map((player, index) => (
                  <tr
                    key={player.Name || player.ClanName || index}
                    className={`border-t border-amber-700 ${
                      index === 0 ? 'bg-amber-800/30' :
                      index === 1 ? 'bg-amber-700/20' :
                      index === 2 ? 'bg-amber-600/10' :
                      ''
                    } hover:bg-amber-800/20 transition-colors`}
                  >
                    {getTableColumns().map((col) => (
                      <td key={col.key} className="px-6 py-4 text-amber-200">
                        {getCellValue(player, col.key, index)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
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
