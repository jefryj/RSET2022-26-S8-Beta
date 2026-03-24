import React, { useMemo } from 'react';
import { Sparkles, ThumbsUp, Palette, Maximize } from 'lucide-react';
import { AccessoryItem, StyleRecommendation, FaceDetectionState } from '../types';

interface StyleRecommenderProps {
  currentAccessories: string[];
  allAccessories: AccessoryItem[];
  onRecommendationSelect: (accessoryIds: string[]) => void;
  faceState: FaceDetectionState;
}

export const StyleRecommender: React.FC<StyleRecommenderProps> = ({
  currentAccessories,
  allAccessories,
  onRecommendationSelect,
  faceState
}) => {
  const recommendations = useMemo((): StyleRecommendation[] => {
    if (currentAccessories.length >= 4) return [];

    const currentItems = allAccessories.filter(a => currentAccessories.includes(a.id));
    const activeTags = new Set(currentItems.flatMap(a => a.style_tags || []));
    const userSkinTone = faceState.detectedSkinTone;
    const userFaceShape = faceState.detectedFaceShape;
    
    const hasType = (type: string) => currentItems.some(a => a.type === type);

    const calculateScore = (accessory: AccessoryItem) => {
      // High baseline for trending items (start at 15)
      let score = (accessory.trend_score || 5.0) + 15; 
      
      // Rule 1: Skin Tone Affinity (+10)
      if (userSkinTone && accessory.skin_tones?.includes(userSkinTone)) {
        score += 10;
      }

      // Rule 2: Face Shape Compatibility (+15)
      if (userFaceShape && accessory.face_shapes?.includes(userFaceShape)) {
        score += 15;
      }

      // Rule 3: Style Synergy (+3 per matching tag)
      const matchingTags = (accessory.style_tags || []).filter(t => activeTags.has(t));
      score += matchingTags.length * 3;

      return score;
    };

    const types: AccessoryItem['type'][] = ['glasses', 'hat', 'earrings'];
    const missingTypes = types.filter(t => !hasType(t));
    
    const candidates = allAccessories
      .filter(a => missingTypes.includes(a.type) && !currentAccessories.includes(a.id))
      .map(a => ({ item: a, score: calculateScore(a) }))
      .sort((a, b) => b.score - a.score);

    const recs: StyleRecommendation[] = [];
    const usedTypes = new Set<string>();

    for (const cand of candidates) {
      if (usedTypes.has(cand.item.type)) continue;
      
      const isSkinMatch = userSkinTone && cand.item.skin_tones?.includes(userSkinTone);
      const isShapeMatch = userFaceShape && cand.item.face_shapes?.includes(userFaceShape);
      const matchingTag = (cand.item.style_tags || []).find(t => activeTags.has(t));
      
      let reason = `Trending choice for your look.`;
      if (isShapeMatch && isSkinMatch) {
        reason = `Perfect geometry for your ${userFaceShape} face and ${userSkinTone} tone.`;
      } else if (isShapeMatch) {
        reason = `Designed to balance your ${userFaceShape} face shape perfectly.`;
      } else if (isSkinMatch) {
        reason = `Complements your ${userSkinTone} skin tone beautifully.`;
      } else if (matchingTag) {
        reason = `Fits your current ${matchingTag} aesthetic.`;
      }

      // Normalized Confidence: Range 15 to 55+. 
      // Mapping score 15 -> ~70% and 55 -> ~98%
      const rawConf = ((cand.score - 15) / 40) * 0.28 + 0.70;
      const confidence = Math.min(0.98, rawConf);

      recs.push({
        accessory: cand.item,
        reason,
        confidence: Math.max(0.70, confidence)
      });

      usedTypes.add(cand.item.type);
      if (recs.length >= 3) break;
    }

    return recs;
  }, [currentAccessories, allAccessories, faceState.detectedSkinTone, faceState.detectedFaceShape]);

  return (
    <div className="bg-gray-900/80 backdrop-blur-sm rounded-xl p-4 border border-white/5 shadow-xl">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <Sparkles size={16} className="text-yellow-400 animate-pulse" />
          <span className="font-bold text-sm text-white tracking-tight">AI Style Suggestions</span>
        </div>
        <div className="flex flex-col items-end space-y-1">
          {faceState.detectedSkinTone && (
            <div className="flex items-center text-[9px] bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded-full border border-blue-500/20 font-bold uppercase">
              <Palette size={9} className="mr-1" />
              {faceState.detectedSkinTone}
            </div>
          )}
          {faceState.detectedFaceShape && (
            <div className="flex items-center text-[9px] bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded-full border border-purple-500/20 font-bold uppercase">
              <Maximize size={9} className="mr-1" />
              {faceState.detectedFaceShape}
            </div>
          )}
        </div>
      </div>

      <div className="space-y-3">
        {recommendations.length === 0 ? (
          <div className="text-center py-4">
            <ThumbsUp size={24} className="text-green-400 mx-auto mb-2" />
            <p className="text-xs text-gray-400">Perfect Look!!</p>
          </div>
        ) : (
          recommendations.map((rec, index) => (
            <div
              key={`${rec.accessory.id}-${index}`}
              className="flex items-center space-x-3 p-3 bg-gray-800/40 rounded-xl cursor-pointer hover:bg-gray-700/50 transition-all duration-300 group border border-white/5 hover:border-blue-500/30 shadow-sm"
              onClick={() => onRecommendationSelect([...currentAccessories, rec.accessory.id])}
            >
              <div className="relative">
                <img
                  src={rec.accessory.preview}
                  alt={rec.accessory.name}
                  className="w-12 h-12 rounded-lg object-contain bg-gray-950/50 p-1"
                />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-start">
                  <p className="text-xs font-bold text-white truncate">{rec.accessory.name}</p>
                  <span className="text-[10px] font-mono text-blue-400">
                    {Math.round(rec.confidence * 100)}%
                  </span>
                </div>
                <p className="text-[10px] text-gray-400 mt-1 leading-snug">
                  {rec.reason}
                </p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
