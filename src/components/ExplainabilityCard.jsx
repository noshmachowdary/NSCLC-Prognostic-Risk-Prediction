import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
} from "recharts";
import { Brain, TrendingUp, TrendingDown, Info } from "lucide-react";

function ShapTooltip({ active, payload, darkMode }) {
  if (!active || !payload || !payload.length) return null;
  const item = payload[0].payload;
  return (
    <div
      className={`rounded-lg border px-3 py-2 text-xs shadow-lg ${
        darkMode
          ? "border-slate-600 bg-slate-800 text-slate-200"
          : "border-slate-200 bg-white text-slate-700"
      }`}
    >
      <p className="font-medium">{item.display_name}</p>
      <p className="mt-0.5 text-slate-500 dark:text-slate-400">
        Feature value: {typeof item.value === "number" ? item.value.toFixed(2) : item.value}
      </p>
      <p
        className={`mt-0.5 font-medium ${
          item.shap_value > 0 ? "text-rose-500" : "text-brand-500"
        }`}
      >
        SHAP: {item.shap_value > 0 ? "+" : ""}
        {item.shap_value.toFixed(4)}
      </p>
    </div>
  );
}

function ExplainabilityCard({ result, darkMode }) {
  if (!result || !result.explainability) {
    return (
      <div className="flex min-h-[200px] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50/50 p-6 dark:border-slate-700 dark:bg-slate-800/30">
        <Brain className="mb-3 h-7 w-7 text-slate-300 dark:text-slate-600" />
        <p className="text-sm text-slate-400 dark:text-slate-500">
          SHAP feature importance will appear here after prediction.
        </p>
      </div>
    );
  }

  const allFeatures = result.explainability.all_features || [];
  const topFeatures = result.explainability.top_features || [];

  const chartData = allFeatures
    .map((f) => ({
      display_name: f.display_name,
      shap_value: f.shap_value,
      value: f.value,
      direction: f.direction,
    }))
    .sort((a, b) => Math.abs(b.shap_value) - Math.abs(a.shap_value))
    .slice(0, 8)
    .reverse();

  const topRiskDrivers = topFeatures.filter(
    (f) => f.direction === "increases_risk"
  );

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800/50">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-50 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400">
            <Brain className="h-4 w-4" />
          </div>
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
            Feature Importance &amp; Explainability
          </h3>
        </div>
        <span className="text-xs text-slate-400 dark:text-slate-500">
          SHAP Analysis
        </span>
      </div>

      {/* Legend */}
      <div className="mb-3 flex items-center gap-4 text-xs">
        <span className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
          <span className="h-2.5 w-2.5 rounded-sm bg-rose-500" />
          Increases Risk
        </span>
        <span className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
          <span className="h-2.5 w-2.5 rounded-sm bg-brand-500" />
          Decreases Risk
        </span>
      </div>

      {/* SHAP Chart */}
      <div className="mb-5 h-[280px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            layout="vertical"
            margin={{ top: 5, right: 15, bottom: 5, left: 10 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke={darkMode ? "#334155" : "#e2e8f0"}
              horizontal={false}
            />
            <XAxis
              type="number"
              tick={{ fontSize: 10, fill: darkMode ? "#94a3b8" : "#64748b" }}
              stroke={darkMode ? "#475569" : "#cbd5e1"}
            />
            <YAxis
              type="category"
              dataKey="display_name"
              tick={{ fontSize: 10, fill: darkMode ? "#94a3b8" : "#64748b" }}
              stroke={darkMode ? "#475569" : "#cbd5e1"}
              width={140}
            />
            <Tooltip content={<ShapTooltip darkMode={darkMode} />} cursor={{ fill: darkMode ? "rgba(51,65,85,0.3)" : "rgba(241,245,249,0.7)" }} />
            <ReferenceLine x={0} stroke={darkMode ? "#475569" : "#94a3b8"} strokeWidth={1} />
            <Bar dataKey="shap_value" radius={[0, 3, 3, 0]}>
              {chartData.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={entry.shap_value > 0 ? "#f43f5e" : "#3385fc"}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Clinical Summary */}
      <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-4 dark:border-slate-700 dark:bg-slate-800/40">
        <div className="mb-2 flex items-center gap-1.5">
          <Info className="h-3.5 w-3.5 text-slate-400" />
          <h4 className="text-xs font-semibold text-slate-700 dark:text-slate-300">
            Clinical Summary — Top Risk Drivers
          </h4>
        </div>
        <div className="space-y-2">
          {topRiskDrivers.length === 0 && (
            <p className="text-xs text-slate-400 dark:text-slate-500">
              No significant risk-increasing factors detected for this patient.
            </p>
          )}
          {topRiskDrivers.slice(0, 3).map((f, i) => (
            <div
              key={i}
              className="flex items-start gap-2 text-xs text-slate-600 dark:text-slate-400"
            >
              <TrendingUp className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-500" />
              <span>
                <strong className="text-slate-700 dark:text-slate-300">
                  {f.display_name}
                </strong>{" "}
                (SHAP: +{f.shap_value.toFixed(4)}) —{" "}
                {f.direction_display}
              </span>
            </div>
          ))}
          {topFeatures
            .filter((f) => f.direction === "decreases_risk")
            .slice(0, 1)
            .map((f, i) => (
              <div
                key={`dec-${i}`}
                className="flex items-start gap-2 text-xs text-slate-600 dark:text-slate-400"
              >
                <TrendingDown className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-500" />
                <span>
                  <strong className="text-slate-700 dark:text-slate-300">
                    {f.display_name}
                  </strong>{" "}
                  (SHAP: {f.shap_value.toFixed(4)}) —{" "}
                  {f.direction_display}
                </span>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}

export default ExplainabilityCard;
