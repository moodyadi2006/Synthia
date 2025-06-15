from dotenv import load_dotenv
import os
from groq import Groq
from utils.ytvideo_transcripter import extract_video_id, extract_transcript_details
from langchain_groq import ChatGroq
from langchain_core.output_parsers import StrOutputParser

# Load environment variables
load_dotenv()

# Fetch the API key
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
if not GROQ_API_KEY:
    raise ValueError("GROQ_API_KEY not found in environment variables")


def generate_summary(transcript: list) -> str:
    print(f"Transcript received: {type(transcript)} with {len(transcript) if isinstance(transcript, list) else 'N/A'} items")
    
    # Convert transcript list to text
    if isinstance(transcript, list):
        if all(isinstance(item, dict) for item in transcript):
            transcript_text = " ".join(item.get('text', '') for item in transcript)
        else:
            transcript_text = " ".join(str(item) for item in transcript)
    else:
        transcript_text = str(transcript)
    
    # Truncate if too long (Groq has token limits)
    if len(transcript_text) > 50000:
        transcript_text = transcript_text[:50000] + "..."

    # Prompt for the summary
    summary_prompt = f"""
You are a summarization assistant skilled at creating clear and informative summaries.

Your task is to analyze the following text and produce a structured bullet-point summary that conveys the key ideas with a bit more detail.

Instructions:
- Start each bullet with a short, descriptive title in plain text (no bold or markdown), followed by a clear, informative explanation.
- Include relevant context and reasoning where helpful, but keep each bullet focused and concise.
- Avoid copying the original wording — paraphrase in your own words for clarity.
- Do not use generic phrases like "The summary is" or "In conclusion".
- Do not include any Introductory sentence like "Here is a structured summary" or "Here is a summary".
- Aim to capture the essence of the discussion, including actions, motivations, or important insights.

Input:
{transcript_text}

Summary:
"""
    
    try:
        summary_model = ChatGroq(
            temperature=0.5,
            model_name="llama3-70b-8192",
            api_key=GROQ_API_KEY
        )

        response = summary_model.invoke(summary_prompt)

        # Some models return an object with `.content`, some return string — handle both
        if hasattr(response, "content"):
            summary_text = response.content
        else:
            summary_text = str(response)

        return summary_text

    except Exception as e:
        print(f"⚠️ Error in generate_summary: {e}")
        return "Error generating summary."


def process_video(youtube_link: str) -> dict:
    if not youtube_link:
        return {"error": "Enter a YouTube URL."}
    
    try:
        video_id = extract_video_id(youtube_link)
        if not video_id:
            return {"error": "Invalid YouTube URL."}
        
        print(f"Extracted video ID: {video_id}")
        
        thumbnail = f"http://img.youtube.com/vi/{video_id}/0.jpg"
        transcript, err = extract_transcript_details(youtube_link)
        
        if err or not transcript:
            return {"error": err or "No transcript extracted.", "thumbnail": thumbnail}
        
        summary = generate_summary(transcript)
        return {"summary": summary, "thumbnail": thumbnail, "video_id": video_id}
    
    except Exception as e:
        return {"error": f"Unexpected error: {str(e)}"}
