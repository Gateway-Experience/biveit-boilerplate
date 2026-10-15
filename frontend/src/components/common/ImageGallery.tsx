import { useState, useEffect, useCallback } from 'react';
import _ from 'lodash';
import ReactImageGallery from 'react-image-gallery';
import { XIcon } from 'lucide-react';
import 'react-image-gallery/styles/css/image-gallery.css';

import { Dialog, DialogContent, DialogDescription, DialogTitle } from 'src/components/shadui/dialog';
import ImageThumbnailItem from 'src/components/common/ImageThumbnailItem';

type GalleryImage = { original: string; thumbnail?: string };

type ImageGalleryProps = {
  thumbnailSize?: number;
  images: GalleryImage[];
  selectedImage?: GalleryImage | null;
  setSelectedImage?: (image: GalleryImage | null) => void;
};

const ImageGallery_ = ({
  thumbnailSize, images, selectedImage, setSelectedImage, ...rest
}: ImageGalleryProps) => {
  const [selectedImageLocal, setSelectedImageLocal] = useState<GalleryImage | null>(null);
  const [startIndex, setStartIndex] = useState(-1);

  // Use setSelectedImage's nullity to specify whether we want ImageGallery to render the thumbnail list as well.
  const withThumbnails = !setSelectedImage;
  const finalSetSelectedImage = setSelectedImage || setSelectedImageLocal;

  useEffect(() => {
    const finalSelectedImage = selectedImage || selectedImageLocal;
    const index = images.findIndex(img => _.isEqual(img, finalSelectedImage));
    setStartIndex(index);
  }, [selectedImage, selectedImageLocal, images, setStartIndex]);

  const handleClose = useCallback(() => {
    finalSetSelectedImage(null);
  }, [finalSetSelectedImage]);

  return (
    <>
      <div {...rest}>
        {withThumbnails && (
          <div className='flex flex-wrap gap-4'>
            {images.map(image => (
              <ImageThumbnailItem
                key={image.original}
                className='cursor-pointer'
                size={thumbnailSize}
                url={image.original}
                onClick={() => finalSetSelectedImage(image)}
              />
            ))}
          </div>
        )}
      </div>
      <Dialog open={startIndex >= 0} onOpenChange={open => !open && handleClose()}>
        {/* DialogContent defaults to a small centred panel (`sm:max-w-sm`, a grid with
            gap-4). `sm:` beats a plain `max-w-full`, so the lightbox has to override the
            responsive variant explicitly to fill the screen. */}
        <DialogContent
          showCloseButton={false}
          className='flex h-full max-h-full w-full max-w-full gap-0 rounded-none border-none bg-scrim-strong p-0 sm:max-w-full'
        >
          <DialogTitle className='sr-only'>Image gallery</DialogTitle>
          <DialogDescription className='sr-only'>Browse images</DialogDescription>
          <button
            type='button'
            aria-label='Close gallery'
            onClick={handleClose}
            className='absolute top-5 right-5 z-10 inline-flex size-10 cursor-pointer items-center justify-center rounded-md text-scrim-foreground hover:bg-scrim-foreground/10'
          >
            <XIcon className='size-6' />
          </button>
          {/* Inset the gallery so the image isn't flush against the viewport edges and the
              close button has somewhere to sit. react-image-gallery sizes the slide to its
              container, so the padding here is what gives the image its margin. */}
          <div className='flex h-full w-full items-center justify-center overflow-hidden px-4 py-14 sm:px-12'>
            <ReactImageGallery
              items={images}
              startIndex={startIndex}
              showFullscreenButton={false}
              showPlayButton={false}
              // Library default is 450ms, which reads as lag when clicking through images.
              slideDuration={250}
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ImageGallery_;
