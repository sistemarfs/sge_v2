// ── DATA STORE LAYER (SUPABASE & LOCALSTORAGE) ──
const DataStore = {
  isSupabase: false,
  client: null,

  // Mapeamentos para Banco de Dados Relacional (camelCase -> snake_case)
  mappingEstampa: {
    id: 'id',
    ref: 'ref',
    nome: 'nome',
    tipo: 'tipo',
    status: 'status',
    dimensoes: 'dimensoes',
    ncores: 'ncores',
    artigo: 'artigo',
    tingimento: 'tingimento',
    tecnica: 'tecnica',
    mesh: 'mesh',
    obs: 'obs',
    codInterno: 'cod_interno',
    codEng: 'cod_eng',
    fornecedorGrav: 'fornecedor_grav',
    codGrav: 'cod_grav',
    fornecedorEst: 'fornecedor_est',
    codEst: 'cod_est',
    codExt: 'cod_ext',
    variante: 'variante',
    nCilindros: 'n_filter_cilindros', // Note: map columns appropriately
    nCilindros: 'n_cilindros',
    statusCil: 'status_cil',
    dtOrcamento: 'dt_orcamento',
    dtArte: 'dt_arte',
    dtMesa: 'dt_mesa',
    dtProducao: 'dt_producao',
    imagem: 'imagem',
    pantones: 'pantones',
    timelineEvts: 'timeline_evts'
  },

  mappingAmostra: {
    id: 'id',
    fornecedor: 'fornecedor',
    produto: 'produto',
    qtd: 'qtd',
    qtdMin: 'qtd_min',
    status: 'status',
    custo: 'custo',
    destino: 'destino',
    refCliente: 'ref_cliente',
    dataSol: 'data_sol',
    dataPrev: 'data_prev',
    obs: 'obs'
  },

  mapToDb(obj, mapping) {
    const dbObj = {};
    for (const [jsKey, dbKey] of Object.entries(mapping)) {
      if (obj[jsKey] !== undefined) {
        dbObj[dbKey] = obj[jsKey];
      }
    }
    return dbObj;
  },

  mapFromDb(dbObj, mapping) {
    const jsObj = {};
    for (const [jsKey, dbKey] of Object.entries(mapping)) {
      if (dbObj[dbKey] !== undefined) {
        jsObj[jsKey] = dbObj[dbKey];
      }
    }
    return jsObj;
  },

  async init() {
    const url = localStorage.getItem('SGE_supabase_url');
    const key = localStorage.getItem('SGE_supabase_key');
    if (url && key) {
      try {
        // Inicializa o cliente do Supabase
        this.client = supabase.createClient(url, key);
        this.isSupabase = true;
        console.log("Conectado ao Supabase!");
        updateConnectionStatus(true);
        return;
      } catch (e) {
        console.error("Erro ao inicializar cliente Supabase:", e);
        updateConnectionStatus(false, "Erro ao conectar. Verifique URL e Chave.");
        this.isSupabase = false;
        return;
      }
    }
    this.isSupabase = false;
    console.log("Usando LocalStorage (Modo Demo)");
    updateConnectionStatus(false);
  },

  async getEstampas() {
    if (this.isSupabase) {
      try {
        const { data, error } = await this.client.from('estampas').select('*').order('created_at', { ascending: false });
        if (error) throw error;
        return (data || []).map(row => this.mapFromDb(row, this.mappingEstampa));
      } catch (err) {
        console.error("Erro ao ler estampas do Supabase:", err);
        return [];
      }
    } else {
      return JSON.parse(localStorage.getItem('SGE_estampas') || '[]');
    }
  },

  async saveEstampa(estampa) {
    // Tratamento de imagem upload
    if (estampa.imageFile) {
      if (this.isSupabase) {
        try {
          const path = `estampas/${Date.now()}_${estampa.imageFile.name}`;
          estampa.imagem = await this.uploadImage(estampa.imageFile, path);
        } catch (err) {
          console.error("Erro no upload da imagem para o Supabase Storage:", err);
          alert("Não foi possível salvar a imagem no bucket 'estampas-imagens'. Verifique se o bucket existe e está configurado como público.");
        }
      } else {
        // Fallback local base64
        try {
          estampa.imagem = await this.fileToBase64(estampa.imageFile);
        } catch (err) {
          console.error("Erro ao converter imagem local:", err);
        }
      }
      delete estampa.imageFile;
    }

    if (this.isSupabase) {
      if (!estampa.id) {
        estampa.id = 'est_' + Math.random().toString(36).substring(2, 11) + '_' + Date.now();
      }
      const dbData = this.mapToDb(estampa, this.mappingEstampa);
      const { error } = await this.client.from('estampas').upsert(dbData);
      if (error) throw error;
      return estampa.id;
    } else {
      const list = await this.getEstampas();
      if (estampa.id) {
        const idx = list.findIndex(item => item.id == estampa.id);
        if (idx !== -1) {
          list[idx] = estampa;
        } else {
          list.push(estampa);
        }
      } else {
        estampa.id = Date.now();
        list.push(estampa);
      }
      localStorage.setItem('SGE_estampas', JSON.stringify(list));
      return estampa.id;
    }
  },

  async deleteEstampa(id) {
    if (this.isSupabase) {
      const { error } = await this.client.from('estampas').delete().eq('id', id);
      if (error) throw error;
    } else {
      let list = await this.getEstampas();
      list = list.filter(item => item.id != id);
      localStorage.setItem('SGE_estampas', JSON.stringify(list));
    }
  },

  async getAmostras() {
    if (this.isSupabase) {
      try {
        const { data, error } = await this.client.from('amostras').select('*').order('created_at', { ascending: false });
        if (error) throw error;
        return (data || []).map(row => this.mapFromDb(row, this.mappingAmostra));
      } catch (err) {
        console.error("Erro ao ler amostras do Supabase:", err);
        return [];
      }
    } else {
      return JSON.parse(localStorage.getItem('SGE_amostras') || '[]');
    }
  },

  async saveAmostra(amostra) {
    if (this.isSupabase) {
      if (!amostra.id) {
        amostra.id = 'amo_' + Math.random().toString(36).substring(2, 11) + '_' + Date.now();
      }
      const dbData = this.mapToDb(amostra, this.mappingAmostra);
      const { error } = await this.client.from('amostras').upsert(dbData);
      if (error) throw error;
      return amostra.id;
    } else {
      const list = await this.getAmostras();
      if (amostra.id) {
        const idx = list.findIndex(item => item.id == amostra.id);
        if (idx !== -1) {
          list[idx] = amostra;
        } else {
          list.push(amostra);
        }
      } else {
        amostra.id = Date.now();
        list.push(amostra);
      }
      localStorage.setItem('SGE_amostras', JSON.stringify(list));
      return amostra.id;
    }
  },

  async deleteAmostra(id) {
    if (this.isSupabase) {
      const { error } = await this.client.from('amostras').delete().eq('id', id);
      if (error) throw error;
    } else {
      let list = await this.getAmostras();
      list = list.filter(item => item.id != id);
      localStorage.setItem('SGE_amostras', JSON.stringify(list));
    }
  },

  // Upload Supabase Storage
  async uploadImage(file, path) {
    const { data, error } = await this.client.storage
      .from('estampas-imagens')
      .upload(path, file, {
        cacheControl: '3600',
        upsert: true
      });
    if (error) throw error;
    
    const { data: urlData } = this.client.storage
      .from('estampas-imagens')
      .getPublicUrl(path);
      
    return urlData.publicUrl;
  },

  // File to Base64 (LocalStorage fallback)
  fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = e => resolve(e.target.result);
      r.onerror = err => reject(err);
      r.readAsDataURL(file);
    });
  }
};

