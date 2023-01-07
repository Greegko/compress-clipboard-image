import { createRoot } from "react-dom/client";

const appNode = document.getElementById("app");
const root = createRoot(appNode!);

root.render(<div>Hello</div>);
