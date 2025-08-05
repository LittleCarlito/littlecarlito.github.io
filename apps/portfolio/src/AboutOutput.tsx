import { useEffect, useState } from "react";

const TYPING_SPEED = 1;

const ABOUT_LINES = [
  "================================",
  "ABOUT",
  "================================",
  "",
  "I have been in the software development industry since 2014.",
  "Holding positions from Change Management Representative to Java",
  "Engineer at multiple Fortune 500 and 100 companies.",
  "",
  "Programming is pretty much all I do, reach out to me and",
  "maybe I can do it for you!"
];

interface AboutOutputProps {
  ip: string;
  onComplete: (content: string) => void;
  onContentUpdate?: () => void;
}

export default function AboutOutput({ ip, onComplete, onContentUpdate }: AboutOutputProps) {
  const [aboutDisplayed, setAboutDisplayed] = useState<string[]>([]);
  const [aboutCurrentLine, setAboutCurrentLine] = useState<string>("");
  const [aboutLineIdx, setAboutLineIdx] = useState<number>(0);
  const [aboutCharIdx, setAboutCharIdx] = useState<number>(0);

  const getLineType = (line: string) => {
    if (line === "ABOUT") return "h1";
    if (line === "================================") return "separator";
    if (line === "") return "empty";
    return "text";
  };

  const renderLine = (line: string, index: number) => {
    const lineType = getLineType(line);
    
    switch (lineType) {
      case "h1":
        return <h1 key={index} className="text-2xl font-bold text-green-400 mb-4">{line}</h1>;
      case "separator":
        return <div key={index} className="text-green-400 mb-4">{line}</div>;
      case "empty":
        return <div key={index} className="mb-2">&nbsp;</div>;
      default:
        return <div key={index} className="text-green-100 mb-2">{line}</div>;
    }
  };

  const renderCurrentLine = (line: string) => {
    const lineType = getLineType(line);
    
    switch (lineType) {
      case "h1":
        return (
          <h1 className="text-2xl font-bold text-green-400 mb-4">
            {line}
            <span className="blinking-cursor">|</span>
          </h1>
        );
      case "separator":
        return (
          <div className="text-green-400 mb-4">
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
      default:
        return (
          <div className="text-green-100 mb-2">
            {line}
            <span className="blinking-cursor">|</span>
          </div>
        );
    }
  };

  useEffect(() => {
    onContentUpdate?.();
  }, [aboutDisplayed, aboutCurrentLine, onContentUpdate]);

  useEffect(() => {
    if (aboutLineIdx < ABOUT_LINES.length) {
      const currentAboutLine = ABOUT_LINES[aboutLineIdx];
      
      if (aboutCharIdx < currentAboutLine.length) {
        const timeout = setTimeout(() => {
          setAboutCurrentLine(currentAboutLine.slice(0, aboutCharIdx + 1));
          setAboutCharIdx(aboutCharIdx + 1);
        }, TYPING_SPEED);
        return () => clearTimeout(timeout);
      } else {
        setAboutDisplayed(prev => [...prev, currentAboutLine]);
        setAboutCurrentLine("");
        setAboutLineIdx(aboutLineIdx + 1);
        setAboutCharIdx(0);
      }
    } else {
      const htmlContent = `
        <div class="about-section">
          ${aboutDisplayed.map(line => {
            const lineType = getLineType(line);
            switch (lineType) {
              case "h1":
                return `<h1 class="text-2xl font-bold text-green-400 mb-4">${line}</h1>`;
              case "separator":
                return `<div class="text-green-400 mb-4">${line}</div>`;
              case "empty":
                return `<div class="mb-2">&nbsp;</div>`;
              default:
                return `<div class="text-green-100 mb-2">${line}</div>`;
            }
          }).join('')}
        </div>
      `;
      onComplete(htmlContent);
    }
  }, [aboutLineIdx, aboutCharIdx, onComplete, ip, aboutDisplayed]);

  return (
    <div className="about-section bg-black text-green-400 font-mono p-4">
      <div>
        <span className="prompt text-green-400">root@{ip} {">"} </span>
      </div>
      {aboutDisplayed.map((line: string, i: number) => renderLine(line, i))}
      {aboutCurrentLine && renderCurrentLine(aboutCurrentLine)}
      <style >{`
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