import { useState } from "react";
import {
  User,
  ScanLine,
  Play,
  FileText,
  Loader2,
  Heart,
  Cigarette,
  Microscope,
  Ruler,
} from "lucide-react";

const SAMPLE_DATA = {
  age: 68,
  gender: "male",
  "Overall.Stage": "IIIa",
  Histology: "squamous cell carcinoma",
  Smoking: "current",
  "original_shape_MeshVolume": 42000,
  sphericity: 0.72,
  mean_intensity: -450,
  "original_firstorder_Energy": 85000,
  "original_firstorder_Entropy": 6.8,
  "original_firstorder_Contrast": 120,
};

function FormField({ label, icon: Icon, children, hint }) {
  return (
    <div>
      <label className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-slate-700 dark:text-slate-300">
        {Icon && <Icon className="h-3.5 w-3.5 text-slate-400" />}
        {label}
      </label>
      {children}
      {hint && (
        <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">{hint}</p>
      )}
    </div>
  );
}

const inputClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition-all focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500";

function PatientForm({ onPredict, loading }) {
  const [form, setForm] = useState({
    age: 65,
    gender: "male",
    "Overall.Stage": "I",
    Histology: "adenocarcinoma",
    Smoking: "former",
    "original_shape_MeshVolume": 25000,
    sphericity: 0.65,
    mean_intensity: -550,
    "original_firstorder_Energy": 50000,
    "original_firstorder_Entropy": 6.2,
    "original_firstorder_Contrast": 85,
  });

  const handleChange = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSample = () => {
    setForm({ ...SAMPLE_DATA });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onPredict(form);
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="flex h-full flex-col overflow-y-auto"
    >
      {/* Clinical Features */}
      <div className="border-b border-slate-100 p-5 dark:border-slate-800">
        <div className="mb-4 flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-900/30 dark:text-brand-400">
            <User className="h-4 w-4" />
          </div>
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
            Clinical Features
          </h3>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Age" icon={Heart}>
              <input
                type="number"
                min="18"
                max="120"
                value={form.age}
                onChange={(e) => handleChange("age", e.target.value)}
                className={inputClass}
              />
            </FormField>
            <FormField label="Sex / Gender">
              <select
                value={form.gender}
                onChange={(e) => handleChange("gender", e.target.value)}
                className={inputClass}
              >
                <option value="male">Male</option>
                <option value="female">Female</option>
              </select>
            </FormField>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Tumor Stage">
              <select
                value={form["Overall.Stage"]}
                onChange={(e) =>
                  handleChange("Overall.Stage", e.target.value)
                }
                className={inputClass}
              >
                <option value="I">Stage I</option>
                <option value="II">Stage II</option>
                <option value="IIIa">Stage III</option>
                <option value="IIIb">Stage IIIb</option>
                <option value="IV">Stage IV</option>
              </select>
            </FormField>
            <FormField label="Histology" icon={Microscope}>
              <select
                value={form.Histology}
                onChange={(e) => handleChange("Histology", e.target.value)}
                className={inputClass}
              >
                <option value="adenocarcinoma">Adenocarcinoma</option>
                <option value="squamous cell carcinoma">
                  Squamous Cell Carcinoma
                </option>
                <option value="large cell">Large Cell</option>
                <option value="nos">Other (NOS)</option>
              </select>
            </FormField>
          </div>

          <FormField label="Smoking History" icon={Cigarette}>
            <select
              value={form.Smoking}
              onChange={(e) => handleChange("Smoking", e.target.value)}
              className={inputClass}
            >
              <option value="never">Never</option>
              <option value="former">Former</option>
              <option value="current">Current</option>
            </select>
          </FormField>
        </div>
      </div>

      {/* CT Radiomic Features */}
      <div className="flex-1 p-5">
        <div className="mb-4 flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-teal-50 text-teal-600 dark:bg-teal-900/30 dark:text-teal-400">
            <ScanLine className="h-4 w-4" />
          </div>
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
            CT Radiomic Features
          </h3>
        </div>

        <div className="space-y-4">
          <FormField label="Tumor Volume (mm³)" icon={Ruler}>
            <input
              type="number"
              min="0"
              value={form["original_shape_MeshVolume"]}
              onChange={(e) =>
                handleChange("original_shape_MeshVolume", e.target.value)
              }
              className={inputClass}
            />
          </FormField>

          <FormField
            label="Sphericity"
            hint={`Value: ${Number(form.sphericity).toFixed(2)}`}
          >
            <div className="flex items-center gap-3">
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={form.sphericity}
                onChange={(e) =>
                  handleChange("sphericity", parseFloat(e.target.value))
                }
                className="flex-1"
              />
              <input
                type="number"
                min="0"
                max="1"
                step="0.01"
                value={form.sphericity}
                onChange={(e) =>
                  handleChange("sphericity", parseFloat(e.target.value))
                }
                className={`${inputClass} w-20`}
              />
            </div>
          </FormField>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Mean Intensity (HU)">
              <input
                type="number"
                value={form.mean_intensity}
                onChange={(e) =>
                  handleChange("mean_intensity", e.target.value)
                }
                placeholder="-550"
                className={inputClass}
              />
            </FormField>
            <FormField label="Energy">
              <input
                type="number"
                value={form["original_firstorder_Energy"]}
                onChange={(e) =>
                  handleChange("original_firstorder_Energy", e.target.value)
                }
                placeholder="50000"
                className={inputClass}
              />
            </FormField>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Entropy">
              <input
                type="number"
                step="0.01"
                value={form["original_firstorder_Entropy"]}
                onChange={(e) =>
                  handleChange("original_firstorder_Entropy", e.target.value)
                }
                placeholder="6.2"
                className={inputClass}
              />
            </FormField>
            <FormField label="Contrast">
              <input
                type="number"
                step="0.01"
                value={form["original_firstorder_Contrast"]}
                onChange={(e) =>
                  handleChange("original_firstorder_Contrast", e.target.value)
                }
                placeholder="85"
                className={inputClass}
              />
            </FormField>
          </div>
        </div>
      </div>

      {/* Buttons */}
      <div className="sticky bottom-0 flex gap-3 border-t border-slate-100 bg-white/95 p-5 backdrop-blur dark:border-slate-800 dark:bg-slate-900/95">
        <button
          type="submit"
          disabled={loading}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-brand-500/25 transition-all hover:bg-brand-600 disabled:opacity-60"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 spin" />
          ) : (
            <Play className="h-4 w-4" />
          )}
          {loading ? "Running Model..." : "Run Prognostic Risk Model"}
        </button>
        <button
          type="button"
          onClick={handleSample}
          disabled={loading}
          className="flex items-center justify-center gap-2 rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 transition-all hover:bg-slate-100 disabled:opacity-60 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          <FileText className="h-4 w-4" />
          Load Sample
        </button>
      </div>
    </form>
  );
}

export default PatientForm;
