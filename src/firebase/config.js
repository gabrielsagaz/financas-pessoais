import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager
} from 'firebase/firestore';

// ---------------------------------------------------------------------------
// Config lida de variáveis de ambiente (VITE_FIREBASE_*), definidas num
// arquivo .env.local que NÃO vai pro Git (ver .env.example neste mesmo
// diretório e o .gitignore). Cada dev/dispositivo que for rodar `npm run
// dev` ou `npm run build` precisa desse arquivo com as chaves do projeto
// Firebase criado no console.
// ---------------------------------------------------------------------------
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// `persistentLocalCache` é o que mantém o app funcionando offline (lê/escreve
// no cache local do dispositivo) e sincroniza sozinho quando a internet
// volta — o mesmo papel que o Dexie/IndexedDB fazia antes, só que agora o
// Firestore cuida disso e ainda replica pros outros dispositivos.
// `persistentMultipleTabManager` evita conflito se o app ficar aberto em
// mais de uma aba/janela do mesmo navegador ao mesmo tempo.
export const firestoreDb = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
});
