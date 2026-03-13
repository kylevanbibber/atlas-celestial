import React from 'react';
import { Input } from './input';

export const ColorPicker = ({
  value,
  onChange,
  label,
}) => {
  return (
    <div className="flex items-center gap-2">
      <Input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-16 h-10 p-1 cursor-pointer"
      />
      <Input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="#000000"
        className="flex-1 font-mono"
        maxLength={7}
      />
      {label && (
        <div
          className="w-10 h-10 rounded border border-border"
          style={{ backgroundColor: value }}
          title={label}
        />
      )}
    </div>
  );
};

