import re
import os
from typing import List, Tuple, Optional, Union
from dotenv import load_dotenv
from supadata import Supadata

# Load environment variables
load_dotenv()

SUPADATA_API_KEY = os.getenv("SUPADATA_API_KEY")
if not SUPADATA_API_KEY:
    raise ValueError("SUPADATA_API_KEY not found in environment variables")

# Initialize Supadata
supadata = Supadata(api_key=SUPADATA_API_KEY)


def extract_video_id(youtube_url: str) -> Optional[str]:
    """Extract video ID from various YouTube URL formats."""
    patterns = [
        r"(?:v=|\/)([0-9A-Za-z_-]{11}).*",
        r"(?:embed\/)([0-9A-Za-z_-]{11})",
        r"(?:youtu\.be\/)([0-9A-Za-z_-]{11})",
    ]
    for pattern in patterns:
        match = re.search(pattern, youtube_url)
        if match:
            return match.group(1)
    return None


def extract_text_segments(transcript: Union[dict, list, object]) -> List[str]:
    """Extract text from Supadata transcript response."""
    try:
        print(f"Transcript structure: {type(transcript)}")

        if hasattr(transcript, 'content') and hasattr(transcript, 'lang'):
            print(f"Language detected: {transcript.lang}")
            if hasattr(transcript, 'available_langs'):
                print(f"Available languages: {transcript.available_langs}")

            text_segments = []
            for chunk in transcript.content:
                if hasattr(chunk, 'text'):
                    text_segments.append(chunk.text)
                else:
                    text_segments.append(str(chunk))
            return text_segments

        elif isinstance(transcript, dict):
            print(f"Transcript keys: {transcript.keys()}")

            if "content" in transcript:
                if isinstance(transcript["content"], list):
                    return [segment.get("text", "") for segment in transcript["content"] if isinstance(segment, dict)]
                else:
                    return [str(transcript["content"])]
            elif "transcript" in transcript:
                content = transcript["transcript"]
                if isinstance(content, list):
                    return [segment.get("text", "") for segment in content if isinstance(segment, dict)]
                else:
                    return [str(content)]
            elif "text" in transcript:
                return [transcript["text"]]
            else:
                text_values = []
                for key, value in transcript.items():
                    if isinstance(value, str):
                        text_values.append(value)
                    elif isinstance(value, list):
                        for item in value:
                            if isinstance(item, dict) and "text" in item:
                                text_values.append(item["text"])
                            elif isinstance(item, str):
                                text_values.append(item)
                return text_values if text_values else [str(transcript)]

        elif isinstance(transcript, list):
            result = []
            for item in transcript:
                if hasattr(item, 'text'):
                    result.append(item.text)
                elif isinstance(item, dict) and "text" in item:
                    result.append(item["text"])
                elif isinstance(item, str):
                    result.append(item)
            return result if result else [str(transcript)]

        return [str(transcript)]

    except Exception as e:
        print(f"Error extracting text segments: {e}")
        return [str(transcript)]


def extract_transcript_details(youtube_url: str) -> Tuple[Optional[List[str]], Optional[str]]:
    """Main function to extract transcript segments from a YouTube URL."""
    try:
        video_id = extract_video_id(youtube_url)
        if not video_id:
            return None, "Error: Invalid YouTube URL."

        try:
            transcript_response = supadata.youtube.transcript(video_id, lang='en')
        except Exception as lang_error:
            print(f"English transcript not available, trying auto-detection: {lang_error}")
            transcript_response = supadata.youtube.transcript(video_id)

            if hasattr(transcript_response, 'lang') and transcript_response.lang != 'en':
                print(f"Warning: Transcript is in {transcript_response.lang}, not English")
                if hasattr(transcript_response, 'available_langs') and 'en' in transcript_response.available_langs:
                    try:
                        transcript_response = supadata.youtube.transcript(video_id, lang='en')
                        print(f"Successfully retrieved English transcript")
                    except:
                        return None, f"Error: English transcript is listed as available but could not be retrieved. Available languages: {transcript_response.available_langs}"

        text_segments = extract_text_segments(transcript_response)

        if not text_segments:
            return None, "Error: No transcript content found."

        return text_segments, None

    except Exception as e:
        error_msg = str(e)
        print(f"Exception in extract_transcript_details: {error_msg}")

        if "not found" in error_msg.lower() or "404" in error_msg:
            return None, "Error: Video not found or transcript not available."
        elif "private" in error_msg.lower() or "403" in error_msg:
            return None, "Error: Video is private or restricted."
        elif "quota" in error_msg.lower() or "rate limit" in error_msg.lower():
            return None, "Error: API quota exceeded. Please try again later."
        elif "language" in error_msg.lower():
            return None, "Error: English transcript not available for this video."
        else:
            return None, f"Error: Unexpected issue – {error_msg}"
