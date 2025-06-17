from fastapi import FastAPI, File, UploadFile, Form, HTTPException, Depends, Header
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional
import uuid
import io
from dotenv import load_dotenv
from unstructured.partition.pdf import partition_pdf
from utils.briefDoc_summarizer import summarize_all
from utils.ytvideo_summarizer import process_video
from utils.detailDoc_summarizer import summarize_all_in_detail
from unstructured.partition.docx import partition_docx
from utils.visuaLens import extract_and_summarize_image
from langchain_community.vectorstores import Chroma
from langchain_community.embeddings import HuggingFaceEmbeddings
from langchain.storage import InMemoryStore
from langchain.schema.document import Document
from langchain.retrievers.multi_vector import MultiVectorRetriever
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain.docstore.document import Document
from utils.question import answer_question_legacy
from google.oauth2 import id_token
from google.auth.transport import requests
import os
from dotenv import load_dotenv
import re

load_dotenv()

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

SECRET_KEY = os.getenv("NEXTAUTH_SECRET")
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")

def verify_token(
    authorization: str = Header(...),
    x_user_provider: str = Header(None, alias="X-User-Provider")
):
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=403, detail="Invalid auth header")

    token = authorization[7:] 
    provider = x_user_provider or "unknown"

    try:
        if provider == "google":
            return verify_google_token(token)
        elif provider == "credentials":
            return verify_credentials_token(token)
        else:
            return auto_detect_and_verify(token)
            
    except Exception as e:
        print(f"Token verification failed: {str(e)}")
        raise HTTPException(status_code=403, detail="Token verification failed")

def verify_google_token(token: str):
    try:
        import requests as http_requests
        
        response = http_requests.get(
            f"https://www.googleapis.com/oauth2/v1/tokeninfo?access_token={token}",
            timeout=10
        )
        
        if response.status_code != 200:
            raise HTTPException(status_code=403, detail="Invalid Google access token")
        
        token_info = response.json()

        return {
            "provider": "google",
            "user_id": token_info.get("user_id"),
            "email": token_info.get("email"),
            "expires_in": token_info.get("expires_in"),
            "scope": token_info.get("scope")
        }
        
    except http_requests.RequestException as e:
        print(f"Google token verification failed: {str(e)}")
        raise HTTPException(status_code=403, detail="Failed to verify Google token")
    except Exception as e:
        print(f"Google token verification error: {str(e)}")
        raise HTTPException(status_code=403, detail="Invalid Google token")

def verify_credentials_token(token: str):
    try:
        if not re.match(r'^[a-fA-F0-9]{24}$', token):
            raise HTTPException(status_code=403, detail="Invalid user ID format")

        return {
            "provider": "credentials",
            "user_id": token,
            "_id": token
        }
        
    except Exception as e:
        print(f"Credentials token verification failed: {str(e)}")
        raise HTTPException(status_code=403, detail="Invalid credentials token")

def auto_detect_and_verify(token: str):
    try:
        if len(token) > 100 or '.' in token:
            try:
                return verify_google_token(token)
            except:
                pass
        
        if re.match(r'^[a-fA-F0-9]{24}$', token):
            return verify_credentials_token(token)
        
        raise HTTPException(status_code=403, detail="Unrecognized token format")
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Auto-detection failed: {str(e)}")
        raise HTTPException(status_code=403, detail="Token verification failed")

retrievers_store = {}

def extract_pdf_content_from_bytes(file_content: bytes, filename: str):
    """Extract text, images, and tables from PDF bytes using unstructured.partition.pdf"""
    try:
        file_obj = io.BytesIO(file_content)
        
        chunks = partition_pdf(
            file=file_obj,
            infer_table_structure=True,
            strategy="hi_res",
            extract_image_block_types=["Image"],
            extract_image_block_to_payload=True,
            chunking_strategy="by_title",
            max_characters=10000,
            combine_text_under_n_chars=2000,
            new_after_n_chars=6000,
        )
        
        tables, texts, images_b64 = [], [], []

        for chunk in chunks:
            chunk_type = type(chunk).__name__
            if chunk_type == "Table":
                tables.append(chunk)
            elif chunk_type in ["Text", "NarrativeText", "CompositeElement", "Title"]:
                texts.append(chunk)
                # Extract embedded images in composite elements (if any)
                if hasattr(chunk, 'metadata') and hasattr(chunk.metadata, 'orig_elements'):
                    for el in chunk.metadata.orig_elements:
                        el_type = type(el).__name__
                        if el_type == "Image" and hasattr(el.metadata, "image_base64") and el.metadata.image_base64:
                            images_b64.append(el.metadata.image_base64)
            elif chunk_type == "Image":
                if hasattr(chunk.metadata, "image_base64") and chunk.metadata.image_base64:
                    images_b64.append(chunk.metadata.image_base64)

        print(f"Extracted: {len(texts)} texts, {len(tables)} tables, {len(images_b64)} images")
        
        return {
            "texts": texts,
            "tables": tables,
            "images": images_b64
        }
    except Exception as e:
        print(f"Error processing PDF: {e}")
        raise HTTPException(status_code=500, detail=f"PDF processing failed: {str(e)}")

