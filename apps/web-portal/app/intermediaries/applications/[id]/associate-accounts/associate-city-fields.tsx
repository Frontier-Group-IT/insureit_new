"use client";

import { useId, useMemo, useState } from "react";

type CityOption = {
  city: string;
  state: string;
  postalCode: string;
};

const CITY_OPTIONS: CityOption[] = [
  { city: "Ahmedabad", state: "Gujarat", postalCode: "380001" },
  { city: "Ajmer", state: "Rajasthan", postalCode: "305001" },
  { city: "Allahabad (Prayagraj)", state: "Uttar Pradesh", postalCode: "211001" },
  { city: "Alwar", state: "Rajasthan", postalCode: "301001" },
  { city: "Amravati", state: "Maharashtra", postalCode: "444601" },
  { city: "Amritsar", state: "Punjab", postalCode: "143001" },
  { city: "Anuppur", state: "Madhya Pradesh", postalCode: "484224" },
  { city: "Aurangabad", state: "Maharashtra", postalCode: "431001" },
  { city: "Balaghat", state: "Madhya Pradesh", postalCode: "481001" },
  { city: "Bengaluru", state: "Karnataka", postalCode: "560001" },
  { city: "Bharatpur", state: "Rajasthan", postalCode: "321001" },
  { city: "Bhilai", state: "Chhattisgarh", postalCode: "490001" },
  { city: "Bhopal", state: "Madhya Pradesh", postalCode: "462001" },
  { city: "Bhubaneswar", state: "Odisha", postalCode: "751001" },
  { city: "Bilaspur", state: "Chhattisgarh", postalCode: "495001" },
  { city: "Chandigarh", state: "Chandigarh", postalCode: "160017" },
  { city: "Chennai", state: "Tamil Nadu", postalCode: "600001" },
  { city: "Chhindwara", state: "Madhya Pradesh", postalCode: "480001" },
  { city: "Coimbatore", state: "Tamil Nadu", postalCode: "641001" },
  { city: "Damoh", state: "Madhya Pradesh", postalCode: "470661" },
  { city: "Dehradun", state: "Uttarakhand", postalCode: "248001" },
  { city: "Delhi", state: "Delhi", postalCode: "110001" },
  { city: "Dewas", state: "Madhya Pradesh", postalCode: "455001" },
  { city: "Dindori", state: "Madhya Pradesh", postalCode: "481880" },
  { city: "Durg", state: "Chhattisgarh", postalCode: "491001" },
  { city: "Faridabad", state: "Haryana", postalCode: "121001" },
  { city: "Gandhinagar", state: "Gujarat", postalCode: "382010" },
  { city: "Ghaziabad", state: "Uttar Pradesh", postalCode: "201001" },
  { city: "Goa (Panaji)", state: "Goa", postalCode: "403001" },
  { city: "Gorakhpur", state: "Uttar Pradesh", postalCode: "273001" },
  { city: "Gurugram", state: "Haryana", postalCode: "122001" },
  { city: "Gwalior", state: "Madhya Pradesh", postalCode: "474001" },
  { city: "Hyderabad", state: "Telangana", postalCode: "500001" },
  { city: "Indore", state: "Madhya Pradesh", postalCode: "452001" },
  { city: "Jabalpur", state: "Madhya Pradesh", postalCode: "482001" },
  { city: "Jaipur", state: "Rajasthan", postalCode: "302001" },
  { city: "Jalandhar", state: "Punjab", postalCode: "144001" },
  { city: "Jammu", state: "Jammu and Kashmir", postalCode: "180001" },
  { city: "Jamshedpur", state: "Jharkhand", postalCode: "831001" },
  { city: "Jodhpur", state: "Rajasthan", postalCode: "342001" },
  { city: "Katni", state: "Madhya Pradesh", postalCode: "483501" },
  { city: "Kochi", state: "Kerala", postalCode: "682001" },
  { city: "Kolkata", state: "West Bengal", postalCode: "700001" },
  { city: "Kota", state: "Rajasthan", postalCode: "324001" },
  { city: "Lucknow", state: "Uttar Pradesh", postalCode: "226001" },
  { city: "Ludhiana", state: "Punjab", postalCode: "141001" },
  { city: "Madurai", state: "Tamil Nadu", postalCode: "625001" },
  { city: "Mandla", state: "Madhya Pradesh", postalCode: "481661" },
  { city: "Mangaluru", state: "Karnataka", postalCode: "575001" },
  { city: "Meerut", state: "Uttar Pradesh", postalCode: "250001" },
  { city: "Mumbai", state: "Maharashtra", postalCode: "400001" },
  { city: "Mysuru", state: "Karnataka", postalCode: "570001" },
  { city: "Nagpur", state: "Maharashtra", postalCode: "440001" },
  { city: "Narsinghpur", state: "Madhya Pradesh", postalCode: "487001" },
  { city: "Nashik", state: "Maharashtra", postalCode: "422001" },
  { city: "Navi Mumbai", state: "Maharashtra", postalCode: "400703" },
  { city: "Noida", state: "Uttar Pradesh", postalCode: "201301" },
  { city: "Patna", state: "Bihar", postalCode: "800001" },
  { city: "Pune", state: "Maharashtra", postalCode: "411001" },
  { city: "Raipur", state: "Chhattisgarh", postalCode: "492001" },
  { city: "Rajkot", state: "Gujarat", postalCode: "360001" },
  { city: "Ranchi", state: "Jharkhand", postalCode: "834001" },
  { city: "Ratlam", state: "Madhya Pradesh", postalCode: "457001" },
  { city: "Rewa", state: "Madhya Pradesh", postalCode: "486001" },
  { city: "Sagar", state: "Madhya Pradesh", postalCode: "470001" },
  { city: "Satna", state: "Madhya Pradesh", postalCode: "485001" },
  { city: "Sehore", state: "Madhya Pradesh", postalCode: "466001" },
  { city: "Seoni", state: "Madhya Pradesh", postalCode: "480661" },
  { city: "Shahdol", state: "Madhya Pradesh", postalCode: "484001" },
  { city: "Shimla", state: "Himachal Pradesh", postalCode: "171001" },
  { city: "Srinagar", state: "Jammu and Kashmir", postalCode: "190001" },
  { city: "Surat", state: "Gujarat", postalCode: "395001" },
  { city: "Thane", state: "Maharashtra", postalCode: "400601" },
  { city: "Thiruvananthapuram", state: "Kerala", postalCode: "695001" },
  { city: "Udaipur", state: "Rajasthan", postalCode: "313001" },
  { city: "Ujjain", state: "Madhya Pradesh", postalCode: "456001" },
  { city: "Vadodara", state: "Gujarat", postalCode: "390001" },
  { city: "Varanasi", state: "Uttar Pradesh", postalCode: "221001" },
  { city: "Vijayawada", state: "Andhra Pradesh", postalCode: "520001" },
  { city: "Visakhapatnam", state: "Andhra Pradesh", postalCode: "530001" },
];

