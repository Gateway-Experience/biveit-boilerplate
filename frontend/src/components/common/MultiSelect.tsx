import _ from 'lodash';
import { useMemo } from 'react';
import { XIcon } from 'lucide-react';

import { Badge } from 'src/components/shadui/badge';
import { Label } from 'src/components/shadui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from 'src/components/shadui/select';
import { cn } from 'cn';

type Option = { value: string; label: string };

type MultiSelectProps = {
  gap?: number;
  layout?: 'row' | 'col';
  options: Option[];
  onChange: (value: string[]) => void;
  value: string[];
  label?: React.ReactNode;
  className?: string;
};

function InputComponent({ value, onChange, options, label }: Omit<MultiSelectProps, 'gap' | 'layout'>) {
  return (
    <div className='flex flex-col gap-2'>
      {label && <Label>{label}</Label>}
      <Select value='' onValueChange={next => next && onChange(_.uniq([...value, next]))}>
        <SelectTrigger className='w-full'>
          <SelectValue placeholder='' />
        </SelectTrigger>
        <SelectContent>
          {options.map(option => (
            <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function LabelsComponent({ optionsIndexed, value, onChange }: {
  optionsIndexed: Record<string, Option>;
  value: string[];
  onChange: (value: string[]) => void;
}) {
  return (
    <div className='flex flex-1 flex-wrap gap-1'>
      {value.map(item => (
        <Badge key={optionsIndexed[item].value} variant='secondary' className='gap-1'>
          {optionsIndexed[item].label}
          <button
            type='button'
            aria-label={`Remove ${optionsIndexed[item].label}`}
            onClick={() => onChange(value.filter(val => val !== item))}
            className='cursor-pointer rounded-full hover:bg-foreground/10'
          >
            <XIcon className='size-3' />
          </button>
        </Badge>
      ))}
    </div>
  );
}

export default function MultiSelect({
  gap = 2, layout = 'col', options, onChange, value, className, ...rest
}: MultiSelectProps) {
  const optionsIndexed = useMemo(() => _.keyBy(options, 'value'), [options]);

  if (layout === 'row') {
    return (
      <div className={cn('flex flex-row', className)} style={{ gap: `${gap * 0.25}rem` }}>
        <div className='flex-1'>
          <InputComponent value={value} onChange={onChange} options={options} {...rest} />
        </div>
        <div className='flex-1'>
          <LabelsComponent onChange={onChange} optionsIndexed={optionsIndexed} value={value} />
        </div>
      </div>
    );
  }

  return (
    <div className={cn('flex flex-col', className)} style={{ gap: `${gap * 0.25}rem` }}>
      {!_.isEmpty(value) && (
        <div>
          <LabelsComponent onChange={onChange} optionsIndexed={optionsIndexed} value={value} />
        </div>
      )}
      <div className='flex-1'>
        <InputComponent value={value} onChange={onChange} options={options} {...rest} />
      </div>
    </div>
  );
}
