import { useEffect } from 'react';

import { useElapsed, useRequest } from 'src/utils/hooks';

function Dummy() {
  const { error, data, isFetching } = useRequest('test1', '/debug/health');
  const [ticks, stop] = useElapsed();

  useEffect(() => {
    if (ticks == 5) {
      stop();
    }
  }, [ticks, stop]);

  return (
    <div>
      <div>
        Elapsed: {ticks}
      </div>
      <div>
        ENV: {import.meta.env.VITE_TEST}
      </div>
      <div>
        data: {isFetching ? 'fetching...' : (error ? 'error' : JSON.stringify(data))}
      </div>
    </div>
  );
}

export default Dummy;
