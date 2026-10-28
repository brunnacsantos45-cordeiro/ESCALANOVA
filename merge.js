/* Mescla de 3 vias do estado do app (base = última versão sincronizada, local = o que este
   aparelho tem agora, remoto = o que está no banco). Duas pessoas editando ao mesmo tempo
   ficam com as alterações das duas; só se mexerem no MESMO campo é que vale a local
   (quem está salvando agora). Linhas de professores/escala são casadas pelo _id. */
(function (raiz) {
  'use strict';

  const igual = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const clone = (x) => (x === undefined ? undefined : JSON.parse(JSON.stringify(x)));
  const ehObj = (x) => x !== null && typeof x === 'object' && !Array.isArray(x);
  const ehListaComId = (a) => Array.isArray(a) && a.some((x) => ehObj(x) && x._id !== undefined);

  // Campo a campo: o que só um lado mudou, vale; o que os dois mudaram, vale o local.
  function mesclarValor(base, local, remoto) {
    if (igual(local, base)) return clone(remoto);
    if (igual(remoto, base) || igual(local, remoto)) return clone(local);
    if (ehObj(local) && ehObj(remoto)) return mesclarObjeto(ehObj(base) ? base : {}, local, remoto);
    if (Array.isArray(local) && Array.isArray(remoto)) return mesclarLista(Array.isArray(base) ? base : [], local, remoto);
    return clone(local);
  }

  function mesclarObjeto(base, local, remoto) {
    const saida = {};
    const chaves = new Set([...Object.keys(local), ...Object.keys(remoto), ...Object.keys(base)]);
    for (const k of chaves) {
      const noL = k in local, noR = k in remoto, noB = k in base;
      if (noL && noR) { saida[k] = mesclarValor(base[k], local[k], remoto[k]); continue; }
      if (noL && !noR) {            // sumiu no remoto
        if (noB && igual(local[k], base[k])) continue;   // local não mexeu: remoção vale
        saida[k] = clone(local[k]); continue;            // local mexeu/criou: fica
      }
      if (!noL && noR) {            // sumiu no local
        if (noB && igual(remoto[k], base[k])) continue;  // remoto não mexeu: remoção vale
        saida[k] = clone(remoto[k]);
      }
    }
    return saida;
  }

  function mesclarLista(base, local, remoto) {
    return ehListaComId(local) || ehListaComId(remoto) || ehListaComId(base)
      ? mesclarListaComId(base, local, remoto)
      : mesclarListaSimples(base, local, remoto);
  }

  // Itens simples (ex.: nomes de ajudantes): o que cada lado removeu ou acrescentou é aplicado.
  function mesclarListaSimples(base, local, remoto) {
    const chave = (x) => JSON.stringify(x);
    const sB = new Set(base.map(chave)), sL = new Set(local.map(chave)), sR = new Set(remoto.map(chave));
    const saida = remoto.filter((x) => !(sB.has(chave(x)) && !sL.has(chave(x))));
    for (const x of local) if (!sB.has(chave(x)) && !sR.has(chave(x))) saida.push(clone(x));
    return saida;
  }

  // Linhas com _id: casa por id; edição vence remoção; adições dos dois lados se somam.
  function mesclarListaComId(base, local, remoto) {
    const porId = (lista) => new Map(lista.filter((x) => ehObj(x) && x._id !== undefined).map((x) => [x._id, x]));
    const B = porId(base), L = porId(local), R = porId(remoto);
    const saida = [];
    const usados = new Set();

    for (const r of remoto) {
      if (!ehObj(r) || r._id === undefined) { saida.push(clone(r)); continue; }
      const id = r._id; usados.add(id);
      const l = L.get(id), b = B.get(id);
      if (l) { saida.push(mesclarValor(b || {}, l, r)); continue; }
      if (b && !igual(r, b)) saida.push(clone(r));   // removida aqui, mas editada lá: fica
      else if (!b) saida.push(clone(r));              // criada lá
      // removida localmente e sem edição remota: some
    }
    for (const l of local) {
      if (!ehObj(l) || l._id === undefined) {
        if (!remoto.some((r) => igual(r, l))) saida.push(clone(l));
        continue;
      }
      if (usados.has(l._id)) continue;
      const b = B.get(l._id);
      if (b && igual(l, b)) continue;                 // removida lá e sem edição local: some
      saida.push(clone(l));                           // criada aqui, ou editada aqui e removida lá
    }
    return saida;
  }

  // Ids estáveis: linhas antigas (sem _id) ganham um id calculado do conteúdo, igual em todos os
  // aparelhos; linhas criadas depois recebem um id aleatório assim que passam por aqui.
  function garantirIds(estado) {
    const usados = new Set();
    const unico = (id) => {
      let n = 1, x = id;
      while (usados.has(x)) x = id + '#' + (++n);
      usados.add(x); return x;
    };
    const marcar = (lista, fn) => {
      if (!Array.isArray(lista)) return;
      for (const r of lista) if (ehObj(r) && r._id === undefined) r._id = unico(fn(r));
      for (const r of lista) if (ehObj(r)) usados.add(r._id);
    };
    marcar(estado.professores, (p) => 'p:' + p.classe + '|' + p.nome);
    marcar(estado.escala, (e) => 'e:' + e.classe + '|' + e.data + '|' + e.titular + '|' + e.tema);
    return estado;
  }

  const api = { mesclar: mesclarObjeto, garantirIds, clone };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else raiz.MesclaEstado = api;
})(typeof window !== 'undefined' ? window : globalThis);
