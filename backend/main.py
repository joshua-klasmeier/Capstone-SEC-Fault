from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI(title="SEC Fault API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Unsure how exactly logging in works with Google. Below request might need changed
class LoginRequest(BaseModel):
    id_token: str

class SignoutRequest(BaseModel):
    userId: int

class NewChatRequest(BaseModel):
    name: str

class NewMsgRequest(BaseModel):
    message: str


@app.get("/health")
def health():
    return {"status": "ok"}

@app.post("/login")
def login(req: LoginRequest):
    return {"login_info": "This is a placeholder response from SEC Fault API."}

@app.post("/signout")
def signout(req: SignoutRequest):
    return {"signout_info": "This is a placeholder response from SEC Fault API."}

@app.post("/chats")
def newChat(req: NewChatRequest):
    return {"chat_info": "This is a placeholder response from SEC Fault API."}

@app.get("/chats/{id}")
def getChat(id: int):
    return {"chat_and_msg_info": "This is a placeholder response from SEC Fault API."}

@app.post("/chats/{id}/messages")
def msg(id: int, req: NewMsgRequest):
    return {"msg_reply": "This is a placeholder response from SEC Fault API."}
