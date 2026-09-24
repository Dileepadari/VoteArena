/** The route table, and the shell every page renders inside. */

import { BrowserRouter, Navigate, Route, Routes, useParams } from "react-router-dom";
import { ToastProvider } from "./components/Toast";
import { Console } from "./pages/console/Console";
import { Host } from "./pages/Host";
import { Landing } from "./pages/Landing";
import { NotFound } from "./pages/NotFound";
import { Vote } from "./pages/Vote";
import { Wall } from "./pages/Wall";

/** Older/shorter share links land here and are normalised onto /v/:code. */
function JoinRedirect() {
  const { code } = useParams();
  return <Navigate to={`/v/${(code ?? "").toUpperCase()}`} replace />;
}

export function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/host" element={<Host />} />
          <Route path="/c/:code" element={<Console />} />
          <Route path="/w/:code" element={<Wall />} />
          <Route path="/v/:code" element={<Vote />} />
          <Route path="/j/:code" element={<JoinRedirect />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </ToastProvider>
    </BrowserRouter>
  );
}
