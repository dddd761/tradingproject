"""
参数设置 API 路由
"""
import logging
from fastapi import APIRouter

from app.config import load_settings, save_settings
from app.schema.models import SettingsUpdate

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/")
async def get_settings():
    """
    获取当前参数设置
    """
    settings = load_settings()
    # 脱敏处理：不返回完整API Key
    if settings.get("llm", {}).get("api_key"):
        key = settings["llm"]["api_key"]
        settings["llm"]["api_key"] = key[:4] + "****" + key[-4:] if len(key) > 8 else "****"
    return {"code": 0, "data": settings}


@router.put("/")
async def update_settings(updates: SettingsUpdate):
    """
    更新参数设置
    """
    current = load_settings()
    update_dict = updates.model_dump(exclude_none=True)

    for key, value in update_dict.items():
        if isinstance(value, dict) and isinstance(current.get(key), dict):
            current[key].update(value)
        else:
            current[key] = value

    save_settings(current)
    logger.info("Settings updated")
    return {"code": 0, "message": "设置已保存", "data": current}


@router.post("/reset")
async def reset_settings():
    """
    重置为默认参数
    """
    from app.config import DEFAULT_SETTINGS
    save_settings(DEFAULT_SETTINGS)
    return {"code": 0, "message": "已重置为默认设置", "data": DEFAULT_SETTINGS}
