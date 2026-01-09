from flask import Blueprint, request, jsonify, session
from werkzeug.utils import secure_filename
from ..extensions import mongo
from ..services.classroom_service import (
    get_classroom_context,
    summarize_pdf_text,
    extract_prereqs_text,
    extract_syllabus_text,
    detect_subject_from_pdf_text,
)
from ..services.chat_service import save_chat_message, get_chat_history, handle_direct_queries, get_recent_conversation_context
from ..services.ai_service import perplexity_chat
from ..services.ppt_service import generate_ppt_content
from ..services.voice_service import generate_voice_conversation_response, process_voice_audio
from ..utils.json_utils import serialize_doc


ai_hub_bp = Blueprint('ai_hub', __name__)


@ai_hub_bp.route('/ai_hub/upload_pdf', methods=['POST'])
def ai_hub_upload_pdf():
    if 'user_id' not in session:
        return jsonify({"error": "Authentication required"}), 401
    if 'pdf' not in request.files:
        return jsonify({"error": "No PDF file"}), 400
    file = request.files['pdf']
    topic = (request.form.get('topic') or '').strip()
    guidance = (request.form.get('guidance') or '').strip()
    user_id = session['user_id']
    if file.filename == '' or not file.filename.lower().endswith('.pdf'):
        return jsonify({"error": "Invalid PDF file"}), 400
    file.stream.seek(0)
    pdf_bytes = file.read()
    pdf_text = ''
    try:
        from ..utils.pdf_utils import read_pdf_bytes_to_text
        pdf_text = read_pdf_bytes_to_text(pdf_bytes)
    except Exception:
        pass
    summary = summarize_pdf_text(pdf_text, topic, guidance)
    prereqs = extract_prereqs_text(pdf_text, topic)
    syllabus = extract_syllabus_text(pdf_text, topic)
    subject_detected = detect_subject_from_pdf_text(pdf_text)
    mongo.db.documents.insert_one({
        'user_id': user_id,
        'topic': topic or 'General',
        'filename': secure_filename(file.filename),
        'summary': summary,
        'prep_requirements': prereqs,
        'syllabus': syllabus,
        'subject': subject_detected,
        'pdf': pdf_bytes,
        'created_at': serialize_doc({'_id': None}).get('created_at') or None,  # keep field compatibility
    })
    return jsonify({
        'success': True,
        'filename': secure_filename(file.filename),
        'summary': summary,
        'prep_requirements': prereqs,
        'syllabus': syllabus,
        'subject': subject_detected,
    })


