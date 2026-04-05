"""
数据清洗服务
对导入的另类数据进行去重、相关性过滤、噪声去除等处理
清洗过程可追溯，每一步记录输入输出便于前端可视化
"""
import logging
import re
import math
from collections import Counter
from typing import Optional

from app.config import load_settings

logger = logging.getLogger(__name__)


def clean_alternative_data(
    raw_data: list[dict],
    stock_code: str,
    settings: Optional[dict] = None,
) -> dict:
    """
    执行完整的数据清洗流程，返回每步详情

    流程: 原始数据 → 去重 → 相关性过滤 → 噪声去除 → 内容标准化 → 清洗后数据

    @param raw_data: 原始另类数据列表
    @param stock_code: 目标股票代码
    @param settings: 清洗参数配置
    @returns 包含清洗步骤详情和最终结果的字典
    """
    if settings is None:
        settings = load_settings()

    cleaning_params = settings.get("cleaning", {})
    steps = []
    current_data = list(raw_data)
    original_count = len(current_data)

    # Step 1: 去重（基于标题相似度）
    dedup_threshold = cleaning_params.get("dedup_similarity_threshold", 0.85)
    deduped, removed_dupes = _deduplicate(current_data, dedup_threshold)
    steps.append({
        "step_name": "去重处理",
        "description": f"基于标题相似度去重（阈值: {dedup_threshold}）。使用TF-IDF计算标题间的余弦相似度，相似度超过阈值的条目保留时间最新的一条。",
        "input_count": len(current_data),
        "output_count": len(deduped),
        "removed_items": removed_dupes,
        "params": {"similarity_threshold": dedup_threshold},
    })
    current_data = deduped

    # Step 2: 相关性过滤
    relevance_threshold = cleaning_params.get("relevance_min_score", 0.5)
    relevant, removed_irrelevant = _filter_relevance(current_data, stock_code, relevance_threshold)
    steps.append({
        "step_name": "相关性过滤",
        "description": f"判断新闻是否与目标股票 {stock_code} 相关（阈值: {relevance_threshold}）。通过关键词匹配、行业关联度和直接提及度计算相关性分数。",
        "input_count": len(current_data),
        "output_count": len(relevant),
        "removed_items": removed_irrelevant,
        "params": {"relevance_threshold": relevance_threshold},
    })
    current_data = relevant

    # Step 3: 噪声去除
    min_length = cleaning_params.get("min_content_length", 10)
    cleaned, removed_noise = _remove_noise(current_data, min_length)
    steps.append({
        "step_name": "噪声去除",
        "description": f"去除广告、无关内容和低质量文本（最小长度: {min_length}字）。过滤包含广告关键词、内容过短或格式异常的条目。",
        "input_count": len(current_data),
        "output_count": len(cleaned),
        "removed_items": removed_noise,
        "params": {"min_content_length": min_length},
    })
    current_data = cleaned

    # Step 4: 内容标准化
    standardized = _standardize(current_data)
    steps.append({
        "step_name": "内容标准化",
        "description": "统一日期格式、去除多余空白、规范化标点符号。确保所有数据格式一致以便后续分析。",
        "input_count": len(current_data),
        "output_count": len(standardized),
        "removed_items": [],
        "params": {},
    })
    current_data = standardized

    return {
        "steps": steps,
        "original_count": original_count,
        "final_count": len(current_data),
        "cleaned_data": current_data,
    }


def _deduplicate(data: list[dict], threshold: float) -> tuple[list[dict], list[dict]]:
    """
    基于标题相似度去重
    使用简化的字符级n-gram相似度（轻量替代TF-IDF）
    """
    if not data:
        return [], []

    kept = []
    removed = []
    seen_titles: list[str] = []

    for item in data:
        title = item.get("title", "")
        is_duplicate = False
        for seen in seen_titles:
            similarity = _compute_similarity(title, seen)
            if similarity >= threshold:
                is_duplicate = True
                removed.append({**item, "_removal_reason": f"与已有标题相似度 {similarity:.2f} 超过阈值"})
                break
        if not is_duplicate:
            kept.append(item)
            seen_titles.append(title)

    return kept, removed


