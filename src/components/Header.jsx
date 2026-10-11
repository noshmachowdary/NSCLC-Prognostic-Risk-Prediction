import { Sun, Moon, Settings, Activity } from "lucide-react";

function Header({ darkMode, onToggleTheme, onOpenSettings, apiConnected }) {
  return (
    <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/90 backdrop-blur-md dark:border-slate-700 dark:bg-slate-900/90">
      <div className="mx-auto flex max-w-[1600px] items-center justify-between px-4 py-3 sm:px-6">
        {/* Title */}
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-500 text-white shadow-lg shadow-brand-500/30">
            <Activity className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-sm font-semibold leading-tight text-slate-800 dark:text-slate-100 sm:text-base lg:text-lg">
              Explainable Multimodal AI for NSCLC Prognostic Risk Prediction
            </h1>
            <p className="hidden text-xs text-slate-500 dark:text-slate-400 sm:block">
              CT Radiomics &amp; Clinical Data
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          {/* Status Badge */}
          <div
            className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-colors sm:px-3 ${
              apiConnected
                ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                : "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
            }`}
          >
            <span
              className={`pulse-dot h-2 w-2 rounded-full ${
                apiConnected ? "bg-emerald-500" : "bg-amber-500"
              }`}
            />
            <span className="hidden sm:inline">
              {apiConnected ? "FastAPI Connected" : "FastAPI Offline"}
            </span>
            <span className="sm:hidden">{apiConnected ? "Live" : "Off"}</span>
          </div>

          {/* Theme Toggle */}
          <button
            onClick={onToggleTheme}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition-all hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            aria-label="Toggle theme"
          >
            {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>

          {/* Settings */}
          <button
            onClick={onOpenSettings}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition-all hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            aria-label="API Settings"
          >
            <Settings className="h-4 w-4" />
          </button>
        </div>
      </div>
    </header>
  );
}

export default Header;
