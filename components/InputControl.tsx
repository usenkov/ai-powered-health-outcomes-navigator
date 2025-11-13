
import React from 'react';

interface InputControlProps {
  id: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder: string;
}

export const InputControl: React.FC<InputControlProps> = ({ id, value, onChange, placeholder }) => {
  return (
      <input
        type="number"
        id={id}
        name={id}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        min="0"
        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-sm shadow-sm placeholder-slate-400
                   focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                   transition duration-150 ease-in-out"
      />
  );
};
