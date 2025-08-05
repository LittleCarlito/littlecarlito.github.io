import { useEffect, useState } from "react";

const TYPING_SPEED = 1;

const CONTACT_LINES = [
  "================================",
  "CONTACT",
  "================================",
  "",
  "Email: steven.meier77@gmail.com",
  "LinkedIn: https://www.linkedin.com/in/meiersteven/",
  "Discord: blooooork"
];

const CONTACT_URLS: { [key: string]: string } = {
  "steven.meier77@gmail.com": "mailto:steven.meier77@gmail.com",
  "https://www.linkedin.com/in/meiersteven/": "https://www.linkedin.com/in/meiersteven/"
};

interface ContactOutputProps {
  ip: string;
  onComplete: (content: string) => void;
  onContentUpdate?: () => void;
}

export default function ContactOutput({ ip, onComplete, onContentUpdate }: ContactOutputProps) {
  const [contactDisplayed, setContactDisplayed] = useState<string[]>([]);
  const [contactCurrentLine, setContactCurrentLine] = useState<string>("");
  const [contactLineIdx, setContactLineIdx] = useState<number>(0);
  const [contactCharIdx, setContactCharIdx] = useState<number>(0);

  const getLineType = (line: string) => {
    if (line === "CONTACT") return "h1";
    if (line === "================================") return "separator";
    if (line === "") return "empty";
    if (line.includes("Email:") || line.includes("LinkedIn:") || line.includes("Discord:")) return "contact-info";
    return "text";
  };

  const renderContactLine = (line: string) => {
    if (line.includes("Email:")) {
      return (
        <>
          Email: <a 
            href={CONTACT_URLS["steven.meier77@gmail.com"]} 
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
            steven.meier77@gmail.com
          </a>
        </>
      );
    }
    
    if (line.includes("LinkedIn:")) {
      return (
        <>
          LinkedIn: <a 
            href={CONTACT_URLS["https://www.linkedin.com/in/meiersteven/"]} 
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
            https://www.linkedin.com/in/meiersteven/
          </a>
        </>
      );
    }
    
    if (line.includes("Discord:")) {
      return (
        <>
          Discord: <span style={{color: '#2ecc26'}}>blooooork</span>
        </>
      );
    }
    
    return line;
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
      case "contact-info":
        return (
          <div key={index} style={{color: '#2ecc26', marginBottom: '0.5rem'}}>
            {renderContactLine(line)}
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
      case "contact-info":
        return (
          <div style={{color: '#2ecc26', marginBottom: '0.5rem'}}>
            {renderContactLine(line)}
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

  const generateHtmlContactLine = (line: string) => {
    if (line.includes("Email:")) {
      return `Email: <a href="${CONTACT_URLS["steven.meier77@gmail.com"]}" style="color: #39ff14; transition: color 300ms; text-decoration: underline; cursor: pointer;" onmouseover="this.style.color='#61dafb'" onmouseout="this.style.color='#39ff14'">steven.meier77@gmail.com</a>`;
    }
    
    if (line.includes("LinkedIn:")) {
      return `LinkedIn: <a href="${CONTACT_URLS["https://www.linkedin.com/in/meiersteven/"]}" target="_blank" rel="noopener noreferrer" style="color: #39ff14; transition: color 300ms; text-decoration: underline; cursor: pointer;" onmouseover="this.style.color='#61dafb'" onmouseout="this.style.color='#39ff14'">https://www.linkedin.com/in/meiersteven/</a>`;
    }
    
    if (line.includes("Discord:")) {
      return `Discord: <span style="color: #2ecc26;">blooooork</span>`;
    }
    
    return line;
  };

  useEffect(() => {
    onContentUpdate?.();
  }, [contactDisplayed, contactCurrentLine, onContentUpdate]);

  useEffect(() => {
    if (contactLineIdx < CONTACT_LINES.length) {
      const currentContactLine = CONTACT_LINES[contactLineIdx];
      
      if (contactCharIdx < currentContactLine.length) {
        const timeout = setTimeout(() => {
          setContactCurrentLine(currentContactLine.slice(0, contactCharIdx + 1));
          setContactCharIdx(contactCharIdx + 1);
        }, TYPING_SPEED);
        return () => clearTimeout(timeout);
      } else {
        setContactDisplayed(prev => [...prev, currentContactLine]);
        setContactCurrentLine("");
        setContactLineIdx(contactLineIdx + 1);
        setContactCharIdx(0);
      }
    } else {
      const htmlContent = `
        <div class="contact-section">
          ${contactDisplayed.map(line => {
            const lineType = getLineType(line);
            switch (lineType) {
              case "h1":
                return `<h1 style="color: #32db20;">${line}</h1>`;
              case "separator":
                return `<div style="color: #2ecc26; margin-bottom: 1rem;">${line}</div>`;
              case "empty":
                return `<div style="margin-bottom: 0.5rem;">&nbsp;</div>`;
              case "contact-info":
                return `<div style="color: #2ecc26; margin-bottom: 0.5rem;">${generateHtmlContactLine(line)}</div>`;
              default:
                return `<div style="color: #2ecc26; margin-bottom: 0.5rem;">${line}</div>`;
            }
          }).join('')}
        </div>
      `;
      onComplete(htmlContent);
    }
  }, [contactLineIdx, contactCharIdx, onComplete, ip, contactDisplayed]);

  return (
    <div className="contact-section bg-black font-mono p-4">
      <div>
        <span className="prompt" style={{color: '#1a7a0a'}}>root@{ip} {">"} </span>
      </div>
      {contactDisplayed.map((line: string, i: number) => renderLine(line, i))}
      {contactCurrentLine && renderCurrentLine(contactCurrentLine)}
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