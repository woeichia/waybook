import React, { useState } from 'react';
import { Download, Share, PlusSquare, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface PWAInstallButtonProps {
  variant?: 'header' | 'panel';
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({ variant = 'header' }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) {
    if (variant === 'panel') {
      return (
        <div className="rounded-2xl bg-[#EEF5EE] px-4 py-3 text-xs font-medium text-[#2E5A36]">
          Waybook is installed on this device and ready for offline access.
        </div>
      );
    }
    return null;
  }

  if (isInstallable) {
    if (variant === 'panel') {
      return (
        <button
          type="button"
          onClick={install}
          className="w-full min-h-[44px] flex items-center justify-center gap-2 rounded-2xl bg-[#1F3FB0] px-4 py-3 text-sm font-medium text-white hover:bg-[#193391] transition-colors active:scale-[0.98]"
        >
          <Download className="w-4 h-4" />
          Install Waybook on Device
        </button>
      );
    }

    return (
      <button
        type="button"
        onClick={install}
        className="min-h-[44px] inline-flex items-center gap-1.5 rounded-full bg-[#F4F2ED]/90 backdrop-blur-md px-3.5 py-2 text-xs font-semibold text-[#1A1A1A] shadow-sm hover:bg-[#F4F2ED] transition-colors whitespace-nowrap shrink-0"
      >
        <Download className="w-3.5 h-3.5 text-[#1F3FB0]" />
        Install
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowIOSGuide(true)}
          className={
            variant === 'panel'
              ? 'w-full min-h-[44px] flex items-center justify-center gap-2 rounded-2xl bg-[#1F3FB0] px-4 py-3 text-sm font-medium text-white hover:bg-[#193391] transition-colors'
              : 'min-h-[44px] inline-flex items-center gap-1.5 rounded-full bg-[#F4F2ED]/90 backdrop-blur-md px-3.5 py-2 text-xs font-semibold text-[#1A1A1A] shadow-sm hover:bg-[#F4F2ED] transition-colors whitespace-nowrap shrink-0'
          }
        >
          <Download className="w-3.5 h-3.5" />
          {variant === 'panel' ? 'Add to iPhone Home Screen' : 'Install'}
        </button>

        {showIOSGuide && (
          <div
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-xs p-0 sm:p-4"
            onClick={() => setShowIOSGuide(false)}
          >
            <div
              className="w-full max-w-[480px] rounded-t-3xl sm:rounded-3xl bg-[#F4F2ED] p-6 shadow-xl border border-black/[0.06]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-[#1A1A1A]">Install on iPhone or iPad</h3>
                <button
                  type="button"
                  onClick={() => setShowIOSGuide(false)}
                  aria-label="Close install instructions"
                  className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full text-[#6B7280] hover:bg-black/5"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="mt-4 space-y-3 text-sm text-[#4B5563]">
                <div className="flex items-start gap-3 rounded-2xl bg-[#EDEBE6] p-3.5">
                  <Share className="w-5 h-5 text-[#1F3FB0] shrink-0 mt-0.5" />
                  <p>
                    1. Tap the <strong className="text-[#1A1A1A]">Share</strong> button in the Safari toolbar.
                  </p>
                </div>
                <div className="flex items-start gap-3 rounded-2xl bg-[#EDEBE6] p-3.5">
                  <PlusSquare className="w-5 h-5 text-[#1F3FB0] shrink-0 mt-0.5" />
                  <p>
                    2. Scroll down and tap <strong className="text-[#1A1A1A]">Add to Home Screen</strong>.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="mt-5 w-full min-h-[44px] rounded-2xl bg-[#1F3FB0] py-2.5 text-sm font-medium text-white hover:bg-[#193391] transition-colors"
              >
                Got it
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  if (variant === 'panel') {
    return (
      <div className="rounded-2xl bg-[#EDEBE6] border border-black/[0.06] px-4 py-3 text-xs text-[#6B7280] leading-relaxed">
        Open this page in Chrome, Edge, or Safari on your phone and use your browser menu (<strong className="text-[#1A1A1A]">Add to Home Screen</strong> or <strong className="text-[#1A1A1A]">Install app</strong>) to save it offline.
      </div>
    );
  }

  return null;
};
