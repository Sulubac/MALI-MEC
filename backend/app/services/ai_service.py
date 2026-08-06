import re
import json
from typing import Optional, Dict, List, Any
from datetime import datetime
import structlog

logger = structlog.get_logger()


class DocumentAnalysis:
    def __init__(self, raw: Dict):
        self.title = raw.get("title", "")
        self.document_type = raw.get("document_type", "autre")
        self.date = raw.get("date")
        self.reference = raw.get("reference", "")
        self.author = raw.get("author", "")
        self.institution = raw.get("institution", "")
        self.recipient = raw.get("recipient", "")
        self.object = raw.get("object", "")
        self.summary = raw.get("summary", "")
        self.keywords = raw.get("keywords", [])
        self.entities_persons = raw.get("entities_persons", [])
        self.entities_organizations = raw.get("entities_organizations", [])
        self.entities_locations = raw.get("entities_locations", [])
        self.confidentiality = raw.get("confidentiality", "internal")
        self.retention_years = raw.get("retention_years", 10)
        self.tags = raw.get("tags", [])
        self.language = raw.get("language", "fr")
        self.is_complete = raw.get("is_complete", True)
        self.is_duplicate = raw.get("is_duplicate", False)
        self.anomalies = raw.get("anomalies", [])
        self.classification_suggestion = raw.get("classification_suggestion", "")
        self.confidence = raw.get("confidence", 0.85)


