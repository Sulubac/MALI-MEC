from flask import Flask, render_template, request, jsonify
import os

app = Flask(__name__)

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BRIEF_PATH = os.path.join(BASE_DIR, 'business-brief.md')
OUTPUTS_PATH = os.path.join(BASE_DIR, 'outputs')

SECTION_LABELS = {
    'Identity': 'Identité',
    'About MALI-MEC': "À Propos de l'Organisation",
    'Target Audience': 'Audience Cible',
    'Core Promise': 'Promesse Centrale',
    'Business Goals': 'Objectifs Business',
    'Offer Ecosystem (Value Ladder)': "Écosystème d'Offres",
    'Content Strategy': 'Stratégie de Contenu',
    'Current Video / Campaign Concept': 'Concept Vidéo / Campagne',
    'Strategic Phrase': 'Phrase Stratégique',
    'Constraints': 'Contraintes',
    'Proof Requirements': 'Preuves Requises',
}

SECTION_HINTS = {
    'Target Audience': 'Qui exactement veux-tu atteindre ? Sois précis : métier, marché, point de douleur.',
    'Core Promise': "J'aide [audience] à obtenir [résultat] sans [obstacle] grâce à [mécanisme].",
    'Current Video / Campaign Concept': 'Titre de travail, concept, durée cible, parcours de revenus.',
    'Strategic Phrase': 'La phrase qui résume ton positionnement. Ex: > L\'argent n\'est pas dans les outils.',
    'Business Goals': 'Numéroter les objectifs. Ex: 1. Valider la demande. 2. Construire une audience.',
}

KEY_SECTIONS = [
    'Target Audience',
    'Core Promise',
    'Current Video / Campaign Concept',
    'Strategic Phrase',
    'Business Goals',
]

EXPECTED_OUTPUTS = [
    ('01-market-signal-brief.md', 'Signal Marché'),
    ('02-offer-architecture.md', "Architecture d'Offre"),
    ('03-content-strategy.md', 'Stratégie de Contenu'),
    ('04-conversion-system.md', 'Système de Conversion'),
    ('05-revenue-agent-demo.md', 'Synthèse Coordinateur'),
    ('06-final-video-brief.md', 'Brief Final'),
]


def parse_brief():
    with open(BRIEF_PATH, 'r', encoding='utf-8') as f:
        content = f.read()

    lines = content.split('\n')
    title = ''
    sections = []
    current_section = None
    current_lines = []

    for line in lines:
        if line.startswith('# ') and not line.startswith('## ') and not title:
            title = line[2:].strip()
        elif line.startswith('## '):
            if current_section is not None:
                sections.append({
                    'name': current_section,
                    'content': '\n'.join(current_lines).strip()
                })
            current_section = line[3:].strip()
            current_lines = []
        elif current_section is not None:
            current_lines.append(line)

    if current_section is not None:
        sections.append({
            'name': current_section,
            'content': '\n'.join(current_lines).strip()
        })

    return title, sections


def rebuild_and_save(title, sections):
    parts = [f'# {title}', '']
    for section in sections:
        parts.append(f'## {section["name"]}')
        parts.append('')
        parts.append(section['content'])
        parts.append('')
    content = '\n'.join(parts)
    with open(BRIEF_PATH, 'w', encoding='utf-8') as f:
        f.write(content)


def get_outputs_status():
    result = []
    for filename, label in EXPECTED_OUTPUTS:
        path = os.path.join(OUTPUTS_PATH, filename)
        exists = os.path.exists(path)
        result.append({
            'filename': filename,
            'label': label,
            'exists': exists,
            'size': os.path.getsize(path) if exists else 0,
        })
    return result


@app.route('/')
def index():
    title, sections = parse_brief()
    outputs = get_outputs_status()
    has_results = any(o['exists'] for o in outputs)
    return render_template('index.html',
                           title=title,
                           sections=sections,
                           section_labels=SECTION_LABELS,
                           section_hints=SECTION_HINTS,
                           key_sections=KEY_SECTIONS,
                           outputs=outputs,
                           has_results=has_results)


@app.route('/api/save', methods=['POST'])
def save():
    data = request.json
    rebuild_and_save(data.get('title', ''), data.get('sections', []))
    return jsonify({'status': 'saved'})


@app.route('/api/clear-outputs', methods=['POST'])
def clear_outputs():
    count = 0
    for filename, _ in EXPECTED_OUTPUTS:
        path = os.path.join(OUTPUTS_PATH, filename)
        if os.path.exists(path):
            os.remove(path)
            count += 1
    return jsonify({'status': 'ok', 'cleared': count})


@app.route('/api/outputs-status')
def outputs_status():
    return jsonify(get_outputs_status())


if __name__ == '__main__':
    print('\n' + '=' * 52)
    print('  MALI-MEC — Revenue Agent System')
    print('  Ouvre dans ton navigateur :')
    print('  http://localhost:5050')
    print('=' * 52 + '\n')
    app.run(debug=False, port=5050, host='0.0.0.0')
