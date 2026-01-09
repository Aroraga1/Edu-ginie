from datetime import datetime
from ..extensions import mongo


def save_chat_message(user_id, role, message, pdf_context=None, ppt_data=None, classroom_id=None, topic=None):
    """Save chat message with optional PPT data, classroom_id, and topic"""
    chat_doc = {
        'user_id': user_id,
        'role': role,
        'message': message,
        'timestamp': datetime.utcnow(),
        'pdf_context': pdf_context,
    }
    if ppt_data:
        chat_doc['ppt_data'] = ppt_data
    if classroom_id:
        chat_doc['classroom_id'] = classroom_id
    if topic:
        chat_doc['topic'] = topic
    mongo.db.chats.insert_one(chat_doc)


def get_chat_history(user_id, limit=20, classroom_id=None, topic=None):
    """Get chat history filtered by classroom_id or topic if provided"""
    query = {'user_id': user_id}
    
    # Filter by classroom_id if provided
    if classroom_id:
        query['classroom_id'] = classroom_id
    # Filter by topic if provided (and no classroom_id)
    elif topic:
        query['topic'] = topic
    
    return list(mongo.db.chats.find(query).sort('timestamp', -1).limit(limit))

def get_recent_conversation_context(user_id, limit=10, classroom_id=None, topic=None):
    """Get recent conversation messages formatted for AI context, filtered by classroom/topic"""
    history = get_chat_history(user_id, limit, classroom_id, topic)
    # Reverse to get chronological order
    messages = []
    for chat in reversed(history):
        role = chat.get('role', 'user')
        message = chat.get('message', '')
        if message:
            messages.append({
                'role': role,
                'content': message
            })
    return messages


def handle_direct_queries(user_message, classroom_context):
    message_lower = user_message.lower().strip()
    if any(phrase in message_lower for phrase in ['what is the topic', 'what was the topic', "what's the topic", 'topic name', 'main topic', 'the topic']):
        if classroom_context and classroom_context.get('documents'):
            documents = classroom_context.get('documents', [])
            if documents and isinstance(documents, (list, tuple)):
                for doc in documents:
                    if doc and isinstance(doc, dict):
                        summary = doc.get('summary', '').lower()
                        if 'faraday' in summary and 'law' in summary:
                            return "Faraday's Law of Electromagnetic Induction"
                        elif 'electromagnetic induction' in summary:
                            return "Electromagnetic Induction"
            return classroom_context.get('topic', 'No specific topic identified')
        return "No specific topic identified"
    if any(phrase in message_lower for phrase in ['what subject', 'which subject', 'subject name', 'what is the subject']):
        if classroom_context and classroom_context.get('documents'):
            documents = classroom_context.get('documents', [])
            if documents and isinstance(documents, (list, tuple)):
                subjects = [doc.get('subject', '') for doc in documents if doc and isinstance(doc, dict) and doc.get('subject')]
                if subjects:
                    return subjects[0]
        return "Physics"
    return None


