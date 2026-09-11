import json
from typing import List, Dict, Any, Optional
import structlog

logger = structlog.get_logger()


class SearchService:
    def __init__(self):
        self.client = None
        self.index_prefix = "pnga"
        self._init_client()

    def _init_client(self):
        try:
            from elasticsearch import AsyncElasticsearch
            from app.config import settings
            self.client = AsyncElasticsearch([settings.ELASTICSEARCH_URL])
            logger.info("Elasticsearch client initialized")
        except Exception as e:
            logger.warning("Elasticsearch not available, using in-memory search", error=str(e))

    async def index_document(self, doc_id: str, data: Dict) -> bool:
        if not self.client:
            return True
        try:
            index = f"{self.index_prefix}_documents"
            await self.client.index(index=index, id=str(doc_id), document=data)
            return True
        except Exception as e:
            logger.error("Indexing failed", doc_id=doc_id, error=str(e))
            return False

    async def search(
        self,
        query: str,
        filters: Optional[Dict] = None,
        page: int = 1,
        size: int = 20,
        sort_by: str = "_score",
        sort_order: str = "desc",
        institution_id: Optional[str] = None,
        date_from: Optional[str] = None,
        date_to: Optional[str] = None,
        document_types: Optional[List[str]] = None,
        confidentiality_levels: Optional[List[str]] = None,
    ) -> Dict:
        if not self.client:
            return self._mock_search(query)

        try:
            must_queries = []
            if query:
                must_queries.append({
                    "multi_match": {
                        "query": query,
                        "fields": [
                            "title^5", "title_ar^5",
                            "content_text^3",
                            "description^2",
                            "author", "institution",
                            "keywords", "reference",
                            "entities_persons", "entities_organizations",
                        ],
                        "type": "best_fields",
                        "fuzziness": "AUTO",
                    }
                })

            filter_queries = []
            if institution_id:
                filter_queries.append({"term": {"institution_id": institution_id}})
            if document_types:
                filter_queries.append({"terms": {"type": document_types}})
            if confidentiality_levels:
                filter_queries.append({"terms": {"confidentiality": confidentiality_levels}})
            if date_from or date_to:
                date_filter = {"range": {"document_date": {}}}
                if date_from:
                    date_filter["range"]["document_date"]["gte"] = date_from
                if date_to:
                    date_filter["range"]["document_date"]["lte"] = date_to
                filter_queries.append(date_filter)

            es_query = {
                "query": {
                    "bool": {
                        "must": must_queries or [{"match_all": {}}],
                        "filter": filter_queries,
                    }
                },
                "highlight": {
                    "fields": {
                        "content_text": {"fragment_size": 200},
                        "title": {},
                    }
                },
                "aggs": {
                    "by_type": {"terms": {"field": "type", "size": 20}},
                    "by_institution": {"terms": {"field": "institution_id", "size": 20}},
                    "by_year": {"date_histogram": {
                        "field": "document_date",
                        "calendar_interval": "year",
                    }},
                },
                "from": (page - 1) * size,
                "size": size,
            }

            response = await self.client.search(
                index=f"{self.index_prefix}_documents",
                body=es_query,
            )

            hits = response["hits"]
            return {
                "total": hits["total"]["value"],
                "hits": [
                    {
                        "id": hit["_id"],
                        "score": hit["_score"],
                        "source": hit["_source"],
                        "highlight": hit.get("highlight", {}),
                    }
                    for hit in hits["hits"]
                ],
                "aggregations": response.get("aggregations", {}),
                "page": page,
                "size": size,
            }
        except Exception as e:
            logger.error("Search failed", error=str(e))
            return self._mock_search(query)

    async def semantic_search(self, question: str, k: int = 10) -> List[Dict]:
        return []

    async def natural_language_search(self, question: str) -> Dict:
        parsed = self._parse_nl_query(question)
        return await self.search(**parsed)

    def _parse_nl_query(self, question: str) -> Dict:
        import re
        params = {"query": question}

        year_match = re.search(r'\b(19|20)\d{2}\b', question)
        if year_match:
            year = year_match.group()
            params["date_from"] = f"{year}-01-01"
            params["date_to"] = f"{year}-12-31"

        type_keywords = {
            "contrat": "contrat",
            "décret": "decret",
            "arrêté": "arrete",
            "loi": "loi",
            "rapport": "rapport",
            "note": "note",
            "décision": "decision",
        }
        for kw, doc_type in type_keywords.items():
            if kw.lower() in question.lower():
                params["document_types"] = [doc_type]
                break

        return params

    async def suggest(self, prefix: str, field: str = "title") -> List[str]:
        if not self.client:
            return []
        try:
            response = await self.client.search(
                index=f"{self.index_prefix}_documents",
                body={
                    "suggest": {
                        "title_suggest": {
                            "prefix": prefix,
                            "completion": {"field": "title_suggest", "size": 10},
                        }
                    }
                },
            )
            options = response.get("suggest", {}).get("title_suggest", [{}])
            return [opt["text"] for opt in options[0].get("options", [])]
        except Exception:
            return []

    def _mock_search(self, query: str) -> Dict:
        return {
            "total": 3,
            "hits": [
                {
                    "id": "mock-1",
                    "score": 9.5,
                    "source": {
                        "title": f"Résultat pour '{query}' - Document 1",
                        "type": "rapport",
                        "institution_id": "inst-1",
                        "document_date": "2024-01-15",
                        "confidentiality": "internal",
                        "status": "archived",
                    },
                    "highlight": {"content_text": [f"...contexte relatif à <em>{query}</em>..."]},
                },
                {
                    "id": "mock-2",
                    "score": 7.2,
                    "source": {
                        "title": f"Note officielle - {query}",
                        "type": "note",
                        "institution_id": "inst-2",
                        "document_date": "2023-06-20",
                        "confidentiality": "public",
                        "status": "published",
                    },
                    "highlight": {},
                },
                {
                    "id": "mock-3",
                    "score": 5.1,
                    "source": {
                        "title": f"Contrat concernant {query}",
                        "type": "contrat",
                        "institution_id": "inst-1",
                        "document_date": "2022-03-10",
                        "confidentiality": "confidential",
                        "status": "archived",
                    },
                    "highlight": {},
                },
            ],
            "aggregations": {
                "by_type": {"buckets": [
                    {"key": "rapport", "doc_count": 1},
                    {"key": "note", "doc_count": 1},
                    {"key": "contrat", "doc_count": 1},
                ]},
            },
            "page": 1,
            "size": 20,
        }

    async def delete_document(self, doc_id: str) -> bool:
        if not self.client:
            return True
        try:
            await self.client.delete(index=f"{self.index_prefix}_documents", id=str(doc_id))
            return True
        except Exception:
            return False

    async def reindex_all(self, documents: List[Dict]) -> int:
        count = 0
        for doc in documents:
            if await self.index_document(doc["id"], doc):
                count += 1
        return count


search_service = SearchService()
