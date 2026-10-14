import { useState, useRef, useCallback } from "react";
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
  UploadCloud,
  CheckCircle2,
  X,
  Brain,
} from "lucide-react";
import { postExtractFeatures } from "../api.js";

const ACCEPTED_EXTENSIONS = [".zip", ".dcm", ".nii", ".nii.gz"];

const SAMPLE_CLINICAL = {
  age: 68,
  gender: "male",
  "Overall.Stage": "IIIa",
  Histology: "squamous cell carcinoma",
  Smoking: "current",
};

const SAMPLE_RADIOMIC = {
  "original_glszm_SizeZoneNonUniformity": 45.3,
  "original_shape_MeshVolume": 42000,
  "original_shape_MajorAxisLength": 38.5,
  "original_gldm_SmallDependenceHighGrayLevelEmphasis": 0.0028,
  "original_firstorder_Energy": 85000,
  "original_firstorder_Kurtosis": 3.2,
  "original_shape_Maximum2DDiameterSlice": 52.1,
  "original_glszm_GrayLevelNonUniformityNormalized": 0.15,
  "original_firstorder_Maximum": 320,
};

const EXTRACTION_STAGES = [
  "Segmenting Tumor with 3D U-Net...",
  "Extracting Features via PyRadiomics...",
];

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

const readOnlyClass =
  "w-full cursor-not-allowed rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-600 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300";

function isValidFile(file) {
  if (!file) return false;
  const name = file.name.toLowerCase();
  return ACCEPTED_EXTENSIONS.some((ext) => name.endsWith(ext));
}