// ── GLOBAL STATE ──
let activePage = 'home';
let cacheEstampas = [];
let cacheAmostras = [];
let currentEstampaId = null;
let currentAmostraId = null;
let pantones = [];
let timelineEvts = [];
let selectedReportEstampa = null;

// ── APP INITIALIZATION ──
window.addEventListener('DOMContentLoaded', async () => {
  // Inicializa a conexão de dados (Supabase / LocalStorage)
  await DataStore.init();
  
  // Preenche dados do localStorage nos inputs de configurações, se existirem
  const savedUrl = localStorage.getItem('SGE_supabase_url');
  const savedKey = localStorage.getItem('SGE_supabase_key');
  if (savedUrl) document.getElementById('cfg-supabase-url').value = savedUrl;
  if (savedKey) document.getElementById('cfg-supabase-key').value = savedKey;
  
  // Carrega a página inicial e dados
  await refreshData();
  showPage('home');
});

// Atualiza caches de dados na memória local
async function refreshData() {
  cacheEstampas = await DataStore.getEstampas();
  cacheAmostras = await DataStore.getAmostras();
}

// ── NAV & ROUTING ──
function showPage(name) {
  activePage = name;
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  
  document.getElementById('page-' + name).classList.add('active');
  const nb = document.getElementById('nav-' + name);
  if (nb) nb.classList.add('active');
  
  refreshAndRenderPage(name);
}

async function refreshAndRenderPage(name) {
  await refreshData();
  if (name === 'home') renderHomeAlerts();
  if (name === 'estampas') renderEstampas();
  if (name === 'amostras') renderAmostras();
  if (name === 'followup') renderFollowup();
  if (name === 'relatorio') renderRelatorioSearch();
}

// ── MODALS CONTROL ──
function openModal(id) {
  document.getElementById(id).classList.add('open');
  if (id === 'modal-backup') {
    const el = document.getElementById('backup-stats-label');
    if (el) el.textContent = `Dados locais atuais: ${cacheEstampas.length} estampa(s) e ${cacheAmostras.length} amostra(s).`;
  }
}

function closeModal(id) {
  document.getElementById(id).classList.remove('open');
}

// Fecha modal clicando fora dele
document.querySelectorAll('.modal-overlay').forEach(m => {
  m.addEventListener('click', e => {
    if (e.target === m) m.classList.remove('open');
  });
});

// Abas internas de modais
function switchTab(tabId, btn) {
  const mb = btn.closest('.modal-body') || document;
  mb.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  btn.closest('.tabs').querySelectorAll('.tab').forEach(b => b.classList.remove('active'));
  
  document.getElementById(tabId).classList.add('active');
  btn.classList.add('active');
}

// ── CONNECTION STATUS ──
function updateConnectionStatus(isConnected, customMsg = null) {
  const badge = document.getElementById('connection-status-badge');
  const badgeText = badge.querySelector('.badge-text');
  const cfgStatus = document.getElementById('cfg-connection-status');
  
  if (isConnected) {
    badge.className = 'nav-badge connection-badge-firebase'; // Use green styling
    badgeText.textContent = 'Supabase';
    if (cfgStatus) {
      cfgStatus.innerHTML = `<span style="display:inline-block; width:8px; height:8px; border-radius:50%; background:var(--green)"></span> Conectado com sucesso ao banco PostgreSQL & Storage do Supabase.`;
    }
  } else {
    badge.className = 'nav-badge connection-badge-demo';
    badgeText.textContent = 'Modo Demo';
    if (cfgStatus) {
      if (customMsg) {
        cfgStatus.innerHTML = `<span style="display:inline-block; width:8px; height:8px; border-radius:50%; background:var(--red)"></span> ${customMsg}`;
      } else {
        cfgStatus.innerHTML = `<span style="display:inline-block; width:8px; height:8px; border-radius:50%; background:var(--yellow)"></span> Usando armazenamento local do navegador (LocalStorage).`;
      }
    }
  }
}

// ── IMAGE PREVIEW ──
function previewImage(input, previewId) {
  const file = input.files[0];
  if (!file) return;
  const r = new FileReader();
  r.onload = e => {
    const p = document.getElementById(previewId);
    p.src = e.target.result;
    p.style.display = 'block';
  };
  r.readAsDataURL(file);
}

// ── SUPABASE CONFIGURATION OPERATIONS ──
async function saveSupabaseConfig() {
  const url = document.getElementById('cfg-supabase-url').value.trim();
  const key = document.getElementById('cfg-supabase-key').value.trim();
  
  if (!url || !key) {
    alert("Insira a URL e a Anon Key do Supabase.");
    return;
  }
  
  localStorage.setItem('SGE_supabase_url', url);
  localStorage.setItem('SGE_supabase_key', key);
  
  alert("Configurações salvas! O aplicativo será recarregado para se conectar.");
  window.location.reload();
}

function clearSupabaseConfig() {
  if (confirm("Deseja realmente limpar as credenciais do Supabase e voltar para o Modo Demo local?")) {
    localStorage.removeItem('SGE_supabase_url');
    localStorage.removeItem('SGE_supabase_key');
    alert("Configuração removida. O aplicativo será recarregado.");
    window.location.reload();
  }
}

// ── PANTONES STATE ──
function addPantone(p = {}) {
  pantones.push({
    id: Date.now() + Math.random(),
    nome: p.nome || '',
    receita: p.receita || '',
    cor: p.cor || '#1B3A5C'
  });
  renderPantones();
}

function renderPantones() {
  const el = document.getElementById('pantones-list');
  if (!pantones.length) {
    el.innerHTML = '<p style="color:var(--ink3);font-size:13px;padding: 10px 0;">Nenhuma cor ou pantone cadastrado.</p>';
    return;
  }
  el.innerHTML = pantones.map((p, i) => `
    <div style="display:flex;gap:8px;align-items:center;margin-bottom:8px;background:var(--bg);padding:8px;border-radius:7px">
      <input type="color" value="${p.cor}" onchange="pantones[${i}].cor=this.value" style="width:34px;height:34px;border:none;cursor:pointer;border-radius:5px;background:transparent">
      <input type="text" class="form-input" placeholder="Pantone / Nome" value="${p.nome}" oninput="pantones[${i}].nome=this.value" style="flex:1">
      <input type="text" class="form-input" placeholder="Receita / Proporção" value="${p.receita}" oninput="pantones[${i}].receita=this.value" style="flex:2">
      <button class="btn btn-danger btn-sm" onclick="pantones.splice(${i},1);renderPantones()">✕</button>
    </div>`).join('');
}