@ai_hub_bp.route('/ai_hub/chat', methods=['POST'])
def ai_hub_chat():
    if 'user_id' not in session:
        return jsonify({"error": "Authentication required"}), 401
    data = request.get_json() or {}
    if 'message' not in data:
        return jsonify({"error": "No message provided"}), 400
    user_message = data['message'].strip()
    if not user_message:
        return jsonify({"error": "Empty message"}), 400
    user_id = session['user_id']
    topic = data.get('topic', '')
    classroom_id = data.get('classroom_id', None)  # Get classroom_id from request
    language = data.get('language', 'en-US')  # Get language from request
    is_voice_mode = data.get('is_voice_mode', False)  # Check if this is a voice conversation
    
    # If classroom_id is provided, try to get the classroom to get its topic
    if classroom_id:
        try:
            from bson import ObjectId
            classroom = mongo.db.classrooms.find_one({'_id': ObjectId(classroom_id), 'user_id': user_id})
            if classroom:
                # Use classroom topic if topic is not provided
                if not topic:
                    topic = classroom.get('topic') or classroom.get('name', '')
        except Exception as e:
            print(f"Error fetching classroom: {e}")
            classroom_id = None
    
    # Save user message with classroom_id and topic
    save_chat_message(user_id, 'user', user_message, classroom_id=classroom_id, topic=topic)
    
    # Get classroom context
    classroom_context = get_classroom_context(user_id, topic) if topic else None
    
    # Check for direct queries first
    direct_answer = handle_direct_queries(user_message, classroom_context)
    if direct_answer:
        save_chat_message(user_id, 'assistant', direct_answer, classroom_id=classroom_id, topic=topic)
        return jsonify({'success': True, 'response': direct_answer})
    
    # Get recent conversation history for context (filtered by classroom/topic)
    conversation_history = get_recent_conversation_context(user_id, limit=10, classroom_id=classroom_id, topic=topic)
    
    try:
        # Use voice-optimized response if in voice mode
        if is_voice_mode:
            ai_response = generate_voice_conversation_response(
                user_message=user_message,
                conversation_history=conversation_history,
                language=language,
                topic=topic,
                classroom_context=classroom_context
            )
        else:
            # Build messages array with conversation context for text mode
            messages = [
                {"role": "system", "content": "You are an AI learning assistant. Be helpful, educational, and maintain conversation context. Continue teaching naturally when the student asks for 'next' or 'continue'."}
            ]
            
            # Add conversation history (excluding the current message which is already saved)
            # Filter to get last N messages before current one
            for msg in conversation_history[:-1]:  # Exclude the last one (current user message)
                messages.append(msg)
            
            # Add current user message with context
            context_parts = [f"Current Question: {user_message}"]
            
            # Add language context if not English
            if language and language != 'en-US' and language != 'en-IN':
                # Map language codes to names
                lang_map = {
                    'hi-IN': 'Hindi', 'raj-IN': 'Rajasthani', 'mwr-IN': 'Marwari',
                    'dhd-IN': 'Dhundhari', 'mup-IN': 'Mewari', 'wbr-IN': 'Wagdi',
                    'swv-IN': 'Shekhawati', 'bn-IN': 'Bengali', 'te-IN': 'Telugu',
                    'mr-IN': 'Marathi', 'ta-IN': 'Tamil', 'gu-IN': 'Gujarati',
                    'kn-IN': 'Kannada', 'ml-IN': 'Malayalam', 'pa-IN': 'Punjabi',
                    'or-IN': 'Odia', 'as-IN': 'Assamese', 'ur-IN': 'Urdu'
                }
                lang_name = lang_map.get(language, language.split('-')[0] if '-' in language else language)
                context_parts.append(f"\nNote: The user is communicating in {lang_name}. Please respond in the same language if possible, or provide a bilingual response (original language + English translation).")
            
            if classroom_context and classroom_context.get('documents'):
                context_parts.append(f"\nTopic Context: {topic}")
                context_parts.append(f"Documents available: {classroom_context['total_docs']}")
                for doc in classroom_context['documents'][:2]:
                    context_parts.append(f"Summary: {doc['summary'][:500]}...")
            
            current_user_message = "\n".join(context_parts)
            messages.append({"role": "user", "content": current_user_message})
            
            ai_response = perplexity_chat(messages, temperature=0.3, max_tokens=2000)
        
        save_chat_message(user_id, 'assistant', ai_response, classroom_id=classroom_id, topic=topic)
        return jsonify({'success': True, 'response': ai_response})
    except Exception as e:
        print(f"Error in AI chat: {e}")
        import traceback
        traceback.print_exc()
        error_message = f"I encountered an error processing your request. Please try again or check your AI service configuration."
        save_chat_message(user_id, 'assistant', error_message, classroom_id=classroom_id, topic=topic)
        return jsonify({
            'success': True, 
            'response': error_message
        })


@ai_hub_bp.route('/ai_hub/get_pdfs')
def ai_hub_get_pdfs():
    if 'user_id' not in session:
        return jsonify({"error": "Authentication required"}), 401
    user_id = session['user_id']
    topic = (request.args.get('topic') or '').strip()
    query = {'user_id': user_id}
    if topic:
        query['topic'] = topic
    pdfs = list(mongo.db.documents.find(query).sort('created_at', -1))
    pdf_list = []
    for pdf in pdfs:
        summary = pdf.get('summary', '')
        # Filter out AI configuration error messages from summary
        if summary and 'AI service is not configured' in summary:
            summary = summary.split('AI service is not configured')[0].strip()
            if not summary:
                summary = 'Document uploaded and processed. Summary will be available once AI service is configured.'
        
        pdf_list.append({
            'id': str(pdf.get('_id')),
            'filename': pdf.get('filename'),
            'topic': pdf.get('topic'),
            'subject': pdf.get('subject', ''),
            'summary': summary[:500] if summary else '',  # Full summary for preview (not truncated)
            'summary_short': (summary[:200] + '...') if summary and len(summary) > 200 else summary,  # Short for list
            'timestamp': pdf.get('created_at').isoformat() if pdf.get('created_at') else None,
        })
    return jsonify({'pdfs': pdf_list})


@ai_hub_bp.route('/ai_hub/get_pdf/<pdf_id>')
def ai_hub_get_pdf(pdf_id):
    """Get PDF file for preview/download"""
    if 'user_id' not in session:
        return jsonify({"error": "Authentication required"}), 401
    
    user_id = session['user_id']
    
    try:
        from bson import ObjectId
        pdf_doc = mongo.db.documents.find_one({'_id': ObjectId(pdf_id), 'user_id': user_id})
        
        if not pdf_doc:
            return jsonify({"error": "PDF not found"}), 404
        
        pdf_bytes = pdf_doc.get('pdf')
        if not pdf_bytes:
            return jsonify({"error": "PDF content not available"}), 404
        
        from flask import Response
        filename = pdf_doc.get('filename', 'document.pdf')
        
        return Response(
            pdf_bytes,
            mimetype='application/pdf',
            headers={
                'Content-Disposition': f'inline; filename="{filename}"',
                'Content-Type': 'application/pdf'
            }
        )
    except Exception as e:
        print(f"Error serving PDF: {e}")
        return jsonify({"error": f"Failed to retrieve PDF: {str(e)}"}), 500


