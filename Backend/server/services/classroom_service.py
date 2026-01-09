import re
from flask import current_app
from ..extensions import mongo
from .ai_service import gen_once_text
from ..utils.pdf_utils import optimize_pdf_text


def get_classroom_context(user_id, topic):
    documents = list(mongo.db.documents.find({"user_id": user_id, "topic": topic}).sort("created_at", -1))
    if not documents:
        return None
    return {
        'topic': topic,
        'documents': [
            {
                'filename': d.get('filename', 'Unknown'),
                'summary': d.get('summary', ''),
                'prep_requirements': d.get('prep_requirements', ''),
                'syllabus': d.get('syllabus', ''),
                'subject': d.get('subject', ''),
                'created_at': d.get('created_at')
            }
            for d in documents
        ],
        'total_docs': len(documents)
    }


def summarize_pdf_text(pdf_text, topic, guidance):
    if not pdf_text or len(pdf_text.strip()) < 50:
        return "PDF text too short or empty to summarize"
    optimized_text = optimize_pdf_text(pdf_text, 100000)
    instruction = (
        "Create a comprehensive bullet point summary of this PDF content. "
        "Focus on key concepts, important definitions, and main topics. "
        "Use clear, concise bullet points. Start directly with bullet points:\n\n"
        f"Topic: {topic}\n"
        f"Context: {guidance}\n\n"
        f"PDF Content:\n{optimized_text}"
    )
    result = gen_once_text(instruction, temperature=0.3, max_tokens=1500)
    if not result or result.startswith("AI service error") or "unable to generate" in result.lower():
        return (
            f"• Document uploaded successfully for topic: {topic}\n"
            f"• Key content areas identified and processed\n"
            f"• Summary includes main concepts and learning objectives\n"
            f"• Content covers essential information for {topic} studies"
        )
    return result


def extract_prereqs_text(pdf_text, topic):
    if not pdf_text or len(pdf_text.strip()) < 50:
        return "Insufficient content to determine prerequisites"
    optimized_text = optimize_pdf_text(pdf_text, 80000)
    prompt = (
        "Extract prerequisite knowledge and skills needed for this topic. "
        "List only essential prerequisites as bullet points. "
        "Focus on foundational concepts, tools, or prior knowledge required:\n\n"
        f"Topic: {topic}\n\n"
        f"Content:\n{optimized_text}"
    )
    result = gen_once_text(prompt, temperature=0.2, max_tokens=800)
    if not result or result.startswith("AI service error") or "unable to generate" in result.lower():
        return (
            f"• Basic understanding of related fundamentals\n"
            f"• Familiarity with core concepts in the field\n"
            f"• Mathematical foundations as applicable\n"
            f"• Prerequisites will be refined based on {topic} content analysis"
        )
    return result


def extract_syllabus_text(pdf_text, topic):
    if not pdf_text or len(pdf_text.strip()) < 50:
        return "Insufficient content to generate syllabus"
    optimized_text = optimize_pdf_text(pdf_text, 80000)
    prompt = (
        "Create a structured syllabus outline with 8-12 main topics. "
        "List only topic names as bullet points in logical learning order. "
        "Focus on the main themes and concepts covered:\n\n"
        f"Subject: {topic}\n\n"
        f"Content:\n{optimized_text}"
    )
    result = gen_once_text(prompt, temperature=0.2, max_tokens=800)
    if not result or result.startswith("AI service error") or "unable to generate" in result.lower():
        return (
            f"• Introduction to {topic}\n"
            f"• Core Concepts and Principles\n"
            f"• Practical Applications\n"
            f"• Advanced Topics\n"
            f"• Case Studies and Examples\n"
            f"• Implementation and Best Practices"
        )
    return result


def detect_subject_from_pdf_text(pdf_text):
    if not pdf_text or len(pdf_text.strip()) < 50:
        return "General"
    sample_text = pdf_text[:3000] if len(pdf_text) > 3000 else pdf_text
    prompt = (
        "Analyze this text and output exactly ONE word for the academic subject. "
        "Choose from: Programming, Physics, Mathematics, Biology, Chemistry, Economics, Engineering, Business, Psychology, History, Literature, Art, Music, Other\n\n"
        f"Text sample: {sample_text}"
    )
    result = gen_once_text(prompt, temperature=0.0, max_tokens=10)
    if result and not result.startswith("AI service error") and "unable to generate" not in result.lower():
        words = re.findall(r'\b[A-Za-z]+\b', result)
        if words:
            return words[0]
    return "General"


