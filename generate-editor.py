#!/usr/bin/env python3
"""Generates brief-editor-ready.html with business-brief.md content embedded."""
import os, json, re

ROOT = os.path.dirname(os.path.abspath(__file__))
BRIEF = os.path.join(ROOT, 'business-brief.md')
OUT   = os.path.join(ROOT, 'brief-editor-ready.html')

# ── Parse markdown ────────────────────────────────────────────
def parse(text):
    lines = text.split('\n')
    title, sections, cur, buf = '', [], None, []
    for line in lines:
        if line.startswith('# ') and not line.startswith('## ') and not title:
            title = line[2:].strip()
        elif line.startswith('## '):
            if cur is not None:
                sections.append({'name': cur, 'content': '\n'.join(buf).strip()})
            cur, buf = line[3:].strip(), []
        elif cur is not None:
            buf.append(line)
    if cur is not None:
        sections.append({'name': cur, 'content': '\n'.join(buf).strip()})
    return title, sections

with open(BRIEF, encoding='utf-8') as f:
    title, sections = parse(f.read())

data_js = json.dumps({'title': title, 'sections': sections}, ensure_ascii=False, indent=2)

# ── HTML template ─────────────────────────────────────────────
html = f'''<!DOCTYPE html>
<html lang="fr" data-theme="dark">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Brief Editor — MALI-MEC</title>
<style>
:root{{
  --bg:#0e1018;--surface:#161b2e;--surface2:#1e2540;--border:#252d47;--border2:#303a5a;
  --accent:#c9963a;--accent-lo:#c9963a22;--accent-hi:#e0b05a;
  --text:#dde3f0;--muted:#5d6a8a;--hint:#8896b8;
  --success:#3db87e;--danger:#e05252;--warn:#e0a030;
  --r:9px;--font:'Segoe UI',system-ui,-apple-system,sans-serif;
  --mono:'JetBrains Mono','Cascadia Code','Fira Code',monospace;
}}
@media(prefers-color-scheme:light){{:root{{--bg:#f0f2f8;--surface:#fff;--surface2:#eaecf5;--border:#ced4e8;--border2:#b8c0d8;--text:#1a2040;--muted:#7a87b0;--hint:#5060a0;--accent-lo:#c9963a18;}}}}
:root[data-theme="light"]{{--bg:#f0f2f8;--surface:#fff;--surface2:#eaecf5;--border:#ced4e8;--border2:#b8c0d8;--text:#1a2040;--muted:#7a87b0;--hint:#5060a0;--accent-lo:#c9963a18;}}
:root[data-theme="dark"]{{--bg:#0e1018;--surface:#161b2e;--surface2:#1e2540;--border:#252d47;--border2:#303a5a;--text:#dde3f0;--muted:#5d6a8a;--hint:#8896b8;--accent-lo:#c9963a22;}}
*,*::before,*::after{{box-sizing:border-box;margin:0;padding:0;}}
html{{height:100%;}}
body{{font-family:var(--font);background:var(--bg);color:var(--text);min-height:100%;font-size:14px;line-height:1.6;transition:background .2s,color .2s;}}

/* Layout */
header{{position:sticky;top:0;z-index:90;height:56px;padding:0 24px;display:flex;align-items:center;justify-content:space-between;background:color-mix(in srgb,var(--bg) 85%,transparent);backdrop-filter:blur(14px);border-bottom:1px solid var(--border);}}
.hd-left{{display:flex;align-items:center;gap:10px;}}
.hd-mark{{width:28px;height:28px;border-radius:6px;background:linear-gradient(135deg,var(--accent),#a06010);display:flex;align-items:center;justify-content:center;font-weight:800;font-size:11px;color:#fff;letter-spacing:-.5px;flex-shrink:0;}}
.hd-name{{font-weight:700;font-size:14px;}}
.hd-tag{{font-size:11px;color:var(--accent);background:var(--accent-lo);padding:2px 8px;border-radius:3px;font-weight:700;margin-left:4px;}}
.hd-right{{display:flex;align-items:center;gap:8px;}}
.body-grid{{display:grid;grid-template-columns:1fr 320px;gap:24px;max-width:1360px;width:100%;margin:0 auto;padding:24px 24px 80px;}}
@media(max-width:860px){{.body-grid{{grid-template-columns:1fr;}}.sidebar{{order:-1;}}}}

/* Buttons */
.btn{{display:inline-flex;align-items:center;gap:6px;padding:7px 14px;border-radius:7px;font-size:13px;font-weight:600;cursor:pointer;border:1px solid transparent;transition:all .15s;font-family:var(--font);}}
.btn:active{{transform:scale(.97);}}
.btn-gold{{background:var(--accent);color:#0e0a02;border-color:var(--accent);}}
.btn-gold:hover{{background:var(--accent-hi);}}
.btn-ghost{{background:transparent;color:var(--hint);border-color:var(--border);}}
.btn-ghost:hover{{background:var(--surface2);color:var(--text);border-color:var(--border2);}}
.btn-danger{{background:transparent;color:var(--danger);border-color:#e0525233;}}
.btn-danger:hover{{background:#e0525214;}}
.btn-sm{{padding:4px 10px;font-size:12px;}}
.theme-btn{{width:32px;height:32px;border-radius:7px;border:1px solid var(--border);background:transparent;color:var(--hint);cursor:pointer;font-size:14px;display:flex;align-items:center;justify-content:center;transition:all .15s;}}
.theme-btn:hover{{background:var(--surface2);color:var(--text);}}
.dirty-dot{{width:7px;height:7px;border-radius:50%;background:var(--warn);display:none;animation:pulse 1.5s infinite;}}
.dirty-dot.on{{display:block;}}
@keyframes pulse{{0%,100%{{opacity:1}}50%{{opacity:.35}}}}

/* Title */
.title-wrap{{margin-bottom:20px;}}
.field-label{{font-size:10.5px;font-weight:700;text-transform:uppercase;letter-spacing:1.2px;color:var(--muted);margin-bottom:7px;}}
.title-input{{width:100%;background:var(--surface);border:1px solid var(--border);border-radius:var(--r);color:var(--text);font-size:20px;font-weight:700;padding:12px 16px;font-family:var(--font);outline:none;transition:border-color .2s;}}
.title-input:focus{{border-color:var(--accent);}}
.title-input::placeholder{{color:var(--muted);font-weight:400;}}

/* Section cards */
.section-card{{background:var(--surface);border:1px solid var(--border);border-radius:var(--r);margin-bottom:12px;overflow:hidden;transition:border-color .2s;}}
.section-card:focus-within{{border-color:var(--border2);}}
.section-card.key{{border-left:3px solid var(--accent);}}
.sc-head{{display:flex;align-items:center;justify-content:space-between;padding:11px 16px 9px;}}
.sc-name{{font-weight:700;font-size:13px;color:var(--text);display:flex;align-items:center;gap:8px;}}
.key-pill{{font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:var(--accent);background:var(--accent-lo);padding:2px 7px;border-radius:3px;}}
.sc-chars{{font-size:11px;color:var(--muted);font-variant-numeric:tabular-nums;}}
.sc-hint{{font-size:12px;color:var(--muted);padding:0 16px 9px;font-style:italic;line-height:1.4;}}
.sc-ta{{width:100%;background:transparent;border:none;border-top:1px solid var(--border);color:var(--text);font-size:13px;line-height:1.7;padding:13px 16px;font-family:var(--mono);resize:none;min-height:80px;outline:none;transition:background .15s;}}
.sc-ta:focus{{background:var(--accent-lo);}}

/* Sidebar */
.sidebar{{display:flex;flex-direction:column;gap:14px;}}
.s-card{{background:var(--surface);border:1px solid var(--border);border-radius:var(--r);overflow:hidden;}}
.s-head{{padding:11px 16px;border-bottom:1px solid var(--border);font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.9px;color:var(--hint);display:flex;align-items:center;justify-content:space-between;}}
.stat-row{{display:flex;justify-content:space-between;padding:8px 16px;font-size:12.5px;}}
.stat-val{{font-weight:700;font-variant-numeric:tabular-nums;}}
.stat-val.ok{{color:var(--success);}}
.stat-val.warn{{color:var(--warn);}}
.divider{{height:1px;background:var(--border);}}
.cmd-wrap{{background:#070a12;padding:14px 16px;position:relative;}}
.cmd-text{{font-family:var(--mono);font-size:11.5px;color:#7dd3fc;line-height:1.8;white-space:pre-wrap;word-break:break-word;}}
.copy-btn{{position:absolute;top:10px;right:10px;background:var(--surface2);border:1px solid var(--border2);border-radius:5px;color:var(--hint);font-size:11px;font-family:var(--font);padding:3px 9px;cursor:pointer;transition:all .15s;}}
.copy-btn:hover{{color:var(--text);}}
.copy-btn.ok{{color:var(--success);border-color:var(--success);}}
.cmd-note{{padding:9px 16px;font-size:11.5px;color:var(--muted);border-top:1px solid var(--border);line-height:1.5;}}

/* Modal */
.overlay{{display:none;position:fixed;inset:0;background:rgba(0,0,0,.65);backdrop-filter:blur(6px);z-index:200;align-items:center;justify-content:center;}}
.overlay.open{{display:flex;}}
.modal{{background:var(--surface);border:1px solid var(--border2);border-radius:14px;padding:28px;width:100%;max-width:460px;box-shadow:0 24px 60px rgba(0,0,0,.55);animation:mIn .2s ease;}}
@keyframes mIn{{from{{transform:scale(.94) translateY(8px);opacity:0}}to{{transform:none;opacity:1}}}}
.m-title{{font-size:18px;font-weight:800;margin-bottom:6px;}}
.m-desc{{font-size:13px;color:var(--hint);margin-bottom:22px;line-height:1.5;}}
.m-label{{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.8px;color:var(--muted);margin-bottom:7px;display:block;}}
.m-input{{width:100%;background:var(--surface2);border:1px solid var(--border);border-radius:7px;color:var(--text);font-size:14px;padding:10px 14px;font-family:var(--font);outline:none;transition:border-color .2s;margin-bottom:18px;}}
.m-input:focus{{border-color:var(--accent);}}
.check-grid{{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:24px;}}
.ch-item{{display:flex;align-items:center;gap:8px;padding:8px 10px;background:var(--surface2);border:1px solid var(--border);border-radius:6px;cursor:pointer;font-size:12px;color:var(--hint);user-select:none;transition:all .15s;}}
.ch-item:hover{{border-color:var(--border2);color:var(--text);}}
.ch-item.checked{{border-color:#e0525244;background:#e0525210;color:var(--danger);}}
.ch-box{{width:15px;height:15px;border:1.5px solid currentColor;border-radius:3px;display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:700;flex-shrink:0;}}
.m-actions{{display:flex;gap:10px;justify-content:flex-end;}}

/* Toast */
#toasts{{position:fixed;bottom:22px;right:22px;z-index:300;display:flex;flex-direction:column;gap:8px;pointer-events:none;}}
.toast{{background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:10px 16px;font-size:13px;display:flex;align-items:center;gap:10px;box-shadow:0 8px 24px rgba(0,0,0,.4);pointer-events:auto;max-width:300px;animation:tIn .25s ease;}}
.toast.ok{{border-left:3px solid var(--success);}}
.toast.err{{border-left:3px solid var(--danger);}}
.toast.inf{{border-left:3px solid var(--accent);}}
@keyframes tIn{{from{{transform:translateX(110%);opacity:0}}to{{transform:none;opacity:1}}}}
@keyframes tOut{{to{{transform:translateX(120%);opacity:0}}}}

/* Regen notice */
.regen-bar{{background:var(--accent-lo);border:1px solid var(--accent);border-radius:var(--r);padding:10px 16px;margin-bottom:20px;font-size:12.5px;color:var(--accent);display:flex;align-items:center;gap:10px;line-height:1.4;}}
</style>
</head>
<body>

<header>
  <div class="hd-left">
    <div class="hd-mark">MM</div>
    <span class="hd-name">Brief Editor</span>
    <span class="hd-tag">Prêt à l\'emploi</span>
  </div>
  <div class="hd-right">
    <div class="dirty-dot" id="dirtyDot"></div>
    <button class="btn btn-ghost" onclick="openModal()">✦ Nouveau Projet</button>
    <button class="theme-btn" id="themeBtn" onclick="toggleTheme()" title="Thème">🌙</button>
    <button class="btn btn-gold" id="saveBtn" onclick="saveFile()">⬇ Télécharger .md</button>
  </div>
</header>

<div class="body-grid">
  <div>
    <div class="regen-bar">
      ⚠ Ce fichier contient le brief actuel. Après chaque modification, télécharge le .md et replace-le dans le projet MALI-MEC. Puis régénère ce fichier avec <code>python3 generate-editor.py</code>.
    </div>
    <div class="title-wrap">
      <div class="field-label">Titre du Projet</div>
      <input class="title-input" id="titleInput" type="text" oninput="dirty()">
    </div>
    <div id="sectionsArea"></div>
  </div>

  <div class="sidebar">
    <div class="s-card">
      <div class="s-head">État du Brief</div>
      <div class="stat-row"><span style="color:var(--hint)">Sections remplies</span><span class="stat-val" id="stFilled">—</span></div>
      <div class="divider"></div>
      <div class="stat-row"><span style="color:var(--hint)">Essentielles</span><span class="stat-val" id="stKey">—</span></div>
      <div class="divider"></div>
      <div class="stat-row"><span style="color:var(--hint)">Longueur totale</span><span class="stat-val" id="stLen">—</span></div>
    </div>

    <div class="s-card">
      <div class="s-head">Lancer le Système</div>
      <div class="cmd-wrap">
        <button class="copy-btn" id="copyBtn" onclick="copyCmd()">Copier</button>
        <div class="cmd-text">Lis le fichier business-brief.md et lance les 4 agents dans l\'ordre :
1. market-signal-researcher — attends le résultat.
2. Si score ≥ 3.5 → offer-architect.
3. content-angle-strategist avec l\'output 2.
4. conversion-system-builder avec l\'output 3.
5. Synthèse → outputs/05-revenue-agent-demo.md
6. Brief final → outputs/06-final-video-brief.md</div>
      </div>
      <div class="cmd-note">Colle cette commande dans <strong>Claude Code</strong> pour lancer l\'analyse.</div>
    </div>

    <div class="s-card">
      <div style="padding:14px 16px;display:flex;flex-direction:column;gap:8px;">
        <button class="btn btn-gold" style="width:100%;justify-content:center" onclick="saveFile()">⬇ Télécharger business-brief.md</button>
        <p style="font-size:11.5px;color:var(--muted);line-height:1.5;margin-top:4px;">Remplace le fichier dans le projet, puis relance les agents.</p>
      </div>
    </div>
  </div>
</div>

<!-- Modal -->
<div class="overlay" id="modal" onclick="if(event.target===this)closeModal()">
  <div class="modal">
    <div class="m-title">Nouveau Projet</div>
    <div class="m-desc">Donne un nom à ton projet. Les sections cochées seront vidées. Les agents restent intacts.</div>
    <label class="m-label" for="mName">Nom du projet</label>
    <input class="m-input" id="mName" type="text" placeholder="Ex: MALI-MEC — Offre Coaching IA Sénégal">
    <div class="m-label">Sections à vider</div>
    <div class="check-grid" id="checkGrid"></div>
    <div class="m-actions">
      <button class="btn btn-ghost" onclick="closeModal()">Annuler</button>
      <button class="btn btn-gold" onclick="applyNew()">Créer</button>
    </div>
  </div>
</div>

<div id="toasts"></div>

<script>
const KEY_SECTIONS = ['Target Audience','Core Promise','Current Video / Campaign Concept','Strategic Phrase','Business Goals'];
const CLEARABLE    = ['Target Audience','Core Promise','Current Video / Campaign Concept','Strategic Phrase','Business Goals','Constraints','Proof Requirements'];
const HINTS = {{
  'Target Audience':                  'Qui exactement veux-tu atteindre ? Métier, marché, point de douleur.',
  'Core Promise':                     "J\'aide [audience] à obtenir [résultat] sans [obstacle] grâce à [mécanisme].",
  'Current Video / Campaign Concept': 'Titre de travail, concept, durée cible, parcours de revenus.',
  'Strategic Phrase':                 "La phrase qui résume ton positionnement. Ex: > L\'argent n\'est pas dans les outils.",
  'Business Goals':                   'Numéroter les objectifs. Ex: 1. Valider la demande. 2. Construire une audience.',
}};
const LABELS = {{
  'Identity':                         'Identité',
  'About MALI-MEC':                   "À Propos de l\'Organisation",
  'Target Audience':                  'Audience Cible',
  'Core Promise':                     'Promesse Centrale',
  'Business Goals':                   'Objectifs Business',
  'Offer Ecosystem (Value Ladder)':   "Écosystème d\'Offres",
  'Content Strategy':                 'Stratégie de Contenu',
  'Current Video / Campaign Concept': 'Concept Vidéo / Campagne',
  'Strategic Phrase':                 'Phrase Stratégique',
  'Constraints':                      'Contraintes',
  'Proof Requirements':               'Preuves Requises',
}};

const BRIEF_DATA = {data_js};

let isDirty = false;
let currentTheme = 'dark';

// ── Render ──────────────────────────────────────────────────
function render({{title, sections}}) {{
  document.getElementById('titleInput').value = title;
  const area = document.getElementById('sectionsArea');
  area.innerHTML = '';
  sections.forEach((sec, i) => {{
    const isKey = KEY_SECTIONS.includes(sec.name);
    const label = LABELS[sec.name] || sec.name;
    const hint  = HINTS[sec.name] || '';
    const card  = document.createElement('div');
    card.className = 'section-card' + (isKey ? ' key' : '');
    card.innerHTML = `
      <div class="sc-head">
        <div class="sc-name">${{label}}${{isKey ? \'<span class="key-pill">Essentiel</span>\' : \'\'}}</div>
        <span class="sc-chars" id="cc${{i}}">0 car.</span>
      </div>
      ${{hint ? `<div class="sc-hint">${{hint}}</div>` : \'\'}}
      <textarea class="sc-ta" data-name="${{sec.name}}" data-i="${{i}}"
        oninput="grow(this);countChars(this);dirty()">${{esc(sec.content)}}</textarea>`;
    area.appendChild(card);
    const ta = card.querySelector('textarea');
    grow(ta); countChars(ta);
  }});
  updateStats();
}}

function esc(s) {{ return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }}

function grow(ta) {{ ta.style.height='auto'; ta.style.height=ta.scrollHeight+'px'; }}
function countChars(ta) {{
  const el = document.getElementById('cc'+ta.dataset.i);
  if(el) el.textContent = ta.value.length.toLocaleString('fr')+' car.';
}}

// ── Build markdown ──────────────────────────────────────────
function buildMd() {{
  const title = document.getElementById('titleInput').value;
  const parts = [`# ${{title}}`, ''];
  document.querySelectorAll('.sc-ta').forEach(ta => {{
    parts.push(`## ${{ta.dataset.name}}`, '', ta.value, '');
  }});
  return parts.join('\\n');
}}

// ── Stats ────────────────────────────────────────────────────
function updateStats() {{
  const tas = document.querySelectorAll('.sc-ta');
  let filled=0, keyFilled=0, keyTotal=0, len=0;
  tas.forEach(ta => {{
    const v = ta.value.trim();
    len += v.length;
    if(v) filled++;
    if(KEY_SECTIONS.includes(ta.dataset.name)) {{ keyTotal++; if(v) keyFilled++; }}
  }});
  document.getElementById('stFilled').textContent = filled+' / '+tas.length;
  const kEl = document.getElementById('stKey');
  kEl.textContent = keyFilled+' / '+keyTotal;
  kEl.className = 'stat-val '+(keyFilled===keyTotal?'ok':'warn');
  document.getElementById('stLen').textContent = len.toLocaleString('fr')+' car.';
}}

// ── Dirty ────────────────────────────────────────────────────
function dirty() {{ isDirty=true; document.getElementById('dirtyDot').classList.add('on'); updateStats(); }}
window.addEventListener('beforeunload', e => {{ if(isDirty){{ e.preventDefault(); e.returnValue=''; }} }});
document.addEventListener('keydown', e => {{ if((e.ctrlKey||e.metaKey)&&e.key==='s'){{ e.preventDefault(); saveFile(); }} }});

// ── Save ─────────────────────────────────────────────────────
async function saveFile() {{
  const md   = buildMd();

  // Try File System Access API first (Chrome/Edge)
  if(window.showSaveFilePicker) {{
    try {{
      const handle = await window.showSaveFilePicker({{
        suggestedName:'business-brief.md',
        types:[{{description:'Markdown',accept:{{'text/markdown':['.md']}}}}],
      }});
      const writable = await handle.createWritable();
      await writable.write(md); await writable.close();
      isDirty=false; document.getElementById('dirtyDot').classList.remove('on');
      toast('Sauvegardé directement dans le fichier ✓','ok');
      return;
    }} catch(e) {{ if(e.name==='AbortError') return; }}
  }}

  // Fallback: download
  const blob = new Blob([md],{{type:'text/markdown'}});
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href=url; a.download='business-brief.md';
  document.body.appendChild(a); a.click();
  document.body.removeChild(a); URL.revokeObjectURL(url);
  isDirty=false; document.getElementById('dirtyDot').classList.remove('on');
  toast('Fichier téléchargé — remplace l\'original dans le projet','inf');
}}

// ── Copy command ─────────────────────────────────────────────
function copyCmd() {{
  navigator.clipboard.writeText(document.querySelector('.cmd-text').textContent).then(() => {{
    const btn=document.getElementById('copyBtn');
    btn.textContent='✓'; btn.classList.add('ok');
    setTimeout(()=>{{btn.textContent='Copier';btn.classList.remove('ok');}},2000);
  }});
}}

// ── Theme ─────────────────────────────────────────────────────
function toggleTheme() {{
  currentTheme = currentTheme==='dark'?'light':'dark';
  document.documentElement.dataset.theme = currentTheme;
  document.getElementById('themeBtn').textContent = currentTheme==='dark'?'🌙':'☀️';
}}

// ── Modal ─────────────────────────────────────────────────────
function openModal() {{
  const grid = document.getElementById('checkGrid');
  grid.innerHTML = '';
  CLEARABLE.forEach(name => {{
    const label = LABELS[name]||name;
    const el = document.createElement('label');
    el.className='ch-item checked';
    el.innerHTML=`<input type="checkbox" checked style="display:none" data-s="${{name}}"><span class="ch-box">✓</span><span>${{label}}</span>`;
    const cb = el.querySelector('input');
    cb.addEventListener('change',()=>{{
      el.classList.toggle('checked',cb.checked);
      el.querySelector('.ch-box').textContent=cb.checked?'✓':'';
    }});
    grid.appendChild(el);
  }});
  document.getElementById('mName').value='';
  document.getElementById('modal').classList.add('open');
  setTimeout(()=>document.getElementById('mName').focus(),120);
}}
function closeModal() {{ document.getElementById('modal').classList.remove('open'); }}
function applyNew() {{
  const name    = document.getElementById('mName').value.trim();
  const checked = Array.from(document.querySelectorAll('#checkGrid input:checked')).map(i=>i.dataset.s);
  if(name) document.getElementById('titleInput').value = name;
  checked.forEach(sname => {{
    const ta = document.querySelector(`.sc-ta[data-name="${{sname}}"]`);
    if(ta){{ ta.value=''; grow(ta); countChars(ta); }}
  }});
  dirty(); closeModal(); updateStats();
  toast('Nouveau projet prêt ✓','ok');
}}

// ── Toast ─────────────────────────────────────────────────────
function toast(msg,type='inf') {{
  const c=document.getElementById('toasts');
  const t=document.createElement('div');
  t.className='toast '+type;
  t.innerHTML=`<span>${{{{ok:'✓',err:'✕',inf:'→'}}[type]||'→'}}</span><span>${{msg}}</span>`;
  c.appendChild(t);
  setTimeout(()=>{{t.style.animation='tOut .3s ease forwards';setTimeout(()=>t.remove(),300);}},3500);
}}

// ── Boot ──────────────────────────────────────────────────────
(function(){{
  const dark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  currentTheme = dark?'dark':'light';
  document.documentElement.dataset.theme = currentTheme;
  document.addEventListener('DOMContentLoaded',()=>{{
    document.getElementById('themeBtn').textContent = currentTheme==='dark'?'🌙':'☀️';
    render(BRIEF_DATA);
  }});
}})();
</script>
</body>
</html>'''

with open(OUT, 'w', encoding='utf-8') as f:
    f.write(html)

print(f"✓ Généré : {OUT}")
print(f"  Titre  : {title}")
print(f"  Sections : {len(sections)}")
