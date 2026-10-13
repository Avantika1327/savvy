// Copy this route into your existing router configuration.
// This assumes BrowserRouter is already mounted higher in the application.
import { Route, Routes } from "react-router-dom";
import PlatformTenants from "./PlatformTenants";
import type { Session } from "./authTypes";

type Props = {
  session: Session;
  onLogout: () => void;
};

export default function PlatformTenantsRouteExample({ session, onLogout }: Props) {
  return (
    <Routes>
      <Route
        path="/platform-admin/*"
        element={<PlatformTenants session={session} onLogout={onLogout} />}
      />
    </Routes>
  );
}
