import { Component } from 'react';

// Sem isso, um erro de JavaScript em qualquer lugar da árvore React derruba
// o app inteiro silenciosamente — a tela fica em branco (ou preta, com o
// fundo escuro do tema), sem nenhuma pista do que aconteceu. Isso já
// aconteceu 2x durante a migração pro Firestore (bugs em código novo do
// shim de compatibilidade) e cada vez exigiu print + investigação manual.
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { erro: null };
  }

  static getDerivedStateFromError(erro) {
    return { erro };
  }

  componentDidCatch(erro, info) {
    console.error('Erro não tratado na árvore React:', erro, info.componentStack);
  }

  render() {
    if (this.state.erro) {
      return (
        <div className="loading-screen" style={{ flexDirection: 'column', gap: 12, padding: 24, textAlign: 'center' }}>
          <strong style={{ color: 'var(--text)' }}>Algo deu errado nesta tela.</strong>
          <span style={{ maxWidth: 320 }}>{this.state.erro.message}</span>
          <button
            type="button"
            className="btn-cancel"
            onClick={() => this.setState({ erro: null })}
          >
            Tentar de novo
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
