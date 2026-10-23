/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** "1" in the standalone website build (no game server behind it). */
  readonly VITE_STANDALONE?: string;
  /** Repository link shown by the standalone build. */
  readonly VITE_REPO_URL?: string;
}
