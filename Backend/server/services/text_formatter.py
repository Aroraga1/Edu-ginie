"""
Utility functions for cleaning and formatting AI-generated text responses
to ensure professional, readable output without unwanted markdown formatting
"""
import re


def clean_markdown(text):
    """
    Remove markdown formatting from text while preserving readability.
    Converts markdown to plain text in a professional manner.
    
    Args:
        text: Text string that may contain markdown formatting
    
    Returns:
        Cleaned text without markdown but with proper formatting
    """
    if not text or not isinstance(text, str):
        return text or ""
    
    # Remove markdown code blocks (with content)
    text = re.sub(r'```[\s\S]*?```', '', text)
    
    # Remove inline code blocks
    text = re.sub(r'`([^`]+)`', r'\1', text)
    
    # Convert markdown bold (**text** or __text__) to plain text
    # Match **text** or __text__ and remove the markers (non-greedy)
    text = re.sub(r'\*\*([^\*]+?)\*\*', r'\1', text)
    text = re.sub(r'__([^_]+?)__', r'\1', text)
    
    # Convert markdown italic (*text* or _text_) to plain text
    # Match single asterisks/underscores that aren't part of bold
    # This pattern ensures we don't match standalone asterisks
    text = re.sub(r'(?<!\*)\*([^\*\s][^\*]*?[^\*\s])\*(?!\*)', r'\1', text)
    text = re.sub(r'(?<!\*)\*([^\*\s]+)\*(?!\*)', r'\1', text)  # Single word
    text = re.sub(r'(?<!_)_([^_\s][^_]*?[^_\s])_(?!_)', r'\1', text)
    text = re.sub(r'(?<!_)_([^_\s]+)_(?!_)', r'\1', text)  # Single word
    
    # Remove any remaining standalone asterisks or underscores used for emphasis
    # These are often left over from markdown
    text = re.sub(r'\s\*\s+', ' ', text)  # Standalone asterisks with spaces
    text = re.sub(r'\s_\s+', ' ', text)  # Standalone underscores with spaces
    text = re.sub(r'^\*\s+', '', text, flags=re.MULTILINE)  # Leading asterisks
    text = re.sub(r'^_\s+', '', text, flags=re.MULTILINE)  # Leading underscores
    
    # Remove markdown headers (# Header)
    text = re.sub(r'^#{1,6}\s+(.+)$', r'\1', text, flags=re.MULTILINE)
    
    # Remove markdown links [text](url) -> text
    text = re.sub(r'\[([^\]]+)\]\([^\)]+\)', r'\1', text)
    
    # Remove markdown images ![alt](url)
    text = re.sub(r'!\[([^\]]*)\]\([^\)]+\)', r'\1', text)
    
    # Remove markdown list markers (- item or * item or 1. item)
    # But preserve the content
    text = re.sub(r'^[\s]*[-*+]\s+', '', text, flags=re.MULTILINE)
    text = re.sub(r'^\d+\.\s+', '', text, flags=re.MULTILINE)
    
    # Remove markdown blockquotes (> quote)
    text = re.sub(r'^>\s+', '', text, flags=re.MULTILINE)
    
    # Remove horizontal rules
    text = re.sub(r'^---+\s*$', '', text, flags=re.MULTILINE)
    text = re.sub(r'^\*\*\*\s*$', '', text, flags=re.MULTILINE)
    
    # Clean up excessive whitespace
    text = re.sub(r'\n{3,}', '\n\n', text)  # Multiple newlines to double newline
    text = re.sub(r'[ \t]+', ' ', text)  # Multiple spaces to single space
    text = re.sub(r'[ \t]+\n', '\n', text)  # Trailing spaces before newlines
    text = re.sub(r'\n[ \t]+', '\n', text)  # Leading spaces after newlines
    
    # Final cleanup - remove any remaining formatting artifacts
    # Remove standalone asterisks/underscores that might remain
    text = re.sub(r'\s+\*\s+', ' ', text)  # Standalone asterisks with spaces
    text = re.sub(r'\s+_\s+', ' ', text)  # Standalone underscores with spaces
    text = re.sub(r'\*\s*\*\s*', '', text)  # Double asterisks (bold markers)
    text = re.sub(r'_\s*_\s*', '', text)  # Double underscores (bold markers)
    
    # Remove any trailing asterisks or underscores at end of lines
    text = re.sub(r'\s+\*+$', '', text, flags=re.MULTILINE)
    text = re.sub(r'\s+_+$', '', text, flags=re.MULTILINE)
    
    # Final cleanup - trim and ensure no leading/trailing whitespace
    text = text.strip()
    
    return text


def format_for_display(text):
    """
    Format text for professional display in chat interface.
    Applies markdown cleaning and ensures proper paragraph breaks.
    
    Args:
        text: Text string to format
    
    Returns:
        Formatted text ready for display
    """
    if not text or not isinstance(text, str):
        return text or ""
    
    # First clean markdown
    text = clean_markdown(text)
    
    # Ensure proper paragraph breaks (double newlines become paragraph breaks)
    # Single newlines are preserved for line breaks within paragraphs
    text = re.sub(r'\n\n+', '\n\n', text)
    
    # Final trim
    text = text.strip()
    
    return text


def format_for_voice(text):
    """
    Format text for voice/TTS output.
    Removes all markdown and formatting that doesn't work well in speech.
    
    Args:
        text: Text string to format for voice
    
    Returns:
        Plain text optimized for speech
    """
    if not text or not isinstance(text, str):
        return text or ""
    
    # Remove all markdown formatting
    text = clean_markdown(text)
    
    # Remove special characters that don't work well in speech
    text = re.sub(r'[•●▪▫]', ' - ', text)  # Bullet points
    text = re.sub(r'→', 'then', text)  # Arrows
    text = re.sub(r'…', '...', text)  # Ellipsis
    text = re.sub(r'—', '-', text)  # Em dash
    text = re.sub(r'–', '-', text)  # En dash
    
    # Ensure natural pauses
    text = re.sub(r'([.!?])\s*([A-Z])', r'\1 \2', text)
    
    # Clean up excessive whitespace
    text = re.sub(r'\s+', ' ', text)
    text = text.strip()
    
    return text

