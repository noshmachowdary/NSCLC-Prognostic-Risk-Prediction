// ============================================================
// API CONFIGURATION & FALLBACK MOCK DATA
// ============================================================

export let FASTAPI_BASE_URL =
  localStorage.getItem("fastapi_base_url") || "http://127.0.0.1:8000";

export function setBaseUrl(url) {
  FASTAPI_BASE_URL = url;
  localStorage.setItem("fastapi_base_url", url);
}

// ============================================================
// HEALTH CHECK
// ============================================================

export async function checkHealth() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch(`${FASTAPI_BASE_URL}/health`, {
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return { ok: true, data };
  } catch {
    clearTimeout(timeout);
    return { ok: false };
  }
}

// ============================================================
// PREDICTION
// ============================================================

export async function postPredict(features) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);
  try {
    const res = await fetch(`${FASTAPI_BASE_URL}/predict`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ features }),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    return { ok: true, data: json.data, mocked: false };
  } catch (err) {
    clearTimeout(timeout);
    return { ok: false, data: mockPrediction(features), mocked: true, error: err.message };
  }
}

// ============================================================
// RAG ASK
// ============================================================

export async function postAsk(question) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60000);
  try {
    const res = await fetch(`${FASTAPI_BASE_URL}/ask`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question }),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    return { ok: true, data: json.data, mocked: false };
  } catch (err) {
    clearTimeout(timeout);
    return { ok: false, data: mockRagResponse(question), mocked: true, error: err.message };
  }
}

// ============================================================
// CT FEATURE EXTRACTION
// ============================================================

