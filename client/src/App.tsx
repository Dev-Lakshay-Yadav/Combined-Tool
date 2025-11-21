import { Routes, Route } from "react-router-dom";
import CaseUploader from "./pages/CaseUploader";

const App = () => {
  return (
    <div>
      {/* Route Definitions */}
      <Routes>
        <Route path="/" element={<CaseUploader />} />
        {/* 404 fallback */}
        <Route path="*" element={<h2>404 - Page Not Found</h2>} />
      </Routes>
    </div>
  );
};

export default App;