@ai_hub_bp.route('/ai_hub/delete_pdf/<pdf_id>', methods=['DELETE', 'POST'])
def ai_hub_delete_pdf(pdf_id):
    """Delete a PDF document"""
    if 'user_id' not in session:
        return jsonify({"error": "Authentication required"}), 401
    
    user_id = session['user_id']
    
    try:
        from bson import ObjectId
        
        # Verify the PDF belongs to the user
        pdf_doc = mongo.db.documents.find_one({'_id': ObjectId(pdf_id), 'user_id': user_id})
        
        if not pdf_doc:
            return jsonify({"error": "PDF not found or access denied"}), 404
        
        # Delete the PDF document
        result = mongo.db.documents.delete_one({'_id': ObjectId(pdf_id), 'user_id': user_id})
        
        if result.deleted_count > 0:
            return jsonify({
                'success': True,
                'message': 'PDF deleted successfully',
                'filename': pdf_doc.get('filename', 'document.pdf')
            })
        else:
            return jsonify({"error": "Failed to delete PDF"}), 500
            
    except Exception as e:
        print(f"Error deleting PDF: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": f"Failed to delete PDF: {str(e)}"}), 500


@ai_hub_bp.route('/ai_hub/get_chat_history')
def ai_hub_get_chat_history():
    if 'user_id' not in session:
        return jsonify({"error": "Authentication required"}), 401
    user_id = session['user_id']
    # Get filter parameters from query string
    classroom_id = request.args.get('classroom_id', None)
    topic = request.args.get('topic', None)
    
    history = get_chat_history(user_id, 50, classroom_id=classroom_id, topic=topic)
    chat_list = []
    for chat in reversed(history):
        chat_item = {
            'role': chat.get('role'),
            'message': chat.get('message'),
            'timestamp': chat.get('timestamp').isoformat() if chat.get('timestamp') else None,
        }
        # Include PPT data if present
        if chat.get('ppt_data'):
            from ..utils.json_utils import serialize_doc
            chat_item['ppt'] = serialize_doc(chat.get('ppt_data'))
        chat_list.append(chat_item)
    return jsonify({'chats': chat_list})


@ai_hub_bp.route('/ai_hub/generate_ppt', methods=['POST'])
def ai_hub_generate_ppt():
    """Generate PPT based on user query"""
    try:
        if 'user_id' not in session:
            return jsonify({"error": "Authentication required"}), 401
        
        data = request.get_json() or {}
        if 'query' not in data:
            return jsonify({"error": "No query provided"}), 400
        
        user_query = data['query'].strip()
        if not user_query:
            return jsonify({"error": "Empty query"}), 400
        
        user_id = session['user_id']
        topic = data.get('topic', '')
        classroom_id = data.get('classroom_id', None)
        
        # If classroom_id is provided, try to get the classroom to get its topic
        if classroom_id:
            try:
                from bson import ObjectId
                classroom = mongo.db.classrooms.find_one({'_id': ObjectId(classroom_id), 'user_id': user_id})
                if classroom:
                    # Use classroom topic if topic is not provided
                    if not topic:
                        topic = classroom.get('topic') or classroom.get('name', '')
            except Exception as e:
                print(f"Error fetching classroom: {e}")
                classroom_id = None
        
        # Save user message
        save_chat_message(user_id, 'user', user_query, classroom_id=classroom_id, topic=topic)
        
        # Generate PPT
        result = generate_ppt_content(user_query, topic)
        
        if result.get('success'):
            ppt_data = result.get('ppt')
            # Format PPT as a message for display
            ppt_message = f"📊 **{ppt_data.get('title', 'Generated Presentation')}**\n\n"
            
            for slide in ppt_data.get('slides', []):
                slide_num = slide.get('slide_number', 0)
                slide_title = slide.get('title', 'Untitled')
                content = slide.get('content', [])
                visual = slide.get('visual_suggestion', '')
                
                ppt_message += f"**Slide {slide_num}: {slide_title}**\n"
                if isinstance(content, list):
                    for point in content:
                        ppt_message += f"  • {point}\n"
                else:
                    ppt_message += f"  {content}\n"
                
                if visual:
                    ppt_message += f"  📷 Visual: {visual}\n"
                ppt_message += "\n"
            
            # Save PPT response to chat with PPT data
            save_chat_message(user_id, 'assistant', ppt_message, ppt_data=ppt_data, classroom_id=classroom_id, topic=topic)
            
            return jsonify({
                'success': True,
                'ppt': ppt_data,
                'message': ppt_message
            })
        else:
            error_msg = result.get('error', 'Failed to generate PPT')
            save_chat_message(user_id, 'assistant', f"Sorry, I couldn't generate a PPT: {error_msg}", classroom_id=classroom_id, topic=topic)
            return jsonify({
                'success': False,
                'error': error_msg
            }), 500
            
    except Exception as e:
        import traceback
        error_trace = traceback.format_exc()
        print(f"Error in generate_ppt endpoint: {type(e).__name__}: {e}")
        print(f"Error traceback:\n{error_trace}")
        
        user_id = session.get('user_id')
        if user_id:
            try:
                save_chat_message(user_id, 'assistant', f"Sorry, I encountered an error generating the PPT: {str(e)}")
            except:
                pass
        
        return jsonify({
            'success': False,
            'error': f'Failed to generate PPT: {str(e)}',
            'error_type': type(e).__name__
        }), 500


