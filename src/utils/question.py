import os
import base64
import io
import time
from typing import List, Optional, Dict, Any
from PIL import Image
from dotenv import load_dotenv
import tiktoken

from langchain.schema.document import Document
from langchain_community.llms import Ollama
from langchain_groq import ChatGroq
from langchain.prompts import PromptTemplate
from langchain.chains import LLMChain
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser

load_dotenv()

# CRITICAL: Updated rate limiting configuration for Groq
MAX_TOKENS_PER_CHUNK = 800  # Reduced from 1500
ENCODER = tiktoken.encoding_for_model("gpt-4")
# CRITICAL: Reduced total context to leave more room for prompt template and response
MAX_CONTEXT_TOKENS = 3500  # Reduced from 6000 to account for Groq's 6000 TPM limit
GROQ_RATE_LIMIT = 6000  # Groq's actual limit
PROMPT_OVERHEAD = 800  # Estimated tokens for prompt template
RESPONSE_BUFFER = 1000  # Buffer for model response

def estimate_tokens(text: str) -> int:
    """Estimate token count for given text"""
    return len(ENCODER.encode(text))

def calculate_safe_context_limit(question: str) -> int:
    """Calculate how many tokens we can safely use for context"""
    question_tokens = estimate_tokens(question)
    available_tokens = GROQ_RATE_LIMIT - question_tokens - PROMPT_OVERHEAD - RESPONSE_BUFFER
    return max(available_tokens, 1000)  # Minimum 1000 tokens for context

def chunk_text(text: str, max_tokens: int = MAX_TOKENS_PER_CHUNK) -> List[str]:
    """Split text into chunks based on token limit"""
    words = text.split()
    chunks, chunk = [], []
    tokens = 0

    for word in words:
        word_tokens = estimate_tokens(word + " ")
        if tokens + word_tokens > max_tokens:
            if chunk:  # Only append if chunk is not empty
                chunks.append(" ".join(chunk))
                chunk, tokens = [], 0
        chunk.append(word)
        tokens += word_tokens

    if chunk:
        chunks.append(" ".join(chunk))
    return chunks

def get_llm():
    """Initialize and return the LLM based on available configuration"""
    if os.getenv("GROQ_API_KEY"):
        return ChatGroq(
            model="llama3-70b-8192",
            temperature=0,
            max_tokens=800,  # Reduced from 1000
            api_key=os.getenv("GROQ_API_KEY")
        )
    try:
        return Ollama(model="llama2", temperature=0)
    except Exception as e:
        print(f"Warning: Could not initialize Ollama: {e}")
        return MockLLM()

class MockLLM:
    def __call__(self, prompt):
        return "This is a mock response. Please configure Groq API key or Ollama to get actual responses."

    def invoke(self, messages):
        return type('MockResponse', (), {
            'content': "This is a mock response. Please configure Groq API key or Ollama to get actual responses."
        })()

def process_image_content(image_b64: str) -> str:
    """Process base64 image and return description"""
    try:
        image_data = base64.b64decode(image_b64)
        image = Image.open(io.BytesIO(image_data))
        width, height = image.size
        format_type = image.format or "Unknown"
        return f"Image ({format_type}, {width}x{height}): Image content available for analysis."
    except Exception as e:
        return f"Image processing error: {str(e)}"

def extract_source_info(doc: Document) -> Dict[str, Any]:
    """Extract source information from a document"""
    metadata = doc.metadata or {}
    
    # Extract common source fields
    source_info = {
        'file_name': metadata.get('source', metadata.get('file_name', 'Unknown')),
        'page_number': metadata.get('page', metadata.get('page_number')),
        'document_type': metadata.get('type', 'text'),
        'chunk_id': metadata.get('chunk_id'),
        'section': metadata.get('section'),
        'title': metadata.get('title'),
    }
    
    # Clean up None values
    return {k: v for k, v in source_info.items() if v is not None}

def create_source_reference(doc: Document, chunk_index: int) -> str:
    """Create a readable source reference for citation"""
    source_info = extract_source_info(doc)
    
    parts = []
    if source_info.get('file_name'):
        file_name = os.path.basename(str(source_info['file_name']))
        parts.append(f"File: {file_name}")
    
    if source_info.get('page_number'):
        parts.append(f"Page: {source_info['page_number']}")
    
    if source_info.get('section'):
        parts.append(f"Section: {source_info['section']}")
    
    if source_info.get('document_type'):
        parts.append(f"Type: {source_info['document_type']}")
    
    # Add chunk identifier for tracking
    parts.append(f"Ref: [{chunk_index}]")
    
    return " | ".join(parts) if parts else f"Source [{chunk_index}]"

