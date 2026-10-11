# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }

from genlayer import *


class SignalForge(gl.Contract):
    titles: DynArray[str]
    descriptions: DynArray[str]
    criteria: DynArray[str]
    creators: DynArray[Address]
    statuses: DynArray[str]
    verdicts: DynArray[str]
    explanations: DynArray[str]
    confidence_scores: DynArray[u32]
    evidence_counts: DynArray[u32]
    evidence_items: DynArray[str]

    def __init__(self):
        pass

    @gl.public.write
    def create_question(
        self,
        title: str,
        description: str,
        criteria: str,
    ) -> u256:
        title = title.strip()
        description = description.strip()
        criteria = criteria.strip()

        if not title or len(title) > 200:
            return u256(0)

        if not description or len(description) > 2000:
            return u256(0)

        if not criteria or len(criteria) > 3000:
            return u256(0)

        self.titles.append(title)
        self.descriptions.append(description)
        self.criteria.append(criteria)
        self.creators.append(gl.message.sender_address)
        self.statuses.append("OPEN")
        self.verdicts.append("")
        self.explanations.append("")
        self.confidence_scores.append(u32(0))
        self.evidence_counts.append(u32(0))

        return u256(len(self.titles) - 1)

    @gl.public.write
    def submit_evidence(
        self,
        question_id: u256,
        evidence_url: str,
    ) -> None:
        qid = int(question_id)

        if qid >= len(self.titles):
            return

        if self.statuses[qid] != "OPEN":
            return

        url = evidence_url.strip()

        if not url.startswith("https://") or len(url) > 500:
            return

        self.evidence_items.append(str(qid) + "|" + url)
        self.evidence_counts[qid] = u32(
            int(self.evidence_counts[qid]) + 1
        )

    @gl.public.write
    def resolve_question(self, question_id: u256) -> None:
        qid = int(question_id)

        if qid >= len(self.titles):
            return

        if self.statuses[qid] != "OPEN":
            return

        if self.evidence_counts[qid] == 0:
            return

        title = self.titles[qid]
        description = self.descriptions[qid]
        criteria = self.criteria[qid]

        urls = []
        prefix = str(qid) + "|"

        for item in self.evidence_items:
            if item.startswith(prefix):
                urls.append(item[len(prefix):])

        if not urls:
            return

        def leader_fn():
            evidence_text = ""

            for url in urls[:8]:
                try:
                    page = gl.nondet.web.render(
                        url,
                        mode="text",
                    )
                    evidence_text += (
                        "\nSOURCE: " + url
                        + "\nCONTENT: " + page[:5000]
                    )
                except Exception:
                    evidence_text += (
                        "\nSOURCE: " + url
                        + "\nCONTENT: Retrieval failed."
                    )

            prompt = f"""
You are an evidence evaluation engine.

QUESTION: {title}

DESCRIPTION: {description}

RESOLUTION CRITERIA:
{criteria}

EVIDENCE:
{evidence_text}

Evaluate the evidence against the criteria. Consider
source reliability, relevance, contradictions, and missing
information. Do not treat a claim as true merely because
a source states it.

Return a JSON object with exactly these fields:
- verdict: SUPPORTED, REFUTED, or INCONCLUSIVE
- confidence: integer from 0 to 100
- explanation: concise explanation

Use INCONCLUSIVE when evidence is insufficient
or contradictory.
"""

            result = gl.nondet.exec_prompt(
                prompt,
                response_format="json",
            )

            if not isinstance(result, dict):
                return {
                    "verdict": "INCONCLUSIVE",
                    "confidence": 0,
                    "explanation": "The evaluator returned an invalid response.",
                }

            verdict = result.get("verdict")
            confidence = result.get("confidence")
            explanation = result.get("explanation")

            if verdict not in (
                "SUPPORTED",
                "REFUTED",
                "INCONCLUSIVE",
            ):
                verdict = "INCONCLUSIVE"

            if (
                not isinstance(confidence, int)
                or confidence < 0
                or confidence > 100
            ):
                confidence = 0

            if not isinstance(explanation, str):
                explanation = "The evaluator did not provide an explanation."

            return {
                "verdict": verdict,
                "confidence": confidence,
                "explanation": explanation[:1500],
            }

        def validator_fn(leader_result) -> bool:
            if not isinstance(leader_result, gl.vm.Return):
                return False

            proposed = leader_result.calldata

            if not isinstance(proposed, dict):
                return False

            verdict = proposed.get("verdict")
            confidence = proposed.get("confidence")
            explanation = proposed.get("explanation")

            if verdict not in (
                "SUPPORTED",
                "REFUTED",
                "INCONCLUSIVE",
            ):
                return False

            if (
                not isinstance(confidence, int)
                or confidence < 0
                or confidence > 100
            ):
                return False

            if not isinstance(explanation, str):
                return False

            try:
                independent = leader_fn()

                return (
                    independent["verdict"] == verdict
                    and abs(
                        independent["confidence"] - confidence
                    ) <= 20
                )
            except Exception:
                return False

        try:
            result = gl.vm.run_nondet_unsafe(
                leader_fn,
                validator_fn,
            )
        except Exception:
            return

        if not isinstance(result, dict):
            return

        verdict = result.get("verdict")
        confidence = result.get("confidence")
        explanation = result.get("explanation")

        if verdict not in (
            "SUPPORTED",
            "REFUTED",
            "INCONCLUSIVE",
        ):
            return

        if (
            not isinstance(confidence, int)
            or confidence < 0
            or confidence > 100
        ):
            return

        if not isinstance(explanation, str):
            return

        self.verdicts[qid] = verdict
        self.confidence_scores[qid] = u32(confidence)
        self.explanations[qid] = explanation[:1500]
        self.statuses[qid] = "RESOLVED"

    @gl.public.view
    def get_question_count(self) -> u256:
        return u256(len(self.titles))

    @gl.public.view
    def get_question(self, question_id: u256) -> dict[str, str]:
        qid = int(question_id)

        if qid >= len(self.titles):
            return {
                "id": str(qid),
                "error": "Question does not exist.",
            }

        return {
            "id": str(qid),
            "title": self.titles[qid],
            "description": self.descriptions[qid],
            "criteria": self.criteria[qid],
            "creator": self.creators[qid].as_hex,
            "status": self.statuses[qid],
            "verdict": self.verdicts[qid],
            "confidence": str(self.confidence_scores[qid]),
            "explanation": self.explanations[qid],
            "evidence_count": str(self.evidence_counts[qid]),
        }

    @gl.public.view
    def get_evidence(
        self,
        question_id: u256,
    ) -> list[str]:
        qid = int(question_id)

        if qid >= len(self.titles):
            return []

        prefix = str(qid) + "|"
        urls = []

        for item in self.evidence_items:
            if item.startswith(prefix):
                urls.append(item[len(prefix):])

        return urls
