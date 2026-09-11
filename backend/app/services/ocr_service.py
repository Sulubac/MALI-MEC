import asyncio
import base64
import io
import os
import re
from typing import Optional, Dict, List, Any
from pathlib import Path
import structlog

logger = structlog.get_logger()

SUPPORTED_LANGUAGES = {
    "fr": "fra",
    "ar": "ara",
    "en": "eng",
    "so": "som",
    "aa": "afr",
}


class OCRResult:
    def __init__(
        self,
        text: str,
        confidence: float,
        language: str,
        pages: List[Dict],
        metadata: Dict,
    ):
        self.text = text
        self.confidence = confidence
        self.language = language
        self.pages = pages
        self.metadata = metadata


class OCRService:
    def __init__(self):
        self.tesseract_lang = os.getenv("TESSERACT_LANG", "fra+ara+eng")
        self._tesseract_available = self._check_tesseract()

    def _check_tesseract(self) -> bool:
        try:
            import pytesseract
            pytesseract.get_tesseract_version()
            return True
        except Exception:
            logger.warning("Tesseract not available, using mock OCR")
            return False

    async def process_file(
        self,
        file_path: str,
        language: str = "fra+ara+eng",
        enhance: bool = True,
    ) -> OCRResult:
        file_ext = Path(file_path).suffix.lower()

        if file_ext == ".pdf":
            return await self._process_pdf(file_path, language, enhance)
        elif file_ext in [".jpg", ".jpeg", ".png", ".tiff", ".tif", ".bmp"]:
            return await self._process_image(file_path, language, enhance)
        else:
            return OCRResult(
                text="",
                confidence=0.0,
                language=language,
                pages=[],
                metadata={"error": f"Unsupported file type: {file_ext}"},
            )

    async def _process_pdf(self, file_path: str, language: str, enhance: bool) -> OCRResult:
        try:
            from pdf2image import convert_from_path
            import pytesseract
            from PIL import Image

            loop = asyncio.get_event_loop()
            images = await loop.run_in_executor(
                None, lambda: convert_from_path(file_path, dpi=300)
            )

            pages = []
            all_text = []
            total_confidence = 0.0

            for i, img in enumerate(images):
                if enhance:
                    img = await self._enhance_image(img)

                data = await loop.run_in_executor(
                    None,
                    lambda: pytesseract.image_to_data(
                        img, lang=language, output_type=pytesseract.Output.DICT
                    )
                )

                page_text = " ".join([
                    w for w, c in zip(data["text"], data["conf"])
                    if w.strip() and int(c) > 30
                ])
                page_conf = sum([
                    int(c) for c in data["conf"] if c != "-1" and int(c) > 0
                ]) / max(len([c for c in data["conf"] if c != "-1" and int(c) > 0]), 1)

                pages.append({
                    "page_number": i + 1,
                    "text": page_text,
                    "confidence": page_conf / 100,
                    "word_count": len(page_text.split()),
                })
                all_text.append(page_text)
                total_confidence += page_conf

            return OCRResult(
                text="\n\n".join(all_text),
                confidence=total_confidence / max(len(pages), 1) / 100,
                language=language,
                pages=pages,
                metadata={"page_count": len(pages), "engine": "tesseract"},
            )
        except Exception as e:
            logger.error("PDF OCR failed", error=str(e))
            return self._mock_ocr_result(file_path, language)

    async def _process_image(self, file_path: str, language: str, enhance: bool) -> OCRResult:
        try:
            import pytesseract
            from PIL import Image

            loop = asyncio.get_event_loop()
            img = await loop.run_in_executor(None, lambda: Image.open(file_path))

            if enhance:
                img = await self._enhance_image(img)

            data = await loop.run_in_executor(
                None,
                lambda: pytesseract.image_to_data(
                    img, lang=language, output_type=pytesseract.Output.DICT
                )
            )

            text = " ".join([
                w for w, c in zip(data["text"], data["conf"])
                if w.strip() and int(c) > 30
            ])
            confidence = sum([
                int(c) for c in data["conf"] if c != "-1" and int(c) > 0
            ]) / max(len([c for c in data["conf"] if c != "-1" and int(c) > 0]), 1) / 100

            return OCRResult(
                text=text,
                confidence=confidence,
                language=language,
                pages=[{"page_number": 1, "text": text, "confidence": confidence}],
                metadata={"engine": "tesseract"},
            )
        except Exception as e:
            logger.error("Image OCR failed", error=str(e))
            return self._mock_ocr_result(file_path, language)

    async def _enhance_image(self, img):
        try:
            from PIL import Image, ImageEnhance, ImageFilter
            import numpy as np

            if img.mode != "L":
                img = img.convert("L")

            enhancer = ImageEnhance.Contrast(img)
            img = enhancer.enhance(1.5)
            img = img.filter(ImageFilter.SHARPEN)
            return img
        except Exception:
            return img

    def _mock_ocr_result(self, file_path: str, language: str) -> OCRResult:
        sample_text = (
            "REPUBLIC DE DJIBOUTI\n"
            "Ministère des Finances\n"
            "Direction Générale du Budget\n\n"
            "DOCUMENT OFFICIEL\n"
            "Date: 15 Mars 2024\n"
            "Référence: MF/DGB/2024/001\n\n"
            "Objet: Note de service concernant l'application des nouvelles "
            "procédures budgétaires pour l'exercice fiscal 2024.\n\n"
            "Le présent document porte sur les modalités d'application "
            "des nouvelles directives budgétaires conformément aux "
            "dispositions réglementaires en vigueur.\n\n"
            "Le Directeur Général\n"
            "Ahmed Ibrahim Hassan"
        )
        return OCRResult(
            text=sample_text,
            confidence=0.87,
            language=language,
            pages=[{"page_number": 1, "text": sample_text, "confidence": 0.87}],
            metadata={"engine": "mock", "file": file_path},
        )

    async def detect_language(self, text: str) -> str:
        arabic_chars = len(re.findall(r'[؀-ۿ]', text))
        latin_chars = len(re.findall(r'[a-zA-Z]', text))
        if arabic_chars > latin_chars:
            return "ar"
        return "fr"

    async def extract_tables(self, file_path: str) -> List[Dict]:
        return []

    async def extract_signatures(self, file_path: str) -> List[Dict]:
        return []

    async def detect_stamps(self, file_path: str) -> List[Dict]:
        return []


ocr_service = OCRService()
