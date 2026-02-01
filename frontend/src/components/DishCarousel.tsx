'use client';

import React, { useState } from 'react';
import type { DishItem } from '@/lib/types';

interface DishCarouselProps {
  dishes: DishItem[];
  loading?: boolean;
  restaurantName?: string;
}

const DishCarousel: React.FC<DishCarouselProps> = ({ dishes, loading, restaurantName }) => {
  const [selectedDishIndex, setSelectedDishIndex] = useState(0);

  if (loading) {
    return (
      <div className="absolute top-4 right-4 z-[1000] w-96 h-56 bg-gray-900/90 backdrop-blur-sm p-3 rounded-lg border border-gray-700">
        <p className="text-xs text-gray-400 mb-2">Loading menu...</p>
        <div className="flex gap-3 h-48">
          <div className="w-40 h-48 bg-gray-800 rounded-lg animate-pulse" />
          <div className="flex-1 bg-gray-800 rounded-lg animate-pulse" />
        </div>
      </div>
    );
  }

  if (!dishes || dishes.length === 0) {
    return null;
  }

  const selectedDish = dishes[selectedDishIndex];

  return (
    <div className="absolute top-4 right-4 z-[1000] w-96 h-56 bg-gray-900/90 backdrop-blur-sm p-3 rounded-lg border border-gray-700 shadow-xl flex flex-col">
      {restaurantName && (
        <p className="text-xs text-indigo-400 font-semibold mb-2 truncate">
          {restaurantName}
        </p>
      )}

      <div className="flex gap-3 flex-1 min-h-0">
        {/* Left: Image */}
        <div className="w-40 flex-shrink-0 h-full">
          {selectedDish.imageUrl ? (
            <img
              src={selectedDish.imageUrl}
              alt={selectedDish.name}
              className="w-full h-full object-cover rounded-lg border border-gray-600"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          ) : (
            <div className="w-full h-full bg-gray-700 rounded-lg border border-gray-600 flex items-center justify-center">
              <span className="text-4xl">🍽️</span>
            </div>
          )}
        </div>

        {/* Right: Vertically scrollable list */}
        <div className="flex-1 flex flex-col min-h-0">
          <div className="overflow-y-auto flex-1 scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800/50">
            {dishes.map((dish, index) => (
              <button
                key={index}
                onClick={() => setSelectedDishIndex(index)}
                className={`w-full text-left p-2 rounded transition-colors mb-1 ${
                  index === selectedDishIndex
                    ? 'bg-indigo-600/40 border-l-2 border-indigo-500'
                    : 'bg-gray-800/40 hover:bg-gray-700/40 border-l-2 border-transparent'
                }`}
              >
                <p className="text-xs text-white font-medium truncate" title={dish.name}>
                  {dish.name}
                </p>
                {dish.price && (
                  <p className="text-xs text-emerald-400 font-semibold">
                    {dish.price}
                  </p>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DishCarousel;
