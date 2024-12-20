import React from "react";
import { ChevronDown } from "lucide-react";

export default function OptionSelect({
  value,
  onChange,
}: {
  value: number;
  onChange: (value: string) => void;
}) {
  const handleChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    onChange(event.target.value);
  };

  return (
    <div className="flex flex-col items-center justify-center">
      <div className="relative">
        <select
          dir="rtl"
          id="option-select"
          value={value}
          onChange={handleChange}
          className="block text-2xl font-bold w-48 px-4 py-2 bg-white border border-gray-300 rounded-md shadow-lg appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="1">1</option>
          <option value="2">2</option>
          <option value="3">3</option>
          <option value="4">4</option>
          <option value="5">5</option>
        </select>
        <ChevronDown className="absolute top-1/2 left-3 transform -translate-y-1/2 text-gray-400 pointer-events-none w-6 h-6" />
      </div>
    </div>
  );
}
