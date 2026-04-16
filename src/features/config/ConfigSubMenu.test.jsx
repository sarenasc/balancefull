/* @vitest-environment jsdom */
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ConfigSubMenu from './ConfigSubMenu';

describe('ConfigSubMenu', () => {
  it('renders the current section and notifies tab changes', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(<ConfigSubMenu active="turnos" onChange={onChange} />);

    const turnosButton = screen.getByRole('button', { name: 'Turnos' });
    const exportadorasButton = screen.getByRole('button', { name: /Exportadoras/i });

    expect(turnosButton).toBeInTheDocument();
    await user.click(exportadorasButton);

    expect(onChange).toHaveBeenCalledWith('exportadoras');
  });
});