// ── TIMELINE STATE ──
function addTimelineEvt(ev = {}) {
  timelineEvts.push({
    id: Date.now() + Math.random(),
    data: ev.data || new Date().toISOString().slice(0, 10),
    descricao: ev.descricao || '',
    tipo: ev.tipo || 'info'
  });
  renderTimelineModal();
}

function renderTimelineModal() {
  const el = document.getElementById('timeline-list-modal');
  if (!timelineEvts.length) {
    el.innerHTML = '<p style="color:var(--ink3);font-size:13px;padding: 10px 0;">Nenhum evento histórico adicionado.</p>';
    return;
  }
  el.innerHTML = timelineEvts.map((ev, i) => `
    <div style="display:flex;gap:8px;align-items:center;margin-bottom:8px;background:var(--bg);padding:8px;border-radius:7px">
      <input type="date" class="form-input" value="${ev.data}" onchange="timelineEvts[${i}].data=this.value" style="width:130px">
      <input type="text" class="form-input" placeholder="Ex: Envios de Amostra, Ajustes..." value="${ev.descricao}" oninput="timelineEvts[${i}].descricao=this.value" style="flex:1">
      <select class="form-input" onchange="timelineEvts[${i}].tipo=this.value" style="width:120px">
        <option value="info" ${ev.tipo === 'info' ? 'selected' : ''}>ℹ️ Info</option>
        <option value="ok" ${ev.tipo === 'ok' ? 'selected' : ''}>🟢 Aprovado</option>
        <option value="warn" ${ev.tipo === 'warn' ? 'selected' : ''}>🟡 Alerta</option>
        <option value="alert" ${ev.tipo === 'alert' ? 'selected' : ''}>🔴 Reprovado</option>
      </select>
      <button class="btn btn-danger btn-sm" onclick="timelineEvts.splice(${i},1);renderTimelineModal()">✕</button>
    </div>`).join('');
}

// ── CRUD ESTAMPAS ──
function openNovaEstampa() {
  currentEstampaId = null;
  pantones = [];
  timelineEvts = [];
  
  // Limpa campos do formulário
  document.getElementById('e-ref').value = '';
  document.getElementById('e-nome').value = '';
  document.getElementById('e-tipo').value = '';
  document.getElementById('e-status').value = 'Em andamento';
  document.getElementById('e-dimensoes').value = '';
  document.getElementById('e-ncores').value = '';
  document.getElementById('e-artigo').value = '';
  document.getElementById('e-tingimento').value = '';
  document.getElementById('e-tecnica').value = '';
  document.getElementById('e-mesh').value = '';
  document.getElementById('e-obs').value = '';
  
  document.getElementById('e-cod-interno').value = '';
  document.getElementById('e-cod-eng').value = '';
  document.getElementById('e-fornecedor-grav').value = '';
  document.getElementById('e-cod-grav').value = '';
  document.getElementById('e-fornecedor-est').value = '';
  document.getElementById('e-cod-est').value = '';
  document.getElementById('e-cod-ext').value = '';
  document.getElementById('e-variante').value = '';
  
  document.getElementById('e-n-cilindros').value = '';
  document.getElementById('e-status-cil').value = 'Em gravação';
  
  document.getElementById('e-dt-orcamento').value = '';
  document.getElementById('e-dt-arte').value = '';
  document.getElementById('e-dt-mesa').value = '';
  document.getElementById('e-dt-producao').value = '';
  
  // Limpa imagem
  document.getElementById('e-img-input').value = '';
  const p = document.getElementById('e-img-preview');
  p.src = '';
  p.style.display = 'none';

  document.getElementById('estampa-modal-title').textContent = "Nova Estampa";
  
  // Reset tabs
  const tabBtn = document.querySelector('.tabs .tab');
  switchTab('tab-dados', tabBtn);
  renderPantones();
  renderTimelineModal();
  
  openModal('modal-estampa');
}

async function saveEstampa() {
  const ref = document.getElementById('e-ref').value.trim();
  const tipo = document.getElementById('e-tipo').value;
  
  if (!ref || !tipo) {
    alert("Os campos 'Referência Interna' e 'Tipo de Estampa' são obrigatórios!");
    return;
  }

  // Monta objeto
  const estampa = {
    ref,
    nome: document.getElementById('e-nome').value.trim(),
    tipo,
    status: document.getElementById('e-status').value,
    dimensoes: document.getElementById('e-dimensoes').value.trim(),
    ncores: document.getElementById('e-ncores').value ? parseInt(document.getElementById('e-ncores').value) : null,
    artigo: document.getElementById('e-artigo').value.trim(),
    tingimento: document.getElementById('e-tingimento').value.trim(),
    tecnica: document.getElementById('e-tecnica').value.trim(),
    mesh: document.getElementById('e-mesh').value.trim(),
    obs: document.getElementById('e-obs').value.trim(),
    
    codInterno: document.getElementById('e-cod-interno').value.trim(),
    codEng: document.getElementById('e-cod-eng').value.trim(),
    fornecedorGrav: document.getElementById('e-fornecedor-grav').value.trim(),
    codGrav: document.getElementById('e-cod-grav').value.trim(),
    fornecedorEst: document.getElementById('e-fornecedor-est').value.trim(),
    codEst: document.getElementById('e-cod-est').value.trim(),
    codExt: document.getElementById('e-cod-ext').value.trim(),
    variante: document.getElementById('e-variante').value.trim(),
    
    nCilindros: document.getElementById('e-n-cilindros').value ? parseInt(document.getElementById('e-n-cilindros').value) : 0,
    statusCil: document.getElementById('e-status-cil').value,
    
    dtOrcamento: document.getElementById('e-dt-orcamento').value,
    dtArte: document.getElementById('e-dt-arte').value,
    dtMesa: document.getElementById('e-dt-mesa').value,
    dtProducao: document.getElementById('e-dt-producao').value,
    
    pantones,
    timelineEvts
  };

  if (currentEstampaId) {
    estampa.id = currentEstampaId;
    const old = cacheEstampas.find(e => e.id == currentEstampaId);
    if (old && old.imagem) estampa.imagem = old.imagem;
  }

  const imgInput = document.getElementById('e-img-input');
  if (imgInput.files && imgInput.files[0]) {
    estampa.imageFile = imgInput.files[0];
  }

  closeModal('modal-estampa');
  await DataStore.saveEstampa(estampa);
  await refreshAndRenderPage('estampas');
}

