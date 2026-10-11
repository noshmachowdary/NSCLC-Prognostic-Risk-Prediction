import { Stethoscope, MessageSquareText } from "lucide-react";

function TabNav({ activeTab, onTabChange }) {
  const tabs = [
    {
      id: "dashboard",
      label: "Prognostic Risk & Explainability Dashboard",
      shortLabel: "Risk Dashboard",
      icon: Stethoscope,
    },
    {
      id: "chat",
      label: "Medical AI Knowledge Assistant",
      shortLabel: "AI Assistant",
      icon: MessageSquareText,
    },
  ];

  return (
    <div className="border-b border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
      <div className="mx-auto flex max-w-[1600px] gap-1 px-4 sm:px-6">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`relative flex items-center gap-2 px-3 py-3.5 text-sm font-medium transition-colors sm:px-4 ${
                active
                  ? "text-brand-600 dark:text-brand-400"
                  : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="hidden lg:inline">{tab.label}</span>
              <span className="lg:hidden">{tab.shortLabel}</span>
              {active && (
                <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-brand-500" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default TabNav;
