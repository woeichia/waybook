import React, { useState, useEffect } from 'react';
import { Camera, Compass, Hotel, TrainFront, Utensils } from 'lucide-react';
import type { StopCategory } from '../types/itinerary';
import { getCustomPhotoForStop } from '../utils/customPhotos';

interface SmartImageProps {
  src?: string;
  stopId?: string;
  customPhotoUrl?: string;
  alt: string;
  category?: StopCategory;
  className?: string;
  isCover?: boolean;
}

function getCategoryVisual(category?: StopCategory) {
  const normalized = (category ?? '').toLowerCase();
  if (normalized.includes('food') || normalized.includes('dining') || normalized.includes('cafe')) {
    return {
      gradient: 'from-[#F3E4D5] via-[#EAD5C0] to-[#DEC1A5]',
      iconColor: 'text-[#8C4A27]',
      Icon: Utensils,
    };
  }
  if (normalized.includes('hotel') || normalized.includes('stay') || normalized.includes('ryokan')) {
    return {
      gradient: 'from-[#E5E3EE] via-[#D8D4E7] to-[#C8C2DC]',
      iconColor: 'text-[#4B3F72]',
      Icon: Hotel,
    };
  }
  if (normalized.includes('transport') || normalized.includes('train') || normalized.includes('flight')) {
    return {
      gradient: 'from-[#DCE4F5] via-[#CCD7EE] to-[#B7C7E5]',
      iconColor: 'text-[#1F3FB0]',
      Icon: TrainFront,
    };
  }
  if (normalized.includes('sightseeing') || normalized.includes('temple') || normalized.includes('museum')) {
    return {
      gradient: 'from-[#DEE8E0] via-[#CEDCD1] to-[#BBCDBE]',
      iconColor: 'text-[#2E5A36]',
      Icon: Compass,
    };
  }
  return {
    gradient: 'from-[#E8E5DE] via-[#DDD9D0] to-[#CFCAFF]',
    iconColor: 'text-[#4B5563]',
    Icon: Camera,
  };
}

export const SmartImage: React.FC<SmartImageProps> = ({
  src,
  stopId,
  customPhotoUrl,
  alt,
  category,
  className = '',
  isCover = false,
}) => {
  const [hasError, setHasError] = useState(false);

  const resolvedCustom = customPhotoUrl ?? (stopId ? getCustomPhotoForStop(stopId) : null);
  const rawSrc = (resolvedCustom || src || '').trim();
  const normalized = rawSrc.startsWith('/src/assets/images/') ? rawSrc.replace('/src/assets/images/', '/images/') : rawSrc;
  const cleanSrc = normalized.startsWith('/images/') ? `${import.meta.env.BASE_URL.replace(/\/$/, '')}${normalized}` : normalized;

  useEffect(() => {
    setHasError(false);
  }, [cleanSrc]);

  const showFallback = !cleanSrc || hasError;

  if (showFallback) {
    const { gradient, iconColor, Icon } = getCategoryVisual(category);
    return (
      <div
        role="img"
        aria-label={alt}
        className={`relative flex items-center justify-center bg-gradient-to-br ${
          isCover ? 'from-[#1F2A44] via-[#263455] to-[#171E30]' : gradient
        } ${className}`}
      >
        <Icon
          className={`${isCover ? 'w-10 h-10 text-white/35' : `w-6 h-6 ${iconColor} opacity-75`}`}
          strokeWidth={1.6}
        />
      </div>
    );
  }

  return (
    <img
      src={cleanSrc}
      alt={alt}
      referrerPolicy="no-referrer"
      loading={isCover ? 'eager' : 'lazy'}
      onError={() => setHasError(true)}
      className={className}
    />
  );
};
