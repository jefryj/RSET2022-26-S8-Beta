
import { AccessoryItem } from '../types';

const svgToDataUrl = (svg: string) => `data:image/svg+xml;base64,${btoa(svg)}`;

const glassesAviator = svgToDataUrl(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 120"><path d="M20,40 Q20,105 90,100 Q140,95 140,40 L160,40 Q160,95 210,100 Q280,105 280,40" fill="rgba(30,30,30,0.8)" stroke="#D4AF37" stroke-width="3"/><path d="M140,40 Q150,30 160,40" fill="none" stroke="#D4AF37" stroke-width="3"/></svg>`);
const glassesRect = svgToDataUrl(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 120"><rect x="15" y="25" width="115" height="70" fill="rgba(0,0,0,0.85)" stroke="#111" stroke-width="4"/><rect x="170" y="25" width="115" height="70" fill="rgba(0,0,0,0.85)" stroke="#111" stroke-width="4"/><rect x="130" y="35" width="40" height="8" fill="#111"/></svg>`);
const hatCap = svgToDataUrl(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 200"><path d="M40,140 Q150,180 260,140 L250,130 Q150,160 50,130 Z" fill="#000060"/><path d="M50,130 Q150,30 250,130" fill="#000080"/></svg>`);
const earringCrystal = svgToDataUrl(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 160"><circle cx="50" cy="35" r="5" fill="#C0C0C0"/><path d="M50,40 L80,90 L50,155 L20,90 Z" fill="rgba(176, 224, 230, 0.6)" stroke="#C0C0C0" stroke-width="2"/></svg>`);

export const accessoryDatabase: AccessoryItem[] = [
  {
    id: 'glasses-1',
    name: 'Gold Aviators',
    type: 'glasses',
    model: 'aviator',
    preview: glassesAviator,
    scale: 1.0,
    position: [0, 0, 0],
    rotation: [0, 0, 0],
    color: '#D4AF37',
    style_tags: ['classic', 'vintage', 'luxury'],
    face_shapes: ['heart', 'square', 'oblong'],
    trend_score: 9.4
  },
  {
    id: 'glasses-2',
    name: 'Modern Matte',
    type: 'glasses',
    model: 'rectangle',
    preview: glassesRect,
    scale: 1.05,
    position: [0, -0.05, 0],
    rotation: [0, 0, 0],
    color: '#000000',
    style_tags: ['modern', 'minimalist', 'business'],
    face_shapes: ['oval', 'round'],
    trend_score: 8.2
  },
  {
    id: 'hat-1',
    name: 'Streetwear Cap',
    type: 'hat',
    model: 'baseball',
    preview: hatCap,
    scale: 1.8,
    position: [0, -0.5, 0],
    rotation: [0, 0, 0],
    color: '#000080',
    style_tags: ['sporty', 'casual', 'streetwear'],
    face_shapes: ['oval', 'round', 'heart', 'square', 'oblong'],
    trend_score: 7.9
  },
  {
    id: 'earrings-1',
    name: 'Royal Crystal',
    type: 'earrings',
    model: 'crystal',
    preview: earringCrystal,
    scale: 4.5,
    position: [0, 0.15, 0],
    rotation: [0, 0, 0],
    color: '#E0FFFF',
    style_tags: ['elegant', 'formal', 'luxury'],
    face_shapes: ['round', 'heart', 'oval'],
    trend_score: 9.1
  }
];

export const getAccessoriesByType = (type: AccessoryItem['type']) => {
  return accessoryDatabase.filter(item => item.type === type);
};
