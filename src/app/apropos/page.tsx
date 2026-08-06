export const metadata = {
  title: "À propos",
};

export default function AProposPage() {
  return (
    <main id="contenu" style={{ padding: "2rem", maxWidth: "720px", margin: "0 auto" }}>
      <h1>À propos</h1>
      <p>
        <strong>Mes données géo</strong> est un outil libre destiné aux communes françaises pour
        éditer leurs données géographiques. Il repose sur une architecture modulaire (plugins) et
        vise la conformité RGAA dès la V1.
      </p>
      <h2>Souveraineté</h2>
      <p>
        Fonds de carte fournis par l&apos;IGN via la Géoplateforme. Cartographie web basée sur
        MapLibre GL (open source). Authentification via ProConnect.
      </p>
      <p>
        <a href="/">Retour à l&apos;accueil</a>
      </p>
    </main>
  );
}
