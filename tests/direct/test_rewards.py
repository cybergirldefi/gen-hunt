import json


QUESTIONS = [
    {
        "id": "q0",
        "question": "Question one about security?",
        "options": {"A": "Wrong", "B": "Correct", "C": "Wrong C", "D": "Wrong D"},
        "correct": "B",
        "explanation": "B is the correct security answer.",
        "level": "1",
    },
    {
        "id": "q1",
        "question": "Question two about security?",
        "options": {"A": "Correct", "B": "Wrong", "C": "Wrong C", "D": "Wrong D"},
        "correct": "A",
        "explanation": "A is the correct security answer.",
        "level": "1",
    },
    {
        "id": "q2",
        "question": "Question three about security?",
        "options": {"A": "Wrong", "B": "Wrong B", "C": "Correct", "D": "Wrong D"},
        "correct": "C",
        "explanation": "C is the correct security answer.",
        "level": "1",
    },
    {
        "id": "q3",
        "question": "Question four about security?",
        "options": {"A": "Wrong", "B": "Correct", "C": "Wrong C", "D": "Wrong D"},
        "correct": "B",
        "explanation": "B is the correct security answer.",
        "level": "1",
    },
    {
        "id": "q4",
        "question": "Question five about security?",
        "options": {"A": "Wrong", "B": "Wrong B", "C": "Correct", "D": "Wrong D"},
        "correct": "C",
        "explanation": "C is the correct security answer.",
        "level": "1",
    },
]


def deploy(direct_deploy):
    return direct_deploy("contracts/gen_hunt.py")


def addr(address):
    return "0x" + bytes(address).hex()


def get_player(contract, address):
    return json.loads(contract.get_player(addr(address)))


def get_status(contract, address, level="1"):
    return json.loads(contract.get_quiz_status(addr(address), level))


def seed_quiz(contract, address, level="1"):
    address = addr(address)

    q_ids = []

    for i, q in enumerate(QUESTIONS):
        qid = f"q{i}"
        qcopy = dict(q)
        qcopy["id"] = qid
        qcopy["level"] = level

        contract.questions[qid] = json.dumps(qcopy)
        q_ids.append(qid)

    player = contract._get_player(address)

    player["quiz_" + level] = {
        "status": "IN_PROGRESS",
        "q_ids": q_ids,
        "answers": {},
        "score": None,
        "results": [],
        "xp_earned": 0,
        "passed": False,
    }

    contract._save_player(address, player)


def perfect_answers():
    return json.dumps({
        "0": "B",
        "1": "A",
        "2": "C",
        "3": "B",
        "4": "C",
    })


def four_correct_answers():
    return json.dumps({
        "0": "B",
        "1": "A",
        "2": "C",
        "3": "B",
        "4": "A",
    })


def failing_answers():
    return json.dumps({
        "0": "A",
        "1": "B",
        "2": "A",
        "3": "A",
        "4": "A",
    })


def test_four_correct_passes_and_unlocks_level_two(
    direct_vm,
    direct_deploy,
    direct_alice,
):
    contract = deploy(direct_deploy)
    direct_vm.sender = direct_alice

    seed_quiz(contract, direct_alice)

    contract.submit_quiz_answers(
        "1",
        four_correct_answers(),
    )

    player = get_player(contract, direct_alice)
    status = get_status(contract, direct_alice)

    assert status["status"] == "COMPLETED"
    assert status["score"] == 4
    assert status["passed"] is True

    assert player["level"] == 2
    assert "1" in player["levels_completed"]

    # 4 x 100 + 500 progression reward
    assert player["xp"] == 900
    assert status["xp_earned"] == 900


def test_perfect_score_rewards_once(
    direct_vm,
    direct_deploy,
    direct_alice,
):
    contract = deploy(direct_deploy)
    direct_vm.sender = direct_alice

    seed_quiz(contract, direct_alice)

    contract.submit_quiz_answers(
        "1",
        perfect_answers(),
    )

    player = get_player(contract, direct_alice)

    # 5 x 100 + 100 perfect + 500 progression
    assert player["xp"] == 1100
    assert player["streak"] == 1
    assert player["best_streak"] == 1