class AIDocumentService:
    def __init__(self):
        self.llm_provider = None
        self._init_llm()

    def _init_llm(self):
        try:
            import anthropic
            from app.config import settings
            if settings.ANTHROPIC_API_KEY:
                self.llm_provider = "anthropic"
                self.client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)
                return
        except Exception:
            pass

        try:
            import openai
            from app.config import settings
            if settings.OPENAI_API_KEY:
                self.llm_provider = "openai"
                self.client = openai.OpenAI(api_key=settings.OPENAI_API_KEY)
                return
        except Exception:
            pass

        logger.warning("No LLM provider configured, using rule-based analysis")

    async def analyze_document(self, text: str, file_path: Optional[str] = None) -> DocumentAnalysis:
        if self.llm_provider:
            try:
                return await self._analyze_with_llm(text)
            except Exception as e:
                logger.error("LLM analysis failed", error=str(e))

        return self._analyze_with_rules(text)

    async def _analyze_with_llm(self, text: str) -> DocumentAnalysis:
        prompt = f"""Analyse ce document officiel djiboutien et extrait les informations suivantes en JSON:

{{
  "title": "titre du document",
  "document_type": "type parmi: courrier_entrant, courrier_sortant, decision, decret, arrete, loi, rapport, contrat, note, autre",
  "date": "date ISO 8601 ou null",
  "reference": "référence ou numéro du document",
  "author": "auteur ou signataire",
  "institution": "institution émettrice",
  "recipient": "destinataire",
  "object": "objet ou sujet principal",
  "summary": "résumé en 2-3 phrases",
  "keywords": ["liste", "de", "mots-clés"],
  "entities_persons": ["liste des personnes mentionnées"],
  "entities_organizations": ["liste des organisations"],
  "entities_locations": ["liste des lieux"],
  "confidentiality": "public | internal | confidential | secret",
  "retention_years": nombre_années_conservation,
  "tags": ["tags", "proposés"],
  "language": "fr | ar | en | so",
  "is_complete": true/false,
  "anomalies": ["liste des anomalies détectées"],
  "classification_suggestion": "suggestion de classement",
  "confidence": 0.95
}}

TEXTE DU DOCUMENT:
{text[:3000]}

Réponds UNIQUEMENT avec le JSON valide, sans explication."""

        if self.llm_provider == "anthropic":
            import anthropic
            message = self.client.messages.create(
                model="claude-haiku-4-5-20251001",
                max_tokens=1024,
                messages=[{"role": "user", "content": prompt}],
            )
            result_text = message.content[0].text
        else:
            response = self.client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[{"role": "user", "content": prompt}],
                response_format={"type": "json_object"},
            )
            result_text = response.choices[0].message.content

        result = json.loads(result_text)
        return DocumentAnalysis(result)

    def _analyze_with_rules(self, text: str) -> DocumentAnalysis:
        result = {
            "title": self._extract_title(text),
            "document_type": self._detect_type(text),
            "date": self._extract_date(text),
            "reference": self._extract_reference(text),
            "author": self._extract_author(text),
            "institution": self._extract_institution(text),
            "recipient": self._extract_recipient(text),
            "object": self._extract_object(text),
            "summary": self._generate_summary(text),
            "keywords": self._extract_keywords(text),
            "entities_persons": self._extract_persons(text),
            "entities_organizations": self._extract_organizations(text),
            "entities_locations": self._extract_locations(text),
            "confidentiality": self._detect_confidentiality(text),
            "retention_years": 10,
            "tags": self._generate_tags(text),
            "language": self._detect_language(text),
            "is_complete": len(text) > 100,
            "anomalies": [],
            "classification_suggestion": "",
            "confidence": 0.75,
        }
        return DocumentAnalysis(result)

    def _extract_title(self, text: str) -> str:
        lines = text.strip().split("\n")
        for line in lines[:5]:
            line = line.strip()
            if len(line) > 10 and len(line) < 200:
                return line
        return "Document sans titre"

    def _detect_type(self, text: str) -> str:
        text_lower = text.lower()
        types = {
            "decret": "decret",
            "arrêté": "arrete",
            "loi n°": "loi",
            "décision": "decision",
            "contrat": "contrat",
            "rapport": "rapport",
            "note de service": "note",
            "circulaire": "circulaire",
            "objet :": "courrier_entrant",
        }
        for keyword, doc_type in types.items():
            if keyword in text_lower:
                return doc_type
        return "autre"

    def _extract_date(self, text: str) -> Optional[str]:
        patterns = [
            r'\d{1,2}/\d{1,2}/\d{4}',
            r'\d{1,2}-\d{1,2}-\d{4}',
            r'\d{4}-\d{2}-\d{2}',
            r'\d{1,2}\s+(?:janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre)\s+\d{4}',
        ]
        for pattern in patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                return match.group()
        return None

    def _extract_reference(self, text: str) -> str:
        patterns = [
            r'Réf\s*[:\.]?\s*([A-Z0-9/\-]+)',
            r'N°\s*([A-Z0-9/\-]+)',
            r'Référence\s*[:\.]?\s*([A-Z0-9/\-]+)',
        ]
        for pattern in patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                return match.group(1)
        return ""

    def _extract_author(self, text: str) -> str:
        patterns = [
            r'(?:Le|La)\s+(?:Ministre|Directeur|Président|Secrétaire)\s+.+',
            r'(?:Signé|Signature)\s*:\s*(.+)',
        ]
        for pattern in patterns:
            match = re.search(pattern, text)
            if match:
                return match.group().strip()[:100]
        return ""

    def _extract_institution(self, text: str) -> str:
        institutions = [
            "Présidence de la République",
            "Primature",
            "Ministère des Finances",
            "Ministère de l'Intérieur",
            "Ministère des Affaires Étrangères",
            "Ministère de la Justice",
            "Ministère de l'Éducation",
            "Ministère de la Santé",
        ]
        for inst in institutions:
            if inst.lower() in text.lower():
                return inst
        return "République de Djibouti"

    def _extract_recipient(self, text: str) -> str:
        patterns = [
            r'À\s*(?:Monsieur|Madame|Messieurs)\s+.+',
            r'Destinataire\s*:\s*(.+)',
        ]
        for pattern in patterns:
            match = re.search(pattern, text)
            if match:
                return match.group().strip()[:200]
        return ""

    def _extract_object(self, text: str) -> str:
        pattern = r'(?:Objet|Object|Sujet)\s*[:\.]?\s*(.+?)(?:\n|$)'
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            return match.group(1).strip()[:500]
        return ""

    def _generate_summary(self, text: str) -> str:
        sentences = re.split(r'[.!?]+', text)
        meaningful = [s.strip() for s in sentences if len(s.strip()) > 30][:3]
        return " ".join(meaningful)[:500] if meaningful else text[:300]

    def _extract_keywords(self, text: str) -> List[str]:
        stop_words = {"le", "la", "les", "de", "du", "des", "un", "une", "en", "et", "ou", "pour", "par"}
        words = re.findall(r'\b[A-ZÀ-Ö][a-zà-ö]+\b', text)
        freq = {}
        for w in words:
            w_lower = w.lower()
            if w_lower not in stop_words and len(w) > 3:
                freq[w] = freq.get(w, 0) + 1
        sorted_words = sorted(freq.items(), key=lambda x: x[1], reverse=True)
        return [w for w, _ in sorted_words[:10]]

    def _extract_persons(self, text: str) -> List[str]:
        pattern = r'\b(?:M\.|Mme\.|Monsieur|Madame|Dr\.?|Prof\.?)\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*'
        return list(set(re.findall(pattern, text)))[:10]

    def _extract_organizations(self, text: str) -> List[str]:
        orgs = []
        keywords = ["Ministère", "Direction", "Service", "Office", "Agence", "Bureau", "Commission"]
        for kw in keywords:
            pattern = rf'{kw}\s+(?:de|du|des|d\'|national|général)?\s*[A-ZÀ-Ö][^,\n]{{3,50}}'
            matches = re.findall(pattern, text)
            orgs.extend(matches[:3])
        return list(set(orgs))[:10]

    def _extract_locations(self, text: str) -> List[str]:
        dj_places = ["Djibouti", "Ali Sabieh", "Dikhil", "Tadjourah", "Obock", "Arta"]
        found = [p for p in dj_places if p in text]
        return found

    def _detect_confidentiality(self, text: str) -> str:
        text_upper = text.upper()
        if "TRÈS SECRET" in text_upper or "TOP SECRET" in text_upper:
            return "top_secret"
        if "SECRET" in text_upper:
            return "secret"
        if "CONFIDENTIEL" in text_upper or "CONFIDENTIAL" in text_upper:
            return "confidential"
        return "internal"

    def _generate_tags(self, text: str) -> List[str]:
        tag_map = {
            "budget": ["budget", "finance", "dépense"],
            "juridique": ["loi", "décret", "arrêté", "juridique"],
            "ressources-humaines": ["agent", "fonctionnaire", "recrutement", "salaire"],
            "infrastructure": ["infrastructure", "bâtiment", "travaux", "construction"],
            "santé": ["santé", "médical", "hôpital", "médicament"],
            "éducation": ["école", "université", "enseignement", "formation"],
        }
        found = []
        text_lower = text.lower()
        for tag, keywords in tag_map.items():
            if any(kw in text_lower for kw in keywords):
                found.append(tag)
        return found

    def _detect_language(self, text: str) -> str:
        arabic = len(re.findall(r'[؀-ۿ]', text))
        if arabic > 50:
            return "ar"
        return "fr"

    async def answer_question(self, question: str, context: str) -> str:
        if self.llm_provider:
            try:
                return await self._answer_with_llm(question, context)
            except Exception as e:
                logger.error("LLM QA failed", error=str(e))
        return self._answer_with_rules(question, context)

    async def _answer_with_llm(self, question: str, context: str) -> str:
        prompt = f"""Tu es l'assistant IA de la PNGA (Plateforme Nationale de Gestion des Archives de Djibouti).
Réponds à la question de l'archiviste basé sur le contexte fourni.

CONTEXTE (documents trouvés):
{context[:2000]}

QUESTION: {question}

Réponds en français de façon concise et professionnelle."""

        if self.llm_provider == "anthropic":
            import anthropic
            message = self.client.messages.create(
                model="claude-haiku-4-5-20251001",
                max_tokens=512,
                messages=[{"role": "user", "content": prompt}],
            )
            return message.content[0].text
        else:
            response = self.client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[{"role": "user", "content": prompt}],
            )
            return response.choices[0].message.content

    def _answer_with_rules(self, question: str, context: str) -> str:
        return (
            f"Basé sur les archives disponibles, voici ce que j'ai trouvé concernant "
            f"votre question: '{question}'. {context[:200] if context else 'Aucun document correspondant trouvé.'}"
        )

    async def generate_summary(self, text: str, language: str = "fr") -> str:
        if len(text) < 100:
            return text
        sentences = re.split(r'[.!?]+', text)
        meaningful = [s.strip() for s in sentences if len(s.strip()) > 40]
        return ". ".join(meaningful[:3]) + "." if meaningful else text[:300]

    async def detect_duplicates(self, text: str, existing_texts: List[str]) -> List[Dict]:
        results = []
        words_new = set(text.lower().split())
        for i, existing in enumerate(existing_texts):
            words_existing = set(existing.lower().split())
            if not words_new or not words_existing:
                continue
            intersection = len(words_new & words_existing)
            union = len(words_new | words_existing)
            similarity = intersection / union if union > 0 else 0
            if similarity > 0.7:
                results.append({"index": i, "similarity": similarity})
        return results


ai_service = AIDocumentService()
