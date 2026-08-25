import { Navigate, Route, Routes } from "react-router-dom";
import { LedgeDetailPage } from "@/pages/LedgeDetailPage";
import { MapPage } from "@/pages/MapPage";

export function App() {
  return (
    <Routes>
      <Route path="/" element={<MapPage />} />
      <Route path="/ledges/:id" element={<LedgeDetailPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
