import { useDispatch, useSelector } from 'react-redux';
import { useCallback, useEffect } from 'react';
import type { AppDispatch, RootState } from '../app/store';
import type { View } from '../domain/models';
import { actions } from '../application/studioSlice';
import { viewFromHash, viewLabels } from './navigation';

export const useAppDispatch = useDispatch.withTypes<AppDispatch>();
export const useAppSelector = useSelector.withTypes<RootState>();

export function useStudioNavigation() {
  const dispatch = useAppDispatch();
  const view = useAppSelector(state => state.studio.view);

  useEffect(() => {
    const syncLocation = () => dispatch(actions.viewChanged(viewFromHash(window.location.hash)));
    syncLocation();
    window.addEventListener('popstate', syncLocation);
    window.addEventListener('hashchange', syncLocation);
    return () => {
      window.removeEventListener('popstate', syncLocation);
      window.removeEventListener('hashchange', syncLocation);
    };
  }, [dispatch]);

  useEffect(() => { document.title = `${viewLabels[view]} · KAIsound`; }, [view]);

  return useCallback((next: View) => {
    if (window.location.hash !== `#${next}`) window.history.pushState(null, '', `#${next}`);
    dispatch(actions.viewChanged(next));
  }, [dispatch]);
}
