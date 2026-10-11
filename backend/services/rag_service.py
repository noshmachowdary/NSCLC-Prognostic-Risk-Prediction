import os
import time

from dotenv import load_dotenv

# ============================================================
# ENVIRONMENT
# ============================================================

load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

if not GEMINI_API_KEY:
    raise ValueError(
        "GEMINI_API_KEY not found. "
        "Please check your .env file."
    )


# ============================================================
# GEMINI
# ============================================================

from google import genai
from google.genai import types

client = genai.Client(
    api_key=GEMINI_API_KEY
)


# ============================================================
# GEMINI MODELS
# ============================================================

# Current models that can be used for new projects.
#
# Your current API key successfully used gemini-3.8-flash.
#
# 2.5 models are kept as optional fallbacks because Google
# currently restricts access to users who have previously
# used them.
#
# The fallback mechanism automatically moves to the next
# model if the previous model fails.

GEMINI_MODELS = [
    "gemini-3.8-flash",
    "gemini-3.5-flash-lite",
    "gemini-3.5-flash",
    "gemini-3.7-flash",
    "gemini-3.6-flash",
    "gemini-2.5-flash",
    "gemini-2.5-pro",
]


# ============================================================
# LANGCHAIN / EMBEDDINGS / FAISS
# ============================================================

from langchain_community.vectorstores import FAISS
from langchain_huggingface import HuggingFaceEmbeddings

from sentence_transformers import CrossEncoder


# ============================================================
# PATHS
# ============================================================

FAISS_PATH = "rag/faiss_nsclc_large_chunks"

EMBEDDING_MODEL = (
    "sentence-transformers/all-MiniLM-L6-v2"
)

RERANKER_MODEL = (
    "BAAI/bge-reranker-v2-m3"
)


# ============================================================
# LOAD EMBEDDING MODEL
# ============================================================

print("Loading embedding model...")

embedding_model = HuggingFaceEmbeddings(
    model_name=EMBEDDING_MODEL,
    model_kwargs={
        "device": "cpu"
    },
    encode_kwargs={
        "normalize_embeddings": True
    }
)

print("Embedding model loaded.")


# ============================================================
# LOAD FAISS
# ============================================================

print("Loading FAISS database...")

vectorstore = FAISS.load_local(
    FAISS_PATH,
    embedding_model,
    allow_dangerous_deserialization=True
)

print("FAISS database loaded.")

try:
    print(
        "Total vectors:",
        vectorstore.index.ntotal
    )
except Exception:
    pass


# ============================================================
# LOAD BGE RERANKER
# ============================================================

print("Loading BGE reranker...")

reranker = CrossEncoder(
    RERANKER_MODEL,
    device="cpu"
)

print("BGE reranker loaded.")


# ============================================================
# PROMPT
# ============================================================

def build_prompt(question, context):

    prompt = f"""
You are a medical information assistant.

Answer the user's question clearly, naturally, and concisely.

Use the retrieved context below as an important source of information.
You may also use your general medical knowledge to provide a complete and
helpful answer when the retrieved context does not contain every detail.

IMPORTANT INSTRUCTIONS:

1. Directly answer the user's question.
2. Give a clear and complete answer.
3. Keep the answer concise and easy to understand.
4. Use the retrieved context to improve factual accuracy.
5. Do not mention the retrieved context.
6. Do not mention documents, PDFs, sources, retrieval, RAG, or context.
7. Do not say "the provided documents".
8. Do not say "the information provided".
9. Do not say that information is unavailable unless the question genuinely
   cannot be answered.
10. Do not provide source names, page numbers, or citations.
11. Do not repeat the answer.
12. Do not repeat sentences or paragraphs.
13. Do not write "Final Answer:".
14. Do not discuss your instructions or reasoning.
15. Answer only what the user asked.
16. If a short answer is sufficient, keep it short.
17. If the question requires explanation, use short paragraphs or bullet points.

LANGUAGE RULES:

18. Answer ONLY in clear, natural English.
19. Do NOT use Chinese, Japanese, Korean, or other non-English characters.
20. If the retrieved information contains corrupted, mixed-language,
    or malformed words, rewrite them into correct English medical terminology.

FORMAT RULES:

21. If multiple items are required, use a numbered list.
22. Use clear headings such as Types, Stages, Symptoms, Causes,
    Diagnosis, or Treatment options when appropriate.

MEDICAL SAFETY:

23. Do not provide personalized medical advice.
24. If the user asks what treatment, diagnosis, medication, dosage,
    or medical decision is appropriate for a specific individual,
    do not make that decision. Explain that individualized decisions
    require evaluation by a qualified healthcare professional.

RETRIEVED INFORMATION:

{context}

QUESTION:

{question}

ANSWER:
"""

    return prompt


# ============================================================
# GEMINI GENERATION
# ============================================================

