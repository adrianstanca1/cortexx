import base64

pwd = base64.b64decode(b"Q3VtcGFyYXZpbmRlMTIlNDA=").decode()
content = (
    'DATABASE_URL="postgresql://postgres:'
    + pwd
    + '@localhost:5432/cortexx?schema=public"\n'
)
with open("/root/cortexx/.env", "w") as f:
    f.write(content)
