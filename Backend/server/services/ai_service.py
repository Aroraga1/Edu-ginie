import re
import time
from flask import current_app
from ..extensions import get_genai_client
from .text_formatter import format_for_display


def _get_fallback_response(user_prompt: str) -> str:
    """Generate a simple fallback response when AI is not configured"""
    prompt_lower = user_prompt.lower()
    
    # Simple keyword-based responses
    if any(word in prompt_lower for word in ['hello', 'hi', 'hey', 'greetings']):
        return "Hello! I'm your AI learning assistant. I'm here to help you with your studies. To enable full AI capabilities, please configure the GEMINI_API_KEY environment variable. How can I assist you today?"
    
    if any(word in prompt_lower for word in ['explain', 'what is', 'tell me about', 'describe']):
        topic = user_prompt.replace('explain', '').replace('what is', '').replace('tell me about', '').replace('describe', '').strip()
        return f"I'd love to explain {topic} to you! To get detailed AI-powered explanations, please configure the GEMINI_API_KEY. For now, I can suggest checking your uploaded PDFs in the Media Manager for relevant information about this topic."
    
    if any(word in prompt_lower for word in ['help', 'assistance', 'support']):
        return "I'm here to help! I can assist with:\n• Explaining topics from your uploaded materials\n• Answering questions about your classrooms\n• Helping with exam preparation\n\nTo enable full AI-powered responses, please set the GEMINI_API_KEY environment variable. You can still explore your uploaded PDFs and classroom materials!"
    
    return f"I understand you're asking: {user_prompt}\n\nI'm an AI learning assistant, but I need the GEMINI_API_KEY to be configured to provide detailed responses. For now, you can:\n• Check your uploaded PDFs in the Media Manager\n• Review your classroom materials\n• Create and take practice exams\n\nWould you like help with any of these features?"


def gemini_generate_with_retry(prompt, model=None, temperature=0.3, max_tokens=2000, max_retries=3):
    client = get_genai_client()
    if not client:
        # Extract user message from prompt for fallback
        user_prompt = prompt
        if isinstance(prompt, str) and "Question:" in prompt:
            user_prompt = prompt.split("Question:")[-1].strip()
        return _get_fallback_response(user_prompt)
    model_name = model or current_app.config.get('GEMINI_MODEL', 'gemini-2.5-flash')
    for attempt in range(max_retries):
        try:
            response = client.models.generate_content(
                model=model_name,
                contents=[prompt],
                config={
                    'temperature': temperature,
                    'max_output_tokens': max_tokens,
                    'candidate_count': 1
                }
            )
            # Check for finish reason (MAXTOKENS means response was cut off)
            finish_reason = None
            if hasattr(response, 'candidates') and response.candidates:
                if isinstance(response.candidates, (list, tuple)) and len(response.candidates) > 0:
                    candidate = response.candidates[0]
                    if hasattr(candidate, 'finish_reason'):
                        finish_reason = candidate.finish_reason
                        if finish_reason and 'MAXTOKENS' in str(finish_reason):
                            print(f"⚠️ Warning: Response was truncated due to MAXTOKENS limit")
            
            # Method 1: Try to get text directly from response
            if response and hasattr(response, 'text') and response.text:
                raw_text = response.text.strip()
                if raw_text:
                    # If truncated, append ellipsis
                    if finish_reason and 'MAXTOKENS' in str(finish_reason) and not raw_text.endswith('...'):
                        raw_text += "..."
                    return format_for_display(raw_text)
            
            # Method 2: Try via candidates -> content -> parts -> text
            if response and hasattr(response, 'candidates') and response.candidates:
                if isinstance(response.candidates, (list, tuple)) and len(response.candidates) > 0:
                    for candidate in response.candidates:
                        if not candidate:
                            continue
                        # Try direct text access from candidate
                        if hasattr(candidate, 'text') and candidate.text:
                            raw_text = str(candidate.text).strip()
                            if raw_text:
                                return format_for_display(raw_text)
                        # Try via content -> parts
                        if hasattr(candidate, 'content') and candidate.content:
                            # Try direct text from content
                            if hasattr(candidate.content, 'text') and candidate.content.text:
                                raw_text = str(candidate.content.text).strip()
                                if raw_text:
                                    return format_for_display(raw_text)
                            # Try via parts
                            if hasattr(candidate.content, 'parts'):
                                parts = candidate.content.parts
                                # Check if parts is not None and is iterable
                                if parts is not None:
                                    try:
                                        iter(parts)  # Ensure it's iterable
                                        text_parts = [part.text for part in parts if part and hasattr(part, 'text') and part.text]
                                        if text_parts:
                                            raw_text = ''.join(text_parts).strip()
                                            if raw_text:
                                                return format_for_display(raw_text)
                                    except (TypeError, AttributeError) as e:
                                        print(f"Error iterating parts in ai_service: {e}")
                                        # Continue to next candidate
                                        continue
            
            # If we got text but response was truncated, note it
            if raw_text and finish_reason and 'MAXTOKENS' in str(finish_reason):
                if not raw_text.endswith('...'):
                    raw_text += "..."
                return format_for_display(raw_text)
            
            # Method 3: Try to get any string representation
            if response:
                try:
                    response_str = str(response)
                    # Only use if it looks like actual content (not object representation)
                    if response_str and not response_str.startswith('<') and len(response_str) > 10:
                        return format_for_display(response_str.strip())
                except Exception:
                    pass
            
            # If we get here, the response was empty or invalid
            print(f"Warning: Empty or invalid response from Gemini API on attempt {attempt + 1}")
            if attempt < max_retries - 1:
                time.sleep(2)
                continue
            
            # Final fallback after all retries
            return "I apologize, but I'm having trouble generating a response right now. Please try again in a moment."
        except Exception as e:
            error_str = str(e)
            error_type = type(e).__name__
            print(f"❌ Gemini API error on attempt {attempt + 1}/{max_retries}: {error_type}: {error_str}")
            
            # Handle rate limiting
            if "429" in error_str or "RESOURCE_EXHAUSTED" in error_str or "quota" in error_str.lower():
                if attempt < max_retries - 1:
                    retry_delay = 60
                    m = re.search(r'(\d+(?:\.\d+)?)', error_str)
                    if m:
                        retry_delay = min(float(m.group(1)) + 5, 120)
                    print(f"⏳ Rate limited. Waiting {retry_delay} seconds before retry...")
                    time.sleep(retry_delay)
                    continue
                return "Rate limit exceeded. Please try again later."
            
            # Handle API key errors
            if "api_key" in error_str.lower() or "authentication" in error_str.lower() or "401" in error_str or "403" in error_str:
                print(f"🔑 API key error detected")
                return "API authentication error. Please check your GEMINI_API_KEY configuration."
            
            # Handle model errors
            if "model" in error_str.lower() or "not found" in error_str.lower() or "404" in error_str:
                print(f"🤖 Model error detected. Trying fallback model...")
                # Try with default model if custom model failed
                if model_name != 'gemini-2.5-flash' and attempt == 0:
                    model_name = 'gemini-2.5-flash'
                    continue
            
            # Handle other errors with retry
            if attempt < max_retries - 1:
                print(f"🔄 Retrying in 2 seconds...")
                time.sleep(2)
                continue
            
            # Final error message
            print(f"❌ All retries exhausted. Final error: {error_str}")
            import traceback
            traceback.print_exc()
            return f"I apologize, but I encountered an error: {error_str[:100]}. Please try again."


