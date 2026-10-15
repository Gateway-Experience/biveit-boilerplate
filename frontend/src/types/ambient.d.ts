/// <reference types="vite/client" />

declare module '*.css';

// react-image-gallery v2 ships no types, and @types/react-image-gallery is still
// on v1. Declare only the surface we use.
declare module 'react-image-gallery' {
  import type { ComponentType } from 'react';

  export interface ReactImageGalleryItem {
    original: string;
    thumbnail?: string;
    originalAlt?: string;
    description?: string;
  }

  export interface ReactImageGalleryProps {
    items: ReactImageGalleryItem[];
    startIndex?: number;
    showFullscreenButton?: boolean;
    showPlayButton?: boolean;
    showThumbnails?: boolean;
    showNav?: boolean;
    slideDuration?: number;
    slideInterval?: number;
    onSlide?: (currentIndex: number) => void;
  }

  const ReactImageGallery: ComponentType<ReactImageGalleryProps>;
  export default ReactImageGallery;
}
