import { useCallback } from 'react';
import ReactDOMServer from 'react-dom/server';

// Style content to be included in the printable window
const printStyles = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
  
  body {
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
    margin: 0;
    padding: 0;
    color: #334155;
    line-height: 1.5;
  }
  
  .animate-fade-in {
    animation: fadeIn 0.5s ease-in-out;
  }
  
  @keyframes fadeIn {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }
  
  @media print {
    .print\\:hidden {
      display: none;
    }
    
    body {
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    
    @page {
      size: A4;
      margin: 1cm;
    }
  }
`;

interface UsePrintableWindowProps {
  title?: string;
}

const usePrintableWindow = ({ title = 'Booking Summary' }: UsePrintableWindowProps = {}) => {
  const openPrintableWindow = useCallback((content: React.ReactElement) => {
    const htmlContent = ReactDOMServer.renderToString(content);
    const printWindow = window.open('', '_blank', 'width=1000,height=800');
    
    if (!printWindow) {
      alert('Please allow pop-ups to open the printable version');
      return;
    }

    // Get all stylesheets from the current document
    const stylesheets = Array.from(document.styleSheets)
      .map(sheet => {
        try {
          // For <link href="..."> stylesheets
          if (sheet.href) {
            return `<link rel="stylesheet" href="${sheet.href}">`;
          }
          // For <style>...</style> tags
          if (sheet.cssRules) {
            const rules = Array.from(sheet.cssRules)
              .map(rule => rule.cssText)
              .join('\n');
            return `<style>${rules}</style>`;
          }
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        } catch (e) {
          // Catch potential security errors when accessing cross-origin stylesheets' rules
          // console.warn('Could not access stylesheet rules:', e);
          if (sheet.href) { // Still try to link external stylesheets
            return `<link rel="stylesheet" href="${sheet.href}">`;
          }
        }
        return '';
      })
      .join('\n');
    
    printWindow.document.write(`
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${title}</title>
          ${stylesheets} 
          <style>${printStyles}</style>
        </head>
        <body>
          <div id="root">${htmlContent}</div>
          <script>
            window.onload = function() {
              setTimeout(() => {
                window.print();
              }, 500);
            };
          </script>
        </body>
      </html>
    `);
    
    printWindow.document.close();
  }, [title]);

  return { openPrintableWindow };
};

export default usePrintableWindow;