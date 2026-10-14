"""Company-document production branches; no persistent clients, model or DB writes."""
from dataclasses import replace
from types import SimpleNamespace as NS
from unittest.mock import Mock
import unittest
import test_dataset_chat as chat_tests
from test_dataset_chat import TYPES, USAGE, load_ast


class CompanyDocumentTests(unittest.TestCase):
    def setUp(self):
        self.fixture = chat_tests.DatasetChatTests("runTest")
        self.fixture.setUp()
        self.addCleanup(self.fixture.doCleanups)
        self.fixture.office_catalog()
        self.fixture.provider.generate_dataset_plan.return_value = dict(route="vector"), USAGE.copy()
        self.ns = self.fixture.orchestrator()
        self.context = "Acme is a commercial property marketplace. Acme is an aggregator and does not operate offices."
        chunk = TYPES.RerankedChunk(self.context, "primary", 0, distance=0.23, source_id=55,
                                   confidence=0.3915, rerank_score=0.54)
        self.retrieval = TYPES.HybridRetrievalResult("", [chunk],
            TYPES.RetrievalConfidence(0.3915, "low", True, ("low_confidence",)),
            {}, [dict(id=55, name="Company overview", type="text")], self.context)
        ns = self.ns
        ns.update(SimpleNamespace=NS, chroma_client=Mock(),
                  _prepare_history=Mock(side_effect=AssertionError("No dataset answers in documents")),
                  _has_prior_escalation_contacts=Mock(return_value=False),
                  resolve_followup_context=Mock(return_value=NS(query_text="company overview")),
                  retrieve_hybrid_result=Mock(return_value=self.retrieval),
                  build_clarifying_question=Mock(return_value="generic clarification"),
                  build_soft_fallback_message=Mock(return_value="generic fallback"),
                  build_grounded_fallback_message=Mock(return_value="giant copied document"))
        prompt = load_ast("app/services/chat/prompt_builder.py", dict(
            build_structured_response_instruction=lambda: "Return structured JSON."))
        ns.update(build_system_prompt=prompt["build_system_prompt"], build_chat_messages=prompt["build_chat_messages"])
        load_ast("app/services/chat/orchestrator.py", ns,
                 {"_normalize_message", "_is_small_talk_message", "_is_bare_clarification", "_build_vector_plan", "_generate_structured_response"})
        self.fixture.config.system_prompt = "You are an assistant for a community arts archive. Use authorized documents only."

    def plan(self, message="What is Acmespace?"):
        return self.ns["_build_plan"](message, "s", "w", 7, self.fixture.db,
                                       retrieval_message="old price 999")

    def answer(self, text, answered=True, confidence=0.9, escalation=False):
        return TYPES.StructuredAnswer(answered, confidence, escalation, text)

    def test_low_retrieval_validated_company_answer_is_used_without_confidence_override(self):
        plan = self.plan()
        self.assertTrue(plan.should_generate_llm_response)
        self.assertIsNone(plan.override_response)
        self.assertEqual(plan.retrieval_result.confidence.score, 0.3915)
        self.assertTrue(plan.retrieval_result.confidence.requires_clarification)
        answer = "Acme is a commercial property marketplace and aggregator."
        self.assertEqual(self.ns["_finalize_response"](plan, self.answer(answer), "What is Acmespace?"), answer)
        self.assertNotIn("old price 999", str(plan.messages))
        self.assertIn("Do not invent aliases", plan.messages[0]["content"])
        self.assertIn(self.fixture.config.system_prompt, plan.messages[0]["content"])
        self.assertEqual(plan.messages[-1]["content"], "What is Acmespace?")
        self.assertTrue(plan.retrieval_trace["dataset_document_question"])
        self.fixture.provider.generate_dataset_plan.assert_called_once()
        self.fixture.service.execute_query.assert_not_called()

    def test_unknown_brand_introduction_is_not_rewritten_as_widget_company(self):
        plan = self.plan("What is Otherbrand?")
        self.assertEqual(plan.messages[-1]["content"], "What is Otherbrand?")
        self.assertNotIn("company_question_rewrite", plan.retrieval_trace)

    def test_uncovered_city_is_not_generic_clarification_or_invented_coverage(self):
        plan = self.plan("Do you operate in Pune?")
        raw = self.answer("This topic is not covered in the current knowledge base.", answered=False, confidence=0.4)
        text = self.ns["_finalize_response"](plan, raw, "Do you operate in Pune?")
        self.assertEqual(text, "I don’t have verified information to confirm that detail.")
        self.assertNotIn("clarification", text)
        self.assertIn("Do not infer services, availability, exclusions or identities from missing information", plan.messages[0]["content"])

    def test_unanswered_even_if_validator_accepts_never_becomes_fact(self):
        plan = self.plan()
        self.ns["validate_answer"].return_value = TYPES.ValidatedResponse(True, "Acme invented", 0.9, 0.8)
        self.assertEqual(self.ns["_finalize_response"](plan, self.answer("Acme invented", answered=False), "company"),
                         plan.grounded_fallback)

    def test_rejected_low_similarity_escalation_or_numeric_hallucination_fails_closed(self):
        for raw in [self.answer("An unrelated global technology provider", confidence=0),
                    self.answer("Acme offices cost 999.50"), self.answer(self.context, escalation=True)]:
            with self.subTest(raw=raw):
                plan = self.plan()
                self.assertEqual(self.ns["_finalize_response"](plan, raw, "company"), plan.grounded_fallback)

    def test_document_numeric_guard_rejects_attached_and_unicode_but_allows_exact_evidence(self):
        for literal in ("999days", "²", "999.50"):
            with self.subTest(literal=literal):
                candidate = self.context + " Reviews take " + literal + "."
                for supported in (False, True):
                    with self.subTest(supported=supported):
                        context = candidate if supported else self.context
                        self.ns["retrieve_hybrid_result"].return_value = replace(
                            self.retrieval, context_text=context,
                            chunks=[replace(self.retrieval.chunks[0], text=context)], retrieval_trace={})
                        plan = self.plan("How are reviews handled?")
                        text = self.ns["_finalize_response"](plan, self.answer(candidate), "reviews")
                        self.assertEqual(text, candidate if supported else plan.grounded_fallback)
                        validation = plan.retrieval_trace["document_answer_validation"]
                        self.assertEqual(validation["reason"], "accepted")
                        self.assertEqual(validation["numeric_grounded"], supported)
                        self.assertEqual(plan.retrieval_trace["prepared_response"], supported)
                        self.assertTrue(plan.retrieval_result.confidence.requires_clarification)

    def test_generic_retrieval_clarification_discount_policy_has_no_blog_or_post_count_wording(self):
        question = "What is your discount policy?"
        # 'discount' contains 'count', but is not a request to count blog posts.
        self.ns["resolve_followup_context"].return_value = NS(query_text=question)
        plan = self.ns["_build_vector_plan"](
            question, "s", "w", 7, self.fixture.db, dataset_questions=[])
        self.assertTrue(plan.retrieval_result.confidence.requires_clarification)
        self.assertFalse(plan.should_generate_llm_response)
        self.assertEqual(plan.override_response, "Could you clarify which information you’d like me to check?")
        for word in ("blog", "post", "count"):
            self.assertNotIn(word, plan.override_response.casefold())
        self.assertNotIn("dataset_document_question", plan.retrieval_trace)
        self.fixture.provider.generate_structured_answer.assert_not_called()

    def test_no_authorized_context_suspicious_material_or_empty_chunks_no_generation(self):
        for retrieval in [replace(self.retrieval, context_text="", chunks=[]),
                          replace(self.retrieval, sources=[]),
                          replace(self.retrieval, chunks=[replace(self.retrieval.chunks[0], is_suspicious=True)])]:
            with self.subTest(retrieval=retrieval):
                self.ns["retrieve_hybrid_result"].return_value = retrieval
                plan = self.plan()
                self.assertFalse(plan.should_generate_llm_response)
                self.assertEqual(plan.grounded_fallback, "I don’t have verified information to confirm that detail.")

    def test_company_stream_and_nonstream_validate_before_emitting_and_count_usage(self):
        text = "Acme is a commercial property marketplace and aggregator."
        provider = self.fixture.provider
        usage = dict(prompt_tokens=3, completion_tokens=5, total_tokens=8)
        provider.generate_structured_answer.return_value = dict(
            answered=True, confidence=0.9, response=text, requires_escalation=False), usage
        result, sources, metrics = self.ns["generate_chat_response"]("What is Acmespace?", "s", "w", 3, 7, self.fixture.db)
        stream, stream_sources, streamed, trace = self.ns["stream_chat_response"]("What is Acmespace?", "s", "w", 3, 7, self.fixture.db)
        self.assertIsNone(stream)
        self.assertEqual(result, text)
        self.assertEqual((result, sources), (streamed, stream_sources))
        self.assertEqual(metrics["total_tokens"], 26)
        self.assertEqual(trace["token_usage"], dict(prompt_tokens=14, completion_tokens=12, total_tokens=26))
        self.ns["reserve_chat_credits"].assert_called_once()
        self.ns["finalize_conversation_metrics"].assert_called_once()
        provider.stream_chat_completion.assert_not_called()

    def test_company_stream_failure_uses_evidence_limit_not_document_copy(self):
        self.fixture.provider.generate_structured_answer.side_effect = RuntimeError("unavailable")
        stream, _, text, trace = self.ns["stream_chat_response"]("What is Acmespace?", "s", "w", 3, 7, self.fixture.db)
        self.assertIsNone(stream)
        self.assertEqual(text, "I don’t have verified information to confirm that detail.")
        self.assertNotIn("giant copied document", text)
        self.assertEqual(trace["token_usage"], USAGE)
        self.assertFalse(trace["escalation_triggered"])


if __name__ == "__main__":
    unittest.main()