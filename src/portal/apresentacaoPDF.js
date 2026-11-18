// PDF da apresentação de interiores — o gerador fica em public/vendor/apresentacao-pdf.js (o mesmo arquivo
// é usado pela página do cliente, assim o PDF sai igual dos dois lados). Aqui a equipe baixa as imagens pelo Drive.
import { drive } from "../google/googleApi.js";

export async function gerarPDFApresentacao({ token, ...resto }) {
  const m = await import(/* @vite-ignore */ "/vendor/apresentacao-pdf.js");
  const r = await m.gerarPDFApresentacao({ ...resto, baixar: id => drive.baixar(token, id) });
  return { ...r, modelo: m.MODELO_PDF };
}
