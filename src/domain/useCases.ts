import type { Sound } from './models';

export function filterSounds(sounds: Sound[], search: string, category: string): Sound[] {
  const query = search.trim().toLocaleLowerCase('id');
  return sounds.filter(sound => (category === 'all' || sound.category === category)
    && `${sound.title} ${sound.subtitle}`.toLocaleLowerCase('id').includes(query));
}

export function nextSoundId(queue: string[], currentId: string | null, repeat: boolean): string | null {
  if (!queue.length) return null;
  const index = currentId === null ? -1 : queue.indexOf(currentId);
  return queue[index + 1] ?? (repeat ? queue[0] : null);
}

export const formatTime = (seconds: number): string => `${Math.floor(Math.max(0, seconds) / 60).toString().padStart(2, '0')}:${Math.floor(Math.max(0, seconds) % 60).toString().padStart(2, '0')}`;
