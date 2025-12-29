/**
 * Share Target Handler
 * Handles incoming shares from other apps (via Web Share Target API)
 */

import React, { useEffect, useState } from 'react';
import { View as ViewEnum } from '../types';
import { useCamera } from '../hooks/useMobileFeatures';

interface ShareTargetHandlerProps {
  onNavigate: (view: ViewEnum, options?: any) => void;
  onShareReceived?: (data: ShareData) => void;
}

interface ShareData {
  title?: string;
  text?: string;
  url?: string;
  files?: File[];
}

export const ShareTargetHandler: React.FC<ShareTargetHandlerProps> = ({
  onNavigate,
  onShareReceived
}) => {
  const [shareData, setShareData] = useState<ShareData | null>(null);
  const { compress } = useCamera();

  useEffect(() => {
    // Check if we're being opened as a share target
    const urlParams = new URLSearchParams(window.location.search);
    const isShare = urlParams.get('share') === 'true';

    if (isShare) {
      handleShareTarget(urlParams);
    }
  }, []);

  const handleShareTarget = async (urlParams: URLSearchParams) => {
    const title = urlParams.get('title') || '';
    const text = urlParams.get('text') || '';
    const url = urlParams.get('url') || '';

    // Handle shared files (images)
    const files: File[] = [];
    // Note: File handling from share target requires additional setup
    // This is a placeholder for the implementation

    const shareData: ShareData = {
      title,
      text,
      url,
      files
    };

    setShareData(shareData);

    // Process shared content
    if (onShareReceived) {
      onShareReceived(shareData);
    }

    // If URL contains vehicle ID, navigate to it
    const vehicleIdMatch = url.match(/vehicle[_-]?id[=:](\d+)/i) || 
                           url.match(/\/vehicle\/(\d+)/i) ||
                           url.match(/id[=:](\d+)/i);
    
    if (vehicleIdMatch) {
      const vehicleId = vehicleIdMatch[1];
      onNavigate(ViewEnum.DETAIL, { id: parseInt(vehicleId, 10) });
      return;
    }

    // If text contains vehicle info, try to create a listing
    if (text && (text.includes('car') || text.includes('vehicle') || text.includes('sell'))) {
      // Navigate to sell car page with pre-filled data
      onNavigate(ViewEnum.SELL_CAR, { prefill: { description: text } });
      return;
    }

    // Default: navigate to home
    onNavigate(ViewEnum.HOME);
  };

  // Process shared images
  useEffect(() => {
    if (shareData?.files && shareData.files.length > 0) {
      // Compress and process images
      shareData.files.forEach(async (file) => {
        if (file.type.startsWith('image/')) {
          const reader = new FileReader();
          reader.onload = async (e) => {
            const dataUrl = e.target?.result as string;
            if (dataUrl) {
              const compressed = await compress(dataUrl, 1920, 1920, 0.8);
              // Handle compressed image (e.g., add to vehicle listing)
            }
          };
          reader.readAsDataURL(file);
        }
      });
    }
  }, [shareData, compress]);

  return null; // This component doesn't render anything
};

export default ShareTargetHandler;








