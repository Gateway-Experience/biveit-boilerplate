import { useState } from 'react';
import { t } from 'i18next';
import { useNavigate, Link } from 'react-router';
import { MenuIcon, ChevronDownIcon } from 'lucide-react';

import LinkButton from 'src/components/common/LinkButton';
import Popover from 'src/components/common/Popover';
import { Avatar, AvatarFallback, AvatarImage } from 'src/components/shadui/avatar';
import { Button } from 'src/components/shadui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from 'src/components/shadui/collapsible';
import { Sheet, SheetContent, SheetTitle, SheetDescription } from 'src/components/shadui/sheet';
import { cn } from 'cn';
import { useStore } from 'src/state-store';
import { resetAnalytics } from 'src/services/analytics';
import type { User } from 'src/types/user';
import { useIsMobile } from 'src/utils/hooks';
import { getUsername } from 'src/services/user';
import logoPath from 'src/assets/logo.svg';
import { MAIN_CONTENT_WIDTH_CLASS, APP_NAME, PATHS } from 'src/utils/constants';

type NavItem = {
  label: string;
  path?: string;
  subItems?: { label: string; path: string }[];
};

// Navigation items with sub-items. Demo items are commented out to keep the bar minimal;
// they double as a reference for the plain-link and dropdown shapes.
const navItems: NavItem[] = [
  // {
  //   label: 'Home',
  //   path: '/',
  // },
  // {
  //   label: 'Dummy',
  //   path: '/dummy',
  // },
  // {
  //   label: 'Protected',
  //   subItems: [
  //     { label: 'Dummy', path: '/protected-dummy' }, { label: 'Test more', path: '/protected-dummy' },
  //   ],
  // },
  // {
  //   label: 'Protected2',
  //   subItems: [
  //     { label: 'Dummy', path: '/protected-dummy' },
  //   ],
  // },
];

// Nav items should read as plain text on the bar, not as buttons.
//
// shadcn's variants assume the component sits on `--background` (a light page), so on
// this `bg-primary` bar three of its defaults misfire and all need overriding:
//   - ghost's `hover:bg-muted`          -> a light block appears behind the text, and its
//     `dark:hover:bg-muted/50` needs killing separately — the dark: variant outranks a
//     plain `hover:bg-transparent`, so a grey block showed up in dark mode only
//   - ghost's `hover:text-foreground`   -> text flips to near-black, ~invisible on blue
//   - `focus-visible:border-ring`       -> near-white 1px border, which lingers after a
//     click since focus persists
//
// Focus is still shown, just as a ring instead of a border — dropping the indicator
// entirely would break keyboard navigation.
//
// (The amber outline on the dropdown triggers came from elsewhere: Base UI's focusable
// PopoverTrigger wrapper. Fixed in components/common/Popover.tsx.)
const NAV_ITEM_CLASS = [
  'bg-transparent px-2 hover:bg-transparent dark:hover:bg-transparent',
  'hover:text-primary-foreground/70',
  'border-transparent focus-visible:border-transparent',
  'focus-visible:ring-primary-foreground/40',
].join(' ');

const profileItems = [
  { label: 'Privacy Policy', path: PATHS.privacyPolicy },
  { label: 'Profile Settings', path: PATHS.userProfile },
];

// One row in the mobile drawer. Plain button rather than MUI's List/ListItem.
function DrawerRow({ children, onClick, indented, className }: {
  // optional: Base UI injects children when used via `render={<DrawerRow/>}`.
  children?: React.ReactNode;
  onClick?: () => void;
  indented?: boolean;
  className?: string;
}) {
  return (
    <button
      type='button'
      onClick={onClick}
      className={`flex w-full cursor-pointer items-center gap-2 px-4 py-3 text-left hover:bg-muted ${indented ? 'pl-8' : ''} ${className || ''}`}
    >
      {children}
    </button>
  );
}

function UserAvatar({ user, className }: { user?: User | null; className?: string }) {
  return (
    <Avatar className={className}>
      <AvatarImage src={user?.profile_picture} />
      <AvatarFallback>{(getUsername(user) || '?').slice(0, 1).toUpperCase()}</AvatarFallback>
    </Avatar>
  );
}

