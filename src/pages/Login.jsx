import { useAuth } from '../firebase/authContext';

export default function Login() {
  const { entrarComGoogle, erro } = useAuth();

  return (
    <div className="login-screen">
      <div className="login-conteudo">
        <div className="login-emoji">💰</div>
        <h1>Finanças Pessoais</h1>
        <p className="login-subtitulo">Entre com sua conta Google pra sincronizar seus dados entre dispositivos.</p>
        <button type="button" className="botao-login-google" onClick={entrarComGoogle}>
          Entrar com Google
        </button>
        {erro && <p className="login-erro">{erro}</p>}
      </div>
    </div>
  );
}
