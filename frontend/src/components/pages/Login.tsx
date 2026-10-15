import _ from 'lodash';
import { t } from 'i18next';
import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router';
import { GoogleOAuthProvider, GoogleLogin } from '@react-oauth/google';
import { jwtDecode } from 'jwt-decode';
import { CircleXIcon } from 'lucide-react';

import FormField from 'src/components/common/FormField';
import { Button } from 'src/components/shadui/button';
import { Spinner } from 'src/components/shadui/spinner';
import { callBe } from 'src/utils/request';
import { useStore } from 'src/state-store';

export default function Login() {
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const set = useStore(state => state.set);
  const user = useStore(state => state.user);
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    repeatPassword: '',
  });
  const navigate = useNavigate();
  const location = useLocation();
  const [formSubmitError, setFormSubmitError] = useState<string | null>(null);

  const [repeatPasswordError, setRepeatPasswordError] = useState<string | null>(null);

  useEffect(() => {
    if (formData.password === formData.repeatPassword) {
      setRepeatPasswordError(null);
    }
  }, [formData]);

  useEffect(() => {
    setFormSubmitError(null);
  }, [isLoginMode]);

  const login = async (username: string, password: string) => {
    try {
      setIsLoading(true);
      const { user: newUser, token } = await callBe({
        url: '/user/authenticate',
        method: 'POST',
        data: { username, password },
      });

      localStorage.setItem('token', token);
      set({ user: newUser });
      const redirectPath = location.state?.from?.pathname || '/';
      navigate(redirectPath);
    } catch (error) {
      // The backend returns one opaque INVALID_CREDENTIALS for both a wrong password and an
      // unknown username, so the FE can't tell them apart either -- that's deliberate (it stops the
      // login form being used to discover which usernames exist).
      if (_.get(error, 'data.detail') === 'INVALID_CREDENTIALS') {
        setFormSubmitError(t('login_invalid_password'));
      }
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (username: string, password: string, userData?: Record<string, unknown>) => {
    try {
      setIsLoading(true);
      let newUser, token;
      if (
        JSON.parse(import.meta.env.VITE_CREATE_GUEST_ACCOUNT)
        && JSON.parse(import.meta.env.VITE_PROMOTE_GUEST_ACCOUNT)
        && user
      ) {
        const result = await callBe({
          url: '/user/promote',
          method: 'POST',
          data: { username, password, user_data: _.omitBy(userData, _.isEmpty), guest_id: user._id },
        });
        newUser = result.user;
        token = result.token;
      } else {
        const result = await callBe({
          url: '/user/register',
          method: 'POST',
          data: { username, password, user_data: _.omitBy(userData, _.isEmpty) },
        });
        newUser = result.user;
        token = result.token;
      }
      localStorage.setItem('token', token);
      set({ user: newUser });
      // [OPTIONS] navigate to home or onboarding as needed.
      navigate('/');
    } catch (error) {
      if (_.get(error, 'data.detail') === 'DUPLICATE_USERNAME') {
        setFormSubmitError(t('register_username_exists'));
      }
    } finally {
      setIsLoading(false);
    }
  };

  const registerGoogle = async (googleInfo: unknown) => {
    try {
      setIsLoading(true);
      let newUser, token, isNew;
      if (
        JSON.parse(import.meta.env.VITE_CREATE_GUEST_ACCOUNT)
        && JSON.parse(import.meta.env.VITE_PROMOTE_GUEST_ACCOUNT)
        && user
      ) {
        const result = await callBe({
          url: '/user/promote-google',
          method: 'POST',
          data: {
            guest_id: user._id,
            user_data: {
              social_data: googleInfo,
            },
          },
        });
        newUser = result.user;
        token = result.token;
        isNew = result.is_new;
      } else {
        const result = await callBe({
          url: '/user/signin-google',
          method: 'POST',
          data: {
            user_data: {
              social_data: googleInfo,
            },
          },
        });
        newUser = result.user;
        token = result.token;
        isNew = result.is_new;
      }
      localStorage.setItem('token', token);
      set({ user: newUser });
      // [OPTIONS] navigate to home or onboarding as needed.
      navigate(isNew ? '/' : '/');
    } catch (error) {
      if (_.get(error, 'data.detail') === 'DUPLICATE_USERNAME') {
        setFormSubmitError(t('register_username_exists'));
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormSubmitError(null);

    if (!isLoginMode && formData.password !== formData.repeatPassword) {
      setRepeatPasswordError(t('password_dont_match'));
      return;
    }

    isLoginMode
      ? await login(formData.username, formData.password)
      : await register(formData.username, formData.password);
  };

  return (
    <div className='mt-30 flex justify-center'>
      <div className='w-[400px] rounded-2xl border border-border bg-card p-8 shadow-lg'>
        <h1 className='mb-4 text-3xl font-semibold'>
          {isLoginMode ? 'Login' : 'Register'}
        </h1>

        <form onSubmit={handleSubmit} className='flex flex-col gap-4'>
          <FormField
            label='Username'
            fullWidth
            required
            value={formData.username}
            onChange={(e) => setFormData({ ...formData, username: e.target.value })}
          />

          <FormField
            label='Password'
            type='password'
            fullWidth
            required
            value={formData.password}
            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
          />

          {!isLoginMode && (
            <FormField
              label='Repeat Password'
              type='password'
              fullWidth
              error={!!repeatPasswordError}
              helperText={repeatPasswordError}
              required
              value={formData.repeatPassword}
              onChange={(e) => setFormData({ ...formData, repeatPassword: e.target.value })}
            />
          )}

          { formSubmitError && (
            <div className='flex flex-row items-center gap-2 text-destructive'>
              <CircleXIcon className='size-5' />
              <p>{formSubmitError}</p>
            </div>
          )}

          <div className='mt-3 flex flex-col gap-5'>
            <Button
              type='submit'
              size='lg'
              disabled={isLoading}
              // cn() resolves Tailwind conflicts, so these beat the variant's h-9/rounded.
              className='h-[40px] w-full rounded-[4px]'
            >
              {isLoading && <Spinner />}
              {isLoginMode ? 'Login' : 'Register'}
            </Button>

            <GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID}>
              <GoogleLogin
                size='large'
                onSuccess={credentialResponse => {
                  if (!credentialResponse.credential) {
                    return;
                  }
                  const googleInfo = jwtDecode(credentialResponse.credential);
                  registerGoogle(googleInfo);
                }}
                onError={() => {
                }}
              />
            </GoogleOAuthProvider>

            <p>
              {isLoginMode ? 'Don\'t have an account?' : 'Already have an account?'}
              <button
                type='button'
                className='ml-1 cursor-pointer text-primary underline-offset-4 hover:underline'
                onClick={() => setIsLoginMode(!isLoginMode)}
              >
                {isLoginMode ? 'Register here' : 'Login here'}
              </button>
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}
