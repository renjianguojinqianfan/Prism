from app.schemas import Message
from app.services.heuristic import _is_cjk, _jaccard, _tokenize, analyze


# ---------------------------------------------------------------------------
# 现有用例（保留）
# ---------------------------------------------------------------------------


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


# ---------------------------------------------------------------------------
# _is_cjk
# ---------------------------------------------------------------------------


def test_is_cjk_empty_string():
    assert _is_cjk("") is False


def test_is_cjk_ascii():
    assert _is_cjk("a") is False
    assert _is_cjk("Z") is False
    assert _is_cjk("0") is False


def test_is_cjk_basic_range():
    # 一 = U+4E00（基本区起点）
    assert _is_cjk("一") is True


def test_is_cjk_extension_a():
    # 㐀 = U+3400（扩展 A 区起点）
    assert _is_cjk("㐀") is True


def test_is_cjk_compatibility():
    # 豈 = U+F900（兼容表意文字区起点）
    assert _is_cjk("豈") is True


# ---------------------------------------------------------------------------
# _tokenize
# ---------------------------------------------------------------------------


def test_tokenize_empty():
    assert _tokenize("") == set()


def test_tokenize_english_lowercase_and_min_length():
    # 长度 >=2 保留，小写化；单字符 "a" 被丢弃
    assert _tokenize("Hello a") == {"hello"}


def test_tokenize_english_stopword_filtered():
    # the / a / is 等停用词被剔除，cat 保留
    assert _tokenize("the cat is a dog") == {"cat", "dog"}


def test_tokenize_chinese_bigram():
    # 人工智能 → 人工/工智/智能（2-gram）
    assert _tokenize("人工智能") == {"人工", "工智", "智能"}


def test_tokenize_chinese_single_char_no_bigram():
    # 单个中文字符无法形成 2-gram → 空集
    assert _tokenize("字") == set()


def test_tokenize_chinese_stopword_bigram_filtered():
    # "我们" 作为 bigram 在停用词表中 → 被剔除
    assert _tokenize("我们") == set()


def test_tokenize_mixed_cjk_and_ascii():
    # AI（小写 ai，长度 2）+ 技术（bigram）→ {"ai", "技术"}
    assert _tokenize("AI技术") == {"ai", "技术"}


def test_tokenize_punctuation_separates_tokens():
    # 标点触发 flush，英文/中文分段
    tokens = _tokenize("hello.world")
    assert tokens == {"hello", "world"}


# ---------------------------------------------------------------------------
# _jaccard
# ---------------------------------------------------------------------------


def test_jaccard_both_empty():
    assert _jaccard(set(), set()) == 0.0


def test_jaccard_one_empty():
    assert _jaccard({"a"}, set()) == 0.0
    assert _jaccard(set(), {"a"}) == 0.0


def test_jaccard_identical():
    assert _jaccard({"a", "b"}, {"a", "b"}) == 1.0


def test_jaccard_disjoint():
    assert _jaccard({"a", "b"}, {"c", "d"}) == 0.0


def test_jaccard_partial_intersection():
    # inter={a,b}=2, union={a,b,c,d}=4 → 0.5
    assert _jaccard({"a", "b", "c"}, {"a", "b", "d"}) == 0.5


# ---------------------------------------------------------------------------
# analyze 分支补全
# ---------------------------------------------------------------------------


def test_analyze_three_disjoint_messages_all_divergence():
    # 三条完全不同主题 → 两两 jaccard=0 → avg=0 <= 0.11 → 全部 divergence
    msgs = [
        Message(id="1", modelName="A", content="apple banana cherry"),
        Message(id="2", modelName="B", content="dog elephant fox"),
        Message(id="3", modelName="C", content="guitar harp igloo"),
    ]
    tags = analyze(msgs, "topic")
    assert len(tags) == 3
    assert all(t.label == "divergence" for t in tags)
    assert all(t.score == 0.0 for t in tags)


def test_analyze_neutral_band_between_thresholds():
    # 构造 avg 严格落在 (0.11, 0.14) 之间 → neutral
    # msg1 tokens = {alpha,beta,gamma,delta,epsilon} (5)
    # msg2 tokens = {alpha,zeta,eta,theta,iota} (5)
    # inter={alpha}=1, union=9 → jaccard=1/9≈0.1111，> 0.11 且 < 0.14 → neutral
    msgs = [
        Message(id="1", modelName="A", content="alpha beta gamma delta epsilon"),
        Message(id="2", modelName="B", content="alpha zeta eta theta iota"),
    ]
    tags = analyze(msgs, "topic")
    assert len(tags) == 2
    assert all(t.label == "neutral" for t in tags)
    # score = round(0.1111..., 3) = 0.111
    assert all(t.score == 0.111 for t in tags)


def test_analyze_three_messages_mixed_labels():
    # A/B 完全相同（jaccard=1.0），C 与两者不相交（jaccard=0）
    # avg_A = (1.0 + 0.0)/2 = 0.5 → consensus
    # avg_B = (1.0 + 0.0)/2 = 0.5 → consensus
    # avg_C = (0.0 + 0.0)/2 = 0.0 → divergence
    msgs = [
        Message(id="1", modelName="A", content="apple banana cherry"),
        Message(id="2", modelName="B", content="apple banana cherry"),
        Message(id="3", modelName="C", content="dog elephant fox"),
    ]
    tags = analyze(msgs, "topic")
    assert len(tags) == 3
    by_id = {t.id: t for t in tags}
    assert by_id["1"].label == "consensus"
    assert by_id["1"].score == 0.5
    assert by_id["2"].label == "consensus"
    assert by_id["2"].score == 0.5
    assert by_id["3"].label == "divergence"
    assert by_id["3"].score == 0.0


def test_analyze_evidence_text_for_each_label():
    # 验证 evidence 文案分支：consensus / divergence / neutral
    msgs = [
        Message(id="c", modelName="A", content="apple banana cherry"),
        Message(id="c2", modelName="B", content="apple banana cherry"),
        Message(id="d", modelName="C", content="dog elephant fox"),
        Message(id="n", modelName="D", content="alpha beta gamma delta epsilon"),
    ]
    tags = analyze(msgs, "topic")
    by_id = {t.id: t for t in tags}
    # c 与 c2 完全相同（jaccard=1.0），与 d/n 不相交（jaccard=0）→ avg=1/3≈0.333 → consensus
    assert by_id["c"].label == "consensus"
    assert "重合度" in by_id["c"].evidence
    # d 与其他都不相交 → divergence
    assert by_id["d"].label == "divergence"
    assert "分歧" in by_id["d"].evidence
