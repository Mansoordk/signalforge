
"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import { TransactionStatus } from "genlayer-js/types";

const CONTRACT =
  process.env.NEXT_PUBLIC_CONTRACT_ADDRESS ||
  "0x2677F2F9D806e7511BC2B88b8c5FA516F4793312";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function getReadClient() {
  return createClient({ chain: studionet });
}

function getErrorMessage(error) {
  return error?.shortMessage || error?.message || "Something went wrong.";
}

function isTimeoutError(error) {
  return /timed?\s*out|timeout|timedout/i.test(getErrorMessage(error));
}

function normalizeQuestion(data, evidenceUrls = []) {
  const resolved =
    String(data?.status || "").toUpperCase() === "RESOLVED";

  return {
    id: Number(data?.id ?? 0),
    title: data?.title || "Untitled question",
    description: data?.description || "",
    criteria: data?.criteria || "",
    creator: data?.creator || "",
    category: "Research",
    status: resolved ? "Resolved" : "Open",
    verdict: data?.verdict || "",
    confidence: Number(data?.confidence || 0),
    explanation: data?.explanation || "",
    evidence: Number(data?.evidence_count || 0),
    evidenceUrls,
  };
}

async function readQuestionCount(client) {
  const count = await client.readContract({
    address: CONTRACT,
    functionName: "get_question_count",
    args: [],
  });

  return Number(count);
}

async function readOneQuestion(client, id) {
  const [data, evidenceUrls] = await Promise.all([
    client.readContract({
      address: CONTRACT,
      functionName: "get_question",
      args: [BigInt(id)],
    }),
    client.readContract({
      address: CONTRACT,
      functionName: "get_evidence",
      args: [BigInt(id)],
    }),
  ]);

  if (!data || data.error) return null;

  return normalizeQuestion(
    data,
    Array.isArray(evidenceUrls) ? evidenceUrls : []
  );
}

// A timeout while waiting for FINALIZED does not mean the transaction failed.
// Keep its hash and let the UI check the contract's actual state.
async function sendWrite(client, functionName, args) {
  const hash = await client.writeContract({
    address: CONTRACT,
    functionName,
    args,
  });

  if (!hash) {
    throw new Error("No transaction hash was returned by the wallet.");
  }

  try {
    const receipt = await client.waitForTransactionReceipt({
      hash,
      status: TransactionStatus.FINALIZED,
    });

    if (
      receipt?.txExecutionResultName &&
      receipt.txExecutionResultName !== "FINISHED_WITH_RETURN"
    ) {
      throw new Error(
        `Contract execution failed: ${receipt.txExecutionResultName}`
      );
    }

    return { hash, pending: false };
  } catch (error) {
    if (isTimeoutError(error)) {
      return { hash, pending: true };
    }

    throw error;
  }
}