function PatientForm({ onPredict, loading, onNotify }) {
  // Clinical form state
  const [clinical, setClinical] = useState({
    age: 65,
    gender: "male",
    "Overall.Stage": "I",
    Histology: "adenocarcinoma",
    Smoking: "former",
  });

  // CT extraction state
  const [ctFile, setCtFile] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [extractStage, setExtractStage] = useState(-1);
  const [radiomics, setRadiomics] = useState(null);
  const [radiomicsSource, setRadiomicsSource] = useState(null);
  const fileInputRef = useRef(null);

  const handleClinicalChange = (key, value) => {
    setClinical((prev) => ({ ...prev, [key]: value }));
  };

  // ---- File handling ----
  const handleFileSelected = useCallback((file) => {
    if (!isValidFile(file)) {
      onNotify?.("Unsupported file type. Please upload .zip, .dcm, .nii, or .nii.gz files.");
      return;
    }
    setCtFile(file);
    setRadiomics(null);
    setRadiomicsSource(null);
  }, [onNotify]);

  const handleDrop = useCallback(
    (e) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files?.[0];
      if (file) handleFileSelected(file);
    },
    [handleFileSelected]
  );

  const handleFileInputChange = (e) => {
    const file = e.target.files?.[0];
    if (file) handleFileSelected(file);
  };

  const handleRemoveFile = () => {
    setCtFile(null);
    setRadiomics(null);
    setRadiomicsSource(null);
    setExtractStage(-1);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // ---- Feature extraction ----
  const handleExtract = async () => {
    if (!ctFile || extracting) return;
    setExtracting(true);
    setExtractStage(0);
    setRadiomics(null);

    // Simulate stage progression for UX feedback
    const stageTimer = setTimeout(() => {
      setExtractStage(1);
    }, 1500);

    const result = await postExtractFeatures(ctFile);
    clearTimeout(stageTimer);

    setExtracting(false);
    setExtractStage(-1);

    if (result.mocked) {
      onNotify?.("Backend offline: Displaying sample extracted CT radiomics");
    }
    setRadiomics(result.data);
    setRadiomicsSource(result.mocked ? "mock" : "live");
  };

  // ---- Sample data ----
  const handleSample = () => {
    setClinical({ ...SAMPLE_CLINICAL });
    setRadiomics({ ...SAMPLE_RADIOMIC });
    setRadiomicsSource("sample");
    setCtFile(null);
    setExtractStage(-1);
  };

  // ---- Submit prediction ----
  const handleSubmit = (e) => {
    e.preventDefault();
    const combined = {
      ...clinical,
      ...(radiomics || {}),
    };
    onPredict(combined);
  };

  // ---- Radiomic display fields (9 RSF-A model features) ----
  const radiomicFields = [
    { key: "original_shape_MeshVolume", label: "Mesh Volume (mm³)", icon: Ruler },
    { key: "original_shape_MajorAxisLength", label: "Major Axis Length", icon: Ruler },
    { key: "original_shape_Maximum2DDiameterSlice", label: "Max 2D Diameter (Slice)", icon: Ruler },
    { key: "original_firstorder_Energy", label: "Energy", icon: ScanLine },
    { key: "original_firstorder_Kurtosis", label: "Kurtosis", icon: ScanLine },
    { key: "original_firstorder_Maximum", label: "Maximum (HU)", icon: ScanLine },
    { key: "original_glszm_SizeZoneNonUniformity", label: "Size Zone Non-Uniformity", icon: ScanLine },
    { key: "original_glszm_GrayLevelNonUniformityNormalized", label: "Gray Level Non-Uniformity (Norm)", icon: ScanLine },
    { key: "original_gldm_SmallDependenceHighGrayLevelEmphasis", label: "Small Dependence High Gray Level", icon: ScanLine },
  ];

  return (
    <form onSubmit={handleSubmit} className="flex h-full flex-col overflow-y-auto">
      {/* ===== CT SCAN UPLOAD ===== */}
      <div className="border-b border-slate-100 p-5 dark:border-slate-800">
        <div className="mb-4 flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-teal-50 text-teal-600 dark:bg-teal-900/30 dark:text-teal-400">
            <ScanLine className="h-4 w-4" />
          </div>
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
            CT Scan Upload
          </h3>
        </div>

        {/* Dropzone */}
        {!ctFile ? (
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-8 text-center transition-all ${
              dragging
                ? "border-teal-500 bg-teal-50 dark:bg-teal-900/20"
                : "border-slate-300 hover:border-teal-400 hover:bg-slate-50 dark:border-slate-600 dark:hover:border-teal-700 dark:hover:bg-slate-800/40"
            }`}
          >
            <UploadCloud className="mb-2 h-7 w-7 text-slate-400 dark:text-slate-500" />
            <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
              Drop CT scan here or click to browse
            </p>
            <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
              Supports .zip, .dcm, .nii, .nii.gz
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".zip,.dcm,.nii,.nii.gz"
              onChange={handleFileInputChange}
              className="hidden"
            />
          </div>
        ) : (
          <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 dark:border-slate-600 dark:bg-slate-800/40">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-teal-100 text-teal-600 dark:bg-teal-900/30 dark:text-teal-400">
              <FileText className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-slate-700 dark:text-slate-200">
                {ctFile.name}
              </p>
              <p className="text-xs text-slate-400 dark:text-slate-500">
                {(ctFile.size / 1024 / 1024).toFixed(2)} MB
              </p>
            </div>
            <button
              type="button"
              onClick={handleRemoveFile}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-200 hover:text-slate-600 dark:hover:bg-slate-700"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Extract Button */}
        {ctFile && (
          <button
            type="button"
            onClick={handleExtract}
            disabled={extracting || loading}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-teal-600/20 transition-all hover:bg-teal-700 disabled:opacity-60"
          >
            {extracting ? (
              <Loader2 className="h-4 w-4 spin" />
            ) : (
              <Brain className="h-4 w-4" />
            )}
            {extracting ? "Extracting..." : "Extract Features from CT Scan"}
          </button>
        )}

        {/* Extraction Progress Banner */}
        {extracting && extractStage >= 0 && (
          <div className="mt-3 space-y-2 rounded-xl border border-teal-200 bg-teal-50/80 p-3 dark:border-teal-800 dark:bg-teal-900/20">
            {EXTRACTION_STAGES.map((stage, i) => (
              <div key={i} className="flex items-center gap-2 text-xs">
                {i < extractStage ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                ) : i === extractStage ? (
                  <Loader2 className="h-4 w-4 shrink-0 spin text-teal-500" />
                ) : (
                  <div className="h-4 w-4 shrink-0 rounded-full border-2 border-slate-300 dark:border-slate-600" />
                )}
                <span
                  className={
                    i < extractStage
                      ? "text-slate-500 line-through dark:text-slate-400"
                      : i === extractStage
                      ? "font-medium text-teal-700 dark:text-teal-300"
                      : "text-slate-400 dark:text-slate-500"
                  }
                >
                  {stage}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Extraction Source Badge */}
        {radiomics && radiomicsSource && (
          <div className="mt-2 flex items-center gap-1.5 text-xs">
            {radiomicsSource === "mock" ? (
              <span className="rounded-md bg-amber-100 px-2 py-0.5 font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                Mock Data (Backend Offline)
              </span>
            ) : radiomicsSource === "sample" ? (
              <span className="rounded-md bg-brand-100 px-2 py-0.5 font-medium text-brand-700 dark:bg-brand-900/30 dark:text-brand-400">
                Sample Data Loaded
              </span>
            ) : (
              <span className="flex items-center gap-1 rounded-md bg-emerald-100 px-2 py-0.5 font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                <CheckCircle2 className="h-3 w-3" />
                Extracted from CT
              </span>
            )}
          </div>
        )}
      </div>

      {/* ===== CT RADIOMIC FEATURES (read-only) ===== */}
      <div className="border-b border-slate-100 p-5 dark:border-slate-800">
        <div className="mb-4 flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-50 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400">
            <Brain className="h-4 w-4" />
          </div>
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
            CT Radiomic Features
          </h3>
        </div>

        {radiomics ? (
          <div className="grid grid-cols-2 gap-3">
            {radiomicFields.map((field) => {
              const Icon = field.icon;
              return (
                <div key={field.key}>
                  <label className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-400">
                    <Icon className="h-3 w-3 text-slate-400" />
                    {field.label}
                  </label>
                  <input
                    type="text"
                    readOnly
                    value={String(radiomics[field.key] ?? "—")}
                    className={readOnlyClass}
                  />
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/50 px-4 py-6 text-center dark:border-slate-700 dark:bg-slate-800/30">
            <Brain className="mb-2 h-6 w-6 text-slate-300 dark:text-slate-600" />
            <p className="text-xs text-slate-400 dark:text-slate-500">
              Upload a CT scan and extract features, or use "Load Sample" to
              populate with mock values.
            </p>
          </div>
        )}
      </div>

      {/* ===== CLINICAL FEATURES (manual entry) ===== */}
      <div className="flex-1 p-5">
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
                value={clinical.age}
                onChange={(e) => handleClinicalChange("age", e.target.value)}
                className={inputClass}
              />
            </FormField>
            <FormField label="Sex / Gender">
              <select
                value={clinical.gender}
                onChange={(e) => handleClinicalChange("gender", e.target.value)}
                className={inputClass}
              >
                <option value="male">Male</option>
                <option value="female">Female</option>
              </select>
            </FormField>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Stage">
              <select
                value={clinical["Overall.Stage"]}
                onChange={(e) =>
                  handleClinicalChange("Overall.Stage", e.target.value)
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
                value={clinical.Histology}
                onChange={(e) =>
                  handleClinicalChange("Histology", e.target.value)
                }
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
              value={clinical.Smoking}
              onChange={(e) => handleClinicalChange("Smoking", e.target.value)}
              className={inputClass}
            >
              <option value="never">Never</option>
              <option value="former">Former</option>
              <option value="current">Current</option>
            </select>
          </FormField>
        </div>
      </div>

      {/* ===== ACTION BUTTONS ===== */}
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
