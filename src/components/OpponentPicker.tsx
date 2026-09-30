import { useId, useState } from "react";

// Espaços extras e maiúsculas não devem transformar o mesmo nome em outro baralho.
export function normalizeOpponent(name: string) {
  return name.trim().replace(/\s+/gu, " ").toLowerCase();
}

export function OpponentPicker({
  names,
  value,
  confirmed,
  onChange,
  onCreate,
}: {
  names: string[];
  value: string;
  confirmed: boolean;
  onChange: (name: string) => void;
  onCreate: () => void;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const query = normalizeOpponent(value);
  const exists = names.some((name) => normalizeOpponent(name) === query);
  const choices = [
    ...(!query ? [{ label: "Desconhecido", value: "", create: false }] : []),
    ...names
      .filter((name) => normalizeOpponent(name).includes(query))
      .map((name) => ({ label: name, value: name, create: false })),
    ...(query && !exists
      ? [{ label: `Cadastrar novo: “${value.trim()}”`, value, create: true }]
      : []),
  ];
  const activeIndex = Math.min(active, choices.length - 1);

  function choose(index: number) {
    const choice = choices[index];
    if (choice.create) onCreate();
    else onChange(choice.value);
    setOpen(false);
    setActive(0);
  }

  return (
    <div
      className="opponent-picker"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      <label htmlFor={id}>Baralho adversário</label>
      <input
        id={id}
        role="combobox"
        autoComplete="off"
        maxLength={100}
        aria-expanded={open}
        aria-controls={`${id}-options`}
        aria-autocomplete="list"
        aria-activedescendant={open ? `${id}-option-${activeIndex}` : undefined}
        aria-describedby={`${id}-hint`}
        value={value}
        placeholder="Buscar ou selecionar…"
        onFocus={() => {
          setOpen(true);
          setActive(0);
        }}
        onClick={() => setOpen(true)}
        onChange={(event) => {
          onChange(event.target.value);
          setOpen(true);
          setActive(0);
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            setOpen(true);
            setActive(
              open
                ? (activeIndex +
                    (event.key === "ArrowDown" ? 1 : -1) +
                    choices.length) %
                    choices.length
                : 0,
            );
          } else if (event.key === "Enter" && open) {
            event.preventDefault();
            choose(activeIndex);
          } else if (event.key === "Escape") {
            event.preventDefault();
            setOpen(false);
          }
        }}
      />
      {open && (
        <ul
          id={`${id}-options`}
          className="opponent-options"
          role="listbox"
          aria-label="Baralhos adversários"
        >
          {choices.map((choice, index) => (
            <li
              key={`${choice.create}-${choice.value}`}
              id={`${id}-option-${index}`}
              role="option"
              aria-selected={index === activeIndex}
              className={index === activeIndex ? "focused" : ""}
              ref={(element) => {
                if (index === activeIndex)
                  element?.scrollIntoView({ block: "nearest" });
              }}
              onPointerDown={(event) => event.preventDefault()}
              onClick={() => choose(index)}
            >
              {choice.label}
            </li>
          ))}
        </ul>
      )}
      <p id={`${id}-hint`} className="opponent-hint" role="status">
        {!query
          ? "Deixe vazio se não souber o baralho."
          : exists
            ? "Baralho já cadastrado."
            : confirmed
              ? "Novo baralho confirmado. Será cadastrado junto à partida."
              : "Selecione um existente ou escolha “Cadastrar novo” na lista."}
      </p>
    </div>
  );
}
