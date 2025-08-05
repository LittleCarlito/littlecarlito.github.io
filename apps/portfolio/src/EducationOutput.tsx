import { useEffect, useState } from "react";

const TYPING_SPEED = 1;

const EDUCATION_LINES = [
  "================================",
  "EDUCATION",
  "================================",
  "",
  "Master of Science - with Distinction: Computer Science",
  "DePaul University",
  "3.98 GPA",
  "Chicago, IL | 2021",
  "",
  "Bachelor of Arts: Economics",
  "Michigan State University",
  "East Lansing, MI | 2014"
];

interface EducationOutputProps {
  ip: string;
  onComplete: (content: string) => void;
  onContentUpdate?: () => void;
}

export default function EducationOutput({ ip, onComplete, onContentUpdate }: EducationOutputProps) {
  const [educationDisplayed, setEducationDisplayed] = useState<string[]>([]);
  const [educationCurrentLine, setEducationCurrentLine] = useState<string>("");
  const [educationLineIdx, setEducationLineIdx] = useState<number>(0);
  const [educationCharIdx, setEducationCharIdx] = useState<number>(0);

  const getLineType = (line: string) => {
    if (line === "EDUCATION") return "h1";
    if (line === "================================") return "separator";
    if (line === "") return "empty";
    if (line.includes("Master of Science") || line.includes("Bachelor of Arts")) return "degree-title";
    if (line.includes("DePaul University") || line.includes("Michigan State University")) return "university";
    if (line.includes("GPA")) return "gpa";
    if (line.includes("Chicago, IL") || line.includes("East Lansing, MI")) return "location-date";
    return "text";
  };

  const renderLine = (line: string, index: number) => {
    const lineType = getLineType(line);
    
    switch (lineType) {
      case "h1":
        return <h1 key={index} className="text-2xl font-bold" style={{color: '#32db20', marginBottom: '1rem'}}>{line}</h1>;
      case "separator":
        return <div key={index} style={{color: '#2ecc26', marginBottom: '1rem'}}>{line}</div>;
      case "empty":
        return <div key={index} className="mb-2">&nbsp;</div>;
      case "degree-title":
        return (
          <div key={index} style={{color: '#39ff14', marginBottom: '0.5rem', fontWeight: 'bold'}}>
            {line}
          </div>
        );
      case "university":
        return (
          <div key={index} style={{color: '#61dafb', marginBottom: '0.5rem', fontWeight: 'bold'}}>
            {line}
          </div>
        );
      case "gpa":
        return (
          <div key={index} style={{color: '#ff6b35', marginBottom: '0.5rem', fontWeight: 'bold'}}>
            {line}
          </div>
        );
      case "location-date":
        return (
          <div key={index} style={{color: '#2ecc26', marginBottom: '0.5rem'}}>
            {line}
          </div>
        );
      default:
        return <div key={index} style={{color: '#2ecc26', marginBottom: '0.5rem'}}>{line}</div>;
    }
  };

  const renderCurrentLine = (line: string) => {
    const lineType = getLineType(line);
    
    switch (lineType) {
      case "h1":
        return (
          <h1 className="text-2xl font-bold" style={{color: '#32db20', marginBottom: '1rem'}}>
            {line}
            <span className="blinking-cursor">|</span>
          </h1>
        );
      case "separator":
        return (
          <div style={{color: '#2ecc26', marginBottom: '1rem'}}>
            {line}
            <span className="blinking-cursor">|</span>
          </div>
        );
      case "empty":
        return (
          <div className="mb-2">
            <span className="blinking-cursor">|</span>
          </div>
        );
      case "degree-title":
        return (
          <div style={{color: '#39ff14', marginBottom: '0.5rem', fontWeight: 'bold'}}>
            {line}
            <span className="blinking-cursor">|</span>
          </div>
        );
      case "university":
        return (
          <div style={{color: '#61dafb', marginBottom: '0.5rem', fontWeight: 'bold'}}>
            {line}
            <span className="blinking-cursor">|</span>
          </div>
        );
      case "gpa":
        return (
          <div style={{color: '#ff6b35', marginBottom: '0.5rem', fontWeight: 'bold'}}>
            {line}
            <span className="blinking-cursor">|</span>
          </div>
        );
      case "location-date":
        return (
          <div style={{color: '#2ecc26', marginBottom: '0.5rem'}}>
            {line}
            <span className="blinking-cursor">|</span>
          </div>
        );
      default:
        return (
          <div style={{color: '#2ecc26', marginBottom: '0.5rem'}}>
            {line}
            <span className="blinking-cursor">|</span>
          </div>
        );
    }
  };

  const generateHtmlEducationLine = (line: string) => {
    const lineType = getLineType(line);
    
    switch (lineType) {
      case "h1":
        return `<h1 style="color: #32db20; font-size: 1.5rem; font-weight: bold; margin-bottom: 1rem;">${line}</h1>`;
      case "separator":
        return `<div style="color: #2ecc26; margin-bottom: 1rem;">${line}</div>`;
      case "empty":
        return `<div style="margin-bottom: 0.5rem;">&nbsp;</div>`;
      case "degree-title":
        return `<div style="color: #39ff14; margin-bottom: 0.5rem; font-weight: bold;">${line}</div>`;
      case "university":
        return `<div style="color: #61dafb; margin-bottom: 0.5rem; font-weight: bold;">${line}</div>`;
      case "gpa":
        return `<div style="color: #ff6b35; margin-bottom: 0.5rem; font-weight: bold;">${line}</div>`;
      case "location-date":
        return `<div style="color: #2ecc26; margin-bottom: 0.5rem;">${line}</div>`;
      default:
        return `<div style="color: #2ecc26; margin-bottom: 0.5rem;">${line}</div>`;
    }
  };

  useEffect(() => {
    onContentUpdate?.();
  }, [educationDisplayed, educationCurrentLine, onContentUpdate]);

  useEffect(() => {
    if (educationLineIdx < EDUCATION_LINES.length) {
      const currentEducationLine = EDUCATION_LINES[educationLineIdx];
      
      if (educationCharIdx < currentEducationLine.length) {
        const timeout = setTimeout(() => {
          setEducationCurrentLine(currentEducationLine.slice(0, educationCharIdx + 1));
          setEducationCharIdx(educationCharIdx + 1);
        }, TYPING_SPEED);
        return () => clearTimeout(timeout);
      } else {
        setEducationDisplayed(prev => [...prev, currentEducationLine]);
        setEducationCurrentLine("");
        setEducationLineIdx(educationLineIdx + 1);
        setEducationCharIdx(0);
      }
    } else {
      const htmlContent = `
        <div class="education-section">
          ${educationDisplayed.map(line => generateHtmlEducationLine(line)).join('')}
        </div>
      `;
      onComplete(htmlContent);
    }
  }, [educationLineIdx, educationCharIdx, onComplete, ip, educationDisplayed]);

  return (
    <div className="education-section bg-black font-mono p-4">
      <div>
        <span className="prompt" style={{color: '#1a7a0a'}}>root@{ip} {">"} </span>
      </div>
      {educationDisplayed.map((line: string, i: number) => renderLine(line, i))}
      {educationCurrentLine && renderCurrentLine(educationCurrentLine)}
      <style>{`
        .blinking-cursor {
          animation: blink 1s infinite;
        }
        @keyframes blink {
          0%, 50% { opacity: 1; }
          51%, 100% { opacity: 0; }
        }
      `}</style>
    </div>
  );
}