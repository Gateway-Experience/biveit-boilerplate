import _ from 'lodash';
import { useStore } from 'src/state-store';

function UserProfile() {
  const user = useStore(state => state.user);

  return (
    <div>
      <div>
        User: {_.get(user, '_id')}
      </div>
    </div>
  );
}

export default UserProfile;
