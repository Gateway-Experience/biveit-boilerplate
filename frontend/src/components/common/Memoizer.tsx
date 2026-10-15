import { useCallback } from 'react';
import _ from 'lodash';

// Used to provide an environment where we can use useCallback to memoize some functions.
// Use this when we want to but it's hard to do if we don't have this.
type MemoizerProps = {
  funcs: ((...args: never[]) => unknown)[];
  resolverss: unknown[][];
  render: (memoized: ((...args: never[]) => unknown)[]) => React.ReactNode;
};

export default function Memoizer({ funcs, resolverss, render }: MemoizerProps) {
  // Calling useCallback in a map is the whole point of this component; hook count
  // stays stable as long as `funcs` does. exhaustive-deps is off in eslint.config.js
  // because it crashes on this shape rather than just warning.
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const memoized = _.map(_.zip(funcs, resolverss), ([func, resolvers]) => useCallback(func as (...args: never[]) => unknown, resolvers as unknown[]));
  return render(memoized);
}
