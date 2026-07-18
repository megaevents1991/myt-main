import { ToggleLeft, ToggleRight, Printer } from "lucide-react";

interface AgentModeProps {
  isAgentMode: boolean;
  onToggleAgentMode: () => void;
  onPrintForClient: () => void;
}

const AgentMode: React.FC<AgentModeProps> = ({
  isAgentMode,
  onToggleAgentMode,
  onPrintForClient,
}) => {
  return (
    <div className="bg-white rounded-lg shadow p-4 mb-4" dir="rtl">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center">
          <h3 className="font-bold mr-2">מסך סוכן נסיעות</h3>
          <button
            onClick={onToggleAgentMode}
            className="flex items-center text-sm mx-2"
            aria-label={
              isAgentMode ? "Disable agent mode" : "Enable agent mode"
            }
          >
            {isAgentMode ? (
              <>
                <ToggleRight size={24} />
              </>
            ) : (
              <>
                <ToggleLeft className="text-gray-400" size={24} />
              </>
            )}
          </button>
        </div>
      </div>

      {isAgentMode && (
        <div className="mt-4 space-y-3">
          <p className="text-sm text-gray-600">
            מצב זה מאפשר להדפיס הצעת מחיר ללקוח עם לוגו משרדך ומחיר סופי ללקוח
            עפ&quot;י שיקול דעתך
          </p>
          <button
            onClick={onPrintForClient}
            className="flex items-center px-4 py-2 bg-secondary text-secondary-foreground rounded hover:bg-secondary/80 transition-colors"
            aria-label="Print for client"
          >
            <Printer size={16} className="mr-2" />
            <span>הדפסה ללקוח</span>
          </button>
        </div>
      )}
    </div>
  );
};

export default AgentMode;
