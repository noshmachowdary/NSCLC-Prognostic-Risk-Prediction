import os
import time
from dotenv import load_dotenv

print("1. Script started")

# ============================================================
# ENVIRONMENT
# ============================================================

load_dotenv()

print("2. Environment loaded")

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

if not GEMINI_API_KEY:
    raise ValueError(
        "GEMINI_API_KEY not found. Check your .env file."
    )

# ============================================================
# GEMINI
# ============================================================

from google import genai
from google.genai import types

print("3. Google GenAI imported")

client = genai.Client(api_key=GEMINI_API_KEY)


# ============================================================
# GEMINI MODEL FALLBACK LIST
# ============================================================

# Current usable models.
#
# 2.5 models may require prior access.
# 3.8 Flash is the current fallback.
# 3.5 Flash-Lite is a lightweight fallback.
#
# Do NOT add Gemini 1.5 or Gemini 2.0 Flash here because
# those models have already been shut down.

GEMINI_MODELS = [
    "gemini-2.5-flash",
    "gemini-2.5-pro",
    "gemini-3.8-flash",
    "gemini-3.5-flash-lite",
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

EMBEDDING_MODEL = "sentence-transformers/all-MiniLM-L6-v2"

RERANKER_MODEL = "BAAI/bge-reranker-v2-m3"


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
    print("Total vectors:", vectorstore.index.ntotal)
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
# QWEN-STYLE MEDICAL PROMPT
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
# GEMINI GENERATION WITH FALLBACK
# ============================================================

def generate_with_gemini(question, context):

    prompt = build_prompt(question, context)

    print("\nTrying Gemini models...\n")

    last_error = None

    for model_name in GEMINI_MODELS:

        print(f"Trying model: {model_name}")

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

            elapsed = time.perf_counter() - start_time

            # ------------------------------------------------
            # Validate response
            # ------------------------------------------------

            if response is None:
                raise RuntimeError(
                    "Gemini returned an empty response object."
                )

            answer = response.text

            if not answer or not answer.strip():
                raise RuntimeError(
                    "Gemini returned an empty text response."
                )

            print(
                f"SUCCESS: {model_name} "
                f"({elapsed:.2f} seconds)"
            )

            return answer.strip(), model_name

        except Exception as e:

            elapsed = time.perf_counter() - start_time

            print(
                f"FAILED: {model_name} "
                f"({elapsed:.2f} seconds)"
            )

            print(f"Reason: {e}")

            last_error = e

            print("Trying next Gemini model...\n")

    raise RuntimeError(
        "All Gemini models failed.\n"
        f"Last error: {last_error}"
    )


# ============================================================
# RAG PIPELINE
# ============================================================

def ask_rag(question):

    print("\n" + "=" * 80)
    print(f"QUESTION: {question}")
    print("=" * 80)

    # --------------------------------------------------------
    # STEP 1: Retrieve documents from FAISS
    # --------------------------------------------------------

    start_retrieval = time.perf_counter()

    documents = vectorstore.max_marginal_relevance_search(
        question,
        k=20,
        fetch_k=50
    )

    retrieval_time = time.perf_counter() - start_retrieval

    print(
        f"\nRetrieved documents: {len(documents)}"
    )

    print(
        f"Retrieval time: {retrieval_time:.2f} seconds"
    )

    if not documents:
        raise RuntimeError(
            "FAISS returned no documents."
        )

    # --------------------------------------------------------
    # STEP 2: Prepare pairs for BGE
    # --------------------------------------------------------

    rerank_pairs = []

    for doc in documents:

        # Make sure we actually have a LangChain Document
        if not hasattr(doc, "page_content"):
            print(
                "WARNING: Retrieved object does not have "
                "'page_content':",
                type(doc)
            )
            continue

        rerank_pairs.append(
            [
                question,
                doc.page_content
            ]
        )

    if not rerank_pairs:
        raise RuntimeError(
            "No valid documents available for BGE reranking."
        )

    # --------------------------------------------------------
    # STEP 3: BGE reranking
    # --------------------------------------------------------

    start_rerank = time.perf_counter()

    scores = reranker.predict(
        rerank_pairs
    )

    rerank_time = time.perf_counter() - start_rerank

    # --------------------------------------------------------
    # IMPORTANT FIX
    #
    # Do NOT keep tuples when creating final documents.
    #
    # We explicitly create:
    #
    #     (score, doc)
    #
    # and then extract doc again.
    # --------------------------------------------------------

    scored_documents = list(
        zip(scores, documents)
    )

    scored_documents.sort(
        key=lambda x: float(x[0]),
        reverse=True
    )

    # Take top 10 after BGE
    top_reranked = scored_documents[:10]

    # Extract ONLY Document objects
    reranked_documents = [
        item[1]
        for item in top_reranked
        if hasattr(item[1], "page_content")
    ]

    print(
        f"After reranking: {len(reranked_documents)}"
    )

    print(
        f"BGE reranking time: {rerank_time:.2f} seconds"
    )

    if not reranked_documents:
        raise RuntimeError(
            "BGE produced no valid documents."
        )

    # --------------------------------------------------------
    # STEP 4: Display BGE scores for testing
    # --------------------------------------------------------

    print("\nTop BGE results:")

    for rank, (score, doc) in enumerate(
        top_reranked,
        start=1
    ):

        print(
            f"{rank}. Score: {float(score):.4f}"
        )

    # --------------------------------------------------------
    # STEP 5: Remove duplicate documents
    # --------------------------------------------------------

    unique_documents = []

    seen_text = set()

    for doc in reranked_documents:

        text = doc.page_content.strip()

        if not text:
            continue

        # Use complete text for duplicate detection
        text_key = text

        if text_key not in seen_text:

            seen_text.add(text_key)

            unique_documents.append(doc)

    # --------------------------------------------------------
    # STEP 6: Use top 5 documents as context
    # --------------------------------------------------------

    final_documents = unique_documents[:5]

    print(
        f"Documents used for Gemini: "
        f"{len(final_documents)}"
    )

    # --------------------------------------------------------
    # STEP 7: Build context
    # --------------------------------------------------------

    context_parts = []

    for i, doc in enumerate(
        final_documents,
        start=1
    ):

        context_parts.append(
            f"Information {i}:\n"
            f"{doc.page_content.strip()}"
        )

    context = "\n\n".join(
        context_parts
    )

    # --------------------------------------------------------
    # STEP 8: Gemini generation
    # --------------------------------------------------------

    answer, successful_model = generate_with_gemini(
        question,
        context
    )

    # --------------------------------------------------------
    # STEP 9: Final output
    # --------------------------------------------------------

    print("\n" + "=" * 80)
    print("FINAL ANSWER")
    print("=" * 80)

    print(answer)

    print("\n" + "=" * 80)
    print(
        f"Generated using: {successful_model}"
    )
    print("=" * 80)

    return answer


# ============================================================
# MAIN TEST
# ============================================================

if __name__ == "__main__":

    print("\nStarting RAG test...\n")

    question = "What are the main types of NSCLC?"

    try:

        answer = ask_rag(question)

    except Exception as e:

        print("\n")
        print("=" * 80)
        print("EXECUTION FAILED")
        print("=" * 80)
        print(type(e).__name__, ":", e)
        print("=" * 80)