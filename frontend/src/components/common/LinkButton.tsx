import _ from 'lodash';
import { useNavigate, type NavigateFunction } from 'react-router';

import { Button } from 'src/components/shadui/button';
import { useIsMobile } from 'src/utils/hooks';

function isAuxClick(
  e: React.MouseEvent,
  isOnAuxClick: boolean,
  isMobile: boolean,
  mobileClickIsAuxClick?: boolean,
) {
  if (isMobile) {
    return Boolean(mobileClickIsAuxClick);
  }
  if (isOnAuxClick && e.button === 1) {
    return true;
  }
  return false;
}

function isAbsoluteURL(url: string) {
  return /^(?:[a-z+]+:)?\/\//i.test(url);
}

function click(
  href: string | undefined,
  onClick: ((isAux: boolean) => void) | undefined,
  navigate: NavigateFunction,
  isAux: boolean,
) {
  if (isAux) {
    if (_.isNil(href)) {
      onClick?.(isAux);
    } else {
      window.open(href, '_blank');
    }
  } else {
    if (_.isNil(href)) {
      onClick?.(isAux);
    } else {
      if (isAbsoluteURL(href)) {
        window.open(href, '_self');
      } else {
        navigate(href);
      }
    }
  }
}

type LinkButtonProps = Omit<React.ComponentProps<typeof Button>, 'onClick'> & {
  href?: string;
  onClick?: (isAux: boolean) => void;
  mobileClickIsAuxClick?: boolean;
};

// This goes to the new tab immediately though. With a real link it stays in the original tab.
export default function LinkButton(props: LinkButtonProps) {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { mobileClickIsAuxClick, href, onClick, ...rest } = props;

  return <Button
    {...rest}
    onMouseDown={e => e.preventDefault()}
    onClick={e => click(href, onClick, navigate, isAuxClick(e, false, isMobile, mobileClickIsAuxClick))}
    onAuxClick={e => click(href, onClick, navigate, isAuxClick(e, true, isMobile, mobileClickIsAuxClick))}
  />;
}
