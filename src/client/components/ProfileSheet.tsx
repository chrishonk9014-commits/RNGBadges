import { useState, type FormEvent } from 'react';
import type { PlayerSummary } from '../../shared/api';
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
      setNameMsg({ ok: true, text: 'Saved. The leaderboards will show your new name.' });
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
        <p className="form-hint">3–20 letters, numbers, _ or -. Shown on the leaderboards.</p>
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
          <dt>XP</dt>
          <dd>{formatNumber(player.xp)}</dd>
        </div>
      </dl>

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
