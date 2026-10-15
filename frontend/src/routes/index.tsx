import { Routes, Route } from 'react-router';

import ProtectedRoute from 'src/components/common/ProtectedRoute';
import DefaultLayout from 'src/components/layouts/DefaultLayout';
import Home from 'src/components/pages/Home';
import Dummy from 'src/components/pages/Dummy';
import UserProfile from 'src/components/pages/UserProfile';
import Login from 'src/components/pages/Login';
import PrivacyPolicy from 'src/components/pages/PrivacyPolicy';
import { PATHS } from 'src/utils/constants';
import ShowCase from 'src/components/pages/ShowCase';
import { useTrackPageViews } from 'src/utils/hooks';

// Use ProtectedRoute for routes that are for logged in users only.
// Unauthorized users going there will be redirected to the login page.

// Page views are tracked here rather than in a layout, so routes that don't use
// DefaultLayout (/, /dummy, /login) are counted too.
function AppRoutes() {
  useTrackPageViews();

  return (
    <Routes>
      <Route element={<DefaultLayout />}>
        <Route path='protected-dummy' element={<ProtectedRoute><Dummy /></ProtectedRoute>} />
        <Route path={PATHS.userProfile} element={<ProtectedRoute><UserProfile /></ProtectedRoute>} />
        <Route path={PATHS.privacyPolicy} element={<PrivacyPolicy />} />
        <Route path='/showcase' element={<ShowCase />} />
      </Route>
      <Route path='/' element={<Home />} />
      <Route path='/dummy' element={<Dummy />} />
      <Route path={PATHS.login} element={<Login />} />
    </Routes>
  );
}

const routes = <AppRoutes />;

export default routes;
