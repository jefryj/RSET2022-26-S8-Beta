# Virtual Try-On Studio

A cutting-edge virtual try-on application built with React, Three.js, and MediaPipe for real-time face tracking and 3D accessory rendering.

## Features

- **Real-time Face Tracking**: MediaPipe-powered face landmark detection
- **3D Accessory Rendering**: Three.js-based 3D accessory system
- **Multi-Accessory Support**: Try on glasses, hats, earrings, and more simultaneously
- **Auto-Fit Engine**: Intelligent scaling and positioning based on face geometry
- **AI Style Recommendations**: Smart suggestions based on current selection
- **Snapshot Gallery**: Capture and compare different looks
- **Responsive Design**: Works seamlessly across all devices

## Technology Stack

- **Frontend**: React 18 with TypeScript
- **3D Graphics**: Three.js with React Three Fiber
- **Face Detection**: MediaPipe Face Mesh
- **Styling**: Tailwind CSS
- **Build Tool**: Vite
- **Icons**: Lucide React

## Getting Started

1. Clone the repository
2. Install dependencies: `npm install`
3. Start the development server: `npm run dev`
4. Open your browser and allow camera access

## Usage

1. **Camera Setup**: Allow camera access when prompted
2. **Position Face**: Ensure your face is visible and well-lit
3. **Select Accessories**: Choose from various categories in the sidebar
4. **Try Combinations**: Mix and match different accessories
5. **Capture Snapshots**: Save your favorite looks
6. **AI Recommendations**: Get style suggestions based on your current selection

## Deployment

The application is ready for deployment on platforms like Vercel, Netlify, or Firebase Hosting.

### Vercel Deployment

```bash
npm run build
vercel --prod
```

### Firebase Deployment

```bash
npm run build
firebase deploy
```

## Browser Compatibility

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

Camera access and WebGL support are required.

## Performance Optimizations

- Lazy loading of 3D models
- Efficient face tracking with MediaPipe
- Optimized rendering pipeline
- Memory management for snapshots
- Responsive image loading

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Open a Pull Request

## License

MIT License - see LICENSE file for details.