const inputClass =
  "h-10 w-full rounded-xl border border-[#D8DEE9] bg-white px-3 text-[11px] text-[#17203A] outline-none focus:border-[#315B9A] focus:ring-2 focus:ring-[#DCE8FA]";

export function AssociateCityFields({
  defaultCity = "",
  defaultState = "",
  defaultPostalCode = "",
}: {
  defaultCity?: string;
  defaultState?: string;
  defaultPostalCode?: string;
}) {
  const [city, setCity] = useState(defaultCity);
  const [state, setState] = useState(defaultState);
  const [postalCode, setPostalCode] = useState(defaultPostalCode);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const listboxId = useId();

  const matches = useMemo(() => {
    const needle = city.trim().toLowerCase();
    if (!needle) return [];

    return CITY_OPTIONS
      .filter((option) => option.city.toLowerCase().includes(needle))
      .sort((a, b) => {
        const aStarts = a.city.toLowerCase().startsWith(needle) ? 0 : 1;
        const bStarts = b.city.toLowerCase().startsWith(needle) ? 0 : 1;
        return aStarts - bStarts || a.city.localeCompare(b.city);
      })
      .slice(0, 8);
  }, [city]);

  function selectCity(option: CityOption) {
    setCity(option.city);
    setState(option.state);
    setPostalCode(option.postalCode);
    setOpen(false);
    setActiveIndex(0);
  }

  function handleCityChange(value: string) {
    setCity(value);
    setOpen(Boolean(value.trim()));
    setActiveIndex(0);

    const exact = CITY_OPTIONS.find(
      (option) => option.city.toLowerCase() === value.trim().toLowerCase(),
    );
    if (exact) {
      setState(exact.state);
      setPostalCode(exact.postalCode);
      return;
    }

    setState("");
    setPostalCode("");
  }

  return (
    <>
      <label className="relative">
        <span className="mb-1.5 block text-[8.5px] font-bold uppercase tracking-wide text-[#64748B]">
          City
        </span>
        <input
          name="city"
          value={city}
          onChange={(event) => handleCityChange(event.target.value)}
          onFocus={() => setOpen(Boolean(city.trim()))}
          onBlur={() => window.setTimeout(() => setOpen(false), 120)}
          onKeyDown={(event) => {
            if (!open || !matches.length) return;
            if (event.key === "ArrowDown") {
              event.preventDefault();
              setActiveIndex((index) => Math.min(index + 1, matches.length - 1));
            } else if (event.key === "ArrowUp") {
              event.preventDefault();
              setActiveIndex((index) => Math.max(index - 1, 0));
            } else if (event.key === "Enter") {
              event.preventDefault();
              selectCity(matches[activeIndex] ?? matches[0]);
            } else if (event.key === "Escape") {
              setOpen(false);
            }
          }}
          className={inputClass}
          placeholder="Start typing city"
          autoComplete="address-level2"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={open && matches.length > 0}
          aria-controls={listboxId}
        />
        {open && matches.length ? (
          <div
            id={listboxId}
            role="listbox"
            className="absolute left-0 right-0 top-[62px] z-50 max-h-60 overflow-y-auto rounded-xl border border-[#D8E2EE] bg-white py-1.5 shadow-[0_14px_35px_rgba(15,23,42,.14)]"
          >
            {matches.map((option, index) => (
              <button
                key={`${option.city}-${option.state}`}
                type="button"
                role="option"
                aria-selected={index === activeIndex}
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => selectCity(option)}
                className={`flex w-full items-center justify-between gap-3 px-3 py-2 text-left transition ${
                  index === activeIndex ? "bg-[#EEF4FF]" : "hover:bg-[#F8FAFC]"
                }`}
              >
                <span className="min-w-0">
                  <span className="block truncate text-[10.5px] font-semibold text-[#17203A]">
                    {option.city}
                  </span>
                  <span className="block truncate text-[9px] text-[#64748B]">{option.state}</span>
                </span>
                <span className="shrink-0 text-[9px] font-semibold text-[#64748B]">{option.postalCode}</span>
              </button>
            ))}
          </div>
        ) : null}
      </label>

      <label>
        <span className="mb-1.5 block text-[8.5px] font-bold uppercase tracking-wide text-[#64748B]">
          State
        </span>
        <input
          name="state"
          value={state}
          readOnly
          className={`${inputClass} cursor-default bg-[#F8FAFC] text-[#475569]`}
          placeholder="Auto-filled"
          autoComplete="address-level1"
          title="State is filled automatically after selecting a city."
        />
      </label>

      <label>
        <span className="mb-1.5 block text-[8.5px] font-bold uppercase tracking-wide text-[#64748B]">
          PIN Code
        </span>
        <input
          name="postal_code"
          value={postalCode}
          onChange={(event) => setPostalCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
          className={inputClass}
          placeholder="PIN Code"
          inputMode="numeric"
          autoComplete="postal-code"
          maxLength={6}
          title="A default PIN is suggested after city selection. You can edit it."
        />
      </label>
    </>
  );
}
