# 使用轻量级 Python 镜像
FROM python:3.10-slim

# 设置工作目录
WORKDIR /app

# 安装必要的系统库（针对 akshare 和时序模型）
RUN apt-get update && apt-get install -y \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

# 复制依赖文件
COPY requirements.txt .

# 安装 Python 依赖
RUN pip install --no-cache-dir -r requirements.txt

# 复制后端代码
COPY . .

# 创建数据目录并给予权限
RUN mkdir -p data && chmod 777 data

# 暴露端口 (Hugging Face 使用 7860，Render 使用 $PORT)
EXPOSE 7860 10000

# 运行 FastAPI
# 使用 sh -c 动态读取 $PORT 环境变量，默认为 7860
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-7860}"]
