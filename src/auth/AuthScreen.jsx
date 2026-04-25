import { useState } from 'react';
import { sb } from '../lib/supabase';
import { registerSession } from '../lib/state';

export function AuthScreen({ onAuth }) {
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [name, setName] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const [mfaFactorId, setMfaFactorId] = useState(null);
  const [mfaChallengeId, setMfaChallengeId] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const checkProfile = async (user) => {
    if (!user) return;
    const { data: profile } = await sb.from('profiles').select('*').eq('id', user.id).single();
    if (!profile) {
      await new Promise(r => setTimeout(r, 1500));
      const { data: p2 } = await sb.from('profiles').select('*').eq('id', user.id).single();
      if (!p2?.approved) { setMode('pending'); return; }
      const meData = { userId: user.id, name: p2.name, isLeader: p2.is_leader, team: p2.team || null, email: user.email };
      onAuth(meData); registerSession(meData); return;
    }
    if (!profile.approved) { setMode('pending'); return; }
    const meData = { userId: user.id, name: profile.name, isLeader: profile.is_leader, team: profile.team || null, email: user.email };
    onAuth(meData); registerSession(meData);
  };

  const doLogin = async () => {
    setLoading(true); setError('');
    const { data, error: err } = await sb.auth.signInWithPassword({ email, password });
    if (err) { setError(err.message); setLoading(false); return; }
    const { data: aalData } = await sb.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aalData?.nextLevel === 'aal2' && aalData.nextLevel !== aalData.currentLevel) {
      const factors = data.user?.factors || [];
      const totp = factors.find(f => f.factor_type === 'totp' && f.status === 'verified');
      if (totp) {
        const { data: ch } = await sb.auth.mfa.challenge({ factorId: totp.id });
        setMfaFactorId(totp.id); setMfaChallengeId(ch.id); setMode('mfa');
        setLoading(false); return;
      }
    }
    await checkProfile(data.user); setLoading(false);
  };

  const doMfa = async () => {
    setLoading(true); setError('');
    const { error: err } = await sb.auth.mfa.verify({ factorId: mfaFactorId, challengeId: mfaChallengeId, code: mfaCode });
    if (err) { setError('Ongeldige code'); setLoading(false); return; }
    const { data: { user } } = await sb.auth.getUser();
    await checkProfile(user); setLoading(false);
  };

  const doRegister = async () => {
    setLoading(true); setError('');
    if (!name.trim()) { setError('Voer je naam in'); setLoading(false); return; }
    const { data, error: err } = await sb.auth.signUp({ email, password, options: { data: { name: name.trim() } } });
    if (err) { setError(err.message); setLoading(false); return; }
    await checkProfile(data.user); setLoading(false);
  };

  if (mode === 'pending') return (
    <div className="bm-root bm-center">
      <div className="bm-entry">
        <div className="bm-entry-eyebrow">T-BREAK</div>
        <h1 className="bm-entry-title">Wachten op goedkeuring</h1>
        <p className="bm-entry-sub">Je account wacht op goedkeuring van de teamleider.</p>
        <button className="bm-btn bm-btn-ghost bm-btn-lg" onClick={() => { sb.auth.signOut(); setMode('login'); }}>Terug</button>
      </div>
    </div>
  );

  if (mode === 'mfa') return (
    <div className="bm-root bm-center">
      <div className="bm-entry">
        <div className="bm-entry-eyebrow">T-BREAK</div>
        <h1 className="bm-entry-title">Verificatie</h1>
        <p className="bm-entry-sub">Voer de 6-cijferige code in uit je authenticator app.</p>
        {error && <div className="bm-auth-error">{error}</div>}
        <input className="bm-input bm-input-code" placeholder="000000" value={mfaCode}
          onChange={e => setMfaCode(e.target.value.replace(/\D/g,'').slice(0,6))}
          onKeyDown={e => e.key === 'Enter' && doMfa()} autoFocus maxLength={6} />
        <button className="bm-btn bm-btn-primary bm-btn-lg" onClick={doMfa} disabled={loading || mfaCode.length !== 6}>
          {loading ? 'Controleren…' : 'Bevestigen'}
        </button>
      </div>
    </div>
  );

  return (
    <div className="bm-root bm-center">
      <div className="bm-entry">
        <div className="bm-entry-eyebrow">T-BREAK</div>
        <h1 className="bm-entry-title">{mode === 'login' ? 'Inloggen' : 'Account aanmaken'}</h1>
        <p className="bm-entry-sub">{mode === 'login' ? 'Log in met je werkaccount.' : 'Maak een account aan met je werkmail.'}</p>
        {error && <div className="bm-auth-error">{error}</div>}
        {mode === 'register' && (
          <input className="bm-input" placeholder="Jouw naam" value={name}
            onChange={e => setName(e.target.value)} style={{ marginBottom: '12px' }} />
        )}
        <input className="bm-input" placeholder="Werkemail" type="email" value={email}
          onChange={e => setEmail(e.target.value)} style={{ marginBottom: '12px' }} />
        {/* Password field with show/hide eye */}
        <div className="bm-pw-wrap" style={{ marginBottom: '20px' }}>
          <input className="bm-input" placeholder="Wachtwoord"
            type={showPw ? 'text' : 'password'} value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && (mode === 'login' ? doLogin() : doRegister())} />
          <button className="bm-pw-eye" type="button" tabIndex={-1}
            onClick={() => setShowPw(v => !v)} title={showPw ? 'Ik kijk niet!' : 'Toon wachtwoord'}>
            {showPw ? '🙈' : '👁️'}
          </button>
        </div>
        <button className="bm-btn bm-btn-primary bm-btn-lg"
          onClick={mode === 'login' ? doLogin : doRegister} disabled={loading}>
          {loading ? 'Bezig…' : mode === 'login' ? 'Inloggen' : 'Account aanmaken'}
        </button>
        <button className="bm-auth-switch" onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); }}>
          {mode === 'login' ? 'Nog geen account? Registreren' : 'Al een account? Inloggen'}
        </button>
      </div>
      <div style={{ marginTop: 16, fontSize: 11, color: 'var(--ink-3)', fontFamily: 'Geist', fontWeight: 500 }}>
        v0.5.023
      </div>
    </div>
  );
}
