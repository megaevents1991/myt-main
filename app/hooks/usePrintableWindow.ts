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
    // Convert React component to HTML string
    const htmlContent = ReactDOMServer.renderToString(content);
    
    // Create a new window
    const printWindow = window.open('', '_blank', 'width=1000,height=800');
    
    if (!printWindow) {
      alert('Please allow pop-ups to open the printable version');
      return;
    }
    
    // Write content to the new window
    printWindow.document.write(`
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${title}</title>
          <link href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css" rel="stylesheet">
          <style>${printStyles}</style>
        </head>
        <body>
          <div id="root">${htmlContent}</div>
          <script>
            // Automatically open print dialog when content is loaded
            window.onload = function() {
              // Small delay to ensure everything is rendered
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