async function editEstampa(id) {
  currentEstampaId = id;
  const estampa = cacheEstampas.find(e => e.id == id);
  if (!estampa) return;

  // Preenche dados
  document.getElementById('e-ref').value = estampa.ref || '';
  document.getElementById('e-nome').value = estampa.nome || '';
  document.getElementById('e-tipo').value = estampa.tipo || '';
  document.getElementById('e-status').value = estampa.status || 'Em andamento';
  document.getElementById('e-dimensoes').value = estampa.dimensoes || '';
  document.getElementById('e-ncores').value = estampa.ncores || '';
  document.getElementById('e-artigo').value = estampa.artigo || '';
  document.getElementById('e-tingimento').value = estampa.tingimento || '';
  document.getElementById('e-tecnica').value = estampa.tecnica || '';
  document.getElementById('e-mesh').value = estampa.mesh || '';
  document.getElementById('e-obs').value = estampa.obs || '';
  
  document.getElementById('e-cod-interno').value = estampa.codInterno || '';
  document.getElementById('e-cod-eng').value = estampa.codEng || '';
  document.getElementById('e-fornecedor-grav').value = estampa.fornecedorGrav || '';
  document.getElementById('e-cod-grav').value = estampa.codGrav || '';
  document.getElementById('e-fornecedor-est').value = estampa.fornecedorEst || '';
  document.getElementById('e-cod-est').value = estampa.codEst || '';
  document.getElementById('e-cod-ext').value = estampa.codExt || '';
  document.getElementById('e-variante').value = estampa.variante || '';
  
  document.getElementById('e-n-cilindros').value = estampa.nCilindros || '';
  document.getElementById('e-status-cil').value = estampa.statusCil || 'Em gravação';
  
  document.getElementById('e-dt-orcamento').value = estampa.dtOrcamento || '';
  document.getElementById('e-dt-arte').value = estampa.dtArte || '';
  document.getElementById('e-dt-mesa').value = estampa.dtMesa || '';
  document.getElementById('e-dt-producao').value = estampa.dtProducao || '';

  // Configura imagem
  document.getElementById('e-img-input').value = '';
  const p = document.getElementById('e-img-preview');
  if (estampa.imagem) {
    p.src = estampa.imagem;
    p.style.display = 'block';
  } else {
    p.src = '';
    p.style.display = 'none';
  }

  pantones = estampa.pantones ? [...estampa.pantones] : [];
  timelineEvts = estampa.timelineEvts ? [...estampa.timelineEvts] : [];

  document.getElementById('estampa-modal-title').textContent = "Editar Estampa — Ref " + estampa.ref;
  
  // Abre na primeira aba
  const tabBtn = document.querySelector('.tabs .tab');
  switchTab('tab-dados', tabBtn);
  renderPantones();
  renderTimelineModal();
  
  closeModal('modal-detalhe');
  openModal('modal-estampa');
}

async function removeEstampa(id) {
  if (confirm("Deseja realmente excluir esta estampa? Todos os dados vinculados a ela serão removidos.")) {
    closeModal('modal-detalhe');
    await DataStore.deleteEstampa(id);
    await refreshAndRenderPage('estampas');
  }
}

// ── CRUD AMOSTRAS ──
function openNovaAmostra() {
  currentAmostraId = null;
  document.getElementById('a-fornecedor').value = '';
  document.getElementById('a-produto').value = '';
  document.getElementById('a-qtd').value = '';
  document.getElementById('a-qtd-min').value = '';
  document.getElementById('a-status').value = 'Solicitada';
  document.getElementById('a-custo').value = '';
  document.getElementById('a-destino').value = 'Referência de cliente';
  document.getElementById('a-ref-cliente').value = '';
  document.getElementById('a-data-sol').value = new Date().toISOString().slice(0, 10);
  document.getElementById('a-data-prev').value = '';
  document.getElementById('a-obs').value = '';

  document.getElementById('amostra-modal-title').textContent = "Solicitar Nova Amostra";
  openModal('modal-amostra');
}

async function saveAmostra() {
  const fornecedor = document.getElementById('a-fornecedor').value.trim();
  const produto = document.getElementById('a-produto').value.trim();
  
  if (!fornecedor || !produto) {
    alert("Os campos 'Fornecedor' e 'Produto/Descrição' são obrigatórios!");
    return;
  }

  const amostra = {
    fornecedor,
    produto,
    qtd: document.getElementById('a-qtd').value.trim(),
    qtdMin: document.getElementById('a-qtd-min').value.trim(),
    status: document.getElementById('a-status').value,
    custo: document.getElementById('a-custo').value ? parseFloat(document.getElementById('a-custo').value) : null,
    destino: document.getElementById('a-destino').value,
    refCliente: document.getElementById('a-ref-cliente').value.trim(),
    dataSol: document.getElementById('a-data-sol').value,
    dataPrev: document.getElementById('a-data-prev').value,
    obs: document.getElementById('a-obs').value.trim()
  };

  if (currentAmostraId) {
    amostra.id = currentAmostraId;
  }

  closeModal('modal-amostra');
  await DataStore.saveAmostra(amostra);
  await refreshAndRenderPage('amostras');
}

function editAmostra(id) {
  currentAmostraId = id;
  const amostra = cacheAmostras.find(a => a.id == id);
  if (!amostra) return;

  document.getElementById('a-fornecedor').value = amostra.fornecedor || '';
  document.getElementById('a-produto').value = amostra.produto || '';
  document.getElementById('a-qtd').value = amostra.qtd || '';
  document.getElementById('a-qtd-min').value = amostra.qtdMin || '';
  document.getElementById('a-status').value = amostra.status || 'Solicitada';
  document.getElementById('a-custo').value = amostra.custo || '';
  document.getElementById('a-destino').value = amostra.destino || 'Referência de cliente';
  document.getElementById('a-ref-cliente').value = amostra.refCliente || '';
  document.getElementById('a-data-sol').value = amostra.dataSol || '';
  document.getElementById('a-data-prev').value = amostra.dataPrev || '';
  document.getElementById('a-obs').value = amostra.obs || '';

  document.getElementById('amostra-modal-title').textContent = "Editar Detalhes da Amostra";
  openModal('modal-amostra');
}

async function removeAmostra(id) {
  if (confirm("Deseja deletar esta amostra?")) {
    await DataStore.deleteAmostra(id);
    await refreshAndRenderPage('amostras');
  }
}

