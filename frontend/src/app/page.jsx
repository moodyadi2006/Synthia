"use client";
import React, { useState, useEffect, useRef } from "react";
import {
  Home,
  Archive,
  Plus,
  Mic,
  Youtube,
  LucideCamera,
  FileText,
  Square,
  Search,
  Upload,
  CheckCircle,
  Loader,
  User,
  LogOut,
  X,
  Send,
  FileCheck,
  MessageSquare,
  Download,
  FolderOpen,
  Save,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import axios from "axios";

export default function CampusCruxHome() {
  const [isLoaded, setIsLoaded] = useState(false);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [searchValue, setSearchValue] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [selectedMode, setSelectedMode] = useState(null);
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showUserModal, setShowUserModal] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [showToast2, setShowToast2] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [sessionId, setSessionId] = useState(null);
  const [videoId, setVideoId] = useState(null);
  const [conversation, setConversation] = useState([]);
  const [isChat, setIsChat] = useState(false);
  const [initialResult, setInitialResult] = useState(null);
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [dots, setDots] = useState([]);
  const [showDownloadModal, setShowDownloadModal] = useState(false);
  const [conversationName, setConversationName] = useState("");
  const [selectedFolder, setSelectedFolder] = useState("");
  const [newFolderName, setNewFolderName] = useState("");
  const [showNewFolderInput, setShowNewFolderInput] = useState(false);
  const [folders, setFolders] = useState([]);
  const [expandedIndex, setExpandedIndex] = useState(null);
  const [user, setUser] = useState(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const { data: session, status } = useSession();
  const router = useRouter();
  const recognition = useRef(null);
  const fileInputRef = useRef(null);
  const chatContainerRef = useRef(null);
  const messagesEndRef = useRef(null);

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
    if (!user?.email) return;

    const fetchFolders = async () => {
      try {
        const response = await axios.post("/api/fetchFolders", {
          email: user.email,
        });

        const data = response.data;

        if (data.success) {
          setFolders(data.folders);
        }
      } catch (error) {
        console.error("Error fetching folders:", error);
      }
    };

    fetchFolders();
  }, [user?.email]);

  const handleDownloadConversation = () => {
    setConversationName("");
    setShowDownloadModal(true);
  };

  const controllerRef = useRef(null);
  const handleCreateNewFolder = async () => {
    const folderName = newFolderName.trim();
    const userEmail = user?.email;

    if (!folderName) return;

    const duplicate = folders.some(
      (folder) => folder.folderName.toLowerCase() === folderName.toLowerCase()
    );

    if (duplicate) {
      showToastMessage2(`A folder named "${folderName}" already exists.`);
      return;
    }

    if (controllerRef.current) {
      controllerRef.current.abort();
    }

    controllerRef.current = new AbortController();

    setCreatingFolder(true);

    try {
      const response = await axios.post(
        "/api/createFolder",
        {
          userEmail,
          folderName,
        },
        {
          signal: controllerRef.current.signal,
        }
      );

      const data = response.data;

      if (data.success) {
        setFolders((prev) => [...prev, data.folder]);
        setSelectedFolder(
          data.folder.folderName?.toString() ||
            data.folder.folderName?.toString()
        );
        setNewFolderName("");
        setShowNewFolderInput(false);
      } else {
        showToastMessage2("Failed to create folder: " + data.message);
      }
    } catch (error) {
      if (axios.isCancel?.(error) || error.name === "CanceledError") {
        console.log("Folder creation cancelled");
      } else {
        showToastMessage2("An error occurred while creating the folder.");
      }
    } finally {
      setCreatingFolder(false);
    }
  };

  const handleCancel = () => {
    if (controllerRef.current) {
      controllerRef.current.abort();
    }
    setShowNewFolderInput(false);
    setNewFolderName("");
  };

  const saveControllerRef = useRef(null);

  const handleSaveConversation = async () => {
    setIsSaving(true);

    if (!conversationName.trim()) {
      showToastMessage2("Please provide a conversation name");
      setIsSaving(false);
      return;
    }

    if (selectedFolder === "") {
      showToastMessage2("Please select a folder");
      setIsSaving(false);
      return;
    }

    if (saveControllerRef.current) {
      saveControllerRef.current.abort();
    }

    saveControllerRef.current = new AbortController();

    try {
      const selectedFolderData = selectedFolder
        ? folders.find((f) => f?.folderName.toString() === selectedFolder)
        : null;

      const conversationData = {
        id: Date.now(),
        name: conversationName.trim(),
        folderName: selectedFolderData?.folderName || null,
        messages: conversation || [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      const userEmail = user?.email;
      const response = await axios.post(
        "/api/conversations",
        { userEmail, conversationData },
        {
          signal: saveControllerRef.current.signal,
        }
      );

      if (!response.data.success) {
        showToastMessage("Failed to save conversation");
        throw new Error("Failed to save conversation");
      }

      setShowDownloadModal(false);
      setConversationName("");
      setSelectedFolder("");
      setShowNewFolderInput(false);
      setNewFolderName("");
      showToastMessage("Conversation saved successfully!");
    } catch (error) {
      if (axios.isCancel?.(error) || error.name === "CanceledError") {
        console.log("Conversation save cancelled");
      } else {
        showToastMessage("Error saving conversation: " + error.message);
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleCloseDownloadModal = () => {
    if (saveControllerRef.current) {
      saveControllerRef.current.abort();
    }
    setShowDownloadModal(false);
    setConversationName("");
    setSelectedFolder("");
    setShowNewFolderInput(false);
    setNewFolderName("");
  };

  useEffect(() => {
    if (status === "authenticated" && session?.user) {
      setUser(session.user);
      setIsLoggedIn(true);
    }
    if (session?.provider === "google" && session?.expiresAt) {
      const now = Math.floor(Date.now() / 1000);
      const timeUntilExpiry = session?.expiresAt - now;

      if (timeUntilExpiry <= 0) {
        signOut({ callbackUrl: "/signIn", redirect: true });
      } else if (timeUntilExpiry < 300) {
        showToastMessage("Session gonna expire soon...");
        const timer = setTimeout(() => {
          signOut({ callbackUrl: "/signIn", redirect: true });
        }, timeUntilExpiry * 1000);

        return () => clearTimeout(timer);
      }
    }
  }, [session, status]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [conversation]);

  const modes = {
    briefDoc: {
      icon: FileText,
      label: "BriefDoc",
      gradient: "from-green-500 to-emerald-500",
      acceptedFiles: ".pdf,.docx",
      placeholder: "Upload PDF or Docx for brief summary...",
      type: "file",
    },
    detailDoc: {
      icon: FileText,
      label: "DetailDoc",
      gradient: "from-red-500 to-pink-500",
      acceptedFiles: ".pdf,.docx",
      placeholder: "Upload PDF or Docx for detailed summary...",
      type: "file",
    },
    sumTube: {
      icon: Youtube,
      label: "SumTube",
      gradient: "from-blue-500 to-indigo-500",
      acceptedFiles: null,
      placeholder: "Paste YouTube video link...",
      type: "url",
    },
    visuaLens: {
      icon: LucideCamera,
      label: "VisuaLens",
      gradient: "from-purple-500 to-violet-500",
      acceptedFiles: ".jpg,.jpeg,.png,.gif,.bmp,.webp",
      placeholder: "Upload image for analysis...",
      type: "file",
    },
  };

  const showToastMessage = (message) => {
    setToastMessage(message);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  };

  const showToastMessage2 = (message) => {
    setToastMessage(message);
    setShowToast2(true);
    setTimeout(() => setShowToast2(false), 3000);
  };

  const handleUserIconClick = () => {
    if (!isLoggedIn) {
      router.push("/signIn");
    } else {
      setShowUserModal(true);
    }
  };

  const handleLogout = () => {
    signOut({ callbackUrl: "/" });
    setUser(null);
    setIsLoggedIn(false);
    setShowUserModal(false);
    showToastMessage("Logged out successfully!");
  };

  const handleSpacesClick = () => {
    if (!isLoggedIn) {
      showToastMessage("Please login first to access Spaces");
      return;
    }
    router.push("/spaces");
  };

  const checkAuthForFileOperation = () => {
    if (!isLoggedIn) {
      showToastMessage("Please login first to upload files");
      return false;
    }
    return true;
  };

  useEffect(() => {
    if (!recognition.current) {
      recognition.current = new window.webkitSpeechRecognition();
      recognition.current.lang = "en-US";
      recognition.current.interimResults = false;
      recognition.current.continuous = true;

      recognition.current.onresult = (event) => {
        let appendedTranscript = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          appendedTranscript += event.results[i][0].transcript;
        }
        setSearchValue((prev) => prev + appendedTranscript);
      };

      recognition.current.onerror = (event) => {
        showToastMessage("Speech recognition error:", event.error);
      };
    }
  }, [isListening]);

  const toggleListening = () => {
    if (isListening) {
      recognition.current.stop();
      setIsListening(false);
      recognition.current.continuous = false;
    } else {
      recognition.current.start();
      setIsListening(true);
    }
  };

  useEffect(() => {
    setIsLoaded(true);
    const handleMouseMove = (e) => {
      setMousePosition({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  const handleModeSelect = (mode) => {
    setSelectedMode(mode);
    setFile(null);
    setSearchValue("");
    setInitialResult(null);
    setConversation([]);
    setIsChat(false);
    setSessionId(null);
  };

  const handleFileChange = (e) => {
    if (!checkAuthForFileOperation()) {
      e.target.value = "";
      return;
    }

    const selectedFile = e.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);
      setSearchValue(`${selectedFile.name} selected`);
    }
  };

  const handleUrlChange = (e) => {
    setSearchValue(e.target.value);
  };

  const formatSummary = (summaries) => {
    if (!summaries) {
      return (
        <div className="text-gray-400 italic text-center py-4">
          No summary available.
        </div>
      );
    }

    if (typeof summaries === "string") {
      return (
        <div className="mb-6 p-6 bg-gray-800/40 rounded-2xl shadow-md hover:shadow-lg transition-shadow duration-300 text-gray-100 text-base md:text-lg prose prose-invert max-w-none prose-pre:bg-gray-900 prose-code:bg-gray-900 prose-code:text-gray-100 prose-code:px-1 prose-code:rounded">
          <article>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {summaries}
            </ReactMarkdown>
          </article>
        </div>
      );
    }

    if (Array.isArray(summaries)) {
      if (summaries.length === 0) {
        return (
          <div className="text-gray-400 italic text-center py-4">
            No summary available.
          </div>
        );
      }
      return summaries.map((item, index) => (
        <div
          key={index}
          className="mb-6 p-6 bg-gray-800/40 rounded-2xl shadow-md hover:shadow-lg transition-shadow duration-300 text-gray-100 text-base md:text-lg prose prose-invert max-w-none prose-pre:bg-gray-900 prose-code:bg-gray-900 prose-code:text-gray-100 prose-code:px-1 prose-code:rounded"
        >
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{item}</ReactMarkdown>
        </div>
      ));
    }

    return (
      <div className="text-gray-400 italic text-center py-4">
        Unable to display summary format.
      </div>
    );
  };

  const handleInitialSearch = async () => {
    if (!selectedMode) return;

    if (modes[selectedMode].type === "file" && !checkAuthForFileOperation()) {
      return;
    }

    setLoading(true);

    try {
      const formData = new FormData();
      formData.append("mode", selectedMode);

      if (selectedMode === "sumTube") {
        formData.append("url", searchValue);
      } else {
        if (!file) throw new Error("No file selected");
        formData.append("file", file);
      }

      const res = await axios.post("/api/initialSearch", formData);

      const data = res.data;

      setInitialResult(data);
      setIsChat(true);

      let initialMessage;

      if (selectedMode === "sumTube") {
        setVideoId(data.result.video_id);
        initialMessage = {
          type: "assistant",
          content: {
            mode: selectedMode,
            videoThumbnail: data.result.thumbnail,
            summary: data.result?.summary || "",
          },
          timestamp: new Date(),
        };
      } else if (selectedMode === "visuaLens") {
        setSessionId(data.session_id);
        initialMessage = {
          type: "assistant",
          content: {
            mode: selectedMode,
            summary: data.result?.summary || "",
          },
          timestamp: new Date(),
        };
      } else {
        setSessionId(data.session_id);
        initialMessage = {
          type: "assistant",
          content: {
            mode: selectedMode,
            fileName: file?.name,
            summary: [
              ...(data.result?.text_summaries || []),
              ...(data.result?.image_summaries || []),
              ...(data.result?.table_summaries || []),
            ],
            metadata: data.vectorized_metadata,
          },
          timestamp: new Date(),
        };
      }

      setConversation([initialMessage]);
      setSearchValue("");
    } catch (err) {
      console.error(err);
      if (selectedMode === "sumTube") {
        if (err.status == 500) {
          showToastMessage(
            "Failed to process link. Please provide a valid link and try again."
          );
        }
      } else if (selectedMode === "visuaLens") {
        showToastMessage(
          "Failed to process image. Please select a valid image file."
        );
      } else {
        showToastMessage(
          "Failed to process file. Please select a file and try again."
        );
      }
    }

    setLoading(false);
  };

  const handleNewChat = () => {
    setIsChat(false);
    setSelectedMode(null);
    setConversation([]);
    setFile(null);
    setSearchValue("");
    setSessionId(null);
    showToastMessage("New Chat");
  };

  const handleQuestionSubmit = async () => {
    if (!searchValue.trim() || (!sessionId && !videoId)) return;

    const userMessage = {
      type: "user",
      content: searchValue,
      timestamp: new Date(),
    };

    setConversation((prev) => [...prev, userMessage]);
    setSearchValue("");
    setLoading(true);

    try {
      const formData = new FormData();
      if (sessionId) formData.append("session_id", sessionId);
      if (videoId) formData.append("video_id", videoId);
      formData.append("question", userMessage.content);

      const res = await axios.post("/api/questionSubmit", formData);

      const data = res.data;

      const assistantMessage = {
        type: "assistant",
        content: {
          answer:
            data.answer || "I couldn't generate a response for your question.",
          sources: data.sources || [],
        },
        timestamp: new Date(),
      };

      setConversation((prev) => [...prev, assistantMessage]);
    } catch (err) {
      const errorMessage = {
        type: "assistant",
        content:
          "Sorry, I encountered an error while processing your question. Please try again.",
        timestamp: new Date(),
      };
      setConversation((prev) => [...prev, errorMessage]);
    }

    setLoading(false);
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (isChat) {
        handleQuestionSubmit();
      } else {
        handleInitialSearch();
      }
    }
  };

  const IconComponent = selectedMode ? modes[selectedMode].icon : null;

  const renderInputField = () => {
    if (isChat) {
      return (
        <input
          type="text"
          placeholder="Ask a question about the document..."
          value={searchValue || ""}
          onChange={(e) => setSearchValue(e.target.value)}
          onKeyPress={handleKeyPress}
          className="flex-1 bg-transparent px-6 py-4 text-white placeholder-gray-400 focus:outline-none text-lg"
        />
      );
    }

    if (!selectedMode) {
      return (
        <input
          type="text"
          placeholder="Select a mode first..."
          value=""
          disabled
          className="flex-1 bg-transparent px-6 py-4 text-gray-500 placeholder-gray-500 focus:outline-none text-lg cursor-not-allowed"
        />
      );
    }

    const mode = modes[selectedMode];

    if (mode.type === "url") {
      return (
        <input
          type="url"
          placeholder={mode.placeholder}
          value={searchValue || ""}
          onChange={handleUrlChange}
          onKeyPress={handleKeyPress}
          className="flex-1 bg-transparent px-6 py-4 text-white placeholder-gray-400 focus:outline-none text-lg"
        />
      );
    }

    return (
      <div className="flex-1 flex items-center">
        <input
          type="text"
          placeholder={mode.placeholder}
          value={searchValue || ""}
          readOnly
          disabled={loading}
          className={`flex-1 bg-transparent px-6 py-4 text-white placeholder-gray-400 focus:outline-none text-lg ${
            loading ? "cursor-not-allowed opacity-50" : "cursor-pointer"
          }`}
          onClick={() => {
            if (!loading && checkAuthForFileOperation()) {
              fileInputRef.current?.click();
            }
          }}
        />
        <input
          ref={fileInputRef}
          type="file"
          accept={mode.acceptedFiles}
          onChange={handleFileChange}
          className="hidden"
        />
      </div>
    );
  };

  const renderActionButtons = () => {
    if (!selectedMode) return null;

    const mode = modes[selectedMode];

    return (
      <div className="flex items-center space-x-2 px-2">
        {mode.type === "file" && !isChat && !loading && (
          <button
            onClick={() => {
              if (checkAuthForFileOperation()) {
                fileInputRef.current?.click();
              }
            }}
            className="cursor-pointer p-3 text-gray-400 hover:text-white hover:bg-gray-700/50 rounded-xl transition-all duration-300 transform hover:scale-110"
          >
            <Upload className="w-5 h-5" />
          </button>
        )}
        {isChat &&
          (mode.type === "file" || mode.type === "url") &&
          !loading && (
            <button
              onClick={handleDownloadConversation}
              className="cursor-pointer p-3 text-gray-400 hover:text-white hover:bg-gray-700/50 rounded-xl transition-all duration-300 transform hover:scale-110"
            >
              <Download className="w-5 h-5" />
            </button>
          )}

        {isChat && (
          <button
            onClick={toggleListening}
            className="p-3 cursor-pointer text-gray-400 hover:text-white hover:bg-gray-700/50 rounded-xl transition-all duration-300 transform hover:scale-110"
          >
            {isListening ? (
              <Square className="w-5 h-5" />
            ) : (
              <Mic className="w-5 h-5" />
            )}
          </button>
        )}

        <div className="relative flex justify-center items-center">
          <div className="absolute inset-0 bg-gradient-to-r from-purple-500 to-cyan-500 rounded-xl blur-md opacity-75"></div>
          <button
            onClick={isChat ? handleQuestionSubmit : handleInitialSearch}
            disabled={loading}
            className={`cursor-pointer relative bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-700 hover:to-cyan-700 text-white p-3 rounded-xl transition-all duration-300 transform origin-center hover:scale-110 will-change-transform group ${
              loading ? "opacity-50 cursor-not-allowed" : ""
            }`}
          >
            {loading ? (
              <Loader className="w-5 h-5 animate-spin" />
            ) : isChat ? (
              <Send className="w-5 h-5 group-hover:rotate-12 transition-transform" />
            ) : (
              <Search className="w-5 h-5 group-hover:rotate-12 transition-transform" />
            )}
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-gray-900">
      {showToast && (
        <div className="fixed top-4 right-4 z-50 bg-gradient-to-r from-red-500 to-pink-500 text-white px-6 py-3 rounded-lg shadow-lg transform transition-all duration-300 animate-pulse">
          {toastMessage}
        </div>
      )}
      {showToast2 && (
        <div className="fixed z-60 top-4 right-4 bg-gradient-to-r from-red-500 to-pink-500 text-white px-6 py-3 rounded-lg shadow-lg transform transition-all duration-300 animate-pulse">
          {toastMessage}
        </div>
      )}

      {showUserModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-gray-800 rounded-2xl p-8 max-w-md w-full mx-4 border border-white/10 relative">
            <button
              onClick={() => setShowUserModal(false)}
              className="cursor-pointer absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
            >
              <X className="w-6 h-6" />
            </button>

            <div className="text-center">
              <div className="mb-6">
                <h2 className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-cyan-400 bg-clip-text text-transparent">
                  Synthia
                </h2>
              </div>

              <div className="mb-6">
                <h3 className="text-xl text-white mb-2">
                  How is it going, {user?.fullName || user?.name || "User"}!
                </h3>
              </div>

              <div className="space-y-4 mb-8">
                <div className="bg-gray-700/50 rounded-lg p-4 text-left">
                  <p className="text-gray-400 text-sm">Full Name</p>
                  <p className="text-white font-medium">
                    {user?.fullName || user?.name || "N/A"}
                  </p>
                </div>
                <div className="bg-gray-700/50 rounded-lg p-4 text-left">
                  <p className="text-gray-400 text-sm">Email</p>
                  <p className="text-white font-medium">
                    {user?.email || "N/A"}
                  </p>
                </div>
              </div>

              <button
                onClick={handleLogout}
                className="cursor-pointer w-full bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600 text-white py-3 px-6 rounded-xl transition-all duration-300 transform hover:scale-105 flex items-center justify-center space-x-2"
              >
                <LogOut className="w-5 h-5" />
                <span>Logout</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {showDownloadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-gray-800 rounded-2xl p-8 max-w-md w-full mx-4 border border-white/10 relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={handleCloseDownloadModal}
              className="cursor-pointer absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
            >
              <X className="w-6 h-6" />
            </button>

            <div className="text-center mb-6">
              <div className="mb-4">
                <h2 className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-cyan-400 bg-clip-text text-transparent">
                  Save Conversation
                </h2>
              </div>
              <p className="text-gray-400 text-sm">
                Save this conversation to your collection
              </p>
            </div>

            <div className="space-y-6">
              <div>
                <label className="block text-gray-400 text-sm mb-2">
                  Conversation Name *
                </label>
                <input
                  type="text"
                  value={conversationName}
                  onChange={(e) => setConversationName(e.target.value)}
                  className="w-full bg-gray-700/50 rounded-lg p-3 text-white border border-gray-600 focus:border-purple-500 focus:outline-none transition-colors"
                  placeholder="Enter conversation name..."
                />
              </div>

              <div>
                <label className="block text-gray-400 text-sm mb-2">
                  Select Folder *
                </label>
                <select
                  value={selectedFolder}
                  onChange={(e) => setSelectedFolder(e.target.value)}
                  className="cursor-pointer w-full bg-gray-700/50 rounded-lg p-3 text-white border border-gray-600 focus:border-purple-500 focus:outline-none transition-colors"
                >
                  <option value="">No Folder</option>
                  {folders.map((folder, index) => (
                    <option
                      key={folder._id || index}
                      value={folder._id || folder.folderName}
                    >
                      {folder.folderName}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                {!showNewFolderInput ? (
                  <button
                    onClick={() => setShowNewFolderInput(true)}
                    className="cursor-pointer flex items-center gap-2 text-purple-400 hover:text-purple-300 text-sm font-medium transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    Create New Folder
                  </button>
                ) : (
                  <div className="space-y-3">
                    <input
                      type="text"
                      value={newFolderName}
                      onChange={(e) => setNewFolderName(e.target.value)}
                      className="w-full bg-gray-700/50 rounded-lg p-3 text-white border border-gray-600 focus:border-purple-500 focus:outline-none transition-colors"
                      placeholder="Enter folder name..."
                      onKeyPress={(e) =>
                        e.key === "Enter" && handleCreateNewFolder()
                      }
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={handleCreateNewFolder}
                        className="cursor-pointer bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm transition-colors flex items-center gap-2"
                        disabled={creatingFolder}
                      >
                        {creatingFolder ? (
                          <>
                            <svg
                              className="animate-spin h-4 w-4 text-white"
                              xmlns="http://www.w3.org/2000/svg"
                              fill="none"
                              viewBox="0 0 24 24"
                            >
                              <circle
                                className="opacity-25"
                                cx="12"
                                cy="12"
                                r="10"
                                stroke="currentColor"
                                strokeWidth="4"
                              ></circle>
                              <path
                                className="opacity-75"
                                fill="currentColor"
                                d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                              ></path>
                            </svg>
                            Creating...
                          </>
                        ) : (
                          "Create"
                        )}
                      </button>
                      <button
                        onClick={handleCancel}
                        className="cursor-pointer bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg text-sm transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {folders.length > 0 && (
                <div>
                  <h4 className="text-gray-400 text-sm mb-2">
                    Available Folders
                  </h4>
                  <div className="space-y-1 max-h-24 overflow-y-auto">
                    {folders.map((folder) => (
                      <div
                        key={folder?.folderName}
                        className="flex items-center gap-2 text-sm text-gray-300"
                      >
                        <FolderOpen className="w-4 h-4" />
                        <span>{folder.folderName}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {folders.length === 0 && (
                <div>
                  <h4 className="text-gray-400 text-sm mb-2">
                    Available Folders
                  </h4>
                  <div className="space-y-1 max-h-24 overflow-y-auto">
                    No folders created yet
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <button
                  onClick={handleSaveConversation}
                  disabled={isSaving}
                  className={`cursor-pointer flex-1 bg-gradient-to-r from-purple-500 to-cyan-500 hover:from-purple-600 hover:to-cyan-600 text-white py-3 px-6 rounded-xl transition-all duration-300 transform hover:scale-105 flex items-center justify-center space-x-2 ${
                    isSaving ? "opacity-50 cursor-not-allowed" : ""
                  }`}
                >
                  {isSaving ? (
                    <>
                      <svg
                        className="animate-spin h-5 w-5 text-white"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                          fill="none"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                        />
                      </svg>
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-5 h-5" />
                      <span>Save</span>
                    </>
                  )}
                </button>

                <button
                  onClick={handleCloseDownloadModal}
                  className="cursor-pointer flex-1 bg-gray-600 hover:bg-gray-700 text-white py-3 px-6 rounded-xl transition-all duration-300 transform hover:scale-105"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Animated Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-gray-900 via-purple-900/20 to-cyan-900/20">
        <div className="absolute top-20 left-20 w-72 h-72 bg-gradient-to-r from-purple-500/30 to-pink-500/30 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-20 right-20 w-96 h-96 bg-gradient-to-r from-cyan-500/20 to-blue-500/20 rounded-full blur-3xl animate-pulse delay-1000"></div>
        <div className="absolute top-1/2 left-1/3 w-64 h-64 bg-gradient-to-r from-emerald-500/20 to-teal-500/20 rounded-full blur-3xl animate-pulse delay-500"></div>

        <div
          className="absolute w-96 h-96 bg-gradient-radial from-purple-500/10 to-transparent rounded-full blur-2xl transition-all duration-300 ease-out pointer-events-none"
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

      <div className="relative z-10 min-h-screen text-white flex">
        <div className="fixed left-0 top-0 h-screen w-20 bg-gray-800/50 backdrop-blur-xl border-r border-white/10 flex flex-col items-center py-6 space-y-6 z-50">
          <div className="relative group">
            <div className="absolute inset-0 bg-gradient-to-r from-purple-500 to-cyan-500 rounded-xl blur-lg opacity-50 group-hover:opacity-75 transition-opacity"></div>
            <div className="relative w-12 h-12 bg-gradient-to-r from-purple-500 to-cyan-500 rounded-xl flex items-center justify-center transform transition-transform hover:scale-110">
              <div className="w-40 h-40 relative">
                <img
                  src="/logo.png"
                  alt="Synthia Logo"
                  className="w-full h-full object-contain"
                />
              </div>
            </div>
          </div>

          <button
            onClick={handleNewChat}
            disabled={loading}
            className="cursor-pointer w-12 h-12 text-gray-400 hover:text-white transition-all duration-300 bg-gray-700/50 hover:bg-gray-600/50 rounded-xl backdrop-blur-sm border border-gray-600/30 hover:border-purple-500/50 transform hover:scale-110 group"
          >
            <Plus className="w-6 h-6 mx-auto group-hover:rotate-90 transition-transform duration-300" />
          </button>

          <div className="flex flex-col space-y-6 mt-8">
            <div className="flex flex-col items-center space-y-2 group">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-r from-purple-500 to-cyan-500 rounded-xl blur-md opacity-75"></div>
                <button
                  onClick={() => router.push("/")}
                  className="cursor-pointer relative w-12 h-12 bg-gradient-to-r from-purple-600 to-cyan-600 rounded-xl flex items-center justify-center transform transition-all duration-300 hover:scale-110"
                >
                  <Home className="w-6 h-6 text-white" />
                </button>
              </div>
              <span className="text-xs font-medium bg-gradient-to-r from-purple-400 to-cyan-400 bg-clip-text text-transparent">
                Home
              </span>
            </div>

            <div className="flex flex-col items-center space-y-2 group">
              <button
                onClick={handleSpacesClick}
                className={`w-12 h-12 transition-all duration-300 rounded-xl backdrop-blur-sm border transform hover:scale-110 flex items-center justify-center ${
                  isLoggedIn
                    ? "text-gray-400 hover:text-white bg-gray-700/30 hover:bg-gray-600/50 border-gray-600/20 hover:border-purple-500/50 cursor-pointer"
                    : "text-gray-600 bg-gray-700/20 border-gray-600/10 cursor-not-allowed opacity-50"
                }`}
              >
                <Archive className="w-6 h-6" />
              </button>
              <span
                className={`text-xs transition-colors ${
                  isLoggedIn
                    ? "text-gray-400 group-hover:text-gray-300"
                    : "text-gray-600"
                }`}
              >
                Spaces
              </span>
            </div>
          </div>

          <div className="flex-1"></div>
          <div className="flex flex-col items-center space-y-4">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-cyan-500 to-purple-500 rounded-full blur-md opacity-50"></div>
              <div
                onClick={handleUserIconClick}
                className="cursor-pointer relative w-12 h-12 bg-gradient-to-r from-cyan-500 to-purple-500 rounded-full flex items-center justify-center text-white font-semibold text-lg transform transition-transform hover:scale-110"
              >
                <User className="w-5 h-5" />
              </div>
            </div>
            <div
              className={`w-3 h-3 rounded-full animate-pulse shadow-lg ${
                isLoggedIn
                  ? "bg-gradient-to-r from-green-500 to-emerald-500 shadow-green-500/50"
                  : "bg-gradient-to-r from-red-500 to-pink-500 shadow-red-500/50"
              }`}
            ></div>
          </div>
        </div>

        <div className="flex-1 flex flex-col ml-20">
          {!isChat ? (
            <div className="flex-1 flex flex-col items-center justify-center px-8">
              <div
                className={`mb-16 transform transition-all duration-1000 ${
                  isLoaded
                    ? "translate-y-0 opacity-100"
                    : "translate-y-10 opacity-0"
                }`}
              >
                <div className="relative flex items-center justify-center">
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-72 h-72 bg-white/10 rounded-full blur-3xl"></div>
                  </div>

                  <div className="relative z-10 flex items-center space-x-6">
                    <div className="w-40 h-40 relative">
                      <img
                        src="/logo.png"
                        alt="Synthia Logo"
                        className="w-full h-full object-contain"
                      />
                    </div>

                    <h1 className="text-6xl font-light tracking-wide text-center text-white drop-shadow-[0_0_12px_white]">
                      <span className="bg-gradient-to-r from-white via-purple-200 to-cyan-200 bg-clip-text text-transparent">
                        Synthia
                      </span>
                    </h1>
                  </div>
                </div>
              </div>

              {selectedMode && (
                <div className="mb-4 flex items-center space-x-2">
                  <div
                    className={`p-2 bg-gradient-to-r ${modes[selectedMode].gradient} rounded-lg`}
                  >
                    <IconComponent className="w-5 h-5 text-white" />
                  </div>
                  <span className="text-white font-medium">
                    {modes[selectedMode].label} Mode
                  </span>
                  <button
                    onClick={() => setSelectedMode(null)}
                    disabled={loading} // disable when loading
                    className={`ml-2 cursor-pointer text-gray-400 hover:text-white transition-opacity ${
                      loading ? "opacity-50 cursor-not-allowed" : ""
                    }`}
                  >
                    ✕
                  </button>
                </div>
              )}

              <div
                className={`w-full max-w-3xl mb-12 transform transition-all duration-1000 delay-300 ${
                  isLoaded
                    ? "translate-y-0 opacity-100"
                    : "translate-y-10 opacity-0"
                }`}
              >
                <div className="relative group">
                  <div
                    className={`absolute inset-0 bg-gradient-to-r ${
                      selectedMode
                        ? `${modes[selectedMode].gradient
                            .replace("from-", "from-")
                            .replace("to-", "to-")}/20`
                        : "from-purple-500/20 to-cyan-500/20"
                    } rounded-2xl blur-xl group-focus-within:opacity-100 opacity-50 transition-opacity`}
                  ></div>

                  <div
                    className={`relative bg-gray-800/50 backdrop-blur-xl border ${
                      selectedMode ? "border-white/20" : "border-white/10"
                    } rounded-2xl p-2 group-focus-within:border-purple-500/50 transition-all duration-300`}
                  >
                    <div className="flex items-center">
                      {renderInputField()}
                      {renderActionButtons()}
                    </div>
                  </div>
                </div>
              </div>

              <div
                className={`flex flex-wrap gap-4 justify-center max-w-4xl transform transition-all duration-1000 delay-500 ${
                  isLoaded
                    ? "translate-y-0 opacity-100"
                    : "translate-y-10 opacity-0"
                }`}
              >
                {Object.entries(modes).map(([key, mode], index) => (
                  <button
                    key={`${key}-${index}`}
                    onClick={() => handleModeSelect(key)}
                    disabled={loading}
                    className={`cursor-pointer group relative backdrop-blur-xl border text-white px-6 py-4 rounded-2xl flex items-center space-x-3 hover:scale-105 hover:shadow-2xl transition-all duration-500 ${
                      selectedMode === key
                        ? `bg-gradient-to-r ${mode.gradient} border-white/30`
                        : "bg-gray-800/50 border-white/10 hover:border-purple-500/50"
                    } ${
                      isLoaded
                        ? "translate-y-0 opacity-100"
                        : "translate-y-5 opacity-0"
                    }`}
                    style={{ transitionDelay: `${index * 100}ms` }}
                  >
                    <div
                      className={`absolute inset-0 bg-gradient-to-r ${mode.gradient} rounded-2xl blur-xl opacity-0 group-hover:opacity-20 transition-opacity duration-300 z-0 pointer-events-none`}
                    ></div>

                    <div
                      className={`relative z-10 p-2 bg-gradient-to-r ${mode.gradient} rounded-lg`}
                    >
                      <mode.icon className="w-5 h-5 text-white" />
                    </div>

                    <span className="relative z-10 font-medium group-hover:text-white transition-colors">
                      {mode.label}
                    </span>

                    <div className="relative z-10 w-5 h-5">
                      {selectedMode === key && (
                        <CheckCircle className="w-5 h-5 text-white" />
                      )}
                    </div>

                    <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/5 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-600 rounded-2xl z-0 pointer-events-none"></div>
                  </button>
                ))}
              </div>

              <div className="absolute top-20 right-20 w-4 h-4 bg-purple-500 rounded-full animate-bounce opacity-60"></div>
              <div className="absolute bottom-32 left-32 w-3 h-3 bg-cyan-500 rounded-full animate-ping opacity-60"></div>
              <div className="absolute top-1/3 right-1/4 w-2 h-2 bg-pink-500 rounded-full animate-pulse opacity-60"></div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col h-screen">
              <div className="fixed top-0 right-0 left-20 z-40 flex items-center justify-between p-6 border-b border-white/10 bg-gray-800/30 backdrop-blur-xl">
                <div className="flex items-center space-x-3">
                  {selectedMode && (
                    <>
                      <div
                        className={`p-2 bg-gradient-to-r ${modes[selectedMode].gradient} rounded-lg`}
                      >
                        <IconComponent className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <h2 className="text-xl font-semibold text-white">
                          {modes[selectedMode].label} Chat
                        </h2>
                        <p className="text-sm text-gray-400">
                          {file?.name ||
                            "Link processed" ||
                            "Document processed"}
                        </p>
                      </div>
                    </>
                  )}
                </div>
                <button
                  onClick={() => {
                    setIsChat(false);
                    setSelectedMode(null);
                    setConversation([]);
                    setFile(null);
                    setSearchValue("");
                    setSessionId(null);
                  }}
                  className="cursor-pointer text-gray-400 hover:text-white transition-colors p-2 hover:bg-gray-700/50 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div
                ref={chatContainerRef}
                className="flex-1 overflow-y-auto p-6 space-y-6 mb-24 mt-20"
              >
                {conversation.map((message, index) => {
                  const isUser = message.type === "user";
                  const isFirstMessage = index === 0;
                  const hasVideoThumbnail =
                    message.content.videoThumbnail &&
                    selectedMode === "sumTube";

                  if (isUser) {
                    return (
                      <div key={index} className="flex justify-end">
                        <div className="max-w-[80%] bg-gradient-to-r from-purple-600 to-cyan-600 text-white px-6 py-4 rounded-2xl rounded-tr-md shadow-lg">
                          <p className="text-sm leading-relaxed">
                            {message.content.text || message.content}
                          </p>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div key={index} className="flex justify-start">
                      <div className="flex-shrink-0 mr-4 w-10 h-10 bg-gradient-to-r from-purple-500 to-cyan-500 rounded-full flex items-center justify-center shadow-lg">
                        <MessageSquare className="w-5 h-5 text-white" />
                      </div>
                      <div className="max-w-[85%] space-y-4">
                        {isFirstMessage && hasVideoThumbnail && (
                          <div className="relative rounded-xl overflow-hidden shadow-2xl max-w-lg mb-4">
                            <img
                              src={message.content.videoThumbnail}
                              alt="Video Thumbnail"
                              className="w-full h-auto object-cover"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent"></div>
                            <div className="absolute bottom-0 left-0 right-0 p-4">
                              <div className="flex items-center justify-between">
                                <div className="bg-red-600 text-white px-3 py-1.5 rounded-full text-xs font-semibold flex items-center space-x-1.5">
                                  <span className="text-xs">▶</span>
                                  <span>YouTube</span>
                                </div>
                                <div className="bg-black/80 backdrop-blur-sm text-white px-3 py-1.5 rounded-full text-xs font-medium">
                                  Video Analysis
                                </div>
                              </div>
                            </div>
                          </div>
                        )}

                        <div className="bg-gray-800/60 backdrop-blur-xl border border-white/10 text-white px-6 py-4 rounded-2xl rounded-tl-md shadow-lg space-y-4">
                          {(selectedMode === "visuaLens" ||
                            selectedMode === "detailDoc" ||
                            selectedMode === "sumTube" ||
                            selectedMode === "briefDoc") &&
                          message.content?.answer ? (
                            <>
                              <div>
                                <div className="text-white text-sm leading-relaxed whitespace-pre-wrap">
                                  {formatSummary(message.content.answer)}
                                </div>
                              </div>

                              {message.content.sources?.length > 0 && (
                                <div className="mt-4 max-w-6xl">
                                  <p className="font-semibold text-purple-300 text-sm mb-2">
                                    Sources:
                                  </p>

                                  <ol className="list-decimal list-inside space-y-1">
                                    {message.content.sources.map(
                                      (source, i) => (
                                        <li
                                          key={i}
                                          onClick={() =>
                                            setExpandedIndex(
                                              i === expandedIndex ? null : i
                                            )
                                          }
                                          className="cursor-pointer text-gray-100 hover:text-purple-200 transition-colors duration-200"
                                        >
                                          <span
                                            className={`block w-full ${
                                              expandedIndex === i
                                                ? "whitespace-normal break-words"
                                                : "truncate"
                                            }`}
                                            title={source}
                                          >
                                            {source}
                                          </span>
                                        </li>
                                      )
                                    )}
                                  </ol>
                                </div>
                              )}
                            </>
                          ) : (
                            <div className="prose prose-invert prose-sm max-w-none">
                              {formatSummary(message.content.summary)}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}

                {loading && (
                  <div className="flex justify-start">
                    <div className="flex-shrink-0 mr-4 w-10 h-10 bg-gradient-to-r from-purple-500 to-cyan-500 rounded-full flex items-center justify-center shadow-lg">
                      <MessageSquare className="w-5 h-5 text-white" />
                    </div>
                    <div className="bg-gray-800/60 backdrop-blur-xl border border-white/10 text-white px-6 py-4 rounded-2xl rounded-tl-md shadow-lg">
                      <div className="flex items-center space-x-3">
                        <Loader className="w-4 h-4 animate-spin text-purple-400" />
                        <span className="text-gray-300">
                          Analyzing content...
                        </span>
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              <div className="fixed bottom-0 right-0 left-20 z-40 p-6 border-t border-white/10 bg-gray-800/30 backdrop-blur-xl">
                <div className="relative group">
                  <div className="absolute inset-0 bg-gradient-to-r from-purple-500/20 to-cyan-500/20 rounded-2xl blur-xl group-focus-within:opacity-100 opacity-50 transition-opacity"></div>
                  <div className="relative bg-gray-800/50 backdrop-blur-xl border border-white/10 rounded-2xl p-2 group-focus-within:border-purple-500/50 transition-all duration-300">
                    <div className="flex items-center">
                      {renderInputField()}
                      {renderActionButtons()}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
        .bg-gradient-radial {
          background: radial-gradient(circle, var(--tw-gradient-stops));
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

        /* Custom scrollbar */
        ::-webkit-scrollbar {
          width: 8px;
        }

        ::-webkit-scrollbar-track {
          background: rgba(55, 65, 81, 0.3);
          border-radius: 4px;
        }

        ::-webkit-scrollbar-thumb {
          background: linear-gradient(45deg, #8b5cf6, #06b6d4);
          border-radius: 4px;
        }

        ::-webkit-scrollbar-thumb:hover {
          background: linear-gradient(45deg, #7c3aed, #0891b2);
        }
      `}</style>
    </div>
  );
}
