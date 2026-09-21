import { useState, type FormEvent } from "react";

interface LoginPageProps {
  onGoHome: () => void;
}

export function LoginPage({ onGoHome }: LoginPageProps) {
  const [email, setEmail] = useState("ada@example.com");
  const [password, setPassword] = useState("password123");
  const [status, setStatus] = useState<string | null>(null);

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    setStatus(`Signed in as ${email}`);
  };

  return (
    <main className="demo-shell">
      <section className="demo-card">
        <p className="demo-kicker">WEC Pinnote Demo</p>
        <h1 data-annotation-id="login-heading">Welcome back</h1>
        <p data-annotation-id="login-description" className="demo-copy">
          Sign in to continue. Use annotation mode to pin comments on this heading, the fields, or
          the login button.
        </p>
        <form className="demo-form" onSubmit={onSubmit}>
          <label data-annotation-id="login-email" className="demo-field">
            Email
            <input
              name="email"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>
          <label data-annotation-id="login-password" className="demo-field">
            Password
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
          <button type="submit" className="demo-submit" data-annotation-id="login-submit">
            Login
          </button>
        </form>
        {status ? <p className="demo-status">{status}</p> : null}
        <button type="button" className="demo-secondary" onClick={onGoHome}>
          Go to home
        </button>
      </section>
    </main>
  );
}
