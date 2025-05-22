import React, { useState } from "react";
import { Pencil, Check, X } from "lucide-react";

interface AgentPrintSettingsProps {
  logoUrl: string;
  setLogoUrl: (url: string) => void;
  finalPrice: number;
  setFinalPrice: (price: number) => void;
  originalPrice: number;
}

const AgentPrintSettings: React.FC<AgentPrintSettingsProps> = ({
  logoUrl,
  setLogoUrl,
  finalPrice,
  setFinalPrice,
  originalPrice,
}) => {
  const [tempLogoUrl, setTempLogoUrl] = useState(logoUrl);
  const [tempFinalPrice, setTempFinalPrice] = useState(finalPrice);
  const [editingLogo, setEditingLogo] = useState(false);
  const [editingPrice, setEditingPrice] = useState(false);

  const handleLogoSave = () => {
    setLogoUrl(tempLogoUrl);

    const affData = JSON.parse(localStorage.getItem("mytData") || "{}");
    affData.logoUrl = tempLogoUrl;
    localStorage.setItem("mytData", JSON.stringify(affData));

    setEditingLogo(false);
  };

  const handlePriceSave = () => {
    setFinalPrice(tempFinalPrice);
    setEditingPrice(false);
  };

  return (
    <div className="bg-white rounded-lg shadow p-4 mb-4" dir="rtl">
      <h3 className="font-bold mb-4">הגדרות הדפסה</h3>

      <div className="space-y-4">
        <div>
          <div className="flex items-center mb-1">
            <label
              htmlFor="logoUrl"
              className="block text-m font-medium text-gray-700 ml-1"
            >
              לינק ללוגו סוכנות
            </label>
            {!editingLogo ? (
              <button
                onClick={() => setEditingLogo(true)}
                className="text-teal-600 hover:text-teal-700 transition-colors"
                aria-label="Edit logo URL"
              >
                <Pencil size={16} />
              </button>
            ) : (
              <div className="flex space-x-1">
                <button
                  onClick={handleLogoSave}
                  className="text-green-600 hover:text-green-700 transition-colors"
                  aria-label="Save logo URL"
                >
                  <Check size={16} />
                </button>
                <button
                  onClick={() => {
                    setTempLogoUrl(logoUrl);
                    setEditingLogo(false);
                  }}
                  className="text-red-600 hover:text-red-700 transition-colors"
                  aria-label="Cancel logo URL edit"
                >
                  <X size={16} />
                </button>
              </div>
            )}
          </div>

          {editingLogo ? (
            <input
              type="text"
              id="logoUrl"
              value={tempLogoUrl}
              onChange={(e) => setTempLogoUrl(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500"
              placeholder="https://example.com/logo.png"
            />
          ) : (
            <div className="text-sm text-gray-600 truncate">
              {logoUrl ? logoUrl : "No logo URL set"}
            </div>
          )}

          {logoUrl && (
            <div className="mt-2 max-w-xs">
              <img
                src={logoUrl}
                alt="Company logo preview"
                className="max-h-12 object-contain"
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                }}
              />
            </div>
          )}
        </div>

        {/* Final Price Input */}
        <div>
          <div className="flex items-center mb-1">
            <label
              htmlFor="finalPrice"
              className="block text-m font-medium text-gray-700 ml-1"
            >
              מחיר סופי ללקוח
            </label>
            {!editingPrice ? (
              <button
                onClick={() => setEditingPrice(true)}
                className="text-teal-600 hover:text-teal-700 transition-colors"
                aria-label="Edit final price"
              >
                <Pencil size={16} />
              </button>
            ) : (
              <div className="flex space-x-1">
                <button
                  onClick={handlePriceSave}
                  className="text-green-600 hover:text-green-700 transition-colors"
                  aria-label="Save final price"
                >
                  <Check size={16} />
                </button>
                <button
                  onClick={() => {
                    setTempFinalPrice(finalPrice);
                    setEditingPrice(false);
                  }}
                  className="text-red-600 hover:text-red-700 transition-colors"
                  aria-label="Cancel final price edit"
                >
                  <X size={16} />
                </button>
              </div>
            )}
          </div>

          {editingPrice ? (
            <div className="flex items-center">
              <span className="mr-2">$</span>
              <input
                type="number"
                id="finalPrice"
                value={tempFinalPrice}
                onChange={(e) => setTempFinalPrice(Number(e.target.value))}
                className="w-32 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500"
                min="0"
                step="1"
              />
            </div>
          ) : (
            <div className="flex items-center">
              <span className="text-xl">${finalPrice.toFixed(2)}</span>
              {finalPrice !== originalPrice && (
                <span className="ml-2 text-xs text-teal-600">
                  (Original: ${originalPrice.toFixed(2)})
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AgentPrintSettings;
