import React, { ReactNode } from "react";

type SelectWithIconProps = {
  icon: ReactNode;
  value: number;
  onChange: (value: string) => void;
};

export const SelectWithIcon = ({
  icon,
  value,
  onChange,
}: SelectWithIconProps) => {
  return (
    <div className="relative">
      <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-500">
        {icon}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="pl-10 pr-4 py-[6px] border border-gray-300 rounded-lg w-full text-xl appearance-none cursor-pointer bg-white"
      >
        <option value="1">1</option>
        <option value="2">2</option>
        <option value="3">3</option>
        <option value="4">4</option>
        <option value="5">5</option>
        <option value="6">6</option>
        <option value="7">7</option>
        <option value="8">8</option>
        <option value="9">9</option>
        <option value="10">10</option>
      </select>
    </div>
  );
};
