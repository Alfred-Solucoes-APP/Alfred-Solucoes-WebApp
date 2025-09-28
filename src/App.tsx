import { Router } from "./routes/private/router";
import { AuthProvider } from "./state/auth/AuthProvider";

export default function App() {

  return (
    <AuthProvider>
      <Router />
    </AuthProvider>
  );
}

