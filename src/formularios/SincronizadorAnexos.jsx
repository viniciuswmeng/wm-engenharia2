// Em segundo plano: enquanto alguém da equipe está com o sistema aberto e o Google Drive conectado,
// os arquivos enviados pelos clientes nos formulários vão para a pasta do Drive de cada formulário.
import { useEffect } from "react";
import { sincronizarAnexos } from "./dados.js";

export default function SincronizadorAnexos({ drive }) {
  useEffect(() => {
    let parado = false, rodando = false;
    const rodar = async () => {
      if (parado || rodando || document.hidden || !drive?.podeGravar?.()) return;
      rodando = true;
      try { await sincronizarAnexos(); } catch { /* tenta de novo na próxima volta */ } finally { rodando = false; }
    };
    const t0 = setTimeout(rodar, 20000), t = setInterval(rodar, 5 * 60000);
    return () => { parado = true; clearTimeout(t0); clearInterval(t); };
  }, [drive]);
  return null;
}
