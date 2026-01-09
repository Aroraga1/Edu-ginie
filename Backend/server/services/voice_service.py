"""
Service for handling voice-to-voice conversations with Gemini
Optimized for natural, conversational voice interactions using Gemini's native audio API
"""
import base64
import io
from flask import current_app
from ..extensions import get_genai_client
from .ai_service import perplexity_chat
from .text_formatter import format_for_voice, format_for_display


def generate_voice_response(messages, language='en-US', temperature=0.7, max_tokens=250):
    """
    Generate a voice-optimized response from Gemini.
    Optimized for natural, conversational speech.
    
    Args:
        messages: List of conversation messages with role and content
        language: Language code for the conversation
        temperature: Response creativity (higher = more conversational)
        max_tokens: Maximum response length (shorter for voice)
    
    Returns:
        str: Voice-optimized response text
    """
    try:
        # Map language codes to names
        lang_map = {
            'en-US': 'English (US)', 'en-IN': 'English (India)', 'en-GB': 'English (UK)',
            'hi-IN': 'Hindi', 'raj-IN': 'Rajasthani', 'mwr-IN': 'Marwari',
            'dhd-IN': 'Dhundhari', 'mup-IN': 'Mewari', 'wbr-IN': 'Wagdi',
            'swv-IN': 'Shekhawati', 'bn-IN': 'Bengali', 'te-IN': 'Telugu',
            'mr-IN': 'Marathi', 'ta-IN': 'Tamil', 'gu-IN': 'Gujarati',
            'kn-IN': 'Kannada', 'ml-IN': 'Malayalam', 'pa-IN': 'Punjabi',
            'or-IN': 'Odia', 'as-IN': 'Assamese', 'ur-IN': 'Urdu',
            'fr': 'French', 'de': 'German', 'es': 'Spanish', 'it': 'Italian',
            'pt': 'Portuguese', 'ru': 'Russian', 'ja': 'Japanese', 'zh': 'Chinese'
        }
        lang_name = lang_map.get(language, language.split('-')[0] if '-' in language else language)
        
        # Build voice-optimized system prompt
        voice_system_prompt = """You are an AI learning tutor engaged in a natural voice conversation with a student. 

Key Guidelines for Voice Interaction:
1. **Be Conversational**: Speak naturally as if you're having a real-time conversation. Use contractions, natural pauses, and conversational flow.
2. **Keep Responses Concise**: Voice responses should be shorter than text (2-3 sentences typically, up to 4-5 for complex topics).
3. **Use Natural Language**: Avoid long lists, bullet points, or formal structures. Speak as you would in person.
4. **Be Engaging**: Use enthusiasm, encouragement, and a friendly tone. Make the student feel like they're talking to a real tutor.
5. **Handle Interruptions**: If the student asks follow-ups or interrupts, acknowledge naturally and continue smoothly.
6. **Encourage Questions**: Invite the student to ask more questions or clarify anything.
7. **Use Spoken Language**: Prefer "you're" over "you are", "let's" over "let us", etc.
8. **Natural Transitions**: Use phrases like "That's a great question!", "Let me explain...", "Here's what I think...", "Does that make sense?"

Remember: You're speaking, not writing. Make it feel natural and conversational."""
        
        # Add STRONG language instruction - MUST respond in selected language
        if language and language != 'en-US' and language != 'en-IN':
            voice_system_prompt += f"\n\nCRITICAL LANGUAGE INSTRUCTION: The user has selected {lang_name} as their preferred language. You MUST respond ONLY in {lang_name} language. Do NOT use English or any other language in your responses. All your responses, explanations, and content must be entirely in {lang_name}. Even if the user speaks in English or another language, you must still respond in {lang_name}."
        elif language and (language == 'en-US' or language == 'en-IN'):
            voice_system_prompt += "\n\nLANGUAGE INSTRUCTION: Respond in English."

        # Build messages array with voice-optimized system prompt
        voice_messages = [
            {"role": "system", "content": voice_system_prompt}
        ]
        
        # Add conversation history
        if messages and isinstance(messages, (list, tuple)):
            try:
                for msg in messages:
                    # Ensure msg is a dict and not a system message
                    if msg and isinstance(msg, dict) and msg.get("role") != "system":
                        voice_messages.append(msg)
            except (TypeError, AttributeError) as e:
                print(f"Error processing messages: {e}")
                # Continue without history if there's an error
        
        # Adjust temperature for more natural conversation (higher = more conversational)
        # Use perplexity_chat but with voice-optimized settings
        response = perplexity_chat(voice_messages, temperature=temperature, max_tokens=max_tokens)
        
        # Post-process response for voice (remove markdown, simplify formatting)
        if response:
            response = format_for_voice(response)
        
        return response
        
    except Exception as e:
        print(f"Error generating voice response: {e}")
        import traceback
        traceback.print_exc()
        return "I'm having trouble processing that right now. Could you try asking again?"


