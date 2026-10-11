import PatientForm from "./PatientForm.jsx";
import RiskStratificationCard from "./RiskStratificationCard.jsx";
import ExplainabilityCard from "./ExplainabilityCard.jsx";

function PredictionDashboard({ onPredict, loading, result, darkMode }) {
  return (
    <div className="mx-auto max-w-[1600px] px-4 py-5 sm:px-6">
      <div className="flex flex-col gap-5 lg:flex-row">
        {/* Left Column — 40% */}
        <div className="lg:w-[40%]">
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800/50">
            <div className="border-b border-slate-100 bg-slate-50/60 px-5 py-3 dark:border-slate-700 dark:bg-slate-800/60">
              <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                Patient Feature Input
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Enter clinical and CT radiomic features for risk prediction.
              </p>
            </div>
            <PatientForm onPredict={onPredict} loading={loading} />
          </div>
        </div>

        {/* Right Column — 60% */}
        <div className="flex flex-col gap-5 lg:w-[60%]">
          <div className="animate-fade-in-up">
            <RiskStratificationCard result={result} darkMode={darkMode} />
          </div>
          <div className="animate-fade-in-up">
            <ExplainabilityCard result={result} darkMode={darkMode} />
          </div>
        </div>
      </div>
    </div>
  );
}

export default PredictionDashboard;
