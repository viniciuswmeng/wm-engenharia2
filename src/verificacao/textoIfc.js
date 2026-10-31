// Decodifica textos IFC (\X2\00E9\X0\ , \X\E9 , \S\i …) — versão sem dependências do visualizador
export function textoIFC(s) {
  if (s == null) return "";
  let t = String(s);
  t = t.replace(/\\X2\\([0-9A-F]+?)\\X0\\/gi, (_, h) => { let r = ""; for (let i = 0; i + 4 <= h.length; i += 4) r += String.fromCharCode(parseInt(h.slice(i, i + 4), 16)); return r; });
  t = t.replace(/\\X\\([0-9A-F]{2})/gi, (_, h) => String.fromCharCode(parseInt(h, 16)));
  t = t.replace(/\\S\\(.)/g, (_, c) => String.fromCharCode(c.charCodeAt(0) + 128));
  return t;
}
