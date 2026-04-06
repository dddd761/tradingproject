"""
全局配置模块
所有可调参数集中管理，支持运行时修改
"""
import os
import json
import logging
from pathlib import Path

logger = logging.getLogger(__name__)

# 项目根目录
BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
ALTERNATIVE_DATA_DIR = DATA_DIR / "alternative"
CACHE_DIR = DATA_DIR / "cache"
SETTINGS_FILE = DATA_DIR / "settings.json"

# 确保数据目录存在
ALTERNATIVE_DATA_DIR.mkdir(parents=True, exist_ok=True)
CACHE_DIR.mkdir(parents=True, exist_ok=True)

# 默认参数配置
DEFAULT_SETTINGS = {
    # 模型权重（四模型加权融合）
    "model_weights": {
        "finbert": 0.4,
        "arima": 0.2,
        "garch": 0.2,
        "lstm": 0.2,
    },
    # 对数衰减参数: score(t) = score_0 * max(0, 1 - alpha * ln(1 + t))
    "decay_alpha": 0.3,
    # 共振系数: resonance = 1 + beta * ln(n)
    "resonance_beta": 0.5,
    # 交易参数
    "trade": {
        "buy_threshold": 0.15,
        "sell_threshold": -0.15,
        "daily_position_ratio": 0.1,
        "initial_capital": 1000000,
        "commission_rate": 0.0003,
        "slippage": 0.001,
    },
    # 数据清洗参数
    "cleaning": {
        "dedup_similarity_threshold": 0.85,
        "relevance_min_score": 0.5,
        "min_content_length": 10,
    },
    # LLM 配置（预留接口）
    "llm": {
        "provider": "none",
        "api_key": "",
        "model_name": "",
        "base_url": "",
    },
}


def load_settings() -> dict:
    """
    加载设置，优先从文件读取，不存在则使用默认值
    """
    if SETTINGS_FILE.exists():
        try:
            with open(SETTINGS_FILE, "r", encoding="utf-8") as f:
                saved = json.load(f)
            # NOTE: 合并默认值，防止新增字段丢失
            merged = _deep_merge(DEFAULT_SETTINGS, saved)
            return merged
        except Exception as e:
            logger.warning(f"Failed to load settings file: {e}, using defaults")
    return DEFAULT_SETTINGS.copy()


def save_settings(settings: dict) -> None:
    """
    持久化保存设置到JSON文件
    """
    with open(SETTINGS_FILE, "w", encoding="utf-8") as f:
        json.dump(settings, f, ensure_ascii=False, indent=2)
    logger.info("Settings saved successfully")


def _deep_merge(base: dict, override: dict) -> dict:
    """
    深度合并两个字典，override覆盖base中的同名键
    """
    result = base.copy()
    for key, value in override.items():
        if key in result and isinstance(result[key], dict) and isinstance(value, dict):
            result[key] = _deep_merge(result[key], value)
        else:
            result[key] = value
    return result