def process_voice_audio(audio_data, audio_format='webm', conversation_history=None, language='en-US', topic=None, classroom_context=None):
    """
    Process audio input using Gemini's native voice API (Live-like conversation).
    Optimized for real-time voice-to-voice interaction.
    
    Args:
        audio_data: Base64 encoded audio data or bytes
        audio_format: Audio format (webm, mp3, wav, etc.)
        conversation_history: List of previous messages for context
        language: Language code
        topic: Current topic/classroom topic
        classroom_context: Additional context from classroom documents
    
    Returns:
        dict: Contains 'audio_data' (base64), 'text' (transcription), 'format'
    """
    try:
        client = get_genai_client()
        if not client:
            return {
                'success': False,
                'error': 'Gemini API not configured',
                'text': 'I apologize, but the voice service is not available right now.'
            }
        
        # Convert audio data to bytes if it's base64 string
        if isinstance(audio_data, str):
            audio_bytes = base64.b64decode(audio_data)
        else:
            audio_bytes = audio_data
        
        # Map language codes to names
        lang_map = {
            'en-US': 'English (US)', 'en-IN': 'English (India)', 'en-GB': 'English (UK)',
            'hi-IN': 'Hindi', 'raj-IN': 'Rajasthani', 'mwr-IN': 'Marwari',
            'dhd-IN': 'Dhundhari', 'mup-IN': 'Mewari', 'wbr-IN': 'Wagdi',
            'swv-IN': 'Shekhawati', 'bn-IN': 'Bengali', 'te-IN': 'Telugu',
            'mr-IN': 'Marathi', 'ta-IN': 'Tamil', 'gu-IN': 'Gujarati',
            'kn-IN': 'Kannada', 'ml-IN': 'Malayalam', 'pa-IN': 'Punjabi',
            'or-IN': 'Odia', 'as-IN': 'Assamese', 'ur-IN': 'Urdu',
            'fr': 'French', 'de': 'German', 'es': 'Spanish', 'it': 'Italian',
            'pt': 'Portuguese', 'ru': 'Russian', 'ja': 'Japanese', 'zh': 'Chinese'
        }
        lang_name = lang_map.get(language, language.split('-')[0] if '-' in language else language)
        
        # Build conversation context for Gemini Live-style conversation
        messages = []
        
        # Build system message with voice-optimized instructions and STRONG language requirement
        system_content = """You are an AI learning tutor having a natural, live voice conversation with a student. 

Your role (IMPORTANT for voice conversation):
- Speak naturally as if having a real-time conversation
- Keep responses SHORT and CONCISE (2-3 sentences, max 4-5 for complex topics)
- Use conversational language with contractions ("you're", "let's", "that's")
- Answer questions clearly and conversationally
- Explain concepts in simple, understandable terms
- Be enthusiastic, supportive, and encouraging
- If the student says "next", "continue", or similar, continue teaching from where you left off
- Handle interruptions and follow-up questions naturally
- Use spoken language, NOT written language (avoid lists, bullet points, formal structures)

Remember: This is a LIVE VOICE conversation. Speak naturally, be concise, and keep it conversational."""
        
        # Add STRONG language instruction - MUST respond in selected language
        if language and language != 'en-US' and language != 'en-IN':
            system_content += f"\n\nCRITICAL LANGUAGE INSTRUCTION: The user has selected {lang_name} as their preferred language. You MUST respond ONLY in {lang_name} language. Do NOT use English or any other language in your responses. All your responses, explanations, and content must be entirely in {lang_name}. Even if the user speaks in English or another language, you must still respond in {lang_name}. This is a MANDATORY requirement."
        elif language and (language == 'en-US' or language == 'en-IN'):
            system_content += "\n\nLANGUAGE INSTRUCTION: Respond in English."
        
        if topic:
            system_content += f"\n\nCurrent Topic: {topic}"
        
        if classroom_context and classroom_context.get('documents'):
            system_content += f"\n\nContext: The student has uploaded documents related to this topic. Reference this context when relevant."
        
        # Build messages array with system instruction and audio
        # Use parts array format for Gemini API
        messages = [
            {
                "role": "user",
                "parts": [
                    {"text": system_content}
                ]
            }
        ]
        
        # Add conversation history as text context (last 4 messages for voice context)
        if conversation_history and isinstance(conversation_history, (list, tuple)):
            try:
                # Safely get last 4 messages
                history_slice = conversation_history[-4:] if len(conversation_history) > 4 else conversation_history
                for msg in history_slice:
                    # Ensure msg is a dict and has required fields
                    if msg and isinstance(msg, dict):
                        content = msg.get("content", "")
                        # Skip empty content or voice message placeholders
                        if content and content != "🎤 Voice message" and isinstance(content, str):
                            role = msg.get("role", "user")
                            if role and isinstance(role, str):
                                messages.append({
                                    "role": role,
                                    "parts": [{"text": content}]
                                })
            except (TypeError, AttributeError, IndexError) as e:
                print(f"Error processing conversation history: {e}")
                # Continue without history if there's an error
        
        # Add current audio input
        messages.append({
            "role": "user",
            "parts": [
                {
                    "inline_data": {
                        "mime_type": f"audio/{audio_format}",
                        "data": base64.b64encode(audio_bytes).decode('utf-8')
                    }
                }
            ]
        })
        
        # Use Gemini API to generate text response with voice-optimized settings
        try:
            # Use the latest model that supports audio
            model_name = current_app.config.get('GEMINI_MODEL', 'gemini-2.0-flash-exp')
            if model_name not in ['gemini-2.0-flash-exp', 'gemini-2.0-flash-thinking-exp-001']:
                model_name = 'gemini-2.0-flash-exp'
            
            # Generate text response from Gemini with voice-optimized settings
            response = client.models.generate_content(
                model=model_name,
                contents=messages,
                config={
                    "temperature": 0.7,  # Higher for more conversational
                    "max_output_tokens": 500,  # Increased from 250 to prevent MAXTOKENS truncation
                    "candidate_count": 1
                }
            )
            
            # Extract text from response with comprehensive fallbacks
            text_response = None
            
            # Check for finish reason (MAXTOKENS means response was cut off)
            finish_reason = None
            if hasattr(response, 'candidates') and response.candidates:
                if isinstance(response.candidates, (list, tuple)) and len(response.candidates) > 0:
                    candidate = response.candidates[0]
                    if hasattr(candidate, 'finish_reason'):
                        finish_reason = candidate.finish_reason
                        if finish_reason and 'MAXTOKENS' in str(finish_reason):
                            print(f"⚠️ Warning: Response was truncated due to MAXTOKENS limit")
            
            # Try multiple methods to extract text from response
            try:
                # Method 1: Try to get text directly from response (most reliable)
                if hasattr(response, 'text') and response.text:
                    text_response = str(response.text).strip()
                    if text_response:
                        print(f"✅ Got text from response.text: {text_response[:100]}...")
                
                # Method 2: Try via candidates -> content -> parts -> text
                if not text_response and hasattr(response, 'candidates') and response.candidates:
                    if isinstance(response.candidates, (list, tuple)) and len(response.candidates) > 0:
                        # Try all candidates
                        for candidate in response.candidates:
                            if not candidate:
                                continue
                            
                            # Try direct text from candidate
                            if hasattr(candidate, 'text') and candidate.text:
                                text_response = str(candidate.text).strip()
                                if text_response:
                                    print(f"✅ Got text from candidate.text: {text_response[:100]}...")
                                    break
                            
                            # Try via content
                            if not text_response and hasattr(candidate, 'content') and candidate.content:
                                # Try direct text from content
                                if hasattr(candidate.content, 'text') and candidate.content.text:
                                    text_response = str(candidate.content.text).strip()
                                    if text_response:
                                        print(f"✅ Got text from candidate.content.text: {text_response[:100]}...")
                                        break
                                
                                # Try via parts (this is the most common path)
                                if not text_response and hasattr(candidate.content, 'parts'):
                                    parts = candidate.content.parts
                                    # Check if parts exists, is not None, and is iterable
                                    if parts is not None:
                                        try:
                                            # Ensure parts is iterable before iterating
                                            iter(parts)
                                            # Safely iterate over parts
                                            parts_list = list(parts) if not isinstance(parts, list) else parts
                                            print(f"🔍 Found {len(parts_list)} parts in candidate.content.parts")
                                            for idx, part in enumerate(parts_list):
                                                print(f"  Part {idx}: type={type(part)}, has_text={hasattr(part, 'text') if part else False}")
                                                if part:
                                                    # Try multiple ways to get text from part
                                                    if hasattr(part, 'text') and part.text:
                                                        text_response = str(part.text).strip()
                                                        if text_response:
                                                            print(f"✅ Got text from candidate.content.parts[{idx}].text: {text_response[:100]}...")
                                                            break
                                                    # Some parts might have inline_data or other structures
                                                    elif hasattr(part, 'inline_data'):
                                                        print(f"  Part {idx} has inline_data (skipping)")
                                                    else:
                                                        # Try to convert part to string
                                                        try:
                                                            part_str = str(part)
                                                            if part_str and len(part_str) > 10 and not part_str.startswith('<'):
                                                                text_response = part_str.strip()
                                                                print(f"✅ Got text from part string conversion: {text_response[:100]}...")
                                                                break
                                                        except:
                                                            pass
                                            if text_response:
                                                break
                                        except (TypeError, AttributeError) as e:
                                            print(f"❌ Error iterating parts in voice_service: {e}")
                                            import traceback
                                            traceback.print_exc()
                                    else:
                                        print(f"⚠️ candidate.content.parts is None")
                
                # Method 3: Try to convert response to string (last resort)
                if not text_response and response:
                    try:
                        response_str = str(response)
                        # Only use if it looks like actual content (not object representation)
                        if response_str and not response_str.startswith('<') and len(response_str) > 10:
                            text_response = response_str.strip()
                            print(f"✅ Got text from string conversion: {text_response[:100]}...")
                    except Exception as str_error:
                        print(f"Error converting response to string: {str_error}")
                
            except Exception as extract_error:
                print(f"❌ Error extracting text from response: {extract_error}")
                import traceback
                traceback.print_exc()
                # Try one more fallback
                try:
                    if hasattr(response, 'text') and response.text:
                        text_response = str(response.text).strip()
                except Exception:
                    pass
            
            # Log if we still don't have a response
            if not text_response:
                print(f"⚠️ Warning: Could not extract text from Gemini response")
                print(f"Response type: {type(response)}")
                print(f"Finish reason: {finish_reason}")
                print(f"Response attributes: {dir(response) if response else 'None'}")
                if hasattr(response, 'candidates'):
                    print(f"Candidates: {response.candidates}")
                    # Try to inspect candidate content more deeply
                    if isinstance(response.candidates, (list, tuple)) and len(response.candidates) > 0:
                        candidate = response.candidates[0]
                        print(f"Candidate type: {type(candidate)}")
                        print(f"Candidate attributes: {dir(candidate) if candidate else 'None'}")
                        if hasattr(candidate, 'content'):
                            print(f"Content type: {type(candidate.content)}")
                            print(f"Content attributes: {dir(candidate.content) if candidate.content else 'None'}")
                            if hasattr(candidate.content, 'parts'):
                                print(f"Parts: {candidate.content.parts}")
            
            # If response was truncated but we have partial text, use it
            if text_response and finish_reason and 'MAXTOKENS' in str(finish_reason):
                print(f"✅ Using truncated response (hit token limit)")
                # Optionally append a note that response was cut off
                if not text_response.endswith('...'):
                    text_response += "..."
            
            # Clean up text response for voice (remove markdown, simplify formatting)
            if text_response:
                # Format for voice/TTS output
                text_response = format_for_voice(text_response)
                
                # Return text for frontend TTS (which will always play audio)
                # Frontend TTS is more reliable and properly handles language selection
                return {
                    'success': True,
                    'text': text_response,
                    'audio_data': None,  # Frontend will use TTS to generate audio in selected language
                    'format': 'text'  # Signal to frontend to use TTS
                }
            else:
                # No text response, generate fallback
                text_response = generate_voice_response(
                    conversation_history or [],
                    language=language,
                    temperature=0.7,
                    max_tokens=250
                )
                return {
                    'success': True,
                    'text': text_response or "I'm having trouble processing that. Could you try again?",
                    'audio_data': None,
                    'format': 'text'
                }
        except Exception as api_error:
            print(f"Error calling Gemini API: {api_error}")
            import traceback
            traceback.print_exc()
            # Fallback to text-based response
            try:
                text_response = generate_voice_response(
                    conversation_history or [],
                    language=language,
                    temperature=0.7,
                    max_tokens=250
                )
                return {
                    'success': True,
                    'text': text_response or "I'm having trouble processing that. Could you try again?",
                    'audio_data': None,
                    'format': 'text'
                }
            except Exception as fallback_error:
                print(f"Error in fallback response: {fallback_error}")
                return {
                    'success': False,
                    'error': f'API error: {str(api_error)}',
                    'text': "I'm sorry, I'm having trouble processing your voice. Could you try again?",
                    'audio_data': None,
                    'format': 'text'
                }
            
    except Exception as e:
        print(f"Error processing voice audio: {e}")
        import traceback
        traceback.print_exc()
        # Provide user-friendly error message instead of raw exception
        error_msg = str(e)
        if "'NoneType' object is not iterable" in error_msg:
            error_msg = "Unable to process voice input. Please try again."
        return {
            'success': False,
            'error': error_msg,
            'text': "I'm sorry, I'm having trouble processing your voice. Could you try again?",
            'audio_data': None,
            'format': 'text'
        }


