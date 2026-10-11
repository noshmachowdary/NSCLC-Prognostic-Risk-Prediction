import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { TrendingUp, TrendingDown, Activity } from "lucide-react";

function getRiskColors(category) {
  if (!category) return { bg: "bg-slate-100", text: "text-slate-600", dark: "dark:bg-slate-700 dark:text-slate-300", label: "No Data" };
  if (category.includes("High"))
    return { bg: "bg-rose-50", text: "text-rose-700", dark: "dark:bg-rose-900/30 dark:text-rose-400", label: "High Risk" };
  if (category.includes("Moderate"))
    return { bg: "bg-amber-50", text: "text-amber-700", dark: "dark:bg-amber-900/30 dark:text-amber-400", label: "Moderate Risk" };
  return { bg: "bg-emerald-50", text: "text-emerald-700", dark: "dark:bg-emerald-900/30 dark:text-emerald-400", label: "Low Risk" };
}

function CustomTooltip({ active, payload, label, darkMode }) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div
      className={`rounded-lg border px-3 py-2 text-xs shadow-lg ${
        darkMode
          ? "border-slate-600 bg-slate-800 text-slate-200"
          : "border-slate-200 bg-white text-slate-700"
      }`}
    >
      <p className="font-medium">Month {label}</p>
      <p className="mt-1 text-brand-500">
        Survival: {(payload[0].value * 100).toFixed(1)}%
      </p>
    </div>
  );
}

function RiskStratificationCard({ result, darkMode }) {
  if (!result) {
    return (
      <div className="flex h-full min-h-[280px] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50/50 p-6 dark:border-slate-700 dark:bg-slate-800/30">
        <Activity className="mb-3 h-8 w-8 text-slate-300 dark:text-slate-600" />
        <p className="text-sm text-slate-400 dark:text-slate-500">
          Run the prognostic model to see risk stratification and survival probability.
        </p>
      </div>
    );
  }

  const colors = getRiskColors(result.risk_category);
  const chartData = result.survival_curve.times.map((t, i) => ({
    month: t,
    survival: result.survival_curve.probabilities[i],
  }));

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800/50">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
          Risk Stratification
        </h3>
        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold ${colors.bg} ${colors.text} ${colors.dark}`}
        >
          {colors.label}
        </span>
      </div>

      {/* Metrics */}
      <div className="mb-5 grid grid-cols-3 gap-3">
        <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Risk Score
          </p>
          <p className="mt-1 text-xl font-bold text-slate-800 dark:text-slate-100">
            {result.risk_score?.toFixed(3)}
          </p>
        </div>
        <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            12-Mo Survival
          </p>
          <p className="mt-1 text-xl font-bold text-emerald-600 dark:text-emerald-400">
            {((chartData.find((d) => d.month === 12)?.survival || 0) * 100).toFixed(0)}%
          </p>
        </div>
        <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            60-Mo Survival
          </p>
          <p className="mt-1 text-xl font-bold text-brand-600 dark:text-brand-400">
            {((chartData.find((d) => d.month === 60)?.survival || 0) * 100).toFixed(0)}%
          </p>
        </div>
      </div>

      {/* Survival Chart */}
      <div>
        <p className="mb-2 text-xs font-medium text-slate-600 dark:text-slate-400">
          Survival Probability vs. Time (Months)
        </p>
        <div className="h-[200px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 5, right: 10, bottom: 5, left: -20 }}>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke={darkMode ? "#334155" : "#e2e8f0"}
              />
              <XAxis
                dataKey="month"
                tick={{ fontSize: 11, fill: darkMode ? "#94a3b8" : "#64748b" }}
                stroke={darkMode ? "#475569" : "#cbd5e1"}
                label={{ value: "Months", position: "insideBottom", offset: -2, style: { fontSize: 10, fill: darkMode ? "#94a3b8" : "#64748b" } }}
              />
              <YAxis
                domain={[0, 1]}
                tick={{ fontSize: 11, fill: darkMode ? "#94a3b8" : "#64748b" }}
                stroke={darkMode ? "#475569" : "#cbd5e1"}
                tickFormatter={(v) => `${(v * 100).toFixed(0)}%`}
              />
              <Tooltip content={<CustomTooltip darkMode={darkMode} />} />
              <ReferenceLine x={12} stroke="#10b981" strokeDasharray="4 4" strokeOpacity={0.4} />
              <ReferenceLine x={24} stroke="#f59e0b" strokeDasharray="4 4" strokeOpacity={0.4} />
              <ReferenceLine x={36} stroke="#f59e0b" strokeDasharray="4 4" strokeOpacity={0.4} />
              <ReferenceLine x={60} stroke="#ef4444" strokeDasharray="4 4" strokeOpacity={0.4} />
              <Line
                type="monotone"
                dataKey="survival"
                stroke="#3385fc"
                strokeWidth={2.5}
                dot={{ r: 3, fill: "#3385fc" }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

export { getRiskColors };
export default RiskStratificationCard;
