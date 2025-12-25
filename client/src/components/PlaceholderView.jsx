const PlaceholderView = ({ title, description }) => (
  <>
    <header className="hero">
      <p className="eyebrow">{title}</p>
      <h2>{title}</h2>
      {description && <p className="subhead">{description}</p>}
    </header>
    <section className="card placeholder">
      <p className="meta">{description || "Coming soon."}</p>
    </section>
  </>
);

export default PlaceholderView;
