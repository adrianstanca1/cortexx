import json
import urllib.request
import os

def ping_local_llm(prompt):
    url = "http://127.0.0.1:11434/api/generate"
    payload = {
        "model": "qwen2.5-coder:7b",
        "prompt": prompt,
        "stream": False
    }
    req = urllib.request.Request(url, data=json.dumps(payload).encode('utf-8'), headers={'Content-Type': 'application/json'})
    try:
        response = urllib.request.urlopen(req)
        return json.loads(response.read().decode('utf-8'))['response']
    except Exception as e:
        return f"Error: {e}"

if __name__ == "__main__":
    print("Testing Local LLM Swarm Endpoint...")
    result = ping_local_llm("Write a 1-line bash script to print 'Local Swarm Active'.")
    print(result)
