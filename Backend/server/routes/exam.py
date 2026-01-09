from flask import Blueprint, request, jsonify, session
from bson import ObjectId
from ..extensions import mongo
from ..services.exam_service import (
    is_valid_objectid,
    generate_mcqs_with_pplx,
    save_exam,
)
from ..utils.json_utils import serialize_doc


exam_bp = Blueprint('exam', __name__)


@exam_bp.route('/api/classroom/summary', methods=['GET'])
def get_classroom_summary():
    if 'user_id' not in session:
        return jsonify({"error": "Authentication required"}), 401
    user_id = session['user_id']
    classroom_id = request.args.get('classroom_id')
    if not classroom_id:
        return jsonify({"error": "Classroom ID required"}), 400
    if not is_valid_objectid(classroom_id):
        return jsonify({"error": "Invalid classroom ID format"}), 400
    classroom = mongo.db.classrooms.find_one({"_id": ObjectId(classroom_id), "user_id": user_id})
    if not classroom:
        return jsonify({"error": "Classroom not found"}), 404
    latest_doc = mongo.db.documents.find_one({"user_id": user_id, "topic": classroom.get("topic")}, sort=[("created_at", -1)])
    summary_data = {
        "classroom_name": classroom.get("name", ""),
        "subject": classroom.get("subject", ""),
        "description": classroom.get("description", ""),
        "summary": latest_doc.get("summary", "") if latest_doc else "",
        "syllabus": latest_doc.get("syllabus", "") if latest_doc else classroom.get("syllabus_topics", ""),
        "prep_requirements": latest_doc.get("prep_requirements", "") if latest_doc else classroom.get("prep_requirements", ""),
    }
    return jsonify(summary_data)


@exam_bp.route('/api/exam/generate', methods=['POST'])
def generate_exam():
    try:
        if 'user_id' not in session:
            return jsonify({"error": "Authentication required"}), 401
        
        data = request.get_json() or {}
        user_id = session['user_id']
        classroom_id = data.get('classroom_id')
        title = (data.get('title') or '').strip()
        subject = (data.get('subject') or '').strip()
        topics_to_cover = (data.get('topics') or '').strip()
        count = int(data.get('questionCount', 10))
        difficulty = data.get('difficulty', 'Intermediate')
        qtype = data.get('questionType', 'MCQ')
        time_limit = int(data.get('timeLimit', 30))
        
        # Validate required fields
        if not subject and not topics_to_cover:
            return jsonify({"error": "Subject or topics must be provided"}), 400
        
        if count < 1 or count > 50:
            return jsonify({"error": "Question count must be between 1 and 50"}), 400
        
        summary = ""
        syllabus = ""
        
        # Try to get context from classroom and documents
        if classroom_id and is_valid_objectid(classroom_id):
            # Convert user_id to ObjectId for consistent querying
            user_object_id = ObjectId(user_id) if isinstance(user_id, str) else user_id
            classroom = mongo.db.classrooms.find_one({"_id": ObjectId(classroom_id), "user_id": user_object_id})
            if classroom:
                # Get latest document for this classroom topic
                topic = classroom.get("topic") or classroom.get("name", "")
                if topic:
                    latest_doc = mongo.db.documents.find_one(
                        {"user_id": user_object_id, "topic": topic}, 
                        sort=[("created_at", -1)]
                    )
                    if latest_doc:
                        summary = latest_doc.get('summary', '')
                        syllabus = latest_doc.get('syllabus', '')
                        # Also check if topics_to_cover is empty, use classroom topic
                        if not topics_to_cover:
                            topics_to_cover = topic
        
        # If no topics provided, use subject
        if not topics_to_cover:
            topics_to_cover = subject
        
        print(f"Exam Generation: Subject={subject}, Topics={topics_to_cover}, Count={count}, Difficulty={difficulty}, Type={qtype}")
        print(f"Exam Generation: Summary length={len(summary)}, Syllabus length={len(syllabus)}")
        
        # Generate questions using AI
        questions = generate_mcqs_with_pplx(summary, syllabus, topics_to_cover, count, difficulty, qtype)
        
        if not questions or len(questions) == 0:
            return jsonify({"error": "Failed to generate questions. Please try again."}), 500
        
        # Save exam
        exam_id = save_exam(
            user_id, 
            classroom_id, 
            title or f"{subject} Practice Exam", 
            subject, 
            topics_to_cover, 
            count, 
            difficulty, 
            qtype, 
            time_limit, 
            questions
        )
        
        return jsonify({
            "success": True, 
            "exam_id": exam_id, 
            "questions_generated": len(questions)
        })
        
    except ValueError as e:
        return jsonify({"error": f"Invalid input: {str(e)}"}), 400
    except Exception as e:
        import traceback
        error_trace = traceback.format_exc()
        print(f"Error generating exam: {type(e).__name__}: {e}")
        print(f"Error traceback:\n{error_trace}")
        return jsonify({
            "error": f"Failed to generate exam: {str(e)}",
            "error_type": type(e).__name__
        }), 500


