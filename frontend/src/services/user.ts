import _ from 'lodash';

import type { User } from 'src/types/user';

function getUsername(user?: User | null) {
  return _.get(user, 'social_data.email') || _.get(user, 'username');
}

function getFullName(user?: User | null) {
  return _.trim(_.get(user, 'full_name')) || getUsername(user);
}

export {
  getUsername,
  getFullName,
};
