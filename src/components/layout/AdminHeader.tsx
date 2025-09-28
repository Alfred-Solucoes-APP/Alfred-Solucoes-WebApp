import { type MouseEventHandler } from "react";
import "./AdminHeader.css";

type AdminHeaderProps = {
	userLabel?: string | null;
	onLogout: MouseEventHandler<HTMLButtonElement>;
	isLoggingOut?: boolean;
};

export function AdminHeader({ userLabel, onLogout, isLoggingOut = false }: AdminHeaderProps) {
	return (
		<header className="admin-topbar">
			<div className="admin-topbar__logo">
				<div className="admin-topbar__logo-icon" aria-hidden="true" />
				<span className="admin-topbar__logo-text">Alfred</span>
			</div>
			<div className="admin-topbar__actions">
				{userLabel && <span className="admin-topbar__user">{userLabel}</span>}
				<button
					type="button"
					className="admin-topbar__logout"
					onClick={onLogout}
					disabled={isLoggingOut}
				>
					{isLoggingOut ? "Saindo..." : "Sair"}
				</button>
			</div>
		</header>
	);
}
