import React, { useEffect, useState } from "react";
import { Pencil, Check, X } from "lucide-react";
import Image from "next/image";

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
  const [logoError, setLogoError] = useState(false);

  // Reset preview error when the saved logo URL changes
  useEffect(() => {
    setLogoError(false);
  }, [logoUrl]);

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
                className="text-forest hover:text-forest/80 transition-colors"
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
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-glow"
              placeholder="https://example.com/logo.png"
            />
          ) : (
            <div className="text-sm text-gray-600 truncate">
              {logoUrl ? logoUrl : "No logo URL set"}
            </div>
          )}

          {logoUrl && !logoError && (
            <div className="mt-2 max-w-xs">
              <Image
                src={logoUrl}
                alt="Company logo preview"
                width={200}
                height={48}
                className="max-h-12 object-contain"
                unoptimized
                onError={() => setLogoError(true)}
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
                className="text-forest hover:text-forest/80 transition-colors"
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
                className="w-32 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-glow"
                min="0"
                step="1"
              />
            </div>
          ) : (
            <div className="flex items-center">
              <span className="text-xl">${finalPrice.toFixed(2)}</span>
              {finalPrice !== originalPrice && (
                <span className="ml-2 text-xs text-forest">
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