def generate_voice_conversation_response(user_message, conversation_history, language='en-US', topic=None, classroom_context=None):
    """
    Generate a complete voice conversation response with context.
    This is a fallback method when audio input is not available.
    
    Args:
        user_message: The user's spoken message
        conversation_history: List of previous messages for context
        language: Language code
        topic: Current topic/classroom topic
        classroom_context: Additional context from classroom documents
    
    Returns:
        str: Natural voice response
    """
    try:
        # Build conversation messages
        messages = []
        
        # Map language codes to names
        lang_map = {
            'en-US': 'English (US)', 'en-IN': 'English (India)', 'en-GB': 'English (UK)',
            'hi-IN': 'Hindi', 'raj-IN': 'Rajasthani', 'mwr-IN': 'Marwari',
            'dhd-IN': 'Dhundhari', 'mup-IN': 'Mewari', 'wbr-IN': 'Wagdi',
            'swv-IN': 'Shekhawati', 'bn-IN': 'Bengali', 'te-IN': 'Telugu',
            'mr-IN': 'Marathi', 'ta-IN': 'Tamil', 'gu-IN': 'Gujarati',
            'kn-IN': 'Kannada', 'ml-IN': 'Malayalam', 'pa-IN': 'Punjabi',
            'or-IN': 'Odia', 'as-IN': 'Assamese', 'ur-IN': 'Urdu',
            'fr': 'French', 'de': 'German', 'es': 'Spanish', 'it': 'Italian',
            'pt': 'Portuguese', 'ru': 'Russian', 'ja': 'Japanese', 'zh': 'Chinese'
        }
        lang_name = lang_map.get(language, language.split('-')[0] if '-' in language else language)
        
        # Add voice-optimized system message
        system_content = """You are an AI learning tutor having a natural voice conversation with a student. 

Your role:
- Answer questions clearly and conversationally
- Explain concepts in simple, understandable terms
- Encourage learning and ask if the student needs clarification
- Keep responses concise and natural for speech (2-4 sentences typically)
- Use natural, conversational language as if speaking in person
- Be enthusiastic and supportive
- If the student says "next", "continue", or similar, continue teaching from where you left off

Remember: You're speaking to the student, so use spoken language, not written language."""
        
        # Add STRONG language instruction - MUST respond in selected language
        if language and language != 'en-US' and language != 'en-IN':
            system_content += f"\n\nCRITICAL LANGUAGE INSTRUCTION: The user has selected {lang_name} as their preferred language. You MUST respond ONLY in {lang_name} language. Do NOT use English or any other language in your responses. All your responses, explanations, and content must be entirely in {lang_name}. Even if the user speaks in English or another language, you must still respond in {lang_name}."
        elif language and (language == 'en-US' or language == 'en-IN'):
            system_content += "\n\nLANGUAGE INSTRUCTION: Respond in English."
        
        if topic:
            system_content += f"\n\nCurrent Topic: {topic}"
        
        if classroom_context and classroom_context.get('documents'):
            system_content += f"\n\nContext: The student has uploaded documents related to this topic. Reference this context when relevant."
        
        messages.append({"role": "system", "content": system_content})
        
        # Add conversation history (last 6 messages for voice to keep context manageable)
        if conversation_history and isinstance(conversation_history, (list, tuple)):
            try:
                # Safely get last 6 messages
                history_slice = conversation_history[-6:] if len(conversation_history) > 6 else conversation_history
                for msg in history_slice:
                    # Ensure msg is a dict and has required fields
                    if msg and isinstance(msg, dict):
                        content = msg.get("content", "")
                        if content and isinstance(content, str):
                            role = msg.get("role", "user")
                            if role and isinstance(role, str):
                                messages.append({
                                    "role": role,
                                    "content": content
                                })
            except (TypeError, AttributeError, IndexError) as e:
                print(f"Error processing conversation history: {e}")
                # Continue without history if there's an error
        
        # Add current user message
        messages.append({"role": "user", "content": user_message})
        
        # Generate voice-optimized response
        response = generate_voice_response(messages, language=language, temperature=0.7, max_tokens=1500)
        
        return response
        
    except Exception as e:
        print(f"Error in voice conversation: {e}")
        import traceback
        traceback.print_exc()
        return "I'm sorry, I'm having trouble understanding that. Could you try rephrasing your question?"

