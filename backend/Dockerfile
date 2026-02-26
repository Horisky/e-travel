FROM python:3.10-slim

WORKDIR /app

COPY requirements.txt requirements.txt
RUN python -m pip install --upgrade pip
RUN pip3 install -r requirements.txt

COPY . .

EXPOSE 8080
ENTRYPOINT ["sh", "-c", "uvicorn asgi:app --host 0.0.0.0 --port 8080"]
