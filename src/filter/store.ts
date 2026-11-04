/**
 * The smallest observable store that will do: hold a value, replace it
 * through a reducer, tell listeners. The list, the URL writer and later the
 * map each subscribe. Listeners run synchronously after every dispatch;
 * a reducer returning the same object skips them.
 */
export interface Store<S, A> {
  get(): S;
  dispatch(action: A): void;
  subscribe(listener: (state: S) => void): () => void;
}

export function createStore<S, A>(initial: S, reducer: (state: S, action: A) => S): Store<S, A> {
  let state = initial;
  const listeners = new Set<(state: S) => void>();
  return {
    get: () => state,
    dispatch(action) {
      const next = reducer(state, action);
      if (next === state) return;
      state = next;
      for (const l of [...listeners]) l(state);
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
