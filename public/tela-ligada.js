export function montarTelaLigada(controle, status, ambiente = window) {
  const documento = ambiente.document;
  const recurso = ambiente.navigator.wakeLock;
  if (!recurso) {
    controle.disabled = true;
    status.textContent = 'Indisponível neste navegador ou endereço.';
    return () => {};
  }

  const eventos = new AbortController();
  let bloqueio, pendente = false;

  function liberar() {
    const atual = bloqueio;
    bloqueio = null;
    if (atual && !atual.released) void atual.release().catch(() => {});
  }

  async function atualizar() {
    if (!controle.checked || documento.visibilityState !== 'visible' || eventos.signal.aborted) {
      liberar();
      status.textContent = controle.checked ? 'Em pausa enquanto a ficha estiver oculta.' : '';
      return;
    }
    if (bloqueio || pendente) return;
    pendente = true;
    status.textContent = 'Ativando…';
    try {
      const atual = await recurso.request('screen');
      if (eventos.signal.aborted || !controle.checked || documento.visibilityState !== 'visible') {
        await atual.release();
        return;
      }
      if (atual.released) throw new Error('Bloqueio liberado.');
      bloqueio = atual;
      status.textContent = 'Tela ligada durante o preparo.';
      atual.addEventListener('release', () => {
        if (bloqueio !== atual) return;
        bloqueio = null;
        if (documento.visibilityState === 'visible') {
          controle.checked = false;
          status.textContent = 'O dispositivo liberou a tela. Você pode ativar novamente.';
        } else {
          status.textContent = 'Em pausa enquanto a ficha estiver oculta.';
        }
      }, {once:true, signal:eventos.signal});
    } catch {
      if (!eventos.signal.aborted && controle.checked && documento.visibilityState === 'visible') {
        controle.checked = false;
        status.textContent = 'Não foi possível manter a tela ligada. Tente novamente.';
      }
    } finally {
      pendente = false;
    }
  }

  controle.addEventListener('change', atualizar, {signal:eventos.signal});
  documento.addEventListener('visibilitychange', atualizar, {signal:eventos.signal});
  function desmontar() {
    eventos.abort();
    liberar();
    controle.checked = false;
    status.textContent = '';
  }
  ambiente.addEventListener('pagehide', desmontarNaPagina, {signal:eventos.signal});
  function desmontarNaPagina() {
    controle.checked = false;
    void atualizar();
  }
  return desmontar;
}