def preprocess_context_with_sources(context: str, question: str, relevant_docs: Optional[List[Document]] = None) -> tuple[str, List[str]]:
    """
    Preprocess the context to fit within token limits while maintaining relevance and source tracking
    Returns clean text sources for frontend
    """
    # Calculate safe context limit based on question size
    safe_context_limit = calculate_safe_context_limit(question)
    
    # Check if context fits within available tokens
    context_tokens = estimate_tokens(context)
    
    sources_used = []
    
    print(f"Context tokens: {context_tokens}, Safe limit: {safe_context_limit}")
    
    if context_tokens <= safe_context_limit:
        # If we have relevant_docs, extract actual text content for sources
        if relevant_docs:
            for i, doc in enumerate(relevant_docs):
                # Extract clean text content for frontend
                source_text = doc.page_content.strip()
                if source_text:  # Only add non-empty sources
                    sources_used.append(source_text)
        
        return context, sources_used
    
    # If context is too long, chunk it and fit what we can
    print(f"Context too long ({context_tokens} tokens). Chunking to fit {safe_context_limit} tokens.")
    
    # Split context into sections (assuming sections are separated by double newlines)
    sections = context.split('\n\n')
    
    optimized_parts = []
    current_tokens = 0
    
    for i, section in enumerate(sections):
        section_tokens = estimate_tokens(section)
        
        if current_tokens + section_tokens <= safe_context_limit:
            optimized_parts.append(section)
            current_tokens += section_tokens
            
            # Track source text if available
            if relevant_docs and i < len(relevant_docs):
                source_text = relevant_docs[i].page_content.strip()
                if source_text:
                    sources_used.append(source_text)
        else:
            # Try to fit a truncated version of this section
            remaining_tokens = safe_context_limit - current_tokens
            
            if remaining_tokens > 100:  # Only if we have reasonable space left
                # Chunk the section and take what fits
                section_chunks = chunk_text(section, remaining_tokens - 20)  # Leave some buffer
                if section_chunks:
                    optimized_parts.append(section_chunks[0] + "... [truncated]")
                    
                    # Track source for truncated content
                    if relevant_docs and i < len(relevant_docs):
                        source_text = relevant_docs[i].page_content.strip()
                        if source_text:
                            # Add truncation note to source text
                            truncated_source = source_text[:500] + "... [truncated]" if len(source_text) > 500 else source_text
                            sources_used.append(truncated_source)
            break
    
    if not optimized_parts:
        # Fallback: take first chunk of the entire context
        context_chunks = chunk_text(context, safe_context_limit)
        context_result = context_chunks[0] + "... [truncated due to length]" if context_chunks else ""
        
        # Add generic source info if available
        if relevant_docs and len(relevant_docs) > 0:
            source_text = relevant_docs[0].page_content.strip()
            if source_text:
                truncated_source = source_text[:500] + "... [truncated]" if len(source_text) > 500 else source_text
                sources_used.append(truncated_source)
        
        return context_result, sources_used
    
    final_context = '\n\n'.join(optimized_parts)
    final_tokens = estimate_tokens(final_context)
    print(f"Final context tokens: {final_tokens}")
    
    return final_context, sources_used

def preprocess_documents_with_chunking_and_sources(relevant_docs: List[Document]) -> tuple[List[str], List[str]]:
    """Preprocess documents with chunking to manage token limits and track clean text sources"""
    processed_chunks = []
    sources_text = []
    
    for i, doc in enumerate(relevant_docs):
        doc_type = doc.metadata.get("type", "text")
        
        if doc_type == "text":
            content = f"Text Content: {doc.page_content}"
        elif doc_type == "table":
            content = f"Table Content: {doc.page_content}"
        elif doc_type == "image":
            image_description = process_image_content(doc.page_content)
            content = f"Image Content: {image_description}"
        else:
            content = f"Content: {doc.page_content}"
        
        # Store clean text for sources array
        source_text = doc.page_content.strip()
        
        # Check if content exceeds token limit and chunk if necessary
        if estimate_tokens(content) > MAX_TOKENS_PER_CHUNK:
            chunks = chunk_text(content, MAX_TOKENS_PER_CHUNK)
            for j, chunk in enumerate(chunks):
                processed_chunks.append(f"[{i}] {chunk}")
                # For chunked content, add the original source text only once
                if j == 0 and source_text:
                    sources_text.append(source_text)
        else:
            processed_chunks.append(f"[{i}] {content}")
            if source_text:
                sources_text.append(source_text)
    
    return processed_chunks, sources_text

