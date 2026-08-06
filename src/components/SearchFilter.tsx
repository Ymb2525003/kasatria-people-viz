"use client";

interface SearchFilterProps {
  value: string;
  matchCount: number;
  totalCount: number;
  onChange: (value: string) => void;
}

export function SearchFilter({ value, matchCount, totalCount, onChange }: SearchFilterProps) {
  return (
    <div className="search">
      <label className="search__label" htmlFor="people-search">
        Find people
      </label>
      <input
        id="people-search"
        type="search"
        className="search__input"
        placeholder="Name, country, or interest"
        value={value}
        autoComplete="off"
        onChange={(event) => onChange(event.target.value)}
      />
      {/* aria-live so screen readers hear the result count change. */}
      <span className="search__count" aria-live="polite">
        {value.trim() === ""
          ? `${totalCount} people`
          : `${matchCount} of ${totalCount}`}
      </span>
    </div>
  );
}
