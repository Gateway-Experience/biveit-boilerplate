import { useCallback, useRef, useState } from 'react';

import { cn } from 'cn';

import {
  Popover as PopoverRoot,
  PopoverContent,
  PopoverTrigger,
} from 'src/components/shadui/popover';

// How long the menu stays open after the pointer leaves. Can't be 0 — the panel is
// portalled, so moving trigger -> panel fires a leave that something has to cancel.
// Kept short so dismissal still feels immediate; the trigger and panel touch (sideOffset
// 0), so there's no gap to cross and this only has to survive one event tick.
const HOVER_CLOSE_DELAY_MS = 60;

type PopoverProps = {
  trigger: 'click' | 'hover';
  contentRenderer: (close: () => void) => React.ReactNode;
  children: React.ReactNode;
};

export default function Popover({ trigger, contentRenderer, children, ...rest }: PopoverProps) {
  const [open, setOpen] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const cancelClose = useCallback(() => clearTimeout(closeTimer.current), []);

  const close = useCallback(() => {
    cancelClose();
    setOpen(false);
  }, [cancelClose]);

  // PopoverContent portals to <body>, so it is NOT inside the wrapper div below —
  // moving the pointer into the menu counts as leaving the trigger. Close on a delay
  // and cancel it if the pointer lands on the panel, so the two behave as one surface.
  const closeSoon = useCallback(() => {
    cancelClose();
    closeTimer.current = setTimeout(() => setOpen(false), HOVER_CLOSE_DELAY_MS);
  }, [cancelClose]);

  const openNow = useCallback(() => {
    cancelClose();
    setOpen(true);
  }, [cancelClose]);

  // onMouseEnter does NOT re-fire when the pointer comes back from the portalled panel
  // to the trigger — it never left this wrapper's subtree as far as React is concerned.
  // So leaving the panel would start the close timer with nothing to cancel it, and the
  // menu vanished while the pointer sat on the nav item. onMouseOver fires on every move
  // within the subtree, so it reliably cancels a pending close.
  const hoverProps = trigger === 'hover'
    ? { onMouseEnter: openNow, onMouseOver: openNow, onMouseLeave: closeSoon }
    : {};

  return (
    <div {...hoverProps}>
      <PopoverRoot open={open} onOpenChange={setOpen}>
        {/* Base UI makes the trigger focusable, so the browser draws its own `outline: auto`
            (amber in Chrome, and it ignores outline-color) around this wrapper — not around
            whatever we render inside it. Suppress it here; the child supplies its own focus
            style. */}
        <PopoverTrigger
          nativeButton={false}
          render={
            <div
              className={cn(
                'outline-none focus-visible:outline-none',
                trigger === 'click' && 'cursor-pointer',
              )}
            />
          }
        >
          {children}
        </PopoverTrigger>
        {/* Base UI focuses the first item as soon as the popover opens, so Button's
            focus styling (1px border + 3px ring) paints itself on a menu the user only
            hovered — it reads as a stray grey outline, not as focus. Suppress both; the
            items keep their hover background, and real keyboard navigation still moves
            focus visibly via that. */}
        <PopoverContent
          // No offset on hover menus: a gap between trigger and panel is a dead zone that
          // the pointer has to cross, and crossing it would start the close timer.
          sideOffset={trigger === 'hover' ? 0 : 4}
          onMouseEnter={trigger === 'hover' ? cancelClose : undefined}
          onMouseLeave={trigger === 'hover' ? closeSoon : undefined}
          className={cn(
            // shadcn's PopoverContent is `flex flex-col gap-2.5 p-2.5 w-72` — sized for
            // prose. Menu items want to sit flush, so collapse the gap and the width.
            'w-auto gap-0 p-1',
            '[&_[data-slot=button]]:focus-visible:border-transparent',
            '[&_[data-slot=button]]:focus-visible:ring-0',
          )}
          {...rest}
        >
          {contentRenderer(close)}
        </PopoverContent>
      </PopoverRoot>
    </div>
  );
}
