import { useState } from "react";
import { X, Loader2, CheckCircle2, AlertCircle, Save } from "lucide-react";
import { setBaseUrl, checkHealth } from "../api.js";

function SettingsModal({ open, onClose, baseUrl, onBaseUrlSaved }) {
  const [urlInput, setUrlInput] = useState(baseUrl);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);

  if (!open) return null;

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    setBaseUrl(urlInput.trim());
    const result = await checkHealth();
    setTestResult(result);
    setTesting(false);
  };

  const handleSave = () => {
    setBaseUrl(urlInput.trim());
    onBaseUrlSaved(urlInput.trim());
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-700 dark:bg-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
            API Configuration
          </h2>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
              FastAPI Base URL
            </label>
            <input
              type="text"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="http://localhost:8000"
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition-colors focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            />
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              The backend FastAPI server address.
            </p>
          </div>

          {/* Test Result */}
          {testResult && (
            <div
              className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${
                testResult.ok
                  ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                  : "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
              }`}
            >
              {testResult.ok ? (
                <>
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  <span>Connection successful — server is healthy.</span>
                </>
              ) : (
                <>
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>Could not reach the server. Mock data will be used.</span>
                </>
              )}
            </div>
          )}

          {/* Buttons */}
          <div className="flex gap-2 pt-2">
            <button
              onClick={handleTest}
              disabled={testing}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 disabled:opacity-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              {testing ? (
                <Loader2 className="h-4 w-4 spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4" />
              )}
              Test Connection
            </button>
            <button
              onClick={handleSave}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-600"
            >
              <Save className="h-4 w-4" />
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SettingsModal;
