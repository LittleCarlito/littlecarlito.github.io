import { useEffect, useState, useRef } from "react";
import WorkOutput from "./WorkOutput";
import AboutOutput from "./AboutOutput";
import ProjectsOutput from "./ProjectsOutput";
import ContactOutput from "./ContactOutput";
import ScanOutput from "./ScanOutput";
import EducationOutput from "./EducationOutput";

const TYPING_SPEED = 15;

function randomIP(): string {
  return Array(4)
    .fill(0)
    .map(() => Math.floor(Math.random() * 256))
    .join(".");
}

const startupLines: string[] = [
  "Hello there..."
];

const menuLines: string[] = [
  "Select one of the options:",
  "[1] About option",
  "[2] Education option", 
  "[3] Work option", 
  "[4] Projects option",
  "[5] Contact option",
  "[6] Scan hardware for orbit"
];

interface OutputLine {
  id: number;
  type: 'startup' | 'option' | 'command' | 'work' | 'about' | 'projects' | 'contact' | 'scan' | 'education';
  content: string;
  isClickable: boolean;
}

export default function ConsoleOverlay() {
  const [ip] = useState<string>(randomIP());
  const [outputLines, setOutputLines] = useState<OutputLine[]>([]);
  const [currentLine, setCurrentLine] = useState<string>("");
  const [lineIdx, setLineIdx] = useState<number>(0);
  const [charIdx, setCharIdx] = useState<number>(0);
  const [mouseDownOption, setMouseDownOption] = useState<string | null>(null);
  const [touchDownOption, setTouchDownOption] = useState<string | null>(null);
  const [isIdle, setIsIdle] = useState<boolean>(false);
  const [userInput, setUserInput] = useState<string>("");
  const [isPrintingWork, setIsPrintingWork] = useState<boolean>(false);
  const [isPrintingAbout, setIsPrintingAbout] = useState<boolean>(false);
  const [isPrintingProjects, setIsPrintingProjects] = useState<boolean>(false);
  const [isPrintingContact, setIsPrintingContact] = useState<boolean>(false);
  const [isPrintingScan, setIsPrintingScan] = useState<boolean>(false);
  const [isPrintingEducation, setIsPrintingEducation] = useState<boolean>(false);
  const [lineIdCounter, setLineIdCounter] = useState<number>(0);
  const [autoScrollEnabled, setAutoScrollEnabled] = useState<boolean>(true);
  const [showingStartup, setShowingStartup] = useState<boolean>(true);
  const [showingMenu, setShowingMenu] = useState<boolean>(false);
  const consoleRef = useRef<HTMLDivElement>(null);

  const getNextLineId = (): number => {
    setLineIdCounter(prev => prev + 1);
    return lineIdCounter;
  };

  const scrollToBottom = (): void => {
    if (consoleRef.current && autoScrollEnabled) {
      consoleRef.current.scrollTop = consoleRef.current.scrollHeight;
    }
  };

  const handleScroll = (): void => {
    if (consoleRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = consoleRef.current;
      const isAtBottom = scrollTop + clientHeight >= scrollHeight - 5;
      
      if (!isAtBottom && autoScrollEnabled) {
        setAutoScrollEnabled(false);
      } else if (isAtBottom && !autoScrollEnabled) {
        setAutoScrollEnabled(true);
      }
    }
  };

  const handleWorkContentUpdate = (): void => {
    if (autoScrollEnabled) {
      scrollToBottom();
    }
  };

  const handleAboutContentUpdate = (): void => {
    if (autoScrollEnabled) {
      scrollToBottom();
    }
  };

  const handleProjectsContentUpdate = (): void => {
    if (autoScrollEnabled) {
      scrollToBottom();
    }
  };

  const handleContactContentUpdate = (): void => {
    if (autoScrollEnabled) {
      scrollToBottom();
    }
  };

  const handleScanContentUpdate = (): void => {
    if (autoScrollEnabled) {
      scrollToBottom();
    }
  };

  const handleEducationContentUpdate = (): void => {
    if (autoScrollEnabled) {
      scrollToBottom();
    }
  };

  const logMouseDown = (optionText: string): void => {
    console.log(`Mouse down: ${optionText}`);
    setMouseDownOption(optionText);
  };

  const matchInputToOption = (input: string): string | null => {
    const normalizedInput = input.toLowerCase().trim();
    
    if (normalizedInput === "1" || normalizedInput === "[1]") return "[1] About option";
    if (normalizedInput === "2" || normalizedInput === "[2]") return "[2] Education option";
    if (normalizedInput === "3" || normalizedInput === "[3]") return "[3] Work option";
    if (normalizedInput === "4" || normalizedInput === "[4]") return "[4] Projects option";
    if (normalizedInput === "5" || normalizedInput === "[5]") return "[5] Contact option";
    if (normalizedInput === "6" || normalizedInput === "[6]") return "[6] Scan hardware for orbit";
    
    if (normalizedInput === "about" || normalizedInput === "about option") return "[1] About option";
    if (normalizedInput === "education" || normalizedInput === "education option") return "[2] Education option";
    if (normalizedInput === "work" || normalizedInput === "work option") return "[3] Work option";
    if (normalizedInput === "projects" || normalizedInput === "projects option") return "[4] Projects option";
    if (normalizedInput === "contact" || normalizedInput === "contact option") return "[5] Contact option";
    if (normalizedInput === "scan" || normalizedInput === "scan hardware for orbit") return "[6] Scan hardware for orbit";
    
    return null;
  };

  const handleOptionSelection = (optionText: string): void => {
    setAutoScrollEnabled(true);
    switch (optionText) {
      case "[1] About option":
        console.log("About section selected");
        setIsPrintingAbout(true);
        setIsIdle(false);
        break;
      case "[2] Education option":
        console.log("Education section selected");
        setIsPrintingEducation(true);
        setIsIdle(false);
        break;
      case "[3] Work option":
        console.log("Work section selected");
        setIsPrintingWork(true);
        setIsIdle(false);
        break;
      case "[4] Projects option":
        console.log("Projects section selected");
        setIsPrintingProjects(true);
        setIsIdle(false);
        break;
      case "[5] Contact option":
        console.log("Contact section selected");
        setIsPrintingContact(true);
        setIsIdle(false);
        break;
      case "[6] Scan hardware for orbit":
        console.error("ORBITAL SCAN INITIATED");
        setIsPrintingScan(true);
        setIsIdle(false);
        break;
      default:
        console.log(`Unknown option: ${optionText}`);
        break;
    }
  };

  const logMouseUp = (): void => {
    if (mouseDownOption) {
      handleOptionSelection(mouseDownOption);
      setMouseDownOption(null);
    }
  };

  const logTouchDown = (optionText: string): void => {
    console.log(`Touch down: ${optionText}`);
    setTouchDownOption(optionText);
  };

  const logTouchUp = (): void => {
    if (touchDownOption) {
      handleOptionSelection(touchDownOption);
      setTouchDownOption(null);
    }
  };

  const handleKeyPress = (e: KeyboardEvent): void => {
    if (!isIdle || isPrintingWork || isPrintingAbout || isPrintingProjects || isPrintingContact || isPrintingScan || isPrintingEducation) return;

    if (e.key === 'Enter') {
      if (userInput.trim() !== '') {
        setOutputLines(prev => [...prev, {
          id: getNextLineId(),
          type: 'command',
          content: userInput,
          isClickable: false
        }]);
        
        const matchedOption = matchInputToOption(userInput);
        if (matchedOption) {
          handleOptionSelection(matchedOption);
        }
      }
      setUserInput("");
    } else if (e.key === 'Backspace') {
      e.preventDefault();
      setUserInput(prev => prev.slice(0, -1));
    } else if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
      e.preventDefault();
      setUserInput(prev => prev + e.key);
    }
  };

  const handleWorkComplete = (workContent: string): void => {
    setOutputLines(prev => [...prev, {
      id: getNextLineId(),
      type: 'work',
      content: workContent,
      isClickable: false
    }]);
    setIsPrintingWork(false);
    setTimeout(() => printMenuOptions(), 0);
  };

  const handleAboutComplete = (aboutContent: string): void => {
    setOutputLines(prev => [...prev, {
      id: getNextLineId(),
      type: 'about',
      content: aboutContent,
      isClickable: false
    }]);
    setIsPrintingAbout(false);
    setTimeout(() => printMenuOptions(), 0);
  };

  const handleProjectsComplete = (projectsContent: string): void => {
    setOutputLines(prev => [...prev, {
      id: getNextLineId(),
      type: 'projects',
      content: projectsContent,
      isClickable: false
    }]);
    setIsPrintingProjects(false);
    setTimeout(() => printMenuOptions(), 0);
  };

  const handleContactComplete = (contactContent: string): void => {
    setOutputLines(prev => [...prev, {
      id: getNextLineId(),
      type: 'contact',
      content: contactContent,
      isClickable: false
    }]);
    setIsPrintingContact(false);
    setTimeout(() => printMenuOptions(), 0);
  };

  const handleScanComplete = (scanContent: string): void => {
    setOutputLines(prev => [...prev, {
      id: getNextLineId(),
      type: 'scan',
      content: scanContent,
      isClickable: false
    }]);
    setIsPrintingScan(false);
    setTimeout(() => printMenuOptions(), 0);
  };

  const handleEducationComplete = (educationContent: string): void => {
    setOutputLines(prev => [...prev, {
      id: getNextLineId(),
      type: 'education',
      content: educationContent,
      isClickable: false
    }]);
    setIsPrintingEducation(false);
    setTimeout(() => printMenuOptions(), 0);
  };

  const printMenuOptions = (): void => {
    setShowingMenu(true);
    setLineIdx(0);
    setCharIdx(0);
    setCurrentLine("");
  };

  useEffect(() => {
    if (autoScrollEnabled) {
      scrollToBottom();
    }
  }, [outputLines, currentLine, userInput, autoScrollEnabled, showingMenu, isIdle]);

  useEffect(() => {
    const handleGlobalMouseUp = (): void => {
      logMouseUp();
    };
    const handleGlobalTouchUp = (): void => {
      logTouchUp();
    };

    document.addEventListener('mouseup', handleGlobalMouseUp);
    document.addEventListener('touchend', handleGlobalTouchUp);
    return () => {
      document.removeEventListener('mouseup', handleGlobalMouseUp);
      document.removeEventListener('touchend', handleGlobalTouchUp);
    };
  }, [mouseDownOption, touchDownOption]);

  useEffect(() => {
    if (isIdle && !isPrintingWork && !isPrintingAbout && !isPrintingProjects && !isPrintingContact && !isPrintingScan && !isPrintingEducation) {
      document.addEventListener('keydown', handleKeyPress);
      return () => document.removeEventListener('keydown', handleKeyPress);
    }
      }, [isIdle, userInput, ip, isPrintingWork, isPrintingAbout, isPrintingProjects, isPrintingContact, isPrintingScan, isPrintingEducation, handleKeyPress]);

  useEffect(() => {
    if (!showingStartup) return;

    if (lineIdx < startupLines.length) {
      if (charIdx < startupLines[lineIdx].length) {
        const timeout = setTimeout(() => {
          setCurrentLine(
            startupLines[lineIdx].slice(0, charIdx + 1)
          );
          setCharIdx(charIdx + 1);
        }, TYPING_SPEED);
        return () => clearTimeout(timeout);
      } else {
        setOutputLines(prev => [...prev, {
          id: getNextLineId(),
          type: 'startup',
          content: startupLines[lineIdx],
          isClickable: false
        }]);
        setCurrentLine("");
        setLineIdx(lineIdx + 1);
        setCharIdx(0);
      }
    } else {
      setShowingStartup(false);
      printMenuOptions();
    }
  }, [lineIdx, charIdx, showingStartup, getNextLineId]);

  useEffect(() => {
    if (!showingMenu) return;

    if (lineIdx < menuLines.length) {
      if (charIdx < menuLines[lineIdx].length) {
        const timeout = setTimeout(() => {
          setCurrentLine(
            menuLines[lineIdx].slice(0, charIdx + 1)
          );
          setCharIdx(charIdx + 1);
        }, TYPING_SPEED);
        return () => clearTimeout(timeout);
      } else {
        const isOption = lineIdx > 0;
        setOutputLines(prev => [...prev, {
          id: getNextLineId(),
          type: isOption ? 'option' : 'startup',
          content: menuLines[lineIdx],
          isClickable: isOption
        }]);
        setCurrentLine("");
        setLineIdx(lineIdx + 1);
        setCharIdx(0);
      }
    } else {
      setShowingMenu(false);
      setIsIdle(true);
    }
  }, [lineIdx, charIdx, showingMenu, getNextLineId]);

  return (
    <div className="console-overlay" ref={consoleRef} onScroll={handleScroll}>
      {outputLines.map((line: OutputLine) => (
        <div key={line.id}>
          <span className="prompt">root@{ip} {">"} </span>
          {line.type === 'work' || line.type === 'about' || line.type === 'projects' || line.type === 'contact' || line.type === 'education' || line.type === 'scan' ? (
            <div dangerouslySetInnerHTML={{ __html: line.content }} />
          ) : line.isClickable ? (
            <span 
              className="option-text"
              onMouseDown={() => logMouseDown(line.content)}
              onTouchStart={() => logTouchDown(line.content)}
              onClick={() => {}}
            >
              {line.content}
            </span>
          ) : (
            <span className={line.type === 'startup' ? 'startup-text' : 'user-input'}>
              {line.content}
            </span>
          )}
        </div>
      ))}

      {isPrintingWork && (
        <WorkOutput 
          ip={ip} 
          onComplete={handleWorkComplete} 
          onContentUpdate={handleWorkContentUpdate}
        />
      )}

      {isPrintingAbout && (
        <AboutOutput 
          ip={ip} 
          onComplete={handleAboutComplete} 
          onContentUpdate={handleAboutContentUpdate}
        />
      )}

      {isPrintingProjects && (
        <ProjectsOutput 
          ip={ip} 
          onComplete={handleProjectsComplete} 
          onContentUpdate={handleProjectsContentUpdate}
        />
      )}

      {isPrintingContact && (
        <ContactOutput 
          ip={ip} 
          onComplete={handleContactComplete} 
          onContentUpdate={handleContactContentUpdate}
        />
      )}

      {isPrintingEducation && (
        <EducationOutput 
          ip={ip} 
          onComplete={handleEducationComplete} 
          onContentUpdate={handleEducationContentUpdate}
        />
      )}

      {isPrintingScan && (
        <ScanOutput 
          ip={ip} 
          onComplete={handleScanComplete} 
          onContentUpdate={handleScanContentUpdate}
        />
      )}

      {((showingStartup && lineIdx < startupLines.length) || (showingMenu && lineIdx < menuLines.length)) && !isPrintingWork && !isPrintingAbout && !isPrintingProjects && !isPrintingContact && !isPrintingScan && !isPrintingEducation ? (
        <div>
          <span className="prompt">root@{ip} {">"} </span>
          {showingStartup || (showingMenu && lineIdx === 0) ? (
            <>
              <span className="startup-text">{currentLine}</span>
              <span className="blinking-cursor startup-text">|</span>
            </>
          ) : (
            <>
              <span className="option-text">{currentLine}</span>
              <span className="blinking-cursor option-text">|</span>
            </>
          )}
        </div>
      ) : !isPrintingWork && !isPrintingAbout && !isPrintingProjects && !isPrintingContact && !isPrintingScan && !isPrintingEducation && !showingStartup && !showingMenu ? (
        <div>
          <span className="prompt">root@{ip} {">"} </span>
          <span className="user-input">{userInput}</span>
          <span className="blinking-cursor user-input">|</span>
        </div>
      ) : null}
    </div>
  );
}