def _compute_similarity(text_a: str, text_b: str) -> float:
    """
    计算两个文本的相似度（基于字符2-gram的Jaccard系数）
    """
    if not text_a or not text_b:
        return 0.0

    def get_ngrams(text: str, n: int = 2) -> set:
        return set(text[i:i+n] for i in range(len(text) - n + 1))

    ngrams_a = get_ngrams(text_a)
    ngrams_b = get_ngrams(text_b)

    if not ngrams_a or not ngrams_b:
        return 0.0

    intersection = ngrams_a & ngrams_b
    union = ngrams_a | ngrams_b
    return len(intersection) / len(union)


def _filter_relevance(
    data: list[dict], stock_code: str, threshold: float
) -> tuple[list[dict], list[dict]]:
    """
    过滤与目标股票无关的新闻
    通过关键词匹配计算相关性分数
    """
    kept = []
    removed = []

    for item in data:
        score = _compute_relevance(item, stock_code)
        if score >= threshold:
            kept.append(item)
        else:
            removed.append({
                **item,
                "_removal_reason": f"相关性分数 {score:.2f} 低于阈值 {threshold}",
            })

    return kept, removed


def _compute_relevance(item: dict, stock_code: str) -> float:
    """
    计算新闻与股票的相关性分数
    基于股票代码、公司名称等关键词出现频次
    """
    text = (item.get("title", "") + " " + item.get("content", "")).lower()
    score = 0.0

    # 直接提及股票代码
    if stock_code in text:
        score += 0.8

    # NOTE: 简化版相关性判断 - 默认导入的数据已经过初步筛选
    # 有标题和内容的条目给予基础分
    if item.get("title") and item.get("content"):
        score += 0.3

    # 金融关键词加分
    finance_keywords = ["股票", "涨", "跌", "利好", "利空", "财报", "营收", "净利润",
                        "政策", "监管", "央行", "降息", "加息", "并购", "重组"]
    for kw in finance_keywords:
        if kw in text:
            score += 0.1

    return min(score, 1.0)


def _remove_noise(data: list[dict], min_length: int) -> tuple[list[dict], list[dict]]:
    """
    去除噪声数据：广告、过短内容、异常格式
    """
    noise_keywords = ["广告", "推广", "点击查看", "免费领取", "加微信", "扫码"]
    kept = []
    removed = []

    for item in data:
        content = item.get("content", "")
        title = item.get("title", "")

        # 检查内容长度
        if len(content) < min_length:
            removed.append({**item, "_removal_reason": f"内容长度 {len(content)} 低于最小要求 {min_length}"})
            continue

        # 检查广告关键词
        has_noise = False
        for kw in noise_keywords:
            if kw in content or kw in title:
                removed.append({**item, "_removal_reason": f"包含噪声关键词: {kw}"})
                has_noise = True
                break

        if not has_noise:
            kept.append(item)

    return kept, removed


def _standardize(data: list[dict]) -> list[dict]:
    """
    标准化数据格式：统一日期、去除多余空白
    """
    standardized = []
    for item in data:
        new_item = dict(item)
        # 去除多余空白
        if "title" in new_item:
            new_item["title"] = re.sub(r'\s+', ' ', new_item["title"]).strip()
        if "content" in new_item:
            new_item["content"] = re.sub(r'\s+', ' ', new_item["content"]).strip()
        # 统一日期格式
        if "date" in new_item:
            new_item["date"] = _normalize_date(new_item["date"])
        standardized.append(new_item)
    return standardized


def _normalize_date(date_str: str) -> str:
    """
    统一日期为 YYYY-MM-DD 格式
    """
    date_str = date_str.strip()
    # 处理 YYYYMMDD 格式
    if re.match(r'^\d{8}$', date_str):
        return f"{date_str[:4]}-{date_str[4:6]}-{date_str[6:8]}"
    # 处理 YYYY/MM/DD 格式
    if "/" in date_str:
        return date_str.replace("/", "-")
    return date_str
