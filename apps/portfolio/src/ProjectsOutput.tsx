import { useEffect, useState } from "react";

const TYPING_SPEED = 1;

const PROJECTS_LINES = [
  "================================",
  "PROJECTS",
  "================================",
  "",
  "ThreeJS tutorials",
  "Chuck Chucker", 
  "Recipeat",
  "JPaint",
  "SaveScummer",
  "Springville Family Dentistry website",
  "This website"
];

const PROJECT_URLS: { [key: string]: string } = {
  "ThreeJS tutorials": "https://www.youtube.com/@Blooooork",
  "Chuck Chucker": "https://github.com/LittleCarlito/chucker",
  "Recipeat": "https://github.com/LittleCarlito/Recipeat",
  "JPaint": "https://github.com/LittleCarlito/JPaint",
  "SaveScummer": "https://github.com/LittleCarlito/SaveScummer",
  "Springville Family Dentistry website": "https://github.com/LittleCarlito/springvilleSite",
  "This website": "https://github.com/LittleCarlito/littlecarlito.github.io"
};

interface ProjectsOutputProps {
  ip: string;
  onComplete: (content: string) => void;
  onContentUpdate?: () => void;
}

export default function ProjectsOutput({ ip, onComplete, onContentUpdate }: ProjectsOutputProps) {
  const [projectsDisplayed, setProjectsDisplayed] = useState<string[]>([]);
  const [projectsCurrentLine, setProjectsCurrentLine] = useState<string>("");
  const [projectsLineIdx, setProjectsLineIdx] = useState<number>(0);
  const [projectsCharIdx, setProjectsCharIdx] = useState<number>(0);

  const getLineType = (line: string) => {
    if (line === "PROJECTS") return "h1";
    if (line === "================================") return "separator";
    if (line === "") return "empty";
    if (PROJECT_URLS[line]) return "project-link";
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
      case "project-link":
        return (
          <div key={index} style={{color: '#2ecc26', marginBottom: '0.5rem'}}>
            <a 
              href={PROJECT_URLS[line]} 
              target="_blank" 
              rel="noopener noreferrer"
              className="underline cursor-pointer"
              style={{ color: '#39ff14', transition: 'color 300ms' }}
              onMouseEnter={(e) => {
                const target = e.target as HTMLAnchorElement;
                target.style.color = '#61dafb';
              }}
              onMouseLeave={(e) => {
                const target = e.target as HTMLAnchorElement;
                target.style.color = '#39ff14';
              }}
            >
              {line}
            </a>
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
      case "project-link":
        return (
          <div style={{color: '#2ecc26', marginBottom: '0.5rem'}}>
            <a 
              href={PROJECT_URLS[line]} 
              target="_blank" 
              rel="noopener noreferrer"
              className="underline cursor-pointer"
              style={{ color: '#39ff14', transition: 'color 300ms' }}
              onMouseEnter={(e) => {
                const target = e.target as HTMLAnchorElement;
                target.style.color = '#61dafb';
              }}
              onMouseLeave={(e) => {
                const target = e.target as HTMLAnchorElement;
                target.style.color = '#39ff14';
              }}
            >
              {line}
            </a>
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

  useEffect(() => {
    onContentUpdate?.();
  }, [projectsDisplayed, projectsCurrentLine, onContentUpdate]);

  useEffect(() => {
    if (projectsLineIdx < PROJECTS_LINES.length) {
      const currentProjectsLine = PROJECTS_LINES[projectsLineIdx];
      
      if (projectsCharIdx < currentProjectsLine.length) {
        const timeout = setTimeout(() => {
          setProjectsCurrentLine(currentProjectsLine.slice(0, projectsCharIdx + 1));
          setProjectsCharIdx(projectsCharIdx + 1);
        }, TYPING_SPEED);
        return () => clearTimeout(timeout);
      } else {
        setProjectsDisplayed(prev => [...prev, currentProjectsLine]);
        setProjectsCurrentLine("");
        setProjectsLineIdx(projectsLineIdx + 1);
        setProjectsCharIdx(0);
      }
    } else {
      const htmlContent = `
        <div class="projects-section">
          ${projectsDisplayed.map(line => {
            const lineType = getLineType(line);
            switch (lineType) {
              case "h1":
                return `<h1 style="color: #32db20;">${line}</h1>`;
              case "separator":
                return `<div style="color: #2ecc26; margin-bottom: 1rem;">${line}</div>`;
              case "empty":
                return `<div style="margin-bottom: 0.5rem;">&nbsp;</div>`;
              case "project-link":
                return `<div style="color: #2ecc26; margin-bottom: 0.5rem;"><a href="${PROJECT_URLS[line]}" target="_blank" rel="noopener noreferrer" style="color: #39ff14; transition: color 300ms; text-decoration: underline; cursor: pointer;" onmouseover="this.style.color='#61dafb'" onmouseout="this.style.color='#39ff14'">${line}</a></div>`;
              default:
                return `<div style="color: #2ecc26; margin-bottom: 0.5rem;">${line}</div>`;
            }
          }).join('')}
        </div>
      `;
      onComplete(htmlContent);
    }
  }, [projectsLineIdx, projectsCharIdx, onComplete, ip, projectsDisplayed]);

  return (
    <div className="projects-section bg-black font-mono p-4">
      <div>
        <span className="prompt" style={{color: '#1a7a0a'}}>root@{ip} {">"} </span>
      </div>
      {projectsDisplayed.map((line: string, i: number) => renderLine(line, i))}
      {projectsCurrentLine && renderCurrentLine(projectsCurrentLine)}
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