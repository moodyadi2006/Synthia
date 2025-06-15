"use client";

import React, { useEffect, useState } from "react";
import axios from "axios";
import { useSession } from "next-auth/react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  ChevronDown,
  ChevronRight,
  Folder,
  MessageCircle,
  User,
  Bot,
  Sparkles,
  Loader2,
  FolderOpen,
  StickyNote,
  Edit3,
  Save,
  X,
  Calendar,
  Hash,
} from "lucide-react";

export default function page() {
  const [folders, setFolders] = useState([]);
  const [expanded, setExpanded] = useState(new Set());
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [isLoaded, setIsLoaded] = useState(false);

  // Notes functionality
  const [notes, setNotes] = useState({});
  const [editingNote, setEditingNote] = useState(null);
  const [noteText, setNoteText] = useState("");
  const [savingNote, setSavingNotesave] = useState(false);

  const { data: session, status } = useSession();

  // Authentication state
  const [user, setUser] = useState(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [dots, setDots] = useState([]); //Biggest error that I saw

  useEffect(() => {
    const newDots = Array.from({ length: 50 }, () => ({
      left: `${Math.random() * 100}%`,
      top: `${Math.random() * 100}%`,
      animationDelay: `${Math.random() * 3}s`,
      animationDuration: `${2 + Math.random() * 3}s`,
    }));
    setDots(newDots);
  }, []);

  useEffect(() => {
    setIsLoaded(true);
    const handleMouseMove = (e) => {
      setMousePosition({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  useEffect(() => {
    const checkAuthStatus = () => {
      if (status === "authenticated" && session?.user) {
        setUser(session.user);
        setIsLoggedIn(true);
      }
    };
    checkAuthStatus();
  }, [session, status]);

  useEffect(() => {
    const fetchFolders = async () => {
      setLoading(true);
      try {
        const res = await axios.post("/api/fetchFolders", {
          email: user?.email,
        });

        if (res.data.success) {
          setFolders(res.data.folders);
          // Load existing notes from conversations
          loadNotesFromConversations(res.data.folders);
        } else {
          setError(res.data.message || "Failed to fetch folders");
        }
      } catch (err) {
        setError(err.message || "Unexpected error");
      } finally {
        setLoading(false);
      }
    };

    if (user?.email) {
      fetchFolders();
    }
  }, [user?.email]);

  const loadNotesFromConversations = (foldersData) => {
    // Load notes from conversation data
    const notesMap = {};
    foldersData.forEach((folder) => {
      folder.conversations?.forEach((conv) => {
        if (conv.notes && conv.notes.length > 0) {
          // Get the latest note
          const latestNote = conv.notes[conv.notes.length - 1];
          notesMap[conv._id] = {
            text: latestNote.content,
            updatedAt: latestNote.timestamp,
          };
        }
      });
    });
    setNotes(notesMap);
  };

  const saveNote = async (conversationId, note) => {
    setSavingNotesave(true);
    try {
      // Save to backend API
      const response = await axios.post("/api/saveNote", {
        conversationId,
        note,
        email: user?.email,
      });

      if (response.data.success) {
        const updatedNotes = {
          ...notes,
          [conversationId]: {
            text: note,
            updatedAt: new Date().toISOString(),
          },
        };

        setNotes(updatedNotes);
        setEditingNote(null);
        setNoteText("");

        // Update the selected conversation to reflect the new note
        if (
          selectedConversation &&
          selectedConversation._id === conversationId
        ) {
          setSelectedConversation((prev) => ({
            ...prev,
            notes: response.data.notes || prev.notes,
          }));
          setSavingNotesave(false);
        }
      } else {
        console.error("Failed to save note:", response.data.message);
      }
    } catch (err) {
      console.error("Failed to save note:", err);
    } finally {
      setSavingNotesave(false);
    }
  };

  const toggleFolder = (folderId) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(folderId) ? next.delete(folderId) : next.add(folderId);
      return next;
    });
  };

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return "";
    const date = new Date(timestamp);
    return (
      date.toLocaleDateString() +
      " " +
      date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    );
  };

  const renderMessageContent = (message) => {
    // Markdown components configuration
    const markdownComponents = {
      // Custom styling for different markdown elements
      h1: ({ children }) => (
        <h1 className="text-2xl font-bold text-white mb-4">{children}</h1>
      ),
      h2: ({ children }) => (
        <h2 className="text-xl font-semibold text-white mb-3">{children}</h2>
      ),
      h3: ({ children }) => (
        <h3 className="text-lg font-medium text-white mb-2">{children}</h3>
      ),
      p: ({ children }) => <p className="mb-3 leading-relaxed">{children}</p>,
      ul: ({ children }) => (
        <ul className="list-disc list-inside mb-3 space-y-1">{children}</ul>
      ),
      ol: ({ children }) => (
        <ol className="list-decimal list-inside mb-3 space-y-1">{children}</ol>
      ),
      li: ({ children }) => <li className="ml-4">{children}</li>,
      blockquote: ({ children }) => (
        <blockquote className="border-l-4 border-purple-400 pl-4 italic text-gray-300 mb-3">
          {children}
        </blockquote>
      ),
      code: ({ inline, children }) =>
        inline ? (
          <code className="bg-gray-800 text-purple-300 px-1 py-0.5 rounded text-sm">
            {children}
          </code>
        ) : (
          <pre className="bg-gray-900 border border-gray-700 rounded-lg p-4 overflow-x-auto mb-3">
            <code className="text-sm text-gray-200">{children}</code>
          </pre>
        ),
      strong: ({ children }) => (
        <strong className="font-semibold text-white">{children}</strong>
      ),
      em: ({ children }) => (
        <em className="italic text-gray-300">{children}</em>
      ),
      a: ({ href, children }) => (
        <a
          href={href}
          className="text-purple-400 hover:text-purple-300 underline transition-colors"
          target="_blank"
          rel="noopener noreferrer"
        >
          {children}
        </a>
      ),
      table: ({ children }) => (
        <div className="overflow-x-auto mb-3">
          <table className="min-w-full border border-gray-600 rounded-lg">
            {children}
          </table>
        </div>
      ),
      th: ({ children }) => (
        <th className="border border-gray-600 bg-gray-800 px-4 py-2 text-left font-semibold text-white">
          {children}
        </th>
      ),
      td: ({ children }) => (
        <td className="border border-gray-600 px-4 py-2 text-gray-200">
          {children}
        </td>
      ),
    };

    // Helper function to extract content from nested structure
    const extractContent = (messageContent) => {
      if (typeof messageContent === "string") {
        return messageContent;
      }

      // Handle nested content structure
      if (messageContent.content) {
        return messageContent.content;
      }

      return messageContent;
    };

    // Helper function to render summary array or string
    const renderSummary = (summary) => {
      if (Array.isArray(summary)) {
        return summary.map((point, idx) => (
          <div key={idx} className="ml-4 mb-2">
            <ReactMarkdown
              components={markdownComponents}
              remarkPlugins={[remarkGfm]}
            >
              {point}
            </ReactMarkdown>
          </div>
        ));
      } else {
        return (
          <div className="ml-4">
            <ReactMarkdown
              components={markdownComponents}
              remarkPlugins={[remarkGfm]}
            >
              {summary}
            </ReactMarkdown>
          </div>
        );
      }
    };

    // ✅ USER MESSAGE HANDLING
    if (message.type === "user") {
      const userContent = extractContent(message.content);

      return (
        <div className="text-gray-200 leading-relaxed">
          {typeof userContent === "string" ? (
            <ReactMarkdown
              components={markdownComponents}
              remarkPlugins={[remarkGfm]}
            >
              {userContent}
            </ReactMarkdown>
          ) : (
            <pre className="text-sm text-gray-400 whitespace-pre-wrap bg-gray-900 border border-gray-700 rounded-lg p-4 overflow-x-auto">
              {JSON.stringify(userContent, null, 2)}
            </pre>
          )}
        </div>
      );
    }

    // ✅ ASSISTANT MESSAGE HANDLING
    if (message.type === "assistant" && message.content) {
      let content = extractContent(message.content);

      // ✅ Handle ARRAY FORM: [{ mode: "...", summary: [...] }]
      if (Array.isArray(content) && content.length > 0) {
        const contentObj = content[0];
        const { mode, summary, answer, question, videoThumbnail } = contentObj;

        // ✅ sumTube mode (YouTube summary)
        if (mode === "sumTube" && videoThumbnail) {
          return (
            <div className="space-y-3">
              <div className="flex items-center space-x-2 text-purple-300 text-sm">
                <Hash className="w-4 h-4" />
                <span>YouTube Summary</span>
              </div>
              <img
                src={videoThumbnail}
                alt="Video thumbnail"
                className="rounded-lg max-w-xs border border-white/20"
              />
              <div className="text-gray-200 leading-relaxed">
                <ReactMarkdown
                  components={markdownComponents}
                  remarkPlugins={[remarkGfm]}
                >
                  {summary}
                </ReactMarkdown>
              </div>
            </div>
          );
        }

        // ✅ detailDoc mode
        if (mode === "detailDoc") {
          return (
            <div className="space-y-2 text-gray-200 leading-relaxed">
              <p className="text-sm text-purple-400">
                📄 Detailed Document Summary:
              </p>
              {renderSummary(summary)}
            </div>
          );
        }

        // ✅ briefDoc mode
        if (mode === "briefDoc") {
          return (
            <div className="text-gray-200 leading-relaxed">
              <p className="text-sm text-purple-400">📝 Brief Summary:</p>
              {renderSummary(summary)}
            </div>
          );
        }

        // ✅ visuaLens mode
        if (mode === "visuaLens") {
          return (
            <div className="text-gray-200 leading-relaxed">
              <p className="text-sm text-purple-400">🔍 Visual Lens Summary:</p>
              {renderSummary(summary)}
            </div>
          );
        }

        // ✅ Handle array form with answer and/or summary
        if (answer || summary) {
          return (
            <div className="text-gray-200 leading-relaxed">
              {answer && (
                <div className="mb-3">
                  <ReactMarkdown
                    components={markdownComponents}
                    remarkPlugins={[remarkGfm]}
                  >
                    {answer}
                  </ReactMarkdown>
                </div>
              )}
              {summary && (
                <div
                  className={answer ? "mt-4 pt-3 border-t border-gray-700" : ""}
                >
                  {renderSummary(summary)}
                </div>
              )}
            </div>
          );
        }

        // ✅ Handle question/answer format (legacy support)
        if (question) {
          return (
            <div className="text-gray-200 leading-relaxed">
              <div className="mb-3">
                <strong className="text-white">Q:</strong>{" "}
                <ReactMarkdown
                  components={{
                    ...markdownComponents,
                    p: ({ children }) => <span>{children}</span>,
                  }}
                  remarkPlugins={[remarkGfm]}
                >
                  {question}
                </ReactMarkdown>
              </div>
            </div>
          );
        }
      }

      // ✅ Handle OBJECT FORM: { answer: "...", summary: [...] }
      if (content && typeof content === "object" && !Array.isArray(content)) {
        const { mode, summary, answer, question, videoThumbnail } = content;

        // ✅ sumTube mode (YouTube summary)
        if (mode === "sumTube" && videoThumbnail) {
          return (
            <div className="space-y-3">
              <div className="flex items-center space-x-2 text-purple-300 text-sm">
                <Hash className="w-4 h-4" />
                <span>YouTube Summary</span>
              </div>
              <img
                src={videoThumbnail}
                alt="Video thumbnail"
                className="rounded-lg max-w-xs border border-white/20"
              />
              <div className="text-gray-200 leading-relaxed">
                <ReactMarkdown
                  components={markdownComponents}
                  remarkPlugins={[remarkGfm]}
                >
                  {summary}
                </ReactMarkdown>
              </div>
            </div>
          );
        }

        // ✅ detailDoc mode
        if (mode === "detailDoc") {
          return (
            <div className="space-y-2 text-gray-200 leading-relaxed">
              <p className="text-sm text-purple-400">
                📄 Detailed Document Summary:
              </p>
              {renderSummary(summary)}
            </div>
          );
        }

        // ✅ briefDoc mode
        if (mode === "briefDoc") {
          return (
            <div className="text-gray-200 leading-relaxed">
              <p className="text-sm text-purple-400">📝 Brief Summary:</p>
              {renderSummary(summary)}
            </div>
          );
        }

        // ✅ visuaLens mode
        if (mode === "visuaLens") {
          return (
            <div className="text-gray-200 leading-relaxed">
              <p className="text-sm text-purple-400">🔍 Visual Lens Summary:</p>
              {renderSummary(summary)}
            </div>
          );
        }

        // ✅ Handle object form with answer and/or summary
        if (answer || summary) {
          return (
            <div className="text-gray-200 leading-relaxed">
              {answer && (
                <div className="mb-3">
                  <ReactMarkdown
                    components={markdownComponents}
                    remarkPlugins={[remarkGfm]}
                  >
                    {answer}
                  </ReactMarkdown>
                </div>
              )}
              {summary && (
                <div
                  className={answer ? "mt-4 pt-3 border-t border-gray-700" : ""}
                >
                  {renderSummary(summary)}
                </div>
              )}
            </div>
          );
        }

        // ✅ Handle question/answer format (legacy support)
        if (question) {
          return (
            <div className="text-gray-200 leading-relaxed">
              <div className="mb-3">
                <strong className="text-white">Q:</strong>{" "}
                <ReactMarkdown
                  components={{
                    ...markdownComponents,
                    p: ({ children }) => <span>{children}</span>,
                  }}
                  remarkPlugins={[remarkGfm]}
                >
                  {question}
                </ReactMarkdown>
              </div>
            </div>
          );
        }
      }

      // ✅ Handle string content directly
      if (typeof content === "string") {
        return (
          <div className="text-gray-200 leading-relaxed">
            <ReactMarkdown
              components={markdownComponents}
              remarkPlugins={[remarkGfm]}
            >
              {content}
            </ReactMarkdown>
          </div>
        );
      }

      // ✅ final fallback: render as formatted JSON
      return (
        <pre className="text-sm text-gray-400 whitespace-pre-wrap bg-gray-900 border border-gray-700 rounded-lg p-4 overflow-x-auto">
          {JSON.stringify(message.content, null, 2)}
        </pre>
      );
    }

    // ✅ Fallback for any other message types
    return (
      <div className="text-gray-200 leading-relaxed">
        <pre className="text-sm text-gray-400 whitespace-pre-wrap bg-gray-900 border border-gray-700 rounded-lg p-4 overflow-x-auto">
          {JSON.stringify(message, null, 2)}
        </pre>
      </div>
    );
  };

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-gray-900">
      {/* Animated Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-gray-900 via-blue-900/20 to-purple-900/20">
        {/* Floating Orbs */}
        <div className="absolute top-32 left-32 w-80 h-80 bg-gradient-to-r from-blue-500/30 to-purple-500/30 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-32 right-32 w-96 h-96 bg-gradient-to-r from-purple-500/20 to-pink-500/20 rounded-full blur-3xl animate-pulse delay-1000"></div>
        <div className="absolute top-2/3 left-1/4 w-72 h-72 bg-gradient-to-r from-cyan-500/20 to-blue-500/20 rounded-full blur-3xl animate-pulse delay-700"></div>

        {/* Dynamic Mouse Follower */}
        <div
          className="absolute w-96 h-96 bg-gradient-radial from-blue-500/10 to-transparent rounded-full blur-2xl transition-all duration-300 ease-out pointer-events-none"
          style={{
            left: mousePosition.x - 192,
            top: mousePosition.y - 192,
          }}
        ></div>
      </div>

      {/* Animated Particles */}
      <div className="absolute inset-0 overflow-hidden">
        {dots.map((dot, i) => (
          <div
            key={i}
            className="absolute w-1 h-1 bg-white/20 rounded-full animate-ping"
            style={{
              left: dot.left,
              top: dot.top,
              animationDelay: dot.animationDelay,
              animationDuration: dot.animationDuration,
            }}
          />
        ))}
      </div>

      {/* Main Content */}
      <div className="relative z-10 min-h-screen p-8">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div
            className={`text-center mb-12 transform transition-all duration-1000 ${
              isLoaded
                ? "translate-y-0 opacity-100"
                : "translate-y-10 opacity-0"
            }`}
          >
            <div className="flex items-center justify-center space-x-3 mb-4">
              <Sparkles className="w-8 h-8 text-blue-400 animate-pulse" />
              <h1 className="text-5xl font-light tracking-wide bg-gradient-to-r from-white via-blue-200 to-purple-200 bg-clip-text text-transparent">
                Your Conversations
              </h1>
              <MessageCircle className="w-8 h-8 text-purple-400 animate-pulse" />
            </div>
            <p className="text-xl text-gray-300 font-light">
              Explore your AI-powered conversation history with notes
            </p>
          </div>

          <div className="flex gap-8">
            {/* Left Panel - Folders (1/3 width) */}
            <div
              className={`w-1/3 transform transition-all duration-1000 ${
                isLoaded
                  ? "translate-x-0 opacity-100"
                  : "translate-x-10 opacity-0"
              }`}
            >
              {/* Glass Card for Folders */}
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-r from-blue-500/20 to-purple-500/20 rounded-2xl blur-xl"></div>

                <div className="relative bg-gray-800/50 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-2xl">
                  <div className="flex items-center space-x-3 mb-6">
                    <FolderOpen className="w-6 h-6 text-blue-400" />
                    <h2 className="text-2xl font-bold bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
                      Folders
                    </h2>
                  </div>

                  {error && (
                    <div className="mb-4 p-3 bg-red-500/20 border border-red-500/30 rounded-lg text-red-300">
                      {error}
                    </div>
                  )}

                  {loading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
                      <span className="ml-3 text-gray-300">
                        Loading folders...
                      </span>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-[70vh] overflow-y-auto custom-scrollbar">
                      {folders.map((folder, index) => (
                        <div
                          key={folder._id}
                          className={`transform transition-all duration-500 ${
                            isLoaded
                              ? "translate-x-0 opacity-100"
                              : "translate-x-5 opacity-0"
                          }`}
                          style={{ transitionDelay: `${index * 100}ms` }}
                        >
                          <div
                            onClick={() => toggleFolder(folder._id)}
                            className="group cursor-pointer flex items-center gap-3 p-4 bg-white/5 backdrop-blur-sm rounded-lg border border-white/10 hover:bg-white/10 hover:border-blue-500/30 transition-all duration-300 hover:scale-105"
                          >
                            {expanded.has(folder._id) ? (
                              <ChevronDown className="w-5 h-5 text-blue-400 transition-transform duration-200" />
                            ) : (
                              <ChevronRight className="w-5 h-5 text-gray-400 transition-transform duration-200" />
                            )}
                            <Folder className="w-5 h-5 text-purple-400" />
                            <span className="text-white font-medium group-hover:text-blue-200 transition-colors">
                              {folder.folderName}
                            </span>
                            <span className="ml-auto text-xs bg-blue-500/20 text-blue-300 px-2 py-1 rounded-full">
                              {folder.conversations?.length || 0}
                            </span>
                          </div>

                          {expanded.has(folder._id) && (
                            <div className="ml-8 mt-2 space-y-1 animate-fadeIn">
                              {folder.conversations &&
                              folder.conversations.length > 0 ? (
                                folder.conversations.map((conv, convIndex) => (
                                  <div
                                    key={conv._id}
                                    onClick={() =>
                                      setSelectedConversation(conv)
                                    }
                                    className={`cursor-pointer flex items-center gap-3 p-3 rounded-lg transition-all duration-300 hover:scale-105 relative ${
                                      selectedConversation?._id === conv._id
                                        ? "bg-gradient-to-r from-blue-500/20 to-purple-500/20 border border-blue-500/30"
                                        : "bg-white/5 hover:bg-white/10 border border-transparent hover:border-white/20"
                                    }`}
                                    style={{
                                      animationDelay: `${convIndex * 50}ms`,
                                    }}
                                  >
                                    <MessageCircle className="w-4 h-4 text-cyan-400" />
                                    <div className="flex-1">
                                      <span className="text-gray-300 hover:text-white transition-colors truncate block">
                                        {conv.name}
                                      </span>
                                      <div className="text-xs text-gray-500 flex items-center space-x-2">
                                        <Calendar className="w-3 h-3" />
                                        <span>
                                          {formatTimestamp(conv.timestamp)}
                                        </span>
                                      </div>
                                    </div>
                                    {notes[conv._id] && (
                                      <StickyNote className="w-4 h-4 text-yellow-400" />
                                    )}
                                  </div>
                                ))
                              ) : (
                                <div className="ml-6 text-sm text-gray-500 italic p-3 bg-gray-700/30 rounded-lg border border-gray-600/30">
                                  No conversations yet
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      ))}

                      {folders.length === 0 && !loading && (
                        <div className="text-center py-8 text-gray-400">
                          <Folder className="w-12 h-12 mx-auto mb-3 opacity-50" />
                          <p>No folders found</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Right Panel - Conversation (2/3 width) */}
            <div
              className={`w-2/3 transform transition-all duration-1000 ${
                isLoaded
                  ? "translate-x-0 opacity-100"
                  : "translate-x-10 opacity-0"
              }`}
              style={{ transitionDelay: "200ms" }}
            >
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-r from-purple-500/20 to-pink-500/20 rounded-2xl blur-xl"></div>

                <div className="relative bg-gray-800/50 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-2xl min-h-[80vh]">
                  {selectedConversation ? (
                    <>
                      <div className="flex items-center justify-between mb-6 pb-4 border-b border-white/10">
                        <div className="flex items-center space-x-3">
                          <MessageCircle className="w-6 h-6 text-purple-400" />
                          <div>
                            <h2 className="text-2xl font-bold bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
                              {selectedConversation.name}
                            </h2>
                            <p className="text-sm text-gray-400">
                              {formatTimestamp(selectedConversation.timestamp)}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Notes Section */}
                      <div className="mb-6 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center space-x-2">
                            <StickyNote className="w-5 h-5 text-yellow-400" />
                            <span className="text-yellow-300 font-medium">
                              Notes
                            </span>
                          </div>
                          {!editingNote ? (
                            <button
                              onClick={() => {
                                setEditingNote(selectedConversation._id);
                                setNoteText(
                                  notes[selectedConversation._id]?.text || ""
                                );
                              }}
                              className="cursor-pointer flex items-center space-x-1 text-yellow-400 hover:text-yellow-300 transition-colors"
                            >
                              <Edit3 className="w-4 h-4" />
                              <span className="text-sm">Edit</span>
                            </button>
                          ) : (
                            editingNote === selectedConversation._id && (
                              <div className="flex items-center space-x-2">
                                <button
                                  onClick={() =>
                                    saveNote(selectedConversation._id, noteText)
                                  }
                                  disabled={savingNote}
                                  className="cursor-pointer flex items-center space-x-1 text-green-400 hover:text-green-300 transition-colors disabled:opacity-50"
                                >
                                  {savingNote ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                  ) : (
                                    <Save className="w-4 h-4" />
                                  )}
                                  <span className="text-sm">Save</span>
                                </button>
                                <button
                                  onClick={() => {
                                    setEditingNote(null);
                                    setNoteText("");
                                  }}
                                  className="cursor-pointer flex items-center space-x-1 text-red-400 hover:text-red-300 transition-colors"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </div>
                            )
                          )}
                        </div>

                        {editingNote === selectedConversation._id ? (
                          <textarea
                            value={noteText}
                            onChange={(e) => setNoteText(e.target.value)}
                            placeholder="Add your notes about this conversation..."
                            className="w-full h-24 bg-gray-700/50 border border-gray-600 focus:border-yellow-500 focus:ring-yellow-500/20 text-white placeholder-gray-400 rounded-lg p-3 resize-none"
                          />
                        ) : notes[selectedConversation._id] ? (
                          <div>
                            <p className="text-gray-200 text-sm leading-relaxed">
                              {notes[selectedConversation._id].text}
                            </p>
                            <p className="text-xs text-gray-500 mt-2">
                              Last updated:{" "}
                              {formatTimestamp(
                                notes[selectedConversation._id].updatedAt
                              )}
                            </p>
                          </div>
                        ) : (
                          <p className="text-gray-400 text-sm italic">
                            No notes yet. Click edit to add some notes about
                            this conversation.
                          </p>
                        )}
                      </div>

                      {/* Messages */}
                      <div className="space-y-4 max-h-[50vh] overflow-y-auto custom-scrollbar">
                        {selectedConversation.messages &&
                          selectedConversation.messages.map((msg, index) => (
                            <div
                              key={index}
                              className={`flex items-start space-x-3 p-4 rounded-xl transition-all duration-300 ${
                                msg.type === "user"
                                  ? "bg-gradient-to-r from-blue-500/20 to-cyan-500/20 border border-blue-500/30 ml-8"
                                  : "bg-gradient-to-r from-purple-500/20 to-pink-500/20 border border-purple-500/30 mr-8"
                              }`}
                              style={{
                                animationDelay: `${index * 100}ms`,
                                animation: "fadeInUp 0.5s ease-out forwards",
                              }}
                            >
                              <div
                                className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                                  msg.type === "user"
                                    ? "bg-blue-500/30"
                                    : "bg-purple-500/30"
                                }`}
                              >
                                {msg.type === "user" ? (
                                  <User className="w-4 h-4 text-blue-300" />
                                ) : (
                                  <Bot className="w-4 h-4 text-purple-300" />
                                )}
                              </div>
                              <div className="flex-1">
                                <div
                                  className={`text-sm font-medium mb-1 ${
                                    msg.type === "user"
                                      ? "text-blue-300"
                                      : "text-purple-300"
                                  }`}
                                >
                                  {msg.type === "user" ? "You" : "AI Assistant"}
                                </div>
                                {renderMessageContent(msg)}
                                {msg.timestamp && (
                                  <div className="text-xs text-gray-500 mt-2 flex items-center space-x-1">
                                    <Calendar className="w-3 h-3" />
                                    <span>
                                      {formatTimestamp(msg.timestamp)}
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                      </div>
                    </>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full text-center py-16">
                      <div className="relative mb-6">
                        <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full blur-lg opacity-50 animate-pulse"></div>
                        <div className="relative bg-gradient-to-r from-blue-500/20 to-purple-500/20 w-20 h-20 rounded-full flex items-center justify-center border border-white/20">
                          <MessageCircle className="w-10 h-10 text-gray-400" />
                        </div>
                      </div>
                      <h3 className="text-2xl font-light text-gray-300 mb-3">
                        Select a Conversation
                      </h3>
                      <p className="text-gray-500 max-w-md">
                        Choose a conversation from your folders to view the chat
                        history, AI interactions, and add notes
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Custom Styles */}
      <style jsx>{`
        .bg-gradient-radial {
          background: radial-gradient(circle, var(--tw-gradient-stops));
        }

        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }

        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 3px;
        }

        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(59, 130, 246, 0.5);
          border-radius: 3px;
        }

        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(59, 130, 246, 0.7);
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .animate-fadeIn {
          animation: fadeIn 0.3s ease-out;
        }

        @keyframes float {
          0%,
          100% {
            transform: translateY(0px);
          }
          50% {
            transform: translateY(-20px);
          }
        }

        .animate-float {
          animation: float 6s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
