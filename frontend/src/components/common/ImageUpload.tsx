import { memo, useCallback } from 'react';
import _ from 'lodash';
import { CircleXIcon } from 'lucide-react';
import { v4 } from 'uuid';

import { Button } from 'src/components/shadui/button';
import ImageThumbnailItem from 'src/components/common/ImageThumbnailItem';

export type Image = { id: string; url?: string; file?: File };

type ImageUploadProps = {
  text?: string;
  error?: boolean;
  helperText?: React.ReactNode;
  value: Image[];
  onChange: (images: Image[]) => void;
};

// `images` are array of object of the format: { id, url } (represent uploaded images)
// or { id, file } (represent images user selected that would be uploaded).
const ImageUpload = ({
  text = 'Upload Pictures', error, helperText, value: images, onChange: setImages,
}: ImageUploadProps) => {
  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newFiles = Array.from(e.target.files || []).filter(file => file.type.startsWith('image/'));
    setImages([...images, ..._.map(newFiles, nf => ({ file: nf, id: v4() }))]);
  }, [setImages, images]);

  const removeImage = useCallback((index: number) => {
    setImages(images.filter((_unused, i) => i !== index));
  }, [setImages, images]);

  return (
    <div>
      <Button nativeButton={false} render={<label />} className='cursor-pointer'>
        {text}
        <input type='file' hidden multiple accept='image/*' onChange={handleFileChange} />
      </Button>
      <Images images={images} removeImage={removeImage} />
      {error && helperText && (
        <div className='mt-4'>
          <p className='text-destructive'>{helperText}</p>
        </div>
      )}
    </div>
  );
};

function _toBackgroundImage(image: Image) {
  if (image.url) {
    return image.url;
  }
  return URL.createObjectURL(image.file as File);
}

const Images = memo(function Images({ images, removeImage }: {
  images: Image[];
  removeImage: (index: number) => void;
}) {
  return (
    <div className='mt-4 flex flex-wrap gap-4'>
      {images.map((image, index) => (
        <ImageThumbnailItem key={image.id} url={_toBackgroundImage(image)} className='group'>
          <button
            type='button'
            aria-label='Remove image'
            onClick={() => removeImage(index)}
            className='absolute -top-2.5 -right-2.5 inline-flex size-6 cursor-pointer items-center justify-center rounded-full bg-foreground/60 text-background opacity-0 transition-opacity group-hover:opacity-100'
          >
            <CircleXIcon className='size-4' />
          </button>
        </ImageThumbnailItem>
      ))}
    </div>
  );
});

export default ImageUpload;
