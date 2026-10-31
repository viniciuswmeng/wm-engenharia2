// Motor do visualizador IFC — three.js + web-ifc (WebAssembly, servido pelo próprio app)
// Usado pela aba interna "Visualizador IFC" e pela página pública /modelo/:token
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { IfcAPI, FILE_NAME } from "web-ifc";
import wasmUrl from "web-ifc/web-ifc.wasm?url";
import { classificar } from "./categorias.js";

let _api = null, _apiPromise = null;
export function obterApi() {
  if (_api) return Promise.resolve(_api);
  if (!_apiPromise) {
    _apiPromise = (async () => {
      const api = new IfcAPI();
      await api.Init(() => wasmUrl, true);
      _api = api;
      return api;
    })().catch(e => { _apiPromise = null; throw e; });
  }
  return _apiPromise;
}

// Decodifica textos IFC (\X2\00E9\X0\ , \X\E9 , \S\i …)
export function textoIFC(s) {
  if (s == null) return "";
  let t = String(s);
  t = t.replace(/\\X2\\([0-9A-F]+?)\\X0\\/gi, (_, h) => { let r = ""; for (let i = 0; i + 4 <= h.length; i += 4) r += String.fromCharCode(parseInt(h.slice(i, i + 4), 16)); return r; });
  t = t.replace(/\\X\\([0-9A-F]{2})/gi, (_, h) => String.fromCharCode(parseInt(h, 16)));
  t = t.replace(/\\S\\(.)/g, (_, c) => String.fromCharCode(c.charCodeAt(0) + 128));
  return t;
}
const valor = v => {
  if (v == null) return "";
  if (typeof v === "object" && "value" in v) v = v.value;
  if (typeof v === "boolean") return v ? "Sim" : "Não";
  if (typeof v === "number") return Number.isInteger(v) ? String(v) : v.toLocaleString("pt-BR", { maximumFractionDigits: 3 });
  const s = textoIFC(v);
  if (s === "T" || s === ".T.") return "Sim";
  if (s === "F" || s === ".F.") return "Não";
  return s;
};

const CORES_MODELO = [0x1565d8, 0xf59e0b, 0x16a34a, 0xe11d48, 0x7c3aed, 0x0891b2];
const COR_SELECAO = 0x22c55e;