@exam_bp.route('/api/exam/get/<exam_id>', methods=['GET'])
def get_exam(exam_id):
    """Get exam details and questions by ID"""
    if 'user_id' not in session:
        return jsonify({"error": "Authentication required"}), 401
    user_id = session['user_id']
    if not is_valid_objectid(exam_id):
        return jsonify({"error": "Invalid exam ID format"}), 400
    
    # Convert user_id to ObjectId for consistent querying
    user_object_id = ObjectId(user_id) if isinstance(user_id, str) else user_id
    exam_object_id = ObjectId(exam_id)
    
    # Try to find exam with both ObjectId and string user_id formats
    exam = mongo.db.exams.find_one({"_id": exam_object_id, "user_id": user_object_id})
    if not exam:
        # Fallback: try with string user_id
        exam = mongo.db.exams.find_one({"_id": exam_object_id, "user_id": str(user_id)})
    if not exam:
        return jsonify({"error": "Exam not found"}), 404
    # Get difficulty and question_type from settings if not directly available
    settings = exam.get('settings', {})
    difficulty = exam.get('difficulty') or settings.get('difficulty', 'Intermediate')
    question_type = exam.get('question_type') or settings.get('question_type', 'MCQ')
    time_limit = exam.get('time_limit') or settings.get('time_limit', 30)
    
    exam_data = {
        "exam_id": str(exam.get('_id')),
        "title": exam.get('title', ''),
        "subject": exam.get('subject', ''),
        "topics": exam.get('topics_to_cover', ''),
        "difficulty": difficulty,
        "question_type": question_type,
        "time_limit": time_limit,
        "questions": exam.get('questions', []),
        "created_at": exam.get('created_at').isoformat() if exam.get('created_at') else None,
    }
    return jsonify(exam_data)


