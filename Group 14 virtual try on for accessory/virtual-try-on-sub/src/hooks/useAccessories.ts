import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { AccessoryItem } from '../types';
import { accessoryDatabase as fallbackData } from '../data/accessories';

export const useAccessories = () => {
  const [accessories, setAccessories] = useState<AccessoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchAccessories() {
      try {
        // Fetching from the 'accessories' table as per the provided schema image
        const { data, error } = await supabase
          .from('accessories')
          .select('*');

        if (error) {
          throw error;
        }

        if (data && data.length > 0) {
          const mappedData: AccessoryItem[] = data.map((item: any) => {
            // Support existing transform_params if they exist or use sensible defaults
            const params = item.transform_params || {};
            
            return {
              id: item.id,
              name: item.name || item.id.split('-').map((s: string) => s.charAt(0).toUpperCase() + s.slice(1)).join(' '),
              type: item.type as AccessoryItem['type'],
              model: item.id,
              preview: item.image_url, // Maps to image_url from your schema
              scale: Number(params.scale) || 1,
              position: params.position || [0, 0, 0],
              rotation: params.rotation || [0, 0, 0],
              color: params.color,
              // Map the new recommendation fields from your schema
              face_shapes: item.face_shapes || [],
              skin_tones: item.skin_tones || [],
              style_tags: item.style_tags || [],
              trend_score: Number(item.trend_score) || 0
            };
          });
          
          setAccessories(mappedData);
        } else {
          setAccessories(fallbackData);
        }
      } catch (err: any) {
        console.error('Error fetching accessories:', err.message);
        setError(err.message);
        setAccessories(fallbackData);
      } finally {
        setLoading(false);
      }
    }

    fetchAccessories();
  }, []);

  return { accessories, loading, error };
};