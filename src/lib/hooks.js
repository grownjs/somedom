import {
  createContext,
} from 'nohooks';

export {
  onError,
  useMemo,
  useRef,
  useState,
  useEffect,
  getContext,
  createContext,
} from 'nohooks';

export function withContext(tag, view) {
  return createContext(tag, (fn, set) => {
    return view((...args) => fn(...args).result, set);
  });
}
