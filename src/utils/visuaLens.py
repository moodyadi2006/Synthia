import io
import pytesseract
from PIL import Image
from transformers import BlipProcessor, BlipForConditionalGeneration, pipeline
from fastapi import HTTPException

# Load models
blip_processor = BlipProcessor.from_pretrained("Salesforce/blip-image-captioning-large", use_fast=True)
blip_model = BlipForConditionalGeneration.from_pretrained("Salesforce/blip-image-captioning-large")
summarizer = pipeline("summarization", model="facebook/bart-large-cnn")

def is_text_heavy(image: Image.Image, threshold: int = 30) -> bool:
    """Check if the image is likely document-type using OCR word count."""
    text = pytesseract.image_to_string(image)
    return len(text.strip().split()) >= threshold

def extract_and_summarize_image(file_content: bytes):
    """Handles both document-like and visual images and returns in-depth summaries."""
    try:
        image = Image.open(io.BytesIO(file_content)).convert("RGB")

        if is_text_heavy(image):
            print("Text-heavy image detected. Using OCR + enriched Summarization...")
            text = pytesseract.image_to_string(image).strip()
            if not text:
                raise ValueError("OCR failed to detect text.")

            # Only pass extracted text to the summarizer
            summary = summarizer(text, min_length=80, max_length=500, do_sample=False)[0]['summary_text']

            return {
                "mode": "ocr",
                "summary": summary,
                "raw_text": text
            }

        else:
            print("Visual image detected. Using BLIP caption + enriched summarization...")
            inputs = blip_processor(images=image, return_tensors="pt")
            out = blip_model.generate(**inputs)
            caption = blip_processor.decode(out[0], skip_special_tokens=True)

            # Only pass caption to the summarizer
            summary = summarizer(caption, min_length=80, max_length=500, do_sample=False)[0]['summary_text']

            return {
                "mode": "vision",
                "caption": caption,
                "summary": summary
            }

    except Exception as e:
        print(f"Image processing error: {e}")
        raise HTTPException(status_code=500, detail=f"Image analysis failed: {str(e)}")
