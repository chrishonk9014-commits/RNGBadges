import { useState, type ChangeEvent, type FormEvent } from 'react';
import type { PlayerSummary } from '../../shared/api';
import { LOCAL_GAME, api } from '../api';
import { formatNumber } from '../format';
import type { MotionPreference } from '../storage';
import { Sheet } from './Sheet';

interface Props {
  player: PlayerSummary;
  token: string;
  motion: MotionPreference;
  onMotion: (m: MotionPreference) => void;
  onRename: (name: string) => Promise<void>;
  onRestore: (code: string) => Promise<void>;
  onClose: () => void;
}

export function ProfileSheet({ player, token, motion, onMotion, onRename, onRestore, onClose }: Props) {
  const [name, setName] = useState(player.username);
  const [nameMsg, setNameMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [showCode, setShowCode] = useState(false);
  const [copied, setCopied] = useState(false);
  const [restoreCode, setRestoreCode] = useState('');
  const [restoreMsg, setRestoreMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submitName = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await onRename(name);
      setNameMsg({ ok: true, text: LOCAL_GAME ? 'Saved.' : 'Saved. The leaderboards will show your new name.' });
    } catch (err) {
      setNameMsg({ ok: false, text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(token);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setShowCode(true);
    }
  };

  const submitRestore = async (e: FormEvent) => {
    e.preventDefault();
    if (!restoreCode.trim()) return;
    setBusy(true);
    try {
      await onRestore(restoreCode);
      onClose();
    } catch {
      setRestoreMsg('That save code didn’t match any player.');
    } finally {
      setBusy(false);
    }
  };

  const loadSave = async (text: string) => {
    await onRestore(text);
    onClose();
  };

  return (
    <Sheet title="Profile" onClose={onClose}>
      <form className="form" onSubmit={submitName}>
        <label htmlFor="username">Username</label>
        <div className="form-row">
          <input
            id="username"
            data-autofocus
            value={name}
            minLength={3}
            maxLength={20}
            pattern="[A-Za-z0-9_\-]+"
            autoComplete="off"
            onChange={(e) => setName(e.target.value)}
          />
          <button type="submit" className="button-primary" disabled={busy || name.trim() === player.username}>
            Save
          </button>
        </div>
        <p className="form-hint">3–20 letters, numbers, _ or -.{LOCAL_GAME ? '' : ' Shown on the leaderboards.'}</p>
        {nameMsg && <p className={nameMsg.ok ? 'form-ok' : 'form-error'}>{nameMsg.text}</p>}
      </form>

      <dl className="profile-stats">
        <div>
          <dt>Rolls</dt>
          <dd>{formatNumber(player.rolls)}</dd>
        </div>
        <div>
          <dt>Badges</dt>
          <dd>{formatNumber(player.uniqueBadges)}</dd>
        </div>
        <div>
          <dt>Best roll</dt>
          <dd>{player.bestXp > 0 ? `${formatNumber(player.bestXp)} XP` : '—'}</dd>
        </div>
      </dl>

      {LOCAL_GAME ? (
        <SaveFile player={player} onLoad={loadSave} />
      ) : (
        <>
          <section className="form">
            <h3>Save code</h3>
            <p className="form-hint">
              Your progress is saved on the server. This code is the key to it: use it to continue on another device or browser. Anyone with it can play as you, so keep it private.
            </p>
            <div className="form-row">
              <code className="save-code">{showCode ? token : '•'.repeat(24)}</code>
              <button type="button" className="button-secondary" onClick={() => setShowCode((s) => !s)}>
                {showCode ? 'Hide' : 'Show'}
              </button>
              <button type="button" className="button-secondary" onClick={copy}>
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
          </section>

          <form className="form" onSubmit={submitRestore}>
            <h3>Continue another save</h3>
            <label htmlFor="restore" className="sr-only">
              Save code
            </label>
            <div className="form-row">
              <input id="restore" placeholder="Paste a save code" value={restoreCode} onChange={(e) => setRestoreCode(e.target.value)} autoComplete="off" />
              <button type="submit" className="button-secondary" disabled={busy || !restoreCode.trim()}>
                Load
              </button>
            </div>
            <p className="form-hint">This browser will switch to that player. Copy your current code first if you want to come back.</p>
            {restoreMsg && <p className="form-error">{restoreMsg}</p>}
          </form>
        </>
      )}

      <fieldset className="form">
        <legend>Motion</legend>
        <div className="segmented" role="group">
          {(['system', 'reduced', 'full'] as const).map((m) => (
            <button key={m} type="button" aria-pressed={motion === m} onClick={() => onMotion(m)}>
              {m === 'system' ? 'Match system' : m === 'reduced' ? 'Reduced' : 'Full'}
            </button>
          ))}
        </div>
        <p className="form-hint">Reduced motion skips digit spinning and shows each roll’s badges all at once.</p>
      </fieldset>
    </Sheet>
  );
}

/** The browser version keeps progress on this device; a save file backs it up or moves it. */
function SaveFile({ player, onLoad }: { player: PlayerSummary; onLoad: (text: string) => Promise<void> }) {
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const download = async () => {
    try {
      const { save } = await api<{ save: string }>('/api/local/save');
      const url = URL.createObjectURL(new Blob([save], { type: 'application/json' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `rng-badges-${player.username}.json`;
      a.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setMsg({ ok: true, text: 'Save downloaded.' });
    } catch (err) {
      setMsg({ ok: false, text: (err as Error).message });
    }
  };

  const load = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const replace = window.confirm(
      `Replace the progress in this browser (${formatNumber(player.uniqueBadges)} badges, ${formatNumber(player.rolls)} rolls) with ${file.name}?`,
    );
    if (!replace) return;
    try {
      await onLoad(await file.text());
    } catch {
      setMsg({ ok: false, text: 'That file isn’t an RNG Badges save.' });
    }
  };

  return (
    <section className="form">
      <h3>Your save</h3>
      <p className="form-hint">
        Your progress is saved in this browser. Download a save file to back it up, or to carry on in another browser or on another device.
      </p>
      <div className="form-row">
        <button type="button" className="button-secondary" onClick={download}>
          Download save
        </button>
        <label className="button-secondary file-button">
          Load a save file
          <input type="file" accept=".json,application/json" className="sr-only" onChange={load} />
        </label>
      </div>
      <p className="form-hint">Loading a save file replaces the progress in this browser.</p>
      {msg && <p className={msg.ok ? 'form-ok' : 'form-error'}>{msg.text}</p>}
    </section>
  );
}
