import { useTranslation } from 'react-i18next';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from 'src/components/shadui/dropdown-menu';

const languages = [
  {
    code: 'en',
    name: 'English',
    flag: '🇬🇧',
  },
  {
    code: 'vi',
    name: 'Tiếng Việt',
    flag: '🇻🇳',
  },
];

export default function LanguageSelector() {
  const { i18n } = useTranslation();

  // Find the current language
  const currentLanguage = languages.find(lang => lang.code === i18n.language) || languages[0];

  return (
    <div className='flex items-center'>
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label='Select language'
          nativeButton={false}
          render={<div className='cursor-pointer text-2xl leading-none' />}
        >
          {currentLanguage.flag}
        </DropdownMenuTrigger>
        <DropdownMenuContent align='end' className='min-w-[150px]'>
          {languages.map(language => (
            <DropdownMenuItem
              key={language.code}
              onClick={() => i18n.changeLanguage(language.code)}
              className='flex items-center gap-2'
              data-selected={i18n.language === language.code || undefined}
            >
              <span className='text-xl leading-none'>{language.flag}</span>
              {language.name}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
