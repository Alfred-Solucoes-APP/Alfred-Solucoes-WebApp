import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AdminHeader } from '../AdminHeader';

describe('AdminHeader', () => {
	it('renders user label when provided', () => {
		render(<AdminHeader userLabel="admin@example.com" onLogout={vi.fn()} />);
		expect(screen.getByText('admin@example.com')).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Sair' })).toBeEnabled();
	});

	it('calls logout handler when clicking', async () => {
		const user = userEvent.setup();
		const onLogout = vi.fn();
		render(<AdminHeader userLabel="user@test.com" onLogout={onLogout} />);

		await user.click(screen.getByRole('button', { name: 'Sair' }));

		expect(onLogout).toHaveBeenCalledTimes(1);
	});

	it('disables button and shows loading label when logging out', () => {
		render(<AdminHeader userLabel="user@test.com" onLogout={vi.fn()} isLoggingOut />);
		const button = screen.getByRole('button', { name: 'Saindo...' });
		expect(button).toBeDisabled();
	});
});
