/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** "1" in the standalone website build (no game server behind it). */
  readonly VITE_STANDALONE?: string;
}
