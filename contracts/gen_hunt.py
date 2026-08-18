# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }

import json
from genlayer import *


QUESTIONS_PER_LEVEL = 5

LEVEL_XP_REWARD = {
    "1": 100,
    "2": 150,
    "3": 200,
    "4": 250,
    "5": 300,
    "6": 400,
    "7": 500,
    "8": 750,
}

LEVEL_PASS_SCORE = {
    "1": 4,
    "2": 4,
    "3": 4,
    "4": 4,
    "5": 4,
    "6": 4,
    "7": 4,
    "8": 5,
}

LEVEL_TOPICS = {
    "1": "password security, phishing attacks, two-factor authentication, basic online safety",
    "2": "crypto wallets, private keys, seed phrases, hardware wallets, wallet hygiene",
    "3": "smart contract security fundamentals, access control, business logic, external calls and safe contract interactions",
    "4": "smart contract vulnerabilities, reentrancy attacks, access control flaws, arithmetic errors and unsafe external calls",
    "5": "flash loan-facilitated attacks, DeFi exploit mechanics, oracle manipulation and flash loan mitigations",
    "6": "cybersecurity supply chain risk, compromised dependencies, supplier risk, malicious components and supply chain mitigation",
    "7": "phishing, spear phishing, malicious attachments, malicious links, phishing services and social engineering delivery",
    "8": "advanced persistent threat groups, nation-state threat actors, ATT&CK techniques and state-sponsored campaigns",
}

LEVEL_NAMES = {
    "1": "Rookie",
    "2": "Operative",
    "3": "Analyst",
    "4": "Auditor",
    "5": "Elite",
    "6": "Phantom",
    "7": "Ghost",
    "8": "Shadow",
}


# Advanced training must be grounded in contract-controlled,
# authoritative cybersecurity sources.
#
# Users cannot supply or replace these URLs.
ADVANCED_LEVEL_SOURCES = {
    "3": {
        "name": "OWASP Smart Contract Top 10",
        "url": "https://scs.owasp.org/sctop10/",
    },
    "4": {
        "name": "OWASP Smart Contract Top 10",
        "url": "https://scs.owasp.org/sctop10/",
    },
    "5": {
        "name": "OWASP Flash Loan-Facilitated Attacks",
        "url": "https://scs.owasp.org/sctop10/SC04-FlashLoanAttacks/",
    },
    "6": {
        "name": "NIST Cybersecurity Supply Chain Risk Management",
        "url": "https://csrc.nist.gov/Projects/cyber-supply-chain-risk-management",
    },
    "7": {
        "name": "MITRE ATT&CK - Phishing",
        "url": "https://attack.mitre.org/techniques/T1566/",
    },
    "8": {
        "name": "MITRE ATT&CK - Groups",
        "url": "https://attack.mitre.org/groups/",
    },
}