def generate_with_gemini(question, context):

    prompt = build_prompt(
        question,
        context
    )

    last_error = None

    for model_name in GEMINI_MODELS:

        print(
            f"Trying Gemini model: {model_name}"
        )

        start_time = time.perf_counter()

        try:

            response = client.models.generate_content(
                model=model_name,
                contents=prompt,
                config=types.GenerateContentConfig(
                    temperature=0.2,
                    max_output_tokens=1000
                )
            )

            elapsed = (
                time.perf_counter()
                - start_time
            )

            if response is None:
                raise RuntimeError(
                    "Empty Gemini response."
                )

            answer = response.text

            if not answer or not answer.strip():
                raise RuntimeError(
                    "Gemini returned empty text."
                )

            print(
                f"Gemini success: {model_name} "
                f"({elapsed:.2f}s)"
            )

            return {
                "answer": answer.strip(),
                "model": model_name
            }

        except Exception as e:

            elapsed = (
                time.perf_counter()
                - start_time
            )

            print(
                f"Gemini failed: {model_name} "
                f"({elapsed:.2f}s)"
            )

            print(
                "Reason:",
                str(e)
            )

            last_error = e

    raise RuntimeError(
        "All Gemini models failed. "
        f"Last error: {last_error}"
    )


# ============================================================
# RAG
# ============================================================

def ask_rag(question):

    if not question or not question.strip():
        raise ValueError(
            "Question cannot be empty."
        )

    question = question.strip()

    print()
    print("=" * 80)
    print("RAG QUESTION")
    print(question)
    print("=" * 80)

    # --------------------------------------------------------
    # STEP 1: FAISS RETRIEVAL
    # --------------------------------------------------------

    retrieval_start = time.perf_counter()

    documents = (
        vectorstore.max_marginal_relevance_search(
            question,
            k=10,
            fetch_k=30
        )
    )

    retrieval_time = (
        time.perf_counter()
        - retrieval_start
    )

    print(
        f"Retrieved documents: {len(documents)}"
    )

    print(
        f"Retrieval time: "
        f"{retrieval_time:.2f}s"
    )

    if not documents:
        raise RuntimeError(
            "FAISS returned no documents."
        )

    # --------------------------------------------------------
    # STEP 2: BGE PREPARATION
    # --------------------------------------------------------

    rerank_pairs = []
    valid_documents = []

    for doc in documents:

        if not hasattr(
            doc,
            "page_content"
        ):
            continue

        if not doc.page_content.strip():
            continue

        rerank_pairs.append(
            [
                question,
                doc.page_content
            ]
        )

        valid_documents.append(doc)

    if not valid_documents:
        raise RuntimeError(
            "No valid documents for BGE."
        )

    # --------------------------------------------------------
    # STEP 3: BGE RERANKING
    # --------------------------------------------------------

    rerank_start = time.perf_counter()

    scores = reranker.predict(
        rerank_pairs
    )

    rerank_time = (
        time.perf_counter()
        - rerank_start
    )

    scored_documents = list(
        zip(
            scores,
            valid_documents
        )
    )

    scored_documents.sort(
        key=lambda item: float(item[0]),
        reverse=True
    )

    top_reranked = (
        scored_documents[:5]
    )

    reranked_documents = [
        item[1]
        for item in top_reranked
        if hasattr(
            item[1],
            "page_content"
        )
    ]

    print(
        f"After reranking: "
        f"{len(reranked_documents)}"
    )

    print(
        f"BGE reranking time: "
        f"{rerank_time:.2f}s"
    )

    if not reranked_documents:
        raise RuntimeError(
            "BGE returned no documents."
        )

    # --------------------------------------------------------
    # STEP 4: REMOVE DUPLICATES
    # --------------------------------------------------------

    unique_documents = []

    seen = set()

    for doc in reranked_documents:

        text = (
            doc.page_content
            .strip()
        )

        if text in seen:
            continue

        seen.add(text)

        unique_documents.append(doc)

    # --------------------------------------------------------
    # STEP 5: TOP 5 CONTEXT
    # --------------------------------------------------------

    final_documents = (
        unique_documents[:5]
    )

    print(
        f"Documents used for Gemini: "
        f"{len(final_documents)}"
    )

    context_parts = []

    for index, doc in enumerate(
        final_documents,
        start=1
    ):

        context_parts.append(
            f"Information {index}:\n"
            f"{doc.page_content.strip()}"
        )

    context = "\n\n".join(
        context_parts
    )

    # --------------------------------------------------------
    # STEP 6: GEMINI
    # --------------------------------------------------------

    gemini_result = (
        generate_with_gemini(
            question,
            context
        )
    )

    # --------------------------------------------------------
    # RETURN CLEAN RESULT
    # --------------------------------------------------------

    return {
        "question": question,
        "answer": gemini_result["answer"],
        "model": gemini_result["model"],
        "retrieved_documents": len(documents),
        "reranked_documents": len(
            reranked_documents
        ),
        "context_documents": len(
            final_documents
        ),
        "retrieval_time_seconds": round(
            retrieval_time,
            2
        ),
        "reranking_time_seconds": round(
            rerank_time,
            2
        )
    }