export default function Home() {
  const [questions, setQuestions] = useState([]);
  const [activeTab, setActiveTab] = useState("All questions");
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [selected, setSelected] = useState(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [criteria, setCriteria] = useState("");
  const [evidence, setEvidence] = useState("");
  const [notice, setNotice] = useState("");
  const [walletAddress, setWalletAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  

const refreshQuestions = useCallback(async () => {
  setRefreshing(true);

  try {
    let lastError;

    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const client = getReadClient();
        const count = await readQuestionCount(client);

        const ids = Array.from(
          { length: count },
          (_, index) => count - index - 1
        );

        const loaded = await Promise.all(
          ids.map((id) => readOneQuestion(client, id))
        );

        const valid = loaded.filter(Boolean);
        setQuestions(valid);

        setSelected((current) => {
          if (!current) return null;
          return valid.find((question) => question.id === current.id) || null;
        });

        return valid;
      } catch (error) {
        lastError = error;

        if (attempt < 3) {
          await new Promise((resolve) => setTimeout(resolve, attempt * 1500));
        }
      }
    }

    setNotice(
      `StudioNet could not be reached after 3 attempts. Your existing question list is preserved. Try Refresh again. Details: ${getErrorMessage(lastError)}`
    );

    return [];
  } finally {
    setRefreshing(false);
  }
}, []);


  // Re-read the contract until the expected state appears or retries run out.
  const waitForQuestionCondition = useCallback(
    async (id, condition, attempts = 8) => {
      for (let attempt = 0; attempt < attempts; attempt += 1) {
        const loaded = await refreshQuestions();
        const question = loaded.find((item) => item.id === id);

        if (question && condition(question)) {
          setSelected(question);
          return question;
        }

        if (attempt < attempts - 1) {
          await sleep(3000);
        }
      }

      return null;
    },
    [refreshQuestions]
  );

  useEffect(() => {
    refreshQuestions();
  }, [refreshQuestions]);

  async function connectWallet() {
    setLoading(true);
    setNotice("");

    try {
      if (!window.ethereum) {
        throw new Error(
          "MetaMask was not detected. Install or enable the MetaMask browser extension."
        );
      }

      const accounts = await window.ethereum.request({
        method: "eth_requestAccounts",
      });

      if (!accounts?.length) {
        throw new Error("No wallet account was returned.");
      }

      const address = accounts[0];

      const client = createClient({
        chain: studionet,
        account: address,
        provider: window.ethereum,
      });

      await client.connect("studionet");

      setWalletAddress(address);
      setNotice(
        `Wallet connected: ${address.slice(0, 6)}…${address.slice(-4)}`
      );
    } catch (error) {
      setNotice(`Wallet connection failed: ${getErrorMessage(error)}`);
    } finally {
      setLoading(false);
    }
  }

  async function getConnectedClient() {
    if (!window.ethereum) {
      throw new Error("MetaMask was not detected.");
    }

    let address = walletAddress;

    if (!address) {
      const accounts = await window.ethereum.request({
        method: "eth_requestAccounts",
      });
      address = accounts?.[0];
    }

    if (!address) {
      throw new Error("Connect a wallet before submitting a transaction.");
    }

    const client = createClient({
      chain: studionet,
      account: address,
      provider: window.ethereum,
    });

    await client.connect("studionet");
    setWalletAddress(address);

    return client;
  }

  async function createQuestion(event) {
    event.preventDefault();

    if (!title.trim() || !description.trim() || !criteria.trim()) {
      setNotice("Complete the title, description, and resolution criteria.");
      return;
    }

    if (
      title.trim().length > 200 ||
      description.trim().length > 2000 ||
      criteria.trim().length > 3000
    ) {
      setNotice(
        "The title limit is 200 characters, description 2,000, and criteria 3,000."
      );
      return;
    }

    setLoading(true);
    setNotice("Confirm the transaction in MetaMask…");

    try {
      const client = await getConnectedClient();
      const previousCount = await readQuestionCount(client);

      const { hash, pending } = await sendWrite(client, "create_question", [
        title.trim(),
        description.trim(),
        criteria.trim(),
      ]);

      const loaded = await refreshQuestions();
      let created = loaded.find((question) => question.id === previousCount);

      if (!created && pending) {
        const latestCount = await readQuestionCount(getReadClient()).catch(
          () => previousCount
        );

        if (latestCount > previousCount) {
          const refreshed = await refreshQuestions();
          created = refreshed.find(
            (question) => question.id === previousCount
          );
        }
      }

      if (created) setSelected(created);

      setTitle("");
      setDescription("");
      setCriteria("");
      setShowCreate(false);

      setNotice(
        pending && !created
          ? `Transaction submitted but confirmation is delayed. Do not submit again. Hash: ${hash}. Use Refresh to check the contract.`
          : `Question submitted. Transaction: ${hash.slice(0, 12)}…${
              pending ? " Confirmation may still be pending." : ""
            }`
      );
    } catch (error) {
      setNotice(`Could not create question: ${getErrorMessage(error)}`);
    } finally {
      setLoading(false);
    }
  }

  async function submitEvidence(event) {
    event.preventDefault();

    if (!selected || !evidence.trim()) return;

    if (!evidence.trim().startsWith("https://")) {
      setNotice("Evidence must be an HTTPS URL.");
      return;
    }

    setLoading(true);
    setNotice("Confirm the evidence transaction in MetaMask…");

    try {
      const questionId = selected.id;
      const previousEvidenceCount = selected.evidence;
      const client = await getConnectedClient();

      const { hash, pending } = await sendWrite(
        client,
        "submit_evidence",
        [BigInt(questionId), evidence.trim()]
      );

      let updated = await waitForQuestionCondition(
        questionId,
        (question) => question.evidence > previousEvidenceCount,
        pending ? 8 : 2
      );

      if (!updated) {
        const loaded = await refreshQuestions();
        updated = loaded.find((question) => question.id === questionId);
      }

      if (updated) setSelected(updated);

      setEvidence("");
      setNotice(
        updated && updated.evidence > previousEvidenceCount
          ? `Evidence recorded on-chain. Transaction: ${hash.slice(0, 12)}…`
          : `Evidence transaction submitted: ${hash}. ${
              pending
                ? "Confirmation is delayed. Do not submit the same evidence again; use Refresh to check its status."
                : "The transaction returned, but the evidence is not yet visible. Refresh to check the contract."
            }`
      );
    } catch (error) {
      setNotice(`Could not submit evidence: ${getErrorMessage(error)}`);
    } finally {
      setLoading(false);
    }
  }

  async function resolveQuestion() {
    if (!selected || loading) return;

    if (selected.status === "Resolved") {
      setNotice("This question is already resolved on-chain.");
      return;
    }

    if (selected.evidence < 1) {
      setNotice("Submit at least one evidence URL before resolving.");
      return;
    }

    const confirmed = window.confirm(
      "Resolve this question using GenLayer consensus? This submits an on-chain transaction."
    );

    if (!confirmed) return;

    const questionId = selected.id;

    setLoading(true);
    setNotice(
      "Confirm the resolution transaction in MetaMask. Keep this page open while it checks the contract…"
    );

    try {
      const client = await getConnectedClient();

      const { hash, pending } = await sendWrite(
        client,
        "resolve_question",
        [BigInt(questionId)]
      );

      // Whether the receipt wait completed or timed out, check the actual
      // contract state. Do not equate a timeout with a failed transaction.
      const updated = await waitForQuestionCondition(
        questionId,
        (question) => question.status === "Resolved",
        pending ? 10 : 5
      );

      if (updated?.status === "Resolved") {
        setNotice(
          `Question resolved on-chain. Verdict: ${
            updated.verdict || "Recorded"
          }. Transaction: ${hash.slice(0, 12)}…`
        );
      } else {
        await refreshQuestions();

        setNotice(
          `The resolution transaction was submitted: ${hash}. ${
            pending
              ? "Confirmation is taking longer than expected; the transaction may still be processing."
              : "The transaction wait completed, but the updated status is not yet visible."
          } Do not submit another resolution yet. Use Refresh or check the transaction in the explorer.`
        );
      }
    } catch (error) {
      if (isTimeoutError(error)) {
        await refreshQuestions();

        setNotice(
          "The wallet or transaction wait timed out before confirmation. Check the transaction in the explorer and refresh the question before trying again."
        );
      } else {
        setNotice(`Could not resolve question: ${getErrorMessage(error)}`);
      }
    } finally {
      setLoading(false);
    }
  }

  const filtered = questions.filter((question) => {
    const matchesTab =
      activeTab === "All questions" ||
      (activeTab === "Open" && question.status === "Open") ||
      (activeTab === "Resolved" && question.status === "Resolved");

    return (
      matchesTab &&
      `${question.title} ${question.category}`
        .toLowerCase()
        .includes(search.toLowerCase())
    );
  });

  return (
    <main className="shell">
      <aside className="sidebar">
        <a className="brand" href="#">
          <span className="brand-mark">S</span>
          <span>
            signal<span className="brand-light">forge</span>
          </span>
        </a>

        <div className="network-pill">
          <span className="live-dot" />
          GenLayer · StudioNet
        </div>

        <p className="nav-label">WORKSPACE</p>

        {["All questions", "Open", "Resolved"].map((tab) => (
          <button
            key={tab}
            className={`nav-item ${activeTab === tab ? "nav-active" : ""}`}
            onClick={() => {
              setActiveTab(tab);
              setSelected(null);
              setShowCreate(false);
            }}
          >
            <span>
              {tab === "All questions" ? "◫" : tab === "Open" ? "◎" : "✓"}
            </span>
            {tab}
            {tab === "All questions" && (
              <span className="nav-count">{questions.length}</span>
            )}
          </button>
        ))}

        <div className="sidebar-bottom">
          <div className="powered-card">
            <span className="powered-icon">✳</span>
            <p>Truth, resolved collectively.</p>
            <span>Powered by Intelligent Contracts</span>
          </div>

          <div className="network-footer">
            <span className="live-dot" /> Wallet status
            <strong>{walletAddress ? "Connected" : "Not connected"}</strong>
          </div>
        </div>
      </aside>

      <section className="main-area">
        <header className="topbar">
          <div className="breadcrumb">
            Workspace <span>/</span> Research
          </div>

          <button
            className="wallet-button"
            onClick={connectWallet}
            disabled={loading}
          >
            <span>◇</span>{" "}
            {walletAddress
              ? `${walletAddress.slice(0, 6)}…${walletAddress.slice(-4)}`
              : loading
                ? "Connecting…"
                : "Connect wallet"}
          </button>
        </header>

        <div className="content">
          <div className="eyebrow">
            <span className="live-dot" /> DECENTRALIZED EVIDENCE ENGINE
          </div>

          <div className="hero-row">
            <div>
              <h1>
                Seek truth.
                <br />
                <span>Settle with evidence.</span>
              </h1>
              <p className="hero-copy">
                Ask questions that matter. Submit verifiable evidence. Let
                GenLayer Intelligent Contracts evaluate the outcome.
              </p>
            </div>

            <button
              className="primary-button"
              disabled={loading}
              onClick={() => {
                setNotice("");
                setShowCreate(true);
                setSelected(null);
              }}
            >
              <span>＋</span> New question
            </button>
          </div>

          <div className="stats-grid">
            <div className="stat-card">
              <span className="stat-label">TOTAL QUESTIONS</span>
              <strong>{String(questions.length).padStart(2, "0")}</strong>
              <span className="stat-foot">Read from the deployed contract</span>
            </div>

            <div className="stat-card">
              <span className="stat-label">AWAITING RESOLUTION</span>
              <strong>
                {String(
                  questions.filter((question) => question.status === "Open")
                    .length
                ).padStart(2, "0")}
              </strong>
              <span className="stat-foot">
                <span className="amber-dot" /> Evidence review pending
              </span>
            </div>

            <div className="stat-card">
              <span className="stat-label">RESOLVED</span>
              <strong>
                {String(
                  questions.filter(
                    (question) => question.status === "Resolved"
                  ).length
                ).padStart(2, "0")}
              </strong>
              <span className="stat-foot">
                <span className="live-dot" /> Resolved on-chain
              </span>
            </div>
          </div>

          {notice && (
            <div className="notice">
              <span>{notice}</span>
              <button onClick={() => setNotice("")}>×</button>
            </div>
          )}

          <div className="refresh-row">
            <span>
              {refreshing ? "Loading from GenLayer…" : "Live contract data"}
            </span>
            <button
              className="back-link"
              disabled={refreshing || loading}
              onClick={refreshQuestions}
            >
              ↻ Refresh
            </button>
          </div>

          {showCreate ? (
            <section className="panel form-panel">
              <div className="section-heading">
                <div>
                  <span className="section-kicker">NEW RESEARCH</span>
                  <h2>Create a question</h2>
                </div>
                <button
                  className="close-button"
                  onClick={() => setShowCreate(false)}
                >
                  ×
                </button>
              </div>

              <form className="research-form" onSubmit={createQuestion}>
                <label>
                  Question title
                  <input
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    placeholder="What claim should be verified?"
                    maxLength={200}
                    required
                  />
                </label>

                <label>
                  Description
                  <textarea
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    placeholder="Explain the claim and the context…"
                    maxLength={2000}
                    required
                    rows={3}
                  />
                </label>

                <label>
                  Resolution criteria
                  <textarea
                    value={criteria}
                    onChange={(event) => setCriteria(event.target.value)}
                    placeholder="Specify what evidence counts as support, rejection, or uncertainty…"
                    maxLength={3000}
                    required
                    rows={3}
                  />
                </label>

                <div className="form-note">
                  Creating a question sends a transaction to the SignalForge
                  Intelligent Contract.
                </div>

                <button
                  className="primary-button"
                  type="submit"
                  disabled={loading}
                >
                  {loading ? "Submitting…" : "Create on-chain question →"}
                </button>
              </form>
            </section>
          ) : selected ? (
            <section className="panel detail-panel">
              <button
                className="back-link"
                onClick={() => setSelected(null)}
              >
                ← Back to questions
              </button>

              <span className="section-kicker">
                {selected.category} / QUESTION #{selected.id}
              </span>

              <h2>{selected.title}</h2>
              <p className="detail-copy">{selected.description}</p>

              <div className="detail-meta">
                <span
                  className={`status ${
                    selected.status === "Resolved" ? "resolved" : "open"
                  }`}
                >
                  {selected.status}
                </span>
                <span>{selected.evidence} evidence item(s)</span>
                <span>{selected.confidence}% confidence</span>
              </div>

              {selected.criteria && (
                <div className="criteria-box">
                  <strong>Resolution criteria</strong>
                  <p>{selected.criteria}</p>
                </div>
              )}

              {selected.status === "Resolved" && (
                <>
                  <div className="criteria-box">
                    <strong>On-chain verdict: {selected.verdict}</strong>
                    <p>
                      {selected.explanation || "No explanation returned."}
                    </p>
                  </div>
                  <p className="form-note">Creator: {selected.creator}</p>
                </>
              )}

              {selected.evidenceUrls?.length > 0 && (
                <div className="evidence-list">
                  <strong>Submitted evidence</strong>
                  {selected.evidenceUrls.map((url, index) => (
                    <a
                      key={`${url}-${index}`}
                      href={url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {url} ↗
                    </a>
                  ))}
                </div>
              )}

              {selected.status === "Open" && (
                <>
                  <form
                    className="research-form evidence-form"
                    onSubmit={submitEvidence}
                  >
                    <label>
                      Evidence URL
                      <input
                        type="url"
                        value={evidence}
                        onChange={(event) => setEvidence(event.target.value)}
                        placeholder="https://…"
                        required
                      />
                    </label>

                    <button
                      className="primary-button"
                      type="submit"
                      disabled={loading}
                    >
                      {loading
                        ? "Submitting…"
                        : "＋ Submit evidence on-chain"}
                    </button>
                  </form>

                  <div className="form-note">
                    Evidence must use HTTPS. Once evidence is recorded, you
                    can request a GenLayer resolution.
                  </div>

                  <button
                    className="primary-button"
                    onClick={resolveQuestion}
                    disabled={loading || selected.evidence < 1}
                  >
                    {loading ? "Processing…" : "Resolve with GenLayer →"}
                  </button>
                </>
              )}

              <p className="form-note">
                Contract address:{" "}
                <a
                  href={`https://explorer-studio.genlayer.com/address/${CONTRACT}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  {CONTRACT} ↗
                </a>
              </p>
            </section>
          ) : (
            <>
              <div className="section-heading list-heading">
                <div>
                  <span className="section-kicker">THE EVIDENCE BOARD</span>
                  <h2>Research questions</h2>
                </div>

                <div className="search-box">
                  <span>⌕</span>
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search questions…"
                  />
                </div>
              </div>

              <div className="filter-row">
                {["All questions", "Open", "Resolved"].map((tab) => (
                  <button
                    key={tab}
                    className={`filter-tab ${
                      activeTab === tab ? "filter-selected" : ""
                    }`}
                    onClick={() => setActiveTab(tab)}
                  >
                    {tab}
                  </button>
                ))}
                <span className="result-count">{filtered.length} results</span>
              </div>

              <div className="question-list">
                {filtered.map((question) => (
                  <button
                    key={question.id}
                    className="question-card"
                    onClick={() => {
                      setSelected(question);
                      setShowCreate(false);
                    }}
                  >
                    <div className="question-icon">◈</div>

                    <div className="question-body">
                      <div className="question-tags">
                        <span>{question.category}</span>
                        <span
                          className={`status ${
                            question.status === "Resolved"
                              ? "resolved"
                              : "open"
                          }`}
                        >
                          {question.status}
                        </span>
                      </div>

                      <h3>{question.title}</h3>
                      <p>{question.description}</p>

                      <div className="question-meta">
                        <span>▤ {question.evidence} evidence items</span>
                        <span>·</span>
                        <span>
                          {question.status === "Resolved"
                            ? question.verdict
                            : "Awaiting resolution"}
                        </span>
                      </div>
                    </div>

                    <span className="question-arrow">↗</span>
                  </button>
                ))}

                {filtered.length === 0 && (
                  <div className="empty-state">
                    {refreshing
                      ? "Loading questions…"
                      : "No on-chain questions match your search. Create the first one."}
                  </div>
                )}
              </div>
            </>
          )}

          <footer className="page-footer">
            <span>SIGNALFORGE © 2026</span>
            <span>Built for evidence, powered by GenLayer.</span>
          </footer>
        </div>
      </section>
    </main>
  );
}
