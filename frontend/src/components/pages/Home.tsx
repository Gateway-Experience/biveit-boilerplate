import _ from 'lodash';

import { useStore } from 'src/state-store';

function Home() {
  const user = useStore(state => state.user);

  return (
    <div>
      <div>
        User: {_.get(user, '_id')}
        GoogleId: {_.get(user, 'google_id')}
      </div>
    </div>
  );
}

export default Home;
