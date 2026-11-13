import React, { useState } from 'react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { Download, Smartphone } from 'lucide-react';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  if (isInstallable) {
    return (
      <button
        id="pwa-install-btn"
        onClick={install}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-[#d82800] hover:bg-[#f83800] text-white text-[10px] tracking-wider uppercase border-2 border-white cursor-pointer active:scale-95 transition-all shadow-[2px_2px_0px_#000]"
        title="Install offline PWA"
      >
        <Download size={14} />
        <span>Install App</span>
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          id="pwa-ios-install-btn"
          onClick={() => setShowIOSGuide(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-[#202020] hover:bg-[#303030] text-white text-[10px] tracking-wider uppercase border border-gray-600 cursor-pointer active:scale-95 transition-all"
        >
          <Smartphone size={14} />
          <span>Install iOS</span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
            <div className="w-full max-w-xs border-2 border-white bg-black p-5 text-white shadow-2xl">
              <h3 className="text-xs font-bold text-[#f8b800] mb-3 uppercase tracking-wider">
                Install on iPhone
              </h3>
              <p className="text-[10px] leading-relaxed text-gray-300 mb-4">
                1. Tap <strong className="text-white">Share</strong> in Safari.<br />
                2. Select <strong className="text-white">Add to Home Screen</strong>.
              </p>
              <button
                onClick={() => setShowIOSGuide(false)}
                className="w-full border border-white py-1.5 text-[10px] uppercase tracking-wider bg-white text-black hover:bg-gray-200"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};