def create_optimized_context_with_sources(processed_chunks: List[str], sources_text: List[str], question: str) -> tuple[str, List[str]]:
    """Create context that fits within token limits while prioritizing relevance and tracking clean text sources"""
    safe_context_limit = calculate_safe_context_limit(question)
    
    context_parts = []
    sources_used = []
    current_tokens = 0
    
    # Prioritize chunks (you could implement relevance scoring here)
    for i, chunk in enumerate(processed_chunks):
        chunk_tokens = estimate_tokens(chunk)
        
        if current_tokens + chunk_tokens <= safe_context_limit:
            context_parts.append(chunk)
            current_tokens += chunk_tokens
            # Add corresponding source text if available
            if i < len(sources_text) and sources_text[i] not in sources_used:
                sources_used.append(sources_text[i])
        else:
            # If we can't fit the whole chunk, try to fit a truncated version
            remaining_tokens = safe_context_limit - current_tokens
            if remaining_tokens > 100:  # Only if we have reasonable space left
                words = chunk.split()
                truncated_chunk = []
                temp_tokens = 0
                
                for word in words:
                    word_tokens = estimate_tokens(word + " ")
                    if temp_tokens + word_tokens <= remaining_tokens:
                        truncated_chunk.append(word)
                        temp_tokens += word_tokens
                    else:
                        break
                
                if truncated_chunk:
                    context_parts.append(" ".join(truncated_chunk) + "... [truncated]")
                    # Add corresponding source text (truncated) if available
                    if i < len(sources_text):
                        source_text = sources_text[i]
                        if source_text not in sources_used:
                            truncated_source = source_text[:500] + "... [truncated]" if len(source_text) > 500 else source_text
                            sources_used.append(truncated_source)
            break
    
    final_context = "\n\n".join(context_parts)
    final_tokens = estimate_tokens(final_context)
    print(f"Final optimized context tokens: {final_tokens}")
    
    return final_context, sources_used

def validate_request_size(question: str, context: str) -> bool:
    """Validate that the total request size is within Groq limits"""
    question_tokens = estimate_tokens(question)
    context_tokens = estimate_tokens(context)
    
    # Account for prompt template overhead
    prompt_template_sample = """
You are an AI assistant that answers questions based on provided document content. 
The content may include text, tables, and images from a PDF, document or image.
Each piece of content is marked with a reference number in square brackets [0], [1], etc.

Context from the document:
{context}

Question: {question}

Please provide a comprehensive answer based on the context provided. When referencing specific information, include the reference number in square brackets (e.g., [0], [1]) to indicate which source you're citing.

Guidelines:
1. Be specific and cite relevant parts of the context with reference numbers
2. If referencing tables or images, mention them specifically with their reference numbers
3. If information is incomplete, acknowledge this
4. Provide a clear, well-structured answer
5. Always include reference numbers when citing specific information
6. Do not include "According to the context" or similar phrases, directly give the answer

Answer:"""
    
    template_tokens = estimate_tokens(prompt_template_sample.replace("{context}", "").replace("{question}", ""))
    total_tokens = question_tokens + context_tokens + template_tokens
    
    print(f"Token breakdown - Question: {question_tokens}, Context: {context_tokens}, Template: {template_tokens}, Total: {total_tokens}")
    
    # Leave buffer for response
    return total_tokens < (GROQ_RATE_LIMIT - RESPONSE_BUFFER)

