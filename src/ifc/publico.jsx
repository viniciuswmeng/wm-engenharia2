// Página pública do modelo 3D (link enviado ao cliente): /modelo/:token
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "../index.css";
import PaginaPublica from "./PaginaPublica.jsx";

createRoot(document.getElementById("root")).render(<StrictMode><PaginaPublica /></StrictMode>);
