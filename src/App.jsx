import { useState, useEffect, useCallback } from "react";
import Header from "./components/Header.jsx";
import TabNav from "./components/TabNav.jsx";
import SettingsModal from "./components/SettingsModal.jsx";
import Notification from "./components/Notification.jsx";
import PredictionDashboard from "./components/PredictionDashboard.jsx";
import RagChat from "./components/RagChat.jsx";
import { postPredict, postAsk, checkHealth, FASTAPI_BASE_URL } from "./api.js";

function App() {
  const [darkMode, setDarkMode] = useState(
    localStorage.getItem("dark_mode") === "true"
  );
  const [activeTab, setActiveTab] = useState("dashboard");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [baseUrl, setBaseUrlState] = useState(FASTAPI_BASE_URL);
  const [apiConnected, setApiConnected] = useState(false);
  const [notification, setNotification] = useState("");

  // Prediction state
  const [predictLoading, setPredictLoading] = useState(false);
  const [predictResult, setPredictResult] = useState(null);

  // Theme effect
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
    localStorage.setItem("dark_mode", darkMode.toString());
  }, [darkMode]);

  // Health check on mount and when URL changes
  const runHealthCheck = useCallback(async () => {
    const result = await checkHealth();
    setApiConnected(result.ok);
  }, []);

  useEffect(() => {
    runHealthCheck();
  }, [runHealthCheck, baseUrl]);

  const handleToggleTheme = () => setDarkMode((prev) => !prev);

  const handleBaseUrlSaved = (newUrl) => {
    setBaseUrlState(newUrl);
    runHealthCheck();
  };

  const handlePredict = async (features) => {
    setPredictLoading(true);
    const result = await postPredict(features);
    setPredictResult(result.data);
    setPredictLoading(false);

    if (result.mocked) {
      setNotification(
        "Backend is not reachable. Showing realistic mock prediction data so you can explore the dashboard."
      );
    }
  };

  const handleAsk = async (question) => {
    const result = await postAsk(question);

    if (result.mocked) {
      setNotification(
        "Backend is not reachable. Showing a mock RAG response so the chat remains functional."
      );
    }

    return result;
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 transition-colors dark:bg-slate-950 dark:text-slate-100">
      <Header
        darkMode={darkMode}
        onToggleTheme={handleToggleTheme}
        onOpenSettings={() => setSettingsOpen(true)}
        apiConnected={apiConnected}
      />
      <TabNav activeTab={activeTab} onTabChange={setActiveTab} />

      <main>
        {activeTab === "dashboard" && (
          <PredictionDashboard
            onPredict={handlePredict}
            loading={predictLoading}
            result={predictResult}
            darkMode={darkMode}
            onNotify={setNotification}
          />
        )}
        {activeTab === "chat" && (
          <RagChat onAsk={handleAsk} darkMode={darkMode} />
        )}
      </main>

      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        baseUrl={baseUrl}
        onBaseUrlSaved={handleBaseUrlSaved}
      />

      <Notification
        message={notification}
        onClose={() => setNotification("")}
      />
    </div>
  );
}

export default App;
