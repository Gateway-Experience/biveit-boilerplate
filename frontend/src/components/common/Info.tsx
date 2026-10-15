import { InfoIcon } from 'lucide-react';

import { Tooltip, TooltipContent, TooltipTrigger } from 'src/components/shadui/tooltip';

type InfoProps = {
  text: React.ReactNode;
  leftSpacing?: string;
};

// TODO: check if can show tooltip on mobile.
export default function Info({ text, leftSpacing = '0.5rem' }: InfoProps) {
  return (
    <span className='inline cursor-pointer' style={{ marginLeft: leftSpacing }}>
      <Tooltip>
        <TooltipTrigger render={<InfoIcon className='inline size-5' />} />
        <TooltipContent>{text}</TooltipContent>
      </Tooltip>
    </span>
  );
}
