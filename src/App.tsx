import { Router } from "./routes/private/router";
import { AuthProvider } from "./shared/state/auth/AuthProvider";

export default function App() {

  return (
    <AuthProvider>
      <Router />
    </AuthProvider>
  );
}

