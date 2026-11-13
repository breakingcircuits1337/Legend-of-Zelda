import React, { useEffect, useState } from 'react';
import { WifiOff } from 'lucide-react';

export const OfflineIndicator: React.FC = () => {
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (isOnline) return null;

  return (
    <div
      id="offline-indicator-badge"
      className="fixed bottom-3 left-3 z-50 flex items-center gap-2 border border-[#f8b800] bg-black/90 px-3 py-1 text-[9px] uppercase tracking-wider text-[#f8b800] shadow-md"
    >
      <WifiOff size={12} className="text-[#f8b800]" />
      <span>Offline Mode Active</span>
    </div>
  );
};