// ── RENDER: ESTAMPAS ──
function renderEstampas() {
  const query = document.getElementById('search-estampas').value.toLowerCase().trim();
  const filterTipo = document.getElementById('filter-tipo').value;
  const filterStatus = document.getElementById('filter-status').value;
  const filterTecnica = document.getElementById('filter-tecnica').value.toLowerCase().trim();
  const filterArtigo = document.getElementById('filter-artigo').value.toLowerCase().trim();
  const filterRapport = document.getElementById('filter-rapport').value.trim();

  // Aplica filtros
  const filtered = cacheEstampas.filter(e => {
    const matchQuery = !query || 
      (e.ref && e.ref.toLowerCase().includes(query)) ||
      (e.nome && e.nome.toLowerCase().includes(query)) ||
      (e.codInterno && e.codInterno.toLowerCase().includes(query)) ||
      (e.codEng && e.codEng.toLowerCase().includes(query)) ||
      (e.fornecedorEst && e.fornecedorEst.toLowerCase().includes(query)) ||
      (e.fornecedorGrav && e.fornecedorGrav.toLowerCase().includes(query)) ||
      (e.tecnica && e.tecnica.toLowerCase().includes(query)) ||
      (e.artigo && e.artigo.toLowerCase().includes(query)) ||
      (e.pantones && e.pantones.some(p => p.nome.toLowerCase().includes(query)));

    const matchTipo = !filterTipo || e.tipo === filterTipo;
    const matchStatus = !filterStatus || e.status === filterStatus;
    const matchTecnica = !filterTecnica || (e.tecnica && e.tecnica.toLowerCase().includes(filterTecnica));
    const matchArtigo = !filterArtigo || (e.artigo && e.artigo.toLowerCase().includes(filterArtigo));
    const matchRapport = !filterRapport || (e.dimensoes && e.dimensoes.toLowerCase().includes(filterRapport));

    return matchQuery && matchTipo && matchStatus && matchTecnica && matchArtigo && matchRapport;
  });

  // Renderiza Grid de Cards
  const grid = document.getElementById('estampas-grid');
  if (!filtered.length) {
    grid.innerHTML = `
      <div class="empty" style="grid-column: 1/-1">
        <div class="empty-icon">🎨</div>
        <p>Nenhuma estampa cadastrada ou encontrada para os filtros aplicados.</p>
      </div>`;
  } else {
    grid.innerHTML = filtered.map(e => {
      let statusClass = 'tag-status-ok';
      if (e.status === 'Aguardando' || e.status === 'Em andamento') statusClass = 'tag-status-pending';
      if (e.status === 'Reprovada') statusClass = 'tag-status-alert';
      
      const imgHtml = e.imagem 
        ? `<img src="${e.imagem}" alt="Estampa Ref ${e.ref}">`
        : `<span>Sem Imagem</span>`;

      return `
        <div class="stamp-card" onclick="openDetalheEstampa('${e.id}')">
          <div class="stamp-card-img">${imgHtml}</div>
          <div class="stamp-card-body">
            <span class="stamp-card-ref">REF ${e.ref}</span>
            <h4 class="stamp-card-name">${e.nome || 'Sem nome'}</h4>
            <div class="stamp-card-tags">
              <span class="tag tag-type">${e.tipo}</span>
              <span class="tag ${statusClass}">${e.status}</span>
            </div>
          </div>
        </div>`;
    }).join('');
  }

  // Renderiza Estatísticas
  const total = cacheEstampas.length;
  const aprovadas = cacheEstampas.filter(e => e.status === 'Aprovada').length;
  const aguardando = cacheEstampas.filter(e => e.status === 'Aguardando' || e.status === 'Em andamento').length;
  const emGravacao = cacheEstampas.filter(e => e.statusCil === 'Em gravação').length;

  document.getElementById('stats-estampas').innerHTML = `
    <div class="stat-mini">
      <div class="stat-mini-val">${total}</div>
      <div class="stat-mini-label">Total Cadastrado</div>
    </div>
    <div class="stat-mini">
      <div class="stat-mini-val" style="color:var(--green)">${aprovadas}</div>
      <div class="stat-mini-label">Aprovadas</div>
    </div>
    <div class="stat-mini">
      <div class="stat-mini-val" style="color:var(--yellow)">${aguardando}</div>
      <div class="stat-mini-label">Em Aprovação</div>
    </div>
    <div class="stat-mini">
      <div class="stat-mini-val" style="color:var(--navy)">${emGravacao}</div>
      <div class="stat-mini-label">Cilindros Gravando</div>
    </div>`;

  renderActiveFilters();
}

function renderActiveFilters() {
  const container = document.getElementById('active-filters');
  const filters = [];
  
  const tipo = document.getElementById('filter-tipo').value;
  const status = document.getElementById('filter-status').value;
  const tecnica = document.getElementById('filter-tecnica').value.trim();
  const artigo = document.getElementById('filter-artigo').value.trim();
  const rapport = document.getElementById('filter-rapport').value.trim();

  if (tipo) filters.push({ key: 'tipo', label: `Tipo: ${tipo}`, elId: 'filter-tipo' });
  if (status) filters.push({ key: 'status', label: `Status: ${status}`, elId: 'filter-status' });
  if (tecnica) filters.push({ key: 'tecnica', label: `Téc: ${tecnica}`, elId: 'filter-tecnica' });
  if (artigo) filters.push({ key: 'artigo', label: `Art: ${artigo}`, elId: 'filter-artigo' });
  if (rapport) filters.push({ key: 'rapport', label: `Rap: ${rapport}cm`, elId: 'filter-rapport' });

  if (!filters.length) {
    container.innerHTML = '';
    return;
  }

  container.innerHTML = filters.map(f => `
    <span class="search-tag">
      ${f.label}
      <button onclick="clearFilterField('${f.elId}')">✕</button>
    </span>`).join('');
}

function clearFilterField(elId) {
  const el = document.getElementById(elId);
  el.value = '';
  renderEstampas();
}

function clearFilters() {
  document.getElementById('search-estampas').value = '';
  document.getElementById('filter-tipo').value = '';
  document.getElementById('filter-status').value = '';
  document.getElementById('filter-tecnica').value = '';
  document.getElementById('filter-artigo').value = '';
  document.getElementById('filter-rapport').value = '';
  renderEstampas();
}

