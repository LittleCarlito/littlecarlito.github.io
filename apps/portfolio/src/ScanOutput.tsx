import { useEffect, useState } from "react";

const TYPING_SPEED = 1;

const WARNING_LINES = [
  "================================",
  "ORBIT LAUNCH",
  "================================",
  "",
  "Warning: The 3D environment requires:",
  "  - Modern GPU (2016 or newer)",
  "  - 4GB+ available RAM",
  "  - WebGL 2.0 support",
  "",
  "If your system cannot handle the load,",
  "the page will get stuck...",
  "",
  "Launch at your own risk.",
  ""
];

const handleLaunchClick = (e: React.MouseEvent) => {
  e.preventDefault();
  e.stopPropagation();
  const currentHost = window.location.origin;
  const targetUrl = `${currentHost}/3d`;
  window.open(targetUrl, '_blank', 'noopener,noreferrer');
};

interface ScanOutputProps {
  ip: string;
  onComplete: (content: string) => void;
  onContentUpdate?: () => void;
}

export default function ScanOutput({ ip, onComplete, onContentUpdate }: ScanOutputProps) {
  const [displayedLines, setDisplayedLines] = useState<string[]>([]);
  const [currentLine, setCurrentLine] = useState<string>("");
  const [lineIdx, setLineIdx] = useState<number>(0);
  const [charIdx, setCharIdx] = useState<number>(0);
  const [isComplete, setIsComplete] = useState<boolean>(false);

  const getLineType = (line: string) => {
    if (line === "ORBIT LAUNCH") return "h1";
    if (line === "================================") return "separator";
    if (line === "") return "empty";
    if (line.includes("Warning:")) return "warning";
    if (line.startsWith("  -")) return "requirement";
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
      case "warning":
        return <div key={index} className="text-yellow-400 mb-2 font-bold">{line}</div>;
      case "requirement":
        return <div key={index} className="text-cyan-400 mb-1">{line}</div>;
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
      case "warning":
        return (
          <div className="text-yellow-400 mb-2 font-bold">
            {line}
            <span className="blinking-cursor">|</span>
          </div>
        );
      case "requirement":
        return (
          <div className="text-cyan-400 mb-1">
            {line}
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
  }, [displayedLines, currentLine, onContentUpdate]);

  useEffect(() => {
    if (lineIdx < WARNING_LINES.length) {
      const currentWarningLine = WARNING_LINES[lineIdx];
      if (charIdx < currentWarningLine.length) {
        const timeout = setTimeout(() => {
          setCurrentLine(currentWarningLine.slice(0, charIdx + 1));
          setCharIdx(charIdx + 1);
        }, TYPING_SPEED);
        return () => clearTimeout(timeout);
      } else {
        setDisplayedLines(prev => [...prev, currentWarningLine]);
        setCurrentLine("");
        setLineIdx(lineIdx + 1);
        setCharIdx(0);
      }
    } else {
      if (!isComplete) {
        setIsComplete(true);
        onContentUpdate?.();
      }
      const htmlContent = `
        <div class="scan-section">
          ${displayedLines.map(line => {
            const lineType = getLineType(line);
            switch (lineType) {
              case "h1":
                return `<h1 class="text-2xl font-bold text-green-400 mb-4">${line}</h1>`;
              case "separator":
                return `<div class="text-green-400 mb-4">${line}</div>`;
              case "empty":
                return `<div class="mb-2">&nbsp;</div>`;
              case "warning":
                return `<div class="text-yellow-400 mb-2 font-bold">${line}</div>`;
              case "requirement":
                return `<div class="text-cyan-400 mb-1">${line}</div>`;
              default:
                return `<div class="text-green-100 mb-2">${line}</div>`;
            }
          }).join('')}
          <div class="mt-4">
            <button 
              onclick="(function(e) { e.preventDefault(); e.stopPropagation(); const currentHost = window.location.origin; const targetUrl = currentHost + '/3d'; window.open(targetUrl, '_blank', 'noopener,noreferrer'); })(event)"
              class="text-black bg-green-400 px-4 py-2 rounded hover:bg-green-300 active:bg-green-500 transition-colors font-bold cursor-pointer"
              style="border: none; font-family: inherit;"
            >
              INITIATE LAUNCH
            </button>
          </div>
        </div>
      `;
      onComplete(htmlContent);
    }
  }, [lineIdx, charIdx, onComplete, ip, displayedLines]);

  return (
    <div className="scan-section bg-black text-green-400 font-mono p-4">
      <div>
        <span className="prompt text-green-400">root@{ip} {">"} </span>
      </div>
      {displayedLines.map((line: string, i: number) => renderLine(line, i))}
      {!isComplete && currentLine && renderCurrentLine(currentLine)}
      {isComplete && (
        <div className="mt-4">
          <button 
            onClick={handleLaunchClick}
            className="text-black bg-green-400 px-4 py-2 rounded hover:bg-green-300 active:bg-green-500 transition-colors font-bold cursor-pointer"
          >
            INITIATE LAUNCH
          </button>
        </div>
      )}
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