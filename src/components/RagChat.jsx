import { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import { Send, Loader2, Bot, User, FileSearch, Clock, Search } from "lucide-react";

const QUICK_PROMPTS = [
  "What are the main types of NSCLC?",
  "What is adenocarcinoma?",
  "How is NSCLC staged?",
  "What are the treatment options for Stage III NSCLC?",
  "What is the role of CT radiomics in lung cancer prognosis?",
];

function MetadataBadge({ icon: Icon, label, value }) {
  return (
    <div className="flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-600 dark:bg-slate-700/60 dark:text-slate-300">
      <Icon className="h-3 w-3" />
      <span className="font-medium">{label}:</span>
      <span>{value}</span>
    </div>
  );
}

function RagChat({ onAsk, darkMode }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  const handleSend = async (question) => {
    const q = (question || input).trim();
    if (!q || loading) return;

    setInput("");
    setMessages((prev) => [
      ...prev,
      { role: "user", content: q },
    ]);
    setLoading(true);

    const result = await onAsk(q);

    setMessages((prev) => [
      ...prev,
      {
        role: "assistant",
        content: result.data.answer,
        metadata: {
          retrieved_documents: result.data.retrieved_documents,
          reranking_time_seconds: result.data.reranking_time_seconds,
          retrieval_time_seconds: result.data.retrieval_time_seconds,
          model: result.data.model,
        },
        mocked: result.mocked,
      },
    ]);
    setLoading(false);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="mx-auto flex h-[calc(100vh-121px)] max-w-[1200px] flex-col px-4 py-5 sm:px-6">
      {/* Quick Prompts */}
      <div className="mb-4 flex flex-wrap gap-2">
        {QUICK_PROMPTS.map((prompt, i) => (
          <button
            key={i}
            onClick={() => handleSend(prompt)}
            disabled={loading}
            className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition-all hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-brand-700 dark:hover:bg-brand-900/20 dark:hover:text-brand-400"
          >
            {prompt}
          </button>
        ))}
      </div>

      {/* Chat Messages */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800/50"
      >
        {messages.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-500 dark:bg-brand-900/30 dark:text-brand-400">
              <Bot className="h-7 w-7" />
            </div>
            <h3 className="text-base font-semibold text-slate-700 dark:text-slate-200">
              Medical AI Knowledge Assistant
            </h3>
            <p className="mt-1.5 max-w-sm text-sm text-slate-500 dark:text-slate-400">
              Ask any question about NSCLC, lung cancer types, staging,
              treatments, or CT radiomics. Quick prompts above can help you get
              started.
            </p>
          </div>
        )}

        <div className="space-y-4">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex gap-3 ${
                msg.role === "user" ? "flex-row-reverse" : ""
              }`}
            >
              {/* Avatar */}
              <div
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                  msg.role === "user"
                    ? "bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300"
                    : "bg-brand-500 text-white"
                }`}
              >
                {msg.role === "user" ? (
                  <User className="h-4 w-4" />
                ) : (
                  <Bot className="h-4 w-4" />
                )}
              </div>

              {/* Message */}
              <div
                className={`flex max-w-[80%] flex-col gap-2 ${
                  msg.role === "user" ? "items-end" : "items-start"
                }`}
              >
                <div
                  className={`rounded-2xl px-4 py-2.5 text-sm ${
                    msg.role === "user"
                      ? "rounded-tr-sm bg-brand-500 text-white"
                      : "rounded-tl-sm bg-slate-100 text-slate-700 dark:bg-slate-700/60 dark:text-slate-200"
                  }`}
                >
                  {msg.role === "user" ? (
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  ) : (
                    <div className="markdown-body">
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                    </div>
                  )}
                </div>

                {/* Metadata Badges */}
                {msg.role === "assistant" && msg.metadata && (
                  <div className="flex flex-wrap items-center gap-1.5 pl-1">
                    <MetadataBadge
                      icon={FileSearch}
                      label="Retrieved"
                      value={msg.metadata.retrieved_documents}
                    />
                    <MetadataBadge
                      icon={Clock}
                      label="Reranking"
                      value={`${msg.metadata.reranking_time_seconds}s`}
                    />
                    <MetadataBadge
                      icon={Search}
                      label="Retrieval"
                      value={`${msg.metadata.retrieval_time_seconds}s`}
                    />
                    {msg.mocked && (
                      <span className="rounded-md bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                        Mock Fallback
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}

          {/* Loading */}
          {loading && (
            <div className="flex gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-500 text-white">
                <Bot className="h-4 w-4" />
              </div>
              <div className="flex items-center gap-2 rounded-2xl rounded-tl-sm bg-slate-100 px-4 py-3 dark:bg-slate-700/60">
                <Loader2 className="h-4 w-4 spin text-slate-400" />
                <span className="text-sm text-slate-500 dark:text-slate-400">
                  Searching knowledge base and generating answer...
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Input */}
      <div className="mt-4 flex items-end gap-2 rounded-2xl border border-slate-200 bg-white p-2 dark:border-slate-700 dark:bg-slate-800/50">
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          rows="1"
          placeholder="Ask a medical question about NSCLC..."
          className="flex-1 resize-none bg-transparent px-3 py-2 text-sm text-slate-800 outline-none dark:text-slate-100 dark:placeholder:text-slate-500"
          style={{ maxHeight: "120px" }}
        />
        <button
          onClick={() => handleSend()}
          disabled={!input.trim() || loading}
          className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-500 text-white transition-all hover:bg-brand-600 disabled:opacity-40"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </button>
      </div>
    </div>
  );
}

export default RagChat;
