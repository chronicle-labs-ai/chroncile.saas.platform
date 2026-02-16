"use client";

import { useState } from "react";

interface StarRatingProps {
  value: number; // 1-5
  onChange?: (value: number) => void;
  readonly?: boolean;
}

export function StarRating({ value, onChange, readonly = false }: StarRatingProps) {
  const [hover, setHover] = useState<number | null>(null);

  const display = hover ?? value;

  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={readonly}
          className={`
            w-5 h-5 transition-colors duration-fast
            ${readonly ? "cursor-default" : "cursor-pointer"}
            ${star <= display ? "text-caution" : "text-tertiary"}
          `}
          onMouseEnter={() => !readonly && setHover(star)}
          onMouseLeave={() => !readonly && setHover(null)}
          onClick={() => onChange?.(star)}
        >
          <svg viewBox="0 0 20 20" fill="currentColor" className="w-full h-full">
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
        </button>
      ))}
      <span className="ml-1.5 font-mono text-[11px] text-secondary tabular-nums">
        {value}/5
      </span>
    </div>
  );
}