export function criarVisualizador(el, { onSelecionar, onCaminharMudou } = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x000000, 0);
  Object.assign(renderer.domElement.style, { width: "100%", height: "100%", display: "block", outline: "none", touchAction: "none" });
  el.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, 0.05, 5000);
  camera.position.set(18, 14, 18);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x9aa8bd, 2.2));
  const sol = new THREE.DirectionalLight(0xffffff, 1.7); sol.position.set(30, 60, 25); scene.add(sol);
  const contra = new THREE.DirectionalLight(0xdfe8ff, 0.6); contra.position.set(-30, 20, -30); scene.add(contra);
  const grade = new THREE.GridHelper(200, 200, 0xc3cfe0, 0xdfe6f0);
  grade.material.transparent = true; grade.material.opacity = 0.7;
  scene.add(grade);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true; controls.dampingFactor = 0.14;
  controls.screenSpacePanning = true; controls.zoomToCursor = true;
  controls.maxPolarAngle = Math.PI * 0.98;

  let sujo = true; const marcar = () => { sujo = true; };
  controls.addEventListener("change", marcar);

  const modelos = new Map();      // id → { mid, grupo, meshes, info, cor }
  const materiais = new Map();
  const estado = { wire: false, raiox: false, modoCor: "ifc", corte: null, filtros: { cat: new Set(), pav: new Set(), mod: new Set() } };
  const plano = new THREE.Plane(new THREE.Vector3(0, -1, 0), 0);
  let selecionado = null;
  let origem = null;
  const matSel = new THREE.MeshLambertMaterial({ color: COR_SELECAO, emissive: 0x0b5d2a, side: THREE.DoubleSide });
  let extras = [];
  const matFoco = new THREE.MeshLambertMaterial({ color: 0xe11d48, emissive: 0x7f1d1d, side: THREE.DoubleSide });
  const matFantasma = new THREE.MeshLambertMaterial({ color: 0x9aa8bd, transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide });

  function material(cor, alpha = 1) {
    const chave = cor + "_" + alpha.toFixed(2);
    let m = materiais.get(chave);
    if (!m) {
      m = new THREE.MeshLambertMaterial({ color: cor, side: THREE.DoubleSide });
      m.userData.alpha = alpha;
      ajustarMaterial(m);
      materiais.set(chave, m);
    }
    return m;
  }
  function ajustarMaterial(m) {
    const a = estado.raiox ? Math.min(m.userData.alpha, 0.22) : m.userData.alpha;
    m.transparent = a < 0.999; m.opacity = a; m.depthWrite = a >= 0.999;
    m.wireframe = estado.wire;
    m.needsUpdate = true;
  }
  function corDoMesh(mesh) {
    const u = mesh.userData;
    if (estado.modoCor === "modelo") return modelos.get(u.modeloId)?.cor ?? u.corCat;
    if (estado.modoCor === "categoria") return u.corCat;
    return u.corIfc ?? u.corCat;
  }
  function pintar(mesh) {
    const u = mesh.userData;
    u.matBase = material(corDoMesh(mesh), u.alpha);
    if (mesh !== selecionado) mesh.material = u.matBase;
  }

  // ── loop de renderização (só desenha quando algo muda) ──
  const fps = { ativo: false, teclas: {}, yaw: 0, pitch: 0, vel: 4.5 };
  let raf = 0, tAnt = performance.now();
  function loop(t) {
    raf = requestAnimationFrame(loop);
    const dt = Math.min((t - tAnt) / 1000, 0.1); tAnt = t;
    if (fps.ativo) { moverFPS(dt); sujo = true; }
    else if (controls.update()) sujo = true;
    if (sujo) { renderer.render(scene, camera); sujo = false; }
  }
  raf = requestAnimationFrame(loop);

  function redimensionar() {
    const w = el.clientWidth || 600, h = el.clientHeight || 400;
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix(); marcar();
  }
  const ro = new ResizeObserver(redimensionar); ro.observe(el); redimensionar();

  // ── seleção por clique (sem arrastar) ──
  const ray = new THREE.Raycaster(); const ptr = new THREE.Vector2(); let down = null;
  const onDown = e => { down = { x: e.clientX, y: e.clientY }; };
  const onUp = e => {
    if (!down || fps.ativo) return;
    const mov = Math.hypot(e.clientX - down.x, e.clientY - down.y); down = null;
    if (mov > 5) return;
    const r = renderer.domElement.getBoundingClientRect();
    ptr.x = ((e.clientX - r.left) / r.width) * 2 - 1; ptr.y = -((e.clientY - r.top) / r.height) * 2 + 1;
    ray.setFromCamera(ptr, camera);
    const alvos = []; modelos.forEach(m => { if (m.grupo.visible) m.meshes.forEach(x => { if (x.visible) alvos.push(x); }); });
    const hit = ray.intersectObjects(alvos, false).find(h => !estado.corte || plano.distanceToPoint(h.point) >= 0);
    selecionar(hit ? hit.object : null);
  };
  renderer.domElement.addEventListener("pointerdown", onDown);
  renderer.domElement.addEventListener("pointerup", onUp);

  function selecionar(mesh) {
    if (selecionado) {
      const ant = modelos.get(selecionado.userData.modeloId);
      ant?.meshes.forEach(x => { if (x.userData.eid === selecionado.userData.eid) x.material = x.userData.matBase; });
    }
    selecionado = mesh;
    if (mesh) {
      const m = modelos.get(mesh.userData.modeloId);
      m?.meshes.forEach(x => { if (x.userData.eid === mesh.userData.eid) x.material = matSel; });
      const u = mesh.userData;
      onSelecionar?.({ modeloId: u.modeloId, eid: u.eid, tipo: u.tipo, categoria: u.categoria, disciplina: u.disciplina, nome: u.nome, modelo: m?.info?.nome });
    } else onSelecionar?.(null);
    marcar();
  }

  // ── modo caminhar (WASD) ──
  let olhando = null;
  const onKey = (e, v) => {
    if (!fps.ativo) return;
    const k = e.key.toLowerCase(); fps.teclas[k] = v;
    if (["w", "a", "s", "d", "q", "e", "arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(k)) e.preventDefault();
    if (k === "escape" && v) setCaminhar(false);
  };
  const kd = e => onKey(e, true), ku = e => onKey(e, false);
  const md = e => { if (fps.ativo) olhando = { x: e.clientX, y: e.clientY }; };
  const mm = e => {
    if (!fps.ativo || !olhando) return;
    fps.yaw -= (e.clientX - olhando.x) * 0.0035; fps.pitch -= (e.clientY - olhando.y) * 0.0035;
    fps.pitch = Math.max(-1.45, Math.min(1.45, fps.pitch)); olhando = { x: e.clientX, y: e.clientY };
  };
  const mu = () => { olhando = null; };
  window.addEventListener("keydown", kd); window.addEventListener("keyup", ku);
  renderer.domElement.addEventListener("pointerdown", md); window.addEventListener("pointermove", mm); window.addEventListener("pointerup", mu);

  function moverFPS(dt) {
    const k = fps.teclas, s = fps.vel * dt * (k.shift ? 2.5 : 1);
    const frente = new THREE.Vector3(-Math.sin(fps.yaw), 0, -Math.cos(fps.yaw));
    const lado = new THREE.Vector3(Math.cos(fps.yaw), 0, -Math.sin(fps.yaw));
    if (k.w || k.arrowup) camera.position.addScaledVector(frente, s);
    if (k.s || k.arrowdown) camera.position.addScaledVector(frente, -s);
    if (k.a || k.arrowleft) camera.position.addScaledVector(lado, -s);
    if (k.d || k.arrowright) camera.position.addScaledVector(lado, s);
    if (k.q || k[" "]) camera.position.y += s;
    if (k.e) camera.position.y -= s;
    const dir = new THREE.Vector3(-Math.sin(fps.yaw) * Math.cos(fps.pitch), Math.sin(fps.pitch), -Math.cos(fps.yaw) * Math.cos(fps.pitch));
    camera.lookAt(camera.position.clone().add(dir));
  }
  function setCaminhar(on) {
    if (on === fps.ativo) return;
    fps.ativo = on; fps.teclas = {};
    if (on) {
      const dir = new THREE.Vector3(); camera.getWorldDirection(dir);
      fps.yaw = Math.atan2(-dir.x, -dir.z); fps.pitch = 0;
      const box = caixaVisivel();
      if (!box.isEmpty()) {
        const c = box.getCenter(new THREE.Vector3());
        camera.position.set(c.x, box.min.y + 1.6, box.max.z + 2);
        fps.yaw = 0;
      }
      controls.enabled = false; renderer.domElement.style.cursor = "crosshair";
    } else {
      const dir = new THREE.Vector3(); camera.getWorldDirection(dir);
      controls.target.copy(camera.position).addScaledVector(dir, 5);
      controls.enabled = true; renderer.domElement.style.cursor = "";
      controls.update();
    }
    onCaminharMudou?.(on); marcar();
  }

  function caixaVisivel() {
    const box = new THREE.Box3();
    modelos.forEach(m => { if (m.grupo.visible) m.meshes.forEach(x => { if (x.visible) box.expandByObject(x); }); });
    if (box.isEmpty()) modelos.forEach(m => box.expandByObject(m.grupo));
    return box;
  }
  function caixaTotal() { const b = new THREE.Box3(); modelos.forEach(m => b.expandByObject(m.grupo)); return b; }

  function enquadrar(vista = "iso") {
    const box = caixaVisivel(); if (box.isEmpty()) return;
    const c = box.getCenter(new THREE.Vector3()), sz = box.getSize(new THREE.Vector3());
    const r = Math.max(sz.length() / 2, 0.5);
    const vfov = (camera.fov * Math.PI) / 180, hfov = 2 * Math.atan(Math.tan(vfov / 2) * camera.aspect);
    const dist = (r / Math.sin(Math.min(vfov, hfov) / 2)) * 1.05;
    const dirs = { iso: [1, 0.8, 1], topo: [0, 1, 0.0001], frente: [0, 0.15, 1], direita: [1, 0.15, 0], fundos: [0, 0.15, -1], esquerda: [-1, 0.15, 0] };
    const d = new THREE.Vector3(...(dirs[vista] || dirs.iso)).normalize();
    if (fps.ativo) setCaminhar(false);
    controls.target.copy(c);
    camera.position.copy(c).addScaledVector(d, dist);
    camera.near = Math.max(0.02, r / 2000); camera.far = r * 50; camera.updateProjectionMatrix();
    controls.update(); marcar();
  }

  function aplicarFiltros() {
    const f = estado.filtros;
    modelos.forEach((m, id) => {
      m.grupo.visible = !f.mod.has(id);
      m.meshes.forEach(x => {
        const u = x.userData;
        x.visible = !f.cat.has(u.categoria) && !(u.pav != null && f.pav.has(id + ":" + u.pav)) && !(u.oculto);
      });
    });
    marcar();
  }

  function posicionarGrade() {
    const b = caixaTotal(); if (b.isEmpty()) return;
    grade.position.set((b.min.x + b.max.x) / 2, b.min.y - 0.01, (b.min.z + b.max.z) / 2);
    const r = Math.max(b.max.x - b.min.x, b.max.z - b.min.z, 10);
    const esc = Math.ceil(r * 1.6 / 200 * 10) / 10 || 1; grade.scale.setScalar(Math.max(esc, 0.2));
  }

  async function carregar(buffer, { id, nome } = {}) {
    const api = await obterApi();
    const mid = api.OpenModel(new Uint8Array(buffer), { COORDINATE_TO_ORIGIN: false, CIRCLE_SEGMENTS: 14 });
    if (mid < 0) throw new Error("Não foi possível abrir este arquivo IFC.");
    const modeloId = id || "m" + Date.now();
    const grupo = new THREE.Group(); grupo.name = nome || "Modelo";
    const meshes = [];

    // estrutura espacial → pavimentos
    const pavimentos = []; const pavDe = new Map();
    try {
      const sp = await api.properties.getSpatialStructure(mid);
      const andar = (n, pav) => {
        if (String(n.type).toUpperCase() === "IFCBUILDINGSTOREY") {
          pav = n.expressID;
          let nomeP = "Pavimento", elev = null;
          try { const l = api.GetLine(mid, n.expressID); nomeP = textoIFC(l?.Name?.value) || nomeP; elev = l?.Elevation?.value ?? null; } catch { /* ignora */ }
          pavimentos.push({ id: pav, nome: nomeP, elev, qtd: 0 });
        }
        if (pav != null) pavDe.set(n.expressID, pav);
        (n.children || []).forEach(ch => andar(ch, pav));
      };
      andar(sp, null);
    } catch { /* modelo sem estrutura espacial */ }

    const cats = new Map(); const elementos = new Set();
    api.StreamAllMeshes(mid, fm => {
      const eid = fm.expressID;
      let tipo = "";
      try { tipo = api.GetNameFromTypeCode(api.GetLineType(mid, eid)); } catch { /* ignora */ }
      const cls = classificar(tipo); if (!cls) return;
      let nomeEl = "";
      try { nomeEl = textoIFC(api.GetLine(mid, eid)?.Name?.value); } catch { /* ignora */ }
      const n = fm.geometries.size();
      for (let i = 0; i < n; i++) {
        const pg = fm.geometries.get(i);
        const geo = api.GetGeometry(mid, pg.geometryExpressID);
        const v = api.GetVertexArray(geo.GetVertexData(), geo.GetVertexDataSize());
        const ix = api.GetIndexArray(geo.GetIndexData(), geo.GetIndexDataSize());
        const nv = v.length / 6; const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3);
        for (let k = 0; k < nv; k++) { pos[k*3] = v[k*6]; pos[k*3+1] = v[k*6+1]; pos[k*3+2] = v[k*6+2]; nor[k*3] = v[k*6+3]; nor[k*3+1] = v[k*6+4]; nor[k*3+2] = v[k*6+5]; }
        const g = new THREE.BufferGeometry();
        g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
        g.setAttribute("normal", new THREE.BufferAttribute(nor, 3));
        g.setIndex(new THREE.BufferAttribute(Uint32Array.from(ix), 1));
        // origem comum a todos os modelos (evita perda de precisão com coordenadas georreferenciadas)
        const mt = pg.flatTransformation.slice();
        if (!origem) origem = [Math.round(mt[12]), Math.round(mt[13]), Math.round(mt[14])];
        mt[12] -= origem[0]; mt[13] -= origem[1]; mt[14] -= origem[2];
        g.applyMatrix4(new THREE.Matrix4().fromArray(mt));
        if (geo.delete) geo.delete();
        const c = pg.color;
        const branco = c.x > 0.97 && c.y > 0.97 && c.z > 0.97;
        const espaco = cls.categoria === "Ambientes";
        const mesh = new THREE.Mesh(g);
        mesh.userData = {
          eid, modeloId, tipo, nome: nomeEl, categoria: cls.categoria, disciplina: cls.disciplina,
          pav: pavDe.get(eid) ?? null, corCat: cls.cor,
          corIfc: branco ? null : new THREE.Color(c.x, c.y, c.z).getHex(),
          alpha: espaco ? 0.18 : Math.max(0.15, Math.min(1, c.w ?? 1)),
        };
        grupo.add(mesh); meshes.push(mesh);
      }
      if (n) {
        elementos.add(eid);
        const k = cls.categoria;
        const atual = cats.get(k) || { nome: k, disciplina: cls.disciplina, cor: cls.cor, qtd: 0, ids: new Set() };
        if (!atual.ids.has(eid)) { atual.ids.add(eid); atual.qtd++; }
        cats.set(k, atual);
        const p = pavDe.get(eid); const pv = pavimentos.find(x => x.id === p); if (pv) pv.qtd++;
      }
      if (fm.delete) fm.delete();
    });
    if (!meshes.length) { api.CloseModel(mid); throw new Error("Nenhuma geometria encontrada no arquivo IFC."); }

    let schema = "IFC", aplicativo = "", data = "", autor = "";
    try { schema = api.GetModelSchema(mid) || schema; } catch { /* ignora */ }
    try {
      const h = api.GetHeaderLine(mid, FILE_NAME)?.arguments || [];
      data = textoIFC(h[1]?.value || ""); aplicativo = textoIFC(h[5]?.value || h[4]?.value || "");
      autor = textoIFC((h[2] || []).map(x => x?.value).filter(Boolean).join(", "));
    } catch { /* ignora */ }

    const cor = CORES_MODELO[modelos.size % CORES_MODELO.length];
    const info = {
      id: modeloId, nome: nome || "Modelo", schema, aplicativo, data, autor,
      elementos: elementos.size, cor,
      categorias: [...cats.values()].map(c => ({ nome: c.nome, disciplina: c.disciplina, cor: c.cor, qtd: c.qtd })).sort((a, b) => a.disciplina.localeCompare(b.disciplina) || b.qtd - a.qtd),
      pavimentos: pavimentos.filter(p => p.qtd > 0).sort((a, b) => (a.elev ?? 0) - (b.elev ?? 0)),
    };
    modelos.set(modeloId, { mid, grupo, meshes, info, cor });
    meshes.forEach(pintar);
    // ambientes começam ocultos
    if (cats.has("Ambientes")) estado.filtros.cat.add("Ambientes");
    scene.add(grupo);
    aplicarFiltros(); posicionarGrade();
    if (modelos.size === 1) enquadrar("iso");
    return info;
  }

  async function propriedades(modeloId, eid) {
    const m = modelos.get(modeloId); if (!m) return null;
    const api = await obterApi();
    const l = api.GetLine(m.mid, eid, false) || {};
    const tipo = (() => { try { return api.GetNameFromTypeCode(api.GetLineType(m.mid, eid)); } catch { return ""; } })();
    const gerais = [
      ["Nome", valor(l.Name)], ["Tipo IFC", tipo], ["Descrição", valor(l.Description)], ["Tipo do objeto", valor(l.ObjectType)],
      ["Tag", valor(l.Tag)], ["Tipo predefinido", valor(l.PredefinedType)], ["GlobalId", valor(l.GlobalId)],
    ].filter(([, v]) => v && v !== "NOTDEFINED" && v !== "$");
    const pavId = m.meshes.find(x => x.userData.eid === eid)?.userData.pav;
    const pav = m.info.pavimentos.find(p => p.id === pavId);
    if (pav) gerais.splice(1, 0, ["Pavimento", pav.nome]);

    const grupos = [];
    try {
      const psets = await api.properties.getPropertySets(m.mid, eid, true);
      try {
        const comTipo = await api.properties.getPropertySets(m.mid, eid, true, true);
        const vistos = new Set(psets.map(x => x.expressID));
        comTipo.forEach(x => { if (!vistos.has(x.expressID)) psets.push(x); });
      } catch { /* sem propriedades do tipo */ }
      psets.forEach(ps => {
        const linhas = [];
        (ps.HasProperties || []).forEach(p => { const v = valor(p?.NominalValue); if (p?.Name && v !== "") linhas.push([valor(p.Name), v]); });
        (ps.Quantities || []).forEach(q => {
          const v = q?.LengthValue ?? q?.AreaValue ?? q?.VolumeValue ?? q?.CountValue ?? q?.WeightValue ?? q?.TimeValue;
          const un = q?.LengthValue != null ? " m" : q?.AreaValue != null ? " m²" : q?.VolumeValue != null ? " m³" : q?.WeightValue != null ? " kg" : "";
          if (q?.Name && v != null) linhas.push([valor(q.Name), valor(v) + un]);
        });
        if (linhas.length) grupos.push({ nome: valor(ps.Name) || "Propriedades", linhas });
      });
    } catch { /* sem psets */ }

    const materiaisEl = new Set();
    try {
      let mats = await api.properties.getMaterialsProperties(m.mid, eid, true);
      if (!mats?.length) mats = await api.properties.getMaterialsProperties(m.mid, eid, true, true).catch(() => []);
      const varrer = (o, d = 0) => {
        if (!o || typeof o !== "object" || d > 6) return;
        if (Array.isArray(o)) { o.forEach(x => varrer(x, d + 1)); return; }
        if (o.Name && (o.Category !== undefined || o.type === 1838606355)) { const n = valor(o.Name); if (n) materiaisEl.add(n); }
        Object.values(o).forEach(x => { if (x && typeof x === "object") varrer(x, d + 1); });
      };
      varrer(mats);
    } catch { /* sem materiais */ }
    return { gerais, grupos, materiais: [...materiaisEl] };
  }

  function removerModelo(id) {
    const m = modelos.get(id); if (!m) return;
    if (selecionado?.userData.modeloId === id) selecionar(null);
    scene.remove(m.grupo); m.meshes.forEach(x => x.geometry.dispose());
    _api?.CloseModel(m.mid); modelos.delete(id); estado.filtros.mod.delete(id);
    posicionarGrade(); marcar();
  }

  return {
    carregar, propriedades, removerModelo, enquadrar, selecionar: () => selecionar(null),
    modelos: () => [...modelos.values()].map(m => m.info),
    setFiltros({ categorias, pavimentos, modelos: mods } = {}) {
      if (categorias) estado.filtros.cat = new Set(categorias);
      if (pavimentos) estado.filtros.pav = new Set(pavimentos);
      if (mods) estado.filtros.mod = new Set(mods);
      aplicarFiltros();
    },
    filtros: () => ({ categorias: [...estado.filtros.cat], pavimentos: [...estado.filtros.pav], modelos: [...estado.filtros.mod] }),
    ocultarSelecionado() { if (!selecionado) return; const s = selecionado; const m = modelos.get(s.userData.modeloId); selecionar(null); m.meshes.forEach(x => { if (x.userData.eid === s.userData.eid) x.userData.oculto = true; }); aplicarFiltros(); },
    isolarSelecionado() { if (!selecionado) return; const eid = selecionado.userData.eid, mod = selecionado.userData.modeloId; modelos.forEach((m, id) => m.meshes.forEach(x => { x.userData.oculto = !(id === mod && x.userData.eid === eid); })); aplicarFiltros(); },
    mostrarTodos() { modelos.forEach(m => m.meshes.forEach(x => { x.userData.oculto = false; })); aplicarFiltros(); },
    setWireframe(v) { estado.wire = v; materiais.forEach(ajustarMaterial); marcar(); },
    setRaioX(v) { estado.raiox = v; materiais.forEach(ajustarMaterial); marcar(); },
    setModoCor(modo) { estado.modoCor = modo; modelos.forEach(m => m.meshes.forEach(pintar)); marcar(); },
    setCorte(frac) {
      estado.corte = frac;
      if (frac == null) { renderer.clippingPlanes = []; marcar(); return; }
      const b = caixaTotal(); if (b.isEmpty()) return;
      plano.constant = b.min.y + (b.max.y - b.min.y) * frac;
      renderer.clippingPlanes = [plano]; marcar();
    },
    setCaminhar, caminhando: () => fps.ativo,
    capturar() { renderer.render(scene, camera); return renderer.domElement.toDataURL("image/png"); },
    // Destaca elementos (Map modeloId → Set de expressIDs) em vermelho, esmaece o entorno e enquadra.
    // Usado pela Verificação de projetos para gerar as imagens dos apontamentos.
    focar(alvos, { contexto = 2.5, vista = "iso", caixas = [] } = {}) {
      const box = new THREE.Box3();
      // contornos extras (ex.: o cômodo do apontamento), em coordenadas do IFC
      extras.forEach(h => { scene.remove(h); h.geometry?.dispose?.(); }); extras = [];
      if (origem) caixas.forEach(({ min, max }) => {
        const b = new THREE.Box3(new THREE.Vector3(min[0] - origem[0], min[1] - origem[1], min[2] - origem[2]), new THREE.Vector3(max[0] - origem[0], max[1] - origem[1], max[2] - origem[2]));
        const h = new THREE.Box3Helper(b, 0xe11d48); scene.add(h); extras.push(h); box.union(b);
      });
      modelos.forEach((m, id) => m.meshes.forEach(x => {
        x.userData.foco = !!alvos.get(id)?.has(x.userData.eid);
        if (x.userData.foco) { if (!x.geometry.boundingBox) x.geometry.computeBoundingBox(); box.union(x.geometry.boundingBox); }
      }));
      if (box.isEmpty()) return false;
      const ctx = box.clone().expandByScalar(contexto);
      const temAlvo = [...alvos.values()].some(x => x.size);
      modelos.forEach(m => m.meshes.forEach(x => {
        const u = x.userData;
        if (!x.geometry.boundingBox) x.geometry.computeBoundingBox();
        if (u.foco) { x.material = matFoco; x.visible = true; }
        else if (!temAlvo && ctx.containsBox(x.geometry.boundingBox)) { x.material = matFantasma; x.visible = u.categoria !== "Ambientes"; }
        else { x.material = matFantasma; x.visible = u.categoria !== "Ambientes" && x.geometry.boundingBox.intersectsBox(ctx); }
      }));
      const c = box.getCenter(new THREE.Vector3()), sz = box.getSize(new THREE.Vector3());
      const r = Math.max(sz.length() / 2, 0.6);
      const vfov = (camera.fov * Math.PI) / 180, hfov = 2 * Math.atan(Math.tan(vfov / 2) * camera.aspect);
      const dist = (r / Math.sin(Math.min(vfov, hfov) / 2)) * 1.1;
      const dirs = { iso: [1, 0.85, 1.25], topo: [0, 1, 0.0001] };
      const d = new THREE.Vector3(...(dirs[vista] || dirs.iso)).normalize();
      if (fps.ativo) setCaminhar(false);
      controls.target.copy(c); camera.position.copy(c).addScaledVector(d, dist);
      camera.near = Math.max(0.01, r / 2000); camera.far = r * 80 + 50; camera.updateProjectionMatrix(); controls.update();
      renderer.clippingPlanes = []; grade.visible = false; renderer.setClearColor(0xffffff, 1);
      marcar();
      return true;
    },
    limparFoco() {
      extras.forEach(h => { scene.remove(h); h.geometry?.dispose?.(); }); extras = [];
      modelos.forEach(m => m.meshes.forEach(x => { x.userData.foco = false; x.material = x.userData.matBase; }));
      grade.visible = true; renderer.setClearColor(0x000000, 0); aplicarFiltros();
    },
    dispose() {
      cancelAnimationFrame(raf); ro.disconnect(); controls.dispose();
      window.removeEventListener("keydown", kd); window.removeEventListener("keyup", ku);
      window.removeEventListener("pointermove", mm); window.removeEventListener("pointerup", mu);
      modelos.forEach(m => { m.meshes.forEach(x => x.geometry.dispose()); try { _api?.CloseModel(m.mid); } catch { /* ignora */ } });
      modelos.clear(); materiais.forEach(m => m.dispose()); matSel.dispose(); matFoco.dispose(); matFantasma.dispose(); renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