def perplexity_chat(messages, model=None, temperature=0.2, max_tokens=1200):
    """
    Chat with conversation history support.
    Messages should be a list of dicts with 'role' and 'content' keys.
    """
    if not messages or not isinstance(messages, list):
        return "No messages provided"
    
    # Build context from conversation history
    # If only one user message, use simple prompt
    if len(messages) == 1 and messages[0].get("role") == "user":
        user_prompt = messages[0].get("content", "")
        if not user_prompt:
            return "No user message found"
        return gemini_generate_with_retry(user_prompt, model, temperature, max_tokens)
    
    # For conversation with history, build a comprehensive prompt
    conversation_text = ""
    for msg in messages:
        role = msg.get("role", "user")
        content = msg.get("content", "")
        if content:
            if role == "system":
                conversation_text += f"System: {content}\n\n"
            elif role == "user":
                conversation_text += f"Student: {content}\n\n"
            elif role == "assistant":
                conversation_text += f"AI Tutor: {content}\n\n"
    
    # Add context instruction
    context_prompt = f"""You are an AI learning tutor having a conversation with a student. Maintain context from previous messages and continue the conversation naturally.

Conversation History:
{conversation_text}

Important Instructions:
- If the student says "next", "continue", "go on", or similar, continue teaching from where you left off
- Maintain continuity with previous explanations
- Build upon concepts already discussed
- Keep the conversation flowing naturally
- If you were explaining a topic, continue with the next logical part
- Remember what you've already covered and what comes next

Respond naturally and continue the educational conversation:"""
    
    raw_response = gemini_generate_with_retry(context_prompt, model, temperature, max_tokens)
    return format_for_display(raw_response)


def gen_once_text(prompt: str, model=None, temperature=0.2, max_tokens=1200):
    if not prompt or not prompt.strip():
        return "Empty prompt provided"
    return gemini_generate_with_retry(prompt.strip(), model, temperature, max_tokens)


