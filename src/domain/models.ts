export type Category = 'bel' | 'musik' | 'ambience' | 'pengumuman';
export type View = 'library' | 'favorites' | 'uploads' | 'playlists' | 'guide';
export interface Sound {
  id: string;
  title: string;
  subtitle: string;
  category: Category;
  duration: number;
  color: 'orange' | 'blue' | 'green' | 'purple' | 'sand' | 'rose';
  src?: string;
  text?: string;
  uploaded?: boolean;
}
export interface Playlist { id: string; name: string; soundIds: string[] }
export interface Preferences { favorites: string[]; volume: number; repeat: boolean; playlists: Playlist[] }
export interface PreferencesRepository {
  load(): Preferences;
  save(preferences: Preferences): void;
}
export interface SoundRepository {
  list(): Promise<Sound[]>;
  save(sound: Sound, file?: Blob): Promise<Sound>;
  remove(id: string): Promise<void>;
}
export interface AudioMetadataReader {
  duration(file: Blob): Promise<number>;
}
export interface LibraryDependencies {
  sounds: SoundRepository;
  metadata: AudioMetadataReader;
}
export interface AudioEvents {
  time: (time: number, duration: number) => void;
  ended: () => void;
  error: (message: string) => void;
}
export interface AudioEngine {
  play(sound: Sound): Promise<void>;
  pause(): void;
  resume(): Promise<void>;
  stop(): void;
  seek(time: number): void;
  setVolume(volume: number): void;
  dispose(): void;
}
