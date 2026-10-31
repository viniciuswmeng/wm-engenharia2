// Cores e utilitários dos relatórios em PDF
export const D = { mar: "#0a2557", azul: "#1565d8", tx: "#0f1f3d", sub: "#5f6f86", borda: "#dfe6f0", fundo: "#f3f6fb", verde: "#15803d" };

export const nomeArquivoPdf = (prefixo, base) =>
  `${prefixo}_${String(base || "WM").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9 ]/g, "").trim().replace(/\s+/g, "_")}`;