class GenHunt(gl.Contract):

    players: TreeMap[str, str]
    questions: TreeMap[str, str]
    q_count: u64

    def __init__(self):
        self.q_count = u64(0)

    def _addr(self) -> str:
        return str(gl.message.sender_address).lower().strip()

    def _get_player(self, addr: str) -> dict:
        normalized = addr.lower().strip()
        raw = self.players.get(normalized, None)

        if raw is None:
            return {
                "address": normalized,
                "username": "",
                "level": 1,
                "xp": 0,
                "streak": 0,
                "best_streak": 0,
                "total_correct": 0,
                "total_answered": 0,
                "levels_completed": [],
            }

        return json.loads(raw)

    def _save_player(self, addr: str, player: dict) -> None:
        self.players[addr.lower().strip()] = json.dumps(player)

    def _validate_level(self, level: str) -> None:
        if level not in LEVEL_TOPICS:
            raise gl.vm.UserError("Invalid level (1-8)")

    def _validate_generated_questions(self, raw: str) -> list:
        try:
            questions = json.loads(raw)
        except Exception:
            raise gl.vm.UserError("AI returned invalid JSON")

        if not isinstance(questions, list):
            raise gl.vm.UserError("AI response must be a JSON array")

        if len(questions) != QUESTIONS_PER_LEVEL:
            raise gl.vm.UserError(
                f"AI must generate exactly {QUESTIONS_PER_LEVEL} questions"
            )

        normalized_questions = []

        for index, question in enumerate(questions):
            if not isinstance(question, dict):
                raise gl.vm.UserError(
                    f"Question {index + 1} must be a JSON object"
                )

            required_fields = {
                "question",
                "options",
                "correct",
                "explanation",
            }

            if set(question.keys()) != required_fields:
                raise gl.vm.UserError(
                    f"Question {index + 1} has invalid fields"
                )

            question_text = question.get("question")
            options = question.get("options")
            correct = question.get("correct")
            explanation = question.get("explanation")

            if not isinstance(question_text, str):
                raise gl.vm.UserError(
                    f"Question {index + 1} text must be a string"
                )

            question_text = question_text.strip()

            if len(question_text) < 10:
                raise gl.vm.UserError(
                    f"Question {index + 1} is too short"
                )

            if len(question_text) > 500:
                raise gl.vm.UserError(
                    f"Question {index + 1} is too long"
                )

            if not isinstance(options, dict):
                raise gl.vm.UserError(
                    f"Question {index + 1} options must be an object"
                )

            if set(options.keys()) != {"A", "B", "C", "D"}:
                raise gl.vm.UserError(
                    f"Question {index + 1} must contain exactly A, B, C and D"
                )

            cleaned_options = {}

            for key in ("A", "B", "C", "D"):
                value = options.get(key)

                if not isinstance(value, str):
                    raise gl.vm.UserError(
                        f"Question {index + 1} option {key} must be a string"
                    )

                value = value.strip()

                if not value:
                    raise gl.vm.UserError(
                        f"Question {index + 1} option {key} is empty"
                    )

                if len(value) > 300:
                    raise gl.vm.UserError(
                        f"Question {index + 1} option {key} is too long"
                    )

                cleaned_options[key] = value

            normalized_options = [
                cleaned_options[key].lower().strip()
                for key in ("A", "B", "C", "D")
            ]

            if len(set(normalized_options)) != 4:
                raise gl.vm.UserError(
                    f"Question {index + 1} contains duplicate options"
                )

            if not isinstance(correct, str):
                raise gl.vm.UserError(
                    f"Question {index + 1} correct answer must be a string"
                )

            correct = correct.upper().strip()

            if correct not in {"A", "B", "C", "D"}:
                raise gl.vm.UserError(
                    f"Question {index + 1} has an invalid correct answer"
                )

            if not isinstance(explanation, str):
                raise gl.vm.UserError(
                    f"Question {index + 1} explanation must be a string"
                )

            explanation = explanation.strip()

            if len(explanation) < 10:
                raise gl.vm.UserError(
                    f"Question {index + 1} explanation is too short"
                )

            if len(explanation) > 1000:
                raise gl.vm.UserError(
                    f"Question {index + 1} explanation is too long"
                )

            normalized_questions.append({
                "question": question_text,
                "options": cleaned_options,
                "correct": correct,
                "explanation": explanation,
            })

        normalized_question_texts = [
            item["question"].lower().strip()
            for item in normalized_questions
        ]

        if len(set(normalized_question_texts)) != QUESTIONS_PER_LEVEL:
            raise gl.vm.UserError("AI generated duplicate questions")

        return normalized_questions

    def _validate_answers(self, answers_json: str, question_count: int) -> dict:
        try:
            answers = json.loads(answers_json)
        except Exception:
            raise gl.vm.UserError("Answers must be valid JSON")

        if not isinstance(answers, dict):
            raise gl.vm.UserError("Answers must be a JSON object")

        expected_keys = {str(i) for i in range(question_count)}

        if set(answers.keys()) != expected_keys:
            raise gl.vm.UserError(
                "Answers must contain exactly one answer for every question"
            )

        cleaned = {}

        for index in range(question_count):
            key = str(index)
            answer = answers.get(key)

            if not isinstance(answer, str):
                raise gl.vm.UserError(
                    f"Answer {index + 1} must be a string"
                )

            answer = answer.upper().strip()

            if answer not in {"A", "B", "C", "D"}:
                raise gl.vm.UserError(
                    f"Answer {index + 1} must be A, B, C or D"
                )

            cleaned[key] = answer

        return cleaned

    @gl.public.view
    def get_player(self, address: str) -> str:
        return json.dumps(self._get_player(address.lower().strip()))

    @gl.public.view
    def get_question(self, q_id: str) -> str:
        raw = self.questions.get(q_id, None)

        if raw is None:
            return "NOT_FOUND"

        question = json.loads(raw)

        return json.dumps({
            "id": question["id"],
            "question": question["question"],
            "options": question["options"],
            "level": question["level"],
        })

    @gl.public.view
    def get_quiz_status(self, address: str, level: str) -> str:
        self._validate_level(level)

        player = self._get_player(address.lower().strip())
        key = "quiz_" + level

        if key not in player:
            return json.dumps({"status": "NOT_STARTED"})

        quiz = player[key]

        return json.dumps({
            "status": quiz.get("status", "NOT_STARTED"),
            "q_ids": quiz.get("q_ids", []),
            "answers": quiz.get("answers", {}),
            "score": quiz.get("score", None),
            "results": quiz.get("results", []),
            "xp_earned": quiz.get("xp_earned", 0),
            "passed": quiz.get("passed", False),
            "reward_eligible": quiz.get("reward_eligible", True),
            "practice_retry": quiz.get("practice_retry", False),
            "grounded": quiz.get("grounded", False),
            "source_name": quiz.get("source_name", ""),
            "source_url": quiz.get("source_url", ""),
        })

    @gl.public.view
    def get_total_questions(self) -> str:
        return str(int(self.q_count))

    @gl.public.write
    def set_username(self, username: str) -> None:
        username = username.strip()

        if not username:
            raise gl.vm.UserError("Username required")

        if len(username) > 32:
            raise gl.vm.UserError(
                "Username must be 32 characters or fewer"
            )

        caller = self._addr()
        player = self._get_player(caller)
        player["username"] = username
        self._save_player(caller, player)

    @gl.public.write
    def request_level_quiz(self, level: str) -> None:
        self._validate_level(level)

        caller = self._addr()
        player = self._get_player(caller)

        if int(level) > 1:
            previous_level = str(int(level) - 1)

            if previous_level not in player["levels_completed"]:
                raise gl.vm.UserError(
                    f"Complete Level {previous_level} first"
                )

        quiz_key = "quiz_" + level

        if quiz_key in player:
            existing = player[quiz_key]
            status = existing.get(
                "status",
                "NOT_STARTED",
            )

            if status == "IN_PROGRESS":
                raise gl.vm.UserError(
                    "Quiz already in progress"
                )

            if (
                status == "COMPLETED"
                and existing.get("passed", False)
            ):
                raise gl.vm.UserError(
                    "Level already completed"
                )

            if status == "COMPLETED":
                raise gl.vm.UserError(
                    "Retry the failed quiz before generating another"
                )

        topic = LEVEL_TOPICS[level]
        level_name = LEVEL_NAMES[level]
        now_str = gl.message_raw["datetime"]

        source = ADVANCED_LEVEL_SOURCES.get(
            level,
            None,
        )

        grounded = source is not None

        source_name = (
            source["name"]
            if grounded
            else ""
        )

        source_url = (
            source["url"]
            if grounded
            else ""
        )

        base_n = int(self.q_count)

        q_ids = [
            "q" + str(base_n + i)
            for i in range(
                QUESTIONS_PER_LEVEL
            )
        ]

        self.q_count = u64(
            base_n + QUESTIONS_PER_LEVEL
        )

        def quiz_input() -> str:
            base_context = (
                "LEVEL: "
                + level
                + "\nLEVEL_NAME: "
                + level_name
                + "\nTOPIC: "
                + topic
                + "\nTIMESTAMP: "
                + now_str
                + "\nQUESTION_COUNT: 5"
            )

            # Levels 1-2 use general cybersecurity
            # knowledge and do not require web grounding.
            if not grounded:
                return (
                    base_context
                    + "\nGROUNDING_MODE: GENERAL"
                )

            # Levels 3-8 must use a fixed,
            # authoritative external source.
            response = gl.nondet.web.get(
                source_url
            )

            status = response.status

            if (
                status < 200
                or status >= 300
            ):
                raise gl.vm.UserError(
                    "Authoritative source unavailable"
                )

            if response.body is None:
                raise gl.vm.UserError(
                    "Authoritative source returned no content"
                )

            source_text = (
                response.body
                .decode(
                    "utf-8",
                    errors="ignore",
                )
                .strip()
            )

            if len(source_text) < 100:
                raise gl.vm.UserError(
                    "Authoritative source content insufficient"
                )

            # Keep consensus prompts bounded while
            # preserving enough source material for
            # substantive question generation.
            source_text = source_text[:30000]

            return (
                base_context
                + "\nGROUNDING_MODE: AUTHORITATIVE_SOURCE"
                + "\nSOURCE_NAME: "
                + source_name
                + "\nSOURCE_URL: "
                + source_url
                + "\n\nSOURCE_CONTENT:\n"
                + source_text
            )

        if grounded:
            task = (
                "Create exactly five multiple-choice cybersecurity "
                "training questions for a Web3 learner using ONLY "
                "the authoritative SOURCE_CONTENT supplied in the input.\n\n"

                "The LEVEL, LEVEL_NAME and TOPIC define the intended "
                "subject area and difficulty.\n\n"

                "Every factual claim, correct answer and explanation "
                "must be supported by SOURCE_CONTENT. "
                "Do not use facts that come only from your model memory "
                "or outside knowledge.\n\n"

                "Return ONLY a valid JSON array containing exactly "
                "five objects using this structure:\n"

                '[{"question":"...",'
                '"options":{"A":"...","B":"...","C":"...","D":"..."},'
                '"correct":"A",'
                '"explanation":"..."}, ...]\n\n'

                "Rules:\n"
                "- Exactly five materially different questions.\n"
                "- Every question must be relevant to TOPIC.\n"
                "- Difficulty must match LEVEL and LEVEL_NAME.\n"
                "- Exactly four options: A, B, C and D.\n"
                "- Exactly one option must be factually correct.\n"
                "- Correct answers must be directly supported by SOURCE_CONTENT.\n"
                "- Explanations must be directly supported by SOURCE_CONTENT.\n"
                "- Distractors must be plausible but wrong according to the source.\n"
                "- Do not introduce security claims absent from SOURCE_CONTENT.\n"
                "- Do not use markdown or commentary outside the JSON array."
            )

            criteria = (
                "Judge the proposed quiz strictly against the supplied "
                "SOURCE_CONTENT, LEVEL, LEVEL_NAME and TOPIC.\n\n"

                "Accept ONLY if ALL conditions are satisfied:\n"

                "1. Output is a valid JSON array of exactly five questions.\n"

                "2. Every question contains a question string, options A-D, "
                "one correct option and an explanation.\n"

                "3. Every question is materially relevant to TOPIC.\n"

                "4. Difficulty is appropriate for LEVEL and LEVEL_NAME.\n"

                "5. The five questions are materially different and do not "
                "repeat the same fact with trivial wording changes.\n"

                "6. For every question, exactly one option is correct according "
                "to SOURCE_CONTENT.\n"

                "7. The `correct` field identifies the option actually supported "
                "by SOURCE_CONTENT.\n"

                "8. The explanation is faithful to SOURCE_CONTENT and supports "
                "the marked correct answer.\n"

                "9. Reject any question, answer or explanation that requires "
                "facts not present in SOURCE_CONTENT, even if those facts appear "
                "reasonable from general model knowledge.\n"

                "10. Reject fabricated claims, unsupported security advice, "
                "hallucinated vulnerabilities or invented mitigations.\n"

                "11. Reject ambiguous questions where SOURCE_CONTENT could "
                "reasonably support more than one option.\n"

                "12. The quiz must function as credible cybersecurity training "
                "grounded in the named authoritative source."
            )

        else:
            task = (
                "Create exactly five multiple-choice cybersecurity "
                "training questions for a Web3 learner.\n\n"

                "The LEVEL, LEVEL_NAME and TOPIC in the supplied context "
                "define the required subject matter and difficulty.\n\n"

                "Return ONLY a valid JSON array containing exactly "
                "five objects using this structure:\n"

                '[{"question":"...",'
                '"options":{"A":"...","B":"...","C":"...","D":"..."},'
                '"correct":"A",'
                '"explanation":"..."}, ...]\n\n'

                "Rules:\n"
                "- Every question must test cybersecurity knowledge "
                "relevant to TOPIC.\n"
                "- Difficulty must be appropriate for LEVEL.\n"
                "- All five questions must be materially different.\n"
                "- Each question must have exactly options A-D.\n"
                "- Exactly one option must be clearly correct.\n"
                "- Incorrect options must be plausible but wrong.\n"
                "- Explanations must teach the relevant concept.\n"
                "- Avoid ambiguous or trick questions.\n"
                "- Return only JSON."
            )

            criteria = (
                "Accept only if the proposed beginner quiz contains "
                "exactly five valid, materially different cybersecurity "
                "questions relevant to TOPIC, with appropriate LEVEL "
                "difficulty, exactly four options A-D, one unambiguous "
                "correct answer and a useful accurate explanation."
            )

        raw_result = (
            gl.eq_principle
            .prompt_non_comparative(
                quiz_input,
                task=task,
                criteria=criteria,
            )
        )

        questions = (
            self._validate_generated_questions(
                str(raw_result)
            )
        )

        for index, question in enumerate(
            questions
        ):
            q_id = q_ids[index]

            self.questions[q_id] = json.dumps({
                "id": q_id,
                "question": question["question"],
                "options": question["options"],
                "correct": question["correct"],
                "explanation": question["explanation"],
                "level": level,
                "grounded": grounded,
                "source_name": source_name,
                "source_url": source_url,
            })

        player[quiz_key] = {
            "status": "IN_PROGRESS",
            "q_ids": q_ids,
            "answers": {},
            "score": None,
            "results": [],
            "xp_earned": 0,
            "passed": False,
            "reward_eligible": True,
            "practice_retry": False,
            "started_at": now_str,
            "grounded": grounded,
            "source_name": source_name,
            "source_url": source_url,
        }

        self._save_player(
            caller,
            player,
        )


    @gl.public.write
    def submit_quiz_answers(self, level: str, answers: str) -> None:
        self._validate_level(level)

        caller = self._addr()
        player = self._get_player(caller)
        quiz_key = "quiz_" + level

        if quiz_key not in player:
            raise gl.vm.UserError("No active quiz for this level")

        quiz = player[quiz_key]

        if quiz.get("status") != "IN_PROGRESS":
            raise gl.vm.UserError("No active quiz for this level")

        q_ids = quiz.get("q_ids", [])

        if len(q_ids) != QUESTIONS_PER_LEVEL:
            raise gl.vm.UserError("Quiz state is invalid")

        answers_dict = self._validate_answers(
            answers,
            len(q_ids),
        )

        now_str = gl.message_raw["datetime"]

        results = []
        correct_count = 0

        for index, q_id in enumerate(q_ids):
            raw_question = self.questions.get(
                q_id,
                None,
            )

            if raw_question is None:
                raise gl.vm.UserError(
                    "Quiz question data is missing"
                )

            question = json.loads(raw_question)

            user_answer = answers_dict[str(index)]

            correct_answer = (
                str(question["correct"])
                .upper()
                .strip()
            )

            is_correct = (
                user_answer == correct_answer
            )

            if is_correct:
                correct_count += 1

            results.append({
                "q_id": q_id,
                "question": question["question"],
                "user_answer": user_answer,
                "correct": correct_answer,
                "is_correct": is_correct,
                "explanation": question["explanation"],
            })

        pass_score = LEVEL_PASS_SCORE[level]
        passed = correct_count >= pass_score

        # First attempt is reward-bearing.
        # Once answers have been exposed by a failed attempt,
        # retries are permanently unrewarded practice.
        reward_eligible = quiz.get(
            "reward_eligible",
            True,
        )

        xp_earned = 0

        if passed:
            if reward_eligible:
                base_xp = LEVEL_XP_REWARD[level]

                xp_earned = (
                    correct_count * base_xp
                )

                if (
                    correct_count
                    == QUESTIONS_PER_LEVEL
                ):
                    xp_earned += 100
                    player["streak"] += 1

                    if (
                        player["streak"]
                        > player["best_streak"]
                    ):
                        player["best_streak"] = (
                            player["streak"]
                        )
                else:
                    player["streak"] = 0
            else:
                # Practice retries can prove completion,
                # but never produce rewards or streaks.
                player["streak"] = 0

            if level not in player["levels_completed"]:
                player["levels_completed"].append(
                    level
                )

                next_level = str(
                    int(level) + 1
                )

                if next_level in LEVEL_TOPICS:
                    if (
                        player["level"]
                        < int(next_level)
                    ):
                        player["level"] = int(
                            next_level
                        )

                        # Progression bonus is also disabled
                        # for an unrewarded retry.
                        if reward_eligible:
                            xp_earned += 500

            player["xp"] += xp_earned

        else:
            player["streak"] = 0

            # The results below reveal the answer key.
            # Therefore this quiz can never award XP again.
            reward_eligible = False

        player["total_correct"] += correct_count
        player["total_answered"] += len(q_ids)

        player[quiz_key] = {
            "status": "COMPLETED",
            "q_ids": q_ids,
            "answers": answers_dict,
            "score": correct_count,
            "results": results,
            "xp_earned": xp_earned,
            "passed": passed,
            "completed_at": now_str,
            "reward_eligible": reward_eligible,
            "practice_retry": not reward_eligible,
            "grounded": quiz.get(
                "grounded",
                False,
            ),
            "source_name": quiz.get(
                "source_name",
                "",
            ),
            "source_url": quiz.get(
                "source_url",
                "",
            ),
        }

        self._save_player(
            caller,
            player,
        )

    @gl.public.write
    def retry_quiz(self, level: str) -> None:
        self._validate_level(level)

        caller = self._addr()
        player = self._get_player(caller)
        quiz_key = "quiz_" + level

        if quiz_key not in player:
            raise gl.vm.UserError(
                "No quiz to retry"
            )

        quiz = player[quiz_key]
        status = quiz.get(
            "status",
            "NOT_STARTED",
        )

        if status == "IN_PROGRESS":
            raise gl.vm.UserError(
                "Active quiz must be completed before retry"
            )

        if status != "COMPLETED":
            raise gl.vm.UserError(
                "Quiz is not retryable"
            )

        if quiz.get("passed", False):
            raise gl.vm.UserError(
                "Completed levels cannot be retried for rewards"
            )

        q_ids = quiz.get("q_ids", [])

        if len(q_ids) != QUESTIONS_PER_LEVEL:
            raise gl.vm.UserError(
                "Quiz state is invalid"
            )

        for q_id in q_ids:
            if self.questions.get(
                q_id,
                None,
            ) is None:
                raise gl.vm.UserError(
                    "Quiz question data is missing"
                )

        # A failed attempt has already exposed correct
        # answers and explanations. Reopening this quiz
        # is therefore Practice Mode only.
        player[quiz_key] = {
            "status": "IN_PROGRESS",
            "q_ids": q_ids,
            "answers": {},
            "score": None,
            "results": [],
            "xp_earned": 0,
            "passed": False,
            "reward_eligible": False,
            "practice_retry": True,
            "grounded": quiz.get(
                "grounded",
                False,
            ),
            "source_name": quiz.get(
                "source_name",
                "",
            ),
            "source_url": quiz.get(
                "source_url",
                "",
            ),
        }

        self._save_player(
            caller,
            player,
        )
