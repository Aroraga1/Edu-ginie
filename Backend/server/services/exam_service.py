import json
import re
from datetime import datetime
from bson import ObjectId
from ..extensions import mongo
from .ai_service import gen_once_text


def is_valid_objectid(oid):
    try:
        ObjectId(oid)
        return True
    except Exception:
        return False


def generate_mcqs_with_pplx(summary_text, syllabus_text, topics_to_cover, count, difficulty, qtype):
    def create_fallback():
        fallback = []
        for i in range(count):
            if qtype.lower().startswith("true"):
                fallback.append({"question": f"{topics_to_cover} — statement {i+1} is correct.", "options": ["True","False"], "answer_index": 0, "explanation": ""})
            else:
                fallback.append({"question": f"What relates most to: {topics_to_cover} (item {i+1})?", "options": [f"Definition of {topics_to_cover}", "Use-case", "Counterexample", "Unrelated"], "answer_index": 0, "explanation": ""})
        return fallback

    # Build comprehensive prompt for AI to generate questions
    context_parts = []
    if summary_text and summary_text.strip():
        context_parts.append(f"Content Summary:\n{summary_text}\n")
    if syllabus_text and syllabus_text.strip():
        context_parts.append(f"Syllabus Topics:\n{syllabus_text}\n")
    if topics_to_cover and topics_to_cover.strip():
        context_parts.append(f"Specific Topics to Cover:\n{topics_to_cover}\n")
    
    context = "\n".join(context_parts) if context_parts else f"Topic: {topics_to_cover or 'General Knowledge'}"
    
    # Determine question format based on type
    if qtype.lower().startswith("true") or qtype.lower() == "true/false":
        options_format = '["True", "False"]'
        question_type_desc = "True/False questions"
    else:
        options_format = '["Option A", "Option B", "Option C", "Option D"]'
        question_type_desc = "Multiple Choice Questions (MCQ) with 4 options"
    
    # Build difficulty-specific instructions
    difficulty_instructions = {
        "beginner": "Create simple, foundational questions that test basic understanding. Use clear language and straightforward concepts.",
        "easy": "Create questions that test basic knowledge and recall. Focus on important facts and definitions.",
        "intermediate": "Create questions that require understanding and application of concepts. May include analysis and comparison.",
        "advanced": "Create challenging questions that require deep understanding, critical thinking, and synthesis of multiple concepts.",
        "expert": "Create complex questions that test advanced knowledge, problem-solving skills, and ability to apply concepts in novel situations."
    }
    difficulty_instruction = difficulty_instructions.get(difficulty.lower(), difficulty_instructions["intermediate"])
    
    prompt = f"""You are an expert exam question generator. Generate {count} high-quality {question_type_desc} based on the following content.

{context}

Requirements:
- Difficulty Level: {difficulty}
  {difficulty_instruction}
- Question Type: {qtype}
- Number of Questions: {count}
- Each question must be unique and test different aspects of the topic
- Questions should be relevant to the provided content and topics
- Make questions educational and appropriate for the difficulty level

IMPORTANT: You MUST respond with ONLY valid JSON in this EXACT format:
{{
  "questions": [
    {{
      "question": "Clear, specific question text without numbering",
      "options": {options_format},
      "answer_index": 0,
      "explanation": "Brief explanation of why this answer is correct"
    }}
  ]
}}

Rules:
- For True/False: options must be exactly ["True", "False"]
- For MCQ: provide exactly 4 options (A, B, C, D)
- answer_index must be 0, 1, 2, or 3 (matching the correct option position)
- Each question should have a clear, correct answer
- Explanations should be educational and helpful
- Do NOT include question numbers in the question text
- Do NOT include "A.", "B.", etc. in the options - just the option text
- Return ONLY the JSON object, no markdown, no explanations before or after

Generate {count} unique questions now:"""
    
    print(f"Exam Service: Generating {count} {qtype} questions for topic: {topics_to_cover}, difficulty: {difficulty}")
    
    raw = gen_once_text(prompt, temperature=0.7, max_tokens=4000)
    
    if raw and not raw.startswith("AI service error") and "unable to generate" not in raw.lower():
        print(f"Exam Service: Raw AI response received, length: {len(raw)}")
        
        # Try to extract JSON from response
        json_text = raw
        
        # Remove markdown code blocks if present
        if "```json" in json_text:
            json_start = json_text.find("```json") + 7
            json_end = json_text.find("```", json_start)
            if json_end > json_start:
                json_text = json_text[json_start:json_end].strip()
        elif "```" in json_text:
            json_start = json_text.find("```") + 3
            json_end = json_text.find("```", json_start)
            if json_end > json_start:
                json_text = json_text[json_start:json_end].strip()
        
        # Try to find JSON object in the response
        if not json_text.strip().startswith('{'):
            m = re.search(r'\{.*\}', json_text, re.DOTALL)
            if m:
                json_text = m.group(0)
        
        try:
            data = json.loads(json_text)
            qs = data.get("questions", [])
            if isinstance(qs, list) and qs:
                # Validate and clean questions
                validated_questions = []
                for q in qs[:count]:
                    if isinstance(q, dict) and "question" in q and "options" in q:
                        # Ensure answer_index is valid
                        if "answer_index" not in q:
                            q["answer_index"] = 0
                        elif not isinstance(q["answer_index"], int):
                            q["answer_index"] = int(q["answer_index"]) if str(q["answer_index"]).isdigit() else 0
                        
                        # Ensure answer_index is within bounds
                        if q["answer_index"] >= len(q.get("options", [])):
                            q["answer_index"] = 0
                        
                        # Ensure explanation exists
                        if "explanation" not in q:
                            q["explanation"] = "Correct answer explanation"
                        
                        validated_questions.append(q)
                
                if validated_questions:
                    print(f"Exam Service: Successfully generated {len(validated_questions)} questions")
                    return validated_questions
        except json.JSONDecodeError as e:
            print(f"Exam Service: JSON decode error: {e}")
            print(f"Exam Service: Attempted to parse: {json_text[:500]}")
        except Exception as e:
            print(f"Exam Service: Error processing questions: {e}")
    
    print(f"Exam Service: Falling back to basic questions")
    return create_fallback()


def save_exam(user_id, classroom_id, title, subject, topics_to_cover, count, difficulty, qtype, time_limit, questions):
    from bson import ObjectId
    
    # Convert user_id and classroom_id to ObjectId for consistent storage
    user_object_id = ObjectId(user_id) if isinstance(user_id, str) else user_id
    classroom_object_id = ObjectId(classroom_id) if classroom_id and isinstance(classroom_id, str) else classroom_id
    
    exam_data = {
        "user_id": user_object_id,  # Store as ObjectId
        "classroom_id": classroom_object_id,  # Store as ObjectId (can be None)
        "title": title,
        "subject": subject,
        "topics_to_cover": topics_to_cover,
        "settings": {
            "count": count,
            "difficulty": difficulty,
            "question_type": qtype,
            "time_limit": time_limit,
        },
        "questions": questions,
        "created_at": datetime.utcnow(),
        "status": "ready",
    }
    result = mongo.db.exams.insert_one(exam_data)
    print(f"Exam saved: exam_id={result.inserted_id}, user_id={user_object_id}, classroom_id={classroom_object_id}")
    return str(result.inserted_id)
