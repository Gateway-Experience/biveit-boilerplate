import _ from 'lodash';

import citiesSpec from 'src/data/vietnamCities';
import type { City } from 'src/types/city';
import { FieldShell } from 'src/components/common/FormField';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from 'src/components/shadui/select';

const cities = _.orderBy(_.values(citiesSpec), ['slug'], ['asc']);

type CityOption = Partial<City> & {
  code: string;
  name: string;
  element?: React.ReactNode;
};

type VietnamCityPickerProps = {
  withNull?: boolean;
  onChange?: (value: string) => void;
  value?: string;
  label?: React.ReactNode;
  error?: boolean;
  helperText?: React.ReactNode;
  fullWidth?: boolean;
  placeholder?: string;
};

export default function VietnamCityPicker({
  withNull, onChange, value, label, error, helperText, fullWidth, placeholder,
}: VietnamCityPickerProps) {
  const options: CityOption[] = withNull ? [
    {
      code: '0',
      name: '',
      element: <span className='italic'>Bỏ chọn</span>,
    },
    ...cities,
  ] : cities;

  return (
    <FieldShell label={label} error={error} helperText={helperText} fullWidth={fullWidth}>
      {shellProps => (
        <Select value={value} onValueChange={next => onChange && onChange(next ?? '')}>
          <SelectTrigger {...shellProps} className='w-full'>
            <SelectValue placeholder={placeholder} />
          </SelectTrigger>
          <SelectContent>
            {_.map(options, city => (
              <SelectItem key={city.code} value={city.name}>
                {city.element || city.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </FieldShell>
  );
}
