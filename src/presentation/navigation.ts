import type { View } from '../domain/models';

export const viewLabels: Record<View, string> = {
  library: 'Studio Audio',
  favorites: 'Favorit Saya',
  uploads: 'Audio Saya',
  playlists: 'Playlist Saya',
  guide: 'Panduan',
};

export function viewFromHash(hash: string): View {
  const value = hash.replace(/^#\/?/, '');
  return Object.hasOwn(viewLabels, value) ? value as View : 'library';
}

export function primaryView(view: View): 'library' | 'playlists' | 'guide' {
  return view === 'playlists' || view === 'guide' ? view : 'library';
}
