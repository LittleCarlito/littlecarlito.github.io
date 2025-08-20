import { useEffect, useState } from "react";

const TYPING_SPEED = 1;

const getHardwareInfo = () => {
  const canvas = document.createElement('canvas');
  const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
  
  if (!gl) {
    return {
      gpu: "WebGL not supported",
      canRunThreeJS: false
    };
  }

  const webglContext = gl as WebGLRenderingContext;
  const renderer = webglContext.getParameter(webglContext.RENDERER);
  
  const memoryInfo = (navigator as any).deviceMemory || 0;
  const cores = navigator.hardwareConcurrency || 1;
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  const hasWeakGPU = renderer.toLowerCase().includes('intel') || 
                     renderer.toLowerCase().includes('gdi generic') ||
                     renderer.toLowerCase().includes('microsoft basic');
  const canRunThreeJS = gl !== null && 
                        !isMobile && 
                        !isTouch &&
                        cores >= 8 && 
                        (memoryInfo === 0 || memoryInfo >= 8) &&
                        !hasWeakGPU;
  
  return {
    gpu: renderer,
    memory: memoryInfo,
    cores: cores,
    canRunThreeJS: canRunThreeJS
  };
};

const generateScanLines = () => {
  const hardware = getHardwareInfo();
  
  return [
    "================================",
    "HARDWARE SCAN INITIATED",
    "================================",
    "",
    "Scanning hardware components...",
    `CPU: ${hardware.cores} cores detected`,
    `GPU: ${hardware.gpu}`,
    `RAM: ${hardware.memory ? hardware.memory + 'GB' : 'Unknown'} available`,
    "",
    "Analyzing performance capabilities...",
    "",
    `Orbit Status: ${hardware.canRunThreeJS ? 'READY' : 'NOT READY'}`
  ];
};

const handleLaunchClick = () => {
  const currentHost = window.location.origin;
  const targetUrl = `${currentHost}/3d`;
  window.open(targetUrl, '_blank');
};

interface ScanOutputProps {
  ip: string;
  onComplete: (content: string) => void;
  onContentUpdate?: () => void;
}

export default function ScanOutput({ ip, onComplete, onContentUpdate }: ScanOutputProps) {
  const [scanLines] = useState(() => generateScanLines());
  const [scanDisplayed, setScanDisplayed] = useState<string[]>([]);
  const [scanCurrentLine, setScanCurrentLine] = useState<string>("");
  const [scanLineIdx, setScanLineIdx] = useState<number>(0);
  const [scanCharIdx, setScanCharIdx] = useState<number>(0);
  const [showLaunchButton, setShowLaunchButton] = useState<boolean>(false);

  const getLineType = (line: string) => {
    if (line === "HARDWARE SCAN INITIATED" || line === "SCAN COMPLETE") return "h1";
    if (line === "================================") return "separator";
    if (line === "") return "empty";
    if (line.includes("CPU:") || line.includes("GPU:") || line.includes("RAM:")) return "hardware";
    if (line.includes("Orbit Status:")) {
      return line.includes("READY") ? "ready" : "not-ready";
    }
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
      case "hardware":
        return <div key={index} className="text-cyan-400 mb-2">{line}</div>;
      case "ready":
        return <div key={index} className="text-green-400 mb-2 font-bold">{line}</div>;
      case "not-ready":
        return <div key={index} className="text-red-400 mb-2 font-bold">{line}</div>;
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
      case "hardware":
        return (
          <div className="text-cyan-400 mb-2">
            {line}
            <span className="blinking-cursor">|</span>
          </div>
        );
      case "ready":
        return (
          <div className="text-green-400 mb-2 font-bold">
            {line}
            <span className="blinking-cursor">|</span>
          </div>
        );
      case "not-ready":
        return (
          <div className="text-red-400 mb-2 font-bold">
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
  }, [scanDisplayed, scanCurrentLine, onContentUpdate]);

  useEffect(() => {
    if (scanLineIdx < scanLines.length) {
      const currentScanLine = scanLines[scanLineIdx];
      
      if (scanCharIdx < currentScanLine.length) {
        const timeout = setTimeout(() => {
          setScanCurrentLine(currentScanLine.slice(0, scanCharIdx + 1));
          setScanCharIdx(scanCharIdx + 1);
        }, TYPING_SPEED);
        return () => clearTimeout(timeout);
      } else {
        setScanDisplayed(prev => [...prev, currentScanLine]);
        setScanCurrentLine("");
        setScanLineIdx(scanLineIdx + 1);
        setScanCharIdx(0);
      }
    } else {
      const hardware = getHardwareInfo();
      if (hardware.canRunThreeJS) {
        setShowLaunchButton(true);
      }
      
      const launchButton = hardware.canRunThreeJS 
        ? `<div class="mt-4"><button class="launch-button text-black bg-green-400 px-4 py-2 rounded hover:bg-green-300 transition-colors font-bold inline-block cursor-pointer">INITIATE LAUNCH</button></div>`
        : '';
      
      const htmlContent = `
        <div class="scan-section">
          ${scanDisplayed.map(line => {
            const lineType = getLineType(line);
            switch (lineType) {
              case "h1":
                return `<h1 class="text-2xl font-bold text-green-400 mb-4">${line}</h1>`;
              case "separator":
                return `<div class="text-green-400 mb-4">${line}</div>`;
              case "empty":
                return `<div class="mb-2">&nbsp;</div>`;
              case "hardware":
                return `<div class="text-cyan-400 mb-2">${line}</div>`;
              case "ready":
                return `<div class="text-green-400 mb-2 font-bold">${line}</div>`;
              case "not-ready":
                return `<div class="text-red-400 mb-2 font-bold">${line}</div>`;
              default:
                return `<div class="text-green-100 mb-2">${line}</div>`;
            }
          }).join('')}
          ${launchButton}
        </div>
      `;
      onComplete(htmlContent);
    }
  }, [scanLineIdx, scanCharIdx, onComplete, ip, scanDisplayed, scanLines]);

  return (
    <div className="scan-section bg-black text-green-400 font-mono p-4">
      <div>
        <span className="prompt text-green-400">root@{ip} {">"} </span>
      </div>
      {scanDisplayed.map((line: string, i: number) => renderLine(line, i))}
      {scanCurrentLine && renderCurrentLine(scanCurrentLine)}
      {showLaunchButton && (
        <div className="mt-4">
          <button 
            onClick={handleLaunchClick}
            className="text-black bg-green-400 px-4 py-2 rounded hover:bg-green-300 transition-colors font-bold cursor-pointer"
          >
            INITIATE LAUNCH
          </button>
        </div>
      )}
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