import { createRoot } from "react-dom/client";
import { App } from "./App";
import "../ui/tokens.css";
import "../ui/animations.css";
import "./styles.css";

createRoot(document.getElementById("root")!).render(<App />);
