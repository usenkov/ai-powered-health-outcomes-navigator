
import React from 'react';

interface ResultCardProps {
  title: string;
  value: number | null;
  interpretation: string;
}

const formatValue = (value: number | null): string => {
    if (value === null) return 'Not Calculable';
    if (value === Infinity) return 'Infinity';
    return value.toFixed(3);
}

export const ResultCard: React.FC<ResultCardProps> = ({ title, value, interpretation }) => {
  return (
    <div className="bg-white p-4 rounded-lg shadow-sm border border-slate-200">
      <h4 className="text-md font-semibold text-slate-800">{title}</h4>
      <p className="text-3xl font-bold text-blue-600 my-2">{formatValue(value)}</p>
      <p className="text-sm text-slate-600">{interpretation}</p>
    </div>
  );
};