def answer_question_with_sources(question: str, context: str, relevant_docs: Optional[List[Document]] = None) -> Dict[str, Any]:
    """
    Enhanced answer_question function that returns both answer and clean text sources
    
    Args:
        question: The question to answer
        context: Pre-prepared context string from serve.py
        relevant_docs: Optional list of documents for source tracking
    
    Returns:
        Dictionary containing 'answer', 'sources' (array of text), and 'total_sources'
    """
    try:
        llm = get_llm()
        
        # Preprocess the context to fit within token limits and track clean text sources
        optimized_context, sources_used = preprocess_context_with_sources(context, question, relevant_docs)
        
        # Validate request size before sending
        if not validate_request_size(question, optimized_context):
            print("Request still too large after optimization, further reducing context...")
            # Emergency context reduction
            emergency_limit = calculate_safe_context_limit(question) // 2
            context_chunks = chunk_text(optimized_context, emergency_limit)
            optimized_context = context_chunks[0] + "... [heavily truncated due to size limits]" if context_chunks else ""
        
        # Shorter prompt template to save tokens
        prompt_template = PromptTemplate(
            input_variables=["question", "context"],
            template="""Based on the document content below, answer the question. Include reference numbers [0], [1], etc. when citing.

Context:
{context}

Question: {question}

Answer:"""
        )

        # Implement retry logic with exponential backoff for rate limiting
        max_retries = 3
        backoff_time = 2  # Start with 2 seconds
        
        for attempt in range(max_retries):
            try:
                if hasattr(llm, 'invoke'):
                    formatted_prompt = prompt_template.format(
                        question=question, 
                        context=optimized_context
                    )
                    
                    # Final validation
                    final_tokens = estimate_tokens(formatted_prompt)
                    print(f"Final request tokens: {final_tokens}")
                    
                    if final_tokens >= GROQ_RATE_LIMIT - RESPONSE_BUFFER:
                        # Emergency fallback - use only first 1000 tokens of context
                        emergency_context = chunk_text(optimized_context, 1000)[0] if optimized_context else ""
                        formatted_prompt = prompt_template.format(
                            question=question, 
                            context=emergency_context + "... [emergency truncation]"
                        )
                        print(f"Emergency truncation applied. New token count: {estimate_tokens(formatted_prompt)}")
                    
                    response = llm.invoke(formatted_prompt)
                    answer = response.content if hasattr(response, 'content') else str(response)
                else:
                    chain = LLMChain(llm=llm, prompt=prompt_template)
                    answer = chain.run(question=question, context=optimized_context)
                
                # Return clean response with text-only sources
                return {
                    'answer': answer,
                    'sources': sources_used,  # Now contains only clean text content
                    'total_sources': len(sources_used)
                }
                    
            except Exception as e:
                error_msg = str(e)
                print(f"Attempt {attempt + 1} failed: {error_msg}")
                
                # Check if it's a rate limit error
                if ("rate_limit_exceeded" in error_msg.lower() or 
                    "rate limit reached" in error_msg.lower() or
                    "too many requests" in error_msg.lower() or
                    "request too large" in error_msg.lower()):
                    
                    if attempt < max_retries - 1:
                        print(f"Rate limit hit. Waiting for {backoff_time}s before retrying...")
                        time.sleep(backoff_time)
                        backoff_time = min(backoff_time * 2, 60)  # Exponential backoff, max 60s
                        
                        # Reduce context size for retry
                        optimized_context = chunk_text(optimized_context, len(optimized_context.split()) // 2)[0] if optimized_context else ""
                        continue
                    else:
                        return {
                            'answer': "I apologize, but the request is too large for the current rate limits. Please try with a shorter question or smaller document.",
                            'sources': [],
                            'total_sources': 0
                        }
                else:
                    # For non-rate-limit errors, don't retry
                    raise e

    except Exception as e:
        print(f"Error in answer_question_with_sources: {e}")
        return {
            'answer': f"I apologize, but I encountered an error while processing your question: {str(e)}.",
            'sources': [],
            'total_sources': 0
        }

# Enhanced legacy function signature that now returns clean text sources
def answer_question_legacy_with_sources(question: str, relevant_docs: List[Document]) -> Dict[str, Any]:
    """
    Legacy version that processes documents directly and returns clean text sources
    """
    # Preprocess documents with chunking and clean text source tracking
    processed_chunks, sources_text = preprocess_documents_with_chunking_and_sources(relevant_docs)
    
    # Create optimized context that fits within token limits
    enhanced_context, sources_used = create_optimized_context_with_sources(processed_chunks, sources_text, question)
    
    # Call the new function with the prepared context
    return answer_question_with_sources(question, enhanced_context, relevant_docs)

def answer_question_legacy(question: str, relevant_docs: List[Document]) -> str:
    """Backward compatible legacy function that returns only the answer"""
    result = answer_question_legacy_with_sources(question, relevant_docs)
    print(result)
    return result