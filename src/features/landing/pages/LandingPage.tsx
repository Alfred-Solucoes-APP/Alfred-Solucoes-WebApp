import { useNavigate } from "react-router-dom";

export function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="LandingPage">
      <header className="header">
        <div className="logo">
          <div className="icon" />
          <span className="logo-text">Alfred</span>
        </div>
        <nav className="nav">
          <a href="#sobre" className="nav-link">
            Sobre
          </a>
          <a href="#funcionalidades" className="nav-link">
            Funcionalidades
          </a>
          <a href="#contatos" className="nav-link">
            Contate-nos
          </a>
        </nav>
      </header>

      <section className="hero text-center">
        <h1>Alfred Soluções</h1>
        <div className="btn-group">
          <button
            className="btn-white rounded-full shadow-md"
            onClick={() => navigate("/login")}
          >
            Entrar
          </button>
          <button
            className="btn-blue rounded-full shadow-md"
            onClick={() => navigate("/demo")}
          >
            Ver demonstração
          </button>
        </div>
      </section>

      <section id="sobre" className="section-black text-center">
        <h2>Sobre</h2>
        <p>
          Lorem ipsum dolor sit amet, consectetur adipiscing elit. Placeholder text que você pode
          substituir depois.
        </p>
      </section>

      <section id="funcionalidades" className="section-gray text-center">
        <h2>Funcionalidades</h2>
        <div className="features-grid">
          <div className="feature-card">
            <h3>Funcionalidade 1</h3>
            <p>Texto placeholder para descrição.</p>
          </div>
          <div className="feature-placeholder">[Imagem Placeholder]</div>
        </div>
        <div className="demo-callout">
          <div className="demo-callout__content">
            <h3>Teste o painel completo</h3>
            <p>Explore gráficos e tabelas fictícias para conhecer a experiência antes de contratar.</p>
          </div>
          <button
            className="btn-white rounded-full shadow-md demo-callout__button"
            onClick={() => navigate("/demo")}
          >
            Abrir demonstração
          </button>
        </div>
      </section>

      <footer>
        <div className="btn-group">
          <button className="btn-green rounded-full">WhatsApp</button>
          <button className="btn-blue rounded-full">LinkedIn</button>
        </div>
      </footer>
    </div>
  );
}

export default LandingPage;
