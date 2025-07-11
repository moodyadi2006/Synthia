# 🧠 Synthia — RAG-Based AI Assistant

Synthia is a powerful **Retrieval-Augmented Generation (RAG)** system that blends **semantic search**, **generative AI**, and **multi-modal input** to deliver grounded, context-rich answers. Whether you're analyzing documents, summarizing YouTube videos, or navigating internal knowledge — Synthia helps you extract what matters most.

---

## 🚀 Features

- 🔍 **Contextual Search**: Retrieves top-k relevant documents using vector similarity.
- 🧠 **Generative Responses**: Combines retrieved docs and user queries in a LangChain-powered prompt sent to a powerful LLM (via Groq API).
- 🗂️ **Multi-format Support**: Handles `briefDoc`, `detailDoc`, and `visualLens` formats.
- 📁 **Conversation Foldering**: Organize chats under custom folders.
- 💬 **Threaded Messages** with markdown rendering.
- 📝 **Add Notes**: Users can write and attach **custom notes** to saved conversations.
- 🎙️ **Voice-Based Search** using the Web Speech API.
- 🎥 **YouTube Summary** powered by Supadata.
- 📩 **Email Verification** with magic link via Resend.
- 🔒 **NextAuth Authentication** with MongoDB.
- 🧠 **Python Backend**: Serves embeddings & RAG logic via FastAPI + Uvicorn.

---

## 🛠️ Tech Stack

### 🔧 Core Stack

- **Next.js 14 (App Router)** – frontend framework
- **TypeScript** – static typing
- **Tailwind CSS** – utility-first styling
- **ShadCN UI** – modern component library
- **ReactMarkdown + remark-gfm** – advanced markdown rendering
- **Web Speech API** – voice input for search

### 🧠 AI / Backend

- **Groq API** – blazing fast LLM inference
- **LangChain** – vector + prompt chaining
- **FastAPI (Python)** – backend for RAG pipeline
- **Uvicorn** – ASGI server
- **Supadata** – YouTube transcript extractor

### 🗄️ Database / Auth

- **MongoDB** – stores user data, chats, notes
- **Resend** – email magic link verification
- **NextAuth.js** – authentication & sessions

---

## 💡 Use Cases

| Use Case                  | Description                                                                  |
| ------------------------- | ---------------------------------------------------------------------------- |
| 🎓 Personalized Learning  | Extract visual + textual summaries from YouTube lectures or reading material |
| 🧑‍💼 Internal Knowledge Bot | Train on your company SOPs, HR docs, onboarding guides                       |
| 🎥 Video Summarization    | Paste a YouTube URL and get a high-level summary + key points                |
| 📝 Knowledge Journaling   | Add personal insights and context to saved conversations                     |
| 🎙️ Voice-Assisted Search  | Speak your query aloud instead of typing it                                  |
| ⚖️ Legal Document Parsing | Extract insights from lengthy contracts, NDAs, or policy documents           |
| 📚 Research Assistant     | Query academic material and get markdown-based summaries                     |

---

## 📁 Folder Structure
```

synthia/
├── frontend/ # Next.js frontend (App Router)
├── src/ # Python FastAPI backend
├── venv
├── .env.local # Frontend env vars
├── .gitignore
└── README.md

````

---

## 🚀 Getting Started

### 1. Clone & Install

```bash
git clone https://github.com/your-username/synthia.git
cd synthia
npm install
````

### 2. Environment Setup

Create a `.env.local` file in the root folder:

```env
MONGODB_URI=mongodb+srv://<your-db-url>
GROQ_API_KEY=your-groq-api-key
RESEND_API_KEY=your-resend-api-key
NEXTAUTH_SECRET=super-secret-key
NEXTAUTH_URL=http://localhost:3000
```

Create a `.env` file inside the `backend/` directory:

```env
GROQ_API_KEY=your-groq-api-key
SUPADATA_API_KEY=your-supadata-api-key
NEXTAUTH_SECRET=super-secret-key
```

### 3. Run Both Frontend and Backend

#### ➤ Start Frontend (Next.js)

```bash
npm run dev
```

App runs at: `http://localhost:3000`

#### ➤ Start Backend (FastAPI via Uvicorn)

Open a new terminal:

```bash
cd backend
uvicorn main:app --reload --port 8000
```

Backend runs at: `http://localhost:8000`

Ensure your frontend makes requests to this backend (CORS enabled).

---

## 📸 Screenshots

![alt text](home.png)
![alt text](signIn.png)
![alt text](briefDoc.png)
![alt text](visuaLens.png)
![alt text](conversation.png)

---

## 📌 Future Roadmap

- [ ] 🧠 User memory for personalized responses
- [ ] 🗣️ Extend voice input to full conversation flow (not just search)
- [ ] 🔊 TTS (Text-to-Speech) for audible replies
- [ ] 🧩 Plugin support (Zapier, Notion, Google Drive)
- [ ] 🧑‍💻 Admin dashboard for KB uploads & usage tracking

---

## 🤝 Contributing

We welcome all contributions!

```bash
# 1. Fork the repo
# 2. Create a feature branch
# 3. Push your changes and create a PR
```

Please include clear commit messages and test your changes.

---

## 👨‍💻 Author

**Aditya Singh**
📧 [moodyadi30@gmail.com](mailto:moodyadi30@gmail.com)
🔗 [LinkedIn](https://www.linkedin.com/in/adityakumar2006)
🚀 Built with 💡 ideas and ☕ determination

---
