import { useLocation, Navigate } from 'react-router';

import { PATHS, USER_TYPES } from 'src/utils/constants';
import { useStore } from 'src/state-store';

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const user = useStore(state => state.user);
  const location = useLocation();

  return (
    (user && user.user_type !== USER_TYPES.GUEST)
      ? children
      : <Navigate to={PATHS.login} state={{ from: location }} replace />
  );
}
