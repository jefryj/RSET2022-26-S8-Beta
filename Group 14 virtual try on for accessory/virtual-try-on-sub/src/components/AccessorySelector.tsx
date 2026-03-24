import React from 'react';
import { AccessoryItem } from '../types';

interface AccessorySelectorProps {
  accessories: AccessoryItem[];
  allAccessories: AccessoryItem[];
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
  type: AccessoryItem['type'];
}

export const AccessorySelector: React.FC<AccessorySelectorProps> = ({
  accessories,
  allAccessories,
  selectedIds,
  onSelectionChange,
  type
}) => {
  const toggleSelection = (id: string) => {
    if (selectedIds.includes(id)) {
      // If already selected, remove it
      onSelectionChange(selectedIds.filter(selectedId => selectedId !== id));
    } else {
      // Remove any accessories of the same type, then add the new one
      const otherTypeAccessories = selectedIds.filter(selectedId => {
        const accessory = allAccessories.find(a => a.id === selectedId);
        return accessory && accessory.type !== type;
      });
      onSelectionChange([...otherTypeAccessories, id]);
    }
  };

  return (
    <div className="bg-gray-900/80 backdrop-blur-sm rounded-xl p-4">
      <h3 className="text-white font-semibold mb-3 capitalize">{type}</h3>
      <div className="flex space-x-3 overflow-x-auto scrollbar-hide">
        {accessories.map((accessory) => (
          <button
            key={accessory.id}
            onClick={() => toggleSelection(accessory.id)}
            className={`flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden transition-all duration-200 ${
              selectedIds.includes(accessory.id)
                ? 'ring-2 ring-blue-400 scale-105'
                : 'ring-1 ring-gray-600 hover:ring-gray-400'
            }`}
          >
            <img
              src={accessory.preview}
              alt={accessory.name}
              className="w-full h-full object-cover"
            />
          </button>
        ))}
      </div>
    </div>
  );
};