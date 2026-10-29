# Gera src/tema-escuro.css: sobrepõe cores fixas (inline) quando o tema escuro está ligado
# Uso: python3 scripts/gera_tema_escuro.py  (na raiz do projeto). Recria src/tema-escuro.css.
def rgb(h):
  h=h.lstrip('#'); h=''.join(c*2 for c in h) if len(h)==3 else h
  return f"rgb({int(h[0:2],16)}, {int(h[2:4],16)}, {int(h[4:6],16)})"
SUP="#16233a"; SUB="#1b2a44"; SUB2="#203150"; LINHA="#2a3b57"
AZ="rgba(59,130,246,.16)"; VD="rgba(34,197,94,.14)"; AM="rgba(245,158,11,.15)"; VM="rgba(239,68,68,.15)"; RX="rgba(168,85,247,.18)"
BG={
 SUP:["#fff","#ffffff","white"],
 SUB:["#f6f8fc","#f8fafc","#fbfcfe","#fafcfe","#f3f6fb","#f1f4f9","#fafafa","#f8fafd","#f1f5f9","#f5f9ff","#f0f7ff","#f0f4f8","#f6f8fb","#f9fafb","#f8f9fb"],
 SUB2:["#e9eef6","#eef2f8","#edf1f7","#eef1f6","#e9eef5","#e8edf4","#e5e9ef","#e4e9f1","#e2e8f0","#e6ecf4","#dde4ee","#f0f3f8"],
 AZ:["#e9f1fd","#eff6ff","#eef4fd","#e3ecfa","#eaf2fe","#eaf2fd","#dbeafe","#e8f1fb","#e3edfd","#e6effc"],
 VD:["#f0fdf4","#dcfce7","#ecfdf3","#e7f7ee","#effaf3","#e3efe8","#ecfdf5","#dcf5e5","#d1fae5"],
 AM:["#fffbeb","#fef3c7","#fff7ed","#fefce8","#fdefd3","#fee8d8","#ffedd5"],
 VM:["#fef2f2","#fff1f2","#fee2e2","#fff5f5","#ffe4e6","#fdf2f8","#fce7f3","#fde3e8"],
 RX:["#f3e8ff","#f5f3ff","#ede9fe"],
 "rgba(96,165,250,.4)":["#bcd5f8"],
}
COR={
 "#e6edf7":["#0f1f3d","#0b2350","#0a2557","#1e293b","#000","#000000","#1a1a1a","#111827","#0d1e35"],
 "#c3cfe0":["#334866","#374151","#475569"],
 "#95a3b8":["#6b7a90","#8a97ab","#5b6b82","#6b7280","#8a9ab0","#64748b","#8492a6","#94a3b8"],
 "#4ade80":["#166534","#15803d","#065f46","#047857"],
 "#fbbf24":["#92400e","#b45309","#7c2d12","#c2410c","#a16207","#854d0e"],
 "#fb7185":["#991b1b","#be123c","#9f1239","#b91c1c"],
 "#93c5fd":["#1d4ed8","#1257be","#1e40af","#1565d8","#1a4a7a","#2e6da8","#2563a8","#2563eb"],
 "#c4b5fd":["#7c3aed","#6d28d9","#5b21b6"],
}
BORDA={
 LINHA:["#e6ecf4","#d9e2ee","#f0f3f8","#d6e2f5","#c9daf5","#b9cff2","#cfe0f5","#f1f4f9","#edf1f7","#edf1f6","#dde4ee","#e2e8f0","#e5e7eb","#d1d5db","#cbd5e1","#fff","#c9dbf7","#e9eef6","#e2eaf3","#dde3ec","#e8eef5"],
 "rgba(239,68,68,.4)":["#fecaca","#fecdd3","#fca5a5","#fbdbe1"],
 "rgba(245,158,11,.4)":["#fde68a","#fed7aa","#fcd34d","#f8e6c4","#fbe1cf"],
 "rgba(34,197,94,.4)":["#86efac","#bbf7d0","#bfe3cf","#d5f0df"],
 "rgba(59,130,246,.45)":["#bfdbfe","#93c5fd","#d9e6fb","#bcd3f5"],
}
NAO=":not(.wm-cmp-pagina):not(.wm-cmp-pagina *):not(.wm-relatorio-doc):not(.wm-relatorio-doc *):not(.wm-claro):not(.wm-claro *)"
P="html[data-tema=\"escuro\"] "
# Varre o código: toda cor clara ainda não mapeada é classificada pelo tom
import re, glob, colorsys
def norm(h):
  h=h.lower().lstrip('#'); return '#'+(''.join(c*2 for c in h) if len(h)==3 else h)
