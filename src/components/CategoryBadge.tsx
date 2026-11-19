import React from 'react';
import type { StopCategory } from '../types/itinerary';

interface CategoryBadgeProps {
  category: StopCategory;
}

const CATEGORY_STYLES: Record<string, string> = {
  sightseeing: 'bg-[#E3E9F8] text-[#1F3FB0]',
  food: 'bg-[#F5E8DC] text-[#9A4319]',
  hotel: 'bg-[#E5EBE7] text-[#2A533A]',
  transport: 'bg-[#E8E6DF] text-[#434039]',
};

export const CategoryBadge: React.FC<CategoryBadgeProps> = ({ category }) => {
  const key = category.trim().toLowerCase();
  const badgeStyle = CATEGORY_STYLES[key] ?? 'bg-[#EAE7E0] text-[#494640]';

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium tracking-tight whitespace-nowrap shrink-0 ${badgeStyle}`}
    >
      {category}
    </span>
  );
};
