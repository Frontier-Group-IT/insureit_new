"use client";

import { useState } from "react";

const MAX_NOTES_LENGTH = 500;

export function InteractionNotesField() {
  const [length, setLength] = useState(0);

  return (
    <label className="block text-[9px] font-black text-[#6D7D94]">
      Notes
      <div className="relative mt-1.5">
        <textarea
          name="note"
          maxLength={MAX_NOTES_LENGTH}
          rows={4}
          placeholder="Add a short interaction note..."
          onChange={(event) => setLength(event.currentTarget.value.length)}
          className="w-full resize-y rounded-lg border border-[#CBD6E3] bg-white px-3 py-2.5 pb-6 text-[10.5px] font-medium leading-5 text-[#213653] outline-none focus:border-[#3156B8] focus:ring-2 focus:ring-[#3156B8]/10"
        />
        <span className="pointer-events-none absolute bottom-2 right-3 text-[8.5px] font-semibold text-[#8292A8]">
          {length}/{MAX_NOTES_LENGTH}
        </span>
      </div>
    </label>
  );
}
