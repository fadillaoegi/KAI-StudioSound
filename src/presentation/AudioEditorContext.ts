import { createContext } from 'react';
import type { AudioEditor } from '../domain/audioEditing';

export const AudioEditorContext = createContext<AudioEditor | null>(null);