@ai_hub_bp.route('/ai_hub/voice', methods=['POST'])
def ai_hub_voice():
    """Handle voice-to-voice audio conversation with Gemini"""
    try:
        if 'user_id' not in session:
            return jsonify({"error": "Authentication required"}), 401
        
        # Check if audio file is provided
        if 'audio' not in request.files and 'audio_data' not in request.form:
            return jsonify({"error": "No audio data provided"}), 400
        
        user_id = session['user_id']
        language = request.form.get('language', 'en-US')
        topic = request.form.get('topic', '')
        classroom_id = request.form.get('classroom_id', None)
        
        # Get audio data
        audio_data = None
        audio_format = 'webm'
        
        if 'audio' in request.files:
            # Audio file upload
            audio_file = request.files['audio']
            audio_data = audio_file.read()
            # Detect format from filename
            filename = audio_file.filename or ''
            if filename.endswith('.mp3'):
                audio_format = 'mp3'
            elif filename.endswith('.wav'):
                audio_format = 'wav'
            elif filename.endswith('.webm'):
                audio_format = 'webm'
        elif 'audio_data' in request.form:
            # Base64 encoded audio
            audio_data = request.form.get('audio_data')
            audio_format = request.form.get('audio_format', 'webm')
        
        if not audio_data:
            return jsonify({"error": "Invalid audio data"}), 400
        
        # If classroom_id is provided, get classroom context
        if classroom_id:
            try:
                from bson import ObjectId
                classroom = mongo.db.classrooms.find_one({'_id': ObjectId(classroom_id), 'user_id': user_id})
                if classroom:
                    if not topic:
                        topic = classroom.get('topic') or classroom.get('name', '')
            except Exception as e:
                print(f"Error fetching classroom: {e}")
                classroom_id = None
        
        # Get classroom context
        classroom_context = get_classroom_context(user_id, topic) if topic else None
        
        # Get conversation history
        conversation_history = get_recent_conversation_context(user_id, limit=6, classroom_id=classroom_id, topic=topic)
        
        # Save user voice message placeholder to chat history
        save_chat_message(user_id, 'user', '🎤 Voice message', classroom_id=classroom_id, topic=topic)
        
        # Process audio with Gemini
        result = process_voice_audio(
            audio_data=audio_data,
            audio_format=audio_format,
            conversation_history=conversation_history,
            language=language,
            topic=topic,
            classroom_context=classroom_context
        )
        
        if result.get('success'):
            # Extract text for saving to chat history
            text_response = result.get('text', '')
            
            # Save AI response to chat history
            if text_response:
                save_chat_message(user_id, 'assistant', text_response, classroom_id=classroom_id, topic=topic)
            
            # Return audio response if available
            if result.get('audio_data'):
                return jsonify({
                    'success': True,
                    'audio_data': result['audio_data'],
                    'text': text_response,
                    'format': result.get('format', 'webm')
                })
            else:
                # Fallback to text response
                return jsonify({
                    'success': True,
                    'audio_data': None,
                    'text': text_response,
                    'format': 'text'
                })
        else:
            error_msg = result.get('error', 'Failed to process voice')
            return jsonify({
                'success': False,
                'error': error_msg,
                'text': result.get('text', 'Failed to process voice')
            }), 500
            
    except Exception as e:
        import traceback
        error_trace = traceback.format_exc()
        print(f"Error in voice endpoint: {type(e).__name__}: {e}")
        print(f"Error traceback:\n{error_trace}")
        
        return jsonify({
            'success': False,
            'error': f'Failed to process voice: {str(e)}',
            'error_type': type(e).__name__
        }), 500