// ── DETAIL ESTAMPA MODAL ──
function openDetalheEstampa(id) {
  const estampa = cacheEstampas.find(e => e.id == id);
  if (!estampa) return;

  const el = document.getElementById('detalhe-body');
  
  const imgHtml = estampa.imagem
    ? `<div class="report-img" style="max-height: 280px;"><img src="${estampa.imagem}" alt="Estampa REF ${estampa.ref}"></div>`
    : `<div class="report-img">Sem imagem cadastrada</div>`;

  let statusBadge = '<span class="tag tag-status-ok">Aprovada</span>';
  if (estampa.status === 'Aguardando' || estampa.status === 'Em andamento') statusBadge = '<span class="tag tag-status-pending">Aguardando</span>';
  if (estampa.status === 'Reprovada') statusBadge = '<span class="tag tag-status-alert">Reprovada</span>';

  const pantonesHtml = estampa.pantones && estampa.pantones.length
    ? `<div class="color-swatches">` + estampa.pantones.map(p => `
        <div class="swatch-item">
          <div class="swatch" style="background: ${p.cor}"></div>
          <span><strong>${p.nome}</strong> ${p.receita ? `(${p.receita})` : ''}</span>
        </div>`).join('') + `</div>`
    : `<p style="font-size:13px;color:var(--ink3)">Nenhuma cor mapeada.</p>`;

  let timelineHtml = `<p style="font-size:13px;color:var(--ink3)">Nenhum evento registrado.</p>`;
  if (estampa.timelineEvts && estampa.timelineEvts.length) {
    const sorted = [...estampa.timelineEvts].sort((a,b) => b.data.localeCompare(a.data));
    timelineHtml = `<div class="timeline">` + sorted.map(ev => {
      let dotColor = '';
      if (ev.tipo === 'ok') dotColor = 'green';
      if (ev.tipo === 'warn') dotColor = 'yellow';
      if (ev.tipo === 'alert') dotColor = 'red';
      
      const parts = ev.data.split('-');
      const formattedDate = parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : ev.data;

      return `
        <div class="timeline-item">
          <div class="timeline-dot ${dotColor}"></div>
          <div class="timeline-date">${formattedDate}</div>
          <div class="timeline-content">
            <strong>${ev.descricao}</strong>
          </div>
        </div>`;
    }).join('') + `</div>`;
  }

  el.innerHTML = `
    <div style="display:grid;grid-template-columns: 1fr 1fr; gap:20px; margin-bottom:18px;">
      <div>
        ${imgHtml}
        <div class="section-title">Dados Gerais</div>
        <div class="report-grid">
          <div class="report-field"><label>Nome</label><p>${estampa.nome || '—'}</p></div>
          <div class="report-field"><label>Tipo</label><p>${estampa.tipo}</p></div>
          <div class="report-field"><label>Status</label><p>${statusBadge}</p></div>
          <div class="report-field"><label>Rapport</label><p>${estampa.dimensoes || '—'}</p></div>
          <div class="report-field"><label>Nº de Cores</label><p>${estampa.ncores || '—'}</p></div>
          <div class="report-field"><label>Artigo</label><p>${estampa.artigo || '—'}</p></div>
          <div class="report-field"><label>Base Tingimento</label><p>${estampa.tingimento || '—'}</p></div>
          <div class="report-field"><label>Técnica</label><p>${estampa.tecnica || '—'}</p></div>
          <div class="report-field"><label>Mesh do Cilindro</label><p>${estampa.mesh || '—'}</p></div>
        </div>
      </div>
      <div>
        <div class="section-title" style="margin-top:0">Relação de Pantones</div>
        ${pantonesHtml}
        
        <div class="section-title">Codificações & Fornecedores</div>
        <div class="report-codes">
          <div class="code-row"><span class="code-label">Cód. Interno</span><span class="code-val">${estampa.codInterno || '—'}</span></div>
          <div class="code-row"><span class="code-label">Cód. Engenharia</span><span class="code-val">${estampa.codEng || '—'}</span></div>
          <div class="code-row"><span class="code-label">Gravadora / Cód. Gravadora</span><span class="code-val">${estampa.fornecedorGrav || '—'} / ${estampa.codGrav || '—'}</span></div>
          <div class="code-row"><span class="code-label">Estamparia / Cód. Estamparia</span><span class="code-val">${estampa.fornecedorEst || '—'} / ${estampa.codEst || '—'}</span></div>
          <div class="code-row"><span class="code-label">Cod. Externo (Cliente) / Var.</span><span class="code-val">${estampa.codExt || '—'} / Var ${estampa.variante || '—'}</span></div>
          <div class="code-row"><span class="code-label">Status Cilindros / Qtd</span><span class="code-val">${estampa.statusCil || '—'} (${estampa.nCilindros || 0} cil.)</span></div>
        </div>
        
        <div class="section-title">Histórico de Eventos</div>
        ${timelineHtml}
        
        <div class="section-title">Observações</div>
        <p style="font-size:12px;color:var(--ink2);line-height:1.55;white-space:pre-wrap;background:var(--bg);padding:10px;border-radius:8px;border:1px solid var(--border)">${estampa.obs || 'Nenhuma observação cadastrada.'}</p>
      </div>
    </div>`;

  document.getElementById('detalhe-del-btn').onclick = () => removeEstampa(estampa.id);
  document.getElementById('detalhe-edit-btn').onclick = () => editEstampa(estampa.id);

  openModal('modal-detalhe');
}