def extract_docx_content_from_bytes(file_content: bytes, filename: str):
    """Extract text, images, and tables from DOCX bytes using unstructured.partition.docx"""
    try:
        file_obj = io.BytesIO(file_content)

        chunks = partition_docx(
            file=file_obj,
            infer_table_structure=True,
            extract_image_block_types=["Image"],
            extract_image_block_to_payload=True,
            chunking_strategy="by_title",
            max_characters=10000,
            combine_text_under_n_chars=2000,
            new_after_n_chars=6000,
        )

        tables, texts, images_b64 = [], [], []

        for chunk in chunks:
            chunk_type = type(chunk).__name__
            if chunk_type == "Table":
                tables.append(chunk)
            elif chunk_type in ["Text", "NarrativeText", "CompositeElement", "Title"]:
                texts.append(chunk)
                if hasattr(chunk, 'metadata') and hasattr(chunk.metadata, 'orig_elements'):
                    for el in chunk.metadata.orig_elements:
                        el_type = type(el).__name__
                        if el_type == "Image" and hasattr(el.metadata, "image_base64") and el.metadata.image_base64:
                            images_b64.append(el.metadata.image_base64)
            elif chunk_type == "Image":
                if hasattr(chunk.metadata, "image_base64") and chunk.metadata.image_base64:
                    images_b64.append(chunk.metadata.image_base64)

        print(f"Extracted: {len(texts)} texts, {len(tables)} tables, {len(images_b64)} images")

        return {
            "texts": texts,
            "tables": tables,
            "images": images_b64
        }
    except Exception as e:
        print(f"Error processing DOCX: {e}")
        raise HTTPException(status_code=500, detail=f"DOCX processing failed: {str(e)}")


def vectorize_content(texts, tables, images, collection_name=None): 
    """Vectorize content (texts, tables, images) and return retriever with metadata."""
    try:
        print("Starting vectorization...")

        # Initialize embedding model
        embedding_model = HuggingFaceEmbeddings(model_name="sentence-transformers/all-MiniLM-L6-v2")
        
        if not collection_name:
            collection_name = f"multi_modal_rag_{uuid.uuid4().hex[:8]}"
        
        # Create vector store and doc store
        vectorstore = Chroma(collection_name=collection_name, embedding_function=embedding_model)
        store = InMemoryStore()
        id_key = "doc_id"

        retriever = MultiVectorRetriever(
            vectorstore=vectorstore,
            docstore=store,
            id_key=id_key,
        )

        doc_ids, all_docs, original_content = [], [], []

        # Vectorize Text Chunks
        for text_chunk in texts:
            doc_id = str(uuid.uuid4())
            content = getattr(text_chunk, 'text', str(text_chunk))
            metadata = {
                id_key: doc_id,
                "type": "text",
                "page_number": getattr(text_chunk.metadata, 'page_number', None) if hasattr(text_chunk, 'metadata') else None
            }
            all_docs.append(Document(page_content=content, metadata=metadata))
            doc_ids.append(doc_id)
            original_content.append(content)

        # Vectorize Table Chunks
        for table_chunk in tables:
            doc_id = str(uuid.uuid4())
            content = (
                getattr(table_chunk.metadata, 'text_as_html', None) or
                getattr(table_chunk, 'text', None) or
                str(table_chunk)
            )
            metadata = {
                id_key: doc_id,
                "type": "table",
                "page_number": getattr(table_chunk.metadata, 'page_number', None) if hasattr(table_chunk, 'metadata') else None
            }
            all_docs.append(Document(page_content=content, metadata=metadata))
            doc_ids.append(doc_id)
            original_content.append(content)

        # Vectorize Images
        for i, img_b64 in enumerate(images):
            doc_id = str(uuid.uuid4())

            # Send only raw base64 string to the backend
            content = img_b64.strip()  # clean base64 string, no URL prefix

            metadata = {
                id_key: doc_id,
                "type": "image",
                "image_index": i
            }

            all_docs.append(Document(page_content=content, metadata=metadata))
            doc_ids.append(doc_id)
            original_content.append(img_b64)


        # Store in retriever
        if all_docs:
            retriever.vectorstore.add_documents(all_docs)
            retriever.docstore.mset(list(zip(doc_ids, all_docs)))

        print(f"Vectorization completed: {len(all_docs)} documents")

        return retriever, {
            "texts_count": len(texts),
            "tables_count": len(tables),
            "images_count": len(images),
            "collection_name": collection_name,
            "total_documents": len(all_docs)
        }

    except Exception as e:
        print(f"Vectorization error: {e}")
        raise HTTPException(status_code=500, detail=f"Vectorization failed: {str(e)}")

