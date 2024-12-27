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
    <div className="flex flex-col items-center justify-center w-2/3">
      <div className="relative w-full">
        <select
          id="option-select"
          value={value}
          onChange={handleChange}
          className="block w-full text-2xl font-bold px-4 py-2 bg-white border border-gray-300 rounded-md shadow-lg appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          {[1, 2, 3, 4, 5].map((i) => (
            <option key={i} value={i}>
              {i}
            </option>
          ))}
        </select>
        <ChevronDown className="absolute top-1/2 left-3 transform -translate-y-1/2 text-gray-400 pointer-events-none w-6 h-6" />
      </div>
    </div>
  );
}