export async function postExtractFeatures(file, onStage) {
  const formData = new FormData();
  formData.append("file", file);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120000);
  try {
    const res = await fetch(`${FASTAPI_BASE_URL}/extract-features`, {
      method: "POST",
      body: formData,
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    return { ok: true, data: json.data, mocked: false };
  } catch (err) {
    clearTimeout(timeout);
    return { ok: false, data: mockExtractedFeatures(), mocked: true, error: err.message };
  }
}

// ============================================================
// MOCK EXTRACTED CT FEATURES
// ============================================================

function mockExtractedFeatures() {
  return {
    "original_glszm_SizeZoneNonUniformity": 45.3,
    "original_shape_MeshVolume": 42000,
    "original_shape_MajorAxisLength": 38.5,
    "original_gldm_SmallDependenceHighGrayLevelEmphasis": 0.0028,
    "original_firstorder_Energy": 85000,
    "original_firstorder_Kurtosis": 3.2,
    "original_shape_Maximum2DDiameterSlice": 52.1,
    "original_glszm_GrayLevelNonUniformityNormalized": 0.15,
    "original_firstorder_Maximum": 320,
    extraction_time_seconds: 3.42,
  };
}

// ============================================================
// MOCK PREDICTION DATA
// ============================================================

function mockPrediction(features) {
  const age = Number(features.age) || 65;
  const stage = features["Overall.Stage"] || features.tumor_stage || "I";
  const histology = features.Histology || features.histology || "adenocarcinoma";
  const gender = features.gender || features.sex || "male";
  const tumorVolume = Number(features["original_shape_MeshVolume"]) || Number(features.tumor_volume) || 25000;

  // Simple heuristic for risk score
  let risk = 1.0;
  risk += (age - 60) * 0.02;
  if (stage === "II") risk += 0.5;
  if (stage === "IIIa" || stage === "III") risk += 1.2;
  if (stage === "IIIb") risk += 1.8;
  if (stage === "IV") risk += 2.5;
  if (histology === "squamous cell carcinoma") risk += 0.3;
  if (histology === "large cell") risk += 0.5;
  if (gender === "male") risk += 0.15;
  risk += Math.min(tumorVolume / 50000, 1.5);

  // Survival curve — higher risk = faster decline
  const times = [0, 6, 12, 18, 24, 30, 36, 42, 48, 54, 60];
  const lambda = 0.01 + risk * 0.015;
  const probabilities = times.map((t) => {
    return parseFloat(Math.exp(-lambda * t).toFixed(4));
  });

  // SHAP-style contributions
  const contributions = [
    {
      feature: "age",
      display_name: "Age",
      value: age,
      shap_value: (age - 65) * 0.018,
      absolute_shap_value: Math.abs((age - 65) * 0.018),
      direction: age > 65 ? "increases_risk" : "decreases_risk",
      direction_display: age > 65 ? "Increases predicted risk score" : "Decreases predicted risk score",
    },
    {
      feature: "Overall.Stage",
      display_name: `Overall Stage ${stage}`,
      value: stage,
      shap_value: stage === "I" ? -0.3 : stage === "II" ? 0.4 : stage === "IIIa" ? 0.9 : stage === "IIIb" ? 1.2 : 1.6,
      absolute_shap_value: stage === "I" ? 0.3 : stage === "II" ? 0.4 : stage === "IIIa" ? 0.9 : stage === "IIIb" ? 1.2 : 1.6,
      direction: stage === "I" ? "decreases_risk" : "increases_risk",
      direction_display: stage === "I" ? "Decreases predicted risk score" : "Increases predicted risk score",
    },
    {
      feature: "Histology",
      display_name: `Histology - ${histology}`,
      value: histology,
      shap_value: histology === "large cell" ? 0.45 : histology === "squamous cell carcinoma" ? 0.28 : -0.1,
      absolute_shap_value: histology === "large cell" ? 0.45 : histology === "squamous cell carcinoma" ? 0.28 : 0.1,
      direction: histology === "adenocarcinoma" ? "decreases_risk" : "increases_risk",
      direction_display: histology === "adenocarcinoma" ? "Decreases predicted risk score" : "Increases predicted risk score",
    },
    {
      feature: "gender_male",
      display_name: "Gender - Male",
      value: gender === "male" ? 1 : 0,
      shap_value: gender === "male" ? 0.12 : -0.08,
      absolute_shap_value: gender === "male" ? 0.12 : 0.08,
      direction: gender === "male" ? "increases_risk" : "decreases_risk",
      direction_display: gender === "male" ? "Increases predicted risk score" : "Decreases predicted risk score",
    },
    {
      feature: "original_shape_MeshVolume",
      display_name: "Tumor Mesh Volume",
      value: tumorVolume,
      shap_value: (tumorVolume / 50000) * 0.6,
      absolute_shap_value: Math.abs((tumorVolume / 50000) * 0.6),
      direction: tumorVolume > 30000 ? "increases_risk" : "decreases_risk",
      direction_display: tumorVolume > 30000 ? "Increases predicted risk score" : "Decreases predicted risk score",
    },
    {
      feature: "original_firstorder_Energy",
      display_name: "First Order Energy",
      value: Number(features["original_firstorder_Energy"]) || 50000,
      shap_value: 0.22,
      absolute_shap_value: 0.22,
      direction: "increases_risk",
      direction_display: "Increases predicted risk score",
    },
    {
      feature: "original_firstorder_Kurtosis",
      display_name: "First Order Kurtosis",
      value: Number(features["original_firstorder_Kurtosis"]) || 3.2,
      shap_value: -0.15,
      absolute_shap_value: 0.15,
      direction: "decreases_risk",
      direction_display: "Decreases predicted risk score",
    },
  ];

  contributions.sort((a, b) => b.absolute_shap_value - a.absolute_shap_value);

  let riskCategory = "Low Risk";
  if (risk > 3.0) riskCategory = "High Risk";
  else if (risk > 1.8) riskCategory = "Moderate Risk";

  return {
    risk_score: parseFloat(risk.toFixed(4)),
    risk_category: riskCategory,
    survival_curve: {
      times,
      probabilities,
    },
    explainability: {
      top_features: contributions.slice(0, 5),
      all_features: contributions,
    },
    prediction_time_seconds: 0.42,
  };
}

// ============================================================
// MOCK RAG RESPONSE
// ============================================================

function mockRagResponse(question) {
  const q = question.toLowerCase();

  let answer = `This is a fallback response because the backend RAG service is not currently reachable.\n\n**Your question:** ${question}\n\nHere is some general information about NSCLC:\n\n**Non-Small Cell Lung Cancer (NSCLC)** is the most common type of lung cancer, accounting for approximately 85% of all lung cancer cases. The three main subtypes are:\n\n1. **Adenocarcinoma** — The most common subtype, often occurring in the outer regions of the lungs. It is more frequent in non-smokers and women.\n2. **Squamous Cell Carcinoma** — Typically arises in the central airways and is strongly associated with smoking history.\n3. **Large Cell Carcinoma** — A less common, more aggressive subtype that can appear in any part of the lung.\n\nNSCLC staging ranges from Stage I (localized) to Stage IV (metastatic), with treatment options including surgery, radiation, chemotherapy, targeted therapy, and immunotherapy depending on the stage and molecular profile.\n\n*To get real responses powered by Gemini and the FAISS knowledge base, make sure your FastAPI backend is running.*`;

  if (q.includes("adenocarcinoma")) {
    answer = `**Adenocarcinoma** is the most common subtype of non-small cell lung cancer (NSCLC), accounting for approximately 40% of all lung cancer cases.\n\n### Key Characteristics\n\n- **Origin:** Arises from the mucus-producing glands in the peripheral lung tissue\n- **Location:** Typically found in the outer regions of the lungs\n- **Demographics:** More common in women, non-smokers, and younger patients compared to other NSCLC subtypes\n- **Growth:** Generally slower-growing than other lung cancer types\n\n### Diagnosis and Treatment\n\nAdenocarcinoma is often diagnosed at an earlier stage due to its peripheral location. Treatment options include:\n\n1. Surgical resection for early-stage disease\n2. Targeted therapies (EGFR inhibitors, ALK inhibitors) for patients with specific molecular mutations\n3. Immunotherapy (PD-1/PD-L1 inhibitors)\n4. Chemotherapy and radiation for advanced stages\n\n### Prognosis\n\nPrognosis depends on the stage at diagnosis, with early-stage adenocarcinoma having favorable outcomes after surgical resection. Molecular profiling (EGFR, ALK, ROS1, KRAS) plays an important role in guiding targeted treatment decisions.\n\n*Note: This is a fallback response. Start the FastAPI backend for real RAG-powered answers.*`;
  } else if (q.includes("type") || q.includes("main")) {
    answer = `The **three main types of NSCLC** are:\n\n1. **Adenocarcinoma** (~40% of cases) — Originates in mucus-producing glands, typically in the outer lung. Most common subtype, especially in non-smokers.\n2. **Squamous Cell Carcinoma** (~25-30%) — Arises from the squamous cells lining the airways. Strongly linked to smoking. Often central in location.\n3. **Large Cell Carcinoma** (~10-15%) — Undifferentiated cells that grow and spread quickly. Can occur anywhere in the lung.\n\nEach subtype has distinct histological features, growth patterns, and treatment approaches. Molecular testing is increasingly important for all subtypes to identify actionable mutations.\n\n*Note: This is a fallback response. Start the FastAPI backend for real RAG-powered answers.*`;
  } else if (q.includes("stage")) {
    answer = `**NSCLC Staging** uses the TNM system (Tumor, Node, Metastasis):\n\n### Stage I\n- Tumor confined to the lung\n- No lymph node involvement\n- Best prognosis; surgical resection often curative\n\n### Stage II\n- Tumor larger or involving hilar lymph nodes\n- Surgery with adjuvant chemotherapy\n\n### Stage III (IIIa / IIIb)\n- Locally advanced disease\n- IIIa: May be resectable with multimodal therapy\n- IIIb: Typically treated with chemoradiation\n\n### Stage IV\n- Metastatic disease (spread to other organs)\n- Treated with systemic therapy (targeted, immunotherapy, chemotherapy)\n\nEarly-stage detection significantly improves survival outcomes.\n\n*Note: This is a fallback response. Start the FastAPI backend for real RAG-powered answers.*`;
  }

  return {
    question,
    answer,
    model: "mock-fallback",
    retrieved_documents: 10,
    reranked_documents: 5,
    context_documents: 5,
    retrieval_time_seconds: 0.85,
    reranking_time_seconds: 1.23,
  };
}
