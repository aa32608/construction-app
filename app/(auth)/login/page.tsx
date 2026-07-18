'use client';

import '../../globals.css';
import '../../auth.css';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Construction, ArrowRight, Eye, EyeOff, ShieldCheck, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

type Mode = 'signin' | 'signup' | 'reset';

export default function Login() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('signin');
  const [show, setShow] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  function clearNotices() {
    setError('');
    setMessage('');
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    clearNotices();
    const supabase = createClient();

    try {
      if (mode === 'signin') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.replace('/');
        router.refresh();
      } else if (mode === 'signup') {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: fullName } },
        });
        if (error) throw error;
        if (data.session) {
          router.replace('/');
          router.refresh();
        } else {
          setMessage('Check your email to confirm your account, then sign in.');
          setMode('signin');
        }
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/auth/callback`,
        });
        if (error) throw error;
        setMessage('Password reset link sent — check your email.');
      }
    } catch (err: any) {
      setError(err?.message ?? 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function signInWithGoogle() {
    setLoading(true);
    clearNotices();
    const { error } = await createClient().auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) {
      setError(error.message);
      setLoading(false);
    }
  }

  const heading =
    mode === 'signin' ? 'Welcome back' : mode === 'signup' ? 'Create your account' : 'Reset password';
  const subheading =
    mode === 'signin'
      ? 'Sign in to your ConstructOS workspace'
      : mode === 'signup'
        ? 'Start running your construction company'
        : 'We will email you a secure reset link';
  const submitLabel =
    mode === 'signin' ? 'Sign in' : mode === 'signup' ? 'Create account' : 'Send reset link';

  return (
    <main className="auth-page">
      <div className="auth-brand">
        <div className="brand-mark">
          <Construction size={19} />
        </div>
        <span>
          construct<strong>OS</strong>
        </span>
      </div>

      <div className="auth-layout">
        <section className="auth-pitch">
          <div className="pitch-content">
            <span className="pill">THE OPERATING SYSTEM FOR CONSTRUCTION</span>
            <h1>
              Build better.
              <br />
              <i>Run smarter.</i>
            </h1>
            <p>One calm, connected workspace for every project, person, and purchase.</p>
            <div className="trust">
              <ShieldCheck size={16} /> Trusted by construction teams across Europe
            </div>
          </div>
          <div className="quote">
            “ConstructOS gives us a clear view of the entire business — from the site to the office.”
            <small>— Aleksandar Iliev, Managing Director</small>
          </div>
        </section>

        <section className="auth-card">
          <div className="auth-heading">
            <h2>{heading}</h2>
            <p>{subheading}</p>
          </div>

          {mode !== 'reset' && (
            <>
              <button className="google" onClick={signInWithGoogle} type="button">
                <span>G</span> Continue with Google
              </button>
              <div className="or">
                <span>or continue with email</span>
              </div>
            </>
          )}

          <form onSubmit={handleSubmit}>
            {mode === 'signup' && (
              <label style={{ display: 'block', marginBottom: 19 }}>
                Full name
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="David Markovic"
                  required
                />
              </label>
            )}

            <label>
              Work email
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                required
              />
            </label>

            {mode !== 'reset' && (
              <div className="password-label">
                <label>
                  Password
                  <div className="password">
                    <input
                      type={show ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter your password"
                      required
                      minLength={6}
                    />
                    <button type="button" onClick={() => setShow(!show)}>
                      {show ? <EyeOff size={17} /> : <Eye size={17} />}
                    </button>
                  </div>
                </label>
                <Link href="#" onClick={(e) => { e.preventDefault(); clearNotices(); setMode('reset'); }}>
                  Forgot password?
                </Link>
              </div>
            )}

            {error && (
              <p style={{ color: '#df7f73', fontSize: 11, margin: '14px 0 0' }}>{error}</p>
            )}
            {message && (
              <p style={{ color: '#3eae83', fontSize: 11, margin: '14px 0 0' }}>{message}</p>
            )}

            <button className="auth-submit" type="submit" disabled={loading} style={{ opacity: loading ? 0.7 : 1 }}>
              {loading ? <Loader2 size={17} className="spin" /> : null}
              {submitLabel} {!loading && <ArrowRight size={17} />}
            </button>
          </form>

          <p className="auth-footer">
            {mode === 'signin' ? (
              <>
                Don&apos;t have an account?{' '}
                <Link
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    clearNotices();
                    setMode('signup');
                  }}
                >
                  Create your workspace
                </Link>
              </>
            ) : (
              <>
                Already have an account?{' '}
                <Link
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    clearNotices();
                    setMode('signin');
                  }}
                >
                  Sign in
                </Link>
              </>
            )}
          </p>

          <small className="legal">
            By continuing, you agree to our Terms of Service and Privacy Policy.
          </small>
        </section>
      </div>

      <style>{`.spin{animation:spin 1s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </main>
  );
}