def vectorize_text(summary: str, persist_directory: str = None):
    # 1. Split summary into chunks
    splitter = RecursiveCharacterTextSplitter(chunk_size=300, chunk_overlap=50)
    docs = [Document(page_content=chunk) for chunk in splitter.split_text(summary)]
    
    # 2. Use HuggingFace Embeddings
    embeddings = HuggingFaceEmbeddings(model_name="all-MiniLM-L6-v2")

    # 3. Create Chroma index
    vectorstore = Chroma.from_documents(
        documents=docs,
        embedding=embeddings,
        persist_directory=persist_directory  # Optional: provide a directory to persist
    )
    
    # 4. Return as retriever for consistency
    return vectorstore.as_retriever(search_kwargs={"k": 5})

@app.post("/vectorize")
async def vectorize(
    mode: str = Form(...),
    file: Optional[UploadFile] = File(None),
    url: Optional[str] = Form(None),
    user: dict = Depends(verify_token) 
):
    extracted_content = None
    extracted_Image_Content = None
    retriever = None

    try:
        if mode not in ["briefDoc", "sumTube", "detailDoc", "visuaLens"]:
            raise HTTPException(status_code=400, detail="Invalid mode specified")

        if mode in ["briefDoc", "detailDoc"]:
            if not file:
                raise HTTPException(status_code=400, detail="File is required for this mode")

            if file.content_type not in ["application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"]:
                raise HTTPException(status_code=400, detail="Only PDF and DOCX files are supported")

            file_content = await file.read()
            print(f"Extracting content from {file.content_type} file.........")

            if file.content_type == "application/pdf":
                extracted_content = extract_pdf_content_from_bytes(file_content, file.filename)
            else:
                extracted_content = extract_docx_content_from_bytes(file_content, file.filename)  # Make sure you define this function

        elif mode == "visuaLens":
            if not file:
                raise HTTPException(status_code=400, detail="Image file is required for visuaLens mode")

            if file.content_type not in ["image/png", "image/jpeg", "image/svg+xml"]:
                raise HTTPException(status_code=400, detail="Only PNG, JPEG, and SVG files are supported")

            file_content = await file.read()
            print(f"Processing image content for visuaLens.........")
            
            # Directly summarize image
            result = extract_and_summarize_image(file_content)
            # Extract both summary and raw text from the result
            summary_text = result.get("summary") or result.get("caption") or ""
            raw_text = result.get("raw_text") or ""

            # Combine them into a single string for vectorization
            summary_for_vector = f"{raw_text}\n\n{summary_text}"

            extracted_Image_Content = {
                "texts": [summary_for_vector],
                "tables": [],
                "images": []  
            }


        elif mode == "sumTube":
            if not url:
                raise HTTPException(status_code=400, detail="URL is required for sumTube mode")
            
            result = process_video(url)
            if result is None:
                raise HTTPException(status_code=400, detail="Failed to process video URL")

            print(f"Video processing result: {result}")

            # Vectorize summary for future QA - NOW RETURNS A RETRIEVER
            vectorstore_retriever = vectorize_text(result['summary'])
            print(vectorstore_retriever)
            retrievers_store[result['video_id']] = vectorstore_retriever


        # Vectorization (only for PDF file modes)
        vectorized_metadata = None
        session_id = str(uuid.uuid4())  # Generate unique session ID
        
        if extracted_content:
            retriever, vectorized_metadata = vectorize_content(
                extracted_content['texts'],
                extracted_content['tables'],
                extracted_content['images']
            )
            # Store retriever for future queries
            retrievers_store[session_id] = retriever
        
        elif extracted_Image_Content:
            retriever, vectorized_metadata = vectorize_content(
                extracted_Image_Content['texts'],
                extracted_Image_Content['tables'],
                extracted_Image_Content['images']
            )
            retrievers_store[session_id] = retriever
            
        # Get top-k relevant chunks for summarization
        if mode in ["briefDoc", "detailDoc"] and retriever:
            combined_filter = {"type": {"$in": ["image", "text", "table"]}}
            retriever.search_kwargs = {"k": 10, "filter": combined_filter}
            summary_query = "main points key information important details"
            top_k_docs = retriever.get_relevant_documents(summary_query)

            top_texts = []
            top_tables = []
            top_images = []

            for doc in top_k_docs:
                doc_type = getattr(doc.metadata, "get", lambda k, d=None: "text")("type", "text")
                page_content = getattr(doc, "page_content", str(doc))

                if doc_type == "text":
                    top_texts.append(page_content)
                elif doc_type == "table":
                    top_tables.append(page_content)
                elif doc_type == "image":
                    doc_id = doc.metadata.get("doc_id") if hasattr(doc, 'metadata') else None
                    if doc_id and hasattr(retriever, 'docstore') and doc_id in retriever.docstore.store:
                        top_images.append(retriever.docstore.store[doc_id].page_content)
                    else:
                        top_images.append("image_placeholder")

            if mode == "briefDoc":
                result = summarize_all(
                    texts=top_texts if top_texts else extracted_content['texts'],
                    tables=top_tables if top_tables else extracted_content['tables'],
                    images=top_images if top_images else extracted_content['images']
                )
                print(f"Brief summary result: {result}")

            elif mode == "detailDoc":
                result = summarize_all_in_detail(
                    texts=top_texts if top_texts else extracted_content['texts'],
                    tables=top_tables if top_tables else extracted_content['tables'],
                    images=top_images if top_images else extracted_content['images']
                )
                print(f"Detail summary result: {result}")

            elif mode == "sumTube":
                result = process_video(url)
                print(f"Video summary result: {result}")
            else:
                raise HTTPException(status_code=400, detail="Invalid mode specified")


        if(mode == "sumTube"):
            return {
                "success": True,
                "mode": mode,
                "session_id": result['video_id'],
                "vectorized_metadata": vectorized_metadata,
                "result": result
            }
        elif(mode == "visuaLens"):
            return {
                "success": True,
                "mode": mode,
                "session_id": session_id if extracted_Image_Content else None,
                "vectorized_metadata": vectorized_metadata,
                "result": result
            }
        else:
            return {
                "success": True,
                "mode": mode,
                "session_id": session_id if extracted_content else None,
                "vectorized_metadata": vectorized_metadata,
                "result": result
            }

    except Exception as e:
        print(f"Unexpected error: {e}")
        raise HTTPException(status_code=500, detail=f"Processing failed: {str(e)}")

@app.post("/query")
async def query_document(
    session_id: Optional[str] = Form(None),
    video_id: Optional[str] = Form(None),
    question: str = Form(...),
    k: int = Form(5),  # Number of top results to retrieve
    user: dict = Depends(verify_token) 
):

    try:
        key = session_id if session_id else video_id
        
        if not key or key not in retrievers_store:
            raise HTTPException(status_code=404, detail="Session or Video ID not found. Please upload a document first.")
        
        retriever = retrievers_store.get(key)
        
        if hasattr(retriever, 'search_kwargs'):
            retriever.search_kwargs = {"k": k}
            relevant_docs = retriever.get_relevant_documents(question)
        else:
            relevant_docs = retriever.similarity_search(question, k=k)
        
        if not relevant_docs:
            return {
                "success": True,
                "question": question,
                "answer": "No relevant information found in the document.",
                "sources": []
            }
    
        answer = answer_question_legacy(question, relevant_docs)

        return {
            "success": True,
            "question": question,
            "answer": answer['answer'],
            "sources": answer['sources'],
            "total_sources": answer['total_sources']
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"Query error: {e}")
        raise HTTPException(status_code=500, detail=f"Query processing failed: {str(e)}")
