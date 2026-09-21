interface HomePageProps {
  onGoLogin: () => void;
}

const STATS = [
  { id: "home-stat-users", label: "Active users", value: "1,204" },
  { id: "home-stat-sessions", label: "Sessions today", value: "342" },
  { id: "home-stat-errors", label: "Errors", value: "3" },
];

export function HomePage({ onGoLogin }: HomePageProps) {
  return (
    <main className="demo-shell">
      <section className="demo-card demo-card--wide">
        <header className="demo-home-header">
          <div>
            <p className="demo-kicker">WEC Pinnote Demo</p>
            <h1 data-annotation-id="home-heading">Dashboard</h1>
            <p data-annotation-id="home-description" className="demo-copy">
              This page has a different pageKey than /login, so annotations pinned here stay here.
            </p>
          </div>
          <button type="button" className="demo-secondary" data-annotation-id="home-logout" onClick={onGoLogin}>
            Back to login
          </button>
        </header>

        <section className="demo-stats">
          {STATS.map((stat) => (
            <article key={stat.id} className="demo-stat" data-annotation-id={stat.id}>
              <p>{stat.label}</p>
              <strong>{stat.value}</strong>
            </article>
          ))}
        </section>
      </section>
    </main>
  );
}
