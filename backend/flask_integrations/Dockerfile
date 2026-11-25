FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 WEBHOOK_DATABASE_PATH=/data/webhooks.sqlite3
WORKDIR /service
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt && useradd --create-home service && mkdir /data && chown service:service /data
COPY app ./app
USER service
EXPOSE 8002
CMD ["gunicorn", "--bind", "0.0.0.0:8002", "--workers", "2", "--timeout", "30", "app:create_app()"]