const Navbar = ({ layout = 'FULL' }: { layout?: 'FULL' | 'MAIN' }) => {
  const user = useStore(state => state.user);
  const set = useStore(state => state.set);
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  // State for mobile drawer
  const [drawerOpen, setDrawerOpen] = useState(false);

  const logout = () => {
    localStorage.removeItem('token');
    set({ user: null });
    // Before navigating: drops the mixpanel identity so the next person signing in on
    // this browser doesn't get merged into the previous one's profile.
    resetAnalytics();
    navigate(PATHS.login);
  };

  const goAndClose = (path: string) => {
    navigate(path);
    setDrawerOpen(false);
  };

  return (
    <header className='fixed inset-x-0 top-0 z-50 bg-primary text-primary-foreground'>
      {/* The bar spans the viewport; the row inside lines up with page content.
          `layout='FULL'` widens that row for pages that use the full width. */}
      <div className={cn('mx-auto flex h-16 w-full items-center px-4', layout === 'FULL' ? MAIN_CONTENT_WIDTH_CLASS : 'max-w-none')}>
        {/* Desktop Navigation */}
        {!isMobile && (
          <div className='flex flex-1 items-center justify-between gap-4'>
            <div className='flex flex-1 items-center gap-4'>
              <Link to='/' className='rounded-md outline-none focus-visible:ring-2 focus-visible:ring-primary-foreground/40'>
                <img src={logoPath} alt={APP_NAME} className='h-9' />
              </Link>
              {navItems.map(item => {
                if (item.subItems) {
                  return (
                    <Popover
                      key={item.label}
                      trigger='hover'
                      contentRenderer={() => (
                        item.subItems!.map(subItem => (
                          <LinkButton
                            key={subItem.label}
                            variant='ghost'
                            href={subItem.path}
                            className='w-full justify-start'
                          >
                            {subItem.label}
                          </LinkButton>
                        ))
                      )}
                    >
                      <Button variant='ghost' className={NAV_ITEM_CLASS}>
                        {item.label}
                        <ChevronDownIcon className='size-4' />
                      </Button>
                    </Popover>
                  );
                }
                return (
                  <LinkButton
                    href={item.path}
                    key={item.label}
                    variant='ghost'
                    className={NAV_ITEM_CLASS}
                  >
                    {item.label}
                  </LinkButton>
                );
              })}
            </div>
            <div className='flex flex-row gap-4'>
              {!user && (
                <LinkButton
                  href={PATHS.login}
                  key='login'
                  variant='ghost'
                  className={NAV_ITEM_CLASS}
                >
                  Đăng nhập
                </LinkButton>
              )}
              {user && <Popover
                trigger='click'
                contentRenderer={close => (
                  <div className='min-w-40'>
                    <p className='px-3 py-2 font-bold'>{getUsername(user)}</p>
                    {profileItems.map(item => (
                      <LinkButton
                        key={item.label}
                        variant='ghost'
                        href={item.path}
                        className='w-full justify-start'
                      >
                        {item.label}
                      </LinkButton>
                    ))}
                    <Button
                      variant='ghost'
                      className='w-full justify-start'
                      onClick={() => {
                        logout();
                        close();
                      }}
                    >
                      {t('logout')}
                    </Button>
                  </div>
                )}
              >
                <button type='button' aria-label='Account menu' className='cursor-pointer'>
                  <UserAvatar user={user} />
                </button>
              </Popover>}
            </div>
          </div>
        )}

        {/* Mobile Navigation */}
        {isMobile && (
          <>
            <div className='flex-1'>
              <Link to='/' className='rounded-md outline-none focus-visible:ring-2 focus-visible:ring-primary-foreground/40'>
                <img src={logoPath} alt={APP_NAME} className='h-9' />
              </Link>
            </div>
            <Button
              variant='ghost'
              size='icon'
              aria-label='Open menu'
              onClick={() => setDrawerOpen(true)}
              className='hover:bg-primary-foreground/10 hover:text-primary-foreground'
            >
              <MenuIcon />
            </Button>

            <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
              <SheetContent side='right' className='w-[250px] p-0'>
                <SheetTitle className='sr-only'>Menu</SheetTitle>
                <SheetDescription className='sr-only'>Site navigation</SheetDescription>
                <nav className='mt-8 flex flex-col'>
                  {navItems.map(item => (
                    item.subItems
                      ? (
                        <Collapsible key={item.label}>
                          <CollapsibleTrigger
                            render={<DrawerRow className='justify-between' />}
                          >
                            <span className='flex-1'>{item.label}</span>
                            <ChevronDownIcon className='size-4' />
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                            {item.subItems.map(subItem => (
                              <DrawerRow
                                key={subItem.label}
                                indented
                                onClick={() => goAndClose(subItem.path)}
                              >
                                {subItem.label}
                              </DrawerRow>
                            ))}
                          </CollapsibleContent>
                        </Collapsible>
                      )
                      : (
                        <DrawerRow key={item.label} onClick={() => goAndClose(item.path!)}>
                          {item.label}
                        </DrawerRow>
                      )
                  ))}

                  {!user && (
                    <DrawerRow indented onClick={() => goAndClose(PATHS.login)}>
                      {t('register')}
                    </DrawerRow>
                  )}
                  {user && (
                    <Collapsible>
                      <CollapsibleTrigger render={<DrawerRow />}>
                        <UserAvatar user={user} className='mr-2 size-8' />
                        <span className='flex-1'>{getUsername(user)}</span>
                        <ChevronDownIcon className='size-4' />
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        {profileItems.map(item => (
                          <DrawerRow key={item.label} indented onClick={() => goAndClose(item.path)}>
                            {item.label}
                          </DrawerRow>
                        ))}
                        <DrawerRow
                          indented
                          onClick={() => {
                            logout();
                            setDrawerOpen(false);
                          }}
                        >
                          {t('logout')}
                        </DrawerRow>
                      </CollapsibleContent>
                    </Collapsible>
                  )}
                </nav>
              </SheetContent>
            </Sheet>
          </>
        )}
      </div>
    </header>
  );
};

export default Navbar;
