from flask import Flask, request, jsonify
from flask_cors import CORS
from models import db, Session, Message
from config import Config
from groq import Groq
import uuid

app = Flask(__name__)
app.config.from_object(Config)
CORS(app)
db.init_app(app)

client = Groq(api_key=app.config['GROQ_API_KEY'])

SOFT_LIMIT = 20

SYSTEM_PROMPT = """You are a collaborative full-stack developer assistant.
- Generate clean, production-ready HTML, CSS, JavaScript and backend scaffolding.
- When given broken code, debug it surgically — preserve what works, only fix what's broken.
- Follow the user's instructions step by step, refining iteratively.
- Ask clarifying questions before making large structural changes.
- Never start from scratch unless the user explicitly asks.
"""

def check_limit(edit_count):
    if edit_count >= SOFT_LIMIT:
        return "pause"
    elif edit_count >= SOFT_LIMIT - 2:
        return "warning"
    return "ok"

@app.route('/chat', methods=['POST'])
def chat():
    data = request.get_json()
    user_message = data.get('message')
    session_id = data.get('session_id')
    is_debug = data.get('is_debug', False)
    broken_code = data.get('broken_code', '')
    error_info = data.get('error_info', '')

    if not session_id:
        session_id = str(uuid.uuid4())

    session = Session.query.get(session_id)
    if not session:
        session = Session(id=session_id)
        db.session.add(session)
        db.session.commit()

    limit_status = check_limit(session.edit_count)
    if limit_status == "pause":
        return jsonify({
            'reply': 'You have reached the session edit limit. Start a new session to continue.',
            'session_id': session_id,
            'limit_status': limit_status
        })

    if is_debug and broken_code:
        user_message = f"""The user has pasted back code with issues.
Error/bug: {error_info}
Their instruction: {user_message}

Broken code:
{broken_code}

Debug and fix intelligently. Do NOT rewrite from scratch unless absolutely necessary.
Preserve all working sections. Only modify what is broken."""

    new_message = Message(session_id=session_id, role='user', content=user_message)
    db.session.add(new_message)
    db.session.commit()

    history = Message.query.filter_by(session_id=session_id).order_by(Message.created_at).all()
    messages = [{"role": m.role, "content": m.content} for m in history]

    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[{"role": "system", "content": SYSTEM_PROMPT}] + messages,
        max_tokens=4096
    )

    reply = response.choices[0].message.content

    assistant_message = Message(session_id=session_id, role='assistant', content=reply)
    db.session.add(assistant_message)

    session.edit_count += 1
    db.session.commit()

    return jsonify({
        'reply': reply,
        'session_id': session_id,
        'edit_count': session.edit_count,
        'limit_status': check_limit(session.edit_count)
    })

@app.route('/new-session', methods=['POST'])
def new_session():
    session_id = str(uuid.uuid4())
    session = Session(id=session_id)
    db.session.add(session)
    db.session.commit()
    return jsonify({'session_id': session_id})

@app.route('/history/<session_id>', methods=['GET'])
def get_history(session_id):
    session = Session.query.get(session_id)
    if not session:
        return jsonify({'error': 'Session not found'}), 404
    history = Message.query.filter_by(session_id=session_id).order_by(Message.created_at).all()
    return jsonify({'messages': [{'role': m.role, 'content': m.content} for m in history]})

with app.app_context():
    db.create_all()

if __name__ == '__main__':
    app.run(debug=True, port=5000)
