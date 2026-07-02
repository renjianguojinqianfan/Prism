from app.schemas import Message
from app.services.heuristic import analyze


def test_analyze_empty_messages():
    assert analyze([], "topic") == []


def test_analyze_single_message_returns_neutral():
    msgs = [Message(id="1", modelName="A", content="hello world")]
    tags = analyze(msgs, "topic")
    assert len(tags) == 1
    assert tags[0].label == "neutral"
    assert tags[0].score == 0.0


def test_analyze_two_similar_messages_consensus():
    # 两条内容共享大量 bigram（人工/工智/智能/能改/改变），Jaccard 应 >= 0.14 → consensus
    msgs = [
        Message(id="1", modelName="A", content="人工智能改变世界"),
        Message(id="2", modelName="B", content="人工智能改变未来"),
    ]
    tags = analyze(msgs, "topic")
    assert len(tags) == 2
    assert all(t.label == "consensus" for t in tags)
