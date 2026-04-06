"""
另类数据管理 API 路由
"""
import logging
import json
import csv
import io
from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from typing import Optional

from app.repository.data_store import data_store
from app.schema.models import AlternativeDataItem

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/{stock_code}")
async def get_alternative_data(stock_code: str):
    """
    获取指定股票的所有另类数据
    """
    data = data_store.load_alternative_data(stock_code)
    return {"code": 0, "data": data, "total": len(data)}


@router.post("/import")
async def import_alternative_data(
    stock_code: str = Form(...),
    file: UploadFile = File(...),
):
    """
    导入另类数据文件（支持CSV和JSON格式）
    CSV格式要求列: date, title, content, source, category, impact_level
    """
    try:
        content = await file.read()
        filename = (file.filename or "unknown").lower()

        items = []
        if filename.endswith(".json"):
            try:
                text = content.decode("utf-8-sig")
                raw_items = json.loads(text)
                if isinstance(raw_items, dict):
                    raw_items = raw_items.get("items", raw_items.get("data", [raw_items]))
                for item in raw_items:
                    item["stock_code"] = stock_code
                    items.append(item)
            except UnicodeDecodeError:
                 raise HTTPException(status_code=400, detail="JSON文件编码错误，请使用 UTF-8 编码")

        elif filename.endswith(".xlsx") or filename.endswith(".xls"):
            import pandas as pd
            try:
                df = pd.read_excel(io.BytesIO(content))
                mapping = {
                    "证据时间": "date", "发布时间": "date", "时间": "date",
                    "来源文章": "title", "标题": "title",
                    "证据文本": "content", "内容摘要": "content", "正文": "content", "内容": "content",
                    "来源站点": "source", "来源渠道": "source",
                    "证据类型": "category", "分类": "category"
                }
                
                for _, row in df.iterrows():
                    get_val = lambda target, default: row.get(next((k for k, v in mapping.items() if v == target and k in df.columns), target), default)
                    items.append({
                        "stock_code": stock_code,
                        "date": str(get_val("date", "")),
                        "title": str(get_val("title", "")),
                        "content": str(get_val("content", "")),
                        "source": str(get_val("source", "导入")),
                        "category": str(get_val("category", "新闻")),
                        "impact_level": None,
                    })
            except Exception as e:
                logger.error(f"Excel parse error: {e}")
                raise HTTPException(status_code=400, detail=f"Excel解析失败: 请确保文件未加密且格式正确 ({str(e)})")

        elif filename.endswith(".csv"):
            try:
                text = content.decode("utf-8-sig")
                reader = csv.DictReader(io.StringIO(text))
                for row in reader:
                    items.append({
                        "stock_code": stock_code,
                        "date": row.get("date", ""),
                        "title": row.get("title", ""),
                        "content": row.get("content", ""),
                        "source": row.get("source", "导入"),
                        "category": row.get("category", "新闻"),
                        "impact_level": row.get("impact_level"),
                    })
            except UnicodeDecodeError:
                raise HTTPException(status_code=400, detail="CSV文件编码错误，请尝试另存为 UTF-8 (带BOM) 格式")
        else:
            raise HTTPException(status_code=400, detail=f"不支持的文件格式: {filename}。仅支持 CSV, XLSX 和 JSON")

        if not items:
            raise HTTPException(status_code=400, detail="文件中未找到有效数据，请检查列名是否匹配")

        result = data_store.add_alternative_data(stock_code, items)
        return {
            "code": 0,
            "message": f"成功导入 {len(items)} 条数据",
            "total": len(result),
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Global import error: {e}")
        raise HTTPException(status_code=500, detail=f"导入系统崩溃: {str(e)}")


@router.post("/add")
async def add_single_data(item: AlternativeDataItem):
    """
    手动添加单条另类数据
    """
    data_dict = item.model_dump()
    result = data_store.add_alternative_data(item.stock_code, [data_dict])
    return {"code": 0, "message": "添加成功", "total": len(result)}


@router.delete("/{stock_code}/{item_id}")
async def delete_alternative_data(stock_code: str, item_id: str):
    """
    删除指定的另类数据
    """
    success = data_store.delete_alternative_data(stock_code, item_id)
    if success:
        return {"code": 0, "message": "删除成功"}
    raise HTTPException(status_code=404, detail="数据不存在")


@router.put("/{stock_code}/{item_id}")
async def update_alternative_data(stock_code: str, item_id: str, updates: dict):
    """
    更新指定的另类数据
    """
    result = data_store.update_alternative_data(stock_code, item_id, updates)
    if result:
        return {"code": 0, "data": result, "message": "更新成功"}
    raise HTTPException(status_code=404, detail="数据不存在")


@router.get("/template/csv")
async def download_csv_template():
    """
    下载CSV导入模板
    """
    return {
        "code": 0,
        "template": "date,title,content,source,category,impact_level\n2024-01-15,示例标题,示例新闻内容...,新浪财经,新闻,3",
        "columns": {
            "date": "日期（YYYY-MM-DD）",
            "title": "新闻标题",
            "content": "新闻正文",
            "source": "来源（可选）",
            "category": "分类：新闻/政策/公告/其他（可选）",
            "impact_level": "影响等级1-5（可选）",
        },
    }
