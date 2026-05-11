import { Route, Routes } from "react-router-dom";
import Layout from "./components/Layout.tsx";
import SetupGate from "./components/SetupGate.tsx";
import Overview from "./routes/Overview.tsx";
import Users from "./routes/Users.tsx";
import Models from "./routes/Models.tsx";
import Machines from "./routes/Machines.tsx";
import Timeseries from "./routes/Timeseries.tsx";
import Sessions from "./routes/Sessions.tsx";
import AdminTokens from "./routes/admin/Tokens.tsx";
import AdminEmbeds from "./routes/admin/Embeds.tsx";
import AdminAudit from "./routes/admin/Audit.tsx";
import Setup from "./routes/Setup.tsx";
import NotFound from "./routes/NotFound.tsx";

export default function App() {
  return (
    <SetupGate>
      <Routes>
        <Route path="/setup" element={<Setup />} />
        <Route element={<Layout />}>
          <Route path="/" element={<Overview />} />
          <Route path="/users" element={<Users />} />
          <Route path="/users/:name" element={<Users />} />
          <Route path="/models" element={<Models />} />
          <Route path="/models/:family" element={<Models />} />
          <Route path="/machines" element={<Machines />} />
          <Route path="/timeseries" element={<Timeseries />} />
          <Route path="/sessions" element={<Sessions />} />
          <Route path="/admin/tokens" element={<AdminTokens />} />
          <Route path="/admin/embeds" element={<AdminEmbeds />} />
          <Route path="/admin/audit" element={<AdminAudit />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </SetupGate>
  );
}