@exam_bp.route('/api/exam/submit', methods=['POST'])
def submit_exam():
    if 'user_id' not in session:
        return jsonify({"error": "Authentication required"}), 401
    data = request.get_json() or {}
    user_id = session['user_id']
    exam_id = data.get('exam_id')
    answers = data.get('answers', [])
    time_used = int(data.get('time_used', 0))
    if not is_valid_objectid(exam_id):
        return jsonify({"error": "Invalid exam ID format"}), 400
    
    # Convert user_id to ObjectId for consistent querying
    user_object_id = ObjectId(user_id) if isinstance(user_id, str) else user_id
    exam_object_id = ObjectId(exam_id)
    
    # Try to find exam with both ObjectId and string user_id formats
    exam = mongo.db.exams.find_one({"_id": exam_object_id, "user_id": user_object_id})
    if not exam:
        # Fallback: try with string user_id
        exam = mongo.db.exams.find_one({"_id": exam_object_id, "user_id": str(user_id)})
    if not exam:
        return jsonify({"error": "Exam not found"}), 404
    questions = exam.get('questions', [])
    correct = 0
    analysis = []
    for i, question in enumerate(questions):
        user_answer = answers[i] if i < len(answers) else None
        correct_answer = question.get('answer_index')
        is_correct = (user_answer == correct_answer)
        if is_correct:
            correct += 1
        analysis.append({
            'question_num': i + 1,
            'question': question.get('question', ''),
            'options': question.get('options', []),
            'user_answer': user_answer,
            'correct_answer': correct_answer,
            'is_correct': is_correct,
            'explanation': question.get('explanation', ''),
        })
    total_questions = len(questions)
    score_percentage = round((correct / max(1, total_questions)) * 100, 1)
    
    # Convert user_id to ObjectId if it's a string
    user_object_id = ObjectId(user_id) if isinstance(user_id, str) else user_id
    exam_object_id = ObjectId(exam_id) if isinstance(exam_id, str) else exam_id
    
    # Get created_at timestamp
    from datetime import datetime
    created_at = datetime.utcnow()
    
    result_data = {
        'user_id': user_object_id,  # Store as ObjectId for consistent queries
        'exam_id': exam_object_id,  # Store as ObjectId for consistent queries
        'exam_title': exam.get('title', ''),
        'score': score_percentage,
        'correct_answers': correct,
        'total_questions': total_questions,
        'incorrect_answers': total_questions - correct,
        'time_used_minutes': time_used,
        'analysis': analysis,
        'created_at': created_at,
    }
    result = mongo.db.exam_results.insert_one(result_data)
    print(f"Exam result saved: user_id={user_object_id}, exam_id={exam_object_id}, score={score_percentage}%")
    
    # Trigger comprehensive analysis update after exam submission
    try:
        from ..services.analysis_service import (
            analyze_conversation_engagement,
            analyze_exam_performance,
            calculate_overall_confidence,
            detect_achievements,
            calculate_badges,
            save_confidence_history
        )
        
        # Run analysis to update confidence, badges, and achievements
        conversation_data = analyze_conversation_engagement(user_id)
        exam_data = analyze_exam_performance(user_id)
        overall_confidence = calculate_overall_confidence(user_id, exam_data, conversation_data)
        
        # Detect new achievements
        detect_achievements(user_id, exam_data, conversation_data, overall_confidence)
        
        # Update badges
        calculate_badges(user_id, exam_data, conversation_data, overall_confidence)
        
        # Save confidence history
        save_confidence_history(user_id, overall_confidence, exam_data, conversation_data)
        
        # Update profile
        from datetime import datetime
        profile = mongo.db.profiles.find_one({'user_id': user_id})
        if profile:
            mongo.db.profiles.update_one(
                {'user_id': user_id},
                {'$set': {
                    'total_progress': overall_confidence,
                    'overall_confidence': overall_confidence,
                    'updated_at': datetime.utcnow()
                }}
            )
        else:
            # Create profile if doesn't exist
            mongo.db.profiles.insert_one({
                'user_id': user_id,
                'total_progress': overall_confidence,
                'overall_confidence': overall_confidence,
                'created_at': datetime.utcnow(),
                'updated_at': datetime.utcnow()
            })
        
        # Update classroom progress if exam is associated with a classroom
        exam_doc = mongo.db.exams.find_one({'_id': exam_object_id})
        if exam_doc and exam_doc.get('classroom_id'):
            try:
                from ..services.classroom_progress_service import calculate_classroom_progress
                classroom_id = exam_doc.get('classroom_id')
                # Handle both ObjectId and string formats
                if isinstance(classroom_id, ObjectId):
                    classroom_id_str = str(classroom_id)
                else:
                    classroom_id_str = str(classroom_id)
                progress_data = calculate_classroom_progress(user_id, classroom_id_str)
                mongo.db.classrooms.update_one(
                    {'_id': ObjectId(classroom_id_str) if isinstance(classroom_id_str, str) else classroom_id},
                    {'$set': {'progress': progress_data.get('progress', 0), 'updated_at': datetime.utcnow()}}
                )
            except Exception as progress_error:
                print(f"Error updating classroom progress after exam: {progress_error}")
    except Exception as e:
        print(f"Error updating analysis after exam: {e}")
        import traceback
        traceback.print_exc()
    
    return jsonify({'success': True, 'result_id': str(result.inserted_id)})


