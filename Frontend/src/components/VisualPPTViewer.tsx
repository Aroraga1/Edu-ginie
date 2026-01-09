import React, { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Maximize2, Minimize2, Play, Pause } from "lucide-react";

interface VisualPPTViewerProps {
  ppt: {
    title: string;
    theme?: string;
    color_scheme?: {
      primary: string;
      secondary: string;
      accent: string;
      background: string;
      text: string;
    };
    slides: Array<{
      slide_number: number;
      title: string;
      content: string[];
      layout?: string;
      visual_elements?: {
        image_type?: string;
        image_description?: string;
        colors?: string[];
        icons?: string[];
      };
      animation?: string;
    }>;
  };
}

const VisualPPTViewer: React.FC<VisualPPTViewerProps> = ({ ppt }) => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);

  const colorScheme = ppt.color_scheme || {
    primary: "#3b82f6",
    secondary: "#8b5cf6",
    accent: "#f59e0b",
    background: "#ffffff",
    text: "#1f2937",
  };

  const theme = ppt.theme || "modern";

  const nextSlide = () => {
    if (currentSlide < ppt.slides.length - 1) {
      setCurrentSlide(currentSlide + 1);
    }
  };

  const prevSlide = () => {
    if (currentSlide > 0) {
      setCurrentSlide(currentSlide - 1);
    }
  };

  const getSlideLayout = (layout: string = "title-content") => {
    switch (layout) {
      case "image-left":
        return "grid grid-cols-2 gap-6";
      case "image-right":
        return "grid grid-cols-2 gap-6";
      case "split":
        return "grid grid-cols-2 gap-6";
      case "full-image":
        return "flex flex-col";
      default:
        return "flex flex-col";
    }
  };

  const renderVisualPlaceholder = (visualElements: any, layout: string) => {
    const { image_description, image_type, colors, icons } = visualElements || {};
    const bgColors = colors || [colorScheme.primary, colorScheme.secondary];

    return (
      <div
        className="rounded-lg flex items-center justify-center relative overflow-hidden"
        style={{
          background: `linear-gradient(135deg, ${bgColors[0] || colorScheme.primary}15, ${bgColors[1] || colorScheme.secondary}15)`,
          minHeight: layout === "full-image" ? "400px" : "250px",
        }}
      >
        {/* Decorative elements */}
        <div className="absolute inset-0 opacity-10">
          <div
            className="absolute top-0 right-0 w-32 h-32 rounded-full blur-3xl"
            style={{ backgroundColor: bgColors[0] || colorScheme.primary }}
          />
          <div
            className="absolute bottom-0 left-0 w-24 h-24 rounded-full blur-2xl"
            style={{ backgroundColor: bgColors[1] || colorScheme.secondary }}
          />
        </div>

        {/* Content */}
        <div className="relative z-10 text-center p-6">
          {icons && icons.length > 0 ? (
            <div className="flex justify-center gap-4 mb-4">
              {icons.slice(0, 3).map((icon: string, idx: number) => (
                <div
                  key={idx}
                  className="w-16 h-16 rounded-full flex items-center justify-center text-2xl"
                  style={{
                    backgroundColor: bgColors[idx % bgColors.length] || colorScheme.primary,
                    color: "white",
                  }}
                >
                  {icon.charAt(0).toUpperCase()}
                </div>
              ))}
            </div>
          ) : (
            <div
              className="w-24 h-24 mx-auto mb-4 rounded-lg flex items-center justify-center text-4xl"
              style={{
                backgroundColor: colorScheme.primary,
                color: "white",
              }}
            >
              📊
            </div>
          )}
          <p className="text-sm font-medium" style={{ color: colorScheme.text }}>
            {image_description || image_type || "Visual Element"}
          </p>
        </div>
      </div>
    );
  };

  const slide = ppt.slides[currentSlide];
  const layout = slide.layout || "title-content";

  return (
    <div className={`${isFullscreen ? "fixed inset-0 z-50 bg-black" : "relative"}`}>
      <Card
        className={`${isFullscreen ? "h-full m-0 rounded-none" : "border-2"} overflow-hidden`}
        style={{
          borderColor: colorScheme.primary,
          backgroundColor: colorScheme.background,
        }}
      >
        {/* Header */}
        <div
          className="px-6 py-4 flex items-center justify-between border-b"
          style={{ backgroundColor: colorScheme.primary, color: "white" }}
        >
          <div>
            <h2 className="text-lg font-bold">{ppt.title}</h2>
            <p className="text-sm opacity-90">
              Slide {currentSlide + 1} of {ppt.slides.length}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="text-white hover:bg-white/20"
            >
              {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        {/* Slide Content */}
        <CardContent
          className={`p-8 ${isFullscreen ? "h-[calc(100vh-120px)]" : "min-h-[500px]"} flex items-center justify-center`}
        >
          <div className={`w-full max-w-6xl ${getSlideLayout(layout)}`}>
            {/* Title Section */}
            <div
              className={`${
                layout === "image-left" || layout === "image-right" ? "col-span-2" : ""
              } mb-6`}
            >
              <h1
                className="text-4xl font-bold mb-4"
                style={{ color: colorScheme.primary }}
              >
                {slide.title}
              </h1>
            </div>

            {/* Content based on layout */}
            {layout === "image-left" && slide.visual_elements && (
              <>
                <div className="col-span-1">
                  {renderVisualPlaceholder(slide.visual_elements, layout)}
                </div>
                <div className="col-span-1">
                  <ul className="space-y-3">
                    {slide.content.map((point, idx) => (
                      <li
                        key={idx}
                        className="flex items-start gap-3 text-lg"
                        style={{ color: colorScheme.text }}
                      >
                        <span
                          className="mt-1 w-2 h-2 rounded-full flex-shrink-0"
                          style={{ backgroundColor: colorScheme.accent }}
                        />
                        <span>{point}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </>
            )}

            {layout === "image-right" && slide.visual_elements && (
              <>
                <div className="col-span-1">
                  <ul className="space-y-3">
                    {slide.content.map((point, idx) => (
                      <li
                        key={idx}
                        className="flex items-start gap-3 text-lg"
                        style={{ color: colorScheme.text }}
                      >
                        <span
                          className="mt-1 w-2 h-2 rounded-full flex-shrink-0"
                          style={{ backgroundColor: colorScheme.accent }}
                        />
                        <span>{point}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="col-span-1">
                  {renderVisualPlaceholder(slide.visual_elements, layout)}
                </div>
              </>
            )}

            {layout === "full-image" && slide.visual_elements && (
              <>
                {renderVisualPlaceholder(slide.visual_elements, layout)}
                <div className="mt-6">
                  <ul className="space-y-3">
                    {slide.content.map((point, idx) => (
                      <li
                        key={idx}
                        className="flex items-start gap-3 text-lg"
                        style={{ color: colorScheme.text }}
                      >
                        <span
                          className="mt-1 w-2 h-2 rounded-full flex-shrink-0"
                          style={{ backgroundColor: colorScheme.accent }}
                        />
                        <span>{point}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </>
            )}

            {(layout === "title-content" || !slide.visual_elements) && (
              <div className="w-full">
                <ul className="space-y-4">
                  {slide.content.map((point, idx) => (
                    <li
                      key={idx}
                      className="flex items-start gap-4 text-xl p-4 rounded-lg"
                      style={{
                        backgroundColor: `${colorScheme.primary}10`,
                        color: colorScheme.text,
                      }}
                    >
                      <span
                        className="mt-1 w-3 h-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: colorScheme.accent }}
                      />
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
                {slide.visual_elements && (
                  <div className="mt-6">
                    {renderVisualPlaceholder(slide.visual_elements, layout)}
                  </div>
                )}
              </div>
            )}
          </div>
        </CardContent>

        {/* Navigation */}
        <div
          className="px-6 py-4 flex items-center justify-between border-t"
          style={{ backgroundColor: `${colorScheme.primary}05` }}
        >
          <Button
            variant="outline"
            onClick={prevSlide}
            disabled={currentSlide === 0}
            style={{ borderColor: colorScheme.primary, color: colorScheme.primary }}
          >
            <ChevronLeft className="h-4 w-4 mr-2" />
            Previous
          </Button>

          {/* Slide Indicators */}
          <div className="flex gap-2">
            {ppt.slides.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentSlide(idx)}
                className={`w-2 h-2 rounded-full transition-all ${
                  idx === currentSlide ? "w-8" : ""
                }`}
                style={{
                  backgroundColor:
                    idx === currentSlide ? colorScheme.primary : colorScheme.secondary + "50",
                }}
              />
            ))}
          </div>

          <Button
            variant="outline"
            onClick={nextSlide}
            disabled={currentSlide === ppt.slides.length - 1}
            style={{ borderColor: colorScheme.primary, color: colorScheme.primary }}
          >
            Next
            <ChevronRight className="h-4 w-4 ml-2" />
          </Button>
        </div>
      </Card>
    </div>
  );
};

export default VisualPPTViewer;

