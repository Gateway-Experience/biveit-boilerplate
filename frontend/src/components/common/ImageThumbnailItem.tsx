import { cn } from 'cn';

type ImageThumbnailItemProps = React.ComponentProps<'div'> & {
  size?: number;
  url: string;
};

export default function ImageThumbnailItem({
  children, size = 5, url, className, style, ...rest
}: ImageThumbnailItemProps) {
  return (
    <div
      className={cn('relative border border-border bg-cover bg-center', className)}
      style={{
        width: `${size}rem`,
        height: `${size}rem`,
        borderRadius: `${size * 0.1}rem`,
        backgroundImage: `url(${url})`,
        ...style,
      }}
      {...rest}
    >
      {children}
    </div>
  );
}