// ── RENDER: AMOSTRAS ──
function renderAmostras() {
  const query = document.getElementById('search-amostras').value.toLowerCase().trim();
  const filterStatus = document.getElementById('filter-amostra-status').value;

  const filtered = cacheAmostras.filter(a => {
    const matchQuery = !query ||
      (a.fornecedor && a.fornecedor.toLowerCase().includes(query)) ||
      (a.produto && a.produto.toLowerCase().includes(query)) ||
      (a.destino && a.destino.toLowerCase().includes(query)) ||
      (a.refCliente && a.refCliente.toLowerCase().includes(query));

    const matchStatus = !filterStatus || a.status === filterStatus;

    return matchQuery && matchStatus;
  });

  const tbody = document.getElementById('amostras-tbody');
  if (!filtered.length) {
    tbody.innerHTML = `<tr><td colspan="8" class="empty" style="padding: 30px;"><div class="empty-icon">🧪</div><p>Nenhuma solicitação de amostra encontrada.</p></td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(a => {
    let statusClass = 'tag-status-ok';
    if (a.status === 'Solicitada' || a.status === 'Aguardando') statusClass = 'tag-status-pending';
    if (a.status === 'Reprovada') statusClass = 'tag-status-alert';

    const custoFmt = a.custo ? `R$ ${a.custo.toFixed(2)}` : 'R$ 0,00';
    const fDataSol = formatInputDate(a.dataSol);
    const fDataPrev = formatInputDate(a.dataPrev);

    return `
      <tr>
        <td><strong>${a.fornecedor}</strong></td>
        <td>${a.produto} ${a.refCliente ? `<br><small style="color:var(--ink3)">Ref Cliente: ${a.refCliente}</small>` : ''}</td>
        <td>${a.qtd || '—'}</td>
        <td><span class="tag tag-type">${a.destino}</span></td>
        <td><span class="tag ${statusClass}">${a.status}</span></td>
        <td>${custoFmt}</td>
        <td>
          <div style="font-size:11px;line-height:1.4">
            Solic.: ${fDataSol || '—'}<br>
            Prev.: <strong>${fDataPrev || '—'}</strong>
          </div>
        </td>
        <td class="actions">
          <button class="btn btn-ghost btn-sm" onclick="editAmostra('${a.id}')" title="Editar">✏️</button>
          <button class="btn btn-danger btn-sm" onclick="removeAmostra('${a.id}')" title="Excluir">✕</button>
        </td>
      </tr>`;
  }).join('');
}

function formatInputDate(dateStr) {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : dateStr;
}

// ── RENDER: FOLLOW-UP ──
function renderFollowup() {
  const today = new Date();
  today.setHours(0,0,0,0);
  
  const next7Days = new Date();
  next7Days.setDate(today.getDate() + 7);
  next7Days.setHours(23,59,59,999);

  const colOverdue = [];
  const colSoon = [];
  const colOk = [];
  const colInfo = [];

  cacheAmostras.forEach(a => {
    const cardData = {
      tipo: 'amostra',
      id: a.id,
      title: `${a.fornecedor} — Amostra`,
      sub: a.produto,
      data: a.dataPrev,
      status: a.status
    };

    if (a.status === 'Aprovada') {
      colOk.push(cardData);
    } else if (a.dataPrev) {
      const prevDate = new Date(a.dataPrev);
      if (prevDate < today) {
        colOverdue.push(cardData);
      } else if (prevDate <= next7Days) {
        colSoon.push(cardData);
      } else {
        colInfo.push(cardData);
      }
    } else {
      colInfo.push(cardData);
    }
  });

  cacheEstampas.forEach(e => {
    const cardData = {
      tipo: 'estampa',
      id: e.id,
      title: `Estampa Ref ${e.ref}`,
      sub: `${e.nome || ''} (${e.tipo})`,
      data: e.dtProducao || e.dtMesa || e.dtArte || '',
      status: e.status
    };

    if (e.status === 'Aprovada') {
      colOk.push(cardData);
    } else if (e.status === 'Reprovada') {
      colOverdue.push(cardData);
    } else if (e.status === 'Em andamento' || e.status === 'Aguardando') {
      const checkDateStr = e.dtProducao || e.dtMesa || e.dtArte;
      if (checkDateStr) {
        const checkDate = new Date(checkDateStr);
        if (checkDate < today) {
          colOverdue.push(cardData);
        } else if (checkDate <= next7Days) {
          colSoon.push(cardData);
        } else {
          colInfo.push(cardData);
        }
      } else {
        colInfo.push(cardData);
      }
    }
  });

  const colsContainer = document.getElementById('fu-columns');
  
  const renderColumnCards = (cards, badgeClass, label) => {
    const listHtml = cards.length 
      ? cards.map(c => {
          let cardTypeClass = 'fu-info';
          if (badgeClass === 'red') cardTypeClass = 'fu-overdue';
          if (badgeClass === 'yellow') cardTypeClass = 'fu-soon';
          if (badgeClass === 'green') cardTypeClass = 'fu-ok';
          
          let dateStr = c.data ? formatInputDate(c.data) : 'Sem data';
          const clickFn = c.tipo === 'estampa' ? `openDetalheEstampa('${c.id}')` : `editAmostra('${c.id}')`;

          return `
            <div class="fu-card ${cardTypeClass}" onclick="${clickFn}">
              <div class="fu-card-title">${c.title}</div>
              <div class="fu-card-sub">${c.sub}</div>
              <div class="fu-card-date ${badgeClass}">
                ⏱️ ${dateStr} <span style="margin-left:auto;font-size:10px;text-transform:uppercase;">${c.tipo}</span>
              </div>
            </div>`;
        }).join('')
      : `<div class="fu-empty">Nenhuma pendência.</div>`;

    return `
      <div class="followup-col">
        <div class="followup-col-title">
          <span>${label}</span>
          <span class="badge tag-status-${badgeClass === 'green' ? 'ok' : (badgeClass === 'yellow' ? 'pending' : 'alert')}">${cards.length}</span>
        </div>
        ${listHtml}
      </div>`;
  };

  colsContainer.innerHTML = 
    renderColumnCards(colOverdue, 'red', 'Atrasados / Críticos') +
    renderColumnCards(colSoon, 'yellow', 'Em Breve (7 dias)') +
    renderColumnCards(colInfo, 'navy', 'Acompanhamento') +
    renderColumnCards(colOk, 'green', 'Finalizados');

  const totalAmostras = cacheAmostras.length;
  const amostrasAprovadas = cacheAmostras.filter(a => a.status === 'Aprovada').length;
  const amostrasAtrasadas = colOverdue.filter(c => c.tipo === 'amostra').length;
  const custoTotal = cacheAmostras.reduce((acc, curr) => acc + (curr.custo || 0), 0);

  document.getElementById('fu-kpis').innerHTML = `
    <div class="fu-kpi navy">
      <div class="fu-kpi-val">${totalAmostras}</div>
      <div class="fu-kpi-label">Amostras Pedidas</div>
    </div>
    <div class="fu-kpi green">
      <div class="fu-kpi-val">${amostrasAprovadas}</div>
      <div class="fu-kpi-label">Amostras Aprovadas</div>
    </div>
    <div class="fu-kpi red">
      <div class="fu-kpi-val">${amostrasAtrasadas}</div>
      <div class="fu-kpi-label">Amostras Atrasadas</div>
    </div>
    <div class="fu-kpi navy">
      <div class="fu-kpi-val">R$ ${custoTotal.toFixed(0)}</div>
      <div class="fu-kpi-label">Investimento</div>
    </div>`;
}

// ── RENDER: RELATÓRIO ──
function renderRelatorioSearch() {
  const query = document.getElementById('rel-search').value.toLowerCase().trim();
  const container = document.getElementById('rel-results');
  
  if (!query) {
    container.innerHTML = `<p style="color:var(--ink3);grid-column:1/-1;font-size:13px">Digite na busca acima para selecionar a estampa do relatório técnico.</p>`;
    return;
  }

  const filtered = cacheEstampas.filter(e => {
    return (e.ref && e.ref.toLowerCase().includes(query)) ||
      (e.nome && e.nome.toLowerCase().includes(query)) ||
      (e.codInterno && e.codInterno.toLowerCase().includes(query)) ||
      (e.artigo && e.artigo.toLowerCase().includes(query));
  });

  if (!filtered.length) {
    container.innerHTML = `<p style="color:var(--ink3);grid-column:1/-1;font-size:13px">Nenhuma estampa correspondente.</p>`;
    return;
  }

  container.innerHTML = filtered.map(e => `
    <button class="btn btn-ghost" onclick="selectReportEstampa('${e.id}')" style="text-align:left;display:block;width:100%;justify-content:flex-start;">
      <strong>REF ${e.ref}</strong> — ${e.nome || 'Sem nome'} (${e.tipo})
    </button>`).join('');
}

function selectReportEstampa(id) {
  const estampa = cacheEstampas.find(e => e.id == id);
  if (!estampa) return;
  
  selectedReportEstampa = estampa;
  document.getElementById('rel-results').innerHTML = '';
  document.getElementById('rel-search').value = `REF ${estampa.ref} — ${estampa.nome || ''}`;

  const reportContainer = document.getElementById('rel-report');
  const imgHtml = estampa.imagem
    ? `<img src="${estampa.imagem}" alt="Estampa REF ${estampa.ref}">`
    : `<span>Nenhuma imagem anexada</span>`;

  const pantonesHtml = estampa.pantones && estampa.pantones.length
    ? `<div class="color-swatches" style="margin-top: 10px;">` + estampa.pantones.map(p => `
        <div class="swatch-item">
          <div class="swatch" style="background: ${p.cor}"></div>
          <span><strong>${p.nome}</strong> ${p.receita ? `(${p.receita})` : ''}</span>
        </div>`).join('') + `</div>`
    : `<p style="font-size:13px;color:var(--ink3)">Nenhum pantone associado.</p>`;

  reportContainer.innerHTML = `
    <div class="report-card">
      <div class="report-header-band">
        <h2>FICHA TÉCNICA DE ESTAMPA</h2>
        <span style="color:#fff;font-weight:700;font-size:14px">SGE — Estamparia</span>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;">
        <div>
          <div class="report-img" style="height:220px;">${imgHtml}</div>
          <div class="report-section-label">Dados Gerais da Estampa</div>
          <div class="report-grid">
            <div class="report-field"><label>Referência Interna</label><p>${estampa.ref}</p></div>
            <div class="report-field"><label>Nome</label><p>${estampa.nome || '—'}</p></div>
            <div class="report-field"><label>Tipo de Estampa</label><p>${estampa.tipo}</p></div>
            <div class="report-field"><label>Rapport (Repetição)</label><p>${estampa.dimensoes || '—'}</p></div>
            <div class="report-field"><label>Quantidade Cores</label><p>${estampa.ncores || '—'}</p></div>
            <div class="report-field"><label>Artigo (Tecido)</label><p>${estampa.artigo || '—'}</p></div>
            <div class="report-field"><label>Base de Tingimento</label><p>${estampa.tingimento || '—'}</p></div>
            <div class="report-field"><label>Técnica de Estampa</label><p>${estampa.tecnica || '—'}</p></div>
          </div>
        </div>
        <div>
          <div class="report-section-label" style="margin-top:0">Identificação & Códigos</div>
          <div class="report-codes">
            <div class="code-row"><span class="code-label">Código Interno</span><span class="code-val">${estampa.codInterno || '—'}</span></div>
            <div class="code-row"><span class="code-label">Cód. de Engenharia</span><span class="code-val">${estampa.codEng || '—'}</span></div>
            <div class="code-row"><span class="code-label">Gravadora / Código</span><span class="code-val">${estampa.fornecedorGrav || '—'} / ${estampa.codGrav || '—'}</span></div>
            <div class="code-row"><span class="code-label">Estamparia / Código</span><span class="code-val">${estampa.fornecedorEst || '—'} / ${estampa.codEst || '—'}</span></div>
            <div class="code-row"><span class="code-label">Cód. Externo / Variante</span><span class="code-val">${estampa.codExt || '—'} / Var ${estampa.variante || '—'}</span></div>
            <div class="code-row"><span class="code-label">Cilindros Gravadora</span><span class="code-val">${estampa.nCilindros || 0} cilindros (${estampa.statusCil || '—'})</span></div>
          </div>

          <div class="report-section-label">Aprovações & Prazos</div>
          <div class="report-grid">
            <div class="report-field"><label>Orçamento Aprovado</label><p>${formatInputDate(estampa.dtOrcamento) || '—'}</p></div>
            <div class="report-field"><label>Arte Aprovada</label><p>${formatInputDate(estampa.dtArte) || '—'}</p></div>
            <div class="report-field"><label>Mesa de Amostra</label><p>${formatInputDate(estampa.dtMesa) || '—'}</p></div>
            <div class="report-field"><label>Produção Liberada</label><p>${formatInputDate(estampa.dtProducao) || '—'}</p></div>
          </div>

          <div class="report-section-label">Relação de Cores</div>
          ${pantonesHtml}
        </div>
      </div>
      <div class="report-section-label">Observações Técnicas Adicionais</div>
      <p style="font-size:12px;color:var(--ink2);line-height:1.55;white-space:pre-wrap;background:var(--bg);padding:12px;border-radius:8px;border:1px solid var(--border)">${estampa.obs || 'Nenhuma observação técnica registrada.'}</p>
    </div>`;
}

// ── RENDER: HOME DYNAMIC ALERTS ──
function renderHomeAlerts() {
  const container = document.getElementById('home-alerts');
  const alerts = [];
  const today = new Date();
  today.setHours(0,0,0,0);

  cacheAmostras.forEach(a => {
    if (a.status !== 'Aprovada' && a.dataPrev) {
      const prevDate = new Date(a.dataPrev);
      if (prevDate < today) {
        alerts.push({
          tipo: 'alert',
          titulo: `Amostra Atrasada!`,
          sub: `Fornecedor: ${a.fornecedor} | Produto: ${a.produto} (Previsão: ${formatInputDate(a.dataPrev)})`
        });
      }
    }
  });

  cacheEstampas.forEach(e => {
    if (e.status !== 'Aprovada') {
      const checkDateStr = e.dtMesa || e.dtArte;
      if (checkDateStr) {
        const checkDate = new Date(checkDateStr);
        if (checkDate < today) {
          alerts.push({
            tipo: 'warn',
            titulo: `Estampa REF ${e.ref} pendente!`,
            sub: `Aguardando aprovação crítica de arte ou mesa de amostra desde ${formatInputDate(checkDateStr)}.`
          });
        }
      }
    }
  });

  if (!alerts.length) {
    container.innerHTML = `
      <div class="alert-item ok">
        <div class="alert-dot green"></div>
        <div class="alert-text">
          <strong>Nenhuma pendência crítica encontrada</strong>
          <span>Todas as amostras e aprovações estão dentro dos prazos!</span>
        </div>
      </div>`;
    return;
  }

  container.innerHTML = alerts.map(al => {
    const itemClass = al.tipo === 'alert' ? 'alert' : 'warn';
    const dotColor = al.tipo === 'alert' ? 'red' : 'yellow';

    return `
      <div class="alert-item ${itemClass}">
        <div class="alert-dot ${dotColor}"></div>
        <div class="alert-text">
          <strong>${al.titulo}</strong>
          <span>${al.sub}</span>
        </div>
      </div>`;
  }).join('');
}

// ── EXPORT BACKUP ──
function exportBackup() {
  const data = {
    estampas: cacheEstampas,
    amostras: cacheAmostras,
    exportDate: new Date().toISOString()
  };

  const str = JSON.stringify(data, null, 2);
  const blob = new Blob([str], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = `SGE_Backup_${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  
  URL.revokeObjectURL(url);
}

function triggerImport() {
  document.getElementById('backup-import-input').click();
}

// ── IMPORT BACKUP ──
function importBackup(input) {
  const file = input.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async e => {
    try {
      const data = JSON.parse(e.target.result);
      if (!data.estampas || !data.amostras) {
        alert("Arquivo de backup inválido. Chaves 'estampas' ou 'amostras' não encontradas.");
        return;
      }

      if (confirm(`Deseja restaurar ${data.estampas.length} estampa(s) e ${data.amostras.length} amostra(s)?\nIsso irá sobrescrever os dados no banco ativo.`)) {
        
        if (DataStore.isSupabase) {
          alert("Importando dados para o Supabase PostgreSQL. Aguarde...");
          
          // Exclui anteriores
          const oldEst = await DataStore.getEstampas();
          const oldAm = await DataStore.getAmostras();
          for (let item of oldEst) await DataStore.deleteEstampa(item.id);
          for (let item of oldAm) await DataStore.deleteAmostra(item.id);

          // Salva novos
          for (let estampa of data.estampas) {
            await DataStore.saveEstampa(estampa);
          }
          for (let amostra of data.amostras) {
            await DataStore.saveAmostra(amostra);
          }
        } else {
          // LocalStorage
          localStorage.setItem('SGE_estampas', JSON.stringify(data.estampas));
          localStorage.setItem('SGE_amostras', JSON.stringify(data.amostras));
        }

        alert("Backup restaurado com sucesso!");
        input.value = '';
        closeModal('modal-backup');
        showPage(activePage);
      }
    } catch (err) {
      alert("Erro ao ler JSON de backup: " + err.message);
    }
  };
  reader.readAsText(file);
}
