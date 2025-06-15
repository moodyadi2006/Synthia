from langchain_groq import ChatGroq
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
from langchain_core.messages import HumanMessage
from dotenv import load_dotenv
import os
import time
import tiktoken

load_dotenv()

GROQ_API_KEY = os.getenv("GROQ_API_KEY")
if not GROQ_API_KEY:
    raise ValueError("GROQ_API_KEY not found in environment variables")

MAX_TOKENS_PER_CHUNK = 1500  # To stay below Groq's TPM
ENCODER = tiktoken.encoding_for_model("gpt-4")  # Close enough for token count approximation

def estimate_tokens(text: str) -> int:
    return len(ENCODER.encode(text))

def chunk_text(text: str, max_tokens: int = MAX_TOKENS_PER_CHUNK) -> list:
    words = text.split()
    chunks, chunk = [], []
    tokens = 0

    for word in words:
        word_tokens = estimate_tokens(word + " ")
        if tokens + word_tokens > max_tokens:
            chunks.append(" ".join(chunk))
            chunk, tokens = [], 0
        chunk.append(word)
        tokens += word_tokens

    if chunk:
        chunks.append(" ".join(chunk))
    return chunks

def preprocess_elements(elements, is_table=False):
    processed = []
    for el in elements:
        content = getattr(el, 'text_as_html', getattr(el, 'text', str(el))) if is_table else str(el)
        if estimate_tokens(content) > MAX_TOKENS_PER_CHUNK:
            processed.extend(chunk_text(content))
        else:
            processed.append(content)
    return processed

def summarize_elements(elements, summarize_chain, is_table=False):
    if not elements:
        return []

    # Preprocess elements to handle token limits and chunking
    elements = preprocess_elements(elements, is_table)

    summaries = []
    chunk_size = 2
    i = 0
    backoff = 10

    while i < len(elements):
        chunk = elements[i:i + chunk_size]
        try:
            result = summarize_chain.batch(chunk, {"max_concurrency": 3})
            summaries += result
            i += chunk_size
            backoff = 10  # reset backoff on success
        except Exception as e:
            error_msg = str(e)
            print(f"Error summarizing elements: {error_msg}")

            # Handle rate limiting with exponential backoff
            if "rate_limit_exceeded" in error_msg or "Rate limit reached" in error_msg:
                print(f"Rate limit hit. Waiting for {backoff}s before retrying...")
                time.sleep(backoff)
                backoff = min(backoff * 2, 60)  # Cap at 60 seconds
            else:
                # For other errors, skip this chunk and continue
                print(f"Skipping chunk due to error: {error_msg}")
                i += chunk_size
                break
    
    return summaries

def summarize_all(texts: list, tables: list, images: list) -> dict:
    summary_model = ChatGroq(
        temperature=0.5,
        model_name="llama3-70b-8192",
        api_key=GROQ_API_KEY
    )
    
    # Prompt modified to request a brief and concise summary only
    summary_prompt = ChatPromptTemplate.from_template("""
You are a concise summarization assistant.

Summarize the following text or table using clear bullet points.

Instructions:
- Do not include phrases like "Here is a summary of the text in clear bullet points", "The summary is", "Below is", "In conclusion" or something like that.
- Start each bullet with a short title in plain text (no bold or markdown), followed by a colon and a brief explanation.
- Do not copy the original phrasing. Rephrase it clearly and briefly.
- Focus only on meaningful and essential points.
- If the input is a table, extract patterns, trends, or comparisons.
- Do not begin your summary with phrases like "Here is a detailed summary," "Summary:", "Here is a summary of the text in clear bullet points" or any introductory statement. Start directly with the Heading and its explanation.

Input:
{element}

Summary:
""")

    
    summarize_chain = {"element": lambda x: x} | summary_prompt | summary_model | StrOutputParser()
    
    text_summaries = summarize_elements(texts, summarize_chain, is_table=False)
    table_summaries = summarize_elements(tables, summarize_chain, is_table=True)
    
    image_summaries = []
    if images:
        try:
            groq_chat = ChatGroq(model_name="meta-llama/llama-4-maverick-17b-128e-instruct", api_key=GROQ_API_KEY)
            
            for image_b64 in images:
                message = HumanMessage(content=[
                    {"type": "text", "text": "Provide a brief summary describing what is shown in the image."},
                    {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{image_b64}"}}
                ])
                response = groq_chat.invoke([message])
                image_summaries.append(response.content)
                
        except Exception as e:
            print(f"Error summarizing images: {e}")
    
    return {
        "text_summaries": text_summaries,
        "table_summaries": table_summaries,
        "image_summaries": image_summaries,
    }