ja_bg={norm(h) for l in BG.values() for h in l if h!="white"}
ja_bd={norm(h) for l in BORDA.values() for h in l}
todas=set()
for f in glob.glob("src/**/*.jsx",recursive=True)+glob.glob("src/**/*.js",recursive=True):
  todas|={norm(h) for h in re.findall(r"#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b",open(f).read())}
def tom(h):
  r,g,b=[int(h[i:i+2],16)/255 for i in (1,3,5)]
  hh,l,ss=colorsys.rgb_to_hls(r,g,b); return hh*360,l,ss
for h in sorted(todas):
  ang,l,sat=tom(h)
  if l<0.86: continue
  if sat<0.35 or (l>0.97 and sat<0.6): alvo_bg,alvo_bd=SUB,LINHA
  elif 190<=ang<=260: alvo_bg,alvo_bd=AZ,"rgba(59,130,246,.45)"
  elif 80<=ang<190: alvo_bg,alvo_bd=VD,"rgba(34,197,94,.4)"
  elif 25<=ang<80: alvo_bg,alvo_bd=AM,"rgba(245,158,11,.4)"
  elif 260<ang<=300: alvo_bg,alvo_bd=RX,LINHA
  else: alvo_bg,alvo_bd=VM,"rgba(239,68,68,.4)"
  if h not in ja_bg and h!="#ffffff": BG.setdefault(alvo_bg,[]).append(h)
  if h not in ja_bd and l<0.985: BORDA.setdefault(alvo_bd,[]).append(h)
out=["/* Gerado por script: sobreposição das cores fixas no tema escuro. Não editar à mão. */"]
def val(h): return h if h=="white" else rgb(h)
for dest,lst in BG.items():
  sels=[]
  for h in lst:
    v=val(h)
    sels+= [f'{P}[style*="background: {v}"]{NAO}', f'{P}[style*="background-color: {v}"]{NAO}']
  out.append(",\n".join(sels)+" { background-color: "+dest+" !important; }")
  # 'background: X' shorthand: background-color não remove gradiente, ok
for dest,lst in COR.items():
  sels=[]
  for h in lst:
    v=val(h); sels+=[f'{P}[style^="color: {v}"]{NAO}', f'{P}[style*="; color: {v}"]{NAO}']
  out.append(",\n".join(sels)+" { color: "+dest+" !important; }")
for dest,lst in BORDA.items():
  sels=[]
  for h in lst:
    v=val(h); sels+=[f'{P}[style*="solid {v}"]{NAO}', f'{P}[style*="dashed {v}"]{NAO}']
  out.append(",\n".join(sels)+" { border-color: "+dest+" !important; }")
# Degradês claros (cartões do painel): viram superfície lisa
out.append(f'{P}[style*="gradient"][style*="rgb(255, 255, 255)"]{NAO} {{ background-image: none !important; background-color: {SUP} !important; }}')
# Campos sem fundo definido: superfície de campo escura
out.append(f'{P}:is(input, select, textarea):not([type=checkbox]):not([type=radio]):not([type=range]):not([type=color]){NAO} {{ background-color: {SUB}; color: #e6edf7; }}')
open("src/tema-escuro.css","w").write("\n\n".join(out)+"\n")
print(len(out))
