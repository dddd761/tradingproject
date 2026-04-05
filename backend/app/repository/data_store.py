"""
数据存储层 - JSON文件存储
负责另类数据和缓存的读写操作
"""
import json
import uuid
import logging
from pathlib import Path
from typing import Optional

from app.config import ALTERNATIVE_DATA_DIR, CACHE_DIR

logger = logging.getLogger(__name__)


class DataStore:
    """
    基于JSON文件的轻量级数据存储
    每只股票的另类数据存储在独立文件中
    """

    @staticmethod
    def _get_stock_file(stock_code: str) -> Path:
        """获取指定股票的数据文件路径"""
        return ALTERNATIVE_DATA_DIR / f"{stock_code}.json"

    @staticmethod
    def _get_cache_file(stock_code: str, start_date: str, end_date: str) -> Path:
        """获取K线缓存文件路径"""
        return CACHE_DIR / f"{stock_code}_{start_date}_{end_date}.json"

    def load_alternative_data(self, stock_code: str) -> list[dict]:
        """
        加载指定股票的所有另类数据
        """
        file_path = self._get_stock_file(stock_code)
        if not file_path.exists():
            return []
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            logger.error(f"Failed to load data for {stock_code}: {e}")
            return []

    def save_alternative_data(self, stock_code: str, data: list[dict]) -> None:
        """
        保存另类数据到文件
        """
        file_path = self._get_stock_file(stock_code)
        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        logger.info(f"Saved {len(data)} items for stock {stock_code}")

    def add_alternative_data(self, stock_code: str, items: list[dict]) -> list[dict]:
        """
        追加另类数据，自动生成ID
        """
        existing = self.load_alternative_data(stock_code)
        for item in items:
            if not item.get("id"):
                item["id"] = str(uuid.uuid4())[:8]
            existing.append(item)
        self.save_alternative_data(stock_code, existing)
        return existing

    def delete_alternative_data(self, stock_code: str, item_id: str) -> bool:
        """
        删除指定ID的另类数据
        """
        data = self.load_alternative_data(stock_code)
        original_len = len(data)
        data = [d for d in data if d.get("id") != item_id]
        if len(data) < original_len:
            self.save_alternative_data(stock_code, data)
            return True
        return False

    def update_alternative_data(self, stock_code: str, item_id: str, updates: dict) -> Optional[dict]:
        """
        更新指定ID的另类数据
        """
        data = self.load_alternative_data(stock_code)
        for item in data:
            if item.get("id") == item_id:
                item.update(updates)
                item["id"] = item_id  # 防止ID被覆盖
                self.save_alternative_data(stock_code, data)
                return item
        return None

    def save_kline_cache(self, stock_code: str, start_date: str, end_date: str, kline_data: list[dict]) -> None:
        """
        缓存K线数据，避免重复请求
        """
        file_path = self._get_cache_file(stock_code, start_date, end_date)
        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(kline_data, f, ensure_ascii=False)

    def load_kline_cache(self, stock_code: str, start_date: str, end_date: str) -> Optional[list[dict]]:
        """
        加载K线缓存
        """
        file_path = self._get_cache_file(stock_code, start_date, end_date)
        if not file_path.exists():
            return None
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return None

    def get_all_stock_codes(self) -> list[str]:
        """
        获取所有有另类数据的股票代码
        """
        codes = []
        for file in ALTERNATIVE_DATA_DIR.glob("*.json"):
            codes.append(file.stem)
        return codes


# 全局单例
data_store = DataStore()