def test_failed_quiz_gives_zero_xp(
    direct_vm,
    direct_deploy,
    direct_alice,
):
    contract = deploy(direct_deploy)
    direct_vm.sender = direct_alice

    seed_quiz(contract, direct_alice)

    contract.submit_quiz_answers(
        "1",
        failing_answers(),
    )

    player = get_player(contract, direct_alice)
    status = get_status(contract, direct_alice)

    assert status["passed"] is False
    assert status["xp_earned"] == 0
    assert player["xp"] == 0
    assert player["level"] == 1
    assert player["levels_completed"] == []


def test_failed_quiz_can_retry(
    direct_vm,
    direct_deploy,
    direct_alice,
):
    contract = deploy(direct_deploy)
    direct_vm.sender = direct_alice

    seed_quiz(contract, direct_alice)

    contract.submit_quiz_answers(
        "1",
        failing_answers(),
    )

    contract.retry_quiz("1")

    status = get_status(contract, direct_alice)

    assert status["status"] == "NOT_STARTED"

    player = get_player(contract, direct_alice)
    assert player["xp"] == 0


def test_passed_quiz_cannot_retry(
    direct_vm,
    direct_deploy,
    direct_alice,
):
    contract = deploy(direct_deploy)
    direct_vm.sender = direct_alice

    seed_quiz(contract, direct_alice)

    contract.submit_quiz_answers(
        "1",
        perfect_answers(),
    )

    with direct_vm.expect_revert(
        "Completed levels cannot be retried for rewards"
    ):
        contract.retry_quiz("1")


def test_cannot_submit_completed_quiz_twice(
    direct_vm,
    direct_deploy,
    direct_alice,
):
    contract = deploy(direct_deploy)
    direct_vm.sender = direct_alice

    seed_quiz(contract, direct_alice)

    contract.submit_quiz_answers(
        "1",
        perfect_answers(),
    )

    xp_before = get_player(
        contract,
        direct_alice,
    )["xp"]

    with direct_vm.expect_revert(
        "No active quiz for this level"
    ):
        contract.submit_quiz_answers(
            "1",
            perfect_answers(),
        )

    assert (
        get_player(contract, direct_alice)["xp"]
        == xp_before
    )


def test_bob_cannot_change_alice_progress(
    direct_vm,
    direct_deploy,
    direct_alice,
    direct_bob,
):
    contract = deploy(direct_deploy)

    direct_vm.sender = direct_alice
    seed_quiz(contract, direct_alice)

    direct_vm.sender = direct_bob

    with direct_vm.expect_revert(
        "No active quiz for this level"
    ):
        contract.submit_quiz_answers(
            "1",
            perfect_answers(),
        )

    alice = get_player(contract, direct_alice)
    bob = get_player(contract, direct_bob)

    assert alice["xp"] == 0
    assert bob["xp"] == 0


def test_missing_question_aborts_scoring(
    direct_vm,
    direct_deploy,
    direct_alice,
):
    contract = deploy(direct_deploy)
    direct_vm.sender = direct_alice

    seed_quiz(contract, direct_alice)

    del contract.questions["q2"]

    with direct_vm.expect_revert(
        "Quiz question data is missing"
    ):
        contract.submit_quiz_answers(
            "1",
            perfect_answers(),
        )

    player = get_player(contract, direct_alice)

    assert player["xp"] == 0
    assert player["levels_completed"] == []


def test_failed_retry_loop_cannot_farm_xp(
    direct_vm,
    direct_deploy,
    direct_alice,
):
    contract = deploy(direct_deploy)
    direct_vm.sender = direct_alice

    for _ in range(3):
        seed_quiz(contract, direct_alice)

        contract.submit_quiz_answers(
            "1",
            failing_answers(),
        )

        contract.retry_quiz("1")

    player = get_player(contract, direct_alice)

    assert player["xp"] == 0
    assert player["level"] == 1
    assert player["levels_completed"] == []


def test_pass_reward_cannot_be_claimed_twice(
    direct_vm,
    direct_deploy,
    direct_alice,
):
    contract = deploy(direct_deploy)
    direct_vm.sender = direct_alice

    seed_quiz(contract, direct_alice)

    contract.submit_quiz_answers(
        "1",
        perfect_answers(),
    )

    first_xp = get_player(
        contract,
        direct_alice,
    )["xp"]

    assert first_xp == 1100

    with direct_vm.expect_revert(
        "Completed levels cannot be retried for rewards"
    ):
        contract.retry_quiz("1")

    assert (
        get_player(contract, direct_alice)["xp"]
        == 1100
    )
