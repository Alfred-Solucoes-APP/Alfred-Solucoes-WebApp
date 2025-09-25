
export default function LandingPage() {

    return (
        <div className="LandingPage">
            <header className="header">
                <div className="logo">
                <div className="icon"></div>
                <span className="logo-text">Alfred</span>
            </div>
            <nav className="nav">
                <a href="#sobre" className="nav-link">Sobre</a>
                <a href="#funcionalidades" className="nav-link">Funcionalidades</a>
                <a href="#contatos" className="nav-link">Contate-nos</a>
            </nav>
            </header>

            {/* Hero */}
            <section className="hero text-center">
                <h1>Alfred Soluções</h1>
                <div className="btn-group">
                    <button  className="btn-white rounded-full shadow-md">
                        Entrar
                    </button>
                </div>
            </section>

            {/* Sobre */}
            <section id="sobre" className="section-black text-center">
                <h2>Sobre</h2>
                <p>Lorem ipsum dolor sit amet, consectetur adipiscing elit. Placeholder text que você pode substituir depois.</p>
            </section>

            {/* Funcionalidades */}
            <section id="funcionalidades" className="section-gray text-center">
                <h2>Funcionalidades</h2>
            <div className="features-grid">
                <div className="feature-card">
                    <h3>Funcionalidade 1</h3>
                    <p>Texto placeholder para descrição.</p>
                </div>
            <div className="feature-placeholder">[Imagem Placeholder]</div>
            </div>
            </section>

            {/* Footer */}
            <footer>
                <div className="btn-group">
                <button className="btn-green rounded-full">WhatsApp</button>
                <button className="btn-blue rounded-full">LinkedIn</button>
                </div>
            </footer>
        </div>
    );
}