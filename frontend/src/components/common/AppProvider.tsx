import { useEffect, useState } from 'react';
import i18next from 'i18next';
import _ from 'lodash';
import LanguageDetector from 'i18next-browser-languagedetector';
import { initReactI18next } from 'react-i18next';

import { callBe } from 'src/utils/request';
import { useStore } from 'src/state-store';
import FullScreenLoading from 'src/components/common/FullScreenLoading';
import i18nMappings from 'src/utils/i18nMappings';
import { initAnalytics, identifyUser } from 'src/services/analytics';

const enMappings = _.mapValues(i18nMappings, 'en');

export default function AppProvider({ children }: { children: React.ReactNode }) {
  const set = useStore(state => state.set);
  const user = useStore(state => state.user);
  const [initialized, setInitialized] = useState(false);

  // All initialization should be done here.
  useEffect(() => {
    if (initialized) {
      return;
    }
    initAnalytics();
    i18next
      .use(LanguageDetector)
      .use(initReactI18next)
      .init({
        lng: import.meta.env.VITE_APP_LANGUAGE || 'en',
        resources: {
          en: {
            translation: enMappings,
          },
        },
      });
    callBe('/me')
      .then(data => {
        set({ user: data });
      })
      .catch(e => {
        if (e.code === 401) {
          set({ user: null });
          if (localStorage.getItem('token') === null && JSON.parse(import.meta.env.VITE_CREATE_GUEST_ACCOUNT)) {
            callBe({
              url: '/user/register-guest',
              method: 'POST',
            }).then(({ user, token }) => {
              localStorage.setItem('token', token);
              set({ user });
            });
          }
        } else {
          return Promise.reject(e);
        }
      })
      .finally(() => {
        setInitialized(true);
      });
  }, [set, initialized, setInitialized]);

  // Keeps analytics attribution in step with whoever is signed in. Logout clears `user`,
  // and resetAnalytics() is called there directly since identify() has no "nobody" state.
  useEffect(() => {
    identifyUser(user);
  }, [user]);

  if (!initialized) {
    return <FullScreenLoading loading={true} />;
  }

  return (
    <div data-userid={_.get(user, '_id', '')}>
      {children}
    </div>
  );
}
