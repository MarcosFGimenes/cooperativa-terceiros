import React from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import ServicesListClient from "@/app/(pcm)/servicos/ServicesListClient";
import type { PCMServiceListItem } from "@/types/pcm";

vi.mock("next/link", () => ({
  __esModule: true,
  default: ({ children, ...props }: { children: React.ReactNode; href: string }) => (
    <a data-testid="mock-link" {...props}>
      {children}
    </a>
  ),
}));

vi.mock("@/components/ReferenceDatePicker", () => ({
  __esModule: true,
  default: ({
    value,
    onChange,
    helperText,
  }: {
    value?: string | null;
    onChange?: (value: string) => void;
    helperText?: string;
  }) => (
    <div>
      <label className="text-xs font-semibold">Data de referência</label>
      <input
        data-testid="reference-date-input"
        type="date"
        value={value ?? ""}
        onChange={(event) => onChange?.(event.target.value)}
      />
      {helperText ? <p data-testid="reference-helper">{helperText}</p> : null}
    </div>
  ),
}));

describe("ServicesListClient", () => {
  const sampleService: PCMServiceListItem = {
    id: "svc-1",
    status: "aberto",
    totalHours: 10,
    dataInicio: "2024-01-01T00:00:00Z",
    dataFim: "2024-01-11T00:00:00Z",
    os: "OS-1",
    equipmentName: "Bomba 01",
    packageId: "pkg-1",
    setor: "Mecânica",
    updates: [{ data: "2024-01-05T00:00:00Z", percentual: 40 }],
  };

  it("recalcula os percentuais quando a data muda", () => {
    render(
      <ServicesListClient
        initialItems={[sampleService]}
        initialCursor={null}
        initialReferenceDate="2024-01-06"
      />,
    );

    expect(screen.getByTestId("reference-helper")).toHaveTextContent("06/01/2024");
    const initialPlanned = screen.getByText(/Planejado \(06\/01\/2024\):/);
    expect(initialPlanned).toHaveTextContent(/Planejado \(06\/01\/2024\):\s*\d+%/);
    const initialLabel = initialPlanned.textContent;

    const input = screen.getByTestId("reference-date-input");
    fireEvent.change(input, { target: { value: "2024-01-04" } });

    const updatedPlanned = screen.getByText(/Planejado \(04\/01\/2024\):/);
    expect(updatedPlanned).toHaveTextContent(/Planejado \(04\/01\/2024\):\s*\d+%/);
    expect(updatedPlanned.textContent).not.toEqual(initialLabel);
  });
});
