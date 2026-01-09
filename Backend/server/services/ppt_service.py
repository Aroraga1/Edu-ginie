import json
import re
from typing import Dict, List, Optional
from ..extensions import get_genai_client
from flask import current_app
from .ai_service import gemini_generate_with_retry


def _create_fallback_ppt(query: str, raw_response: str) -> Dict:
    """Create a comprehensive visual PPT structure from text response when JSON parsing fails"""
    try:
        # Default color scheme
        color_scheme = {
            "primary": "#3b82f6",
            "secondary": "#8b5cf6",
            "accent": "#f59e0b",
            "background": "#ffffff",
            "text": "#1f2937"
        }
        
        # Clean and prepare the raw response
        cleaned_response = raw_response.strip()
        # Remove any markdown code blocks that might be present
        cleaned_response = re.sub(r'```[a-z]*\n?', '', cleaned_response)
        cleaned_response = re.sub(r'```\n?', '', cleaned_response)
        
        # Split response into sections (by headings, numbered lists, paragraphs, etc.)
        lines = cleaned_response.split('\n')
        slides = []
        current_slide = None
        slide_num = 1
        layouts = ["title-content", "image-left", "image-right", "full-image"]
        current_content = []
        
        # More aggressive content extraction
        paragraphs = [p.strip() for p in cleaned_response.split('\n\n') if p.strip()]
        
        if paragraphs:
            for para_idx, para in enumerate(paragraphs):
                para_lines = [l.strip() for l in para.split('\n') if l.strip()]
                
                for line in para_lines:
                    # Detect slide titles - more patterns
                    is_title = False
                    title_text = line
                    
                    # Check for markdown headers
                    if re.match(r'^#{1,6}\s+.+', line):
                        title_text = re.sub(r'^#+\s*', '', line).strip()
                        is_title = True
                    # Check for numbered sections (1., 2., etc.)
                    elif re.match(r'^\d+[\.\)]\s+.{10,}', line):
                        title_text = re.sub(r'^\d+[\.\)]\s+', '', line).strip()
                        is_title = True
                    # Check for ALL CAPS headings (but not too long)
                    elif line.isupper() and 10 < len(line) < 100:
                        is_title = True
                    # Check for lines ending with colon (likely titles)
                    elif line.endswith(':') and 10 < len(line) < 100:
                        title_text = line[:-1].strip()
                        is_title = True
                    # Check for bold patterns **text**
                    elif re.match(r'^\*\*.+\*\*$', line):
                        title_text = re.sub(r'\*\*', '', line).strip()
                        is_title = True
                    
                    if is_title and len(title_text) > 5:
                        # Save previous slide if exists and has content
                        if current_slide:
                            if current_slide["content"] or current_content:
                                if current_content:
                                    current_slide["content"].extend(current_content[:5])
                                    current_content = []
                                slides.append(current_slide)
                            current_slide = None
                        
                        # Start new slide
                        layout = layouts[(slide_num - 1) % len(layouts)]
                        current_slide = {
                            "slide_number": slide_num,
                            "title": title_text[:100],
                            "content": [],
                            "layout": layout,
                            "visual_elements": {
                                "image_type": "illustration",
                                "image_description": f"Visual representation of {title_text[:50]}",
                                "colors": [color_scheme["primary"], color_scheme["secondary"]],
                                "icons": ["presentation", "chart"]
                            },
                            "animation": "fade"
                        }
                        slide_num += 1
                        current_content = []
                    else:
                        # Add as content point
                        content = line.strip()
                        
                        # Remove bullet markers
                        content = re.sub(r'^[-*•▪▫]\s+', '', content)
                        content = re.sub(r'^\d+[\.\)]\s+', '', content)
                        # Remove markdown formatting
                        content = re.sub(r'\*\*([^*]+)\*\*', r'\1', content)
                        content = re.sub(r'\*([^*]+)\*', r'\1', content)
                        content = re.sub(r'`([^`]+)`', r'\1', content)
                        
                        # Only add meaningful content
                        if content and len(content) > 10:
                            if current_slide:
                                current_slide["content"].append(content[:200])
                            else:
                                current_content.append(content[:200])
            
            # Add last slide
            if current_slide:
                if current_content:
                    current_slide["content"].extend(current_content[:5])
                if current_slide["content"]:
                    slides.append(current_slide)
        
        # If no structured slides found, create slides from paragraphs
        if not slides and paragraphs:
            # Split into reasonable chunks for slides
            para_per_slide = max(1, len(paragraphs) // 5)
            if para_per_slide < 1:
                para_per_slide = 1
            
            for i in range(0, len(paragraphs), para_per_slide):
                slide_paras = paragraphs[i:i + para_per_slide]
                if not slide_paras:
                    continue
                
                # Use first few words of first para as title
                first_para = slide_paras[0]
                title_words = first_para.split()[:8]
                title = ' '.join(title_words)
                if len(title) > 80:
                    title = title[:77] + "..."
                
                # Extract content from paragraphs
                content_points = []
                for para in slide_paras:
                    # Split paragraph into sentences
                    sentences = re.split(r'[.!?]+', para)
                    for sent in sentences:
                        sent = sent.strip()
                        # Remove markdown
                        sent = re.sub(r'\*\*([^*]+)\*\*', r'\1', sent)
                        sent = re.sub(r'\*([^*]+)\*', r'\1', sent)
                        sent = re.sub(r'`([^`]+)`', r'\1', sent)
                        if sent and len(sent) > 15:
                            content_points.append(sent[:200])
                
                if content_points:
                    slides.append({
                        "slide_number": len(slides) + 1,
                        "title": title if title else f"Slide {len(slides) + 1}",
                        "content": content_points[:6],  # Max 6 points per slide
                        "layout": layouts[len(slides) % len(layouts)],
                        "visual_elements": {
                            "image_type": "illustration",
                            "image_description": f"Visual representation related to {title[:50]}",
                            "colors": [color_scheme["primary"], color_scheme["secondary"]],
                            "icons": ["presentation", "chart"]
                        },
                        "animation": "fade"
                    })
        
        # Final fallback - create meaningful slides from query and response
        if not slides:
            # Try to extract key information from raw response
            sentences = re.split(r'[.!?]+', cleaned_response)
            meaningful_sentences = [s.strip() for s in sentences if len(s.strip()) > 20]
            
            if meaningful_sentences:
                # Create 3-5 slides from sentences
                sentences_per_slide = max(2, len(meaningful_sentences) // 4)
                if sentences_per_slide < 2:
                    sentences_per_slide = 2
                
                for i in range(0, len(meaningful_sentences), sentences_per_slide):
                    slide_sentences = meaningful_sentences[i:i + sentences_per_slide]
                    if not slide_sentences:
                        continue
                    
                    # Create title from first sentence
                    first_sent = slide_sentences[0]
                    title_words = first_sent.split()[:6]
                    title = ' '.join(title_words)
                    if len(title) > 80:
                        title = title[:77] + "..."
                    
                    slides.append({
                        "slide_number": len(slides) + 1,
                        "title": title if title else f"{query} - Part {len(slides) + 1}",
                        "content": [s[:200] for s in slide_sentences[:5]],
                        "layout": layouts[len(slides) % len(layouts)],
                        "visual_elements": {
                            "image_type": "illustration",
                            "image_description": f"Visual representation of {title[:50]}",
                            "colors": [color_scheme["primary"], color_scheme["secondary"]],
                            "icons": ["book", "lightbulb"]
                        },
                        "animation": "fade"
                    })
        
        # Absolute last resort - create a single comprehensive slide
        if not slides:
            # Use query and any meaningful parts of response
            content_lines = [s.strip() for s in cleaned_response.split('\n') if len(s.strip()) > 15]
            if not content_lines:
                content_lines = [f"Comprehensive information about {query}"]
            
            slides = [{
                "slide_number": 1,
                "title": f"Understanding {query}",
                "content": content_lines[:8] if content_lines else [
                    f"Overview of {query}",
                    f"Key concepts and important information about {query}",
                    f"Practical applications and examples related to {query}",
                    f"Important points to remember about {query}"
                ],
                "layout": "title-content",
                "visual_elements": {
                    "image_type": "illustration",
                    "image_description": f"Conceptual diagram and visual representation of {query}",
                    "colors": [color_scheme["primary"], color_scheme["secondary"]],
                    "icons": ["book", "lightbulb", "chart"]
                },
                "animation": "fade"
            }]
        
        # Ensure we have at least 3 slides for a proper presentation
        if len(slides) == 1 and slides[0]["content"]:
            # Split single slide into multiple slides
            content = slides[0]["content"]
            if len(content) > 4:
                num_new_slides = min(5, max(3, (len(content) + 2) // 3))
                content_per_slide = len(content) // num_new_slides
                if content_per_slide < 2:
                    content_per_slide = 2
                
                new_slides = []
                title_base = slides[0]["title"]
                
                for i in range(0, len(content), content_per_slide):
                    slide_content = content[i:i + content_per_slide]
                    if not slide_content:
                        continue
                    
                    # Create title from first content item
                    first_content = slide_content[0]
                    title_words = first_content.split()[:6]
                    slide_title = ' '.join(title_words)
                    if len(slide_title) > 80:
                        slide_title = slide_title[:77] + "..."
                    
                    new_slides.append({
                        "slide_number": len(new_slides) + 1,
                        "title": slide_title if slide_title else f"{title_base} - Part {len(new_slides) + 1}",
                        "content": slide_content[:6],
                        "layout": layouts[len(new_slides) % len(layouts)],
                        "visual_elements": {
                            "image_type": "illustration",
                            "image_description": f"Visual representation of {slide_title[:50]}",
                            "colors": [color_scheme["primary"], color_scheme["secondary"]],
                            "icons": ["presentation", "chart"]
                        },
                        "animation": "fade"
                    })
                
                if new_slides:
                    slides = new_slides
        
        # Limit to reasonable number of slides
        slides = slides[:10]
        
        return {
            "success": True,
            "ppt": {
                "title": f"Presentation on {query}",
                "theme": "modern",
                "color_scheme": color_scheme,
                "slides": slides
            }
        }
    except Exception as e:
        print(f"PPT Service: Fallback creation failed: {e}")
        import traceback
        traceback.print_exc()
        # Ultimate fallback - meaningful single slide
        return {
            "success": True,
            "ppt": {
                "title": f"Presentation on {query}",
                "theme": "modern",
                "color_scheme": {
                    "primary": "#3b82f6",
                    "secondary": "#8b5cf6",
                    "accent": "#f59e0b",
                    "background": "#ffffff",
                    "text": "#1f2937"
                },
                "slides": [{
                    "slide_number": 1,
                    "title": f"Comprehensive Guide to {query}",
                    "content": [
                        f"Introduction to {query}",
                        f"Key concepts and important information about {query}",
                        f"Detailed explanation of {query}",
                        f"Practical applications and examples related to {query}",
                        f"Summary and important points about {query}"
                    ],
                    "layout": "title-content",
                    "visual_elements": {
                        "image_type": "illustration",
                        "image_description": f"Comprehensive visual representation of {query}",
                        "colors": ["#3b82f6", "#8b5cf6"],
                        "icons": ["presentation", "chart", "book"]
                    },
                    "animation": "fade"
                }]
            }
        }


def generate_ppt_content(query: str, topic: Optional[str] = None, language: Optional[str] = None) -> Dict:
    """
    Generate PPT content using Gemini API based on user query.
    Returns a dictionary with slides information.
    Args:
        query: User's query/topic for the presentation
        topic: Optional topic context
        language: Optional language code (e.g., 'en-US', 'hi-IN') for response language
    """
    try:
        # Get model name safely
        try:
            model_name = current_app.config.get('GEMINI_MODEL', 'gemini-2.5-flash')
        except RuntimeError:
            # If we're outside request context, use default
            model_name = 'gemini-2.5-flash'
        
        # Build context for PPT generation - be very explicit about JSON format
        context = f"""You are a visual presentation generator. Create a comprehensive, visually-rich presentation based on this query: "{query}"

CRITICAL INSTRUCTIONS:
1. You MUST respond with ONLY valid JSON
2. Do NOT include any text before or after the JSON
3. Do NOT wrap JSON in markdown code blocks (```json or ```)
4. Do NOT include explanations or comments
5. Start your response directly with {{ and end with }}

Create 5-10 informative slides covering the topic comprehensively. Each slide should have substantial content related to "{query}". Return the response as a JSON object with this EXACT structure:

{{
    "title": "Presentation Title",
    "theme": "modern|classic|corporate|creative|academic",
    "color_scheme": {{
        "primary": "#hexcolor",
        "secondary": "#hexcolor",
        "accent": "#hexcolor",
        "background": "#hexcolor",
        "text": "#hexcolor"
    }},
    "slides": [
        {{
            "slide_number": 1,
            "title": "Slide Title",
            "content": ["Bullet point 1", "Bullet point 2", "Bullet point 3"],
            "layout": "title-content|image-left|image-right|split|full-image",
            "visual_elements": {{
                "image_type": "illustration|diagram|chart|photo|icon",
                "image_description": "Detailed description of what visual should show",
                "colors": ["#hex1", "#hex2"],
                "icons": ["icon-name-1", "icon-name-2"]
            }},
            "animation": "fade|slide|zoom|none"
        }}
    ]
}}

STRICT REQUIREMENTS:
- Each slide MUST have slide_number (integer), title (string), content (array of strings with at least 3 items), layout (string), and visual_elements (object)
- Content array must contain meaningful information about "{query}" - NOT generic placeholders
- Choose appropriate theme and color scheme matching the topic
- Layout should vary between slides for visual interest
- Visual elements MUST include detailed, specific descriptions related to the slide content
- Ensure all slides contain relevant, valuable information about "{query}"
- Minimum 5 slides, maximum 10 slides
- Return ONLY the raw JSON object starting with {{ and ending with }}

Remember: Start with {{ and end with }} - no other characters before or after."""
        
        if topic:
            context += f"\n\nTopic Context: {topic}"
        
        # Add language instruction if not English
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
            context += f"\n\nIMPORTANT: The user wants the presentation content in {lang_name} language. All slide titles, content points, and descriptions MUST be in {lang_name}. Respond with JSON where all text fields (title, content array items, image_description, etc.) are in {lang_name}."
        
        response_text = ""
        try:
            # Generate PPT content using Gemini
            response_text = gemini_generate_with_retry(
                context,
                model=model_name,
                temperature=0.7,
                max_tokens=4000  # Increased to ensure we can get multiple slides
            )
        
            if not response_text:
                return {
                    "success": False,
                    "error": "No response from AI service",
                }
            
            print(f"PPT Service: Raw response length: {len(response_text)}")
            print(f"PPT Service: First 200 chars: {response_text[:200]}")
            
            # Try to extract JSON from response
            # Gemini might wrap JSON in markdown code blocks
            original_response = response_text
            
            if "```json" in response_text:
                json_start = response_text.find("```json") + 7
                json_end = response_text.find("```", json_start)
                if json_end > json_start:
                    response_text = response_text[json_start:json_end].strip()
                    print("PPT Service: Extracted JSON from ```json block")
            elif "```" in response_text:
                json_start = response_text.find("```") + 3
                json_end = response_text.find("```", json_start)
                if json_end > json_start:
                    response_text = response_text[json_start:json_end].strip()
                    print("PPT Service: Extracted JSON from ``` block")
            
            # Try to find JSON object in the response if not already extracted
            if not response_text.strip().startswith('{'):
                # Look for first { and last }
                start_idx = response_text.find('{')
                end_idx = response_text.rfind('}')
                if start_idx >= 0 and end_idx > start_idx:
                    response_text = response_text[start_idx:end_idx+1]
                    print("PPT Service: Extracted JSON by finding first { and last }")
            
            # Clean up the JSON string
            response_text = response_text.strip()
            
            # Try to parse JSON response
            ppt_data = None
            try:
                ppt_data = json.loads(response_text)
            except json.JSONDecodeError as json_err:
                print(f"PPT Service: JSON decode error: {json_err}")
                print(f"PPT Service: Attempted to parse: {response_text[:500]}")
                # Try to fix common JSON issues
                # Remove any leading/trailing text
                response_text_fixed = response_text
                
                # Try to extract just the JSON part more aggressively
                if '{' in response_text and '}' in response_text:
                    # Find the largest JSON-like structure
                    start = response_text.find('{')
                    depth = 0
                    end = -1
                    for i in range(start, len(response_text)):
                        if response_text[i] == '{':
                            depth += 1
                        elif response_text[i] == '}':
                            depth -= 1
                            if depth == 0:
                                end = i
                                break
                    if end > start:
                        response_text_fixed = response_text[start:end+1]
                        print("PPT Service: Attempting to parse fixed JSON")
                        try:
                            ppt_data = json.loads(response_text_fixed)
                        except Exception as fix_err:
                            print(f"PPT Service: Fixed JSON also failed: {fix_err}")
                            # Last resort: try to create a basic PPT structure from text
                            return _create_fallback_ppt(query, original_response)
                else:
                    # No JSON found, create fallback
                    return _create_fallback_ppt(query, original_response)
            
            # Validate structure - only if ppt_data was successfully parsed
            if ppt_data is None:
                # If we somehow got here without ppt_data, use fallback
                return _create_fallback_ppt(query, original_response)
            
            if not isinstance(ppt_data, dict):
                print("PPT Service: Response is not a dictionary, using fallback")
                return _create_fallback_ppt(query, original_response)
            
            if "slides" not in ppt_data:
                print("PPT Service: Missing 'slides' field, using fallback")
                return _create_fallback_ppt(query, original_response)
            
            # Ensure slides is a list
            slides = ppt_data.get("slides", [])
            if not isinstance(slides, list):
                print("PPT Service: Slides is not a list, using fallback")
                return _create_fallback_ppt(query, original_response)
            
            # Validate that slides list is not empty
            if not slides or len(slides) == 0:
                print("PPT Service: Empty slides list, using fallback")
                return _create_fallback_ppt(query, original_response)
            
            # Extract theme and color scheme if provided
            theme = ppt_data.get("theme", "modern")
            color_scheme = ppt_data.get("color_scheme")
            
            # Ensure color scheme has all required fields
            if not color_scheme or not isinstance(color_scheme, dict):
                color_scheme = {
                    "primary": "#3b82f6",
                    "secondary": "#8b5cf6",
                    "accent": "#f59e0b",
                    "background": "#ffffff",
                    "text": "#1f2937"
                }
            
            # Validate and enhance each slide
            valid_slides = []
            for idx, slide in enumerate(slides):
                # Ensure slide is a dictionary
                if not isinstance(slide, dict):
                    continue
                
                # Validate required fields
                slide_title = slide.get("title", "").strip()
                slide_content = slide.get("content", [])
                
                # Skip slides without title or with generic titles
                if not slide_title or len(slide_title) < 3:
                    # Try to create a meaningful title
                    if isinstance(slide_content, list) and len(slide_content) > 0:
                        first_content = str(slide_content[0])[:50]
                        slide_title = first_content
                    else:
                        slide_title = f"Slide {idx + 1}"
                
                # Ensure content is a list and has meaningful content
                if not isinstance(slide_content, list):
                    if isinstance(slide_content, str):
                        # Convert string to list
                        slide_content = [slide_content]
                    else:
                        slide_content = []
                
                # Filter out empty or too-short content items
                meaningful_content = []
                for item in slide_content:
                    item_str = str(item).strip()
                    # Skip generic/placeholder content
                    if (item_str and len(item_str) > 10 and 
                        not any(placeholder in item_str.lower() for placeholder in 
                               ['placeholder', 'example', 'bullet point', 'content here', 'add text'])):
                        meaningful_content.append(item_str[:200])
                
                # If no meaningful content, create default based on title
                if not meaningful_content:
                    meaningful_content = [
                        f"Key information about {slide_title}",
                        f"Important details related to {slide_title}",
                        f"Relevant concepts for {slide_title}"
                    ]
                
                # Ensure slide has minimum content
                if len(meaningful_content) < 2:
                    meaningful_content.extend([
                        f"Additional information about {slide_title}",
                        f"Further details on {slide_title}"
                    ])
                
                # Build valid slide
                valid_slide = {
                    "slide_number": slide.get("slide_number", idx + 1),
                    "title": slide_title[:100],
                    "content": meaningful_content[:6],  # Max 6 content items per slide
                    "layout": slide.get("layout", "title-content"),
                    "visual_elements": slide.get("visual_elements", {}),
                    "animation": slide.get("animation", "fade")
                }
                
                # Ensure visual elements are properly structured
                if not isinstance(valid_slide["visual_elements"], dict):
                    valid_slide["visual_elements"] = {}
                
                if "image_type" not in valid_slide["visual_elements"]:
                    valid_slide["visual_elements"]["image_type"] = "illustration"
                if "image_description" not in valid_slide["visual_elements"] or not valid_slide["visual_elements"]["image_description"]:
                    valid_slide["visual_elements"]["image_description"] = f"Visual representation of {slide_title[:50]}"
                if "colors" not in valid_slide["visual_elements"] or not isinstance(valid_slide["visual_elements"]["colors"], list):
                    valid_slide["visual_elements"]["colors"] = [color_scheme.get("primary", "#3b82f6"), color_scheme.get("secondary", "#8b5cf6")]
                if "icons" not in valid_slide["visual_elements"] or not isinstance(valid_slide["visual_elements"]["icons"], list):
                    valid_slide["visual_elements"]["icons"] = ["presentation", "chart"]
                
                valid_slides.append(valid_slide)
            
            # Ensure we have at least some slides
            if not valid_slides:
                print("PPT Service: No valid slides after validation, using fallback")
                return _create_fallback_ppt(query, original_response)
            
            slides = valid_slides
            
            # Ensure we have at least 3 slides - split if we have fewer
            if len(slides) < 3:
                print(f"PPT Service: Only {len(slides)} slide(s) received, splitting into multiple slides")
                
                # Collect all content from existing slides
                all_content = []
                presentation_title = ppt_data.get("title", "Generated Presentation")
                
                for slide in slides:
                    if slide.get("content"):
                        all_content.extend(slide.get("content", []))
                
                # If we have enough content, split into 3-5 slides
                if len(all_content) >= 6:
                    layouts = ["title-content", "image-left", "image-right", "full-image"]
                    num_slides = min(5, max(3, (len(all_content) + 2) // 3))
                    content_per_slide = max(2, len(all_content) // num_slides)
                    
                    new_slides = []
                    for i in range(0, len(all_content), content_per_slide):
                        slide_content = all_content[i:i + content_per_slide]
                        if not slide_content:
                            continue
                        
                        # Create title from first content item or query
                        first_content = str(slide_content[0])[:60]
                        title_words = first_content.split()[:6]
                        slide_title = ' '.join(title_words)
                        if len(slide_title) > 80:
                            slide_title = slide_title[:77] + "..."
                        
                        # Fallback titles
                        if not slide_title or len(slide_title) < 5:
                            slide_title = f"{presentation_title} - Part {len(new_slides) + 1}"
                        
                        new_slides.append({
                            "slide_number": len(new_slides) + 1,
                            "title": slide_title,
                            "content": slide_content[:6],
                            "layout": layouts[len(new_slides) % len(layouts)],
                            "visual_elements": {
                                "image_type": "illustration",
                                "image_description": f"Visual representation of {slide_title[:50]}",
                                "colors": [color_scheme.get("primary", "#3b82f6"), color_scheme.get("secondary", "#8b5cf6")],
                                "icons": ["presentation", "chart"]
                            },
                            "animation": "fade"
                        })
                    
                    if len(new_slides) >= 3:
                        slides = new_slides
                    else:
                        # If splitting didn't work well, expand single slide with topic-related content
                        print("PPT Service: Expanding slides with topic-related content")
                        original_slide = slides[0] if slides else None
                        if original_slide:
                            expanded_slides = []
                            slide_layouts = ["title-content", "image-left", "image-right", "full-image"]
                            slide_titles = [
                                f"Introduction to {query}",
                                f"Key Concepts of {query}",
                                f"Important Details about {query}",
                                f"Applications and Examples of {query}",
                                f"Summary and Conclusion about {query}"
                            ]
                            
                            for idx, title in enumerate(slide_titles[:5]):
                                # Distribute content from original slide
                                if original_slide.get("content"):
                                    orig_content = original_slide.get("content", [])
                                    # Create related content for each slide
                                    if idx == 0:
                                        content = [f"Welcome to the presentation on {query}", f"This presentation covers key aspects of {query}"] + orig_content[:2]
                                    elif idx == 1:
                                        content = orig_content[:3] if len(orig_content) >= 3 else [
                                            f"Core concepts related to {query}",
                                            f"Fundamental principles of {query}",
                                            f"Essential knowledge about {query}"
                                        ]
                                    elif idx == 2:
                                        content = orig_content[2:5] if len(orig_content) > 2 else [
                                            f"Detailed information about {query}",
                                            f"In-depth analysis of {query}",
                                            f"Comprehensive overview of {query}"
                                        ]
                                    elif idx == 3:
                                        content = [
                                            f"Real-world applications of {query}",
                                            f"Practical examples demonstrating {query}",
                                            f"Use cases and scenarios for {query}"
                                        ]
                                    else:
                                        content = [
                                            f"Key takeaways about {query}",
                                            f"Important points to remember about {query}",
                                            f"Final thoughts on {query}"
                                        ]
                                else:
                                    content = [
                                        f"Key information about {title.lower()}",
                                        f"Important details related to {title.lower()}",
                                        f"Relevant concepts for {title.lower()}"
                                    ]
                                
                                expanded_slides.append({
                                    "slide_number": idx + 1,
                                    "title": title,
                                    "content": content[:6],
                                    "layout": slide_layouts[idx % len(slide_layouts)],
                                    "visual_elements": {
                                        "image_type": "illustration",
                                        "image_description": f"Visual representation of {title[:50]}",
                                        "colors": [color_scheme.get("primary", "#3b82f6"), color_scheme.get("secondary", "#8b5cf6")],
                                        "icons": ["presentation", "chart"]
                                    },
                                    "animation": "fade"
                                })
                            
                            slides = expanded_slides
                else:
                    # Not enough content to split, expand with topic-based slides
                    print("PPT Service: Expanding with topic-based slides")
                    original_slide = slides[0] if slides else None
                    expanded_slides = []
                    layouts = ["title-content", "image-left", "image-right", "full-image"]
                    
                    slide_titles = [
                        f"Introduction to {query}",
                        f"Key Concepts of {query}",
                        f"Important Details about {query}",
                        f"Applications of {query}",
                        f"Summary of {query}"
                    ]
                    
                    for idx, title in enumerate(slide_titles[:5]):
                        # Use original content if available, otherwise create topic-specific content
                        if original_slide and original_slide.get("content") and idx == 0:
                            content = original_slide.get("content", [])[:4]
                        else:
                            content = [
                                f"Essential information about {title.lower()}",
                                f"Key points related to {title.lower()}",
                                f"Important aspects of {title.lower()}"
                            ]
                        
                        expanded_slides.append({
                            "slide_number": idx + 1,
                            "title": title,
                            "content": content[:6],
                            "layout": layouts[idx % len(layouts)],
                            "visual_elements": {
                                "image_type": "illustration",
                                "image_description": f"Visual representation of {title[:50]}",
                                "colors": [color_scheme.get("primary", "#3b82f6"), color_scheme.get("secondary", "#8b5cf6")],
                                "icons": ["presentation", "chart"]
                            },
                            "animation": "fade"
                        })
                    
                    slides = expanded_slides
            
            # Limit to maximum 10 slides
            slides = slides[:10]
            
            return {
                "success": True,
                "ppt": {
                    "title": ppt_data.get("title", "Generated Presentation"),
                    "theme": theme,
                    "color_scheme": color_scheme,
                    "slides": slides
                }
            }
            
        except json.JSONDecodeError as e:
            # If JSON parsing fails, return error with partial response
            return {
                "success": False,
                "error": f"Failed to parse PPT response as JSON: {str(e)}",
                "raw_response": response_text[:500] if response_text else "No response"
            }
        except ValueError as e:
            # Validation errors
            return {
                "success": False,
                "error": f"Invalid PPT structure: {str(e)}",
                "raw_response": response_text[:500] if response_text else "No response"
            }
    except Exception as e:
        # Outer exception handler for any other errors
        error_msg = str(e)
        error_type = type(e).__name__
        return {
            "success": False,
            "error": f"Error generating PPT: {error_msg}",
            "error_type": error_type,
            "raw_response": response_text[:500] if 'response_text' in locals() and response_text else "No response"
        }

