/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { LandingPage } from './components/LandingPage.tsx';
import { ConsoleDashboard } from './components/ConsoleDashboard.tsx';

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<'landing' | 'console'>(() => {
    if (typeof window !== 'undefined') {
      const hash = window.location.hash.replace('#', '');
      if (hash === 'console' || hash === 'dashboard') return 'console';
    }
    return 'landing';
  });

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace('#', '');
      if (hash === 'console' || hash === 'dashboard') {
        setCurrentScreen('console');
      } else if (hash === 'landing' || hash === '') {
        setCurrentScreen('landing');
      }
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const navigateToConsole = () => {
    setCurrentScreen('console');
    window.location.hash = 'console';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const navigateToLanding = () => {
    setCurrentScreen('landing');
    window.location.hash = 'landing';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="relative min-h-screen bg-[#0e0e10] text-[#e5e1e4]">
      {currentScreen === 'landing' ? (
        <LandingPage onNavigateToConsole={navigateToConsole} />
      ) : (
        <ConsoleDashboard onNavigateToLanding={navigateToLanding} />
      )}

      {/* Floating Screen Switcher Pill */}
      <aside aria-label="Screen Switcher" className="fixed bottom-4 right-4 z-50 flex items-center gap-1.5 p-1 rounded-full bg-[#1c1b1d]/90 backdrop-blur-xl border border-[#4edea3]/30 shadow-2xl shadow-black/80">
        <button
          onClick={navigateToLanding}
          className={`px-3 py-1 rounded-full text-xs font-mono font-medium transition-all cursor-pointer ${
            currentScreen === 'landing'
              ? 'bg-[#4edea3] text-[#003824] shadow-sm shadow-[#4edea3]/30'
              : 'text-[#bbcabf] hover:text-[#e5e1e4] hover:bg-[#2a2a2c]'
          }`}
        >
          Landing Page
        </button>
        <button
          onClick={navigateToConsole}
          className={`px-3 py-1 rounded-full text-xs font-mono font-medium transition-all cursor-pointer ${
            currentScreen === 'console'
              ? 'bg-[#4edea3] text-[#003824] shadow-sm shadow-[#4edea3]/30'
              : 'text-[#bbcabf] hover:text-[#e5e1e4] hover:bg-[#2a2a2c]'
          }`}
        >
          Console
        </button>
      </aside>
    </div>
  );
}

