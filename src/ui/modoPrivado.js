// Modo privado: embaça na tela os dados sensíveis (valores em R$, nomes de clientes, telefones e e-mails)
// para mostrar o sistema em reunião, gravar a tela ou trabalhar em lugar público.
// Não muda nenhum dado: só marca os elementos na tela e o CSS os desfoca. Vale também para as
// páginas internas abertas em quadro (Orçamentos, Obras). Fica salvo neste navegador.
import { useEffect, useRef, useState } from "react";

const CHAVE = "wm-modo-privado";
const ATR = "data-wm-oculto";
const CSS = `[${ATR}]{filter:blur(7px)!important;-webkit-user-select:none!important;user-select:none!important;transition:filter .15s}
input[${ATR}],textarea[${ATR}],select[${ATR}]{filter:blur(5px)!important}`;
const PULAR = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "TEMPLATE"]);

const escRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const BASE = [
  /R\$\s?-?\s?\d/,                                  // R$ 1.250,00
  /(^|[^\d/.,])\d{1,3}(\.\d{3})+(,\d{2})?(?![\d/])/, // 12.500 ou 12.500,00
  /(^|[^\d/])\d+,\d{2}(?![\d%/])/,                  // 850,00 (não pega 25,5% nem datas)
  /\(?\b\d{2}\)?\s?9?\d{4}-?\d{4}\b/,              // telefones
  /[\w.+-]+@[\w-]+\.[\w.]+/,                        // e-mails
  /\b\d{3}\.\d{3}\.\d{3}-\d{2}\b|\b\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}\b/, // CPF/CNPJ
];

function montarRegexNomes(projetos) {
  const nomes = new Set();
  (projetos || []).forEach(p => {
    const c = String(p?.cliente || "").trim();
    if (c.length >= 4) nomes.add(c);
    // "H - Compatibilização Residência Lima" → também "Residência Lima"
    const sem = c.replace(/^[A-Z]\s*-\s*/, "").trim(); if (sem.length >= 4) nomes.add(sem);
  });
  const lista = [...nomes].sort((a, b) => b.length - a.length).slice(0, 800).map(escRe);
  return lista.length ? new RegExp(lista.join("|"), "i") : null;
}

function sensivel(txt, reNomes) {
  if (!txt || txt.length < 2) return false;
  if (reNomes && reNomes.test(txt)) return true;
  return BASE.some(r => r.test(txt));
}

function varrer(doc, reNomes) {
  if (!doc?.body) return;
  if (!doc.getElementById("wm-privado-css")) { const st = doc.createElement("style"); st.id = "wm-privado-css"; st.textContent = CSS; doc.head.appendChild(st); }
  const marcar = el => { if (el && !el.closest?.("[data-wm-privado-livre]")) el.setAttribute(ATR, ""); };
  const w = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT);
  for (let n = w.nextNode(); n; n = w.nextNode()) {
    const pai = n.parentElement;
    if (!pai || PULAR.has(pai.tagName) || pai.hasAttribute(ATR)) continue;
    if (!sensivel(n.nodeValue, reNomes)) continue;
    // não embaça um bloco grande inteiro: sobe só até um elemento pequeno
    if (pai.childElementCount > 6 || pai === doc.body || /^(MAIN|SECTION|ARTICLE|TABLE|TBODY|UL|OL)$/.test(pai.tagName)) continue;
    marcar(pai);
  }
  doc.querySelectorAll("input, textarea, select").forEach(el => {
    const v = el.tagName === "SELECT" ? el.options[el.selectedIndex]?.text : el.value;
    if (el.type !== "password" && el.type !== "checkbox" && el.type !== "radio" && sensivel(v, reNomes)) marcar(el); else el.removeAttribute(ATR);
  });
  // quadros da mesma origem (Orçamentos, Obras)
  doc.querySelectorAll("iframe").forEach(f => { try { if (f.contentDocument) varrer(f.contentDocument, reNomes); } catch { /* outra origem */ } });
}

function limpar(doc) {
  if (!doc) return;
  doc.querySelectorAll(`[${ATR}]`).forEach(el => el.removeAttribute(ATR));
  doc.getElementById("wm-privado-css")?.remove();
  doc.querySelectorAll("iframe").forEach(f => { try { limpar(f.contentDocument); } catch { /* outra origem */ } });
}

export function useModoPrivado(projetos) {
  const [ativo, setAtivo] = useState(() => { try { return localStorage.getItem(CHAVE) === "1"; } catch { return false; } });
  const reRef = useRef(null);
  useEffect(() => { reRef.current = montarRegexNomes(projetos); }, [projetos]);
  useEffect(() => {
    try { localStorage.setItem(CHAVE, ativo ? "1" : "0"); } catch { /* sem armazenamento */ }
    if (!ativo) { limpar(document); return; }
    let agendado = 0;
    const rodar = () => { agendado = 0; varrer(document, reRef.current); };
    const agendar = () => { if (!agendado) agendado = window.setTimeout(rodar, 120); };
    rodar();
    const obs = new MutationObserver(agendar);
    obs.observe(document.body, { subtree: true, childList: true, characterData: true });
    // digitação, troca de seleção e páginas em quadro que carregam depois
    document.addEventListener("input", agendar, true); document.addEventListener("change", agendar, true);
    const t = setInterval(rodar, 2500);
    return () => { obs.disconnect(); clearInterval(t); clearTimeout(agendado); document.removeEventListener("input", agendar, true); document.removeEventListener("change", agendar, true); limpar(document); };
  }, [ativo]);
  return [ativo, () => setAtivo(a => !a)];
}
