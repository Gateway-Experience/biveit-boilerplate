// Shape of the user object returned by the backend (`/me`, `/user/*`).
// Fields are snake_case: that's the Python backend's convention, and the API hands documents through
// as they're stored rather than renaming at the edge.
export type UserType = 'USER' | 'GUEST';

export type User = {
  _id: string;
  username: string;
  user_type: UserType;
  full_name?: string;
  profile_picture?: string;
  google_id?: string;
  social_data?: {
    email?: string;
    [key: string]: unknown;
  };
};
