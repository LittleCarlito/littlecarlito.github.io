import { useEffect, useState } from "react";

const TYPING_SPEED = 1;

interface WorkExperience {
  company: string;
  title: string;
  location: string;
  bullets: string[];
}

const WORK_DATA: WorkExperience[] = [
  {
    company: "Apex Systems",
    title: "Java Engineer",
    location: "Remote | June 2024 - Present",
    bullets: [
      "• Architects and implements enterprise-scale Java solutions for Fortune 500 healthcare clients",
      "• Established comprehensive development standards improving code quality by 40%",  
      "• Spearheads client integration with SailPoint identity management platform",
      "• Mentors engineering teams on test-driven development, achieving 95% code coverage"
    ]
  },
  {
    company: "Northwestern Mutual",
    title: "Software Engineer II",
    location: "Franklin, WI | 2023 - June 2024",
    bullets: [
      "• Pioneered AI-driven healthcare payment matching system processing $50M+ annually",
      "• Led development of mission-critical document processing service handling 100K+ transactions daily",
      "• Architected scalable microservices ecosystem with NoSQL backend supporting 1M+ users",
      "• Achieved 99.99% uptime across critical systems with zero production incidents"
    ]
  },
  {
    company: "Northwestern Mutual",
    title: "Software Engineer",
    location: "2021 - 2023",
    bullets: [
      "• Modernized legacy mainframe systems reducing processing time by 70%",
      "• Earned AWS certification and led cloud migration initiatives",
      "• Implemented comprehensive testing framework achieving 90% coverage across 50K+ lines of code"
    ]
  },
  {
    company: "Quad Graphics",
    title: "Business Analyst",
    location: "Sussex, WI | 2014 - 2018",
    bullets: [
      "• Orchestrated Agile transformation across 5 development teams",
      "• Revolutionized healthcare mailing system reducing client onboarding from 6 weeks to 5 days",
      "• Managed sensitive healthcare data for 10M+ patients with perfect compliance record"
    ]
  }
];

interface WorkOutputProps {
  ip: string;
  onComplete: (content: string) => void;
  onContentUpdate?: () => void;
}

export default function WorkOutput({ ip, onComplete, onContentUpdate }: WorkOutputProps) {
  const [workDisplayed, setWorkDisplayed] = useState<string[]>([]);
  const [workCurrentLine, setWorkCurrentLine] = useState<string>("");
  const [workLineIdx, setWorkLineIdx] = useState<number>(0);
  const [workCharIdx, setWorkCharIdx] = useState<number>(0);

  const getLineType = (line: string) => {
    if (line === "WORK EXPERIENCE") return "h1";
    if (line === "================================") return "separator";
    if (WORK_DATA.some(job => job.company === line)) return "h2";
    if (WORK_DATA.some(job => job.title === line)) return "h3";
    if (WORK_DATA.some(job => job.location === line)) return "location";
    if (line.includes('•')) return "bullet";
    return "text";
  };

  const renderLine = (line: string, index: number) => {
    const lineType = getLineType(line);
    
    switch (lineType) {
      case "h1":
        return <h1 key={index} className="text-2xl font-bold text-green-400 mb-4">{line}</h1>;
      case "separator":
        return <div key={index} className="text-green-400 mb-4">{line}</div>;
      case "h2":
        return <h2 key={index} className="text-xl font-semibold text-green-300 mt-6 mb-2">{line}</h2>;
      case "h3":
        return <h3 key={index} className="text-lg font-medium text-green-300 mb-1">{line}</h3>;
      case "location":
        return <div key={index} className="text-green-300 italic mb-2">{line}</div>;
      case "bullet":
        return <div key={index} className="text-green-100 ml-4 mb-1">{line}</div>;
      default:
        return <div key={index} className="text-green-100">{line}</div>;
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
      case "h2":
        return (
          <h2 className="text-xl font-semibold text-green-300 mt-6 mb-2">
            {line}
            <span className="blinking-cursor">|</span>
          </h2>
        );
      case "h3":
        return (
          <h3 className="text-lg font-medium text-green-300 mb-1">
            {line}
            <span className="blinking-cursor">|</span>
          </h3>
        );
      case "location":
        return (
          <div className="text-green-300 italic mb-2">
            {line}
            <span className="blinking-cursor">|</span>
          </div>
        );
      case "bullet":
        return (
          <div className="text-green-100 ml-4 mb-1">
            {line}
            <span className="blinking-cursor">|</span>
          </div>
        );
      default:
        return (
          <div className="text-green-100">
            {line}
            <span className="blinking-cursor">|</span>
          </div>
        );
    }
  };

  useEffect(() => {
    onContentUpdate?.();
  }, [workDisplayed, workCurrentLine, onContentUpdate]);

  useEffect(() => {
    const allWorkLines = [
      "================================",
      "WORK EXPERIENCE",
      "================================",
      ...WORK_DATA.flatMap(job => [
        job.company,
        job.title,
        job.location,
        ...job.bullets
      ])
    ];

    if (workLineIdx < allWorkLines.length) {
      const currentWorkLine = allWorkLines[workLineIdx];
      
      if (workCharIdx < currentWorkLine.length) {
        const timeout = setTimeout(() => {
          setWorkCurrentLine(currentWorkLine.slice(0, workCharIdx + 1));
          setWorkCharIdx(workCharIdx + 1);
        }, TYPING_SPEED);
        return () => clearTimeout(timeout);
      } else {
        setWorkDisplayed(prev => [...prev, currentWorkLine]);
        setWorkCurrentLine("");
        setWorkLineIdx(workLineIdx + 1);
        setWorkCharIdx(0);
      }
    } else {
      const htmlContent = `
        <div class="work-section">
          ${workDisplayed.map(line => {
            const lineType = getLineType(line);
            switch (lineType) {
              case "h1":
                return `<h1 class="text-2xl font-bold text-green-400 mb-4">${line}</h1>`;
              case "separator":
                return `<div class="text-green-400 mb-4">${line}</div>`;
              case "h2":
                return `<h2 class="text-xl font-semibold text-green-300 mt-6 mb-2">${line}</h2>`;
              case "h3":
                return `<h3 class="text-lg font-medium text-green-300 mb-1">${line}</h3>`;
              case "location":
                return `<div class="text-green-300 italic mb-2">${line}</div>`;
              case "bullet":
                return `<div class="text-green-100 ml-4 mb-1">${line}</div>`;
              default:
                return `<div class="text-green-100">${line}</div>`;
            }
          }).join('')}
        </div>
      `;
      onComplete(htmlContent);
    }
  }, [workLineIdx, workCharIdx, onComplete, ip, workDisplayed]);

  return (
    <div className="work-section bg-black text-green-400 font-mono p-4">
      <div>
        <span className="prompt text-green-400">root@{ip} {">"} </span>
      </div>
      {workDisplayed.map((line: string, i: number) => renderLine(line, i))}
      {workCurrentLine && renderCurrentLine(workCurrentLine)}
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